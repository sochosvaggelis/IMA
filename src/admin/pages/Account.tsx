import { useState } from 'react'
import { useSession } from '../session'
import { NewPasswordForm } from '../NewPasswordForm'
import { card } from '../styles'

export default function Account() {
  const session = useSession()
  const [changed, setChanged] = useState(false)

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-white">Account</h1>
      {session.status === 'signed-in' && (
        <p className="text-navy-400 mt-2 text-sm">
          Signed in as <span className="text-white">{session.email}</span>
        </p>
      )}

      <section className={`${card} mt-8 p-5 sm:p-6`}>
        <h2 className="mb-4 font-semibold text-white">Change password</h2>
        {changed && (
          <p role="status" className="text-signal-400 mb-4 text-sm">
            Password changed.
          </p>
        )}
        <NewPasswordForm submitLabel="Change password" onDone={() => setChanged(true)} />
      </section>
    </div>
  )
}
