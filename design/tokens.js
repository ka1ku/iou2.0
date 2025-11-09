// Centralized design tokens for consistent styling across the app

export const Colors = {
  // Background & Surface Colors
  background: '#F5F1E8', // Warm cream app background
  surface: '#FFFFFF', // Primary surface (cards, modals, headers)
  surfaceElevated: '#FFF8F0', // Elevated surface (cards with more warmth)
  surfaceSubdued: '#FEFCF8', // Subtle background for nested surfaces
  white: '#FFFFFF', // Pure white for text and icons on colored backgrounds
  
  // Text Colors
  textPrimary: '#2C2C2C', // Primary text color
  textSecondary: '#8A8A8A', // Secondary text, hints, labels
  
  // Brand Colors (Primary Actions & Highlights)
  brand: '#F4C645', // Warm gold/amber - primary brand color
  brandMuted: '#B8935F', // Muted brand color for inactive states
  
  // Financial State Colors
  settled: '#7FB069', // Green - settled expenses, positive balances, "you're owed"
  debt: '#E56B6F', // Red - debt states, "you owe", negative balances
  pending: '#F39C12', // Orange - pending settlements, unallocated amounts, warnings
  
  // Feature-Specific Colors
  receipt: '#4A90E2', // Blue - receipt scanning, receipt badges
  
  // Border & Divider Colors
  border: '#E8E0D5', // Border color for inputs, cards, dividers
  divider: '#E8E0D5', // Divider between sections (alias for border)
  
  // Navigation Colors
  navActive: '#2C2C2C', // Active tab/text color
  navInactive: '#B8935F', // Inactive tab/text color (uses brandMuted)
  
  // Semantic Color Aliases (for backward compatibility)
  accent: '#F4C645', // Alias for brand
  accentDark: '#B8935F', // Alias for brandMuted
  success: '#7FB069', // Alias for settled
  error: '#E56B6F', // Alias for debt
  danger: '#E56B6F', // Alias for debt
  warning: '#F39C12', // Alias for pending
  blue: '#4A90E2', // Alias for receipt
  card: '#FFF8F0', // Alias for surfaceElevated
  surfaceLight: '#FEFCF8', // Alias for surfaceSubdued
  tabActive: '#2C2C2C', // Alias for navActive
  tabInactive: '#B8935F', // Alias for navInactive
  green: '#4CAF50', // Chart/data visualization color (legacy - prefer settled)
  red: '#ff4444', // Chart/data visualization color (legacy - prefer debt)
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 12,
  md: 20,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
};

export const Typography = {
  // Poppins font family keys we will load in App.js
  familyMedium: 'Poppins_500Medium',
  familySemiBold: 'Poppins_600SemiBold',
  familyBold: 'Poppins_700Bold',

  h1: {
    fontSize: 32,
    fontFamily: 'Poppins_700Bold',
  },
  h2: {
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
  },
  h3: {
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  body: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  body1: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
  },
  body2: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  caption: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
  },
};


