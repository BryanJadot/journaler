'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * LoginPage component
 * Renders a login form with username and password inputs
 * Handles user authentication, state management, and navigation
 *
 * Component responsibilities:
 * - Capture user credentials
 * - Submit login request to backend API
 * - Handle loading and error states
 * - Redirect on successful authentication
 *
 * @component
 * @returns {React.ReactElement} Login page with authentication form
 */
export default function LoginPage() {
  // State management for login form
  const [username, setUsername] = useState(''); // Username input
  const [password, setPassword] = useState(''); // Password input
  const [error, setError] = useState(''); // Error message state
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Next.js router for programmatic navigation
  const router = useRouter();

  /**
   * Handles form submission and user authentication
   * Prevents default form submission, validates inputs, and calls login API
   *
   * Authentication flow:
   * 1. Prevent default form submission
   * 2. Reset previous errors
   * 3. Set loading state
   * 4. Send login request to backend
   * 5. Handle success or failure scenarios
   *
   * @param {React.FormEvent} e - Form submission event
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent standard form submission
    e.preventDefault();

    // Reset error state before new submission
    setError('');

    // Indicate loading state
    setIsLoading(true);

    try {
      // Send login request to authentication endpoint
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      // Parse response data
      const data = await response.json();

      // Handle authentication result
      if (data.success) {
        // Successful login: Navigate to home page
        router.push('/');
      } else {
        // Login failed: Display error message
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch {
      // Network or unexpected error
      setError('Login failed. Please try again.');
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  // Render login form with dynamic states
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Journaler
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
