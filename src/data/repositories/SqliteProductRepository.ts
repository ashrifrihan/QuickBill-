import { getDatabase, guardDb, SQLiteExecutor } from '../database';
import { IProductRepository, ProductQuery } from './interfaces';
import { ProductRow, toProduct } from '../mappers';
import { Product } from '../../domain/Product';
import { NotFoundError, ValidationError } from '../../errors/AppError';

const COLUMNS = `id, barcode, name, category, purchase_price, selling_price,
                 tax_rate, stock_qty, image_uri, is_active, created_at, updated_at`;

export class SqliteProductRepository implements IProductRepository {
  /**
   * `executor` lets BillingService run these methods inside its checkout
   * transaction. Default is the shared connection.
   */
  constructor(private readonly executor?: SQLiteExecutor) {}

  private async db(): Promise<SQLiteExecutor> {
    return this.executor ?? (await getDatabase());
  }

  /** Builds the shared WHERE clause for list/count so they can't drift apart. */
  private buildFilter(query: ProductQuery = {}): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!query.includeInactive) conditions.push('is_active = 1');

    if (query.search?.trim()) {
      // Matches name or barcode — cashiers search by either.
      conditions.push('(name LIKE ? OR barcode LIKE ?)');
      const like = `%${query.search.trim()}%`;
      params.push(like, like);
    }

    if (query.category?.trim()) {
      conditions.push('category = ?');
      params.push(query.category.trim());
    }

    if (query.onlyLowStock) {
      conditions.push('stock_qty <= ?');
      params.push(query.lowStockThreshold ?? 5);
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  async findById(id: number): Promise<Product | null> {
    const db = await this.db();
    return guardDb('findById(product)', async () => {
      const row = await db.getFirstAsync<ProductRow>(
        `SELECT ${COLUMNS} FROM products WHERE id = ?`,
        [id],
      );
      return row ? toProduct(row) : null;
    });
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    const db = await this.db();
    const code = barcode.trim();
    return guardDb(
      'findByBarcode',
      async () => {
        const row = await db.getFirstAsync<ProductRow>(
          `SELECT ${COLUMNS} FROM products WHERE barcode = ?`,
          [code],
        );
        return row ? toProduct(row) : null;
      },
      { barcode: code },
    );
  }

  async requireByBarcode(barcode: string): Promise<Product> {
    const product = await this.findByBarcode(barcode);
    if (!product) throw new NotFoundError('Product', barcode);
    return product;
  }

  async list(query: ProductQuery = {}): Promise<Product[]> {
    const db = await this.db();
    const { clause, params } = this.buildFilter(query);
    const limit = query.limit ?? 200;
    const offset = query.offset ?? 0;

    return guardDb('list(products)', async () => {
      const rows = await db.getAllAsync<ProductRow>(
        `SELECT ${COLUMNS} FROM products ${clause} ORDER BY name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return rows.map(toProduct);
    });
  }

  async count(query: ProductQuery = {}): Promise<number> {
    const db = await this.db();
    const { clause, params } = this.buildFilter(query);
    return guardDb('count(products)', async () => {
      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total FROM products ${clause}`,
        params,
      );
      return row?.total ?? 0;
    });
  }

  async getLowStock(threshold: number): Promise<Product[]> {
    return this.list({ onlyLowStock: true, lowStockThreshold: threshold, limit: 100 });
  }

  async categories(): Promise<string[]> {
    const db = await this.db();
    return guardDb('categories', async () => {
      const rows = await db.getAllAsync<{ category: string }>(
        `SELECT DISTINCT category FROM products
         WHERE category IS NOT NULL AND category <> '' AND is_active = 1
         ORDER BY category COLLATE NOCASE ASC`,
      );
      return rows.map((r) => r.category);
    });
  }

  async existsByBarcode(barcode: string, excludeId?: number): Promise<boolean> {
    const db = await this.db();
    return guardDb('existsByBarcode', async () => {
      const row = await db.getFirstAsync<{ id: number }>(
        excludeId === undefined
          ? 'SELECT id FROM products WHERE barcode = ?'
          : 'SELECT id FROM products WHERE barcode = ? AND id <> ?',
        excludeId === undefined ? [barcode.trim()] : [barcode.trim(), excludeId],
      );
      return row !== null;
    });
  }

  async create(product: Product): Promise<Product> {
    const db = await this.db();

    // Checked here as well as by the UNIQUE index, so the user gets a field
    // error rather than a raw constraint failure.
    if (await this.existsByBarcode(product.barcode)) {
      throw new ValidationError(`Barcode ${product.barcode} already exists`, {
        fields: { barcode: 'A product with this barcode already exists.' },
        userMessage: 'A product with this barcode already exists.',
      });
    }

    return guardDb(
      'create(product)',
      async () => {
        const result = await db.runAsync(
          `INSERT INTO products
             (barcode, name, category, purchase_price, selling_price, tax_rate,
              stock_qty, image_uri, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            product.barcode,
            product.name,
            product.category,
            product.purchasePrice,
            product.sellingPrice,
            product.taxRate,
            product.stockQty,
            product.imageUri,
            product.isActive ? 1 : 0,
            product.createdAt,
            product.updatedAt,
          ],
        );
        return product.with({ id: result.lastInsertRowId });
      },
      { barcode: product.barcode },
    );
  }

  async update(product: Product): Promise<Product> {
    if (product.id === undefined) {
      throw new ValidationError('Cannot update a product without an id');
    }
    const db = await this.db();

    if (await this.existsByBarcode(product.barcode, product.id)) {
      throw new ValidationError(`Barcode ${product.barcode} belongs to another product`, {
        fields: { barcode: 'Another product already uses this barcode.' },
        userMessage: 'Another product already uses this barcode.',
      });
    }

    const updated = product.with({});
    return guardDb(
      'update(product)',
      async () => {
        const result = await db.runAsync(
          `UPDATE products SET
             barcode = ?, name = ?, category = ?, purchase_price = ?, selling_price = ?,
             tax_rate = ?, stock_qty = ?, image_uri = ?, is_active = ?, updated_at = ?
           WHERE id = ?`,
          [
            updated.barcode,
            updated.name,
            updated.category,
            updated.purchasePrice,
            updated.sellingPrice,
            updated.taxRate,
            updated.stockQty,
            updated.imageUri,
            updated.isActive ? 1 : 0,
            updated.updatedAt,
            product.id!,
          ],
        );
        if (result.changes === 0) throw new NotFoundError('Product', String(product.id));
        return updated;
      },
      { id: product.id },
    );
  }

  /**
   * Decrements stock atomically, guarded in SQL so two concurrent sales can
   * never drive it negative. Returns false if there was not enough stock.
   */
  async decrementStock(productId: number, quantity: number): Promise<boolean> {
    const db = await this.db();
    return guardDb(
      'decrementStock',
      async () => {
        const result = await db.runAsync(
          `UPDATE products
             SET stock_qty = stock_qty - ?, updated_at = ?
           WHERE id = ? AND stock_qty >= ?`,
          [quantity, new Date().toISOString(), productId, quantity],
        );
        return result.changes > 0;
      },
      { productId, quantity },
    );
  }

  async deactivate(id: number): Promise<void> {
    const db = await this.db();
    await guardDb('deactivate(product)', async () => {
      await db.runAsync('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ]);
    });
  }

  async delete(id: number): Promise<void> {
    const db = await this.db();
    await guardDb('delete(product)', async () => {
      await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
    });
  }
}
