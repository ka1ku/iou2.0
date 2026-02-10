# Settlement Blocking Implementation

## Overview

This implementation ensures that:
1. **Tax and fees are always split proportionally** based on what each person consumed
2. **Once settled, EVERYTHING is locked** - no items or fees can be added/modified
3. **Settlement requires validation** - all items must be assigned and a payer must be selected

## How It Works

### 1. Pre-Settlement Validation

Before any settlement action (`markAsPaid`, `makePayment`, `requestPayment`), the system validates:

✅ **Paid By is selected** - Someone must have paid for the receipt
✅ **All items are assigned** - Every item must be assigned to at least one person
✅ **All items have valid amounts** - Every item must have a price > $0.00

If validation fails, settlement is blocked and user sees a clear error message:

```
┌─────────────────────────────────────┐
│ Cannot Settle                       │
│                                     │
│ 3 items are not assigned to anyone.│
│ Please assign all items before     │
│ settling.                           │
│                                     │
│ Unassigned:                         │
│ • Coffee                            │
│ • Sandwich                          │
│ • Cookie                            │
└─────────────────────────────────────┘
```

### 2. Post-Settlement Locking

Once ANY settlement action is taken (marked as paid, partial payment, etc.):

🔒 **Track Tab**:
- Warning banner appears at top
- "Add Item" button is disabled
- All existing items are locked
- All fee inputs are disabled
- "Add Fee" button is disabled

🔒 **Items Show Lock Status**:
- Directly settled items: ✅ "Settled" (green checkmark)
- Locked by settlement: 🔒 "Locked (Settled)" (orange lock)

### 3. User Flow

#### Normal Flow (No Settlement):
```
1. Add items → 2. Assign people → 3. Add fees → 4. Go to Split tab → 5. Settle
```

#### Blocked Flow (Missing Assignment):
```
1. Add items
2. Skip assignment ❌
3. Go to Split tab
4. Try to settle
5. ⛔ Alert: "Cannot Settle - items not assigned"
6. Return to Track tab
7. Assign items
8. Return to Split tab
9. Settle ✅
```

#### Locked Flow (After Settlement):
```
1. Receipt is settled
2. Go to Track tab
3. See warning banner 🔒
4. Try to add item
5. ⛔ Alert: "Cannot add items to settled receipt"
6. Go to Split tab
7. Unsettle
8. Return to Track tab
9. Items unlocked ✅
```

## Tax & Fee Proportion Calculation

Fees are split proportionally based on consumption:

### Example:
```
Items:
- Burger ($10) → Alice
- Fries ($5) → Bob
- Drink ($5) → Alice

Alice consumed: $15 (75%)
Bob consumed: $5 (25%)

Tax ($4):
- Alice owes: $3.00 (75% of $4)
- Bob owes: $1.00 (25% of $4)
```

### Why Locking Matters:
If you could add a new item after fees are settled:

```
NEW: Cookie ($10) → Bob

Now:
Alice consumed: $15 (50%)
Bob consumed: $15 (50%)

Tax ($4) SHOULD BE:
- Alice owes: $2.00 (50% of $4)  ← CHANGED!
- Bob owes: $2.00 (50% of $4)    ← CHANGED!

But Alice already paid $3.00... 🤔
```

**Solution**: Lock everything once settled to prevent this inconsistency.

## Implementation Details

### Files Modified

**`screens/AddReceiptScreen.js`**:
- `validateForSettlement()` - Validates before allowing settlement
- `handleSettlementActionWithValidation()` - Wraps settlement actions with validation
- `isSettled` - Single flag for "is anything settled?"
- Warning banner when `isSettled === true`
- Disabled fee inputs when settled

**`components/expenses/ReceiptBreakdown.js`**:
- Accepts `isSettled` prop
- Disables "Add Item" button when settled
- Passes `isLockedBySettlement` to each ItemRow
- Shows clear alerts when user tries to modify locked items

**`hooks/useSettlementActions.js`** (unchanged):
- Already handles settlement persistence
- Already tracks `lockedItemIds`
- Settlement calculation respects item assignments

## Validation Messages

### Missing Payer:
```
Cannot Settle

Please select who paid for this receipt before settling.
```

### Unassigned Items:
```
Cannot Settle

3 items are not assigned to anyone. Please assign all items before settling.

Unassigned:
• Coffee
• Sandwich
• Cookie
```

### Invalid Amounts:
```
Cannot Settle

All items must have a valid price greater than $0.00
```

### Trying to Add When Settled:
```
Receipt Settled

Cannot add items to a settled receipt. Go to Split tab and unsettle first.
```

```
Receipt Settled

Cannot add fees to a settled receipt. Unsettle first.
```

## Testing Checklist

- [ ] **Validation Works**:
  - [ ] Try to settle without selecting "Paid By" → blocked
  - [ ] Try to settle with unassigned items → blocked with list
  - [ ] Try to settle with $0 items → blocked
  - [ ] Settle with everything valid → succeeds

- [ ] **Locking Works**:
  - [ ] After settling, see warning banner on Track tab
  - [ ] Try to add item → blocked with alert
  - [ ] Try to add fee → blocked (button disabled)
  - [ ] Try to modify existing item → blocked with alert
  - [ ] Fee input fields are disabled

- [ ] **Unlocking Works**:
  - [ ] Go to Split tab while settled
  - [ ] Unsettle (undo mark as paid)
  - [ ] Return to Track tab
  - [ ] Warning banner gone
  - [ ] Can add items again
  - [ ] Can add fees again

- [ ] **Fee Proportions**:
  - [ ] Add items with different people assigned
  - [ ] Add a percentage tax (e.g., 10%)
  - [ ] Verify tax splits match consumption proportions
  - [ ] Settle
  - [ ] Verify proportions don't change

## Edge Cases Handled

1. **Partial Settlement**: If some items settled but not all, entire receipt is locked
2. **Multiple Payers**: Validation passes if at least one payer selected
3. **Custom Fee Splits**: Proportional calculation respects custom splits if defined
4. **Empty Receipt**: Cannot settle an empty receipt (no items)
5. **Zero-Amount Items**: Blocked from settlement validation

## Future Enhancements

If users find this too restrictive:
1. Allow "draft" vs "finalized" settlement modes
2. Show a "recalculate fees" warning instead of hard blocking
3. Allow unsettling individual items instead of all-or-nothing
