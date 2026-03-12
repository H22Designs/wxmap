import type { AdminProviderStatus } from './api';

type RealtimeEnvelope = {
  event?: unknown;
  payload?: unknown;
};

type ConnectProviderStatusStreamArgs = {
  onProviderSync: (status: AdminProviderStatus) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

const reconnectDelayMs = 2_000;

function isAdminProviderStatus(input: unknown): input is AdminProviderStatus {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const value = input as Record<string, unknown>;

  const isStateValid =
    value.state === 'idle' ||
    value.state === 'running' ||
    value.state === 'ok' ||
    value.state === 'error';

  return (
    typeof value.provider === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.intervalMinutes === 'number' &&
    isStateValid &&
    (typeof value.lastSyncAt === 'string' || value.lastSyncAt === null) &&
    (typeof value.lastError === 'string' || value.lastError === null) &&
    (typeof value.nextSyncAt === 'string' || value.nextSyncAt === null)
  );
}

export function parseProviderSyncMessage(raw: string): AdminProviderStatus | null {
  try {
    const parsed = JSON.parse(raw) as RealtimeEnvelope;

    if (parsed.event !== 'collector.provider-sync') {
      return null;
    }

    return isAdminProviderStatus(parsed.payload) ? parsed.payload : null;
  } catch {
    return null;
  }
}

export function connectProviderStatusStream(args: ConnectProviderStatusStreamArgs): () => void {
  const wsUrl =
    (import.meta.env.VITE_WS_URL as string | undefined)?.trim() ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

  let socket: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: number | null = null;

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect(): void {
    if (stopped) {
      return;
    }

    clearReconnectTimer();

    reconnectTimer = window.setTimeout(() => {
      connect();
    }, reconnectDelayMs);
  }

  function connect(): void {
    if (stopped) {
      return;
    }

    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      args.onConnected?.();
    });

    socket.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      const status = parseProviderSyncMessage(raw);

      if (status) {
        args.onProviderSync(status);
      }
    });

    socket.addEventListener('close', () => {
      args.onDisconnected?.();
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  }

  connect();

  return () => {
    stopped = true;
    clearReconnectTimer();

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
      return;
    }

    if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };
}
