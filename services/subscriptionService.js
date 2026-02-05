import { 
  initializeRevenueCat, 
  setRevenueCatUserId, 
  handleReceiptScanningAccess,
  hasReceiptScanningAccess,
  getCustomerInfo,
  ENTITLEMENTS
} from './revenueCatService';
import { checkPremiumStatus } from './contactInviteService';


export const initializeSubscriptions = async (userId = null) => {
  try {
    await initializeRevenueCat(userId);
  } catch (error) {
    throw error;
  }
};

export const setSubscriptionUser = async (userId) => {
  try {
    await setRevenueCatUserId(userId);
  } catch (error) {
    throw error;
  }
};

export const canAccessReceiptScanning = async () => {
  const hasSub = await hasReceiptScanningAccess();
  if (hasSub) return true;
  return await checkPremiumStatus();
};

export const requestReceiptScanningAccess = async () => {
  return await handleReceiptScanningAccess();
};

export const getSubscriptionStatus = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    
    const isInvitePremium = await checkPremiumStatus();
    
    return {
      isActive: customerInfo.entitlements.active[ENTITLEMENTS.RECEIPT_SCANNING] !== undefined || isInvitePremium,
      isInvitePremium,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
      allEntitlements: Object.keys(customerInfo.entitlements.all),
      originalAppUserId: customerInfo.originalAppUserId,
      requestDate: customerInfo.requestDate,
      firstSeen: customerInfo.firstSeen,
      originalPurchaseDate: customerInfo.originalPurchaseDate,
      nonSubscriptionTransactions: customerInfo.nonSubscriptionTransactions,
    };
  } catch (error) {
    const isInvitePremium = await checkPremiumStatus();
    return {
      isActive: isInvitePremium,
      isInvitePremium,
      activeEntitlements: [],
      allEntitlements: [],
      error: error.message
    };
  }
};

export const canAccessFeature = async (feature) => {
  const featureAccessMap = {
    'receipt-scanning': () => canAccessReceiptScanning(),
  };

  const accessFunction = featureAccessMap[feature];
  if (!accessFunction) {
    return false;
  }

  return await accessFunction();
};

export const requestFeatureAccess = async (feature) => {
  const featureRequestMap = {
    'receipt-scanning': () => requestReceiptScanningAccess(),
  };

  const requestFunction = featureRequestMap[feature];
  if (!requestFunction) {
    return false;
  }

  return await requestFunction();
};
