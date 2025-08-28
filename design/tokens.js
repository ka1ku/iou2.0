// Centralized design tokens for consistent styling across the app

export const Colors = {
  background: '#F5F1E8', // Warm cream background
  surface: '#FFFFFF',
  white: '#FFFFFF', // Pure white for text and icons
  card: '#FFF8F0', // Slightly warmer card background
  surfaceLight: '#FEFCF8', // Very light surface color for subtle backgrounds
  textPrimary: '#2C2C2C',
  textSecondary: '#8A8A8A',
  accent: '#DAA340', // Warm gold/amber accent
  accentDark: '#B8935F',
  success: '#7FB069',
  error: '#E56B6F', // Error color for validation messages
  danger: '#E56B6F',
  warning: '#F39C12', // Warning color for unallocated amounts
  blue: '#4A90E2', // Blue for receipt scanning button
  divider: '#E8E0D5',
  border: '#E8E0D5', // Border color for inputs
  tabActive: '#2C2C2C',
  tabInactive: '#B8935F',
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
  familyRegular: 'Poppins_400Regular',
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


