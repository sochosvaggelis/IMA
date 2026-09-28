import { Link, useNavigate } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import { useSession } from '../session'
import { AuthScreen } from '../AuthScreen'
import { NewPasswordForm } from '../NewPasswordForm'
import { button } from '../styles'

/**
 * Where the password-reset email lands. The link carries a one-time session
 * in its #fragment, which the Supabase client picks up on load (see
 * client.ts) — so by the time this renders, the person is signed in and only
 * needs to choose the new password.
 */
export default function ResetPassword() {
  const session = useSession()
  const navigate = useNavigate()

  if (session.status === 'loading') {
    return (
      <AuthScreen title="Set a new password">
        <p className="text-navy-400 text-sm">Checking your link…</p>
      </AuthScreen>
    )
  }

  if (session.status === 'signed-out') {
    return (
      <AuthScreen title="Link expired">
        <p className="text-navy-300 text-sm leading-relaxed">
          This reset link has expired or has already been used. Ask for a new one from the sign-in
          page.
        </p>
        <Link to={`${ADMIN_ROOT}/login`} className={button('secondary', 'mt-6')}>
          Go to sign in
        </Link>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen title="Set a new password">
      <p className="text-navy-400 mb-5 text-sm">
        For <span className="text-white">{session.email}</span>
      </p>
      <NewPasswordForm submitLabel="Save and continue" onDone={() => navigate(ADMIN_ROOT, { replace: true })} />
    </AuthScreen>
  )
}
