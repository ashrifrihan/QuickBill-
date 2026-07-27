import { getDatabase, guardDb, SQLiteExecutor } from '../database';
import { ISettingsRepository } from './interfaces';

export class SqliteSettingsRepository implements ISettingsRepository {
  constructor(private readonly executor?: SQLiteExecutor) {}

  private async db(): Promise<SQLiteExecutor> {
    return this.executor ?? (await getDatabase());
  }

  async get(key: string): Promise<string | null> {
    const db = await this.db();
    return guardDb('get(setting)', async () => {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    });
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const raw = await this.get(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async getBoolean(key: string, fallback: boolean): Promise<boolean> {
    const raw = await this.get(key);
    if (raw === null) return fallback;
    return raw === 'true' || raw === '1';
  }

  async set(key: string, value: string): Promise<void> {
    const db = await this.db();
    await guardDb('set(setting)', async () => {
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const db = await this.db();
    return guardDb('getAll(settings)', async () => {
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM settings',
      );
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    });
  }

  async setMany(values: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(key, value);
    }
  }
}
