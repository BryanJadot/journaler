import {
  setHmacHeaders,
  extractHmacHeaders,
  stripInternalHeaders,
} from '@/lib/auth/hmac-headers';
import type { HmacAuthHeaders } from '@/lib/auth/hmac-types';

/**
 * Test suite for HMAC header manipulation utilities.
 *
 * This suite tests the functions that set, extract, and strip HMAC authentication
 * headers used in the middleware and authentication system.
 */
describe('HMAC Headers Utilities', () => {
  describe('setHmacHeaders', () => {
    it('should set all required headers with x-internal prefix', () => {
      const headers = new Headers();
      const auth: HmacAuthHeaders = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: 1234567890,
        signature: 'abc123signature',
      };

      setHmacHeaders(headers, auth, 'x-internal');

      expect(headers.get('x-internal-user')).toBe('user-123');
      expect(headers.get('x-internal-ts')).toBe('1234567890');
      expect(headers.get('x-internal-sig')).toBe('abc123signature');
      expect(headers.get('x-internal-method')).toBe('POST');
      expect(headers.get('x-internal-path')).toBe('/api/chat');
    });

    it('should set all required headers with x-service prefix', () => {
      const headers = new Headers();
      const auth: HmacAuthHeaders = {
        userId: 'service-user',
        method: 'GET',
        path: '/api/test',
        timestamp: 9876543210,
        signature: 'xyz789signature',
      };

      setHmacHeaders(headers, auth, 'x-service');

      expect(headers.get('x-service-user')).toBe('service-user');
      expect(headers.get('x-service-ts')).toBe('9876543210');
      expect(headers.get('x-service-sig')).toBe('xyz789signature');
      expect(headers.get('x-service-method')).toBe('GET');
      expect(headers.get('x-service-path')).toBe('/api/test');
    });

    it('should overwrite existing headers', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'old-user');

      const auth: HmacAuthHeaders = {
        userId: 'new-user',
        method: 'POST',
        path: '/api/chat',
        timestamp: 1234567890,
        signature: 'signature',
      };

      setHmacHeaders(headers, auth, 'x-internal');

      expect(headers.get('x-internal-user')).toBe('new-user');
    });
  });

  describe('extractHmacHeaders', () => {
    it('should extract all headers with x-internal prefix', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-sig', 'abc123signature');
      headers.set('x-internal-method', 'POST');
      headers.set('x-internal-path', '/api/chat');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result).toEqual({
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: 1234567890,
        signature: 'abc123signature',
      });
    });

    it('should extract all headers with x-service prefix', () => {
      const headers = new Headers();
      headers.set('x-service-user', 'service-user');
      headers.set('x-service-ts', '9876543210');
      headers.set('x-service-sig', 'xyz789signature');
      headers.set('x-service-method', 'GET');
      headers.set('x-service-path', '/api/test');

      const result = extractHmacHeaders(headers, 'x-service');

      expect(result).toEqual({
        userId: 'service-user',
        method: 'GET',
        path: '/api/test',
        timestamp: 9876543210,
        signature: 'xyz789signature',
      });
    });

    it('should return null when user header is missing', () => {
      const headers = new Headers();
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-sig', 'signature');
      headers.set('x-internal-method', 'POST');
      headers.set('x-internal-path', '/api/chat');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result).toBeNull();
    });

    it('should return null when timestamp header is missing', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-sig', 'signature');
      headers.set('x-internal-method', 'POST');
      headers.set('x-internal-path', '/api/chat');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result).toBeNull();
    });

    it('should return null when signature header is missing', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-method', 'POST');
      headers.set('x-internal-path', '/api/chat');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result).toBeNull();
    });

    it('should return null when method header is missing', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-sig', 'signature');
      headers.set('x-internal-path', '/api/chat');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result).toBeNull();
    });

    it('should return null when path header is missing', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-sig', 'signature');
      headers.set('x-internal-method', 'POST');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result).toBeNull();
    });

    it('should parse timestamp as integer', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-sig', 'signature');
      headers.set('x-internal-method', 'POST');
      headers.set('x-internal-path', '/api/chat');

      const result = extractHmacHeaders(headers, 'x-internal');

      expect(result?.timestamp).toBe(1234567890);
      expect(typeof result?.timestamp).toBe('number');
    });
  });

  describe('stripInternalHeaders', () => {
    it('should remove all x-internal headers', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-internal-ts', '1234567890');
      headers.set('x-internal-sig', 'signature');
      headers.set('x-internal-method', 'POST');
      headers.set('x-internal-path', '/api/chat');
      headers.set('authorization', 'Bearer token');
      headers.set('content-type', 'application/json');

      stripInternalHeaders(headers);

      expect(headers.get('x-internal-user')).toBeNull();
      expect(headers.get('x-internal-ts')).toBeNull();
      expect(headers.get('x-internal-sig')).toBeNull();
      expect(headers.get('x-internal-method')).toBeNull();
      expect(headers.get('x-internal-path')).toBeNull();

      // Should preserve other headers
      expect(headers.get('authorization')).toBe('Bearer token');
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should remove all x-service headers', () => {
      const headers = new Headers();
      headers.set('x-service-user', 'service-user');
      headers.set('x-service-ts', '9876543210');
      headers.set('x-service-sig', 'signature');
      headers.set('x-service-method', 'GET');
      headers.set('x-service-path', '/api/test');
      headers.set('user-agent', 'test-agent');

      stripInternalHeaders(headers);

      expect(headers.get('x-service-user')).toBeNull();
      expect(headers.get('x-service-ts')).toBeNull();
      expect(headers.get('x-service-sig')).toBeNull();
      expect(headers.get('x-service-method')).toBeNull();
      expect(headers.get('x-service-path')).toBeNull();

      // Should preserve other headers
      expect(headers.get('user-agent')).toBe('test-agent');
    });

    it('should remove both x-internal and x-service headers', () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'user-123');
      headers.set('x-service-user', 'service-user');
      headers.set('x-internal-sig', 'internal-sig');
      headers.set('x-service-sig', 'service-sig');
      headers.set('accept', 'application/json');

      stripInternalHeaders(headers);

      expect(headers.get('x-internal-user')).toBeNull();
      expect(headers.get('x-service-user')).toBeNull();
      expect(headers.get('x-internal-sig')).toBeNull();
      expect(headers.get('x-service-sig')).toBeNull();

      // Should preserve other headers
      expect(headers.get('accept')).toBe('application/json');
    });

    it('should handle case-insensitive header names', () => {
      const headers = new Headers();
      headers.set('X-Internal-User', 'user-123');
      headers.set('X-SERVICE-SIG', 'signature');
      headers.set('Content-Type', 'application/json');

      stripInternalHeaders(headers);

      expect(headers.get('X-Internal-User')).toBeNull();
      expect(headers.get('X-SERVICE-SIG')).toBeNull();

      // Should preserve other headers
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should not affect headers when no internal headers present', () => {
      const headers = new Headers();
      headers.set('authorization', 'Bearer token');
      headers.set('content-type', 'application/json');
      headers.set('user-agent', 'test-agent');

      stripInternalHeaders(headers);

      expect(headers.get('authorization')).toBe('Bearer token');
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('user-agent')).toBe('test-agent');
    });
  });
});
