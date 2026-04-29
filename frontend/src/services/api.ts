import axios, { AxiosHeaders } from 'axios';
import type { Conversation, DeletedMessagePayload, DeleteMessageScope, Message, User } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const retryableMethods = new Set(['get', 'head', 'options']);

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sync_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const config = error.config;
    const status = error.response?.status;
    const method = config?.method?.toLowerCase();
    const retryCount = Number(config?.headers?.get?.('x-sync-retry') ?? 0);

    if (status === 401) {
      localStorage.removeItem('sync_token');
      window.dispatchEvent(new window.Event('sync:unauthorized'));
    }

    if (!status && config && method && retryableMethods.has(method) && retryCount < 1) {
      config.headers = AxiosHeaders.from(config.headers);
      config.headers.set('x-sync-retry', String(retryCount + 1));
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      return api(config);
    }

    return Promise.reject(error);
  },
);

export type AuthResponse = {
  user: User;
  token: string;
};

export const authApi = {
  register: (data: { name: string; email: string; password: string; avatar?: string }) =>
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
  sendMessage: (conversationId: string, content: string) =>
    api.post<Message>(`/chat/conversations/${conversationId}/messages`, { content }).then((res) => res.data),
  editMessage: (messageId: string, content: string) =>
    api.patch<Message>(`/chat/messages/${messageId}`, { content }).then((res) => res.data),
  deleteMessage: (messageId: string, scope: DeleteMessageScope = 'everyone') =>
    api.delete<DeletedMessagePayload>(`/chat/messages/${messageId}`, { params: { scope } }).then((res) => res.data),
  clearConversation: (conversationId: string) =>
    api.post<{ conversationId: string; userId: string; clearedAt: string }>(`/chat/conversations/${conversationId}/clear`).then((res) => res.data),
  deleteConversation: (conversationId: string) =>
    api.delete<{ conversationId: string; userId: string; deletedAt: string }>(`/chat/conversations/${conversationId}`).then((res) => res.data),
};

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return typeof message === 'string' ? message : fallback;
}
