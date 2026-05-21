'use client'

import { toast } from '@/hooks/use-toast'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { waitForSessionReady } from '@/lib/supabase/auth'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as projectsData from './projects'
import * as usersData from './users'
import * as surveysData from './surveys'
import * as installationsData from './installations'
import * as inspectionsData from './inspections'
import * as dashboardData from './dashboard'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments } from './projects'
import type { User, CreateUserInput, UpdateUserInput } from './users'
import type { Survey, CreateSurveyInput, SurveyUploadKeys, FileMeta } from './surveys'
import type { Installation, CreateInstallationInput, Material, InstallationPhotoMeta, InstallationListItem } from './installations'
import type { Inspection, InspectionStatus, InspectionListItem } from './inspections'
import type { DashboardData } from './dashboard'

// Dashboard (lightweight: counts + limited items in a single parallel fetch)
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isInitialLoadRef = useRef(true)
  const refetch = useCallback(async () => {
    setLoading(isInitialLoadRef.current)
    setError(null)
    try {
      await ensureSessionReady()
      const result = await dashboardData.fetchDashboardData()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      isInitialLoadRef.current = false
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

// Projects
export function useProjects() {
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isInitialLoadRef = useRef(true)
  const refetch = useCallback(async () => {
    setLoading(isInitialLoadRef.current)
    setError(null)
    try {
      await ensureSessionReady()
      const list = await projectsData.listProjects()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      isInitialLoadRef.current = false
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

export function useProject(id: string | null) {
  const [data, setData] = useState<Project | undefined>(undefined)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    if (!id) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureSessionReady()
      const one = await projectsData.getProjectById(id)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

// Users
export function useUsers() {
  const [data, setData] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isInitialLoadRef = useRef(true)
  const refetch = useCallback(async () => {
    setLoading(isInitialLoadRef.current)
    setError(null)
    try {
      if (isSupabaseConfigured() && typeof window !== 'undefined') {
        await waitForSessionReady()
      }
      const list = await usersData.listUsers()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      isInitialLoadRef.current = false
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

export function useUser(id: string | null) {
  const [data, setData] = useState<User | undefined>(undefined)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)
  const prevIdRef = useRef<string | null | undefined>(undefined)
  const refetch = useCallback(async () => {
    if (!id) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (isSupabaseConfigured() && typeof window !== 'undefined') {
        await waitForSessionReady()
      }
      const one = await usersData.getUserById(id)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [id])

  // Before paint: when navigating between profiles, clear stale row so we never render user A's role while URL is user B.
  useLayoutEffect(() => {
    if (prevIdRef.current === id) return
    prevIdRef.current = id ?? null
    if (!id) {
      setData(undefined)
      setLoading(false)
      setError(null)
      return
    }
    setData(undefined)
    setLoading(true)
    setError(null)
  }, [id])

  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

// Surveys
export function useSurveys() {
  const [data, setData] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isInitialLoadRef = useRef(true)
  const refetch = useCallback(async () => {
    setLoading(isInitialLoadRef.current)
    setError(null)
    try {
      await ensureSessionReady()
      const list = await surveysData.listSurveys()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      isInitialLoadRef.current = false
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

const DEFAULT_PAGE_SIZE = 20

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === 'AbortError'
  if (error instanceof Error) {
    return error.name === 'AbortError' || /aborted without reason/i.test(error.message)
  }
  return false
}

async function ensureSessionReady() {
  if (isSupabaseConfigured() && typeof window !== 'undefined') {
    await waitForSessionReady()
  }
}

export function useSurveysPaginated(
  options: { pageSize?: number; listSource?: 'surveys' | 'assignment' } = {},
) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const listSource = options.listSource ?? 'surveys'
  const [items, setItems] = useState<Survey[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(1)
  const [search, setSearchState] = useState('')
  const [sectionFilter, setSectionFilterState] = useState('')
  const [subDivisionFilter, setSubDivisionFilterState] = useState('')
  const [statusFilter, setStatusFilterState] = useState('')
  const [feasibilityFilter, setFeasibilityFilterState] = useState('')
  /** '' = all; '__unassigned__' = no installer; else installer profile id */
  const [installerFilter, setInstallerFilterState] = useState('')
  /** Assignment list: filter by latest installation_status on view (or sentinel for none). */
  const [installationStatusFilter, setInstallationStatusFilterState] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const buildParams = useCallback(
    (
      offset: number,
      searchTerm: string,
      section: string,
      subDivision: string,
      status: string,
      feasibility: string,
      installer: string,
      installationStatus: string,
    ) => ({
      limit: pageSize,
      offset,
      search: searchTerm || undefined,
      section: section || undefined,
      subDivision: subDivision || undefined,
      status: status || undefined,
      feasibility: feasibility || undefined,
      installerFilter: installer || undefined,
      listSource,
      installationStatus:
        listSource === 'assignment' && installationStatus.trim() ? installationStatus.trim() : undefined,
    }),
    [pageSize, listSource],
  )

  /** Phase B UX (optional): persist last page in sessionStorage or TanStack Query keepPreviousData to avoid empty-state skeleton on route remount. */
  const loadPage = useCallback(
    async (
      offset: number,
      searchTerm: string,
      section: string,
      subDivision: string,
      status: string,
      feasibility: string,
      installer: string,
      installationStatus: string,
    ) => {
      setLoading(true)
      setError(null)
      
      const params = buildParams(offset, searchTerm, section, subDivision, status, feasibility, installer, installationStatus)

      // 1. Stale-While-Revalidate: Instantly load from local offline database
      surveysData.listSurveysLocallyPaginated(params).then((local) => {
        if (local && local.items.length > 0) {
          setTotal(local.total)
          setItems(local.items)
          setLoading(false) // Data immediately visible to user
        }
      }).catch(() => {})

      // 2. Fetch fresh data from network in background
      try {
        await ensureSessionReady()
        const { items: pageItems, total: totalCount } = await surveysData.listSurveysPaginated(params)
        setTotal(totalCount)
        setItems(pageItems)
      } catch (e) {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setLoading(false)
      }
    },
    [buildParams],
  )

  const refetch = useCallback(() => {
    loadPage(
      (page - 1) * pageSize,
      search,
      sectionFilter,
      subDivisionFilter,
      statusFilter,
      feasibilityFilter,
      installerFilter,
      installationStatusFilter,
    )
  }, [
    loadPage,
    page,
    pageSize,
    search,
    sectionFilter,
    subDivisionFilter,
    statusFilter,
    feasibilityFilter,
    installerFilter,
    installationStatusFilter,
  ])

  const fetchFirstPage = useCallback(
    (
      searchTerm: string,
      section: string,
      subDivision: string,
      status: string,
      feasibility: string,
      installer: string,
      installationStatus: string,
    ) => {
      setPageState(1)
      loadPage(0, searchTerm, section, subDivision, status, feasibility, installer, installationStatus)
    },
    [loadPage],
  )

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage)
  }, [])

  useEffect(() => {
    loadPage(0, '', '', '', '', '', '', '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  // Background prefetch to fully populate IndexedDB for offline access when online!
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      surveysData.listSurveys().catch(() => {});
    }
  }, [])

  useEffect(() => {
    loadPage(
      (page - 1) * pageSize,
      search,
      sectionFilter,
      subDivisionFilter,
      statusFilter,
      feasibilityFilter,
      installerFilter,
      installationStatusFilter,
    )
  }, [page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps -- search/filters use fetchFirstPage to avoid duplicate fetches

  const setSearch = useCallback(
    (q: string) => {
      setSearchState(q)
      fetchFirstPage(
        q,
        sectionFilter,
        subDivisionFilter,
        statusFilter,
        feasibilityFilter,
        installerFilter,
        installationStatusFilter,
      )
    },
    [
      fetchFirstPage,
      sectionFilter,
      subDivisionFilter,
      statusFilter,
      feasibilityFilter,
      installerFilter,
      installationStatusFilter,
    ],
  )

  const setSectionFilter = useCallback(
    (v: string) => {
      setSectionFilterState(v)
      fetchFirstPage(
        search,
        v,
        subDivisionFilter,
        statusFilter,
        feasibilityFilter,
        installerFilter,
        installationStatusFilter,
      )
    },
    [
      fetchFirstPage,
      search,
      subDivisionFilter,
      statusFilter,
      feasibilityFilter,
      installerFilter,
      installationStatusFilter,
    ],
  )

  const setSubDivisionFilter = useCallback(
    (v: string) => {
      setSubDivisionFilterState(v)
      fetchFirstPage(
        search,
        sectionFilter,
        v,
        statusFilter,
        feasibilityFilter,
        installerFilter,
        installationStatusFilter,
      )
    },
    [
      fetchFirstPage,
      search,
      sectionFilter,
      statusFilter,
      feasibilityFilter,
      installerFilter,
      installationStatusFilter,
    ],
  )

  const setStatusFilter = useCallback(
    (v: string) => {
      setStatusFilterState(v)
      fetchFirstPage(
        search,
        sectionFilter,
        subDivisionFilter,
        v,
        feasibilityFilter,
        installerFilter,
        installationStatusFilter,
      )
    },
    [
      fetchFirstPage,
      search,
      sectionFilter,
      subDivisionFilter,
      feasibilityFilter,
      installerFilter,
      installationStatusFilter,
    ],
  )

  const setFeasibilityFilter = useCallback(
    (v: string) => {
      setFeasibilityFilterState(v)
      fetchFirstPage(
        search,
        sectionFilter,
        subDivisionFilter,
        statusFilter,
        v,
        installerFilter,
        installationStatusFilter,
      )
    },
    [
      fetchFirstPage,
      search,
      sectionFilter,
      subDivisionFilter,
      statusFilter,
      installerFilter,
      installationStatusFilter,
    ],
  )

  const setInstallerFilter = useCallback(
    (v: string) => {
      setInstallerFilterState(v)
      fetchFirstPage(
        search,
        sectionFilter,
        subDivisionFilter,
        statusFilter,
        feasibilityFilter,
        v,
        installationStatusFilter,
      )
    },
    [
      fetchFirstPage,
      search,
      sectionFilter,
      subDivisionFilter,
      statusFilter,
      feasibilityFilter,
      installationStatusFilter,
    ],
  )

  const setInstallationStatusFilter = useCallback(
    (v: string) => {
      setInstallationStatusFilterState(v)
      fetchFirstPage(search, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter, installerFilter, v)
    },
    [
      fetchFirstPage,
      search,
      sectionFilter,
      subDivisionFilter,
      statusFilter,
      feasibilityFilter,
      installerFilter,
    ],
  )

  return {
    data: items,
    total,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setSearch,
    search,
    refetch,
    sectionFilter,
    subDivisionFilter,
    statusFilter,
    feasibilityFilter,
    installerFilter,
    installationStatusFilter,
    setInstallerFilter,
    setInstallationStatusFilter,
    setSectionFilter,
    setSubDivisionFilter,
    setStatusFilter,
    setFeasibilityFilter,
  }
}

/** Back-compat alias: surveys list now uses real pagination. */
export const useSurveysLazy = useSurveysPaginated

export function useSurvey(id: string | null) {
  const [data, setData] = useState<Survey | undefined>(undefined)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    if (!id) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureSessionReady()
      const one = await surveysData.getSurveyById(id)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

// Paginated installations (server-side search + filter + pagination)
export function useInstallationsPaginated(options: { pageSize?: number } = {}) {
  const initialPageSize = options.pageSize ?? 10
  const [items, setItems] = useState<InstallationListItem[]>([])
  const [total, setTotal] = useState(0)
  const [kpi, setKpi] = useState<installationsData.InstallationsKpi>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    inspectionPending: 0,
    surveyAssignment: undefined,
  })
  const [kpiLoading, setKpiLoading] = useState(true)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [search, setSearchState] = useState('')
  const [statusFilter, setStatusFilterState] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingExactTotal, setLoadingExactTotal] = useState(false)
  const exactTotalReqIdRef = useRef(0)
  const installationsFetchSeqRef = useRef(0)
  const [error, setError] = useState<Error | null>(null)
  const initialPageRequestedRef = useRef(false)

  const emptyInstallationsKpi = useMemo(
    (): installationsData.InstallationsKpi => ({
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      inspectionPending: 0,
      surveyAssignment: undefined,
    }),
    [],
  )

  const fetchPage = useCallback(
    async (pg: number, ps: number, q: string, status: string) => {
      const seq = ++installationsFetchSeqRef.current
      setLoading(true)
      setError(null)
      setKpiLoading(true)
      const includeKpi = (pg - 1) * ps === 0 && !q && !status
      if (includeKpi) {
        setKpi(emptyInstallationsKpi)
      }
      try {
        const { items: rows, total: totalCount, totalIsEstimate, kpi: bundledKpi } =
          await installationsData.listInstallationsPaginated({
            limit: ps,
            offset: (pg - 1) * ps,
            search: q || undefined,
            status: status || undefined,
            includeKpi,
          })
        if (seq !== installationsFetchSeqRef.current) return
        setItems(rows)
        if (includeKpi) {
          setKpi(bundledKpi ?? emptyInstallationsKpi)
        }
        setTotal(totalCount)
        if (totalIsEstimate) {
          const reqId = ++exactTotalReqIdRef.current
          setLoadingExactTotal(true)
          installationsData
            .getInstallationsExactTotal({
              search: q || undefined,
              status: status || undefined,
            })
            .then((exactTotal) => {
              if (seq !== installationsFetchSeqRef.current) return
              if (exactTotalReqIdRef.current !== reqId) return
              setTotal(exactTotal)
            })
            .finally(() => {
              if (seq !== installationsFetchSeqRef.current) return
              if (exactTotalReqIdRef.current === reqId) setLoadingExactTotal(false)
            })
        } else {
          setLoadingExactTotal(false)
        }
      } catch (e) {
        if (seq !== installationsFetchSeqRef.current) return
        const err = e instanceof Error ? e : new Error(String(e))
        toast({
          title: 'Could not load installations',
          description: err.message,
          variant: 'destructive',
        })
        setItems([])
        setTotal(0)
        setKpi(emptyInstallationsKpi)
        setError(null)
      } finally {
        if (seq === installationsFetchSeqRef.current) {
          setLoading(false)
          setKpiLoading(false)
        }
      }
    },
    [emptyInstallationsKpi],
  )

  useEffect(() => {
    if (initialPageRequestedRef.current) return
    initialPageRequestedRef.current = true
    fetchPage(1, initialPageSize, '', '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Background prefetch to fully populate IndexedDB for offline access when online!
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      installationsData.listInstallations().catch(() => {});
    }
  }, [])

  const setPage = useCallback(
    (pg: number) => {
      setPageState(pg)
      fetchPage(pg, pageSize, search, statusFilter)
    },
    [fetchPage, pageSize, search, statusFilter]
  )

  const setPageSize = useCallback(
    (ps: number) => {
      setPageSizeState(ps)
      setPageState(1)
      fetchPage(1, ps, search, statusFilter)
    },
    [fetchPage, search, statusFilter]
  )

  const setSearch = useCallback(
    (q: string) => {
      setSearchState(q)
      setPageState(1)
      fetchPage(1, pageSize, q, statusFilter)
    },
    [fetchPage, pageSize, statusFilter]
  )

  const setStatusFilter = useCallback(
    (s: string) => {
      setStatusFilterState(s)
      setPageState(1)
      fetchPage(1, pageSize, search, s)
    },
    [fetchPage, pageSize, search]
  )

  const refetch = useCallback(() => {
    fetchPage(page, pageSize, search, statusFilter)
  }, [fetchPage, page, pageSize, search, statusFilter])

  return {
    data: items,
    total,
    loading,
    error,
    kpi,
    kpiLoading,
    loadingExactTotal,
    page,
    pageSize,
    search,
    statusFilter,
    setPage,
    setPageSize,
    setSearch,
    setStatusFilter,
    refetch,
  }
}

// Paginated inspections (server-side search + filter + pagination)
export function useInspectionsPaginated(options: { pageSize?: number } = {}) {
  const initialPageSize = options.pageSize ?? 10
  const [items, setItems] = useState<InspectionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [search, setSearchState] = useState('')
  const [statusFilter, setStatusFilterState] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPage = useCallback(
    async (pg: number, ps: number, q: string, status: string) => {
      setLoading(true)
      setError(null)
      try {
        await ensureSessionReady()
        const { items: rows, total: totalCount } = await inspectionsData.listInspectionsPaginated({
          limit: ps,
          offset: (pg - 1) * ps,
          search: q || undefined,
          status: status || undefined,
        })
        setItems(rows)
        setTotal(totalCount)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPage(1, initialPageSize, '', '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setPage = useCallback(
    (pg: number) => {
      setPageState(pg)
      fetchPage(pg, pageSize, search, statusFilter)
    },
    [fetchPage, pageSize, search, statusFilter]
  )

  const setPageSize = useCallback(
    (ps: number) => {
      setPageSizeState(ps)
      setPageState(1)
      fetchPage(1, ps, search, statusFilter)
    },
    [fetchPage, search, statusFilter]
  )

  const setSearch = useCallback(
    (q: string) => {
      setSearchState(q)
      setPageState(1)
      fetchPage(1, pageSize, q, statusFilter)
    },
    [fetchPage, pageSize, statusFilter]
  )

  const setStatusFilter = useCallback(
    (s: string) => {
      setStatusFilterState(s)
      setPageState(1)
      fetchPage(1, pageSize, search, s)
    },
    [fetchPage, pageSize, search]
  )

  const refetch = useCallback(() => {
    fetchPage(page, pageSize, search, statusFilter)
  }, [fetchPage, page, pageSize, search, statusFilter])

  return {
    data: items,
    total,
    loading,
    error,
    page,
    pageSize,
    search,
    statusFilter,
    setPage,
    setPageSize,
    setSearch,
    setStatusFilter,
    refetch,
  }
}

// Installations
export function useInstallations() {
  const [data, setData] = useState<Installation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isInitialLoadRef = useRef(true)
  const refetch = useCallback(async () => {
    setLoading(isInitialLoadRef.current)
    setError(null)
    try {
      await ensureSessionReady()
      const list = await installationsData.listInstallations()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      isInitialLoadRef.current = false
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

export function useInstallation(id: string | null) {
  const [data, setData] = useState<Installation | undefined>(undefined)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    if (!id) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureSessionReady()
      const one = await installationsData.getInstallationById(id)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

export function useInstallationBySurveyId(surveyId: string | null) {
  const [data, setData] = useState<Installation | undefined>(undefined)
  const [loading, setLoading] = useState(!!surveyId)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    if (!surveyId) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureSessionReady()
      const one = await installationsData.getInstallationBySurveyId(surveyId)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [surveyId])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

// Inspections
export function useInspections() {
  const [data, setData] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isInitialLoadRef = useRef(true)
  const refetch = useCallback(async () => {
    setLoading(isInitialLoadRef.current)
    setError(null)
    try {
      await ensureSessionReady()
      const list = await inspectionsData.listInspections()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      isInitialLoadRef.current = false
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

export function useInspection(id: string | null) {
  const [data, setData] = useState<Inspection | undefined>(undefined)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    if (!id) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureSessionReady()
      const one = await inspectionsData.getInspectionById(id)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

export function useInspectionByInstallationId(installationId: string | null) {
  const [data, setData] = useState<Inspection | undefined>(undefined)
  const [loading, setLoading] = useState(!!installationId)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    if (!installationId) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await ensureSessionReady()
      const one = await inspectionsData.getInspectionByInstallationId(installationId)
      setData(one)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [installationId])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}
