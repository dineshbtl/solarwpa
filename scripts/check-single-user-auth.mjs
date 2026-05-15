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

function parseArgs(argv) {
  const out = { email: "", password: "" }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--email") out.email = argv[i + 1] || ""
    if (arg === "--password") out.password = argv[i + 1] || ""
  }
  return out
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

function printUsage() {
  console.log("Usage:")
  console.log("  node scripts/check-single-user-auth.mjs --email user@example.com [--password yourPassword]")
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = args.email.trim().toLowerCase()
  const password = args.password
  if (!email) {
    printUsage()
    process.exit(1)
  }

  const root = process.cwd()
  const fileEnv = readEnvFile(path.join(root, ".env.local"))
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL", fileEnv)
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", fileEnv)
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", fileEnv)

  if (!url || !anonKey || !serviceKey) {
    console.error("Missing env values. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id,email,name,auth_user_id,status,role")
    .eq("email", email)
    .maybeSingle()
  if (profileErr) throw profileErr

  const authUsers = await listAllAuthUsers(admin)
  const authByEmail = authUsers.find((u) => String(u.email || "").toLowerCase() === email)
  const authById = profile?.auth_user_id ? authUsers.find((u) => u.id === profile.auth_user_id) : null

  console.log("=== Single User Auth Check ===")
  console.log(`Email: ${email}`)
  console.log(`Profile exists: ${profile ? "yes" : "no"}`)
  if (profile) {
    console.log(`  profile.id: ${profile.id}`)
    console.log(`  profile.auth_user_id: ${profile.auth_user_id || "(null)"}`)
    console.log(`  profile.status: ${profile.status}`)
    console.log(`  profile.role: ${profile.role}`)
  }

  console.log(`Auth user by email exists: ${authByEmail ? "yes" : "no"}`)
  if (authByEmail) {
    console.log(`  auth.id: ${authByEmail.id}`)
    console.log(`  email_confirmed_at: ${authByEmail.email_confirmed_at || "(null)"}`)
    console.log(`  banned_until: ${authByEmail.banned_until || "(null)"}`)
  }
  console.log(`Auth user by profile.auth_user_id exists: ${authById ? "yes" : "no"}`)
  if (profile?.auth_user_id && authByEmail && profile.auth_user_id !== authByEmail.id) {
    console.log(`Link mismatch: profile.auth_user_id=${profile.auth_user_id}, authByEmail.id=${authByEmail.id}`)
  }

  if (password) {
    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    if (error) {
      console.log("Password login test: FAILED")
      console.log(`  code: ${error.code || "(none)"}`)
      console.log(`  message: ${error.message}`)
    } else {
      console.log("Password login test: SUCCESS")
      console.log(`  signed-in user id: ${data.user?.id || "(none)"}`)
      await anon.auth.signOut()
    }
  } else {
    console.log("Password login test: skipped (pass --password to test)")
  }
}

main().catch((err) => {
  console.error("Check failed:", err?.message || err)
  process.exit(1)
})
