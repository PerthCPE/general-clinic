import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
// สีโหมดมืดของหน้าจอแพทย์ นำเข้าที่นี่เพราะไฟล์นี้ถูกโหลดทุกครั้งที่เข้าหน้าแพทย์
// และไม่ถูกโหลดเลยเมื่ออยู่ role อื่น จึงไม่มีทางไปกวนหน้าของเพื่อน
import './doctor-dark.css';
import { LanguageProvider } from './context/LanguageContext';
import type { Patient, QueueStatus } from './types';
import {
  applyExaminationDetail,
  buildExaminationRequest,
  mapPastVisit,
  mapQueueItemToPatient,
} from './utils/mapFromApi';
import { doctorApi, examinationApi } from '../../services/api';
import type { BackendDoctorQueueSummary } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';

/**
 * ==============================================================================
 * Doctor Module Shared Data Context (DoctorDataContext.tsx)
 * ==============================================================================
 * เก็บ state ของคิวผู้ป่วยที่ใช้ร่วมกันระหว่างหน้าจอต่างๆ ของแพทย์
 * (แดชบอร์ด, บันทึกการตรวจ, ประวัติเวชระเบียน) เพื่อให้ข้อมูลผู้ป่วย
 * ที่กำลังตรวจ/เลือกดูอยู่ ยังคงอยู่แม้จะสลับเมนูไปมาผ่าน Sidebar เดิม
 *
 * ข้อมูลมาจาก GET /api/doctor/queue ของ backend จริงแล้ว (เดิมเป็น mock)
 * และรีเฟรชอัตโนมัติเมื่อได้รับ event ผ่าน WebSocket เช่น พยาบาลคัดกรอง
 * ผู้ป่วยเสร็จ หรือเจ้าหน้าที่ออกคิวใหม่
 *
 * หมายเหตุ: Provider นี้ครอบทั้งแอปใน App.tsx จึงต้องเช็ค role ก่อนยิง API
 * ไม่งั้น registrar กับพยาบาลจะโดน 403 ตั้งแต่เปิดหน้าแรก
 */
interface DoctorDataContextType {
  patients: Patient[];
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  activeExamPatient: Patient | null;
  setActiveExamPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
  selectedRecordPatient: Patient | null;
  setSelectedRecordPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  /** คืน true เมื่อ backend บันทึกสำเร็จจริง, false เมื่อล้มเหลว
   *  หน้าจอต้องรอค่านี้ก่อนขึ้นกล่อง "บันทึกสำเร็จ" */
  handleSavePatient: (updatedPatient: Patient) => Promise<boolean>;
  /** เปลี่ยนสถานะคิว/visit ของผู้ป่วย
   *  note = บันทึกเหตุผลลงช่อง note ของคิว ใช้ตอนยกเลิกการรับบริการ
   *  ถ้าไม่ส่งมา backend จะไม่แตะ note เดิม */
  handleUpdateStatus: (patientId: string, newStatus: QueueStatus, note?: string) => void;

  /**
   * ผู้ป่วยสำหรับหน้าประวัติเวชระเบียน
   *
   * ไม่ใช่ชุดเดียวกับ patients ด้านบน เพราะ patients มาจาก /queue ซึ่งคืน
   * เฉพาะคิวที่ยังเดินอยู่กับคิวที่ปิดไปแล้ววันนี้ (แดชบอร์ดต้องใช้นับ)
   * ชุดนี้ดึงจาก /patient-records จึงมีผู้ป่วยที่ตรวจจบไปแล้วเมื่อไรก็ได้
   */
  recordPatients: Patient[];
  isRecordsLoading: boolean;
  recordsError: string | null;
  refreshRecords: () => Promise<void>;

  // สถานะการเชื่อมต่อ backend
  summary: BackendDoctorQueueSummary | null;
  isLoading: boolean;

  /**
   * true ตั้งแต่เปิดหน้ามา จนกว่าจะโหลดคิวจากฐานข้อมูลจบ "รอบแรก"
   *
   * ต่างจาก isLoading ตรงที่ isLoading เป็น true ทุกครั้งที่ยิง API รวมถึง
   * การรีเฟรชเบื้องหลังทุก 4 วินาที และทุกครั้งที่มี WebSocket event เข้ามา
   * ถ้าเอา isLoading ไปคุมหน้าจอโหลด หน้าจะกะพริบเป็นหน้าโหลดตลอดเวลา
   * ยิ่งเปิด simulator ไว้ยิ่งกะพริบถี่ เพราะมันยิง event ตลอด
   *
   * ตัวนี้จึงเป็น true แค่รอบแรกรอบเดียว ใช้คุมหน้าจอ "กำลังโหลดข้อมูล"
   * ที่บังทั้งหน้าได้อย่างปลอดภัย
   */
  isInitialLoading: boolean;

  isSaving: boolean;
  isExamLoading: boolean;

  /**
   * ข้อผิดพลาดจากการบันทึกผลตรวจโดยเฉพาะ แยกจาก error รวมด้านล่าง
   * เพื่อไม่ให้หน้าบันทึกการตรวจไปแสดงข้อผิดพลาดของหน้าอื่น
   */
  saveError: string | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const DoctorDataContext = createContext<DoctorDataContextType | undefined>(undefined);

export const DoctorDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { subscribe } = useWebSocket();

  const isDoctor = currentUser?.role === 'doctor';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [recordPatients, setRecordPatients] = useState<Patient[]>([]);
  const [isRecordsLoading, setIsRecordsLoading] = useState<boolean>(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeExamPatient, setActiveExamPatient] = useState<Patient | null>(null);
  const [selectedRecordPatient, setSelectedRecordPatient] = useState<Patient | null>(null);
  // เปิดหน้ามาให้เห็น "รอตรวจ" ก่อน เพราะเป็นกลุ่มเดียวที่แพทย์ต้องลงมือทำต่อ
  // ถ้าตั้งเป็น "ทั้งหมด" คิวที่ตรวจจบไปแล้วจะปนอยู่ในรายการตั้งแต่แรก
  // ทำให้ต้องกวาดตาหาคนถัดไปเองทุกครั้งที่เปิดหน้า
  const [statusFilter, setStatusFilter] = useState<string>('Waiting');

  const [summary, setSummary] = useState<BackendDoctorQueueSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // เริ่มต้นเป็น true เสมอ เพราะตอน component เพิ่งถูกสร้าง ยังไม่มีข้อมูลจากฐานข้อมูลเลย
  // ถ้าเริ่มเป็น false หน้าจะแว่บโชว์ "ไม่พบข้อมูลผู้ป่วย" พร้อมเลข 0 ก่อนข้อมูลจริงจะมา
  // ซึ่งทำให้แพทย์เข้าใจผิดว่าวันนี้ไม่มีคิว
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // true ระหว่างดึงผลตรวจเดิมของเคสที่เพิ่งเปิด (ครั้งแรกของแต่ละ visit)
  const [isExamLoading, setIsExamLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // กันการยิงซ้ำถี่ๆ เวลามี WebSocket event เข้ามาติดกันหลายตัว
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // จำ visit ที่ดึงผลตรวจมาแล้ว กันไม่ให้ effect ยิงซ้ำไม่รู้จบ
  // (เพราะ effect เองเป็นคนแก้ activeExamPatient)
  const hydratedVisitRef = useRef<number | null>(null);
  // เก็บเป็น "patientId:recordsRefreshKey" ไม่ใช่แค่ patientId
  // เพื่อให้บังคับดึงประวัติใหม่ได้ตอนเพิ่งบันทึกผลตรวจ ทั้งที่ยังเป็นผู้ป่วยคนเดิม
  const hydratedRecordRef = useRef<string | null>(null);

  /**
   * ตัวนับสั่งให้หน้าประวัติเวชระเบียนโหลดข้อมูลใหม่
   *
   * หน้าประวัติถือข้อมูลคนละชุดกับหน้าคิว (recordPatients / selectedRecordPatient)
   * ซึ่ง refresh() ไม่ได้แตะเลย และไม่มี polling ทุก 4 วินาทีเหมือนหน้าคิวด้วย
   * ถ้าไม่บังคับให้โหลดใหม่ แพทย์ที่บันทึกผลตรวจเสร็จแล้วสลับไปดูหน้าประวัติ
   * จะยังเห็นสถานะเก่าและยังไม่เห็นการวินิจฉัยที่เพิ่งบันทึกลงไป
   */
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!isDoctor) return;

    setIsLoading(true);
    try {
      const res = await doctorApi.getQueue();
      setPatients(res.items.map(mapQueueItemToPatient));
      setSummary(res.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดคิวผู้ป่วยได้');
    } finally {
      setIsLoading(false);
      // ปลดหน้าจอโหลดใน finally ไม่ใช่ใน try
      // เพื่อให้กรณีต่อ backend ไม่ได้ ผู้ใช้ได้เห็นข้อความ error ไม่ใช่ค้างที่หน้าโหลดตลอดไป
      setIsInitialLoading(false);
    }
  }, [isDoctor]);

  /** โหลดรายชื่อผู้ป่วยสำหรับหน้าประวัติ (รวมคนที่ตรวจเสร็จไปแล้ว) */
  const refreshRecords = useCallback(async () => {
    if (!isDoctor) return;

    setIsRecordsLoading(true);
    try {
      const res = await doctorApi.getPatientRecords();
      setRecordPatients(res.items.map(mapQueueItemToPatient));
      setRecordsError(null);

      /**
       * ล้างแคชประวัติย้อนหลังของผู้ป่วยที่เลือกอยู่ทุกครั้งที่โหลดรายชื่อใหม่
       *
       * เคยพลาดตรงนี้: ประวัติย้อนหลังถูกดึงครั้งเดียวต่อผู้ป่วยหนึ่งคน
       * แล้วจำไว้ใน hydratedRecordRef ว่า "คนนี้ดึงไปแล้ว"
       * พอแพทย์สั่งยา บันทึก แล้วเดินกลับมาดูประวัติของคนเดิม
       * ระบบเห็นว่าเคยดึงไปแล้วเลยไม่ยิงซ้ำ จอจึงยังเป็นข้อมูลชุดก่อนสั่งยา
       * ยาที่เพิ่งสั่งไม่ขึ้น ต้องกด refresh ทั้งหน้า (F5) ถึงจะเห็น
       * เพราะการ refresh ล้าง ref ทิ้งไปพร้อมกับ state ทั้งหมด
       *
       * ฟังก์ชันนี้ถูกเรียกทุกครั้งที่เข้าหน้าประวัติ และทุกครั้งที่บันทึกผลตรวจ
       * จึงเป็นจุดที่เหมาะที่สุดในการบอกว่า "ข้อมูลเก่าใช้ไม่ได้แล้ว ไปดึงใหม่"
       */
      setRecordsRefreshKey((k) => k + 1);
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : 'ไม่สามารถโหลดประวัติผู้ป่วยได้');
    } finally {
      setIsRecordsLoading(false);
    }
  }, [isDoctor]);

  /**
   * ตั้งเวลาให้รีเฟรชหลังจากนี้ 400ms
   * ถ้ามี event เข้ามาอีกก่อนครบเวลา จะนับใหม่ ทำให้ยิง API ครั้งเดียว
   */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 400);
  }, [refresh]);

  // โหลดครั้งแรกเมื่อผู้ใช้เป็นแพทย์
  useEffect(() => {
    if (!isDoctor) {
      setPatients([]);
      setRecordPatients([]);
      setSummary(null);
      setError(null);
      // ผู้ใช้ที่ไม่ใช่แพทย์จะไม่มีการยิง refresh เลย
      // ถ้าไม่ปิดตรงนี้ isInitialLoading จะค้างเป็น true ตลอดไป = หน้าโหลดหมุนไม่หยุด
      setIsInitialLoading(false);
      return;
    }
    void refresh();
  }, [isDoctor, refresh]);

  // รีเฟรชเมื่อมีความเคลื่อนไหวจากฝั่งอื่นของระบบ
  useEffect(() => {
    if (!isDoctor) return;

    const events = [
      'QUEUE_CREATED',
      'QUEUE_UPDATED',
      'VITALS_RECORDED',
      'VISIT_UPDATED',
      'VISIT_CREATED',
      'PATIENT_REGISTERED',
      'SCREENING_RECORDED',
      'STATUS_CHANGED',
      'QUEUE_CALLED'
    ];
    const unsubscribers = events.map((eventType) => subscribe(eventType, scheduleRefresh));

    // Polling fallback ทุก 4 วินาที เพื่อให้แน่ใจว่าคิวล่าสุดและสถิติอัปเดตเสมอ
    //
    // เคยลองยืดเป็น 12 วินาทีเพื่อลดภาระ connection pooler ของ Supabase
    // แต่ถอยกลับมาเพราะทำให้ข้อมูลบางจุดขึ้นช้าจนต้องรีหน้าเอง
    // ถ้าจะยืดอีกครั้ง ต้องแน่ใจก่อนว่า WebSocket ต่อติดจริงและครอบคลุมทุก event
    const pollInterval = setInterval(() => {
      void refresh();
    }, 4000);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      clearInterval(pollInterval);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isDoctor, subscribe, scheduleRefresh, refresh]);

  /**
   * ดึงผลการตรวจที่เคยบันทึกไว้ เมื่อแพทย์เปิดเคสใดเคสหนึ่ง
   *
   * คิวที่โหลดมาตอนแรกมีแค่ข้อมูลผู้ป่วยกับการคัดกรอง ยังไม่มีผลตรวจร่างกาย
   * และการวินิจฉัย จึงต้องยิง GET /visits/:id/examination เพิ่มตอนเปิดหน้าตรวจ
   * แล้วรวมผลลัพธ์เข้ากับ activeExamPatient เพื่อให้ฟอร์มขึ้นค่าที่บันทึกไว้
   */
  const hydrateExamination = useCallback(async (visitId: number) => {
    try {
      const detail = await examinationApi.get(visitId);
      setActiveExamPatient((prev) =>
        prev && prev.visitId === visitId ? applyExaminationDetail(prev, detail) : prev
      );
    } catch (err) {
      // ให้เปิดฟอร์มเปล่าต่อได้ ถ้าโหลดผลตรวจเดิมไม่สำเร็จ
      hydratedVisitRef.current = null;
      setSaveError(err instanceof Error ? err.message : 'ไม่สามารถโหลดผลการตรวจเดิมได้');
    }
  }, []);

  useEffect(() => {
    if (!isDoctor) return;

    const visitId = activeExamPatient?.visitId;
    if (!visitId) {
      hydratedVisitRef.current = null;
      setIsExamLoading(false);
      return;
    }
    if (hydratedVisitRef.current === visitId) return;

    hydratedVisitRef.current = visitId;
    setIsExamLoading(true);
    void hydrateExamination(visitId).finally(() => setIsExamLoading(false));
  }, [isDoctor, activeExamPatient?.visitId, hydrateExamination]);

  /** ดึงประวัติการมาตรวจย้อนหลัง เมื่อแพทย์เลือกผู้ป่วยในหน้าเวชระเบียน */
  useEffect(() => {
    if (!isDoctor) return;

    const patientId = selectedRecordPatient?.patientId;
    if (!patientId) {
      // ไม่มีรหัสผู้ป่วยจริง = ดึงประวัติย้อนหลังไม่ได้เลย
      //
      // เคยเจออาการ "ประวัติขึ้นแต่การวินิจฉัย นอกนั้นเป็น - หมด"
      // สาเหตุคือ pastVisits ว่าง หน้าจอเลยไปโชว์แถวที่ปั้นเองจากข้อมูลในหน่วยความจำ
      // ซึ่งมีแค่การวินิจฉัยกับสัญญาณชีพ (สองอย่างนี้มากับ /patient-records)
      // ส่วนยา แผนการรักษา ผลตรวจร่างกาย ต้องมาจาก endpoint ประวัติเท่านั้น
      if (selectedRecordPatient) {
        console.warn('[doctor] ผู้ป่วยที่เลือกไม่มี patientId จึงไม่ได้ดึงประวัติย้อนหลัง', selectedRecordPatient);
      }
      hydratedRecordRef.current = null;
      return;
    }

    const cacheKey = `${patientId}:${recordsRefreshKey}`;
    if (hydratedRecordRef.current === cacheKey) return;

    hydratedRecordRef.current = cacheKey;
    let cancelled = false;

    void examinationApi
      .getPatientVisits(patientId)
      .then((res) => {
        if (cancelled) return;
        const pastVisits = (res.history || []).map(mapPastVisit);
        setSelectedRecordPatient((prev) =>
          prev && prev.patientId === patientId ? { ...prev, pastVisits } : prev
        );
      })
      .catch((err) => {
        if (cancelled) return;
        // ไม่ขึ้นกล่องเตือนให้แพทย์ แต่ต้องเห็นใน console ไม่งั้นเงียบหายไปเลย
        // ของเดิมกลืน error ทิ้งทั้งก้อน เวลาประวัติไม่ขึ้นจึงไล่หาสาเหตุไม่ได้
        console.error('[doctor] ดึงประวัติย้อนหลังไม่สำเร็จ patientId=' + patientId, err);
        hydratedRecordRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [isDoctor, selectedRecordPatient?.patientId, recordsRefreshKey]);

  /**
   * ซิงก์ผู้ป่วยที่เลือกอยู่ในหน้าประวัติ ให้ตรงกับรายการล่าสุดที่โหลดมา
   *
   * selectedRecordPatient เป็นสำเนาที่ถ่ายไว้ตอนแพทย์กดเลือกผู้ป่วย
   * ถ้าไม่ซิงก์ ป้ายสถานะบนหัวการ์ด (รอตรวจ / กำลังตรวจ / ตรวจเสร็จแล้ว)
   * จะค้างเป็นค่าตอนที่กดเลือก ไม่เปลี่ยนแม้บันทึกผลตรวจไปแล้ว
   *
   * เก็บ pastVisits เดิมไว้ เพราะข้อมูลชุดนั้นมาจากอีก endpoint หนึ่ง
   * ซึ่ง recordPatients ไม่มีให้ ถ้าเขียนทับจะทำให้ประวัติย้อนหลังหายไปวาบหนึ่ง
   */
  useEffect(() => {
    if (!selectedRecordPatient) return;

    const fresh = recordPatients.find((p) => p.id === selectedRecordPatient.id);
    if (!fresh) return;
    if (fresh.status === selectedRecordPatient.status) return;

    setSelectedRecordPatient((prev) =>
      prev && prev.id === fresh.id ? { ...prev, status: fresh.status } : prev
    );
  }, [recordPatients, selectedRecordPatient]);

  /**
   * บันทึกผลตรวจของแพทย์ลงฐานข้อมูล
   *
   * ExaminationView เรียกฟังก์ชันนี้ 2 กรณี
   *   - กดบันทึกร่าง  -> status ที่ส่งมาเป็น 'Examining' => action 'draft'
   *   - กดปิดการตรวจ -> status ที่ส่งมาเป็น 'Completed' => action 'sign'
   *
   * อัปเดตหน้าจอทันทีก่อน (optimistic) แล้วค่อยยิง API
   * ถ้า backend ปฏิเสธ (เช่น ยังไม่ได้ระบุการวินิจฉัยหลักตอนปิดเคส)
   * จะแสดงข้อความผิดพลาด แล้วดึงข้อมูลจริงกลับมาทับ
   */
  const handleSavePatient = async (updatedPatient: Patient): Promise<boolean> => {
    setPatients((prev) => prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)));
    setActiveExamPatient((prev) => (prev?.id === updatedPatient.id ? updatedPatient : prev));

    if (!updatedPatient.visitId) {
      setSaveError('ผู้ป่วยรายนี้ยังไม่มีข้อมูลการเข้ารับบริการ จึงบันทึกผลตรวจไม่ได้');
      return false;
    }

    const action: 'draft' | 'sign' = updatedPatient.status === 'Completed' ? 'sign' : 'draft';
    const visitId = updatedPatient.visitId;
    const previousStatus = patients.find((p) => p.id === updatedPatient.id)?.status;

    setIsSaving(true);
    return examinationApi
      .save(visitId, buildExaminationRequest(updatedPatient, action))
      .then((result) => {
        // ยาที่จับคู่กับคลังของห้องยาไม่ได้ จะไม่ถูกส่งต่อไปห้องยา
        // ต้องบอกแพทย์ตรงนี้ ไม่งั้นจะเข้าใจว่าสั่งยาสำเร็จทั้งใบ
        const unmatched = result?.unmatched_medicines || [];
        setSaveError(
          unmatched.length > 0
            ? `ยาต่อไปนี้ไม่มีในคลังของห้องยา จึงยังไม่ถูกส่งต่อ: ${unmatched.join(', ')} — กรุณาแจ้งห้องยาให้เพิ่มยาเข้าคลัง หรือเลือกยาชื่ออื่นที่มีอยู่`
            : null
        );
        /**
         * ═══════════════════════════════════════════════════════════════════
         * ปิดกล่อง "กำลังบันทึก" ทันทีที่ฐานข้อมูลตอบว่าบันทึกสำเร็จ
         * ═══════════════════════════════════════════════════════════════════
         * เคยพลาดตรงนี้: โค้ดเดิมรอ API อีก 3 ตัวให้เสร็จก่อนถึงจะปิดกล่อง
         *   refresh()            โหลดคิวผู้ป่วยใหม่ทั้งหมด
         *   refreshRecords()     โหลดรายชื่อผู้ป่วยหน้าประวัติ (ช้าที่สุด)
         *   hydrateExamination() โหลดผลตรวจที่เพิ่งบันทึกกลับมาทับ
         *
         * แพทย์จึงต้องนั่งดูกล่อง "กำลังบันทึกลงฐานข้อมูล" ค้างอยู่
         * เป็นเวลาเท่ากับ บันทึก + คิว + รายชื่อผู้ป่วย + ผลตรวจ รวมกัน
         * ทั้งที่ข้อมูลถูกบันทึกลงฐานข้อมูลเรียบร้อยไปตั้งแต่ตัวแรกแล้ว
         *
         * ตัวที่ช้าที่สุดคือ refreshRecords ซึ่งเป็นรายชื่อผู้ป่วยของ "หน้าอื่น"
         * ไม่มีผลกับสิ่งที่แพทย์กำลังมองอยู่ตรงหน้าเลยแม้แต่นิดเดียว
         *
         * แยกให้ชัด: สิ่งที่แพทย์ต้องรอ = การบันทึกจริงเท่านั้น
         * ส่วนการโหลดข้อมูลชุดอื่นให้ตรงกับฐานข้อมูล ทำเบื้องหลังต่อไปได้
         * ═══════════════════════════════════════════════════════════════════
         */
        setIsSaving(false);

        // ดึงผลตรวจที่เพิ่งบันทึกกลับมาทับ เพื่อให้หน้าจอตรงกับฐานข้อมูลจริง
        //
        // ต้องรีเฟรชหน้าประวัติเวชระเบียนด้วย ไม่ใช่แค่หน้าคิว
        // เพราะสองหน้านี้ใช้ข้อมูลคนละชุดและมาจากคนละ endpoint
        // ถ้าเรียกแต่ refresh() หน้าประวัติจะค้างอยู่ที่ข้อมูลตอนเปิดหน้า
        // แพทย์บันทึกเสร็จแล้วสลับไปดูจะยังเห็น "ยังไม่ได้ระบุการวินิจฉัย" อยู่
        //
        // (refreshRecords ล้างแคชประวัติย้อนหลังให้เองแล้ว ไม่ต้องสั่งซ้ำตรงนี้
        //  ถ้าสั่งซ้ำจะยิง API ประวัติสองรอบทุกครั้งที่กดบันทึก)
        //
        // ไม่ใส่ await เพราะไม่ต้องการให้แพทย์รอ แต่ยังต้อง .catch ไว้
        // ไม่งั้นถ้าตัวใดตัวหนึ่งพลาดจะกลายเป็น unhandled promise rejection
        void Promise.all([
          refresh(),
          refreshRecords(),
          hydrateExamination(visitId),
        ]).catch(() => {
          // โหลดข้อมูลชุดอื่นไม่สำเร็จ ไม่ใช่เรื่องคอขาดบาดตาย
          // ผลการตรวจถูกบันทึกลงฐานข้อมูลไปแล้ว และ polling จะตามเก็บให้เอง
        });

        return true;
      })
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกผลการตรวจได้');
        // ถอยสถานะที่เผื่อไว้ล่วงหน้ากลับ เพราะ backend ไม่ได้บันทึกให้
        if (previousStatus) {
          setActiveExamPatient((prev) =>
            prev?.id === updatedPatient.id ? { ...prev, status: previousStatus } : prev
          );
        }
        return refresh().then(() => false);
      })
      .finally(() => {
        // เส้นทางสำเร็จปิดกล่องไปแล้วด้านบน ตรงนี้เป็นตาข่ายรองรับ
        // สำหรับกรณีที่บันทึกไม่ผ่าน จะได้ไม่มีทางที่กล่องจะค้างบนจอ
        setIsSaving(false);
      });
  };

  /**
   * เปลี่ยนสถานะคิวผู้ป่วย แล้วส่งไปบันทึกที่ backend
   *
   * อัปเดตหน้าจอก่อนทันที (optimistic) เพื่อไม่ให้ปุ่มหน่วง
   * ถ้า API ล้มเหลวจะดึงข้อมูลจริงกลับมาทับ พร้อมแสดงข้อความผิดพลาด
   */
  const handleUpdateStatus = (patientId: string, newStatus: QueueStatus, note?: string) => {
    const target = patients.find((p) => p.id === patientId);

    setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, status: newStatus } : p)));
    setActiveExamPatient((prev) => (prev?.id === patientId ? { ...prev, status: newStatus } : prev));

    if (!target?.visitId) {
      setError('ผู้ป่วยรายนี้ยังไม่มีข้อมูลการเข้ารับบริการ กรุณาให้พยาบาลคัดกรองก่อน');
      return;
    }

    void doctorApi
      .updateVisitStatus(target.visitId, newStatus, note)
      .then(() => {
        setError(null);
        // เหตุผลเดียวกับตอนบันทึกผลตรวจ หน้าประวัติต้องรู้ว่าสถานะเปลี่ยนแล้ว
        setRecordsRefreshKey((k) => k + 1);
        return Promise.all([refresh(), refreshRecords()]).then(() => undefined);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตสถานะได้');
        return refresh();
      });
  };

  return (
    <DoctorDataContext.Provider
      value={{
        patients,
        setPatients,
        activeExamPatient,
        setActiveExamPatient,
        selectedRecordPatient,
        setSelectedRecordPatient,
        statusFilter,
        setStatusFilter,
        recordPatients,
        isRecordsLoading,
        recordsError,
        refreshRecords,
        handleSavePatient,
        handleUpdateStatus,
        summary,
        isLoading,
        isInitialLoading,
        isSaving,
        isExamLoading,
        saveError,
        error,
        refresh,
      }}
    >
      <LanguageProvider>{children}</LanguageProvider>
    </DoctorDataContext.Provider>
  );
};

export const useDoctorData = (): DoctorDataContextType => {
  const ctx = useContext(DoctorDataContext);
  if (!ctx) {
    throw new Error('useDoctorData must be used within a DoctorDataProvider');
  }
  return ctx;
};
