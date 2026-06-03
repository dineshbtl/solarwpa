import { offlineDB } from './offline-db'
import { buildAuthHeaders } from './auth-headers'
import { fetchWithTimeout } from './fetch-with-timeout'
import { SURVEY_UPLOAD_KEYS_ORDER } from '@/lib/store/surveys'

let isSyncing = false

export async function processSyncQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine || isSyncing) return
  isSyncing = true
  console.log('[Sync Manager] Processing pending offline mutations...')

  try {
    while (true) {
      const queue = await offlineDB.getPendingMutations()
      if (queue.length === 0) {
        break
      }

      let hasFailure = false
      for (const item of queue) {
        console.log(`[Sync Manager] Processing item ID ${item.id}: ${item.storeName} - ${item.action}`)
        let success = false

        try {
          if (item.storeName === 'surveys') {
            success = await syncSurveyMutation(item)
          } else if (item.storeName === 'installations') {
            success = await syncInstallationMutation(item)
          } else if (item.storeName === 'inspections') {
            success = await syncInspectionMutation(item)
          }

          if (success) {
            await offlineDB.removeMutation(item.id)
            console.log(`[Sync Manager] Successfully processed and removed queue item ${item.id}`)
          } else {
            console.warn(`[Sync Manager] Failed to process queue item ${item.id}, halting queue to preserve sequence.`)
            hasFailure = true
            break; // Stop execution to maintain sequence integrity
          }
        } catch (err) {
          console.error(`[Sync Manager] Fatal error on queue item ${item.id}:`, err)
          hasFailure = true
          break; // Stop execution
        }
      }

      if (hasFailure) {
        break
      }
    }
  } finally {
    isSyncing = false
    offlineDB.notify() // Update indicators
  }
}

async function syncSurveyMutation(item: any): Promise<boolean> {
  const { action, entityId, payload } = item
  const authHeaders = await buildAuthHeaders(true)

  if (action === 'CREATE' || action === 'UPDATE') {
    const formData = new FormData()
    formData.set('id', entityId)
    formData.set('input', JSON.stringify(payload.input))
    formData.set('siteDetails', JSON.stringify(payload.siteDetails ?? {}))
    formData.set('meta', JSON.stringify(payload.uploads ?? {}))
    if (payload.submittedById) {
      formData.set('submittedById', payload.submittedById)
    }

    // Retrieve offline binary attachments from IndexedDB
    for (const key of SURVEY_UPLOAD_KEYS_ORDER) {
      const cachedFile = await offlineDB.getOfflineFile(`${entityId}_${key}`)
      if (cachedFile) {
        formData.set(`file_${key}`, cachedFile.file, cachedFile.name)
      }
    }

    const url = action === 'CREATE' ? '/api/surveys/create' : '/api/surveys/update'
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    }, 60000)

    if (res.ok) {
      const json = await res.json()
      if (json.survey) {
        await offlineDB.putOne('surveys', { ...json.survey, _syncStatus: 'synced' })
        // Clear cached files
        for (const key of SURVEY_UPLOAD_KEYS_ORDER) {
          await offlineDB.removeOfflineFile(`${entityId}_${key}`)
        }
        return true
      }
    }
    return false
  }

  if (action === 'STATUS') {
    const res = await fetchWithTimeout('/api/surveys/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ surveyId: entityId, status: payload.status }),
    }, 15000)

    if (res.ok) {
      const json = await res.json()
      if (json.survey) {
        await offlineDB.putOne('surveys', { ...json.survey, _syncStatus: 'synced' })
        return true
      }
    }
    return false
  }

  if (action === 'INSTALLER') {
    const res = await fetchWithTimeout('/api/surveys/installer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ surveyId: entityId, installerId: payload.installerId }),
    }, 15000)

    if (res.ok) {
      const json = await res.json()
      if (json.survey) {
        await offlineDB.putOne('surveys', { ...json.survey, _syncStatus: 'synced' })
        return true
      }
    }
    return false
  }

  if (action === 'DELETE') {
    // Delete directly using Supabase client on client side
    const supabaseModule = await import('@/lib/supabase/surveys')
    try {
      await supabaseModule.deleteSurveyFromSupabase(entityId)
      return true
    } catch {
      return false
    }
  }

  return false
}

async function syncInstallationMutation(item: any): Promise<boolean> {
  const { action, entityId, payload } = item
  const authHeaders = await buildAuthHeaders(true)

  if (action === 'CREATE' || action === 'UPDATE') {
    const formData = new FormData()
    if (action === 'UPDATE') {
      formData.set('installationId', entityId)
    }
    formData.set('input', JSON.stringify(payload.input))
    formData.set('payload', JSON.stringify(payload.payload))

    // Retrieve photos files from offline_files
    if (payload.payload?.photos) {
      for (const photo of payload.payload.photos) {
        const fileKey = `${entityId}_photo_${photo.id}`
        const cachedFile = await offlineDB.getOfflineFile(fileKey)
        if (cachedFile) {
          formData.set(`file_${photo.id}`, cachedFile.file, cachedFile.name)
        }
      }
    }

    // Retrieve material photos
    if (payload.payload?.materials) {
      for (const mat of payload.payload.materials) {
        const fileKey = `${entityId}_mat_${mat.id}`
        const cachedFile = await offlineDB.getOfflineFile(fileKey)
        if (cachedFile) {
          formData.set(`file_mat_${mat.id}_photo`, cachedFile.file, cachedFile.name)
        }
      }
    }

    // Retrieve signature
    const sigKey = `${entityId}_signature`
    const cachedSig = await offlineDB.getOfflineFile(sigKey)
    if (cachedSig) {
      formData.set('file_signature', cachedSig.file, cachedSig.name)
    }

    const url = action === 'CREATE' ? '/api/installations/create' : '/api/installations/update'
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    }, 60000)

    if (res.ok) {
      const json = await res.json()
      if (json.installation) {
        await offlineDB.putOne('installations', { ...json.installation, _syncStatus: 'synced' })
        // Clear cached files
        if (payload.payload?.photos) {
          for (const photo of payload.payload.photos) {
            await offlineDB.removeOfflineFile(`${entityId}_photo_${photo.id}`)
          }
        }
        if (payload.payload?.materials) {
          for (const mat of payload.payload.materials) {
            await offlineDB.removeOfflineFile(`${entityId}_mat_${mat.id}`)
          }
        }
        await offlineDB.removeOfflineFile(sigKey)
        return true
      }
    }
    return false
  }

  if (action === 'STATUS') {
    const supabaseModule = await import('@/lib/supabase/installations')
    try {
      const updated = await supabaseModule.updateInstallationStatusInSupabase(entityId, payload.status)
      if (updated) {
        await offlineDB.putOne('installations', { ...updated, _syncStatus: 'synced' })
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

async function syncInspectionMutation(item: any): Promise<boolean> {
  const { action, entityId, payload } = item
  const supabaseModule = await import('@/lib/supabase/inspections')

  try {
    let updated: any = null
    if (action === 'CREATE') {
      updated = await supabaseModule.createInspectionInSupabase(payload.input)
    } else if (action === 'STATUS') {
      updated = await supabaseModule.updateInspectionStatusInSupabase(entityId, payload.status)
    } else if (action === 'INSPECTOR') {
      updated = await supabaseModule.assignInspectionInspectorInSupabase(entityId, payload.inspectorId)
    } else if (action === 'DETAILS') {
      updated = await supabaseModule.updateInspectionDetailsInSupabase(entityId, payload.patch)
    } else if (action === 'APPROVAL') {
      updated = await supabaseModule.setManagerApprovalInSupabase(entityId, payload.approved, payload.remarks, payload.approvedBy)
    } else if (action === 'GOVERNMENT') {
      updated = await supabaseModule.setGovernmentInspectionInSupabase(entityId, payload.approved, payload.remarks, payload.inspectorName)
    }

    if (updated) {
      await offlineDB.putOne('inspections', { ...updated, _syncStatus: 'synced' })
      return true
    }
  } catch (err) {
    console.error('[Sync Manager] Inspection sync failed:', err)
  }

  return false
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void processSyncQueue()
    import('./warmup').then(({ warmupOfflineData }) => {
      void warmupOfflineData()
    }).catch(() => {})
  })
}
