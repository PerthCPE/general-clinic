
let ctx: AudioContext | null = null;

/** คืนค่า AudioContext กลาง (สร้างครั้งแรกเมื่อถูกเรียก) — ใช้ตัวเดิมซ้ำเสมอ ห้าม close() */
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }

  // พยายามปลุก context ทุกครั้งที่ขอใช้ (เผื่อถูก suspend หลังสลับแท็บ)
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * คืนค่า AudioContext กลางที่ "พร้อมเล่นเสียงแล้ว" (state === 'running')
 *
 * สำคัญ: ctx.resume() เป็น async — ถ้าไม่ await แล้วรีบ schedule oscillator ทันที
 * ตอน context ยัง suspended (เช่น แท็บอยู่ background) เสียงจะถูกตั้งเวลาไว้ในอดีต
 * พอ context ตื่นขึ้นมาช่วงเวลานั้นผ่านไปแล้ว -> ไม่มีเสียง (อาการ "บางทีติด บางทีไม่ติด")
 */
export async function resumeSharedAudioContext(): Promise<AudioContext | null> {
  const c = getSharedAudioContext();
  if (!c) return null;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      return null;
    }
  }
  return c.state === 'running' ? c : null;
}

/** ปลดล็อกเสียงเมื่อผู้ใช้มี interaction ครั้งแรก — เรียกจาก event listener เท่านั้น */
export function initAudioContext(): void {
  const c = getSharedAudioContext();
  if (c && c.state === 'suspended') {
    void c
      .resume()
      .then(() => console.log('[audio] AudioContext resumed by user gesture'))
      .catch((err) => console.warn('[audio] resume failed:', err));
  }
}
