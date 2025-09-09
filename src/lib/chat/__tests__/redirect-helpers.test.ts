import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

import { DEFAULT_THREAD_NAME } from '../constants';
import { getOrCreateChatUrl } from '../redirect-helpers';
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

    expect(result).toBe('/chat/thread-123');
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

    expect(result).toBe('/chat/new-thread-456');
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

    expect(result).toBe('/chat/undefined-thread-789');
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

    expect(result).toBe('/chat/user2-thread-abc');
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(userId2);
  });
});
