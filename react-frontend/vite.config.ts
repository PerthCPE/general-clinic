import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // อ่านค่าจากไฟล์ .env / .env.local ของแต่ละคน
  // (ใส่ '' เป็น prefix เพื่อให้อ่านตัวแปรที่ไม่ได้ขึ้นต้นด้วย VITE_ ได้ด้วย)
  const env = loadEnv(mode, process.cwd(), '')

  // ปลายทางของ proxy /api
  // ------------------------------------------------------------------
  // เดิม hardcode ไว้ที่ 8080 ซึ่งพังทันทีถ้าเครื่องใครมีโปรแกรมอื่นยึดพอร์ตนั้นอยู่
  // แล้วต้องรัน backend ที่พอร์ตอื่น อาการคือหน้าที่เรียกแบบ relative path
  // (เช่น /api/pharmacy/queues) จะได้ HTML ของโปรแกรมอื่นกลับมาแทน JSON
  // แล้วขึ้นเป็นรายการว่างโดยไม่มี error อะไรให้เห็น
  //
  // ตอนนี้อ่านจาก .env.local ของแต่ละคน ใครไม่ได้ตั้งก็ยังได้ 8080 เหมือนเดิม
  // ใช้ VITE_API_URL ตัวเดียวกับที่ api.ts ใช้ จะได้ไม่ต้องตั้งสองที่
  const apiTarget =
    env.VITE_API_TARGET || env.VITE_API_URL || 'http://localhost:8080'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
