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
    const httpUrl = API_BASE_URL.replace(/\/$/, '');
    const wsProtocol = httpUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = httpUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${host}/ws`;
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

      ws.onmessage = (event) => {
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          setLastEvent(parsed);

          // Notify subscribers
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
        } catch {
          // non-json or ping/pong message
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
