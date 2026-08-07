import React, { useState, useMemo } from 'react';
import { StatCard } from '../../components/clinicms/StatCard';
import { QueueTable } from '../../components/clinicms/QueueTable';
import { ExamineModal } from '../../components/clinicms/ExamineModal';
import { AddPatientModal } from '../../components/clinicms/AddPatientModal';
import { PatientRecordsView } from '../../components/clinicms/PatientRecordsView';
import { ScheduleView } from '../../components/clinicms/ScheduleView';
import { ReportsView } from '../../components/clinicms/ReportsView';
import { ExaminationView } from '../../components/clinicms/ExaminationView';
import { SettingsModal } from '../../components/clinicms/SettingsModal';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';
import './DoctorClinicSystem.css';

import { Patient, QueueStatus } from '../../types';
import { INITIAL_PATIENTS } from '../../data/initialData';
import { generateVN } from '../../utils/vnGenerator';
import { matchPatientSearch } from '../../utils/searchUtils';

interface DoctorClinicSystemProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

function MainDoctorApp({ activePage, onNavigate }: DoctorClinicSystemProps) {
  const { t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [searchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Selected Patient for Examination
  const [activeExamPatient, setActiveExamPatient] = useState<Patient | null>(INITIAL_PATIENTS[0]);
  const [selectedRecordPatient, setSelectedRecordPatient] = useState<Patient | null>(null);
  const [examiningPatientModal, setExaminingPatientModal] = useState<Patient | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Derived counts
  const totalToday = useMemo(() => patients.length + 18, [patients]);
  const currentlyWaiting = useMemo(() => patients.filter(p => p.status === 'Waiting').length + 5, [patients]);
  const completedVisits = useMemo(() => patients.filter(p => p.status === 'Completed').length + 13, [patients]);

  // Filtered patients list for current table/search
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch = matchPatientSearch(patient, searchQuery);
      const matchesStatus = statusFilter === 'All' || patient.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [patients, searchQuery, statusFilter]);

  // Open Examination Page for selected patient
  const handleStartExamination = (patient: Patient) => {
    setActiveExamPatient(patient);
    onNavigate('examination');
  };

  // Handle Save Patient Examination
  const handleSavePatient = (updatedPatient: Patient) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p))
    );
    if (activeExamPatient?.id === updatedPatient.id) {
      setActiveExamPatient(updatedPatient);
    }
  };

  // Handle Quick Status Update
  const handleUpdateStatus = (patientId: string, newStatus: QueueStatus) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, status: newStatus } : p))
    );
  };

  // Handle Add New Patient
  const handleAddPatient = (newPatientData: Omit<Patient, 'id'>) => {
    const newPatient: Patient = {
      ...newPatientData,
      id: `p-${Date.now()}`
    };
    setPatients((prev) => [newPatient, ...prev]);
  };

  // Auto-generate next numbers
  const nextQueueNo = String(patients.length + 1).padStart(3, '0');
  const nextHN = `${10234 + patients.length}`;
  const nextVN = generateVN(undefined, undefined, patients.length + 1);

  // Currently active patient for examination view
  const currentExamPatient = activeExamPatient || patients[0];

  return (
    <div className="doctor-system-container">
      {/* 1. DASHBOARD VIEW */}
      {activePage === 'dashboard' && (
        <div className="doctor-dashboard-layout animate-in fade-in duration-150">
          {/* Quick Stats Section */}
          <section>
            <h1 className="doctor-section-title">
              {t('quickStats')}
            </h1>

            <div className="doctor-stats-grid">
              <StatCard
                title={t('totalPatientsToday')}
                value={totalToday}
                iconType="users"
                activeFilter={statusFilter === 'All' ? 'All' : undefined}
                onClick={() => setStatusFilter('All')}
              />
              <StatCard
                title={t('currentlyWaiting')}
                value={currentlyWaiting}
                iconType="clock"
                activeFilter={statusFilter === 'Waiting' ? 'Waiting' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'Waiting' ? 'All' : 'Waiting')}
              />
              <StatCard
                title={t('completedVisits')}
                value={completedVisits}
                iconType="check"
                activeFilter={statusFilter === 'Completed' ? 'Completed' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
              />
            </div>
          </section>

          {/* Today's Queue Section */}
          <section>
            <QueueTable
              patients={filteredPatients}
              onExamine={handleStartExamination}
              onUpdateStatus={handleUpdateStatus}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
            />
          </section>

          {/* Integrated Reports & Analytics Section */}
          <section>
            <ReportsView />
          </section>
        </div>
      )}

      {/* 2. PATIENT QUEUE VIEW */}
      {activePage === 'queue' && (
        <div className="doctor-dashboard-layout animate-in fade-in duration-150">
          <section>
            <h1 className="doctor-section-title">
              {t('quickStats')}
            </h1>

            <div className="doctor-stats-grid">
              <StatCard
                title={t('totalPatientsToday')}
                value={totalToday}
                iconType="users"
                activeFilter={statusFilter === 'All' ? 'All' : undefined}
                onClick={() => setStatusFilter('All')}
              />
              <StatCard
                title={t('currentlyWaiting')}
                value={currentlyWaiting}
                iconType="clock"
                activeFilter={statusFilter === 'Waiting' ? 'Waiting' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'Waiting' ? 'All' : 'Waiting')}
              />
              <StatCard
                title={t('completedVisits')}
                value={completedVisits}
                iconType="check"
                activeFilter={statusFilter === 'Completed' ? 'Completed' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
              />
            </div>
          </section>

          <section>
            <QueueTable
              patients={filteredPatients}
              onExamine={handleStartExamination}
              onUpdateStatus={handleUpdateStatus}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
            />
          </section>
        </div>
      )}

      {/* 3. FULL PATIENT EXAMINATION MODULE */}
      {activePage === 'examination' && (
        <div className="animate-in fade-in duration-150">
          <ExaminationView
            patient={currentExamPatient}
            onBackToQueue={() => onNavigate('queue')}
            onSavePatient={handleSavePatient}
          />
        </div>
      )}

      {/* 4. PATIENT RECORDS VIEW */}
      {activePage === 'records' && (
        <div className="animate-in fade-in duration-150">
          <PatientRecordsView
            patients={patients}
            onExamine={handleStartExamination}
            selectedPatient={selectedRecordPatient}
            onSelectPatient={setSelectedRecordPatient}
          />
        </div>
      )}

      {/* 5. SCHEDULE VIEW */}
      {activePage === 'schedule' && (
        <div className="animate-in fade-in duration-150">
          <ScheduleView />
        </div>
      )}

      {/* Examine Patient Quick Modal */}
      <ExamineModal
        patient={examiningPatientModal}
        onClose={() => setExaminingPatientModal(null)}
        onSave={handleSavePatient}
      />

      {/* Add New Queue Patient Modal */}
      <AddPatientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddPatient}
        nextQueueNo={nextQueueNo}
        nextHN={nextHN}
        nextVN={nextVN}
      />

      {/* System Settings & Language Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default function DoctorClinicSystem({ activePage, onNavigate }: DoctorClinicSystemProps) {
  return (
    <LanguageProvider>
      <MainDoctorApp activePage={activePage} onNavigate={onNavigate} />
    </LanguageProvider>
  );
}
