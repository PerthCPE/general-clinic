import React, { useState, useEffect, useMemo } from 'react';
import './Pagination.css';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  showJumpInput?: boolean;
  showItemCount?: boolean;
}

export type PageSlot = number | 'ellipsis';

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = '',
  showJumpInput = true,
  showItemCount = true,
}) => {
  // Local state for the jump input field
  const [inputVal, setInputVal] = useState<string>(String(currentPage));

  // Mobile viewport detection (< 640px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(max-width: 640px)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Safe clamped current page
  const safeCurrentPage = useMemo(() => {
    if (totalPages <= 0) return 1;
    return Math.max(1, Math.min(currentPage, totalPages));
  }, [currentPage, totalPages]);

  // Sync input value when safeCurrentPage changes
  useEffect(() => {
    setInputVal(String(safeCurrentPage));
  }, [safeCurrentPage]);

  // Compute 5-slot (desktop) or 3-slot (mobile) truncated pagination
  const pageSlots = useMemo<PageSlot[]>(() => {
    if (totalPages <= 0) return [];

    // Responsive mobile view (< 640px): 3 slots (1 … curr … last)
    if (isMobile) {
      if (totalPages <= 3) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      if (safeCurrentPage === 1) {
        return [1, 'ellipsis', totalPages];
      }
      if (safeCurrentPage === totalPages) {
        return [1, 'ellipsis', totalPages];
      }
      return [1, safeCurrentPage, totalPages];
    }

    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // 5-slot sliding window logic
    if (safeCurrentPage <= 3) {
      // e.g. [1, 2, 3, 'ellipsis', 27]
      return [1, 2, 3, 'ellipsis', totalPages];
    }

    if (safeCurrentPage >= totalPages - 2) {
      // e.g. [1, 'ellipsis', 25, 26, 27]
      return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
    }

    // e.g. [1, 'ellipsis', 14, 'ellipsis', 27]
    return [1, 'ellipsis', safeCurrentPage, 'ellipsis', totalPages];
  }, [safeCurrentPage, totalPages, isMobile]);

  // Handle Jump Input Commit (Enter / Blur)
  const handleCommitJump = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || !/^-?\d+$/.test(trimmed)) {
      // Non-numeric or empty: Revert to current page
      setInputVal(String(currentPage));
      return;
    }

    const num = parseInt(trimmed, 10);
    if (isNaN(num)) {
      setInputVal(String(currentPage));
      return;
    }

    if (num <= 0) {
      // 0 or negative -> clamp to 1
      onPageChange(1);
      setInputVal('1');
    } else if (num > totalPages) {
      // > totalPages -> clamp to totalPages
      onPageChange(totalPages);
      setInputVal(String(totalPages));
    } else {
      // Valid page
      onPageChange(num);
      setInputVal(String(num));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitJump();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputVal(String(currentPage));
      (e.target as HTMLInputElement).blur();
    }
  };

  // Edge case 2: 0 items -> hide pagination
  if (totalItems <= 0 || totalPages <= 0) {
    return null;
  }

  // Calculate items range
  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Edge case 3: totalPages === 1 -> show only summary text
  if (totalPages === 1) {
    return (
      <div className={`modern-pagination-container single-page-only ${className}`}>
        {showItemCount && (
          <div className="pagination-item-count" aria-live="polite">
            {startItem}-{endItem} จาก {totalItems} รายการ
          </div>
        )}
      </div>
    );
  }

  return (
    <nav className={`modern-pagination-container ${className}`} aria-label="การแบ่งหน้า">
      {/* Left Item Range Summary */}
      {showItemCount && (
        <div className="pagination-item-count" aria-live="polite">
          {startItem}-{endItem} จาก {totalItems} รายการ
        </div>
      )}

      {/* Right Controls Group */}
      <div className="pagination-controls-group">
        {/* Previous Button */}
        <button
          type="button"
          className="pagination-btn pagination-nav-btn pagination-prev"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          aria-label="ย้อนกลับไปหน้าก่อนหน้า"
        >
          <svg
            className="pagination-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="pagination-btn-label">ย้อนกลับ</span>
        </button>

        {/* Numbered Page Slots */}
        <div className="pagination-slots-wrap">
          {pageSlots.map((slot, index) => {
            if (slot === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="pagination-ellipsis"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isCurrent = slot === currentPage;
            return (
              <button
                key={`page-${slot}`}
                type="button"
                className={`pagination-btn pagination-slot-btn ${isCurrent ? 'active' : ''}`}
                onClick={() => onPageChange(slot)}
                aria-label={`ไปหน้า ${slot}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {slot}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          className="pagination-btn pagination-nav-btn pagination-next"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          aria-label="ถัดไปหน้าต่อไป"
        >
          <span className="pagination-btn-label">ถัดไป</span>
          <svg
            className="pagination-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Page Jump Input (Task B: Hidden when totalPages <= 5) */}
        {showJumpInput && totalPages > 5 && (
          <div className="pagination-jump-wrap">
            <span className="pagination-jump-label">ไปหน้า</span>
            <input
              type="text"
              inputMode="numeric"
              className="pagination-jump-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={handleCommitJump}
              onKeyDown={handleKeyDown}
              aria-label={`ไปหน้าระหว่าง 1 ถึง ${totalPages}`}
            />
            <span className="pagination-jump-total">/ {totalPages}</span>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Pagination;
