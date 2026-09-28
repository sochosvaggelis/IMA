import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import { db } from './client'
import { useSession } from './session'
import { AuthScreen } from './AuthScreen'
import { AdminShell } from './AdminShell'
import { button } from './styles'

function Waiting() {
  return (
    <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <p className="text-navy-500 font-mono text-xs tracking-[0.14em] uppercase">Loading…</p>
    </main>
  )
}

/**
 * The gate in front of every editing screen: signed in, AND on the admins
 * list. The database enforces the same rule on every write regardless — this
 * is so that someone it would refuse is told so plainly, instead of being
 * shown forms that fail on save.
 */
export function RequireAdmin() {
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') return <Waiting />

  if (session.status === 'signed-out') {
    return <Navigate to={`${ADMIN_ROOT}/login`} replace state={{ from: location.pathname }} />
  }

  if (session.access === 'checking') return <Waiting />

  if (session.access !== 'admin') {
    const signOut = () => void db().auth.signOut()
    return (
      <AuthScreen title={session.access === 'denied' ? 'No admin access' : 'Could not check access'}>
        <p className="text-navy-300 text-sm leading-relaxed">
          {session.access === 'denied' ? (
            <>
              You are signed in as <span className="text-white">{session.email}</span>, but that
              account is not an administrator of this site.
            </>
          ) : (
            'The server did not answer. Check your connection and try again.'
          )}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {session.access === 'error' && (
            <button type="button" className={button('primary')} onClick={session.recheck}>
              Try again
            </button>
          )}
          <button type="button" className={button('secondary')} onClick={signOut}>
            Sign out
          </button>
        </div>
      </AuthScreen>
    )
  }

  return (
    <AdminShell email={session.email}>
      <Outlet />
    </AdminShell>
  )
}
