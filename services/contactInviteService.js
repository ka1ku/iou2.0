import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  increment, 
  arrayUnion,
  serverTimestamp,
  getDoc
} from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getCurrentUser } from './authService';
import { getReferralLink } from './referralService';

// Standardize phone number for matching
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If we can't determine, return with + prefix if it had one, or just digits
  return phone.startsWith('+') ? phone : `+${digits}`;
};

export const requestContactPermissions = async () => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

export const fetchAndClassifyContacts = async () => {
  try {
    const { status } = await Contacts.getPermissionsAsync();
    if (status !== 'granted') {
      return { onApp: [], suggestions: [], others: [] };
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
    });

    if (!data || data.length === 0) {
      return { onApp: [], suggestions: [], others: [] };
    }

    // Filter contacts with phone numbers
    const validContacts = data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
    
    // Create a map of normalized phone -> contact for quick lookup
    const phoneMap = new Map();
    const phoneNumbersToCheck = [];

    validContacts.forEach(contact => {
      // Use the first phone number for simplicity, or check all?
      // Let's check all mobile/main numbers
      contact.phoneNumbers.forEach(p => {
        const normalized = normalizePhoneNumber(p.number);
        if (normalized.length >= 10) { // Basic validation
          phoneMap.set(normalized, contact);
          phoneNumbersToCheck.push(normalized);
        }
      });
    });

    // Batch check against Firestore users
    // Firestore `in` query limit is 30. We need to chunk it.
    const chunks = [];
    for (let i = 0; i < phoneNumbersToCheck.length; i += 30) {
      chunks.push(phoneNumbersToCheck.slice(i, i + 30));
    }

    const firestore = getFirestore(getApp());
    const usersRef = collection(firestore, 'users');
    const onAppPhoneNumbers = new Set();
    const onAppUsers = [];

    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      const q = query(usersRef, where('phoneNumber', 'in', chunk));
      const snapshot = await getDocs(q);
      
      snapshot.forEach(doc => {
        const userData = doc.data();
        const contact = phoneMap.get(userData.phoneNumber);
        if (contact) {
          onAppPhoneNumbers.add(userData.phoneNumber);
          onAppUsers.push({
            ...contact,
            userData: {
              ...userData,
              userId: doc.id, // Store the user's document ID for deduplication
              id: doc.id
            },
            id: contact.id,
            name: contact.name || userData.firstName,
            phoneNumber: userData.phoneNumber
          });
        }
      });
    }

    // Separate remaining contacts
    const others = [];
    const suggestions = [];
    
    validContacts.forEach(contact => {
      let isOnApp = false;
      contact.phoneNumbers.forEach(p => {
        const normalized = normalizePhoneNumber(p.number);
        if (onAppPhoneNumbers.has(normalized)) {
          isOnApp = true;
        }
      });

      if (!isOnApp) {
        // Simple heuristic for "Suggestions": contacts with images or frequently contacted (not available in expo-contacts basic)
        // We'll use "has image" as a proxy for "close friend" for now
        if (contact.imageAvailable) {
          suggestions.push(contact);
        } else {
          others.push(contact);
        }
      }
    });

    // Sort alphabetically
    others.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    suggestions.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return {
      onApp: onAppUsers,
      suggestions: suggestions.slice(0, 10), // Limit suggestions
      others: others
    };

  } catch (error) {
    return { onApp: [], suggestions: [], others: [] };
  }
};

export const sendInviteSMS = async (phoneNumber, name) => {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('SMS is not available on this device');
  }

  const user = getCurrentUser();
  // We need to fetch user profile to get their name and referral code
  const firestore = getFirestore(getApp());
  const userDoc = await getDoc(doc(firestore, 'users', user.uid));
  const userData = userDoc.data();
  const userName = userData?.firstName || 'A friend';
  const referralCode = userData?.inviteStats?.referralCode;

  // Generate personalized referral link
  const referralLink = referralCode ? getReferralLink(referralCode) : 'https://iou.app.link/invite';

  const message = `Let's stop the awkward Venmo reminders 😅 - ${userName} invited you to IOU. Download here: ${referralLink}`;

  const { result } = await SMS.sendSMSAsync(
    [phoneNumber],
    message
  );

  return result === 'sent';
};

export const trackInvite = async (phoneNumber, name) => {
  try {
    const user = getCurrentUser();
    if (!user) return null;

    const firestore = getFirestore(getApp());
    const userRef = doc(firestore, 'users', user.uid);

    // Track the invite
    await updateDoc(userRef, {
      'inviteStats.contactsInvited': increment(1),
      'inviteStats.inviteHistory': arrayUnion({
        phoneNumber: normalizePhoneNumber(phoneNumber),
        name: name || 'Unknown',
        invitedAt: new Date(), // Using JS date which Firestore converts
        joined: false
      })
    });
    
    // Check for milestones and unlock premium if needed
    const updatedDoc = await getDoc(userRef);
    const stats = updatedDoc.data()?.inviteStats || {};
    
    if (stats.contactsInvited >= 5 && !stats.premiumUnlocked) {
      // Unlock premium for 1 month
      const premiumUntil = new Date();
      premiumUntil.setMonth(premiumUntil.getMonth() + 1);
      
      await updateDoc(userRef, {
        'inviteStats.premiumUnlocked': true,
        'inviteStats.premiumUntil': premiumUntil
      });
      
      return { unlockedPremium: true };
    }
    
    return { unlockedPremium: false, count: stats.contactsInvited };
    
  } catch (error) {
    return null;
  }
};

export const checkPremiumStatus = async () => {
    const user = getCurrentUser();
    if (!user) return false;

    const firestore = getFirestore(getApp());
    const userRef = doc(firestore, 'users', user.uid);
    const snapshot = await getDoc(userRef);
    
    if (!snapshot.exists()) return false;
    
    const data = snapshot.data();
    const stats = data.inviteStats;
    
    if (stats?.premiumUnlocked && stats?.premiumUntil) {
        const now = new Date();
        const premiumUntil = stats.premiumUntil.toDate(); // Firestore timestamp
        return now < premiumUntil;
    }
    
    return false;
}
