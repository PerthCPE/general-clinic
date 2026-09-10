import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '../services/api';

export interface WebSocketEvent<T = unknown> {
  type: 'QUEUE_CREATED' | 'QUEUE_UPDATED' | 'PATIENT_REGISTERED' | 'VITALS_RECORDED' | 'ELIGIBILITY_SAVED' | string;
  timestamp: number;
  data?: T;
}

type EventCallback<T = unknown> = (data?: T) => void;

interface WebSocketContextType {
  isConnected: boolean;
  lastEvent: WebSocketEvent | null;
  subscribe: <T = unknown>(eventType: string, callback: EventCallback<T>) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastEvent: null,
  subscribe: () => () => {},
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getWsUrl = () => {
    const toWs = (httpUrl: string) => {
      const clean = httpUrl.replace(/\/$/, '');
      const wsProtocol = clean.startsWith('https') ? 'wss:' : 'ws:';
      return `${clean.replace(/^https?:\/\//, `${wsProtocol}//`)}/ws`;
    };

    // 1. ถ้ากำหนด API_BASE_URL ไว้ชัดเจน ใช้อันนั้น
    if (API_BASE_URL) return toWs(API_BASE_URL);

    // 2. API_BASE_URL ว่าง (เรียก REST ผ่าน relative /api ให้ Vite proxy) —
    //    แต่ Vite proxy ไม่ครอบ /ws จึงต้องต่อ WebSocket ตรงไปที่ backend เอง
    const envTarget =
      (import.meta.env.VITE_API_TARGET as string | undefined) ||
      (import.meta.env.VITE_API_URL as string | undefined);
    if (envTarget) return toWs(envTarget);

    // 3. สุดท้าย: เดาจาก host ปัจจุบัน + พอร์ต backend dev มาตรฐาน 8080
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.hostname}:8080/ws`;
  };

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      const dispatchEvent = (parsed: WebSocketEvent) => {
        setLastEvent(parsed);
        const callbacks = subscribersRef.current.get(parsed.type);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try {
              cb(parsed.data);
            } catch (e) {
              console.error(`Error in WebSocket subscriber for ${parsed.type}:`, e);
            }
          });
        }
      };

      ws.onmessage = (event) => {
        // ฝั่ง Go (writePump) รวมหลาย event เป็นเฟรมเดียวคั่นด้วย '\n' เวลา broadcast ถี่ ๆ
        // (เช่น ตอนจ่ายยาจะยิง DISPENSE_RECORDED + BILLING_CREATED + QUEUE_UPDATED ติดกัน)
        // ถ้า JSON.parse ทั้งก้อนจะ throw แล้ว event หายทั้งเฟรม — ต้องแยกทีละบรรทัดก่อน parse
        const raw = typeof event.data === 'string' ? event.data : '';
        if (!raw) return;

        const lines = raw.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed[0] !== '{') continue; // ข้าม ping/pong หรือบรรทัดว่าง
          try {
            dispatchEvent(JSON.parse(trimmed) as WebSocketEvent);
          } catch (e) {
            console.warn('[ws] failed to parse event line:', trimmed, e);
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // ignore connection error on initial load
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback(<T = unknown,>(eventType: string, callback: EventCallback<T>) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    const set = subscribersRef.current.get(eventType)!;
    set.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      set.delete(callback as EventCallback);
      if (set.size === 0) {
        subscribersRef.current.delete(eventType);
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastEvent, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
