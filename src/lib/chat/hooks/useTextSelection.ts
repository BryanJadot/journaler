'use client';

import { useEffect, useRef, useCallback } from 'react';

import {
  useSetSelectionAndTooltipPosition,
  useClearSelection,
} from '@/lib/store/thread-store';

/**
 * Handles text selection detection for the quoting feature.
 *
 * Listens for global selection changes and validates that selections are within
 * elements marked with data-selectable="true". Prevents cross-message selections
 * and calculates tooltip positioning. Uses 100ms debouncing for performance.
 *
 * Returns repositionTooltip function for scroll-following tooltip behavior.
 *
 * @example
 * ```tsx
 * function ChatContainer() {
 *   const { repositionTooltip } = useTextSelection();
 *   return <div onScroll={repositionTooltip}>...</div>;
 * }
 * ```
 */
export function useTextSelection() {
  const setSelectionAndTooltipPosition = useSetSelectionAndTooltipPosition();
  const clearSelection = useClearSelection();
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /** Processes and validates text selection - shared between debounced handler and scroll repositioning */
  const processSelection = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      clearSelection();
      return;
    }

    const selectedNode = selection.anchorNode?.parentElement;
    const focusNode = selection.focusNode?.parentElement;

    const anchorInSelectable = selectedNode?.closest(
      '[data-selectable="true"]'
    );
    const focusInSelectable = focusNode?.closest('[data-selectable="true"]');

    if (!anchorInSelectable || !focusInSelectable) {
      clearSelection();
      return;
    }

    if (anchorInSelectable !== focusInSelectable) {
      clearSelection();
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      clearSelection();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const tooltipPosition = {
      left: rect.left + rect.width / 2,
      top: rect.top,
    };

    setSelectionAndTooltipPosition(selectedText, tooltipPosition);
  }, [setSelectionAndTooltipPosition, clearSelection]);

  useEffect(() => {
    /** Debounced handler for browser selection changes */
    const handleSelectionChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        processSelection();
      }, 100);
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [processSelection]);

  return {
    repositionTooltip: processSelection,
  };
}

/**
 * Hook to be used at the app level to set up global text selection handling.
 * This ensures only one listener is active for the entire app.
 */
export function useGlobalTextSelection() {
  useTextSelection();
}
