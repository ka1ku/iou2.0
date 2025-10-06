import { Linking } from 'react-native';
import { parseFriendInviteLink } from './friendService';
import { parseExpenseJoinLink } from './expenseService';
import { getCurrentUser } from './authService';

class DeepLinkService {
  constructor() {
    this.initialURL = null;
    this.listeners = new Set();
  }

  async initialize() {
    try {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        this.initialURL = initialURL;
        this.handleDeepLink(initialURL);
      }

      Linking.addEventListener('url', ({ url }) => {
        this.handleDeepLink(url);
      });
    } catch (error) {
    }
  }

  handleDeepLink(url) {
    
    if (!url) return;

    const friendInvite = parseFriendInviteLink(url);
    if (friendInvite) {
      this.handleFriendInvite(friendInvite);
      return;
    }

    const expenseJoin = parseExpenseJoinLink(url);
    if (expenseJoin) {
      this.handleExpenseJoin(expenseJoin);
      return;
    }

  }

  async handleFriendInvite(inviteData) {
    try {
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        this.storePendingInvite(inviteData);
        return;
      }

      if (currentUser.uid === inviteData.uid) {
        return;
      }

      this.notifyListeners('friendInvite', inviteData);
      
    } catch (error) {
    }
  }

  async handleExpenseJoin(joinData) {
    try {
      this.notifyListeners('expenseJoin', joinData);
    } catch (error) {
    }
  }

  storePendingInvite(inviteData) {
    try {
    } catch (error) {
    }
  }

  addListener(event, callback) {
    this.listeners.add({ event, callback });
    
    return () => {
      this.listeners.delete({ event, callback });
    };
  }

  removeListener(event, callback) {
    this.listeners.delete({ event, callback });
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        try {
          listener.callback(data);
        } catch (error) {
        }
      }
    });
  }

  getInitialURL() {
    return this.initialURL;
  }

  clearInitialURL() {
    this.initialURL = null;
  }

  canOpenURL(url) {
    return Linking.canOpenURL(url);
  }

  async openURL(url) {
    try {
      const supported = await this.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  generateAppLink(path, params = {}) {
    const baseUrl = 'com.kailee.iou20://';
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`;
    return url;
  }

  cleanup() {
    this.listeners.clear();
    
  }
}

const deepLinkService = new DeepLinkService();

export default deepLinkService;
