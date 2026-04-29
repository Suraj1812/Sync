import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

let socket: Socket | null = null;

export function getSocket(token: string) {
  if (socket?.connected) return socket;
  socket = io(API_URL || window.location.origin, {
    auth: { token },
    reconnectionAttempts: 8,
    reconnectionDelayMax: 3000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
