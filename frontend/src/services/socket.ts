import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

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
