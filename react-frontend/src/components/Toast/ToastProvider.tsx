import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Toast, type ToastItem, type ToastType } from './Toast';
import './Toast.css';

export interface ShowToastOptions {
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback((options: ShowToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = {
      id,
      type: options.type,
      message: options.message,
      duration: options.duration,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  React.useEffect(() => {
    (window as any).__showToast = showToast;
    (window as any).__clearAllToasts = clearAllToasts;
    return () => {
      delete (window as any).__showToast;
      delete (window as any).__clearAllToasts;
    };
  }, [showToast, clearAllToasts]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearAllToasts }}>
      {children}
      <div className="global-toast-container" aria-label="Notifications">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
