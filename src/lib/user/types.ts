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

// Login-specific errors
export enum LoginError {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
}

// Signup-specific errors
export enum SignupError {
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  INVALID_USERNAME = 'INVALID_USERNAME',
  USERNAME_TOO_LONG = 'USERNAME_TOO_LONG',
}

export type LoginResult =
  | { success: true; user: User }
  | { success: false; error: LoginError };

export type SignupResult =
  | { success: true; user: User }
  | { success: false; error: SignupError };
