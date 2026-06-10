import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api, internalAuthApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { SafeUser } from '@/lib/api'
import { Server, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Internal login (username + password) ─────────────────────────────────────
function InternalLoginForm({
  onSuccess,
}: {
  onSuccess: (token: string, user: SafeUser, mustChangePw: boolean) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const r = await internalAuthApi.login(username.trim(), password)
      const { accessToken, user, mustChangePw } = r.data
      onSuccess(accessToken, user, mustChangePw ?? false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg    = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      if (status === 429 || msg?.includes('locked')) {
        setError('Account temporarily locked. Please try again in 15 minutes.')
      } else if (status === 403) {
        setError('Your account has been disabled. Contact an administrator.')
      } else {
        setError('Invalid username or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Username */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Username
        </label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          spellCheck={false}
          className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-600
                     rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                     focus:border-transparent transition-all"
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Password
        </label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full bg-slate-800/60 border border-slate-700 text-white placeholder-slate-600
                       rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300 leading-snug">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !username.trim() || !password}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm
                   hover:bg-blue-500 active:bg-blue-700 transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed
                   shadow-lg shadow-blue-900/30 mt-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Signing in…
          </span>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  )
}

// ── K8s bearer-token login ────────────────────────────────────────────────────
function TokenLoginForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [token, setToken]   = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError('')
    try {
      await authApi.login(token.trim())
      onSuccess(token.trim())
    } catch {
      setError('Token could not be validated. Please check your ServiceAccount token.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Bearer Token
        </label>
        <textarea
          value={token}
          onChange={e => setToken(e.target.value)}
          rows={5}
          className="w-full bg-slate-800/60 border border-slate-700 text-slate-200 placeholder-slate-600
                     rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed transition-all"
          placeholder="Paste your ServiceAccount token here…"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !token.trim()}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm
                   hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Validating…' : 'Sign In'}
      </button>

      <p className="text-xs text-slate-600 text-center">
        Generate a token with{' '}
        <code className="text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
          kubectl create token &lt;sa&gt; -n &lt;namespace&gt;
        </code>
      </p>
    </form>
  )
}

// ── Force-change-password screen ──────────────────────────────────────────────
function ChangePasswordScreen({ onDone }: { onDone: () => void }) {
  const [newPw, setNewPw]       = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const checks = [
    { ok: newPw.length >= 8,              label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(newPw),            label: 'One uppercase letter'  },
    { ok: /[0-9]/.test(newPw),            label: 'One number'           },
    { ok: newPw === confirm && !!confirm,  label: 'Passwords match'      },
  ]
  const allOk = checks.every(c => c.ok)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allOk) return
    setLoading(true)
    setError('')
    try {
      await internalAuthApi.changeMyPassword('', newPw)
      onDone()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-300">
          You must set a new password before you can access the dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoFocus
              className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl
                         px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Confirm Password
          </label>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={cn(
              'w-full bg-slate-800/60 border text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all',
              confirm && confirm !== newPw ? 'border-red-500/50' : 'border-slate-700'
            )}
          />
        </div>

        {/* Requirements */}
        {newPw && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-1.5 text-xs">
                <CheckCircle size={11} className={c.ok ? 'text-green-400' : 'text-slate-700'} />
                <span className={c.ok ? 'text-slate-400' : 'text-slate-600'}>{c.label}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !allOk}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm
                     hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Saving…' : 'Set Password & Continue'}
        </button>
      </form>
    </div>
  )
}

// ── Root login page ───────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate()
  const {
    loginWithToken, loginInternal, authenticated, logout,
    setAuthMode, setAuthenticated, mustChangePw, updateCurrentUser,
  } = useAuthStore()

  const [serverMode, setServerMode]   = useState<string | null>(null)
  const [checking, setChecking]       = useState(true)
  const [showChangePw, setShowChangePw] = useState(false)

  // Ask the server which auth mode is active — no token required
  useEffect(() => {
    api.get('/auth/config')
      .then(r => {
        const cfg = r.data?.data as { mode: string; authenticated: boolean } | undefined
        if (!cfg) { setChecking(false); return }
        setServerMode(cfg.mode)
        setAuthMode(cfg.mode as never)
        if (cfg.authenticated) {
          // Server says auto-authenticated (authMode=none) — go straight to dashboard
          setAuthenticated(true)
          setChecking(false)
        } else {
          // Server says not authenticated — clear any stale persisted state
          logout()
          setChecking(false)
        }
      })
      .catch(() => { setChecking(false) })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-slate-700 border-t-blue-400 rounded-full animate-spin" />
      </div>
    )
  }

  // Use <Navigate> not navigate() — calling navigate() during render causes redirect loops
  if (authenticated && !mustChangePw && !checking) {
    return <Navigate to="/" replace />
  }

  function handleInternalSuccess(token: string, user: SafeUser, mustChange: boolean) {
    loginInternal(token, user, mustChange)
    if (mustChange) {
      setShowChangePw(true)
    } else {
      navigate('/', { replace: true })
    }
  }

  function handleTokenSuccess(token: string) {
    loginWithToken(token)
    navigate('/', { replace: true })
  }

  function handlePasswordChanged() {
    internalAuthApi.me()
      .then(r => { if (r.data) updateCurrentUser(r.data) })
      .catch(() => {})
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-sm relative">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700
                          flex items-center justify-center shadow-xl shadow-blue-900/40">
            <Server size={22} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Klarity</h1>
            <p className="text-xs text-slate-500 mt-0.5">Enterprise Cluster Management</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {showChangePw ? (
            <>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Lock size={15} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base leading-tight">Set New Password</h2>
                  <p className="text-xs text-slate-500">Required before you can continue</p>
                </div>
              </div>
              <ChangePasswordScreen onDone={handlePasswordChanged} />
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-white mb-6">Sign in</h2>

              {(serverMode === 'internal' || serverMode === null) && (
                <InternalLoginForm onSuccess={handleInternalSuccess} />
              )}

              {serverMode === 'token' && (
                <TokenLoginForm onSuccess={handleTokenSuccess} />
              )}

              {serverMode === 'oidc' && (
                <div className="text-center py-6 space-y-4">
                  <p className="text-sm text-slate-400">
                    You will be redirected to your identity provider
                  </p>
                  <button className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors">
                    Continue with SSO →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Minimal footer */}
        <p className="text-center text-xs text-slate-700 mt-6">
          Apache 2.0 · Open Source
        </p>
      </div>
    </div>
  )
}
