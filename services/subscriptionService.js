import { 
  initializeRevenueCat, 
  setRevenueCatUserId, 
  handleReceiptScanningAccess,
  hasReceiptScanningAccess,
  getCustomerInfo,
  ENTITLEMENTS
} from './revenueCatService';

/**
 * Subscription Service
 * High-level subscription management and feature access control
 */

/**
 * Initialize subscription system
 * @param {string} userId - Optional user ID
 * @returns {Promise<void>}
 */
export const initializeSubscriptions = async (userId = null) => {
  try {
    await initializeRevenueCat(userId);
    console.log('Subscription system initialized');
  } catch (error) {
    console.error('Error initializing subscription system:', error);
    throw error;
  }
};

/**
 * Set user for subscription system
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const setSubscriptionUser = async (userId) => {
  try {
    await setRevenueCatUserId(userId);
    console.log('Subscription user set:', userId);
  } catch (error) {
    console.error('Error setting subscription user:', error);
    throw error;
  }
};

/**
 * Check if user can access receipt scanning
 * @returns {Promise<boolean>} True if user has access
 */
export const canAccessReceiptScanning = async () => {
  return await hasReceiptScanningAccess();
};

/**
 * Request access to receipt scanning (shows paywall if needed)
 * @returns {Promise<boolean>} True if access granted
 */
export const requestReceiptScanningAccess = async () => {
  return await handleReceiptScanningAccess();
};

/**
 * Get user's subscription status
 * @returns {Promise<Object>} Subscription status information
 */
export const getSubscriptionStatus = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    
    return {
      isActive: customerInfo.entitlements.active[ENTITLEMENTS.RECEIPT_SCANNING] !== undefined,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
      allEntitlements: Object.keys(customerInfo.entitlements.all),
      originalAppUserId: customerInfo.originalAppUserId,
      requestDate: customerInfo.requestDate,
      firstSeen: customerInfo.firstSeen,
      originalPurchaseDate: customerInfo.originalPurchaseDate,
      nonSubscriptionTransactions: customerInfo.nonSubscriptionTransactions,
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      isActive: false,
      activeEntitlements: [],
      allEntitlements: [],
      error: error.message
    };
  }
};

/**
 * Feature access control - checks if user can use a specific feature
 * @param {string} feature - Feature identifier
 * @returns {Promise<boolean>} True if user can access feature
 */
export const canAccessFeature = async (feature) => {
  const featureAccessMap = {
    'receipt-scanning': () => canAccessReceiptScanning(),
    // Add more features as needed
  };

  const accessFunction = featureAccessMap[feature];
  if (!accessFunction) {
    console.warn(`Unknown feature: ${feature}`);
    return false;
  }

  return await accessFunction();
};

/**
 * Request access to a specific feature
 * @param {string} feature - Feature identifier
 * @returns {Promise<boolean>} True if access granted
 */
export const requestFeatureAccess = async (feature) => {
  const featureRequestMap = {
    'receipt-scanning': () => requestReceiptScanningAccess(),
    // Add more features as needed
  };

  const requestFunction = featureRequestMap[feature];
  if (!requestFunction) {
    console.warn(`Unknown feature: ${feature}`);
    return false;
  }

  return await requestFunction();
};
