#!/usr/bin/env node
/**
 * Import list data from CSV into Supabase surveys table.
 * Usage: node scripts/import-list-csv.mjs [path/to/list.csv | https://...csv-url]
 * Default CSV path: list.csv in project root.
 * If first arg looks like a URL (http/https), fetches CSV from that URL.
 *
 * Loads .env.local for Supabase. Maps CSV columns to survey fields (flexible header names).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import https from 'https'
import http from 'http'

const DEFAULT_CSV = 'list.csv'

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
  })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// Normalize header for matching (lowercase, trim, collapse spaces)
function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Find column index by possible header names
function findCol(headers, ...names) {
  const n = names.map(norm)
  const i = headers.findIndex((h) => n.includes(norm(h)))
  return i >= 0 ? i : -1
}

// Parse CSV line (simple: split by comma, no quoted comma handling for now)
function parseLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === ',' && !inQuotes) || c === '\n' || c === '\r') {
      out.push(cur.trim())
      cur = ''
      if (c !== ',') break
    } else {
      cur += c
    }
  }
  if (cur.length || out.length) out.push(cur.trim())
  return out
}

// Get starting number for survey ids (SUR-001, SUR-002, ...)
let nextSurveyNum = 1
async function initSurveyIdCounter() {
  const { data } = await supabase.from('surveys').select('id').order('created_at', { ascending: false }).limit(2000)
  const nums = (data ?? []).map((r) => parseInt(String(r.id).replace(/^SUR-/, ''), 10)).filter((n) => !Number.isNaN(n))
  nextSurveyNum = nums.length ? Math.max(...nums) + 1 : 1
}
function nextSurveyId() {
  return `SUR-${(nextSurveyNum++).toString().padStart(3, '0')}`
}

function fetchUrl(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const lib = url.protocol === 'https:' ? https : http
    lib.get(urlString, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${urlString}`))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  const input = process.argv[2] || DEFAULT_CSV
  const isUrl = /^https?:\/\//i.test(input)
  let content
  if (isUrl) {
    console.log('Fetching CSV from URL...')
    content = await fetchUrl(input)
  } else {
    const csvPath = resolve(process.cwd(), input)
    if (!existsSync(csvPath)) {
      console.error('CSV not found:', csvPath)
      console.error('Place list.csv in project root or run: node scripts/import-list-csv.mjs path/to/list.csv')
      process.exit(1)
    }
    content = readFileSync(csvPath, 'utf8')
  }
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    console.error('CSV has no header or data rows')
    process.exit(1)
  }

  const headerLine = lines[0]
  const headers = parseLine(headerLine)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    if (cells.some((c) => c.length > 0)) rows.push(cells)
  }

  const idx = {
    consumerName: findCol(headers, 'Consumer Name', 'consumer name', 'name', 'NAME', 'ConsumerName'),
    serviceNo: findCol(headers, 'Service No', 'Service Number', 'service number', 'SERVICE NUMBER', 'ServiceNo'),
    aadhaar: findCol(headers, 'Aadhaar', 'AADHAAR', 'aadhaar', 'Aadhar'),
    mobile: findCol(headers, 'Mobile', 'MOBILE', 'mobile'),
    contractedLoad: findCol(headers, 'Contracted Load', 'contracted load', 'CONTRACTED LOAD'),
    circle: findCol(headers, 'CIRCLE', 'Circle', 'circle'),
    division: findCol(headers, 'DIVISION', 'Division', 'division'),
    subDivision: findCol(headers, 'SUB DIVISION', 'Sub Division', 'sub division', 'subDivision'),
    section: findCol(headers, 'SECTION', 'Section', 'section'),
    district: findCol(headers, 'District', 'DISTRICT', 'district'),
    pinCode: findCol(headers, 'Pin Code', 'PINCODE', 'Pincode', 'pinCode'),
    uploadDate: findCol(headers, 'Upload Date', 'upload date', 'UploadDate'),
    approvedDate: findCol(headers, 'Approved Date', 'approved date', 'ApprovedDate'),
    status: findCol(headers, 'Status', 'status', 'STATUS'),
  }

  const get = (row, key) => {
    const i = idx[key]
    return i >= 0 && row[i] !== undefined ? String(row[i]).trim() : ''
  }

  const validStatuses = ['pending', 'approved', 'rejected', 'completed']
  function parseStatus(s) {
    const v = norm(s)
    if (validStatuses.includes(v)) return v
    if (/approv/i.test(v)) return 'approved'
    if (/reject/i.test(v)) return 'rejected'
    if (/complet/i.test(v)) return 'completed'
    return 'pending'
  }

  function parseDate(s) {
    if (!s) return null
    s = String(s).trim()
    let d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    const [a, b, c] = s.split(/[/\-.]/)
    if (a && b && c) {
      const asNum = (x) => parseInt(x, 10)
      if (c.length === 4) {
        d = new Date(asNum(c), asNum(a) - 1, asNum(b))
      } else {
        d = new Date(asNum(a), asNum(b) - 1, asNum(c))
      }
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    return null
  }

  await initSurveyIdCounter()
  console.log('Importing', rows.length, 'rows into surveys...')
  let inserted = 0
  let errors = 0
  const now = new Date().toISOString()

  for (const row of rows) {
    const beneficiaryName = get(row, 'consumerName') || 'Unknown'
    const serviceNo = get(row, 'serviceNo') || `SVC-${inserted + 1}`
    const aadharNo = get(row, 'aadhaar') || '000000000000'
    const panNo = 'PAN0000000A' // required; CSV often doesn't have PAN
    const district = get(row, 'district') || 'Unknown'
    const pinCode = get(row, 'pinCode') || '000000'

    const uploadDateStr = get(row, 'uploadDate')
    const approvedDateStr = get(row, 'approvedDate')
    const upload_date = parseDate(uploadDateStr) || now
    const approved_date = parseDate(approvedDateStr) || null
    const status = parseStatus(get(row, 'status'))

    const id = nextSurveyId()
    const site_location = {
      section: get(row, 'section') || null,
      subDivision: get(row, 'subDivision') || null,
      division: get(row, 'division') || null,
      circle: get(row, 'circle') || null,
      district,
      pinCode,
    }
    const bank_details = { bankName: 'N/A', accountNo: 'N/A', ifsc: 'N/A' }

    const record = {
      id,
      beneficiary_name: beneficiaryName,
      service_no: serviceNo,
      aadhar_no: aadharNo.replace(/\D/g, '').slice(0, 12) || '000000000000',
      mobile: get(row, 'mobile') || null,
      pan_no: panNo,
      contracted_load: get(row, 'contractedLoad') ? parseFloat(get(row, 'contractedLoad')) : null,
      status,
      upload_date,
      approved_date,
      submitted_at: upload_date,
      discom_name: 'APSPDCL',
      plant_type: 'On Grid',
      building_height: 0,
      total_roofs: 'G',
      roof_type: 'RCC',
      site_location,
      bank_details,
      uploads: {},
      activity: [{ at: now, action: 'submitted', message: 'Imported from list CSV' }],
    }

    const { error } = await supabase.from('surveys').insert(record)
    if (error) {
      console.error('Row error:', error.message, record.beneficiary_name)
      errors++
    } else {
      inserted++
    }
  }

  console.log('Done. Inserted:', inserted, 'Errors:', errors)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
