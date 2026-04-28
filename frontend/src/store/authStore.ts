import { create } from 'zustand';
import { authApi } from '../services/api';
import { closeSocket } from '../services/socket';
import type { User } from '../types';

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setUser: (user: User) => void;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, avatar?: string) => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('sync_token'),
  loading: true,
  setUser: (user) => set({ user }),
  bootstrap: async () => {
    const token = localStorage.getItem('sync_token');
    if (!token) {
      set({ loading: false, token: null, user: null });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem('sync_token');
      set({ user: null, token: null, loading: false });
    }
  },
  login: async (email, password) => {
    const result = await authApi.login({ email, password });
    localStorage.setItem('sync_token', result.token);
    set({ user: result.user, token: result.token });
  },
  register: async (name, email, password, avatar) => {
    const result = await authApi.register({ name, email, password, avatar });
    localStorage.setItem('sync_token', result.token);
    set({ user: result.user, token: result.token });
  },
  logout: () => {
    localStorage.removeItem('sync_token');
    closeSocket();
    set({ user: null, token: null });
  },
}));
