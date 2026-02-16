'use server'

import type { CreateSurveyInput, FileMeta, Survey, SurveyUploadKeys } from '@/lib/store/surveys'
import {
  updateSurveyWithServiceRole,
  createSurveyWithServiceRole,
  getNextSurveyId,
  buildUploadsFromFormData,
} from '@/lib/supabase/surveys-server'

/**
 * Server action: create survey using service role (bypasses RLS).
 * FormData keys: input, siteDetails, submittedById, meta, file_<key>.
 */
export async function createSurveyWithFormDataAction(formData: FormData): Promise<Survey> {
  const inputJson = formData.get('input')
  const input = typeof inputJson === 'string' ? (JSON.parse(inputJson) as CreateSurveyInput) : undefined
  if (!input) throw new Error('Missing input')
  const siteDetailsJson = formData.get('siteDetails')
  const siteDetails =
    typeof siteDetailsJson === 'string' && siteDetailsJson
      ? (JSON.parse(siteDetailsJson) as Survey['siteDetails'])
      : undefined
  const submittedById = formData.get('submittedById')
  const submittedByIdStr = submittedById === null || submittedById === undefined ? undefined : String(submittedById)
  const id = await getNextSurveyId()
  formData.set('id', id)
  const uploadsWithUrls = await buildUploadsFromFormData(id, formData)
  return createSurveyWithServiceRole(id, input, uploadsWithUrls, siteDetails, submittedByIdStr || undefined)
}

/**
 * Server action: update survey using service role (bypasses RLS).
 * Call after client has uploaded files (ensureUploadUrls). Use when anon RLS blocks updates.
 */
export async function updateSurveyAction(
  id: string,
  input: CreateSurveyInput,
  uploadsWithUrls: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string
): Promise<Survey> {
  return updateSurveyWithServiceRole(id, input, uploadsWithUrls, siteDetails, submittedById)
}

/**
 * Server action: update survey from FormData. Uploads files with service role then updates survey.
 * Use this to avoid any anon RLS (table + storage). FormData keys: id, input, siteDetails, submittedById, meta, file_<key>.
 */
export async function updateSurveyWithFormDataAction(formData: FormData): Promise<Survey> {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) throw new Error('Missing survey id')
  const inputJson = formData.get('input')
  const input = typeof inputJson === 'string' ? (JSON.parse(inputJson) as CreateSurveyInput) : undefined
  if (!input) throw new Error('Missing input')
  const siteDetailsJson = formData.get('siteDetails')
  const siteDetails =
    typeof siteDetailsJson === 'string' && siteDetailsJson
      ? (JSON.parse(siteDetailsJson) as Survey['siteDetails'])
      : undefined
  const submittedById = formData.get('submittedById')
  const submittedByIdStr = submittedById === null || submittedById === undefined ? undefined : String(submittedById)
  const uploadsWithUrls = await buildUploadsFromFormData(id, formData)
  return updateSurveyWithServiceRole(id, input, uploadsWithUrls, siteDetails, submittedByIdStr || undefined)
}
