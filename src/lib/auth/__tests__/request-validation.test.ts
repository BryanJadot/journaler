import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

import { validateRequestFormat } from '@/lib/auth/request-validation';

describe('validateRequestFormat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const createMockRequest = (
    body: string,
    contentType: string = 'application/json'
  ): NextRequest => {
    return new NextRequest('http://localhost:3000/api/signup', {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': contentType,
      },
    });
  };

  const createValidJSONRequest = (
    data: Record<string, unknown>
  ): NextRequest => {
    return createMockRequest(JSON.stringify(data));
  };

  describe('successful validation', () => {
    it('should return valid result with username and password', async () => {
      const requestData = {
        username: 'testuser',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'testuser',
        password: 'password123',
      });
    });

    it('should handle username with special characters', async () => {
      const requestData = {
        username: 'test@user.com+123_dash-allowed',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'test@user.com+123_dash-allowed',
        password: 'password123',
      });
    });

    it('should handle unicode characters in username', async () => {
      const requestData = {
        username: '测试用户',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: '测试用户',
        password: 'password123',
      });
    });

    it('should handle emoji in username', async () => {
      const requestData = {
        username: 'user👤test',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'user👤test',
        password: 'password123',
      });
    });

    it('should handle very long valid username', async () => {
      const longUsername = 'a'.repeat(255);
      const requestData = {
        username: longUsername,
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: longUsername,
        password: 'password123',
      });
    });

    it('should handle very long password', async () => {
      const longPassword = 'p'.repeat(1000);
      const requestData = {
        username: 'testuser',
        password: longPassword,
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'testuser',
        password: longPassword,
      });
    });

    it('should handle password with special characters', async () => {
      const requestData = {
        username: 'testuser',
        password: 'p@ssw0rd!#$%^&*()',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'testuser',
        password: 'p@ssw0rd!#$%^&*()',
      });
    });
  });

  describe('invalid JSON handling', () => {
    it('should return error response for malformed JSON', async () => {
      const request = createMockRequest('{ invalid json }');
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid JSON in request body',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error response for incomplete JSON', async () => {
      const request = createMockRequest('{"username": "test"');
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid JSON in request body',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error response for empty request body', async () => {
      const request = createMockRequest('');
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid JSON in request body',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error response for non-JSON string', async () => {
      const request = createMockRequest('not json at all');
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Invalid JSON in request body',
      });
      expect(failureResult.response.status).toBe(400);
    });
  });

  describe('missing fields validation', () => {
    it('should return error for missing username', async () => {
      const requestData = {
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for missing password', async () => {
      const requestData = {
        username: 'testuser',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for missing both username and password', async () => {
      const requestData = {};

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });
  });

  describe('invalid field types validation', () => {
    it('should return error for non-string username', async () => {
      const requestData = {
        username: 123,
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for non-string password', async () => {
      const requestData = {
        username: 'testuser',
        password: 123,
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for boolean username', async () => {
      const requestData = {
        username: true,
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for null username', async () => {
      const requestData = {
        username: null,
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for array username', async () => {
      const requestData = {
        username: ['test', 'user'],
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for object username', async () => {
      const requestData = {
        username: { name: 'testuser' },
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });
  });

  describe('empty string validation', () => {
    it('should return error for empty username string', async () => {
      const requestData = {
        username: '',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for empty password string', async () => {
      const requestData = {
        username: 'testuser',
        password: '',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for whitespace-only username', async () => {
      const requestData = {
        username: '   ',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for whitespace-only password', async () => {
      const requestData = {
        username: 'testuser',
        password: '   ',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for tab-only username', async () => {
      const requestData = {
        username: '\t\t\t',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });

    it('should return error for newline-only password', async () => {
      const requestData = {
        username: 'testuser',
        password: '\n\n',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(failureResult.response.status).toBe(400);
    });
  });

  describe('edge cases and additional scenarios', () => {
    it('should handle extra fields in request body', async () => {
      const requestData = {
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
        age: 25,
        preferences: { theme: 'dark' },
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'testuser',
        password: 'password123',
      });
    });

    it('should handle username with leading and trailing whitespace (but trimmed content)', async () => {
      const requestData = {
        username: '  testuser  ',
        password: '  password123  ',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      // The validation should pass since trim() is called and the trimmed values are not empty
      expect(result).toEqual({
        valid: true,
        username: '  testuser  ',
        password: '  password123  ',
      });
    });

    it('should handle different content types gracefully', async () => {
      const request = createMockRequest(
        '{"username": "test", "password": "pass"}',
        'text/plain'
      );
      const result = await validateRequestFormat(request);

      // Should still work since we're parsing JSON regardless of content type
      expect(result).toEqual({
        valid: true,
        username: 'test',
        password: 'pass',
      });
    });

    it('should handle deeply nested JSON structure', async () => {
      const requestData = {
        username: 'testuser',
        password: 'password123',
        nested: {
          deep: {
            object: {
              value: 'should be ignored',
            },
          },
        },
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result).toEqual({
        valid: true,
        username: 'testuser',
        password: 'password123',
      });
    });

    it('should handle zero-length strings after trimming', async () => {
      const requestData = {
        username: '\t\n\r ',
        password: 'password123',
      };

      const request = createValidJSONRequest(requestData);
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      const responseData = await failureResult.response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
    });
  });

  describe('response format consistency', () => {
    it('should always return NextResponse with proper structure on failure', async () => {
      const request = createMockRequest('invalid');
      const result = await validateRequestFormat(request);

      expect(result.valid).toBe(false);

      const failureResult = result as { valid: false; response: NextResponse };
      expect(failureResult.response).toBeDefined();
      expect(typeof failureResult.response.json).toBe('function');
      expect(typeof failureResult.response.status).toBe('number');
      expect(failureResult.response.status).toBe(400);
    });

    it('should return consistent error structure', async () => {
      const testCases = [
        { body: 'invalid json', expectedError: 'Invalid JSON in request body' },
        { body: '{}', expectedError: 'Username and password are required' },
        {
          body: '{"username": "test"}',
          expectedError: 'Username and password are required',
        },
        {
          body: '{"password": "pass"}',
          expectedError: 'Username and password are required',
        },
      ];

      for (const testCase of testCases) {
        const request = createMockRequest(testCase.body);
        const result = await validateRequestFormat(request);

        expect(result.valid).toBe(false);

        const failureResult = result as {
          valid: false;
          response: NextResponse;
        };
        expect(failureResult.response).toBeDefined();
        const responseData = await failureResult.response.json();
        expect(responseData).toMatchObject({
          success: false,
          error: testCase.expectedError,
        });
        expect(failureResult.response.status).toBe(400);
      }
    });
  });
});
