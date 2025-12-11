import { useEffect, useRef, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

type WebSocketMessage = {
  type: string;
  data: any;
  timestamp: string;
};

export function useRealtimeUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('[WebSocket] Connecting to', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Received:', message.type);
          
          if (message.type === 'referral_updated') {
            const updatedReferral = message.data;
            
            // Update analyst referrals cache surgically
            queryClient.setQueryData<any[]>(["/api/analyst/referrals"], (oldData) => {
              if (!oldData) return oldData;
              return oldData.map((ref) => 
                ref.id === updatedReferral.id ? updatedReferral : ref
              );
            });
            
            // Update admin referrals cache surgically
            queryClient.setQueryData<any[]>(["/api/admin/referrals"], (oldData) => {
              if (!oldData) return oldData;
              return oldData.map((ref) => 
                ref.id === updatedReferral.id ? updatedReferral : ref
              );
            });
            
            // Invalidate stats queries (they need recalculation)
            queryClient.invalidateQueries({ queryKey: ["/api/analyst/stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
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
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
