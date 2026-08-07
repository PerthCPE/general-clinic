import React from 'react';
import type { ScreeningStats } from '../types';

interface ScreeningStatsBannerProps {
  stats: ScreeningStats;
}

export const ScreeningStatsBanner: React.FC<ScreeningStatsBannerProps> = ({ stats }) => {
  return (
    <div className="scr-stats-grid">
      {/* Card 1: Total Screenings */}
      <div className="scr-stat-card card-blue">
        <div className="scr-stat-icon-wrap blue-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="scr-stat-content">
          <span className="scr-stat-label">บันทึกคัดกรองทั้งหมด</span>
          <div className="scr-stat-val-row">
            <span className="scr-stat-value">{stats.totalRecords.toLocaleString()}</span>
            <span className="scr-stat-unit">ครั้ง</span>
          </div>
          <span className="scr-stat-sub">สะสมในฐานข้อมูล</span>
        </div>
      </div>

      {/* Card 2: This Month Visits */}
      <div className="scr-stat-card card-green">
        <div className="scr-stat-icon-wrap green-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="scr-stat-content">
          <span className="scr-stat-label">คัดกรองเดือนนี้</span>
          <div className="scr-stat-val-row">
            <span className="scr-stat-value">{stats.thisMonthRecords.toLocaleString()}</span>
            <span className="scr-stat-unit">ครั้ง</span>
          </div>
          <span className="scr-stat-badge green-badge">สิงหาคม 2026</span>
        </div>
      </div>

      {/* Card 3: High BP Alerts */}
      <div className="scr-stat-card card-orange">
        <div className="scr-stat-icon-wrap orange-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="scr-stat-content">
          <span className="scr-stat-label">กลุ่มความดันสูง (BP Alert)</span>
          <div className="scr-stat-val-row">
            <span className="scr-stat-value">{stats.highBPRatePercent}%</span>
            <span className="scr-stat-unit">ของทั้งหมด</span>
          </div>
          <span className="scr-stat-sub">ความดันตัวบน ≥ 140 mmHg</span>
        </div>
      </div>

      {/* Card 4: Urgent & Critical Triage */}
      <div className="scr-stat-card card-red">
        <div className="scr-stat-icon-wrap red-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="scr-stat-content">
          <span className="scr-stat-label">เคสฉุกเฉิน / เร่งด่วน</span>
          <div className="scr-stat-val-row">
            <span className="scr-stat-value">{stats.urgentTriageCount}</span>
            <span className="scr-stat-unit">ราย</span>
          </div>
          <span className="scr-stat-badge red-badge">ฉุกเฉิน / เร่งด่วน</span>
        </div>
      </div>
    </div>
  );
};
