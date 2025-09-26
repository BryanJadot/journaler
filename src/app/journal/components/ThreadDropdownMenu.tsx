'use client';

import {
  EllipsisHorizontalIcon,
  PencilIcon,
  StarIcon as StarOutlineIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { forwardRef } from 'react';

import type { ThreadSummary } from '@/lib/chat/types';

interface ThreadDropdownMenuProps {
  thread: ThreadSummary;
  onRename: () => void;
  onToggleStar: (threadId: string, starred: boolean) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
}

/**
 * Contextual dropdown menu providing thread management actions.
 *
 * This component implements a space-efficient action menu that appears on demand,
 * providing users with thread management capabilities without cluttering the UI.
 * The menu uses DaisyUI dropdown components with custom visibility controls.
 *
 * Interaction design:
 * - Invisible by default, becomes visible on hover or keyboard focus
 * - Automatically closes after action selection to prevent stale UI state
 * - Uses semantic button elements for proper accessibility
 * - Provides visual icons alongside text labels for better usability
 *
 * Available actions:
 * - Rename: Triggers inline editing mode in the parent ThreadItem
 * - Star/Unstar: Toggles thread priority status with dynamic icon display
 * - Delete: Permanently removes thread with proper confirmation handling
 *
 * The component uses forwardRef to allow parent components to programmatically
 * control dropdown state, particularly useful for closing menus when other
 * interactions occur.
 *
 * @param thread Thread data including id, name, and starred status
 * @param onRename Callback to initiate rename mode in parent component
 * @param onToggleStar Async callback for starring/unstarring with thread ID and new state
 * @param onDelete Async callback for thread deletion with thread ID
 */
export const ThreadDropdownMenu = forwardRef<
  HTMLDivElement,
  ThreadDropdownMenuProps
>(({ thread, onRename, onToggleStar, onDelete }, ref) => {
  /**
   * Executes menu actions with proper dropdown state management.
   *
   * Ensures the dropdown menu closes before executing the selected action
   * to prevent UI inconsistencies and provide immediate visual feedback.
   *
   * @param action The function to execute (can be sync or async)
   */
  const handleAction = async (action: () => void | Promise<void>) => {
    // Close dropdown immediately to provide responsive UI feedback
    if (ref && 'current' in ref && ref.current) {
      ref.current.removeAttribute('open');
    }
    await action();
  };

  return (
    <div className="shrink-0 dropdown dropdown-end" ref={ref}>
      <div
        tabIndex={0}
        role="button"
        className="invisible group-hover:visible focus:visible pr-3 py-1.5"
      >
        <EllipsisHorizontalIcon className="w-4 h-4" />
      </div>
      <ul
        tabIndex={0}
        className="menu dropdown-content bg-base-100 rounded-box z-10 w-52 p-2 shadow-sm text-base-content"
      >
        <li>
          <button
            onClick={() => handleAction(onRename)}
            className="flex flex-row items-center justify-left"
          >
            <PencilIcon className="w-4 h-4" /> Rename
          </button>
        </li>
        <li>
          <button
            onClick={() =>
              handleAction(() => onToggleStar(thread.id, !thread.starred))
            }
            className="flex flex-row items-center justify-left"
          >
            {thread.starred ? (
              // Show outline icon for unstar action (visual consistency)
              <>
                <StarOutlineIcon className="w-4 h-4" /> Unstar
              </>
            ) : (
              // Show solid icon for star action (indicates result state)
              <>
                <StarSolidIcon className="w-4 h-4" /> Star
              </>
            )}
          </button>
        </li>
        <li>
          <button
            onClick={() => handleAction(() => onDelete(thread.id))}
            className="flex flex-row items-center justify-left"
          >
            <TrashIcon className="w-4 h-4" /> Delete
          </button>
        </li>
      </ul>
    </div>
  );
});

ThreadDropdownMenu.displayName = 'ThreadDropdownMenu';
