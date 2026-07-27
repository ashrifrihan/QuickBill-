/**
 * A shop staff member. Role drives what the navigation layer will let them
 * reach (guide §8.1) — admins manage products and prices, cashiers sell.
 *
 * The password hash never leaves the data layer as plain text and is not part
 * of this model; see UserRepository and utils/hash.ts.
 */

import { ValidationError } from '../errors/AppError';

export type UserRole = 'admin' | 'cashier';

export interface UserProps {
  id?: number;
  username: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
}

export class User {
  readonly id?: number;
  readonly username: string;
  readonly name: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly createdAt: string;

  constructor(props: UserProps) {
    const fields: Record<string, string> = {};

    const username = props.username?.trim().toLowerCase() ?? '';
    if (username.length < 3) fields.username = 'Username must be at least 3 characters.';
    if (!/^[a-z0-9._-]+$/.test(username) && username.length >= 3) {
      fields.username = 'Username can only use letters, numbers, dot, dash and underscore.';
    }

    const name = props.name?.trim() ?? '';
    if (name === '') fields.name = 'Name is required.';

    if (props.role !== 'admin' && props.role !== 'cashier') {
      fields.role = 'Role must be admin or cashier.';
    }

    if (Object.keys(fields).length > 0) {
      throw new ValidationError(`Invalid user: ${Object.values(fields).join(' ')}`, {
        fields,
        userMessage: Object.values(fields)[0],
      });
    }

    this.id = props.id;
    this.username = username;
    this.name = name;
    this.role = props.role;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date().toISOString();

    Object.freeze(this);
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  /** Single place the admin-only rule is expressed. */
  can(action: 'manage_products' | 'view_reports' | 'manage_settings' | 'sell'): boolean {
    if (action === 'sell') return true;
    return this.isAdmin();
  }
}
