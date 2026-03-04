'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as projectsData from './projects'
import * as usersData from './users'
import * as surveysData from './surveys'
import * as installationsData from './installations'
import * as inspectionsData from './inspections'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments } from './projects'
import type { User, CreateUserInput, UpdateUserInput } from './users'
import type { Survey, CreateSurveyInput, SurveyUploadKeys, FileMeta } from './surveys'
import type { Installation, CreateInstallationInput, Material, InstallationPhotoMeta } from './installations'
import type { Inspection, InspectionStatus } from './inspections'

// Projects
export function useProjects() {
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await projectsData.listProjects()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
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
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await usersData.listUsers()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
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
  const refetch = useCallback(async () => {
    if (!id) {
      setData(undefined)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const one = await usersData.getUserById(id)
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

// Surveys
export function useSurveys() {
  const [data, setData] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await surveysData.listSurveys()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    refetch()
  }, [refetch])
  return { data, loading, error, refetch }
}

const DEFAULT_PAGE_SIZE = 20

/** Lazy-load surveys: first page (e.g. 20) loads immediately; use loadMore() and setSearch() for rest. */
export function useSurveysLazy(options: { pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const [items, setItems] = useState<Survey[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearchState] = useState('')
  const [sectionFilter, setSectionFilterState] = useState('')
  const [subDivisionFilter, setSubDivisionFilterState] = useState('')
  const [statusFilter, setStatusFilterState] = useState('')
  const [feasibilityFilter, setFeasibilityFilterState] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const buildParams = useCallback(
    (offset: number, searchTerm: string, section: string, subDivision: string, status: string, feasibility: string) => ({
      limit: pageSize,
      offset,
      search: searchTerm || undefined,
      section: section || undefined,
      subDivision: subDivision || undefined,
      status: status || undefined,
      feasibility: feasibility || undefined,
    }),
    [pageSize]
  )

  const loadPage = useCallback(
    async (offset: number, searchTerm: string, section: string, subDivision: string, status: string, feasibility: string, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const { items: pageItems, total: totalCount } = await surveysData.listSurveysPaginated(
          buildParams(offset, searchTerm, section, subDivision, status, feasibility)
        )
        setTotal(totalCount)
        if (append) setItems((prev) => [...prev, ...pageItems])
        else setItems(pageItems)
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [buildParams]
  )

  const refetch = useCallback(() => {
    loadPage(0, search, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter, false)
  }, [loadPage, search, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter])

  const isFirstFilterRun = useRef(true)
  useEffect(() => {
    loadPage(0, '', '', '', '', '', false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false
      return
    }
    loadPage(0, search, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter, false)
  }, [sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter]) // eslint-disable-line react-hooks/exhaustive-deps -- refetch when filters change

  const loadMore = useCallback(() => {
    if (loading || loadingMore || items.length >= total) return
    loadPage(items.length, search, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter, true)
  }, [loading, loadingMore, items.length, total, search, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter, loadPage])

  const setSearch = useCallback((q: string) => {
    setSearchState(q)
    setLoading(true)
    setError(null)
    surveysData
      .listSurveysPaginated(
        buildParams(0, q, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter)
      )
      .then(({ items: pageItems, total: totalCount }) => {
        setItems(pageItems)
        setTotal(totalCount)
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [buildParams, sectionFilter, subDivisionFilter, statusFilter, feasibilityFilter])

  const setSectionFilter = useCallback((v: string) => {
    setSectionFilterState(v)
  }, [])

  const setSubDivisionFilter = useCallback((v: string) => {
    setSubDivisionFilterState(v)
  }, [])

  const setStatusFilter = useCallback((v: string) => {
    setStatusFilterState(v)
  }, [])

  const setFeasibilityFilter = useCallback((v: string) => {
    setFeasibilityFilterState(v)
  }, [])

  const hasMore = items.length < total

  return {
    data: items,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    setSearch,
    search,
    refetch,
    sectionFilter,
    subDivisionFilter,
    statusFilter,
    feasibilityFilter,
    setSectionFilter,
    setSubDivisionFilter,
    setStatusFilter,
    setFeasibilityFilter,
  }
}

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

// Installations
export function useInstallations() {
  const [data, setData] = useState<Installation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await installationsData.listInstallations()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
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

// Inspections
export function useInspections() {
  const [data, setData] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await inspectionsData.listInspections()
      setData(list)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
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
