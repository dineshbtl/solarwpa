#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

const DEFAULT_PASSWORD = "Qazplm@4#2"
const DEFAULT_DOMAIN = "brihaspathi.com"

const ROLES = [
  "admin",
  "manager",
  "store_manager",
  "supervisor",
  "engineer",
  "installer",
  "surveyor",
  "government",
  "state_store_officer",
  "district_store_incharge",
  "village_supervisor",
]

function buildUsers(domain) {
  return ROLES.map((role) => ({
    role,
    email: `${role}@${domain}`,
    name: role
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
  }))
}

function readEnvFile(envPath) {
  if (!existsSync(envPath)) return {}
  const out = {}
  const raw = readFileSync(envPath, "utf8")
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

function envValue(name, fileEnv) {
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

async function findAuthByEmail(admin, email) {
  const users = await listAllAuthUsers(admin)
  return users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase())
}

async function ensureOneUser(admin, user, password) {
  const email = user.email.toLowerCase().trim()
  let authUser = await findAuthByEmail(admin, email)

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: user.name },
    })
    if (error || !data.user?.id) {
      throw new Error(`Failed creating auth user for ${email}: ${error?.message || "unknown error"}`)
    }
    authUser = data.user
    console.log(`Created auth user: ${email}`)
  } else {
    console.log(`Auth exists: ${email}`)
  }

  const { error: passErr } = await admin.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
  })
  if (passErr) {
    throw new Error(`Failed updating password for ${email}: ${passErr.message}`)
  }

  const { data: profileByEmail, error: profileLookupErr } = await admin
    .from("profiles")
    .select("id,auth_user_id")
    .eq("email", email)
    .maybeSingle()
  if (profileLookupErr) throw profileLookupErr

  if (profileByEmail?.id) {
    let { error: profileUpdateErr } = await admin
      .from("profiles")
      .update({
        role: user.role,
        name: user.name,
        auth_user_id: authUser.id,
        status: "active",
      })
      .eq("id", profileByEmail.id)
    if (profileUpdateErr && String(profileUpdateErr.message || "").toLowerCase().includes("invalid input value for enum app_role")) {
      const fallbackRole = "surveyor"
      console.warn(`Role '${user.role}' not supported in DB, fallback to '${fallbackRole}' for ${email}`)
      ;({ error: profileUpdateErr } = await admin
        .from("profiles")
        .update({
          role: fallbackRole,
          name: user.name,
          auth_user_id: authUser.id,
          status: "active",
        })
        .eq("id", profileByEmail.id))
    }
    if (profileUpdateErr) throw profileUpdateErr
    console.log(`Updated profile: ${email} -> ${user.role}`)
    return
  }

  const { data: lastIds, error: idErr } = await admin
    .from("profiles")
    .select("id")
    .like("id", "USR-%")
    .order("created_at", { ascending: false })
    .limit(200)
  if (idErr) throw idErr
  const nextNum = Math.max(
    0,
    ...(lastIds || [])
      .map((r) => Number(String(r.id || "").replace(/^USR-/, "")))
      .filter((n) => Number.isFinite(n))
  ) + 1
  const profileId = `USR-${String(nextNum).padStart(3, "0")}`

  let { error: insertErr } = await admin.from("profiles").insert({
    id: profileId,
    auth_user_id: authUser.id,
    name: user.name,
    email,
    role: user.role,
    status: "active",
  })
  if (insertErr && String(insertErr.message || "").toLowerCase().includes("invalid input value for enum app_role")) {
    const fallbackRole = "surveyor"
    console.warn(`Role '${user.role}' not supported in DB, fallback to '${fallbackRole}' for ${email}`)
    ;({ error: insertErr } = await admin.from("profiles").insert({
      id: profileId,
      auth_user_id: authUser.id,
      name: user.name,
      email,
      role: fallbackRole,
      status: "active",
    }))
  }
  if (insertErr) throw insertErr
  console.log(`Created profile: ${email} -> ${user.role}`)
}

async function isRoleSupported(admin, role) {
  const { error } = await admin.from("profiles").update({ role }).eq("id", "__role_probe_noop__")
  if (!error) return true
  return !String(error.message || "").toLowerCase().includes("invalid input value for enum app_role")
}

async function main() {
  const fileEnv = readEnvFile(resolve(process.cwd(), ".env.local"))
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL", fileEnv)
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY", fileEnv)
  const password = envValue("SEED_PASSWORD", fileEnv) || DEFAULT_PASSWORD
  const domain = envValue("SEED_DOMAIN", fileEnv) || DEFAULT_DOMAIN

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const users = buildUsers(domain)
  console.log(`Ensuring ${users.length} role users with password: ${password}`)
  const supportedRoles = []
  const unsupportedRoles = []
  for (const role of ROLES) {
    // eslint-disable-next-line no-await-in-loop
    if (await isRoleSupported(admin, role)) supportedRoles.push(role)
    else unsupportedRoles.push(role)
  }
  if (unsupportedRoles.length > 0) {
    console.warn(`Unsupported app roles in DB enum: ${unsupportedRoles.join(", ")}`)
    console.warn("Using fallback role 'surveyor' for those users until DB migration is applied.")
  }
  for (const user of users) {
    const safeRole = supportedRoles.includes(user.role) ? user.role : "surveyor"
    // eslint-disable-next-line no-await-in-loop
    await ensureOneUser(admin, { ...user, role: safeRole }, password)
  }
  console.log("Done.")
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
