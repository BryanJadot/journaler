import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import type {
  AuthenticationResult,
  CreateUserData,
  LoginCredentials,
  User,
} from './types';
import { AuthError } from './types';

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

export async function authenticateUser(
  credentials: LoginCredentials
): Promise<AuthenticationResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, credentials.username));

  if (!user) {
    return { success: false, error: AuthError.USER_NOT_FOUND };
  }

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: AuthError.INVALID_PASSWORD };
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
  };
}
