import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl, getOrCreateChatUrl } from '@/lib/chat/redirect-helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

import { createThread, getMostRecentThread } from '../service';

// Mock the service functions
jest.mock('../service', () => ({
  getMostRecentThread: jest.fn(),
  createThread: jest.fn(),
}));

const mockGetMostRecentThread = getMostRecentThread as jest.MockedFunction<
  typeof getMostRecentThread
>;
const mockCreateThread = createThread as jest.MockedFunction<
  typeof createThread
>;

describe('getOrCreateChatUrl', () => {
  let testUserId: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create a test user
    const mockUser = createMockUser();
    const [testUser] = await db
      .insert(users)
      .values({
        username: mockUser.username,
        passwordHash: 'hash123',
      })
      .returning();
    testUserId = testUser.id;
  });

  it('should return URL for existing recent thread', async () => {
    const mockThread = {
      id: 'thread-123',
      name: 'Existing Thread',
      userId: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    mockGetMostRecentThread.mockResolvedValue(mockThread);

    const result = await getOrCreateChatUrl(testUserId);

    expect(result).toBe(getChatUrl('thread-123'));
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(testUserId);
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it('should create new thread and return URL when no threads exist', async () => {
    const mockNewThread = {
      id: 'new-thread-456',
      name: DEFAULT_THREAD_NAME,
      userId: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetMostRecentThread.mockResolvedValue(undefined);
    mockCreateThread.mockResolvedValue(mockNewThread);

    const result = await getOrCreateChatUrl(testUserId);

    expect(result).toBe(getChatUrl('new-thread-456'));
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(testUserId);
    expect(mockCreateThread).toHaveBeenCalledWith(
      testUserId,
      DEFAULT_THREAD_NAME
    );
  });

  it('should handle getMostRecentThread returning undefined', async () => {
    const mockNewThread = {
      id: 'undefined-thread-789',
      name: DEFAULT_THREAD_NAME,
      userId: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetMostRecentThread.mockResolvedValue(undefined);
    mockCreateThread.mockResolvedValue(mockNewThread);

    const result = await getOrCreateChatUrl(testUserId);

    expect(result).toBe(getChatUrl('undefined-thread-789'));
    expect(mockCreateThread).toHaveBeenCalledWith(
      testUserId,
      DEFAULT_THREAD_NAME
    );
  });

  it('should propagate errors from getMostRecentThread', async () => {
    const error = new Error('Database error');
    mockGetMostRecentThread.mockRejectedValue(error);

    await expect(getOrCreateChatUrl(testUserId)).rejects.toThrow(
      'Database error'
    );
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it('should propagate errors from createThread', async () => {
    const error = new Error('Thread creation failed');
    mockGetMostRecentThread.mockResolvedValue(undefined);
    mockCreateThread.mockRejectedValue(error);

    await expect(getOrCreateChatUrl(testUserId)).rejects.toThrow(
      'Thread creation failed'
    );
  });

  it('should work with different user IDs', async () => {
    const mockUser2 = createMockUser();
    const [testUser2] = await db
      .insert(users)
      .values({
        username: mockUser2.username,
        passwordHash: 'hash456',
      })
      .returning();
    const userId2 = testUser2.id;

    const mockThread = {
      id: 'user2-thread-abc',
      name: 'User 2 Thread',
      userId: userId2,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    mockGetMostRecentThread.mockResolvedValue(mockThread);

    const result = await getOrCreateChatUrl(userId2);

    expect(result).toBe(getChatUrl('user2-thread-abc'));
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(userId2);
  });
});

describe('getChatUrl', () => {
  it('should build correct URL for thread ID', () => {
    const threadId = 'thread-123';
    const result = getChatUrl(threadId);

    expect(result).toBe('/journal/chat/thread-123');
  });

  it('should handle different thread ID formats', () => {
    const testCases = [
      { threadId: 'simple-id', expected: '/journal/chat/simple-id' },
      {
        threadId: 'uuid-123e4567-e89b-12d3-a456-426614174000',
        expected: '/journal/chat/uuid-123e4567-e89b-12d3-a456-426614174000',
      },
      {
        threadId: 'thread_with_underscores',
        expected: '/journal/chat/thread_with_underscores',
      },
      {
        threadId: 'thread-with-dashes',
        expected: '/journal/chat/thread-with-dashes',
      },
      { threadId: '12345', expected: '/journal/chat/12345' },
    ];

    testCases.forEach(({ threadId, expected }) => {
      expect(getChatUrl(threadId)).toBe(expected);
    });
  });

  it('should throw error for empty string thread ID', () => {
    expect(() => getChatUrl('')).toThrow('Thread ID cannot be empty');
  });

  it('should throw error for whitespace-only thread ID', () => {
    expect(() => getChatUrl('   ')).toThrow('Thread ID cannot be empty');
    expect(() => getChatUrl('\t')).toThrow('Thread ID cannot be empty');
    expect(() => getChatUrl('\n')).toThrow('Thread ID cannot be empty');
  });
});
