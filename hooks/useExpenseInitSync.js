import { useEffect, useRef } from 'react';

/**
 * Centralized expense initialization and Firestore sync logic.
 * Prevents overwriting local edits when expense updates from Firestore.
 *
 * @param {object} opts
 * @param {object} opts.expense - Current expense (from route or live snapshot)
 * @param {boolean} opts.isEditing - True when editing existing expense
 * @param {boolean} opts.isNewExpense - True when creating new expense
 * @param {object} opts.state - Current expense state (items, participants, etc.)
 * @param {object} opts.actions - Expense context actions
 * @param {boolean} opts.skipSync - When true, skip Firestore sync (e.g. during save)
 * @param {React.MutableRefObject<number>} opts.lastPayerToggleAtRef - Ref with timestamp of last optimistic payer toggle; skip selectedPayers sync for 1s after to prevent flicker
 */
export default function useExpenseInitSync({
  expense,
  isEditing,
  isNewExpense,
  state,
  actions,
  skipSync = false,
  lastPayerToggleAtRef,
}) {
  const initializedIdRef = useRef(null);
  const lastSyncedExpenseRef = useRef(null);

  // Initialize from expense only when we first load this expense (ID changed)
  useEffect(() => {
    if (!expense || (!isEditing && !isNewExpense)) return;

    if (initializedIdRef.current !== expense.id) {
      initializedIdRef.current = expense.id;
      lastSyncedExpenseRef.current = expense;
      actions.initializeFromExpense(expense, isEditing, isNewExpense);
    }
  }, [expense?.id, isEditing, isNewExpense, actions]);

  // Sync from Firestore when editing and expense updates (e.g. from another user or settlement)
  // Skip when we have local changes that would be overwritten
  useEffect(() => {
    if (!expense || !isEditing || skipSync) return;

    if (expense.items) {
      // Don't overwrite when we have more items locally (user added items, hasn't saved)
      if ((state.items || []).length > expense.items.length) return;

      const firestoreKey = expense.items
        .map((i) => `${i.id}:${i.amount}:${i.name}`)
        .sort()
        .join('|');
      const stateKey = (state.items || [])
        .map((i) => `${i.id}:${i.amount}:${i.name}`)
        .sort()
        .join('|');

      // Only sync when Firestore has meaningfully different data (avoid overwriting local edits)
      if (firestoreKey !== stateKey) {
        const itemsWithPayers = expense.items.map((item) => ({
          ...item,
          selectedPayers: item.selectedPayers || [0],
          selectedConsumers: item.selectedConsumers || [0],
        }));
        actions.setItems(itemsWithPayers);
      }
    }

    // Participant order is consistent across devices; use expense.selectedPayers directly.
    const recentlyToggledPayer = lastPayerToggleAtRef?.current && (Date.now() - lastPayerToggleAtRef.current < 1000);
    if (expense.selectedPayers?.length && !recentlyToggledPayer) {
      if (JSON.stringify(expense.selectedPayers) !== JSON.stringify(state.selectedPayers)) {
        actions.setSelectedPayers(expense.selectedPayers);
      }
    }

    if (expense.title && expense.title !== state.title) {
      actions.setTitle(expense.title);
    }

    lastSyncedExpenseRef.current = expense;
  }, [expense, isEditing, skipSync, state.items, state.selectedPayers, state.title, actions, lastPayerToggleAtRef]);

  return { initializedIdRef };
}
