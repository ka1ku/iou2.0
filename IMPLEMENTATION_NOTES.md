# Fee Settlement Locking Implementation

## Problem
When users assign items to people, the app calculates fee proportions based on consumption. If fees are already settled and then item assignments change, the fee proportions become incorrect.

## Solution: Strict Blocking Approach

We implemented the **strictest** approach: block ALL item assignment changes when fees are settled.

### How It Works

#### 1. Detection
- `AddReceiptScreen` checks if any fees are settled: `hasSettledFees`
- This is computed from `lockedItemIds` (which tracks all settled items/fees)

```javascript
const hasSettledFees = useMemo(() => {
  return state.fees.some(fee => lockedItemIds && lockedItemIds.has(fee.id));
}, [state.fees, lockedItemIds]);
```

#### 2. Propagation
- `hasSettledFees` is passed to `ReceiptBreakdown`
- `ReceiptBreakdown` passes both `isLocked` and `isLockedByFees` to each `ItemRow`
  - `isLocked = lockedItemIds.has(item.id) || hasSettledFees`
  - `isLockedByFees = hasSettledFees && !lockedItemIds.has(item.id)`

#### 3. Visual Indicators

**Warning Banner** (when fees are settled):
```
┌────────────────────────────────────────┐
│ 🔒 Fees Are Settled                    │
│ Items cannot be modified because fees  │
│ have been settled. To make changes...  │
└────────────────────────────────────────┘
```

**Item Badges**:
- Directly settled items: ✅ "Settled" (green)
- Locked by fees: 🔒 "Locked (Fees Settled)" (orange/warning)

#### 4. User Flow to Modify Items

When fees are settled:
1. User taps a locked item
2. Alert explains: "Fees Are Settled - Fee splits are calculated based on who consumed each item..."
3. Instructions to unsettle:
   - Go to Split tab
   - Unsettle the fees
   - Return to Track tab to modify items

## Why This Approach?

✅ **Prevents inconsistency** - Fees always match current item assignments
✅ **Clear user feedback** - Users understand exactly why items are locked
✅ **Simple logic** - No complex recalculation or settlement invalidation
✅ **Preserves data** - Settlements aren't accidentally cleared

## Alternative Approaches Considered

1. **Allow new items, block modifications** - Too confusing (why can I add but not modify?)
2. **Warn and recalculate** - Risk of accidentally clearing settlements
3. **Auto-recalculate silently** - Users lose settlement work without warning

## Files Modified

- `screens/AddReceiptScreen.js`:
  - Added `hasSettledFees` calculation
  - Added warning banner when fees are settled
  - Passes `hasSettledFees` to ReceiptBreakdown

- `components/expenses/ReceiptBreakdown.js`:
  - Accepts `hasSettledFees` prop
  - Passes `isLockedByFees` to ItemRow
  - ItemRow shows different alert and badge based on lock reason

- `utils/proportionChecker.js` (NEW):
  - Utilities to detect proportion changes
  - Can be used in future for more advanced approaches

## Tax & Fee Proportion Calculation

Fees are split proportionally based on consumption in `AddReceiptScreen.js`:

```javascript
const calculateParticipantProportionsFromConsumption = (items, participants) => {
  // For each participant, sum up what they consumed
  // Calculate proportion = consumed / totalItems
  // This proportion is then applied to each fee
};

const applyProportionalFeeSplits = (expenseData, participantProportions) => {
  // For each fee, create splits based on proportions
  // Example: Alice consumed 60% → owes 60% of tax
};
```

This recalculation happens automatically when:
- Items change
- Fees are added
- Auto-save triggers

**But now**: If fees are already settled, items are locked and can't be changed!

## Testing Checklist

- [ ] Add items normally (not locked)
- [ ] Settle a fee in Split tab
- [ ] Return to Track tab - see warning banner
- [ ] Try to modify an item - see "Fees Are Settled" alert
- [ ] Unsettle fee in Split tab
- [ ] Return to Track tab - items are editable again
- [ ] Add new item - fee proportions recalculate correctly

## Future Enhancements

If users find this too restrictive, we could:
1. Allow adding NEW items (but lock existing items)
2. Show a "recalculate fees" button that clears settlements
3. Implement smart recalculation that preserves partial settlements
