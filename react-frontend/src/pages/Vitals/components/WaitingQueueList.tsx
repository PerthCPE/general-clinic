import React, { useState } from 'react';
import type { QueuePatientItem } from '../types';

interface WaitingQueueListProps {
  queueList: QueuePatientItem[];
  selectedQueueId: string | null;
  onSelectQueue: (patient: QueuePatientItem) => void;
}

export const WaitingQueueList: React.FC<WaitingQueueListProps> = ({
  queueList,
  selectedQueueId,
  onSelectQueue,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const waitingPatients = queueList.filter((p) => p.queueStatus === 'รอคัดกรอง');

  const filteredPatients = waitingPatients.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.queueNo.toLowerCase().includes(term) ||
      p.fullName.toLowerCase().includes(term) ||
      p.hn.toLowerCase().includes(term) ||
      p.nationalId.includes(term)
    );
  });

  return (
    <div className="vitals-widget-card queue-widget-card">
      <div className="vitals-widget-header">
        <div className="vitals-widget-title-wrap">
          <div className="vitals-widget-icon-box purple-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="vitals-widget-title">คิวรอคัดกรองด่วน</h3>
            <p className="vitals-widget-subtitle">Waiting Triage Queue</p>
          </div>
        </div>
        <span className="vitals-count-badge">{filteredPatients.length} คิว</span>
      </div>

      <div className="vitals-widget-body">
        {/* Search input */}
        <div className="queue-widget-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            className="queue-search-input"
            placeholder="ค้นหาชื่อ, เลขคิว, หรือ HN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="queue-search-clear" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        {/* Patient queue cards */}
        <div className="queue-quick-list">
          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => {
              const isSelected = selectedQueueId === patient.id;
              return (
                <div
                  key={patient.id}
                  className={`queue-quick-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectQueue(patient)}
                >
                  <div className="queue-quick-left">
                    <span className="queue-num-chip">{patient.queueNo}</span>
                    <div className="queue-patient-details">
                      <span className="queue-patient-name">{patient.fullName}</span>
                      <span className="queue-patient-sub">
                        {patient.hn} • {patient.gender}, {patient.age} ปี
                      </span>
                    </div>
                  </div>
                  <div className="queue-quick-right">
                    <span className="queue-time-tag">{patient.registeredTime}</span>
                    <button
                      type="button"
                      className={`queue-select-btn ${isSelected ? 'btn-selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectQueue(patient);
                      }}
                    >
                      {isSelected ? 'เลือกแล้ว' : 'เรียกคัดกรอง'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="queue-empty-notice">
              <span className="empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </span>
              <p>ไม่มีคิวรอคัดกรองในขณะนี้</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
