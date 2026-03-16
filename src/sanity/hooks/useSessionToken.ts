import { useCallback, useEffect, useRef, useState } from 'react'
import { useCurrentUser, useWorkspace } from 'sanity'
import { projectId } from '@/sanity/config'

interface SessionState {
  token: string | null
  email: string | null
  expiresAt: number | null
  error: string | null
  isLoading: boolean
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000
const SANITY_TOKEN_STORAGE_KEY = `__studio_auth_token_${projectId}`

function getStoredSanityToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(SANITY_TOKEN_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    return typeof parsed?.token === 'string' ? parsed.token : null
  } catch {
    return null
  }
}

export function useSessionToken() {
  const currentUser = useCurrentUser()
  const workspace = useWorkspace()
  const [sanityToken, setSanityToken] = useState<string | null>(null)
  const [state, setState] = useState<SessionState>({
    token: null,
    email: null,
    expiresAt: null,
    error: null,
    isLoading: false,
  })

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const fetchToken = useCallback(async (token: string | null, fallbackEmail?: string | null) => {
    if (!isMountedRef.current) return

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }))

    try {
      const headers: HeadersInit = {}
      let body: string | undefined

      if (token) {
        headers.Authorization = `Bearer ${token}`
      } else if (fallbackEmail && process.env.NODE_ENV !== 'production') {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify({ email: fallbackEmail })
      } else {
        throw new Error('Sanity Studio token unavailable. Please refresh Studio and sign in again.')
      }

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers,
        body,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!isMountedRef.current) return

      setState({
        token: data.token,
        email: data.email,
        expiresAt: data.expiresAt,
        error: null,
        isLoading: false,
      })

      const refreshIn = data.expiresAt - Date.now() - REFRESH_BUFFER_MS
      if (refreshIn > 0) {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }

        refreshTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchToken(token, fallbackEmail || data.email)
          }
        }, refreshIn)
      }
    } catch (err) {
      if (!isMountedRef.current) return

      setState((prev) => ({
        ...prev,
        email: null,
        token: null,
        expiresAt: null,
        error: err instanceof Error ? err.message : 'Failed to get session token',
        isLoading: false,
      }))
    }
  }, [])

  useEffect(() => {
    const token$ = workspace.auth.token
    if (!token$) {
      setSanityToken(getStoredSanityToken())
      return
    }

    const subscription = token$.subscribe((token) => {
      if (!isMountedRef.current) return
      setSanityToken(token || getStoredSanityToken())
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [workspace])

  useEffect(() => {
    const email = currentUser?.email || null

    if (email && (sanityToken || process.env.NODE_ENV !== 'production')) {
      fetchToken(sanityToken, email)
      return
    }

    setState({
      token: null,
      email: null,
      expiresAt: null,
      error: email && process.env.NODE_ENV === 'production'
        ? 'Sanity Studio token unavailable. Please refresh Studio and sign in again.'
        : null,
      isLoading: false,
    })

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }
  }, [currentUser?.email, sanityToken, fetchToken])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const getAuthHeaders = useCallback((): HeadersInit => {
    if (!state.token || !state.expiresAt || Date.now() >= state.expiresAt) {
      return {}
    }

    return {
      Authorization: `Bearer ${state.token}`,
    }
  }, [state.token])

  const isAuthenticated = useCallback((): boolean => {
    if (!state.token || !state.expiresAt) return false
    return Date.now() < state.expiresAt
  }, [state.token, state.expiresAt])

  const verifiedEmail = isAuthenticated() ? state.email : null

  return {
    ...state,
    email: verifiedEmail,
    getAuthHeaders,
    isAuthenticated,
    refresh: () => {
      if (currentUser?.email) {
        fetchToken(sanityToken, currentUser.email)
      }
    },
  }
}
