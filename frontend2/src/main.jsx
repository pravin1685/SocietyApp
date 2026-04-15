import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './i18n/index.js'
import './index.css'
import App from './App.jsx'

// Set API base URL from environment variable (for production deployment)
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
