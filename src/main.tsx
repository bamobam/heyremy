import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// /?debug=camera and /?debug=api open developer pages instead of the app; /prototype mounts the UI
// prototypes. All load on demand, so none of them (nor the prototype's global CSS) ships in the app's own bundle.
const CameraDebug = lazy(() => import('./camera/CameraDebug.tsx'))
const ApiDebug = lazy(() => import('./debug/ApiDebug.tsx'))
const RemyUIPrototype = lazy(() => import('./prototype/remy-ui'))

const debug = new URLSearchParams(window.location.search).get('debug')
const isPrototype = location.pathname.startsWith('/prototype')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isPrototype ? <RemyUIPrototype /> : debug === 'camera' ? <CameraDebug /> : debug === 'api' ? <ApiDebug /> : <App />}
    </Suspense>
  </StrictMode>,
)
