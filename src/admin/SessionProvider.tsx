import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from './client'
import { SessionContext, type Session } from './session'

type User = { id: string; email: string }
type Access = { userId: string; value: 'admin' | 'denied' | 'error' }

/**
 * Who is logged in, and whether they are an admin.
 *
 * The two are separate questions on purpose. Supabase answers the first; the
 * second is the admins table, the same one the database's policies consult —
 * so the panel only ever shows its editing screens to someone the database
 * will actually let write.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  // undefined: Supabase has not reported yet (it may be restoring a stored
  // session, or reading one from a password-reset link).
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [access, setAccess] = useState<Access | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Fires once straight away with the current session (INITIAL_SESSION),
    // then on every sign-in, sign-out and token refresh.
    const { data } = db().auth.onAuthStateChange((_event, session) => {
      const next = session?.user
      setUser((prev) =>
        // Same user after a token refresh: keep the object, so nothing
        // downstream re-runs.
        next && prev?.id === next.id ? prev : next ? { id: next.id, email: next.email ?? '' } : null,
      )
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let current = true
    // Not called inside onAuthStateChange: Supabase warns that awaiting its
    // own client from within that callback can deadlock the auth lock.
    db()
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!current) return
        const value = error ? 'error' : data && data.length > 0 ? 'admin' : 'denied'
        setAccess({ userId, value })
      })
    return () => {
      current = false
    }
  }, [userId, attempt])

  const recheck = useCallback(() => {
    setAccess(null)
    setAttempt((n) => n + 1)
  }, [])

  const session = useMemo<Session>(() => {
    if (user === undefined) return { status: 'loading' }
    if (user === null) return { status: 'signed-out' }
    return {
      status: 'signed-in',
      userId: user.id,
      email: user.email,
      access: access?.userId === user.id ? access.value : 'checking',
      recheck,
    }
  }, [user, access, recheck])

  return <SessionContext value={session}>{children}</SessionContext>
}
