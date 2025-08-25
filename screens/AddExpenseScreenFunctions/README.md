# AddExpenseScreen Functions

This directory contains the extracted functions from `AddExpenseScreen.js` to improve code organization and maintainability.

## Functions

### `addItem(items, setItems, participants)`
Creates a new item with default values and adds it to the items array.

### `updateItem(index, field, value, items, setItems, fees, setFees)`
Updates an item's field value and recalculates splits and fees if necessary.

### `updateItemSplit(itemIndex, participantIndex, amount, items, setItems)`
Updates the split amount for a specific participant in an item.

### `removeItem(index, items, setItems, fees, setFees)`
Removes an item and recalculates percentage-based fees.

### `addFee(fees, setFees)`
Creates a new fee with default values and adds it to the fees array.

### `updateFee(index, field, value, fees, setFees, items)`
Updates a fee's field value and recalculates amounts if necessary.

### `removeFee(index, fees, setFees)`
Removes a fee from the fees array.

### `saveExpense(title, participants, items, fees, selectedPayers, joinEnabled, isEditing, expense, navigation, setLoading, calculateTotal)`
Handles the complete expense saving process including validation and API calls.

### `renderItem(item, index, participants, items, setItems, updateItem, removeItem, fees, setFees, styles)`
Renders an individual item with all its components and handlers.

### `addParticipant(participants, setParticipants)`
Adds a new empty participant to the participants array.

### `updateParticipant(index, name, participants, setParticipants)`
Updates a participant's name at the specified index.

### `removeParticipant(index, participants, setParticipants, items, setItems)`
Removes a participant and updates related item splits and consumers accordingly.

### `removePlaceholder(ghostId, placeholders, setPlaceholders, items, setItems, selectedFriends)`
Removes a placeholder participant and updates related item splits and consumers accordingly.

## Usage

These functions are imported and used in `AddExpenseScreen.js` through handler functions that provide the necessary context and state variables.

## Benefits

- **Separation of Concerns**: Business logic is separated from UI rendering
- **Testability**: Functions can be unit tested independently
- **Reusability**: Functions can be reused in other components if needed
- **Maintainability**: Easier to maintain and modify individual functions
- **Code Organization**: Clear structure and better readability
