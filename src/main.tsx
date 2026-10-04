import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CameraDebug from './camera/CameraDebug.tsx'
// PROTOTYPE (throwaway): /prototype mounts the UI variants. Remove when a variant is picked.
import RemyUIPrototype from './prototype/remy-ui'

// /?debug=camera opens the camera track's developer page instead of the app.
const debug = new URLSearchParams(window.location.search).get('debug')
const isPrototype = location.pathname.startsWith('/prototype')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isPrototype ? <RemyUIPrototype /> : debug === 'camera' ? <CameraDebug /> : <App />}</StrictMode>,
)
