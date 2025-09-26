'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';

import { renameThreadAction } from '@/app/journal/chat/actions';
import { ThreadDropdownMenu } from '@/app/journal/components/ThreadDropdownMenu';
import { ThreadNameEditor } from '@/app/journal/components/ThreadNameEditor';
import type { ThreadSummary } from '@/lib/chat/types';
import { getChatUrl } from '@/lib/chat/url-helpers';

interface ThreadItemProps {
  thread: ThreadSummary;
  isActive: boolean;
  onDelete: (threadId: string) => Promise<void>;
  onToggleStar: (threadId: string, starred: boolean) => Promise<void>;
}

/**
 * Individual thread item component with comprehensive inline editing and action management.
 *
 * This component represents a single thread in the sidebar navigation list, providing
 * both navigation functionality and thread management capabilities. It seamlessly
 * transitions between display and edit modes while maintaining a consistent user experience.
 *
 * State management:
 * - Tracks editing mode to switch between link display and input field
 * - Manages dropdown menu visibility and interactions
 * - Handles async operations with proper loading states
 *
 * User interactions:
 * - Click thread name to navigate to that conversation
 * - Hover to reveal dropdown menu with management actions
 * - Double-click or menu action to enter inline edit mode
 * - Keyboard shortcuts for save/cancel during editing
 *
 * Visual feedback:
 * - Highlights active thread based on current URL
 * - Shows loading states during async operations
 * - Provides visual cues for different thread states (starred, etc.)
 *
 * @param thread Thread summary data including id, name, updatedAt, and starred status
 * @param isActive Whether this thread is currently being viewed
 * @param onDelete Callback for handling thread deletion with proper navigation
 * @param onToggleStar Callback for starring/unstarring threads
 */
export function ThreadItem({
  thread,
  isActive,
  onDelete,
  onToggleStar,
}: ThreadItemProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * Initiates inline editing mode for the thread name.
   *
   * Ensures a clean transition by closing any open dropdown menu
   * before switching to edit mode to prevent UI conflicts.
   */
  const handleStartEditing = () => {
    // Close the dropdown menu before entering edit mode
    if (dropdownRef.current) {
      dropdownRef.current.removeAttribute('open');
    }
    setIsEditing(true);
  };

  /**
   * Handles saving the renamed thread with error handling and UI feedback.
   *
   * @param newName The new name for the thread
   * @returns Promise resolving to true if successful, false if error occurred
   */
  const handleSaveRename = async (newName: string) => {
    const result = await renameThreadAction(thread.id, newName);

    if (result.success) {
      // Refresh to update sidebar and thread display
      router.refresh();
      setIsEditing(false);
    } else {
      console.error('Failed to rename thread:', result.error);
      // Keep editing mode active so user can retry or see the error
      return false;
    }

    return true;
  };

  /**
   * Cancels the editing operation and returns to display mode.
   *
   * Resets the component state without saving changes,
   * reverting to the original thread name display.
   */
  const handleCancelEditing = () => {
    setIsEditing(false);
  };

  return (
    <li className="w-full">
      <div
        className={clsx('flex flex-row group w-full p-0', {
          'menu-active': isActive,
        })}
      >
        {isEditing ? (
          <ThreadNameEditor
            initialName={thread.name}
            onSave={handleSaveRename}
            onCancel={handleCancelEditing}
          />
        ) : (
          <>
            <Link
              href={getChatUrl(thread.id)}
              className="flex-1 min-w-0 pl-3 py-1.5 block"
              title={thread.name}
            >
              <div className="truncate">{thread.name}</div>
            </Link>

            <ThreadDropdownMenu
              ref={dropdownRef}
              thread={thread}
              onRename={handleStartEditing}
              onToggleStar={onToggleStar}
              onDelete={onDelete}
            />
          </>
        )}
      </div>
    </li>
  );
}
