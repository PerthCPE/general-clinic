import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { playPharmacyNotification } from './utils/audioQueue'
import { initAudioContext } from './utils/audioContext'

// Compatibility helper for pharmacy audio call
(window as any).playNotificationDingDong = playPharmacyNotification;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ปลดล็อก AudioContext เมื่อผู้ใช้มี interaction ครั้งแรก (คลิก / กดปุ่ม / แตะจอ)
// เบราว์เซอร์จะไม่ยอมเล่นเสียงจนกว่าจะมี user gesture ครั้งแรก
const unlockAudio = () => {
  initAudioContext();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
