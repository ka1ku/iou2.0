import { getFirestore, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

/**
 * Generate a unique referral code for a user
 * Format: USERNAME_HASH (e.g., "johnsmith_A1B2C3")
 */
export const generateReferralCode = (username, userId) => {
  // Create a short hash from userId (first 6 chars)
  const shortHash = userId.substring(0, 6).toUpperCase();

  // Sanitize username (remove spaces, special chars, lowercase)
  const sanitizedUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15); // Max 15 chars for username

  return `${sanitizedUsername}_${shortHash}`;
};

/**
 * Generate a referral deep link URL
 * Format: https://iou.app.link/invite?ref=REFERRAL_CODE
 */
export const getReferralLink = (referralCode) => {
  // TODO: Replace with actual deep link domain after Branch.io/Firebase Dynamic Links setup
  const baseUrl = 'https://iou.app.link/invite';
  return `${baseUrl}?ref=${referralCode}`;
};

/**
 * Get referral link for the current user
 * If user doesn't have a referral code (legacy users), creates one
 */
export const getCurrentUserReferralLink = async (userId) => {
  try {
    const db = getFirestore(getApp());
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.error('User not found');
      return null;
    }

    const userData = userDoc.data();
    let referralCode = userData?.inviteStats?.referralCode;

    // If user doesn't have a referral code (legacy user), generate one
    if (!referralCode) {
      const username = userData.username || userData.displayName || 'user';
      referralCode = generateReferralCode(username, userId);

      // Update user document with new referral code
      try {
        await updateDoc(userDocRef, {
          'inviteStats.referralCode': referralCode,
          'inviteStats.contactsInvited': userData?.inviteStats?.contactsInvited || 0,
          'inviteStats.friendsJoined': userData?.inviteStats?.friendsJoined || 0,
          'inviteStats.premiumUnlocked': userData?.inviteStats?.premiumUnlocked || false,
          'inviteStats.inviteHistory': userData?.inviteStats?.inviteHistory || [],
          'inviteStats.rewardsEarned': userData?.inviteStats?.rewardsEarned || {
            tier1: { unlocked: false, unlockedAt: null },
            tier2: { unlocked: false, unlockedAt: null }
          }
        });
        console.log('Generated referral code for legacy user:', referralCode);
      } catch (updateError) {
        console.error('Error updating user with referral code:', updateError);
      }
    }

    return getReferralLink(referralCode);
  } catch (error) {
    console.error('Error getting referral link:', error);
    return null;
  }
};

/**
 * Get user's referral stats for the dashboard
 */
export const getUserReferralStats = async (userId) => {
  try {
    const db = getFirestore(getApp());
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.error('User not found');
      // Return default stats instead of throwing
      return {
        referralCode: null,
        confirmedReferrals: 0,
        confirmedInvites: [],
        pendingInvites: [],
        rewardsEarned: {
          tier1: { unlocked: false },
          tier2: { unlocked: false }
        },
        premiumUnlocked: false,
        premiumUntil: null,
        totalInvitesSent: 0
      };
    }

    const data = userDoc.data();
    const inviteStats = data.inviteStats || {};

    // Calculate confirmed referrals (friendsJoined)
    const confirmedReferrals = inviteStats.friendsJoined || 0;

    // Get referral history with joined status
    const inviteHistory = inviteStats.inviteHistory || [];
    const confirmedInvites = inviteHistory.filter(invite => invite.joined === true);
    const pendingInvites = inviteHistory.filter(invite => !invite.joined);

    // Get tier unlock status with proper defaults
    const rewardsEarned = inviteStats.rewardsEarned || {
      tier1: { unlocked: false },
      tier2: { unlocked: false }
    };

    return {
      referralCode: inviteStats.referralCode || null,
      confirmedReferrals,
      confirmedInvites,
      pendingInvites,
      rewardsEarned: {
        tier1: { unlocked: rewardsEarned.tier1?.unlocked || false },
        tier2: { unlocked: rewardsEarned.tier2?.unlocked || false }
      },
      premiumUnlocked: inviteStats.premiumUnlocked || false,
      premiumUntil: inviteStats.premiumUntil || null,
      totalInvitesSent: inviteStats.contactsInvited || 0
    };
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    // Return default stats instead of throwing
    return {
      referralCode: null,
      confirmedReferrals: 0,
      confirmedInvites: [],
      pendingInvites: [],
      rewardsEarned: {
        tier1: { unlocked: false },
        tier2: { unlocked: false }
      },
      premiumUnlocked: false,
      premiumUntil: null,
      totalInvitesSent: 0
    };
  }
};

/**
 * Parse referral code from deep link URL
 */
export const parseReferralCode = (url) => {
  if (!url) return null;

  try {
    // Parse URL manually to extract ref parameter
    const urlObj = new URL(url);
    const ref = urlObj.searchParams.get('ref');
    return ref || null;
  } catch (error) {
    // Fallback for malformed URLs
    const match = url.match(/[?&]ref=([^&]+)/);
    return match ? match[1] : null;
  }
};

/**
 * Client-side helper to track referral conversion
 * This is called after a new user signs up
 */
export const trackReferralConversion = async (referrerId, referredUserId) => {
  try {
    // This will be handled by Cloud Function, but we can add client-side logging
    console.log('Referral conversion tracked:', {
      referrer: referrerId,
      referred: referredUserId
    });
  } catch (error) {
    console.error('Error tracking referral conversion:', error);
  }
};

/**
 * Get next tier requirement
 */
export const getNextTierRequirement = (confirmedReferrals) => {
  if (confirmedReferrals < 3) {
    return { tier: 1, required: 3, remaining: 3 - confirmedReferrals };
  } else if (confirmedReferrals < 5) {
    return { tier: 2, required: 5, remaining: 5 - confirmedReferrals };
  } else {
    return { tier: 'max', required: 5, remaining: 0 };
  }
};

/**
 * Calculate progress percentage (0-100)
 */
export const calculateProgressPercentage = (confirmedReferrals) => {
  const max = 5; // Max tier is 5 referrals
  return Math.min((confirmedReferrals / max) * 100, 100);
};
