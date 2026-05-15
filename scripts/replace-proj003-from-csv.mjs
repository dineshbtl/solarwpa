#!/usr/bin/env node
/**
 * Replace all PROJ-003 data with surveys from a published Google Sheet CSV.
 *
 * 1) Deletes installations with project_id = PROJ-003 (inspections cascade).
 * 2) Deletes surveys with project_id = PROJ-003.
 * 3) Inserts one pending survey per CSV row (Service Number, Consumer Name, Mobile, Circle, Section).
 *
 * Usage:
 *   node scripts/replace-proj003-from-csv.mjs [path/to.csv]
 *   node scripts/replace-proj003-from-csv.mjs   # defaults to scripts/data/proj003-from-sheet.csv
 *
 * Env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required for delete/insert).
 */

import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = "PROJ-003"

function loadEnvLocal() {
  const p = path.join(__dirname, "../.env.local")
  if (!fs.existsSync(p)) return
  const raw = fs.readFileSync(p, "utf8")
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}

function parseCsvLine(line) {
  const out = []
  let field = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') inQ = false
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ",") {
        out.push(field.trim())
        field = ""
      } else field += c
    }
  }
  out.push(field.trim())
  return out
}

function normMobile(s) {
  const d = String(s || "").replace(/\D/g, "")
  if (d.length >= 10) return d.slice(-10)
  if (d.length === 0) return "9000000000"
  return d.padStart(10, "0").slice(-10)
}

function aadharFromService(serviceNo) {
  const d = String(serviceNo).replace(/\D/g, "")
  if (d.length >= 12) return d.slice(-12)
  return d.padStart(12, "0").slice(-12)
}

async function loadCsvText(argPath) {
  if (argPath && /^https?:\/\//i.test(argPath)) {
    const res = await fetch(argPath, { redirect: "follow" })
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`)
    return res.text()
  }
  const csvPath =
    argPath || path.join(__dirname, "data/proj003-from-sheet.csv")
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}. Download the sheet as CSV or pass a file path / URL.`)
  }
  return fs.readFileSync(csvPath, "utf8")
}

async function main() {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const arg = process.argv[2]
  const raw = await loadCsvText(arg)
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 1) {
    console.error("CSV is empty")
    process.exit(1)
  }

  const firstCols = parseCsvLine(lines[0])
  const firstCellDigits = (firstCols[0] || "").replace(/\D/g, "")
  // Published sheet may omit a header row; if row 1 looks like a service number, treat all lines as data.
  const looksLikeDataRow = firstCellDigits.length >= 10
  const header = looksLikeDataRow
    ? ["Service Number", "Consumer Name", "Mobile", "Circle", "Section"]
    : parseCsvLine(lines[0])
  const dataLines = looksLikeDataRow ? lines : lines.slice(1)
  if (dataLines.length === 0) {
    console.error("CSV has no data rows")
    process.exit(1)
  }

  console.log("CSV header (first cells):", header.slice(0, 6).join(" | "))
  const rows = []
  const seenService = new Set()
  for (const line of dataLines) {
    const cols = parseCsvLine(line)
    const serviceNo = (cols[0] || "").trim()
    if (!serviceNo) continue
    if (seenService.has(serviceNo)) continue
    seenService.add(serviceNo)
    const beneficiaryName = (cols[1] || "").trim() || "Unknown"
    const mobile = normMobile(cols[2])
    const circle = (cols[3] || "").trim()
    const section = (cols[4] || "").trim()
    rows.push({ serviceNo, beneficiaryName, mobile, circle, section })
  }
  console.log("Unique data rows:", rows.length)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: delInst, error: e1 } = await supabase.from("installations").delete().eq("project_id", PROJECT_ID).select("id")
  if (e1) throw e1
  console.log("Deleted installations (PROJ-003):", delInst?.length ?? 0)

  const { data: delSurv, error: e2 } = await supabase.from("surveys").delete().eq("project_id", PROJECT_ID).select("id")
  if (e2) throw e2
  console.log("Deleted surveys (PROJ-003):", delSurv?.length ?? 0)

  const { data: idRows, error: e3 } = await supabase.from("surveys").select("id")
  if (e3) throw e3
  let max = 0
  for (const r of idRows || []) {
    const m = /^SUR-(\d+)$/.exec(r.id)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  let next = max + 1
  console.log("Next survey id suffix starts at", next, "(max existing SUR-* was", max, ")")

  const now = new Date().toISOString()
  const BATCH = 150
  let inserted = 0
  const activitySeed = [{ at: now, action: "submitted", message: "Imported from PROJ-003 roster CSV" }]

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const payload = chunk.map((r) => {
      const id = `SUR-${next++}`
      return {
        id,
        project_id: PROJECT_ID,
        beneficiary_name: r.beneficiaryName.slice(0, 500),
        service_no: r.serviceNo.slice(0, 120),
        aadhar_no: aadharFromService(r.serviceNo),
        mobile: r.mobile,
        pan_no: null,
        contracted_load: null,
        status: "pending",
        upload_date: now,
        submitted_at: now,
        submitted_by_id: null,
        installer_id: null,
        discom_name: "APSPDCL",
        plant_type: "On Grid",
        building_height: 0,
        total_roofs: "G",
        roof_type: "RCC",
        site_location: {
          ...(r.section ? { section: r.section } : {}),
          ...(r.circle ? { circle: r.circle } : {}),
          district: "Kurnool",
          pinCode: "518001",
          state: "Andhra Pradesh",
        },
        bank_details: {},
        site_details: null,
        uploads: {},
        activity: activitySeed,
        remarks: "Bulk import PROJ-003",
      }
    })

    const { error } = await supabase.from("surveys").insert(payload)
    if (error) {
      console.error("Batch insert failed at offset", i, error)
      process.exit(1)
    }
    inserted += payload.length
    if (inserted % 3000 === 0) console.log("Inserted", inserted, "...")
  }

  console.log("Done. Inserted", inserted, "surveys for", PROJECT_ID)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
