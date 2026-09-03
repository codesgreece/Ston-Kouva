/**
 * Dedicated WebSocket realtime server for Match Rooms.
 * Run separately from Next.js: npm run realtime
 *
 * Protocol (JSON):
 *  client → { type: 'join', roomId, userId?, token? }
 *  client → { type: 'leave' }
 *  client → { type: 'typing', roomId }
 *  client → { type: 'ping' }
 *  server → { type, roomId?, payload, at }
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { realtimeHub } from "../src/lib/realtime/hub";

const PORT = Number(process.env.REALTIME_PORT || 4001);

type ClientState = {
  id: string;
  roomId: string | null;
  userId: string | null;
};

const states = new WeakMap<WebSocket, ClientState>();

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "ston-kouva-realtime" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  const id = randomUUID();
  const state: ClientState = { id, roomId: null, userId: null };
  states.set(socket, state);

  realtimeHub.addClient({
    id,
    roomId: null,
    userId: null,
    send: (data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    },
  });

  socket.send(
    JSON.stringify({
      type: "hello",
      payload: { clientId: id },
      at: new Date().toISOString(),
    }),
  );

  socket.on("message", (raw) => {
    let msg: { type?: string; roomId?: string; userId?: string; payload?: unknown };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", at: new Date().toISOString() }));
      return;
    }

    if (msg.type === "join" && msg.roomId) {
      state.userId = msg.userId || null;
      realtimeHub.joinRoom(id, msg.roomId);
      state.roomId = msg.roomId;
      socket.send(
        JSON.stringify({
          type: "joined",
          roomId: msg.roomId,
          payload: { online: realtimeHub.onlineCount(msg.roomId) },
          at: new Date().toISOString(),
        }),
      );
      return;
    }

    if (msg.type === "leave" && state.roomId) {
      realtimeHub.leaveRoom(id, state.roomId);
      state.roomId = null;
      return;
    }

    if (msg.type === "typing" && state.roomId) {
      realtimeHub.broadcast(state.roomId, {
        type: "typing",
        roomId: state.roomId,
        payload: { userId: state.userId },
        at: new Date().toISOString(),
      });
      return;
    }

    if (msg.type === "message" && state.roomId) {
      // Messages are persisted via Next API; this relays for instant UX when clients publish
      realtimeHub.broadcast(state.roomId, {
        type: "message",
        roomId: state.roomId,
        payload: msg.payload,
        at: new Date().toISOString(),
      });
    }
  });

  socket.on("close", () => {
    realtimeHub.removeClient(id);
  });
});

server.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT}`);
});
