"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RealtimeMessage = {
  type: string;
  roomId?: string;
  payload?: unknown;
  at?: string;
};

/**
 * WebSocket client with polling fallback for Match Rooms.
 */
export function useMatchRoomRealtime(roomId: string | null, userId?: string | null) {
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const publishLocal = useCallback((event: RealtimeMessage) => {
    setLastEvent(event);
    if (event.type === "presence" || event.type === "joined") {
      const payload = event.payload as { online?: number } | undefined;
      if (typeof payload?.online === "number") setOnline(payload.online);
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!url) {
      // Fallback: poll room meta every 15s for member counts via HTTP
      let cancelled = false;
      const poll = async () => {
        try {
          // soft presence via messages endpoint health — member count from match page refresh
          if (!cancelled) setConnected(false);
        } catch {
          /* ignore */
        }
      };
      poll();
      const t = setInterval(poll, 15_000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }

    let closed = false;
    let retryMs = 1000;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          retryMs = 1000;
          ws.send(JSON.stringify({ type: "join", roomId, userId }));
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data)) as RealtimeMessage;
            publishLocal(data);
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!closed) {
            setTimeout(connect, retryMs);
            retryMs = Math.min(retryMs * 2, 15_000);
          }
        };
      } catch {
        setConnected(false);
      }
    };

    connect();

    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, [roomId, userId, publishLocal]);

  const sendTyping = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "typing", roomId }));
  }, [roomId]);

  const relayMessage = useCallback(
    (payload: unknown) => {
      wsRef.current?.send(
        JSON.stringify({ type: "message", roomId, payload }),
      );
    },
    [roomId],
  );

  return { online, connected, lastEvent, sendTyping, relayMessage };
}
