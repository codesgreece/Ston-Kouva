/**
 * In-process realtime hub used by the dedicated WS server
 * and optionally by API routes (broadcast after writes).
 */

export type RealtimeEvent = {
  type: string;
  roomId?: string;
  payload: unknown;
  at: string;
};

type Client = {
  id: string;
  roomId: string | null;
  userId: string | null;
  send: (data: string) => void;
};

class RealtimeHub {
  private clients = new Map<string, Client>();
  private roomMembers = new Map<string, Set<string>>();

  addClient(client: Client) {
    this.clients.set(client.id, client);
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (client.roomId) {
      this.leaveRoom(clientId, client.roomId);
    }
    this.clients.delete(clientId);
  }

  joinRoom(clientId: string, roomId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (client.roomId && client.roomId !== roomId) {
      this.leaveRoom(clientId, client.roomId);
    }
    client.roomId = roomId;
    if (!this.roomMembers.has(roomId)) this.roomMembers.set(roomId, new Set());
    this.roomMembers.get(roomId)!.add(clientId);
    this.broadcast(roomId, {
      type: "presence",
      roomId,
      payload: { online: this.onlineCount(roomId) },
      at: new Date().toISOString(),
    });
  }

  leaveRoom(clientId: string, roomId: string) {
    this.roomMembers.get(roomId)?.delete(clientId);
    const client = this.clients.get(clientId);
    if (client?.roomId === roomId) client.roomId = null;
    this.broadcast(roomId, {
      type: "presence",
      roomId,
      payload: { online: this.onlineCount(roomId) },
      at: new Date().toISOString(),
    });
  }

  onlineCount(roomId: string): number {
    return this.roomMembers.get(roomId)?.size ?? 0;
  }

  broadcast(roomId: string, event: RealtimeEvent) {
    const members = this.roomMembers.get(roomId);
    if (!members) return;
    const data = JSON.stringify(event);
    for (const id of members) {
      this.clients.get(id)?.send(data);
    }
  }

  publish(event: RealtimeEvent) {
    if (event.roomId) {
      this.broadcast(event.roomId, event);
      return;
    }
    const data = JSON.stringify(event);
    for (const client of this.clients.values()) {
      client.send(data);
    }
  }
}

export const realtimeHub = new RealtimeHub();
