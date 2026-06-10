import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SafeUser } from '@/lib/api'

export type AuthMode = 'none' | 'token' | 'oidc' | 'internal'

interface AuthState {
  token: string | null
  authenticated: boolean
  authMode: AuthMode
  user: string | null
  groups: string[]
  currentUser: SafeUser | null
  mustChangePw: boolean

  loginWithToken: (token: string, user?: string, groups?: string[]) => void
  loginInternal: (token: string, user: SafeUser, mustChangePw?: boolean) => void
  logout: () => void
  setAuthMode: (mode: AuthMode) => void
  setAuthenticated: (v: boolean) => void
  updateCurrentUser: (user: SafeUser) => void
}

/** Decode a JWT and return true if it is expired (or malformed) */
function isJwtExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    // exp is in seconds; Date.now() is in ms
    return !payload.exp || Date.now() / 1000 > payload.exp
  } catch {
    return true // malformed token → treat as expired
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      groups: [],
      authenticated: false,
      authMode: 'internal',
      currentUser: null,
      mustChangePw: false,

      loginWithToken: (token, user, groups = []) =>
        set({ token, user: user ?? null, groups, authenticated: true, currentUser: null }),

      loginInternal: (token, user, mustChangePw = false) =>
        set({ token, authenticated: true, currentUser: user, user: user.username, mustChangePw }),

      logout: () =>
        set({ token: null, user: null, groups: [], authenticated: false, currentUser: null, mustChangePw: false }),

      setAuthMode: (authMode) => set({ authMode }),
      setAuthenticated: (authenticated) => set({ authenticated }),
      updateCurrentUser: (currentUser) => set({ currentUser }),
    }),
    {
      name: 'kd-auth',
      partialize: (state) => ({
        authMode: state.authMode,
        token: state.token,
        authenticated: state.authenticated,
        currentUser: state.currentUser,
        user: state.user,
        mustChangePw: state.mustChangePw,
      }),
      // On rehydration from localStorage: clear authentication if JWT is expired
      onRehydrateStorage: () => (state) => {
        if (state && state.authenticated && isJwtExpired(state.token)) {
          state.authenticated = false
          state.token = null
          state.currentUser = null
          state.mustChangePw = false
        }
      },
    }
  )
)

export { isJwtExpired }
