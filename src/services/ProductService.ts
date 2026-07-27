/**
 * Product use cases (guide §8.3). Thin on purpose — most rules already live in
 * the Product model and the repository; this layer coordinates them and owns
 * the image-file handling.
 */

import * as FileSystem from 'expo-file-system';
import { productRepository } from '../data';
import { ProductQuery } from '../data/repositories/interfaces';
import { Product } from '../domain/Product';
import { Money } from '../domain/Money';
import { logger } from '../errors/logger';
import { ValidationError } from '../errors/AppError';

export interface ProductInput {
  id?: number;
  barcode: string;
  name: string;
  category?: string | null;
  purchasePrice: Money;
  sellingPrice: Money;
  taxRate?: number;
  stockQty: number;
  imageUri?: string | null;
}

const IMAGE_DIR_NAME = 'product-images';

export class ProductService {
  list(query?: ProductQuery): Promise<Product[]> {
    return productRepository.list(query);
  }

  findByBarcode(barcode: string): Promise<Product | null> {
    return productRepository.findByBarcode(barcode);
  }

  findById(id: number): Promise<Product | null> {
    return productRepository.findById(id);
  }

  categories(): Promise<string[]> {
    return productRepository.categories();
  }

  async create(input: ProductInput): Promise<Product> {
    const imageUri = await this.persistImage(input.imageUri);
    // The Product constructor validates; a bad input never reaches SQL.
    const product = new Product({ ...input, imageUri });
    return productRepository.create(product);
  }

  async update(input: ProductInput): Promise<Product> {
    if (input.id === undefined) {
      throw new ValidationError('Cannot update a product without an id');
    }
    const existing = await productRepository.findById(input.id);
    if (!existing) {
      throw new ValidationError(`Product ${input.id} no longer exists`, {
        userMessage: 'That product no longer exists.',
      });
    }

    const imageUri =
      input.imageUri && input.imageUri !== existing.imageUri
        ? await this.persistImage(input.imageUri)
        : input.imageUri;

    const product = existing.with({ ...input, imageUri });
    return productRepository.update(product);
  }

  /** Adjusts stock by a signed delta (restocking, shrinkage correction). */
  async adjustStock(productId: number, delta: number): Promise<Product> {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new ValidationError(`Product ${productId} not found`, {
        userMessage: 'That product no longer exists.',
      });
    }
    const next = Math.max(0, product.stockQty + delta);
    return productRepository.update(product.with({ stockQty: next }));
  }

  deactivate(id: number): Promise<void> {
    return productRepository.deactivate(id);
  }

  /**
   * Copies a picked image into the app's own directory and returns that path.
   * The DB stores the path, never the bytes (guide §8.3) — and the cache URI
   * the picker hands back can be evicted by the OS at any time.
   */
  private async persistImage(sourceUri?: string | null): Promise<string | null> {
    if (!sourceUri) return null;
    // Already ours: nothing to copy.
    if (sourceUri.includes(IMAGE_DIR_NAME)) return sourceUri;

    try {
      const directory = new FileSystem.Directory(FileSystem.Paths.document, IMAGE_DIR_NAME);
      if (!directory.exists) directory.create({ intermediates: true });

      const extension = sourceUri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const source = new FileSystem.File(sourceUri);
      const destination = new FileSystem.File(directory, `${Date.now()}.${extension}`);

      // `copy()` returns a Promise. Without awaiting it here the rejection
      // escapes this try/catch entirely and surfaces as an uncaught promise
      // rejection instead of the graceful "save without image" fallback.
      await source.copy(destination);
      return destination.uri;
    } catch (error) {
      // A missing photo must not block saving the product.
      logger.warn('Could not save product image; continuing without it', {
        error: String(error),
      });
      return null;
    }
  }
}

export const productService = new ProductService();
