import React from 'react'
import ReactDOM from 'react-dom/client'
import { ManagementApp } from './ManagementApp'
import '../shared/theme.css'
import '../shared/chat/chat.css'
import './management.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ManagementApp />
  </React.StrictMode>
)
