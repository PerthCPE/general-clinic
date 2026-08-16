import React from 'react';
import { PatientRecordsView } from './components/PatientRecordsView';
import { useDoctorData } from './DoctorDataContext';
import type { Patient } from './types';

/** หน้าประวัติเวชระเบียนผู้ป่วยของแพทย์ */
interface DoctorRecordsPageProps {
  onNavigate: (page: string) => void;
}

const DoctorRecordsPage: React.FC<DoctorRecordsPageProps> = ({ onNavigate }) => {
  const { patients, selectedRecordPatient, setSelectedRecordPatient, setActiveExamPatient } = useDoctorData();

  const handleExamine = (patient: Patient) => {
    setActiveExamPatient(patient);
    onNavigate('doctor-examination');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <PatientRecordsView
        patients={patients}
        onExamine={handleExamine}
        selectedPatient={selectedRecordPatient}
        onSelectPatient={setSelectedRecordPatient}
      />
    </div>
  );
};

export default DoctorRecordsPage;
