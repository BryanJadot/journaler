export interface User {
  id: string;
  username: string;
  createdAt: Date;
}

export interface CreateUserData {
  username: string;
  password: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export enum AuthError {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
}

export type AuthenticationResult = 
  | { success: true; user: User }
  | { success: false; error: AuthError }