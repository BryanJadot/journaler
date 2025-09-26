'use client';

import { useState, useRef, useEffect } from 'react';

interface ThreadNameEditorProps {
  initialName: string;
  onSave: (newName: string) => Promise<boolean>;
  onCancel: () => void;
}

/**
 * Specialized inline editor component for thread name modification.
 *
 * This component provides a focused editing experience for renaming threads,
 * with careful attention to user experience details and edge cases. It handles
 * the complete editing lifecycle from initialization to completion.
 *
 * User experience features:
 * - Automatically focuses and selects text when activated for quick editing
 * - Supports keyboard shortcuts (Enter to save, Escape to cancel)
 * - Handles mouse interactions gracefully with blur delays
 * - Prevents accidental cancellation during save operations
 *
 * Validation and constraints:
 * - Client-side validation for empty names and length limits
 * - Matches database schema constraints (255 character limit)
 * - Trims whitespace automatically before submission
 * - Detects unchanged names to avoid unnecessary API calls
 *
 * Error handling:
 * - Maintains edit mode when save operations fail
 * - Re-focuses input field after failed saves for user convenience
 * - Provides visual feedback during async save operations
 *
 * @param initialName The current thread name to edit
 * @param onSave Async callback that handles the save operation, returns success boolean
 * @param onCancel Callback triggered when editing is cancelled
 */
export function ThreadNameEditor({
  initialName,
  onSave,
  onCancel,
}: ThreadNameEditorProps) {
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select all text when editor becomes active
    // This provides immediate editing capability without additional clicks
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  /**
   * Handles form submission with validation and error recovery.
   *
   * Validates the input, calls the save callback, and manages UI state
   * based on the operation result. Keeps the editor active if save fails.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    // Skip save operation for empty or unchanged names
    if (!trimmedName || trimmedName === initialName) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    const success = await onSave(trimmedName);
    setIsSubmitting(false);

    if (!success) {
      // Maintain editing session on failure for user convenience
      inputRef.current?.focus();
    }
  };

  /**
   * Handles input blur events with timing consideration for form submission.
   *
   * Uses a short delay to allow form submission to complete before cancelling,
   * preventing race conditions between blur and submit events.
   */
  const handleBlur = () => {
    // Delay cancellation to allow form submission to process first
    setTimeout(() => {
      if (!isSubmitting) {
        onCancel();
      }
    }, 200);
  };

  /**
   * Handles keyboard shortcuts for editor operations.
   *
   * Supports Escape key for immediate cancellation without saving changes.
   * Enter key submission is handled by form onSubmit event.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-w-0 pl-3 pr-1">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="input input-sm input-bordered w-full text-base-content input-x"
        maxLength={255}
        disabled={isSubmitting}
        placeholder="Thread name..."
      />
    </form>
  );
}
