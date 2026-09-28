/**
 * The admin panel, at /admin: where the site owner signs in to add, edit,
 * reorder and publish projects and spare parts.
 *
 * Its own lazy chunk (see App.tsx), carrying supabase-js, so none of it is
 * downloaded by a visitor. English only, and outside the site's language
 * routes and layout.
 *
 * Who may do what is decided by the database, not here — see the policies in
 * supabase/migrations. These screens only mirror those rules so that nobody
 * is shown a form the database would refuse.
 */
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ADMIN_ROOT } from '@/routes'
import { BACKEND } from '@/content/backend'
import { COLLECTIONS, SPARE_PARTS, type Collection } from './collections'
import { SessionProvider } from './SessionProvider'
import { RequireAdmin } from './RequireAdmin'
import { AuthScreen } from './AuthScreen'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import CollectionList from './pages/CollectionList'
import CollectionEditor from './pages/CollectionEditor'
import Account from './pages/Account'

/** The panel sets its own title and language, keeps itself out of search
    results, and hands all three back if the visitor goes on to the site. */
function useAdminDocument() {
  useEffect(() => {
    const previous = { title: document.title, lang: document.documentElement.lang }
    document.title = 'Admin · IMA'
    document.documentElement.lang = 'en'
    const robots = Object.assign(document.createElement('meta'), {
      name: 'robots',
      content: 'noindex, nofollow',
    })
    document.head.append(robots)
    return () => {
      robots.remove()
      document.title = previous.title
      document.documentElement.lang = previous.lang
    }
  }, [])
}

/**
 * One editor per URL. Keyed so that moving between rows starts a fresh form —
 * and on location.key for /new, since "Save and add another" navigates from
 * /new to /new, which would otherwise keep the form just saved.
 */
function EditorRoute({ collection }: { collection: Collection }) {
  const { id = 'new' } = useParams()
  const location = useLocation()
  return (
    <CollectionEditor
      key={id === 'new' ? `new:${location.key}` : id}
      collection={collection}
      id={id}
    />
  )
}

function NotConfigured() {
  return (
    <AuthScreen title="Not connected">
      <p className="text-navy-300 text-sm leading-relaxed">
        This build of the site has no content backend configured, so there is nothing to sign in to.
        Set <code className="text-signal-300">VITE_SUPABASE_URL</code> and{' '}
        <code className="text-signal-300">VITE_SUPABASE_PUBLISHABLE_KEY</code> — see the README.
      </p>
    </AuthScreen>
  )
}

export default function AdminApp() {
  useAdminDocument()

  if (!BACKEND) return <NotConfigured />

  return (
    <SessionProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route element={<RequireAdmin />}>
          {/* Spare parts first: adding photos of repairs is the everyday job. */}
          <Route index element={<Navigate to={`${ADMIN_ROOT}/${SPARE_PARTS.slug}`} replace />} />
          {COLLECTIONS.map((collection) => [
            <Route
              key={collection.slug}
              path={collection.slug}
              // Keyed: both lists are the same component at the same spot in
              // the tree, and without a key React would carry one list's
              // rows into the other for a frame.
              element={<CollectionList key={collection.slug} collection={collection} />}
            />,
            <Route
              key={`${collection.slug}/:id`}
              path={`${collection.slug}/:id`}
              element={<EditorRoute collection={collection} />}
            />,
          ])}
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Navigate to={ADMIN_ROOT} replace />} />
        </Route>
      </Routes>
    </SessionProvider>
  )
}
