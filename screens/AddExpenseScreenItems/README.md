# AddExpenseScreenItems - Refactored Components

This directory contains all the refactored components from the `AddExpenseScreen.js`, broken down into smaller, reusable components for better maintainability and code organization.

## Component Structure

### Item Components
- **`ItemHeader.js`** - Item name input and delete button
- **`PriceInputSection.js`** - Price input with external dollar sign
- **`WhoConsumedSection.js`** - Participant selection for who consumed the item

### Fee Components
- **`FeeHeader.js`** - Fee name input and delete button
- **`FeeTypeSection.js`** - Fee type selection (percentage vs fixed)
- **`PercentageSection.js`** - Percentage-based fee calculation
- **`SplitTypeSection.js`** - Fee split type selection
- **`TotalFeeSection.js`** - Total fee amount display
- **`FixedAmountSection.js`** - Fixed amount fee input

### Screen Layout Components
- **`Header.js`** - Top navigation bar with back button, title, and settings
- **`ExpenseDetailsSection.js`** - Expense title input and total amount display
- **`ParticipantsSection.js`** - Friend selector and placeholder management
- **`WhoPaidSection.js`** - Who paid for the expense selection
- **`ItemsSection.js`** - Items list with add button and empty state
- **`FeesSection.js`** - Fees list with add button and empty state
- **`Footer.js`** - Save button at the bottom
- **`SettingsModal.js`** - Expense settings modal

## New Expense Structure

The AddExpenseScreen has been restructured to better handle complex expense scenarios:

### **Global Payment Management**
- **Who Paid**: Global section after participants to select who fronted money for the entire expense
- **Multiple Payers**: Support for multiple people paying different amounts
- **Payment Summary**: Clear display of total amount being fronted

### **Item-Level Consumption Management**
- **Who Consumed**: Each item now tracks which participants consumed it
- **Multiple Consumers**: Support for items shared among multiple people
- **Automatic Calculation**: Item costs are automatically distributed among consumers

### **Benefits of New Structure**
1. **Clearer Mental Model**: Separates "who paid" from "who consumed"
2. **Better for Group Scenarios**: Multiple people can pay, multiple people can consume
3. **Easier Settlement**: Clear net positions for each person
4. **More Realistic**: Matches how people actually think about group expenses

## Benefits of Refactoring

1. **Maintainability** - Each component has a single responsibility
2. **Reusability** - Components can be used in other parts of the app
3. **Testing** - Easier to write unit tests for individual components
4. **Readability** - Main screen file is much cleaner and easier to understand
5. **Debugging** - Issues can be isolated to specific components

## Usage

Import components from the index file:

```javascript
import {
  ItemHeader,
  PriceInputSection,
  WhoConsumedSection,
  FeeHeader,
  FeeTypeSection,
  PercentageSection,
  SplitTypeSection,
  TotalFeeSection,
  FixedAmountSection,
  Header,
  ExpenseDetailsSection,
  ParticipantsSection,
  WhoPaidSection,
  ItemsSection,
  FeesSection,
  Footer,
  SettingsModal
} from '../AddExpenseScreenItems';
```

## Component Props

Each component is documented with JSDoc comments explaining:
- Component purpose
- Required and optional props
- Prop types and descriptions
- Return values

## Styling

All styles are co-located with their respective components, making it easy to:
- Modify component appearance
- Maintain consistent design tokens
- Debug styling issues
- Understand component layout

## Migration Notes

The original `AddExpenseScreen.js` has been updated to use these components and implement the new expense structure. The new structure significantly improves the app's ability to handle complex real-world expense scenarios while maintaining the exact same functionality and appearance.
