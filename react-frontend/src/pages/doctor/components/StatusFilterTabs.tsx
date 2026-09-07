import React from 'react';

/**
 * ==============================================================================
 * แถบกรองสถานะผู้ป่วย (ใช้ร่วมกันทุกหน้าของ Role แพทย์)
 * ==============================================================================
 * เดิมหน้าคิวกับหน้าประวัติเวชระเบียนต่างคนต่างเขียนแถบกรองของตัวเอง
 * หน้าตาจึงไม่เหมือนกัน (คนละลำดับปุ่ม คนละสีตอนถูกเลือก หน้าหนึ่งมีตัวเลข
 * อีกหน้าไม่มี) พอผู้ใช้สลับไปมาระหว่างสองหน้าจะรู้สึกเหมือนคนละระบบ
 *
 * ย้ายมาไว้ที่เดียว หน้าไหนจะใช้ก็ส่งแค่รายการตัวเลือกเข้ามา
 * แก้ดีไซน์ครั้งเดียวมีผลทุกหน้า และไม่มีทางเพี้ยนจากกันอีก
 *
 * ลำดับปุ่มมาตรฐาน: ทั้งหมด -> รอตรวจ -> กำลังตรวจ -> ตรวจเสร็จแล้ว
 * เรียงตามลำดับการเดินของคิวจริง ไม่ใช่ตามความถี่ในการใช้งาน
 */

export interface StatusFilterOption {
  /** ค่าที่ส่งกลับไปให้หน้าเจ้าของเมื่อถูกเลือก */
  value: string;
  /** ข้อความบนปุ่ม (หน้าเจ้าของแปลภาษามาให้แล้ว) */
  label: string;
  /** จำนวนผู้ป่วยในสถานะนั้น ไม่ส่งมาก็ได้ ปุ่มจะไม่มีตัวเลขห้อย */
  count?: number;

  /** ไอคอนหน้าข้อความ ไม่ส่งมาก็ได้
   *  ใช้ในหน้าที่ปุ่มเป็นการสลับ "มุมมอง" (เช่น ตารางเวร รายเดือน/รายสัปดาห์)
   *  ซึ่งไม่มีจำนวนให้นับ แต่ไอคอนช่วยให้แยกออกเร็วกว่าอ่านข้อความ */
  icon?: React.ReactNode;
}

interface StatusFilterTabsProps {
  options: StatusFilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const StatusFilterTabs: React.FC<StatusFilterTabsProps> = ({
  options,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div
      role="group"
      className={`flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold self-start sm:self-auto shrink-0 ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              isActive
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            {option.icon}
            <span>{option.label}</span>

            {option.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono leading-none ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
