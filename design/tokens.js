// Centralized design tokens for consistent styling across the app

export const Colors = {
  // Background & Surface Colors (clean, polished palette)
  background: '#FAF8F3', // Soft warm beige - lighter and more modern, works beautifully with gold
  surface: '#FFFFFF', // Pure white for cards, modals, headers - crisp contrast
  surfaceElevated: '#FFFFFF', // Keep white for elevated surfaces
  surfaceSubdued: '#F8F6F1', // Very subtle warm tint for nested surfaces
  white: '#FFFFFF', // Pure white for text and icons on colored backgrounds
  
  // Text Colors (crisp and readable)
  textPrimary: '#1F1F1F', // Deep charcoal - excellent readability
  textSecondary: '#757575', // Medium gray - clear secondary text
  
  // Brand Colors (Primary Actions & Highlights)
  brand: '#F4C645', // Vibrant gold/amber - primary brand color
  brandMuted: '#F4C645', // Same gold for inactive (will use opacity instead)
  brandDark: '#E5B735', // Slightly deeper gold for hover/pressed states
  brandLight: '#FFF4D6', // Very light gold tint for backgrounds
  
  // Financial State Colors (bright, clear, professional)
  settled: '#4CAF50', // Material green - clear positive state
  debt: '#F44336', // Material red - clear negative state
  pending: '#FF9800', // Material orange - clear warning state
  
  // Feature-Specific Colors
  receipt: '#2196F3', // Material blue - clean and professional for receipts
  
  // Border & Divider Colors (subtle but defined)
  border: '#E8E4DC', // Warm light beige border - subtle but visible
  divider: '#F0EDE6', // Even lighter warm divider
  
  // Navigation Colors
  navActive: '#1F1F1F', // Active tab/text color (deep charcoal)
  navInactive: '#BDBDBD', // Inactive tab/text color (light gray - clean look)
  
  // Semantic Color Aliases (for backward compatibility)
  accent: '#F4C645', // Alias for brand
  accentDark: '#E5B735', // Alias for brandDark
  success: '#4CAF50', // Alias for settled
  error: '#F44336', // Alias for debt
  danger: '#F44336', // Alias for debt
  warning: '#FF9800', // Alias for pending
  blue: '#2196F3', // Alias for receipt
  card: '#FFFFFF', // Alias for surfaceElevated
  surfaceLight: '#F8F6F1', // Alias for surfaceSubdued
  tabActive: '#1F1F1F', // Alias for navActive
  tabInactive: '#BDBDBD', // Alias for navInactive
  green: '#4CAF50', // Chart/data visualization color (material green)
  red: '#F44336', // Chart/data visualization color (material red)

  // Venmo
  venmo: '#008CFF', // Official Venmo blue
  venmoDark: '#006FCC', // Darker Venmo blue for pressed states

  // Settlement status colors
  statusPending: '#FF9800', // Amber for pending/awaiting
  statusSettled: '#4CAF50', // Green for settled
  statusPartial: '#FF9800', // Amber for partially settled
  statusPaymentSent: '#2196F3', // Blue for payment sent
  statusChanged: '#FF6F00', // Deep amber for price changed badge
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


