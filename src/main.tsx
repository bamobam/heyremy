import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// /?debug=camera opens the camera track's developer page; /prototype mounts the UI prototypes.
// Both load on demand, so neither (nor the prototype's global CSS) ships in the app's own bundle.
const CameraDebug = lazy(() => import('./camera/CameraDebug.tsx'))
const RemyUIPrototype = lazy(() => import('./prototype/remy-ui'))

const debug = new URLSearchParams(window.location.search).get('debug')
const isPrototype = location.pathname.startsWith('/prototype')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isPrototype ? <RemyUIPrototype /> : debug === 'camera' ? <CameraDebug /> : <App />}</Suspense>
  </StrictMode>,
)
