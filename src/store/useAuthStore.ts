import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/services/api';
import { useStockStore } from './useStockStore';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  currency?: string;
  taxRate?: number;
  feeDiscount?: number;
  lineUserId?: string;
  lineDisplayName?: string;
  lineBoundAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  /** 真實後端登入 */
  login: (email: string, password: string) => Promise<void>;
  /** 真實後端註冊 */
  register: (email: string, password: string, name: string) => Promise<void>;
  /** 啟動檢查並還原 Session (GET /auth/me) */
  bootstrap: () => Promise<void>;
  /** demo 用 mock 登入 */
  loginMock: (email: string, password: string, name?: string) => void;
  /** demo 用 mock 註冊 */
  registerMock: (email: string, password: string, name: string) => void;
  logout: () => Promise<void>;
  bindLine: (lineUserId: string, lineDisplayName: string) => void;
  unbindLine: () => void;
  updateProfile: (patch: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),

      login: async (email, password) => {
        try {
          const res = await apiClient.post('/auth/login', { email, password });
          const { user, accessToken } = res.data.data;
          set({ user, token: accessToken });
          // 登入後拉取雲端帳本，同步最新交易與庫存
          useStockStore.getState().syncFromCloud().catch(() => {});
        } catch (err: any) {
          const msg =
            err.response?.data?.error?.message || err.message || '登入失敗，請檢查帳號密碼';
          throw new Error(msg);
        }
      },

      register: async (email, password, name) => {
        try {
          const res = await apiClient.post('/auth/register', { email, password, name });
          const { user, accessToken } = res.data.data;
          set({ user, token: accessToken });
          // 註冊後若本地已有記帳資料，自動為用戶備份上雲
          useStockStore.getState().syncFromCloud().catch(() => {});
        } catch (err: any) {
          const msg =
            err.response?.data?.error?.message || err.message || '註冊失敗，請重試';
          throw new Error(msg);
        }
      },

      bootstrap: async () => {
        const token = get().token;
        if (!token) return;
        set({ isLoading: true });
        try {
          const res = await apiClient.get('/auth/me');
          if (res.data?.success && res.data?.data?.user) {
            set({ user: res.data.data.user });
            // 還原 session 後在背景同步雲端資料
            useStockStore.getState().syncFromCloud().catch(() => {});
          }
        } catch (err) {
          console.warn('[Auth bootstrap warn]: Session 可能已失效');
        } finally {
          set({ isLoading: false });
        }
      },

      loginMock: (email, _password, name) =>
        set({
          token: 'mock-token-' + Math.random().toString(36).slice(2),
          user: {
            id: 'u_' + Math.random().toString(36).slice(2, 10),
            email,
            name: name ?? email.split('@')[0],
          },
        }),

      registerMock: (email, _password, name) =>
        set({
          token: 'mock-token-' + Math.random().toString(36).slice(2),
          user: {
            id: 'u_' + Math.random().toString(36).slice(2, 10),
            email,
            name,
          },
        }),

      logout: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch {}
        set({ user: null, token: null });
      },

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
            : s
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
            : s
        ),

      updateProfile: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
    }),
    { name: 'stock-ledgery-auth', version: 1 }
  )
);
