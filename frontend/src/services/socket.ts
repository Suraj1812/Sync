import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(token: string) {
  if (socket?.connected) return socket;
  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
