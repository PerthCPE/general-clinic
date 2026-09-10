
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
