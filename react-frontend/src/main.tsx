import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { playPharmacyNotification } from './utils/audioQueue'

// Compatibility helper for pharmacy audio call
(window as any).playNotificationDingDong = playPharmacyNotification;

import { initAudioContext } from './utils/audioContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Unlock AudioContext globally on first user gesture
document.addEventListener('pointerdown', () => {
    initAudioContext();
}, { once: true });


