import axios from 'axios';
import type { Conversation, Message, User } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sync_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type AuthResponse = {
  user: User;
  token: string;
};

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((res) => res.data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data).then((res) => res.data),
  me: () => api.get<User>('/auth/me').then((res) => res.data),
};

export const userApi = {
  search: (q: string) => api.get<User[]>('/users/search', { params: { q } }).then((res) => res.data),
  updateMe: (data: Partial<Pick<User, 'name' | 'avatar' | 'status'>>) =>
    api.patch<User>('/users/me', data).then((res) => res.data),
};

export const chatApi = {
  conversations: () => api.get<Conversation[]>('/chat/conversations').then((res) => res.data),
  startConversation: (userId: string) =>
    api.post<Conversation>('/chat/conversations', { userId }).then((res) => res.data),
  messages: (conversationId: string) =>
    api.get<Message[]>(`/chat/conversations/${conversationId}/messages`).then((res) => res.data),
};
