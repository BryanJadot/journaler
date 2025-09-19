'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useActionState } from 'react';

import { loginAction } from '@/lib/auth/actions';

/**
 * LoginPage component
 * Renders a login form with username and password inputs
 * Uses server action for authentication with automatic redirect on success
 *
 * @component
 * @returns {React.ReactElement} Login page with authentication form
 */
export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  // Render login form with dynamic states
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="container card max-w-md space-y-8 bg-base-200 flex flex-col p-3">
        <div className="card-body space-y-8">
          <h2 className="text-center text-2xl">Sign in to Journaler</h2>
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

            {/* Error Message Display */}
            {state?.error && (
              <div className="text-sm text-error">{state.error}</div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className={clsx('btn btn-primary', {
                'btn-disabled': isPending,
              })}
            >
              {isPending ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="text-center">
              <p className="text-sm text-neutral">
                Don&#39;t have an account?{' '}
                <Link href="/signup" className="font-medium link">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
