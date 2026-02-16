#!/usr/bin/env node
/**
 * Create the superadmin user in self-hosted Supabase (Auth + profile with role admin).
 * Run from project root. Loads .env.local for Supabase URL and service role key.
 *
 * Usage:
 *   node scripts/create-superadmin.mjs
 *   # Uses default: superadmin@brihaspathi.com / Qazplm@4#2
 *
 * Or with custom email/password:
 *   SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=YourPass123 node scripts/create-superadmin.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DEFAULT_EMAIL = 'superadmin@brihaspathi.com'
const DEFAULT_PASSWORD = 'Qazplm@4#2'

// Load .env.local from project root
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) {
      const key = m[1].trim()
      const value = m[2].trim()
      if (!process.env[key]) process.env[key] = value
    }
  })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SUPERADMIN_EMAIL || DEFAULT_EMAIL
const password = process.env.SUPERADMIN_PASSWORD || DEFAULT_PASSWORD

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  console.log('Creating superadmin user:', email)

  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Super Admin' },
  })

  if (createError) {
    if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
      console.log('User already exists. Updating profile role to admin...')
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find((u) => u.email === email)
      if (existing) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin', name: 'Super Admin' })
          .eq('auth_user_id', existing.id)
        if (updateError) {
          console.error('Failed to update profile:', updateError.message)
          process.exit(1)
        }
        console.log('Profile updated to admin. You can log in at your app with:', email)
        return
      }
    }
    console.error('Create user error:', createError.message)
    process.exit(1)
  }

  // New user: trigger creates profile with role surveyor; set to admin
  if (user?.user?.id) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin', name: 'Super Admin' })
      .eq('auth_user_id', user.user.id)
    if (updateError) {
      console.warn('User created but profile update failed:', updateError.message)
      console.log('Go to Studio → Table Editor → profiles and set role to admin for this user.')
    } else {
      console.log('Superadmin created. Log in at your app with:', email)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
