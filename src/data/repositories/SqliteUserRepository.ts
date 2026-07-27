import { getDatabase, guardDb, SQLiteExecutor } from '../database';
import { IUserRepository } from './interfaces';
import { UserRow, toUser } from '../mappers';
import { User, UserRole } from '../../domain/User';
import { NotFoundError, ValidationError } from '../../errors/AppError';
import { generateSalt, hashPassword, verifyPassword } from '../../utils/hash';

const COLUMNS = 'id, username, name, role, password_hash, password_salt, is_active, created_at';

export const MIN_PASSWORD_LENGTH = 4;

export class SqliteUserRepository implements IUserRepository {
  constructor(private readonly executor?: SQLiteExecutor) {}

  private async db(): Promise<SQLiteExecutor> {
    return this.executor ?? (await getDatabase());
  }

  async findByUsername(username: string): Promise<User | null> {
    const db = await this.db();
    return guardDb('findByUsername', async () => {
      const row = await db.getFirstAsync<UserRow>(
        `SELECT ${COLUMNS} FROM users WHERE username = ?`,
        [username.trim().toLowerCase()],
      );
      return row ? toUser(row) : null;
    });
  }

  async findById(id: number): Promise<User | null> {
    const db = await this.db();
    return guardDb('findById(user)', async () => {
      const row = await db.getFirstAsync<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id]);
      return row ? toUser(row) : null;
    });
  }

  async list(): Promise<User[]> {
    const db = await this.db();
    return guardDb('list(users)', async () => {
      const rows = await db.getAllAsync<UserRow>(
        `SELECT ${COLUMNS} FROM users ORDER BY role ASC, name COLLATE NOCASE ASC`,
      );
      return rows.map(toUser);
    });
  }

  async count(): Promise<number> {
    const db = await this.db();
    return guardDb('count(users)', async () => {
      const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM users');
      return row?.total ?? 0;
    });
  }

  async create(user: User, password: string): Promise<User> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, {
        fields: { password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
        userMessage: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }

    if (await this.findByUsername(user.username)) {
      throw new ValidationError(`Username ${user.username} is taken`, {
        fields: { username: 'That username is already taken.' },
        userMessage: 'That username is already taken.',
      });
    }

    const db = await this.db();
    const salt = await generateSalt();
    const hash = await hashPassword(password, salt);

    return guardDb(
      'create(user)',
      async () => {
        const result = await db.runAsync(
          `INSERT INTO users (username, name, role, password_hash, password_salt, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [user.username, user.name, user.role, hash, salt, user.isActive ? 1 : 0, user.createdAt],
        );
        return new User({
          id: result.lastInsertRowId,
          username: user.username,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        });
      },
      { username: user.username },
    );
  }

  /** Returns the user on success, null on a bad username OR bad password. */
  async verifyPassword(username: string, password: string): Promise<User | null> {
    const db = await this.db();
    const row = await guardDb('verifyPassword(lookup)', async () =>
      db.getFirstAsync<UserRow>(`SELECT ${COLUMNS} FROM users WHERE username = ?`, [
        username.trim().toLowerCase(),
      ]),
    );

    if (!row || row.is_active !== 1) return null;

    const matches = await verifyPassword(password, row.password_salt, row.password_hash);
    return matches ? toUser(row) : null;
  }

  async changePassword(userId: number, newPassword: string): Promise<void> {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, {
        fields: { password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
        userMessage: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }
    const db = await this.db();
    const salt = await generateSalt();
    const hash = await hashPassword(newPassword, salt);

    await guardDb('changePassword', async () => {
      const result = await db.runAsync(
        'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?',
        [hash, salt, userId],
      );
      if (result.changes === 0) throw new NotFoundError('User', String(userId));
    });
  }

  async setRole(userId: number, role: UserRole): Promise<void> {
    const db = await this.db();
    await guardDb('setRole', async () => {
      await db.runAsync('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    });
  }

  async deactivate(userId: number): Promise<void> {
    const db = await this.db();
    await guardDb('deactivate(user)', async () => {
      await db.runAsync('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
    });
  }
}
