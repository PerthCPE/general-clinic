import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  handleSavePatient: (updatedPatient: Patient) => void;
  handleUpdateStatus: (patientId: string, newStatus: QueueStatus) => void;

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
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [summary, setSummary] = useState<BackendDoctorQueueSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // true ระหว่างดึงผลตรวจเดิมของเคสที่เพิ่งเปิด (ครั้งแรกของแต่ละ visit)
  const [isExamLoading, setIsExamLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // กันการยิงซ้ำถี่ๆ เวลามี WebSocket event เข้ามาติดกันหลายตัว
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // จำ visit ที่ดึงผลตรวจมาแล้ว กันไม่ให้ effect ยิงซ้ำไม่รู้จบ
  // (เพราะ effect เองเป็นคนแก้ activeExamPatient)
  const hydratedVisitRef = useRef<number | null>(null);
  const hydratedRecordRef = useRef<number | null>(null);

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
      hydratedRecordRef.current = null;
      return;
    }
    if (hydratedRecordRef.current === patientId) return;

    hydratedRecordRef.current = patientId;
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
      .catch(() => {
        if (cancelled) return;
        // ไม่ต้องแจ้งเตือน แค่ไม่มีประวัติย้อนหลังให้ดู
        hydratedRecordRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [isDoctor, selectedRecordPatient?.patientId]);

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
  const handleSavePatient = (updatedPatient: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)));
    setActiveExamPatient((prev) => (prev?.id === updatedPatient.id ? updatedPatient : prev));

    if (!updatedPatient.visitId) {
      setSaveError('ผู้ป่วยรายนี้ยังไม่มีข้อมูลการเข้ารับบริการ จึงบันทึกผลตรวจไม่ได้');
      return;
    }

    const action: 'draft' | 'sign' = updatedPatient.status === 'Completed' ? 'sign' : 'draft';
    const visitId = updatedPatient.visitId;
    const previousStatus = patients.find((p) => p.id === updatedPatient.id)?.status;

    setIsSaving(true);
    void examinationApi
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
        // ดึงผลตรวจที่เพิ่งบันทึกกลับมาทับ เพื่อให้หน้าจอตรงกับฐานข้อมูลจริง
        return Promise.all([refresh(), hydrateExamination(visitId)]);
      })
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกผลการตรวจได้');
        // ถอยสถานะที่เผื่อไว้ล่วงหน้ากลับ เพราะ backend ไม่ได้บันทึกให้
        if (previousStatus) {
          setActiveExamPatient((prev) =>
            prev?.id === updatedPatient.id ? { ...prev, status: previousStatus } : prev
          );
        }
        return refresh();
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  /**
   * เปลี่ยนสถานะคิวผู้ป่วย แล้วส่งไปบันทึกที่ backend
   *
   * อัปเดตหน้าจอก่อนทันที (optimistic) เพื่อไม่ให้ปุ่มหน่วง
   * ถ้า API ล้มเหลวจะดึงข้อมูลจริงกลับมาทับ พร้อมแสดงข้อความผิดพลาด
   */
  const handleUpdateStatus = (patientId: string, newStatus: QueueStatus) => {
    const target = patients.find((p) => p.id === patientId);

    setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, status: newStatus } : p)));
    setActiveExamPatient((prev) => (prev?.id === patientId ? { ...prev, status: newStatus } : prev));

    if (!target?.visitId) {
      setError('ผู้ป่วยรายนี้ยังไม่มีข้อมูลการเข้ารับบริการ กรุณาให้พยาบาลคัดกรองก่อน');
      return;
    }

    void doctorApi
      .updateVisitStatus(target.visitId, newStatus)
      .then(() => {
        setError(null);
        return refresh();
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
