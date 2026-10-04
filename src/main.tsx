import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CameraDebug from './camera/CameraDebug.tsx'
import ApiDebug from './debug/ApiDebug.tsx'

// /?debug=camera and /?debug=api open developer pages instead of the app.
const debug = new URLSearchParams(window.location.search).get('debug')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {debug === 'camera' ? <CameraDebug /> : debug === 'api' ? <ApiDebug /> : <App />}
  </StrictMode>,
)
