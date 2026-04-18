import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  lineUserId?: string;
  lineDisplayName?: string;
  lineBoundAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loginMock: (email: string, name?: string) => void;
  registerMock: (email: string, name: string) => void;
  logout: () => void;
  bindLine: (lineUserId: string, lineDisplayName: string) => void;
  unbindLine: () => void;
  updateProfile: (patch: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loginMock: (email, name) =>
        set({
          token: 'mock-token-' + Math.random().toString(36).slice(2),
          user: {
            id: 'u_' + Math.random().toString(36).slice(2, 10),
            email,
            name: name ?? email.split('@')[0],
          },
        }),
      registerMock: (email, name) =>
        set({
          token: 'mock-token-' + Math.random().toString(36).slice(2),
          user: {
            id: 'u_' + Math.random().toString(36).slice(2, 10),
            email,
            name,
          },
        }),
      logout: () => set({ user: null, token: null }),
      bindLine: (lineUserId, lineDisplayName) =>
        set((s) =>
          s.user
            ? {
                user: {
                  ...s.user,
                  lineUserId,
                  lineDisplayName,
                  lineBoundAt: new Date().toISOString(),
                },
              }
            : s,
        ),
      unbindLine: () =>
        set((s) =>
          s.user
            ? {
                user: {
                  ...s.user,
                  lineUserId: undefined,
                  lineDisplayName: undefined,
                  lineBoundAt: undefined,
                },
              }
            : s,
        ),
      updateProfile: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
    }),
    { name: 'stock-ledgery-auth', version: 1 },
  ),
);
