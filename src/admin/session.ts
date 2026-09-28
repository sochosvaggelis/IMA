import { createContext, use } from 'react'

export type Session =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | {
      status: 'signed-in'
      userId: string
      email: string
      /** Whether this user is in the admins table. 'checking' until the
          database has answered; 'error' if it could not be asked. */
      access: 'checking' | 'admin' | 'denied' | 'error'
      recheck: () => void
    }

export const SessionContext = createContext<Session>({ status: 'loading' })

export function useSession(): Session {
  return use(SessionContext)
}
