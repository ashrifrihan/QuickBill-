/**
 * Persists the in-progress cart so a crash mid-sale doesn't lose it
 * (guide §9.8 / §16 "Lost cart on crash mid-sale").
 */

import { getDatabase, guardDb } from '../database';
import { ICartDraftRepository } from './interfaces';
import { Cart } from '../../domain/Cart';
import { logger } from '../../errors/logger';

export class SqliteCartDraftRepository implements ICartDraftRepository {
  async save(cart: Cart): Promise<void> {
    const db = await getDatabase();
    if (cart.isEmpty) {
      await this.clear();
      return;
    }
    await guardDb('save(cart draft)', async () => {
      await db.runAsync(
        `INSERT INTO cart_draft (id, payload, updated_at) VALUES (1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        [JSON.stringify(cart.toJSON()), new Date().toISOString()],
      );
    });
  }

  async load(): Promise<Cart | null> {
    const db = await getDatabase();
    const row = await guardDb('load(cart draft)', async () =>
      db.getFirstAsync<{ payload: string }>('SELECT payload FROM cart_draft WHERE id = 1'),
    );
    if (!row) return null;

    // A draft that fails to parse is discarded rather than blocking startup —
    // an unusable saved cart must never stop the till from opening.
    try {
      return Cart.fromJSON(JSON.parse(row.payload));
    } catch (error) {
      logger.warn('Discarding unreadable cart draft', { error: String(error) });
      await this.clear();
      return null;
    }
  }

  async clear(): Promise<void> {
    const db = await getDatabase();
    await guardDb('clear(cart draft)', async () => {
      await db.runAsync('DELETE FROM cart_draft WHERE id = 1');
    });
  }
}
