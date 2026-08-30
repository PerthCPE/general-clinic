import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for auto-saving form state to localStorage and recovering drafts
 * @param storageKey Unique key for this form's draft in localStorage
 * @param initialData Initial default state of the form
 * @param debounceMs Debounce save interval in milliseconds (default 500ms)
 */
export function useFormDraft<T>(
  storageKey: string,
  initialData: T,
  debounceMs: number = 500
) {
  const [formData, setFormData] = useState<T>(initialData);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data) {
          // Check if data is not identical to initial data
          const isNonEmpty = Object.values(parsed.data).some(
            (val) => val !== '' && val !== null && val !== undefined && val !== 0
          );
          if (isNonEmpty) {
            setHasDraft(true);
            setDraftTimestamp(parsed.savedAt || 'ล่าสุด');
          }
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }, [storageKey]);

  // Save to localStorage whenever formData changes (debounced)
  const saveDraft = useCallback(
    (dataToSave: T) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        try {
          // Only save if there is meaningful content
          const isNonEmpty = Object.values(dataToSave as Record<string, unknown>).some(
            (val) => val !== '' && val !== null && val !== undefined && val !== 0
          );

          if (isNonEmpty) {
            const payload = {
              data: dataToSave,
              savedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
            };
            localStorage.setItem(storageKey, JSON.stringify(payload));
          }
        } catch {
          // ignore quota error
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  // Restore draft function
  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data) {
          setFormData(parsed.data);
          setHasDraft(false);
          return parsed.data as T;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }, [storageKey]);

  // Clear draft function
  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
    setDraftTimestamp(null);
  }, [storageKey]);

  return {
    formData,
    setFormData,
    hasDraft,
    draftTimestamp,
    saveDraft,
    restoreDraft,
    clearDraft,
  };
}
