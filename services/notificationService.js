// Basic notification service for IOU app
// Simplified version without Firebase messaging

export const initialize = () => {
  console.log('✅ Basic notification service initialized');
  return null;
};

export const cleanup = () => {
  console.log('🧹 Basic notification service cleaned up');
};

export const requestUserPermission = async () => {
  console.log('⚠️ Push notifications not implemented in this version');
  return false;
};

export const getFCMToken = async () => {
  console.log('⚠️ FCM token not available - push notifications disabled');
  return null;
};

export const saveFCMTokenToProfile = async (userId) => {
  console.log('⚠️ FCM token saving not implemented - push notifications disabled');
  return false;
};

export const sendTestNotification = async () => {
  console.log('⚠️ Test notifications not implemented - push notifications disabled');
  return false;
};

export const checkFirebaseApp = () => {
  console.log('⚠️ Firebase app check not implemented - push notifications disabled');
  return false;
};

export const isIOSSimulator = () => {
  return false;
};

export const registerDeviceForRemoteMessages = async () => {
  console.log('⚠️ Device registration not implemented - push notifications disabled');
  return false;
};

export default {
  initialize,
  cleanup,
  requestUserPermission,
  getFCMToken,
  saveFCMTokenToProfile,
  sendTestNotification,
  checkFirebaseApp,
  isIOSSimulator,
  registerDeviceForRemoteMessages,
};