import { Linking } from 'react-native';
import { parseFriendInviteLink } from './friendService';
import { getCurrentUser } from './authService';

class DeepLinkService {
  constructor() {
    this.initialURL = null;
    this.listeners = new Set();
  }

  // Initialize deep link handling
  async initialize() {
    try {
      // Get initial URL if app was opened via deep link
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        this.initialURL = initialURL;
        this.handleDeepLink(initialURL);
      }

      // Listen for deep links when app is already running
      Linking.addEventListener('url', ({ url }) => {
        this.handleDeepLink(url);
      });
    } catch (error) {
      console.error('Error initializing deep link service:', error);
    }
  }

  // Handle incoming deep links
  handleDeepLink(url) {
    console.log('Handling deep link:', url);
    
    if (!url) return;

    // Parse friend invitation
    const friendInvite = parseFriendInviteLink(url);
    if (friendInvite) {
      this.handleFriendInvite(friendInvite);
      return;
    }

    // Add more deep link handlers here as needed
    console.log('Unknown deep link format:', url);
  }

  // Handle friend invitation deep links
  async handleFriendInvite(inviteData) {
    try {
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        // User not signed in, store invite for later
        this.storePendingInvite(inviteData);
        return;
      }

      // Check if user is trying to invite themselves
      if (currentUser.uid === inviteData.uid) {
        console.log('User trying to invite themselves');
        return;
      }

      // Notify listeners about the friend invite
      this.notifyListeners('friendInvite', inviteData);
      
    } catch (error) {
      console.error('Error handling friend invite:', error);
    }
  }

  // Store pending invite for when user signs in
  storePendingInvite(inviteData) {
    try {
      // Store in AsyncStorage or similar
      // This will be handled when user completes signup/signin
      console.log('Storing pending friend invite:', inviteData);
    } catch (error) {
      console.error('Error storing pending invite:', error);
    }
  }

  // Add listener for deep link events
  addListener(event, callback) {
    this.listeners.add({ event, callback });
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete({ event, callback });
    };
  }

  // Remove listener
  removeListener(event, callback) {
    this.listeners.delete({ event, callback });
  }

  // Notify all listeners of an event
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        try {
          listener.callback(data);
        } catch (error) {
          console.error('Error in deep link listener:', error);
        }
      }
    });
  }

  // Get initial URL if app was opened via deep link
  getInitialURL() {
    return this.initialURL;
  }

  // Clear initial URL after handling
  clearInitialURL() {
    this.initialURL = null;
  }

  // Check if app supports a given URL scheme
  canOpenURL(url) {
    return Linking.canOpenURL(url);
  }

  // Open a URL (external app, browser, etc.)
  async openURL(url) {
    try {
      const supported = await this.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        console.log('Cannot open URL:', url);
        return false;
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      return false;
    }
  }

  // Generate app-specific deep links
  generateAppLink(path, params = {}) {
    const baseUrl = 'com.kailee.iou20://';
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`;
    return url;
  }

  // Cleanup
  cleanup() {
    // Remove all listeners
    this.listeners.clear();
    
    // Remove event listeners
    // Note: In newer versions of React Native, this might not be necessary
    // as the event listener is automatically cleaned up
  }
}

// Create singleton instance
const deepLinkService = new DeepLinkService();

export default deepLinkService;
