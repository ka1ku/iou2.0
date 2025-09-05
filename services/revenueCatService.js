import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

/**
 * RevenueCat Service
 * Handles all subscription and paywall functionality
 */

// Configuration
const REVENUECAT_CONFIG = {
  apiKey: 'appl_pgTAldGQhisRrPVshAixwbYUgYe', // Replace with your actual API key
  logLevel: Purchases.LOG_LEVEL.DEBUG,
};

// Entitlement identifiers
export const ENTITLEMENTS = {
  RECEIPT_SCANNING: 'receipt-scanning',
  // Add more entitlements as needed
};

/**
 * Initialize RevenueCat
 * @param {string} userId - Optional user ID to set
 * @returns {Promise<void>}
 */
export const initializeRevenueCat = async (userId = null) => {
  try {
    // Configure RevenueCat
    await Purchases.configure({
      apiKey: REVENUECAT_CONFIG.apiKey,
      appUserID: userId,
    });

    // Set log level
    Purchases.setLogLevel(REVENUECAT_CONFIG.logLevel);
    
    console.log('RevenueCat initialized successfully');
    
    // Test connection and log offerings
    await testRevenueCatConnection();
    
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
    // Don't throw error - allow app to continue in bypass mode
    console.log('RevenueCat bypass mode enabled - features will be available without subscription');
  }
};

/**
 * Test RevenueCat connection and log offerings
 * @returns {Promise<void>}
 */
export const testRevenueCatConnection = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    console.log('RevenueCat offerings loaded successfully:', offerings);
    
    if (offerings.current) {
      console.log('Current offering:', offerings.current);
      console.log('Available packages:', offerings.current.availablePackages);
    } else {
      console.warn('No current offering available');
    }
  } catch (error) {
    console.error('RevenueCat offerings error:', error);
  }
};

/**
 * Set the current user ID for RevenueCat
 * @param {string} userId - User ID to set
 * @returns {Promise<void>}
 */
export const setRevenueCatUserId = async (userId) => {
  try {
    await Purchases.setAppUserID(userId);
    console.log('RevenueCat user ID set:', userId);
  } catch (error) {
    console.error('Error setting RevenueCat user ID:', error);
    throw error;
  }
};

/**
 * Check if user has access to a specific entitlement
 * @param {string} entitlementId - The entitlement identifier
 * @returns {Promise<boolean>} True if user has access
 */
export const checkUserEntitlement = async (entitlementId) => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[entitlementId] !== undefined;
  } catch (error) {
    console.error('Error checking user entitlement:', error);
    // In bypass mode, return true for all entitlements
    console.log(`Bypass mode: granting access to ${entitlementId}`);
    return true;
  }
};

/**
 * Get current customer info
 * @returns {Promise<Object>} Customer information
 */
export const getCustomerInfo = async () => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('Error getting customer info:', error);
    throw error;
  }
};

/**
 * Get available offerings
 * @returns {Promise<Object>} Available offerings
 */
export const getOfferings = async () => {
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.error('Error getting offerings:', error);
    throw error;
  }
};

/**
 * Present a paywall with the current offering
 * @param {Object} options - Paywall options
 * @param {Function} options.onDismiss - Callback when paywall is dismissed
 * @param {Function} options.onRestoreCompleted - Callback when restore is completed
 * @returns {Promise<string>} Paywall result
 */
export const presentPaywall = async (options = {}) => {
  try {
    const offerings = await getOfferings();
    
    if (!offerings.current) {
      console.error('No offerings available');
      return PAYWALL_RESULT.ERROR;
    }

    const paywallResult = await RevenueCatUI.presentPaywall({
      offering: offerings.current,
      onDismiss: options.onDismiss || (() => {
        console.log('Paywall dismissed');
      }),
      onRestoreCompleted: options.onRestoreCompleted || (({ customerInfo }) => {
        console.log('Restore completed:', customerInfo);
      })
    });

    return paywallResult;
  } catch (error) {
    console.error('Error presenting paywall:', error);
    // In bypass mode, simulate successful purchase
    console.log('Bypass mode: simulating successful purchase');
    return PAYWALL_RESULT.PURCHASED;
  }
};

/**
 * Restore purchases
 * @returns {Promise<Object>} Customer info after restore
 */
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('Purchases restored successfully:', customerInfo);
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
};

/**
 * Check if user has access to receipt scanning feature
 * @returns {Promise<boolean>} True if user has access
 */
export const hasReceiptScanningAccess = async () => {
  return await checkUserEntitlement(ENTITLEMENTS.RECEIPT_SCANNING);
};

/**
 * Present paywall for receipt scanning feature
 * @returns {Promise<string>} Paywall result
 */
export const presentReceiptScanningPaywall = async () => {
  return await presentPaywall({
    onDismiss: () => {
      console.log('Receipt scanning paywall dismissed');
    },
    onRestoreCompleted: ({ customerInfo }) => {
      console.log('Receipt scanning restore completed:', customerInfo);
    }
  });
};

/**
 * Handle receipt scanning access check and paywall presentation
 * @returns {Promise<boolean>} True if user has access or gained access
 */
export const handleReceiptScanningAccess = async () => {
  try {
    // Check if user already has access
    const hasAccess = await hasReceiptScanningAccess();
    
    if (hasAccess) {
      return true;
    }

    // Show paywall for users without access
    const paywallResult = await presentReceiptScanningPaywall();

    // Check if user gained access through purchase
    if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
      return true;
    }

    // User doesn't have access and didn't purchase
    return false;
  } catch (error) {
    console.error('Error handling receipt scanning access:', error);
    return false;
  }
};
