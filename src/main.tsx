import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// PROTOTYPE (throwaway): /prototype mounts the UI variants. Remove when a variant is picked.
import RemyUIPrototype from './prototype/remy-ui'

const isPrototype = location.pathname.startsWith('/prototype')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrototype ? <RemyUIPrototype /> : <App />}
  </StrictMode>,
)
