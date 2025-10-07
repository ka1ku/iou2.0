// Standardized error handling utilities

// Common error types and their user-friendly messages
export const ERROR_MESSAGES = {
  // Authentication errors
  'auth/invalid-phone-number': 'Invalid phone number format. Please enter a valid phone number.',
  'auth/too-many-requests': 'Too many verification attempts. Please try again later.',
  'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
  'auth/invalid-app-credential': 'Invalid app credential. Please check your Firebase configuration.',
  'auth/app-not-authorized': 'This app is not authorized to use Firebase Authentication. Please check your Firebase console settings.',
  'auth/invalid-oauth-client-id': 'Firebase configuration error. Please ensure you have the correct GoogleService-Info.plist and google-services.json files from your Firebase Console.',
  'auth/invalid-verification-code': 'Invalid verification code. Please check the code and try again.',
  'auth/invalid-verification-id': 'Verification session expired. Please request a new code.',
  'auth/code-expired': 'Verification code has expired. Please request a new code.',
  
  // General errors
  'MISSING_USER_ID': 'Missing user ID',
  'MISSING_EXPENSE_ID': 'Missing expense ID',
  'EXPENSE_NOT_FOUND': 'Expense not found',
  'USER_PROFILE_NOT_FOUND': 'User profile not found',
  'INVALID_JOIN_LINK': 'Invalid join link',
  'INVALID_ROOM_CODE': 'Invalid room code',
  'JOINING_DISABLED': 'Joining is disabled for this expense',
  'PHONE_NUMBER_REQUIRED': 'Phone number required',
  'MISSING_JOIN_PARAMETERS': 'Missing join parameters',
  'MISSING_REQUIRED_FIELDS': 'Missing required user data: firstName and lastName are required',
  'MISSING_USERNAME': 'Missing required user data: username is required',
  'MISSING_PHONE_NUMBER': 'Missing phone number',
  'NO_USER_SIGNED_IN': 'No user signed in',
  'ACCOUNT_EXISTS': 'An account with this phone number already exists. Please sign in instead or use a different phone number.',
};

// Standardized error handler that provides user-friendly messages
export const handleError = (error, context = '') => {
  // If it's already a user-friendly error message, return as is
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle Firebase Auth errors
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  
  // Handle custom error messages
  if (error.message && ERROR_MESSAGES[error.message]) {
    return ERROR_MESSAGES[error.message];
  }
  
  // For unknown errors, provide a generic message with context
  const contextMessage = context ? ` (${context})` : '';
  return `An unexpected error occurred${contextMessage}. Please try again.`;
};

// Wrapper for async functions with standardized error handling
export const withErrorHandling = (asyncFunction, context = '') => {
  return async (...args) => {
    try {
      return await asyncFunction(...args);
    } catch (error) {
      const friendlyMessage = handleError(error, context);
      throw new Error(friendlyMessage);
    }
  };
};

// Utility to log errors for debugging while showing user-friendly messages
export const logAndHandleError = (error, context = '') => {
  // Log the full error for debugging
  console.error(`Error in ${context}:`, error);
  
  // Return user-friendly message
  return handleError(error, context);
};