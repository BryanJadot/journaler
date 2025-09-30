'use client';

import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

import {
  useSelectedText,
  useTooltipPosition,
  useQuoteSelection,
} from '@/lib/store/thread-store';

/**
 * Props interface for the SelectionTooltip component.
 */
interface SelectionTooltipProps {
  /** Optional callback invoked after text is quoted, typically for focus management */
  onQuote?: () => void;
}

/**
 * A floating tooltip that appears when text is selected in assistant messages.
 *
 * Provides the primary interface for the text quoting feature, allowing users
 * to select portions of assistant responses and insert them as formatted quotes
 * in follow-up messages.
 *
 * Design rationale:
 * - Uses fixed positioning to float above selected text without interfering with content
 * - Automatically manages visibility based on selection state from global store
 * - Coordinates with parent components through optional callback for focus management
 *
 * @param props - Component props including optional quote callback
 * @returns A positioned tooltip button or null if no text is selected
 *
 * @example
 * ```tsx
 * // With focus management callback
 * <SelectionTooltip onQuote={() => inputRef.current?.focus()} />
 *
 * // Standalone usage
 * <SelectionTooltip />
 * ```
 */
export default function SelectionTooltip({ onQuote }: SelectionTooltipProps) {
  const selectedText = useSelectedText();
  const tooltipPosition = useTooltipPosition();
  const quoteSelection = useQuoteSelection();

  // Don't render if no selection
  if (!selectedText || !tooltipPosition) {
    return null;
  }

  /** Handles quote button click - inserts text, clears selection, and optionally focuses input */
  const handleQuote = () => {
    quoteSelection();
    window.getSelection()?.removeAllRanges();
    onQuote?.();
  };

  return (
    <div
      className="fixed z-50"
      style={{
        left: `${tooltipPosition.left}px`,
        top: `${tooltipPosition.top - 50}px`,
      }}
    >
      <button
        className="btn btn-sm btn-primary flex items-center gap-1 text-lg"
        onClick={handleQuote}
        aria-label="Quote selected text"
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5" />
        Quote
      </button>
    </div>
  );
}
