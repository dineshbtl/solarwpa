/**
 * Unified data layer: Supabase when configured, else localStorage store.
 */
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as store from '@/lib/store/installations'
import * as supabase from '@/lib/supabase/installations'
import type {
  Installation,
  CreateInstallationInput,
  Material,
  InstallationPhotoMeta,
} from '@/lib/store/installations'

export type { Installation, CreateInstallationInput, Material, InstallationPhotoMeta }

export async function listInstallations(): Promise<Installation[]> {
  if (isSupabaseConfigured()) return supabase.listInstallationsFromSupabase()
  return Promise.resolve(store.listInstallations())
}

export async function getInstallationById(id: string): Promise<Installation | undefined> {
  if (isSupabaseConfigured()) return supabase.getInstallationByIdFromSupabase(id)
  return Promise.resolve(store.getInstallationById(id))
}

export async function createInstallation(
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] }
): Promise<Installation> {
  if (isSupabaseConfigured()) return supabase.createInstallationInSupabase(input, payload)
  return Promise.resolve(store.createInstallation(input, payload))
}

export async function updateInstallation(
  id: string,
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] }
): Promise<Installation> {
  if (isSupabaseConfigured()) return supabase.updateInstallationInSupabase(id, input, payload)
  return Promise.resolve(store.updateInstallation(id, input, payload))
}

export async function updateInstallationStatus(id: string, status: Installation['status']): Promise<Installation> {
  if (isSupabaseConfigured()) return supabase.updateInstallationStatusInSupabase(id, status)
  return Promise.resolve(store.updateInstallationStatus(id, status))
}
