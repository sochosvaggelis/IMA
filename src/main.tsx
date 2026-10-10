import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { preloadPageFor } from './lazyPages'

// Wait for this page's own chunk first, so the first paint is the whole page
// rather than the header and footer around an empty <main> (see lazyPages.ts).
void preloadPageFor(window.location.pathname).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
