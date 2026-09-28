import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import { db } from '../client'
import { useSession } from '../session'
import { AuthScreen } from '../AuthScreen'
import { button, input, label } from '../styles'

type Mode = 'sign-in' | 'forgot' | 'sent'

export default function Login() {
  const session = useSession()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Signed in already (or just now): on to wherever the gate sent them from.
  if (session.status === 'signed-in') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from?.startsWith(ADMIN_ROOT) ? from : ADMIN_ROOT} replace />
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await db().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    // Supabase's own wording for a wrong password is fine; anything else
    // (network, rate limit) gets its message passed through as-is.
    if (error) setError(error.message)
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await db().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${ADMIN_ROOT}/reset-password`,
    })
    setBusy(false)
    if (error) setError(error.message)
    else setMode('sent')
  }

  if (mode === 'sent') {
    return (
      <AuthScreen title="Check your email">
        <p className="text-navy-300 text-sm leading-relaxed">
          If <span className="text-white">{email.trim()}</span> has an account, a link to set a new
          password is on its way. It works once, and expires after an hour.
        </p>
        <button type="button" className={button('secondary', 'mt-6')} onClick={() => setMode('sign-in')}>
          Back to sign in
        </button>
      </AuthScreen>
    )
  }

  const forgot = mode === 'forgot'

  return (
    <AuthScreen title={forgot ? 'Reset your password' : 'Sign in'}>
      <form onSubmit={forgot ? sendReset : signIn} className="space-y-4">
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
            disabled={busy}
          />
        </div>

        {!forgot && (
          <div>
            <label htmlFor="password" className={label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
              disabled={busy}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-alert-500 text-sm">
            {error}
          </p>
        )}

        <button type="submit" className={button('primary', 'w-full')} disabled={busy}>
          {busy ? 'Please wait…' : forgot ? 'Send reset link' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        className="text-navy-400 hover:text-signal-400 mt-5 text-sm transition-colors"
        onClick={() => {
          setMode(forgot ? 'sign-in' : 'forgot')
          setError(null)
        }}
      >
        {forgot ? '← Back to sign in' : 'Forgot your password?'}
      </button>
    </AuthScreen>
  )
}
