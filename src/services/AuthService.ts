/**
 * Authentication, offline-first (guide §8.1).
 *
 * `IAuthProvider` is the seam: `LocalAuthProvider` checks the on-device users
 * table today. A `SupabaseAuthProvider` can implement the same three methods
 * later and nothing above AuthService changes.
 */

import { userRepository } from '../data';
import { User, UserRole } from '../domain/User';
import { AuthError, ValidationError } from '../errors/AppError';
import { logger } from '../errors/logger';

export interface IAuthProvider {
  signIn(username: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  register(input: RegisterInput): Promise<User>;
}

export interface RegisterInput {
  username: string;
  name: string;
  password: string;
  role: UserRole;
}

export class LocalAuthProvider implements IAuthProvider {
  async signIn(username: string, password: string): Promise<User> {
    if (!username.trim() || !password) {
      throw new AuthError('Missing credentials', {
        userMessage: 'Enter your username and password.',
      });
    }

    const user = await userRepository.verifyPassword(username, password);
    if (!user) {
      // Deliberately the same message for an unknown user and a wrong
      // password — telling them which one was wrong helps an attacker.
      throw new AuthError(`Failed sign-in for "${username}"`);
    }

    logger.info('User signed in', { username: user.username, role: user.role });
    return user;
  }

  async signOut(): Promise<void> {
    // Nothing to revoke for local auth; the store drops the session.
  }

  async register(input: RegisterInput): Promise<User> {
    const user = new User({
      username: input.username,
      name: input.name,
      role: input.role,
    });
    return userRepository.create(user, input.password);
  }
}

export class AuthService {
  constructor(private readonly provider: IAuthProvider = new LocalAuthProvider()) {}

  signIn(username: string, password: string): Promise<User> {
    return this.provider.signIn(username, password);
  }

  signOut(): Promise<void> {
    return this.provider.signOut();
  }

  register(input: RegisterInput): Promise<User> {
    return this.provider.register(input);
  }

  /** True on a fresh install, which routes the user to "create admin". */
  async needsSetup(): Promise<boolean> {
    return (await userRepository.count()) === 0;
  }

  /**
   * Creates the first admin. Refuses to run once any user exists, so it can't
   * be used to mint an extra admin later.
   */
  async createFirstAdmin(input: Omit<RegisterInput, 'role'>): Promise<User> {
    if (!(await this.needsSetup())) {
      throw new ValidationError('An account already exists on this device', {
        userMessage: 'An account already exists. Please sign in.',
      });
    }
    return this.register({ ...input, role: 'admin' });
  }

  /** Single place the app asks "is this person allowed to do X?". */
  can(user: User | null, action: Parameters<User['can']>[0]): boolean {
    if (!user) return false;
    return user.can(action);
  }

  requireAdmin(user: User | null): void {
    if (!user?.isAdmin()) {
      throw new AuthError('Admin role required', {
        userMessage: 'Only an admin can do that.',
      });
    }
  }
}

export const authService = new AuthService();
