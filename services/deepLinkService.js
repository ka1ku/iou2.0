import { Linking } from 'react-native';
import { parseFriendInviteLink } from './friendService';
import { parseExpenseJoinLink } from './expenseService';
import { getCurrentUser } from './authService';

class DeepLinkService {
  constructor() {
    this.initialURL = null;
    this.listeners = [];
    this.pendingEvents = [];
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
    const listener = { event, callback };
    this.listeners.push(listener);

    // Deliver any pending events for this event type
    const remaining = [];
    for (const pending of this.pendingEvents) {
      if (pending.event === event) {
        try {
          callback(pending.data);
        } catch (error) {
        }
      } else {
        remaining.push(pending);
      }
    }
    this.pendingEvents = remaining;

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  removeListener(event, callback) {
    const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  notifyListeners(event, data) {
    const matching = this.listeners.filter(l => l.event === event);
    if (matching.length === 0) {
      // No listeners yet — queue the event for when a listener registers
      this.pendingEvents.push({ event, data });
      return;
    }

    matching.forEach(listener => {
      try {
        listener.callback(data);
      } catch (error) {
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
    this.listeners = [];
    this.pendingEvents = [];
  }
}

const deepLinkService = new DeepLinkService();

export default deepLinkService;
