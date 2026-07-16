import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { Layout } from '@/components/layout/Layout'
import { ROUTES } from '@/routes'
import Home from '@/pages/Home'
import Services from '@/pages/Services'
import Capabilities from '@/pages/Capabilities'
import Projects from '@/pages/Projects'
import Certifications from '@/pages/Certifications'
import Coverage from '@/pages/Coverage'
import Contact from '@/pages/Contact'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path={ROUTES.home} element={<Home />} />
            <Route path={ROUTES.services} element={<Services />} />
            <Route path={ROUTES.capabilities} element={<Capabilities />} />
            <Route path={ROUTES.projects} element={<Projects />} />
            <Route path={ROUTES.certifications} element={<Certifications />} />
            <Route path={ROUTES.coverage} element={<Coverage />} />
            <Route path={ROUTES.contact} element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}
