# Custom Hooks

This directory contains custom React hooks for the IOU 2.0 application.

## useFormChangeTracker

A hook that tracks changes in form data and provides functionality to check if a form has been modified.

### Usage

```javascript
const { hasChanges, updateChangeStatus, resetChanges } = useFormChangeTracker(
  initialData, // The initial form data to compare against
  isEditing    // Whether the form is in edit mode
);
```

## useNavigationWarning

A hook that warns users when they try to navigate away from a form with unsaved changes.

### Usage

```javascript
useNavigationWarning(
  hasChanges,           // Whether the form has unsaved changes
  navigation,           // Navigation object from React Navigation
  onConfirmNavigation,  // Optional callback when user confirms navigation
  warningMessage        // Optional custom warning message
);
```

### Features

- Prevents navigation when there are unsaved changes
- Shows confirmation dialog with Cancel/Leave options
- Handles back button press, swipe gestures, and hardware back button
- Works with both AddExpenseScreen and AddReceiptScreen
- Automatically resets after successful save
