import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CameraDebug from './camera/CameraDebug.tsx'

// /?debug=camera opens the camera track's developer page instead of the app.
const debug = new URLSearchParams(window.location.search).get('debug')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{debug === 'camera' ? <CameraDebug /> : <App />}</StrictMode>,
)
