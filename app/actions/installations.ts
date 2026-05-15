'use server'

import type { Installation } from '@/lib/store/installations'
import {
  updateInstallationWithServiceRoleFromFormData,
  createInstallationWithServiceRoleFromFormData,
} from '@/lib/supabase/installations-server'

/**
 * Update installation with new photo files. Uploads use service role (bypasses Storage RLS).
 * FormData: installationId, input (JSON), payload (JSON), file_<photoId> for each new file.
 */
export async function updateInstallationWithFormDataAction(formData: FormData): Promise<Installation> {
  return updateInstallationWithServiceRoleFromFormData(formData)
}

/**
 * Create installation with photo files. FormData: input, payload, file_<photoId>.
 */
export async function createInstallationWithFormDataAction(formData: FormData): Promise<Installation> {
  return createInstallationWithServiceRoleFromFormData(formData)
}
