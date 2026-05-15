#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const raw = fs.readFileSync(envPath, "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "")
    out[key] = value
  }
  return out
}

function getEnv(name, fileEnv = {}) {
  return process.env[name] || fileEnv[name]
}

async function listAllAuthUsers(admin) {
  const users = []
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...(data.users || []))
    if (!data.users?.length || data.users.length < perPage) break
    page += 1
  }
  return users
}

async function main() {
  const root = process.cwd()
  const fileEnv = readEnvFile(path.join(root, ".env.local"))
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL", fileEnv)
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", fileEnv)

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    console.error("Set them in .env.local or environment variables.")
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id,email,name,auth_user_id,status,role")
    .order("created_at", { ascending: false })

  if (profileErr) throw profileErr

  const authUsers = await listAllAuthUsers(admin)
  const authByEmail = new Map(authUsers.map((u) => [String(u.email || "").toLowerCase(), u]))
  const authById = new Map(authUsers.map((u) => [u.id, u]))

  let ok = 0
  const issues = []

  for (const p of profiles || []) {
    const email = String(p.email || "").trim().toLowerCase()
    const linkedById = p.auth_user_id ? authById.get(p.auth_user_id) : undefined
    const linkedByEmail = authByEmail.get(email)

    if (linkedById && linkedByEmail && linkedById.id === linkedByEmail.id) {
      ok += 1
      continue
    }

    if (!p.auth_user_id && linkedByEmail) {
      issues.push({
        severity: "warn",
        code: "missing_auth_user_id",
        profileId: p.id,
        email,
        detail: "Profile exists and auth user exists by email, but profile.auth_user_id is null.",
      })
      continue
    }

    if (p.auth_user_id && !linkedById) {
      issues.push({
        severity: "error",
        code: "broken_auth_link",
        profileId: p.id,
        email,
        detail: `profile.auth_user_id (${p.auth_user_id}) not found in auth.users.`,
      })
      continue
    }

    if (!linkedByEmail) {
      issues.push({
        severity: "error",
        code: "missing_auth_user",
        profileId: p.id,
        email,
        detail: "No auth.users record found for this profile email.",
      })
      continue
    }

    if (p.auth_user_id && linkedByEmail && p.auth_user_id !== linkedByEmail.id) {
      issues.push({
        severity: "warn",
        code: "auth_id_email_mismatch",
        profileId: p.id,
        email,
        detail: `profile.auth_user_id points to ${p.auth_user_id}, but email maps to ${linkedByEmail.id}.`,
      })
    }
  }

  console.log("=== User Auth Flow Check ===")
  console.log(`Profiles: ${profiles?.length ?? 0}`)
  console.log(`Auth users: ${authUsers.length}`)
  console.log(`Healthy profile+auth links: ${ok}`)
  console.log(`Issues found: ${issues.length}`)

  if (!issues.length) {
    console.log("All users look login-ready.")
    return
  }

  console.log("")
  for (const issue of issues) {
    console.log(`[${issue.severity.toUpperCase()}] ${issue.code} | ${issue.email} | profile=${issue.profileId}`)
    console.log(`  ${issue.detail}`)
  }
  process.exitCode = 2
}

main().catch((err) => {
  console.error("Check failed:", err?.message || err)
  process.exit(1)
})
