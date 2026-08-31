/**
 * Smart Audio Queue Calling with 100% Genuine Studio Google Thai Female Voice Pack
 * Plays gentle 3-tone hospital melodic chime + Studio Thai Female voice audio clips (.mp3)
 */

// Global audio element reference to prevent overlapping voices
let currentAudioElement: HTMLAudioElement | null = null;
let isAudioSequencePlaying = false;

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

  // 1. ห้องหัตถการ (Treatment / Procedure Room) -> "ที่ห้องหัตถการค่ะ"
  if (
    st === 'รอทำหัตถการ' ||
    dept.includes('หัตถการ') ||
    dept.includes('ทำแผล') ||
    dept.includes('ฉีดยา') ||
    dept.includes('พ่นยา') ||
    dept.includes('ให้น้ำเกลือ')
  ) {
    return 'ที่ห้องหัตถการค่ะ';
  }

  // 2. ห้องการเงิน (Cashier / Billing) -> "ที่ห้องการเงินค่ะ"
  if (
    st === 'รอชำระเงิน' ||
    dept.includes('ชำระเงิน') ||
    dept.includes('แคชเชียร์') ||
    dept.includes('การเงิน') ||
    dept.includes('คิดเงิน')
  ) {
    return 'ที่ห้องการเงินค่ะ';
  }

  // 3. ห้องจ่ายยา (Pharmacy) -> "ที่ห้องจ่ายยาค่ะ"
  if (
    st === 'รอรับยา' ||
    dept.includes('จ่ายยา') ||
    dept.includes('ห้องยา') ||
    dept.includes('เภสัช') ||
    dept.includes('รับยา')
  ) {
    return 'ที่ห้องจ่ายยาค่ะ';
  }

  // 4. จุดคัดกรอง (Screening Station) -> "ที่จุดคัดกรองค่ะ"
  if (st === 'รอคัดกรอง' || dept.includes('คัดกรอง') || dept.includes('triage')) {
    return 'ที่จุดคัดกรองค่ะ';
  }

  // 5. ห้องตรวจแพทย์ (Doctor Examination Rooms with specific room number)
  if (st === 'รอพบแพทย์' || st === 'กำลังตรวจ' || dept.includes('ห้องตรวจ') || dept.includes('แพทย์')) {
    if (dept.includes('3') || dept.includes('สาม')) return 'ที่ห้องตรวจ 3 ค่ะ';
    if (dept.includes('2') || dept.includes('สอง')) return 'ที่ห้องตรวจ 2 ค่ะ';
    if (dept.includes('1') || dept.includes('หนึ่ง')) return 'ที่ห้องตรวจ 1 ค่ะ';

    const match = dept.match(/\d+/);
    if (match) return `ที่ห้องตรวจ ${match[0]} ค่ะ`;

    return 'ที่ห้องตรวจ 1 ค่ะ';
  }

  return 'ที่จุดคัดกรองค่ะ';
}

/**
 * Get department audio file path from studio female voice pack (.mp3)
 */
function getDepartmentAudioPath(dept: string = '', status: string = ''): string {
  const d = (dept || '').trim();
  const st = (status || '').trim();

  // 1. หัตถการ (Treatment / Procedure) -> "ที่ห้องหัตถการค่ะ"
  // ตรวจหัตถการเป็นอันดับแรกเพื่อไม่ให้คำว่า "ฉีดยา/พ่นยา" ไปตรงกับห้องยา
  if (
    st === 'รอทำหัตถการ' ||
    d.includes('หัตถการ') ||
    d.includes('ทำแผล') ||
    d.includes('ฉีดยา') ||
    d.includes('พ่นยา') ||
    d.includes('ให้น้ำเกลือ')
  ) {
    return '/audio/dept_treatment.mp3';
  }

  // 2. การเงิน (Cashier / Billing) -> "ที่ห้องการเงินค่ะ"
  if (
    st === 'รอชำระเงิน' ||
    d.includes('ชำระเงิน') ||
    d.includes('แคชเชียร์') ||
    d.includes('การเงิน') ||
    d.includes('คิดเงิน')
  ) {
    return '/audio/dept_cashier.mp3';
  }

  // 3. จ่ายยา (Pharmacy) -> "ที่ห้องจ่ายยาค่ะ"
  if (
    st === 'รอรับยา' ||
    d.includes('จ่ายยา') ||
    d.includes('ห้องยา') ||
    d.includes('เภสัช') ||
    d.includes('รับยา')
  ) {
    return '/audio/dept_pharmacy.mp3';
  }

  // 4. ห้องตรวจระบุเลข (Doctor Room 1, 2, 3)
  if (d.includes('1') || d.includes('หนึ่ง')) return '/audio/dept_doctor1.mp3';
  if (d.includes('2') || d.includes('สอง')) return '/audio/dept_doctor2.mp3';
  if (d.includes('3') || d.includes('สาม')) return '/audio/dept_doctor3.mp3';
  if (st === 'รอพบแพทย์' || st === 'กำลังตรวจ' || d.includes('ตรวจ') || d.includes('แพทย์')) {
    return '/audio/dept_doctor1.mp3';
  }

  // 5. จุดคัดกรอง (Screening) -> "ที่จุดคัดกรองค่ะ"
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
 * Sequence: [Chime] -> "ขอเชิญหมายเลข" -> "คิว" -> "ศูนย์" -> "ศูนย์" -> "ศูนย์" -> "หนึ่ง" -> "ที่จุดคัดกรองค่ะ" / "ที่ห้องตรวจหนึ่งค่ะ" / "ที่ห้องหัตถการค่ะ" / "ที่ห้องการเงินค่ะ" / "ที่ห้องจ่ายยาค่ะ"
 */
export async function callQueueAudio(
  queueNo: string,
  department: string = 'จุดคัดกรอง',
  status: string = 'รอคัดกรอง'
): Promise<void> {
  stopQueueAudio();

  // 1. Play soothing 3-tone hospital chime
  await playHospitalChime();
  await new Promise((r) => setTimeout(r, 120));

  // 2. Build Audio Sequence with 100% Genuine Studio Thai Female Voice Clips
  const sequence: string[] = ['/audio/intro.mp3']; // "ขอเชิญหมายเลข"

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
