import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '../db';
import type { CreateUserData, User } from './types';
import { users } from '../db/schema';

export async function createUser(userData: CreateUserData): Promise<User> {
  const hashedPassword = await bcrypt.hash(userData.password, 12);
  const database = db;

  const [user] = await database
    .insert(users)
    .values({
      username: userData.username,
      passwordHash: hashedPassword,
    })
    .returning({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    });

  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id));

  return user || null;
}
