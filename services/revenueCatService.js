import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';


import { Platform } from 'react-native';

const REVENUECAT_CONFIG = {
  apiKey: Platform.select({
    ios: 'appl_pgTAldGQhisRrPVshAixwbYUgYe',
    android: 'goog_PLACEHOLDER_KEY', // TODO: Add your Android RevenueCat API Key here
  }),
  logLevel: Purchases.LOG_LEVEL.DEBUG,
};

export const ENTITLEMENTS = {
  RECEIPT_SCANNING: 'receipt-scanning',
};

export const initializeRevenueCat = async (userId = null) => {
  try {
    await Purchases.configure({
      apiKey: REVENUECAT_CONFIG.apiKey,
      appUserID: userId,
    });

    Purchases.setLogLevel(REVENUECAT_CONFIG.logLevel);

    // Test connection to verify configuration
    await testRevenueCatConnection();

    return true;
  } catch (error) {
    console.error('[RevenueCat] Initialization failed:', error);
    // In development or if needed for debugging, we might want to alert this
    if (__DEV__) {
      console.warn('RevenueCat Init Error:', error.message);
    }
    return false;
  }
};

export const testRevenueCatConnection = async () => {
  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current) {
    } else {
    }
  } catch (error) {
  }
};

export const setRevenueCatUserId = async (userId) => {
  try {
    await Purchases.setAppUserID(userId);
  } catch (error) {
    throw error;
  }
};

export const checkUserEntitlement = async (entitlementId) => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[entitlementId] !== undefined;
  } catch (error) {
    return true;
  }
};

export const getCustomerInfo = async () => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    throw error;
  }
};

export const getOfferings = async () => {
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    throw error;
  }
};

export const presentPaywall = async (options = {}) => {
  try {
    const offerings = await getOfferings();

    if (!offerings.current) {
      console.error('[RevenueCat] No current offering found. Check RevenueCat dashboard.');
      throw new Error('No current offering found');
    }

    const paywallResult = await RevenueCatUI.presentPaywall({
      offering: offerings.current,
      onDismiss: options.onDismiss || (() => {
      }),
      onRestoreCompleted: options.onRestoreCompleted || (({ customerInfo }) => {
      })
    });

    return paywallResult;
  } catch (error) {
    console.error('[RevenueCat] Error presenting paywall:', error);
    throw error;
  }
};

export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    throw error;
  }
};

export const hasReceiptScanningAccess = async () => {
  return await checkUserEntitlement(ENTITLEMENTS.RECEIPT_SCANNING);
};

export const presentReceiptScanningPaywall = async () => {
  return await presentPaywall({
    onDismiss: () => {
    },
    onRestoreCompleted: ({ customerInfo }) => {
    }
  });
};

export const handleReceiptScanningAccess = async () => {
  try {
    const hasAccess = await hasReceiptScanningAccess();

    if (hasAccess) {
      return true;
    }

    const paywallResult = await presentReceiptScanningPaywall();

    if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
};
