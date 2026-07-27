/**
 * The logged-in user. Session-only by design — closing the app signs you out,
 * which is the right default for a shared till at a counter.
 */

import { create } from 'zustand';
import { User } from '../domain/User';
import { authService } from '../services/AuthService';
import { toAppError } from '../errors/AppError';

interface AuthState {
  user: User | null;
  /** True until we know whether this device has any account yet. */
  initialising: boolean;
  needsSetup: boolean;
  signingIn: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<boolean>;
  createFirstAdmin: (input: { username: string; name: string; password: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialising: true,
  needsSetup: false,
  signingIn: false,
  error: null,

  bootstrap: async () => {
    try {
      set({ needsSetup: await authService.needsSetup() });
    } catch (error) {
      // A failure here must not lock the user out of the app entirely; the
      // login screen will surface the real problem when they try to sign in.
      set({ error: toAppError(error).userMessage });
    } finally {
      set({ initialising: false });
    }
  },

  signIn: async (username, password) => {
    set({ signingIn: true, error: null });
    try {
      const user = await authService.signIn(username, password);
      set({ user, signingIn: false });
      return true;
    } catch (error) {
      set({ error: toAppError(error).userMessage, signingIn: false });
      return false;
    }
  },

  createFirstAdmin: async (input) => {
    set({ signingIn: true, error: null });
    try {
      const user = await authService.createFirstAdmin(input);
      set({ user, needsSetup: false, signingIn: false });
      return true;
    } catch (error) {
      set({ error: toAppError(error).userMessage, signingIn: false });
      return false;
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

/** Role guard for screens and navigation (guide §11). */
export function useCan(action: Parameters<User['can']>[0]): boolean {
  return useAuthStore((state) => (state.user ? state.user.can(action) : false));
}

export function useIsAdmin(): boolean {
  return useAuthStore((state) => state.user?.isAdmin() ?? false);
}
