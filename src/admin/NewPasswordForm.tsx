import { useId, useState, type FormEvent } from 'react'
import { db } from './client'
import { button, hint, input, label } from './styles'

/** Supabase's own default minimum. */
const MIN_LENGTH = 8

/** Sets a new password for whoever is signed in. Used after a reset link and
    from the account page. */
export function NewPasswordForm({ onDone, submitLabel }: { onDone: () => void; submitLabel: string }) {
  const id = useId()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`)
    if (password !== repeat) return setError('The two passwords do not match.')

    setBusy(true)
    setError(null)
    const { error } = await db().auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else {
      setPassword('')
      setRepeat('')
      onDone()
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor={`${id}-new`} className={label}>
          New password
        </label>
        <input
          id={`${id}-new`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
          disabled={busy}
        />
        <p className={hint}>At least {MIN_LENGTH} characters.</p>
      </div>
      <div>
        <label htmlFor={`${id}-repeat`} className={label}>
          Repeat new password
        </label>
        <input
          id={`${id}-repeat`}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className={input}
          disabled={busy}
        />
      </div>
      {error && (
        <p role="alert" className="text-alert-500 text-sm">
          {error}
        </p>
      )}
      <button type="submit" className={button('primary')} disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
