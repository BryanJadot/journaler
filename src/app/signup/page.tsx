'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useActionState } from 'react';

import { signupAction } from '@/lib/auth/actions';

/**
 * SignupPage component that renders a user registration form.
 *
 * Handles new user account creation with username and password.
 * Uses server action for registration with automatic redirect on success.
 *
 * @returns User registration page with form and validation
 */
export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="container card max-w-md space-y-8 bg-base-200 flex flex-col p-3">
        <div className="card-body space-y-8">
          <h2 className="text-center text-2xl">
            Create your Journaler account
          </h2>
          <form action={formAction} className="flex flex-col space-y-5">
            <label className="label flex flex-col items-start">
              Username
              <input
                id="username"
                name="username"
                type="text"
                required
                className="input w-full"
              />
            </label>

            <label className="label flex flex-col items-start">
              Password
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input w-full"
              />
            </label>

            {state?.error && (
              <div className="text-sm text-error">{state.error}</div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className={clsx('btn btn-primary', {
                'btn-disabled': isPending,
              })}
            >
              {isPending ? 'Creating account...' : 'Sign up'}
            </button>

            <div className="text-center">
              <p className="text-sm text-neutral">
                Already have an account?{' '}
                <Link href="/login" className="font-medium link">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
