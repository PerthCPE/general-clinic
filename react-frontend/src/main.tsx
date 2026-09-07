import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { playPharmacyNotification } from './utils/audioQueue'

// Compatibility helper for pharmacy audio call
(window as any).playNotificationDingDong = playPharmacyNotification;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
  

)


