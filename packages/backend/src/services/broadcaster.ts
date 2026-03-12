import type { Server as HttpServer } from 'node:http';
import { WebSocketServer } from 'ws';

type BroadcastPayload = Record<string, unknown>;

type BroadcastEnvelope = {
  event: string;
  sentAt: string;
  payload: BroadcastPayload;
};

export class RealtimeBroadcaster {
  private readonly wsServer: WebSocketServer;

  constructor(server: HttpServer) {
    this.wsServer = new WebSocketServer({ server });

    this.wsServer.on('connection', (socket) => {
      socket.send(
        JSON.stringify({
          event: 'system.connected',
          sentAt: new Date().toISOString(),
          payload: {
            message: 'Connected to wxmap realtime stream'
          }
        } satisfies BroadcastEnvelope)
      );
    });
  }

  getClientCount(): number {
    return this.wsServer.clients.size;
  }

  broadcast(event: string, payload: BroadcastPayload): void {
    const envelope: BroadcastEnvelope = {
      event,
      sentAt: new Date().toISOString(),
      payload
    };

    const message = JSON.stringify(envelope);

    for (const client of this.wsServer.clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
  }

  close(): void {
    this.wsServer.close();
  }
}
