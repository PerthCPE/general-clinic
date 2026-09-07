import { sharedAudioContext, initAudioContext } from './audioContext';
/**
 * Smart Audio Queue Calling with 100% Genuine Studio Google Thai Female Voice Pack
 * Plays gentle 3-tone hospital melodic chime + Studio Thai Female voice audio clips (.mp3)
 */

// Global audio element reference to prevent overlapping voices
let currentAudioElement: HTMLAudioElement | null = null;
let isAudioSequencePlaying = false;

// =========================================================================
// 1. เธฃเธฐเธเธเน€เธชเธตเธขเธเนเธเนเธเน€เธ•เธทเธญเธเธชเธณเธซเธฃเธฑเธ "เธซเนเธญเธเธขเธฒ" (Pharmacy)
// =========================================================================
export function playPharmacyNotification(message?: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (localStorage.getItem('notificationSoundEnabled') === 'false') {
        resolve(); return;
      }
      
      // เธ•เธฑเนเธเธเนเธฒเธฃเธนเธเนเธเธเน€เธชเธตเธขเธเนเธเนเธเน€เธ•เธทเธญเธ (เธซเนเธญเธเธขเธฒ)
      const USE_MP3 = false; 
      const MP3_FILE_PATH = '/audio/pin_a1.mp3'; 
      const WAIT_BEFORE_TTS_MS = 1500; 

      // เธ•เธฑเนเธเธเนเธฒเน€เธชเธตเธขเธเธชเธฑเธเน€เธเธฃเธฒเธฐเธซเน
      const TONE_1_FREQ = 659.25; 
      const TONE_2_FREQ = 523.25; 

      executeAudioPlay(USE_MP3, MP3_FILE_PATH, WAIT_BEFORE_TTS_MS, TONE_1_FREQ, TONE_2_FREQ, message, resolve);
    } catch (e) {
      console.error('Pharmacy audio play failed', e);
      resolve();
    }
  });
}

// =========================================================================
// 2. เธฃเธฐเธเธเน€เธชเธตเธขเธเนเธเนเธเน€เธ•เธทเธญเธเธชเธณเธซเธฃเธฑเธ "เธซเนเธญเธเธเธฒเธฃเน€เธเธดเธ" (Billing)
// =========================================================================
export function playBillingNotification(message?: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (localStorage.getItem('notificationSoundEnabled') === 'false') {
        resolve(); return;
      }
      
      // เธ•เธฑเนเธเธเนเธฒเธฃเธนเธเนเธเธเน€เธชเธตเธขเธเนเธเนเธเน€เธ•เธทเธญเธ (เธซเนเธญเธเธเธฒเธฃเน€เธเธดเธ)
      const USE_MP3 = false; 
      const MP3_FILE_PATH = '/audio/pin_a1.mp3'; // เธชเธฒเธกเธฒเธฃเธ–เน€เธเธฅเธตเนเธขเธเน€เธเนเธเนเธเธฅเนเธญเธทเนเธเนเธ”เน เน€เธเนเธ /audio/billing.mp3
      const WAIT_BEFORE_TTS_MS = 1500; 

      // เธ•เธฑเนเธเธเนเธฒเน€เธชเธตเธขเธเธชเธฑเธเน€เธเธฃเธฒเธฐเธซเน
      const TONE_1_FREQ = 659.25; 
      const TONE_2_FREQ = 523.25; 

      executeAudioPlay(USE_MP3, MP3_FILE_PATH, WAIT_BEFORE_TTS_MS, TONE_1_FREQ, TONE_2_FREQ, message, resolve);
    } catch (e) {
      console.error('Billing audio play failed', e);
      resolve();
    }
  });
}

// Helper alias for notification chime
export function playNotificationDingDong(): Promise<void> {
  return playHospitalChime();
}

// =========================================================================
// Core Logic เธชเธณเธซเธฃเธฑเธเน€เธฅเนเธเน€เธชเธตเธขเธ (เนเธเนเธฃเนเธงเธกเธเธฑเธ)
// =========================================================================
function executeAudioPlay(
  USE_MP3: boolean, 
  MP3_FILE_PATH: string, 
  WAIT_BEFORE_TTS_MS: number, 
  TONE_1_FREQ: number, 
  TONE_2_FREQ: number, 
  message: string | undefined, 
  resolve: (value: void | PromiseLike<void>) => void
) {
  const playTTS = () => {
    if (message) {
      const win = window as any;
      if (win.responsiveVoice) {
        win.responsiveVoice.speak(message, "Thai Female", { rate: 1.0 });
      }
    }
    resolve();
  };

  if (USE_MP3) {
    const audio = new Audio(MP3_FILE_PATH);
    audio.loop = true;
    currentAudioElement = audio;
    audio.play().catch(e => console.error('MP3 play failed', e));
    
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      playTTS();
    }, WAIT_BEFORE_TTS_MS);
  } else {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) {
      playTTS();
      return;
    }
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(TONE_1_FREQ, ctx.currentTime);
    gain1.gain.setValueAtTime(0.5, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(TONE_2_FREQ, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.5, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.65);

    setTimeout(playTTS, WAIT_BEFORE_TTS_MS);
  }
}

/**
 * Play a prestigious, soothing hospital announcement chime
 * 3-Tone Gentle Melodic Progression: F#5 -> A#5 -> C#6 with warm acoustic harmonics
 */
export function playHospitalChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) {
        resolve();
        return;
      }

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Helper to create a bell note with fundamental frequency and warm overtone
      const playBellNote = (freq: number, startTime: number, duration: number, gainLevel: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);

        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(freq * 2, startTime);

        overtoneGain.gain.setValueAtTime(0.0001, startTime);
        overtoneGain.gain.exponentialRampToValueAtTime(gainLevel * 0.25, startTime + 0.03);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

        overtone.connect(overtoneGain);
        overtoneGain.connect(ctx.destination);
        overtone.start(startTime);
        overtone.stop(startTime + duration * 0.7);
      };

      // Note 1: F#5 (739.99 Hz)
      playBellNote(739.99, now, 0.55, 0.16);

      // Note 2: A#5 (932.33 Hz)
      playBellNote(932.33, now + 0.28, 0.55, 0.18);

      // Note 3: C#6 (1108.73 Hz)
      playBellNote(1108.73, now + 0.56, 0.95, 0.22);

      setTimeout(() => {
        try {
          ctx.close();
        } catch {
          // ignore
        }
        resolve();
      }, 1400);
    } catch {
      resolve();
    }
  });
}

/**
 * Get natural Thai spoken text for department/room based on current status and department (for toast / UI)
 */
export function getSpokenDepartmentText(department: string = '', status: string = ''): string {
  const dept = (department || '').trim();
  const st = (status || '').trim();

  // 1. เธซเนเธญเธเธซเธฑเธ•เธ–เธเธฒเธฃ (Treatment / Procedure Room) -> "เธ—เธตเนเธซเนเธญเธเธซเธฑเธ•เธ–เธเธฒเธฃเธเนเธฐ"
  if (
    st === 'เธฃเธญเธ—เธณเธซเธฑเธ•เธ–เธเธฒเธฃ' ||
    dept.includes('เธซเธฑเธ•เธ–เธเธฒเธฃ') ||
    dept.includes('เธ—เธณเนเธเธฅ') ||
    dept.includes('เธเธตเธ”เธขเธฒ') ||
    dept.includes('เธเนเธเธขเธฒ') ||
    dept.includes('เนเธซเนเธเนเธณเน€เธเธฅเธทเธญ')
  ) {
    return 'เธ—เธตเนเธซเนเธญเธเธซเธฑเธ•เธ–เธเธฒเธฃเธเนเธฐ';
  }

  // 2. เธซเนเธญเธเธเธฒเธฃเน€เธเธดเธ (Cashier / Billing) -> "เธ—เธตเนเธซเนเธญเธเธเธฒเธฃเน€เธเธดเธเธเนเธฐ"
  if (
    st === 'เธฃเธญเธเธณเธฃเธฐเน€เธเธดเธ' ||
    dept.includes('เธเธณเธฃเธฐเน€เธเธดเธ') ||
    dept.includes('เนเธเธเน€เธเธตเธขเธฃเน') ||
    dept.includes('เธเธฒเธฃเน€เธเธดเธ') ||
    dept.includes('เธเธดเธ”เน€เธเธดเธ')
  ) {
    return 'เธ—เธตเนเธซเนเธญเธเธเธฒเธฃเน€เธเธดเธเธเนเธฐ';
  }

  // 3. เธซเนเธญเธเธเนเธฒเธขเธขเธฒ (Pharmacy) -> "เธ—เธตเนเธซเนเธญเธเธเนเธฒเธขเธขเธฒเธเนเธฐ"
  if (
    st === 'เธฃเธญเธฃเธฑเธเธขเธฒ' ||
    dept.includes('เธเนเธฒเธขเธขเธฒ') ||
    dept.includes('เธซเนเธญเธเธขเธฒ') ||
    dept.includes('เน€เธ เธชเธฑเธ') ||
    dept.includes('เธฃเธฑเธเธขเธฒ')
  ) {
    return 'เธ—เธตเนเธซเนเธญเธเธเนเธฒเธขเธขเธฒเธเนเธฐ';
  }

  // 4. เธเธธเธ”เธเธฑเธ”เธเธฃเธญเธ (Screening Station) -> "เธ—เธตเนเธเธธเธ”เธเธฑเธ”เธเธฃเธญเธเธเนเธฐ"
  if (st === 'เธฃเธญเธเธฑเธ”เธเธฃเธญเธ' || dept.includes('เธเธฑเธ”เธเธฃเธญเธ') || dept.includes('triage')) {
    return 'เธ—เธตเนเธเธธเธ”เธเธฑเธ”เธเธฃเธญเธเธเนเธฐ';
  }

  // 5. เธซเนเธญเธเธ•เธฃเธงเธเนเธเธ—เธขเน (Doctor Examination Rooms with specific room number)
  if (st === 'เธฃเธญเธเธเนเธเธ—เธขเน' || st === 'เธเธณเธฅเธฑเธเธ•เธฃเธงเธ' || dept.includes('เธซเนเธญเธเธ•เธฃเธงเธ') || dept.includes('เนเธเธ—เธขเน')) {
    if (dept.includes('3') || dept.includes('เธชเธฒเธก')) return 'เธ—เธตเนเธซเนเธญเธเธ•เธฃเธงเธ 3 เธเนเธฐ';
    if (dept.includes('2') || dept.includes('เธชเธญเธ')) return 'เธ—เธตเนเธซเนเธญเธเธ•เธฃเธงเธ 2 เธเนเธฐ';
    if (dept.includes('1') || dept.includes('เธซเธเธถเนเธ')) return 'เธ—เธตเนเธซเนเธญเธเธ•เธฃเธงเธ 1 เธเนเธฐ';

    const match = dept.match(/\d+/);
    if (match) return `เธ—เธตเนเธซเนเธญเธเธ•เธฃเธงเธ ${match[0]} เธเนเธฐ`;

    return 'เธ—เธตเนเธซเนเธญเธเธ•เธฃเธงเธ 1 เธเนเธฐ';
  }

  return 'เธ—เธตเนเธเธธเธ”เธเธฑเธ”เธเธฃเธญเธเธเนเธฐ';
}

/**
 * Get department audio file path from studio female voice pack (.mp3)
 */
function getDepartmentAudioPath(dept: string = '', status: string = ''): string {
  const d = (dept || '').trim();
  const st = (status || '').trim();

  // 1. เธซเธฑเธ•เธ–เธเธฒเธฃ (Treatment / Procedure) -> "เธ—เธตเนเธซเนเธญเธเธซเธฑเธ•เธ–เธเธฒเธฃเธเนเธฐ"
  // เธ•เธฃเธงเธเธซเธฑเธ•เธ–เธเธฒเธฃเน€เธเนเธเธญเธฑเธเธ”เธฑเธเนเธฃเธเน€เธเธทเนเธญเนเธกเนเนเธซเนเธเธณเธงเนเธฒ "เธเธตเธ”เธขเธฒ/เธเนเธเธขเธฒ" เนเธเธ•เธฃเธเธเธฑเธเธซเนเธญเธเธขเธฒ
  if (
    st === 'เธฃเธญเธ—เธณเธซเธฑเธ•เธ–เธเธฒเธฃ' ||
    d.includes('เธซเธฑเธ•เธ–เธเธฒเธฃ') ||
    d.includes('เธ—เธณเนเธเธฅ') ||
    d.includes('เธเธตเธ”เธขเธฒ') ||
    d.includes('เธเนเธเธขเธฒ') ||
    d.includes('เนเธซเนเธเนเธณเน€เธเธฅเธทเธญ')
  ) {
    return '/audio/dept_treatment.mp3';
  }

  // 2. เธเธฒเธฃเน€เธเธดเธ (Cashier / Billing) -> "เธ—เธตเนเธซเนเธญเธเธเธฒเธฃเน€เธเธดเธเธเนเธฐ"
  if (
    st === 'เธฃเธญเธเธณเธฃเธฐเน€เธเธดเธ' ||
    d.includes('เธเธณเธฃเธฐเน€เธเธดเธ') ||
    d.includes('เนเธเธเน€เธเธตเธขเธฃเน') ||
    d.includes('เธเธฒเธฃเน€เธเธดเธ') ||
    d.includes('เธเธดเธ”เน€เธเธดเธ')
  ) {
    return '/audio/dept_cashier.mp3';
  }

  // 3. เธเนเธฒเธขเธขเธฒ (Pharmacy) -> "เธ—เธตเนเธซเนเธญเธเธเนเธฒเธขเธขเธฒเธเนเธฐ"
  if (
    st === 'เธฃเธญเธฃเธฑเธเธขเธฒ' ||
    d.includes('เธเนเธฒเธขเธขเธฒ') ||
    d.includes('เธซเนเธญเธเธขเธฒ') ||
    d.includes('เน€เธ เธชเธฑเธ') ||
    d.includes('เธฃเธฑเธเธขเธฒ')
  ) {
    return '/audio/dept_pharmacy.mp3';
  }

  // 4. เธซเนเธญเธเธ•เธฃเธงเธเธฃเธฐเธเธธเน€เธฅเธ (Doctor Room 1, 2, 3)
  if (d.includes('1') || d.includes('เธซเธเธถเนเธ')) return '/audio/dept_doctor1.mp3';
  if (d.includes('2') || d.includes('เธชเธญเธ')) return '/audio/dept_doctor2.mp3';
  if (d.includes('3') || d.includes('เธชเธฒเธก')) return '/audio/dept_doctor3.mp3';
  if (st === 'เธฃเธญเธเธเนเธเธ—เธขเน' || st === 'เธเธณเธฅเธฑเธเธ•เธฃเธงเธ' || d.includes('เธ•เธฃเธงเธ') || d.includes('เนเธเธ—เธขเน')) {
    return '/audio/dept_doctor1.mp3';
  }

  // 5. เธเธธเธ”เธเธฑเธ”เธเธฃเธญเธ (Screening) -> "เธ—เธตเนเธเธธเธ”เธเธฑเธ”เธเธฃเธญเธเธเนเธฐ"
  return '/audio/dept_screening.mp3';
}

/**
 * Play a sequence of studio audio clips with natural rhythm & accelerated speed for queue digits
 */
function playAudioSequence(audioUrls: string[]): Promise<void> {
  return new Promise((resolve) => {
    if (!audioUrls || audioUrls.length === 0) {
      resolve();
      return;
    }

    isAudioSequencePlaying = true;
    let index = 0;

    const playNextClip = () => {
      if (!isAudioSequencePlaying || index >= audioUrls.length) {
        isAudioSequencePlaying = false;
        currentAudioElement = null;
        resolve();
        return;
      }

      const url = audioUrls[index];
      const isChar = url.includes('/audio/char_');
      const audio = new Audio(url);
      currentAudioElement = audio;

      // Speed up queue characters/digits (Q, 0, 0, 0, 1) for swift announcement
      if (isChar) {
        audio.playbackRate = 1.45;
      } else {
        audio.playbackRate = 1.08;
      }

      let advanced = false;
      const advance = () => {
        if (!advanced) {
          advanced = true;
          audio.removeEventListener('timeupdate', checkAdvance);
          audio.removeEventListener('ended', advance);
          index++;
          playNextClip();
        }
      };

      const checkAdvance = () => {
        // Advance 70ms before file ends to eliminate trailing silence
        if (isChar && audio.duration && audio.currentTime >= audio.duration - 0.07) {
          advance();
        }
      };

      audio.addEventListener('timeupdate', checkAdvance);
      audio.addEventListener('ended', advance);
      audio.onerror = () => advance();
      audio.play().catch(() => advance());
    };

    playNextClip();
  });
}

/**
 * Stop any currently running announcement
 */
export function stopQueueAudio(): void {
  isAudioSequencePlaying = false;
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement = null;
    } catch {
      // ignore
    }
  }
}

/**
 * Call queue announcement using 100% Genuine Studio Google Thai Female Voice Pack
 * Sequence: [Chime] -> "เธเธญเน€เธเธดเธเธซเธกเธฒเธขเน€เธฅเธ" -> "เธเธดเธง" -> "เธจเธนเธเธขเน" -> "เธจเธนเธเธขเน" -> "เธจเธนเธเธขเน" -> "เธซเธเธถเนเธ" -> "เธ—เธตเนเธเธธเธ”เธเธฑเธ”เธเธฃเธญเธเธเนเธฐ" / "เธ—เธตเนเธซเนเธญเธเธ•เธฃเธงเธเธซเธเธถเนเธเธเนเธฐ" / "เธ—เธตเนเธซเนเธญเธเธซเธฑเธ•เธ–เธเธฒเธฃเธเนเธฐ" / "เธ—เธตเนเธซเนเธญเธเธเธฒเธฃเน€เธเธดเธเธเนเธฐ" / "เธ—เธตเนเธซเนเธญเธเธเนเธฒเธขเธขเธฒเธเนเธฐ"
 */
export async function callQueueAudio(
  queueNo: string,
  department: string = 'เธเธธเธ”เธเธฑเธ”เธเธฃเธญเธ',
  status: string = 'เธฃเธญเธเธฑเธ”เธเธฃเธญเธ'
): Promise<void> {
  stopQueueAudio();

  // 1. Play soothing 3-tone hospital chime
  await playHospitalChime();
  await new Promise((r) => setTimeout(r, 120));

  // 2. Build Audio Sequence with 100% Genuine Studio Thai Female Voice Clips
  const sequence: string[] = ['/audio/intro.mp3']; // "เธเธญเน€เธเธดเธเธซเธกเธฒเธขเน€เธฅเธ"

  const clean = (queueNo || '').trim().toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === 'Q') {
      sequence.push('/audio/char_Q.mp3');
    } else if (/[0-9]/.test(char) || /[A-F]/.test(char)) {
      sequence.push(`/audio/char_${char}.mp3`);
    }
  }

  // 3. Add department / room clip with genuine studio female voice
  sequence.push(getDepartmentAudioPath(department, status));

  // 4. Play audio sequence
  await playAudioSequence(sequence);
}

