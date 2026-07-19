import React from 'react'
import ReactDOM from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import '../shared/chat/chat.css'
import './overlay.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
)
