import React from 'react';
import { ScheduleView } from './components/ScheduleView';

/** หน้าตารางเวรของแพทย์ (ScheduleView จัดการ state ภายในตัวเองอยู่แล้ว) */
const DoctorSchedulePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <ScheduleView />
    </div>
  );
};

export default DoctorSchedulePage;
