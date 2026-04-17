import { useEffect, useRef } from 'react';
import { SSEUpdate } from '../types/pipeline';

export function useSSE(runId: string | null, onMessage: (update: SSEUpdate) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!runId) return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      es?.close();
      es = new EventSource(`/pipeline/${runId}/status`);

      es.onmessage = (e) => {
        try {
          const update: SSEUpdate = JSON.parse(e.data);
          onMessageRef.current(update);
        } catch {
          console.error('[SSE] Failed to parse message:', e.data);
        }
      };

      es.onerror = () => {
        es?.close();
        if (!cancelled) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [runId]);
}
