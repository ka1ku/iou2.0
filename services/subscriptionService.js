import { 
  initializeRevenueCat, 
  setRevenueCatUserId, 
  handleReceiptScanningAccess,
  hasReceiptScanningAccess,
  getCustomerInfo,
  ENTITLEMENTS
} from './revenueCatService';
import { checkPremiumStatus } from './contactInviteService';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  increment 
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getCurrentUser } from './authService';

const SCAN_LIMIT_PER_WEEK = 3;

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

// Check if user has free scans remaining
export const checkScanLimit = async () => {
  try {
    const user = getCurrentUser();
    if (!user) return false;

    const firestore = getFirestore(getApp());
    const userRef = doc(firestore, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      return true; 
    }

    const userData = snapshot.data();
    const scanStats = userData.scanStats || {};
    
    // If no stats yet, they haven't scanned anything
    if (!scanStats.lastResetDate) {
      return true;
    }

    const lastReset = scanStats.lastResetDate?.toDate() || new Date();
    const now = new Date();
    
    // Check if a week has passed since last reset
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - lastReset.getTime() > oneWeekInMs) {
      // It's been more than a week, reset the count
      await updateDoc(userRef, {
        scanStats: {
          count: 0,
          lastResetDate: serverTimestamp()
        }
      });
      return true;
    }

    return (scanStats.count || 0) < SCAN_LIMIT_PER_WEEK;
  } catch (error) {
    return false; // Fail safe
  }
};

// Increment the scan count
export const incrementScanUsage = async () => {
  try {
    const user = getCurrentUser();
    if (!user) return;

    const firestore = getFirestore(getApp());
    const userRef = doc(firestore, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) return;

    const userData = snapshot.data();
    
    // Check if scanStats exists to determine if we need to initialize or update
    if (!userData.scanStats) {
      // Initialize stats
      await updateDoc(userRef, {
        scanStats: {
          count: 1,
          lastResetDate: serverTimestamp()
        }
      });
    } else {
      // Increment count
      await updateDoc(userRef, {
        'scanStats.count': increment(1)
      });
    }
  } catch (error) {
  }
};

export const canAccessReceiptScanning = async () => {
  // 1. Check RevenueCat subscription
  const hasSub = await hasReceiptScanningAccess();
  if (hasSub) return true;
  
  // 2. Check Invite Premium status
  const isInvitePremium = await checkPremiumStatus();
  if (isInvitePremium) return true;

  // 3. Check Free Scan Limit
  return await checkScanLimit();
};

export const requestReceiptScanningAccess = async () => {
  const hasAccess = await canAccessReceiptScanning();
  
  if (hasAccess) {
    return true;
  }
  
  // If we're here, they have no sub, no premium, and no free scans left.
  // Show the paywall.
  return await handleReceiptScanningAccess();
};

export const getSubscriptionStatus = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    
    const isInvitePremium = await checkPremiumStatus();
    
    // Get scan stats for display if needed
    let remainingScans = 0;
    try {
      const user = getCurrentUser();
      if (user) {
        const firestore = getFirestore(getApp());
        const userRef = doc(firestore, 'users', user.uid);
        const snapshot = await getDoc(userRef);
        const userData = snapshot.exists() ? snapshot.data() : {};
        const count = userData.scanStats ? (userData.scanStats.count || 0) : 0;
        remainingScans = Math.max(0, SCAN_LIMIT_PER_WEEK - count);
      }
    } catch (e) {
      // Error fetching stats for status
    }

    const isActive = customerInfo.entitlements.active[ENTITLEMENTS.RECEIPT_SCANNING] !== undefined || isInvitePremium;
    
    return {
      isActive,
      isInvitePremium,
      remainingScans,
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
      remainingScans: 0,
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
