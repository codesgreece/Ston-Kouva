"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMatchRoomRealtime } from "@/hooks/useMatchRoomRealtime";
import { RoomComposer } from "@/components/chat/RoomComposer";
import { LiveBadge } from "@/components/ui/Badges";
import { isDisplayLive } from "@/lib/sports/status-mapper";

type Message = {
  id: string;
  content: string;
  message_type: string;
  created_at: string;
  deleted_at: string | null;
  username: string | null;
  display_name: string | null;
};

export function MatchRoomClient({
  matchId,
  roomId,
  header,
  initialMessages,
  initialMembers,
  userId,
  loggedIn,
}: {
  matchId: string;
  roomId: string;
  header: {
    homeFlag?: string | null;
    awayFlag?: string | null;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
    minute: number | null;
    status: string;
  };
  initialMessages: Message[];
  initialMembers: number;
  userId?: string | null;
  loggedIn: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const { online, connected, lastEvent, relayMessage, sendTyping } =
    useMatchRoomRealtime(roomId, userId);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "message" && lastEvent.payload) {
      const payload = lastEvent.payload as Message;
      setMessages((prev) =>
        prev.some((m) => m.id === payload.id) ? prev : [...prev, payload],
      );
    }
  }, [lastEvent]);

  // Poll messages every 8s as fallback / complement
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/messages?limit=100`);
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(
            data.messages.map(
              (m: Message & { created_at: string }) => ({
                ...m,
                created_at:
                  typeof m.created_at === "string"
                    ? m.created_at
                    : new Date(m.created_at).toISOString(),
              }),
            ),
          );
        }
      } catch {
        /* ignore */
      }
    }, connected ? 20_000 : 8_000);
    return () => clearInterval(t);
  }, [matchId, connected]);

  const people = online > 0 ? online : initialMembers;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col md:h-[calc(100dvh-6rem)]">
      <header className="shrink-0 rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/match/${matchId}`} className="text-xs text-muted hover:text-brand-2">
            ← Match
          </Link>
          {isDisplayLive(header.status as never) ? <LiveBadge /> : (
            <span className="text-xs uppercase text-muted">{header.status}</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {header.homeFlag} {header.home} — {header.away} {header.awayFlag}
            </p>
            <p className="text-xs text-muted">
              {header.homeScore} - {header.awayScore}
              {header.minute != null ? ` · ${header.minute}'` : ""}
              {connected ? " · realtime" : " · polling"}
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted">👥 {people} στον Κουβά</p>
        </div>
      </header>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-[#0c0c0c] p-3">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Ο Κουβάς είναι άδειος.</p>
        ) : (
          messages.map((msg) => {
            if (msg.deleted_at) {
              return (
                <div key={msg.id} className="text-xs italic text-muted">
                  Το μήνυμα διαγράφηκε.
                </div>
              );
            }
            if (msg.message_type !== "user") {
              return (
                <div
                  key={msg.id}
                  className="mx-auto max-w-[90%] rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-center text-sm font-medium text-brand-2 animate-fade-up"
                >
                  {msg.content}
                </div>
              );
            }
            return (
              <div key={msg.id} className="animate-fade-up flex gap-2">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-brand">
                  {(msg.display_name || msg.username || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-brand-2">
                      @{msg.username}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(msg.created_at).toLocaleTimeString("el-GR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-snug">
                    {msg.content}
                  </p>
                  <div className="mt-1 flex gap-2 text-[11px] text-muted">
                    <span>❤️</span>
                    <span>😂</span>
                    <span>🪣</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 shrink-0">
        <RoomComposer
          matchId={matchId}
          loggedIn={loggedIn}
          onSent={(msg) => {
            relayMessage(msg);
            sendTyping();
          }}
        />
      </div>
    </div>
  );
}
