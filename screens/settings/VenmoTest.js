import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  Modal,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { Card } from '../../components';

const VENMO_API_BASE = 'https://api.venmo.com';
const STORAGE_KEYS = {
  deviceId: 'VENMO_DEVICE_ID',
  accessToken: 'VENMO_ACCESS_TOKEN',
  userId: 'VENMO_USER_ID',
};

const generateUuidV4 = () => {
  // RFC4122 v4 UUID (not cryptographically secure, but stable enough for testing)
  const hex = Array.from({ length: 36 }).map(() => Math.floor(Math.random() * 16).toString(16));
  hex[14] = '4';
  hex[19] = ((parseInt(hex[19], 16) & 0x3) | 0x8).toString(16);
  hex[8] = hex[13] = hex[18] = hex[23] = '-';
  return hex.join('').toUpperCase();
};

// Different User-Agent strings to try
const USER_AGENTS = [
  'Venmo/10.0.0 (iPhone; iOS 17.0; Scale/3.0)',
  'Venmo/9.0.0 (iPhone; iOS 16.0; Scale/3.0)',
  'Venmo/8.0.0 (iPhone; iOS 15.0; Scale/3.0)',
  'Venmo/7.38.0 (iPhone; iOS 13.0; Scale/2.0)',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

// Alternative API endpoints to try
const API_ENDPOINTS = [
  'https://api.venmo.com',
  'https://api.venmo.com/v1',
  'https://venmo.com/api',
];

const pretty = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
};

const VenmoTest = ({ navigation }) => {
  const [deviceId, setDeviceId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [otpSecret, setOtpSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [usernameOrPhone, setUsernameOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [fundingSourceId, setFundingSourceId] = useState('');
  const [amount, setAmount] = useState('5.00');
  const [note, setNote] = useState('Test from IOU app');
  const [audience, setAudience] = useState('private');
  const [requestMode, setRequestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authStep, setAuthStep] = useState('login');
  const [resultTitle, setResultTitle] = useState('');
  const [resultBody, setResultBody] = useState('');
  const [currentUserAgent, setCurrentUserAgent] = useState(0);
  const [currentApiEndpoint, setCurrentApiEndpoint] = useState(0);
  const [showInternalBrowser, setShowInternalBrowser] = useState(false);
  const [extractedData, setExtractedData] = useState({
    deviceId: '',
    username: '',
    password: '',
    accessToken: '',
  });

  useEffect(() => {
    try {
      if (navigation && navigation.setOptions) {
        navigation.setOptions({
          title: 'Venmo API Test',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
        });
      }
    } catch {}
  }, [navigation]);

  useEffect(() => {
    const loadPersisted = async () => {
      try {
        const [storedDevice, storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.deviceId),
          AsyncStorage.getItem(STORAGE_KEYS.accessToken),
          AsyncStorage.getItem(STORAGE_KEYS.userId),
        ]);

        if (storedDevice) setDeviceId(storedDevice);
        if (storedToken) {
          setAccessToken(storedToken);
          setAuthStep('authenticated');
        }
        if (storedUser) setTargetUserId(storedUser);

        if (!storedDevice) {
          const newId = generateUuidV4();
          setDeviceId(newId);
          await AsyncStorage.setItem(STORAGE_KEYS.deviceId, newId);
        }
      } catch (e) {
        console.log('Failed to load persisted Venmo test data', e);
      }
    };
    loadPersisted();
  }, []);

  const baseHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'device-id': deviceId || generateUuidV4(),
  }), [deviceId]);

  const makeVenmoRequest = async (endpoint, options = {}) => {
    try {
      const baseUrl = API_ENDPOINTS[currentApiEndpoint];
      const url = `${baseUrl}${endpoint}`;
      const headers = {
        ...baseHeaders,
        'User-Agent': USER_AGENTS[currentUserAgent],
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(otpSecret ? { 'venmo-otp-secret': otpSecret } : {}),
        ...(otpCode ? { 'Venmo-Otp': otpCode } : {}),
        ...(options.headers || {}),
      };

      // Debug logging
      console.log('Making Venmo request:', {
        url,
        method: options.method || 'GET',
        headers,
        body: options.body,
        userAgent: USER_AGENTS[currentUserAgent]
      });

      const response = await fetch(url, { ...options, headers });
      // Read raw text first so we can show it when JSON parsing fails
      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { __raw: rawText };
      }
      
      // Debug logging
      console.log('Venmo response:', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data
      });
      
      return { response, data };
    } catch (error) {
      console.error('Venmo request error:', error);
      return { response: { ok: false, status: 0 }, data: { error: error.message } };
    }
  };

  const setAndPersistToken = async (token, userId) => {
    setAccessToken(token || '');
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEYS.accessToken, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.accessToken);
    }
    if (userId) {
      setTargetUserId(userId);
      await AsyncStorage.setItem(STORAGE_KEYS.userId, userId);
    }
  };

  const tryNextUserAgent = () => {
    if (currentUserAgent < USER_AGENTS.length - 1) {
      setCurrentUserAgent(currentUserAgent + 1);
      return true;
    }
    return false;
  };

  const tryNextApiEndpoint = () => {
    if (currentApiEndpoint < API_ENDPOINTS.length - 1) {
      setCurrentApiEndpoint(currentApiEndpoint + 1);
      return true;
    }
    return false;
  };

  const resetToFirstEndpoint = () => {
    setCurrentApiEndpoint(0);
    setCurrentUserAgent(0);
  };

  // Auth: Step 1 - Login
  const login = async () => {
    if (!usernameOrPhone || !password) {
      Alert.alert('Missing info', 'Enter your phone/email/username and password');
      return;
    }
    setIsLoading(true);
    setResultTitle('Login');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/oauth/access_token', {
        method: 'POST',
        body: JSON.stringify({ phone_email_or_username: usernameOrPhone, client_id: '1', password }),
      });

      if (response.status === 401 && data?.error?.code === 81109) {
        // Extract OTP secret from response headers
        const otpSecret = response.headers?.get?.('venmo-otp-secret') || '';
        const otpHeader = response.headers?.get?.('venmo-otp') || '';
        
        if (!otpSecret) {
          setResultBody(pretty({
            error: 'Failed to extract OTP secret from response headers',
            headers: Object.fromEntries(response.headers.entries()),
            body: data,
          }));
          Alert.alert('2FA Error', 'Could not extract OTP secret from response');
          return;
        }
        
        setOtpSecret(otpSecret);
        setAuthStep('2fa-options');
        setResultBody(pretty({
          message: 'Two-factor required. OTP secret captured. Choose SMS.',
          headers: {
            'venmo-otp': otpHeader,
            'venmo-otp-secret': otpSecret,
          },
          body: data,
        }));
        return;
      }

      if (response.ok && data?.access_token) {
        await setAndPersistToken(data.access_token, data?.user?.id);
        setAuthStep('authenticated');
        setResultBody(pretty(data));
        return;
      }

      // Handle specific error cases
      if (response.status === 403) {
        if (tryNextApiEndpoint()) {
          Alert.alert('403 Error - Trying Different API Endpoint', `Trying endpoint ${currentApiEndpoint + 1}/${API_ENDPOINTS.length}: ${API_ENDPOINTS[currentApiEndpoint + 1]}\n\nPlease try logging in again.`);
          return;
        } else if (tryNextUserAgent()) {
          resetToFirstEndpoint();
          Alert.alert('403 Error - Trying Different User-Agent', `Trying User-Agent ${currentUserAgent + 1}/${USER_AGENTS.length}: ${USER_AGENTS[currentUserAgent + 1]}\n\nPlease try logging in again.`);
          return;
        } else {
          Alert.alert('Access Forbidden', 'All API endpoints and User-Agent strings failed (403). This could be due to:\n• API endpoint changes\n• Rate limiting\n• IP blocking\n• Account restrictions\n• API shutdown\n\nCheck the debug logs for more details.');
        }
      } else if (data?.error?.code === 240) {
        Alert.alert('OAuth2 Exception', 'Venmo API is currently unavailable (Error 240). This is a known issue as of March 2024.\n\nVenmo may have:\n• Shut down their public API\n• Changed authentication requirements\n• Restricted third-party access\n\nSee: https://github.com/mmohades/Venmo/issues/86');
      } else if (data?.error?.code === 2) {
        Alert.alert('App Update Required', 'Venmo requires a newer app version. This is likely due to API changes. Please try using the official Venmo app or website.');
      } else if (data?.error?.code === 81109) {
        // This should be handled above, but just in case
        Alert.alert('2FA Required', 'Two-factor authentication is required for this account.');
      } else {
        Alert.alert('Login failed', data?.error?.message || 'Check credentials');
      }

      setResultBody(pretty({ 
        status: response.status, 
        headers: {
          'venmo-otp': response.headers?.get?.('venmo-otp') || null,
          'venmo-otp-secret': response.headers?.get?.('venmo-otp-secret') || null,
        }, 
        body: data 
      }));
    } catch (e) {
      setResultBody(String(e?.message || e));
    } finally {
      setIsLoading(false);
    }
  };

  // Auth: Step 2a - Fetch 2FA options (optional)
  const getTwoFactorOptions = async () => {
    if (!otpSecret) {
      Alert.alert('Missing OTP Secret', 'Login first to obtain the otp secret.');
      return;
    }
    setIsLoading(true);
    setResultTitle('Two-Factor Options');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/account/two-factor/token?client_id=1', {
        method: 'GET',
        headers: {
          'venmo-otp-secret': otpSecret,
        },
      });
      if (data?.error?.code === 81110) {
        Alert.alert('Code Expired', 'Your code has expired. Please sign in again and request a new code.');
        setAuthStep('login');
        setOtpSecret('');
        setOtpCode('');
      }
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Auth: Step 2b - Request SMS
  const requestSmsCode = async () => {
    if (!otpSecret) {
      Alert.alert('Missing OTP Secret', 'Login first to obtain the otp secret.');
      return;
    }
    setIsLoading(true);
    setResultTitle('Request SMS Code');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/account/two-factor/token', {
        method: 'POST',
        headers: {
          'venmo-otp-secret': otpSecret,
        },
        body: JSON.stringify({ via: 'sms' }),
      });
      if (response.ok) {
        setAuthStep('2fa-verify');
        Alert.alert('SMS Sent', 'Check your phone for the verification code.');
      } else if (data?.error?.code === 81110) {
        Alert.alert('Code Expired', 'Your code has expired. Please sign in again and request a new code.');
        setAuthStep('login');
        setOtpSecret('');
        setOtpCode('');
      } else {
        Alert.alert('SMS Request Failed', data?.error?.message || 'Failed to send SMS code. Please try again.');
      }
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Auth: Step 3 - Verify OTP
  const verifyOtp = async () => {
    if (!otpCode) {
      Alert.alert('Missing Code', 'Enter the 6-digit code from SMS');
      return;
    }
    if (!otpSecret) {
      Alert.alert('Missing OTP Secret', 'Login first to obtain the otp secret.');
      return;
    }
    setIsLoading(true);
    setResultTitle('Verify OTP');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/oauth/access_token?client_id=1', {
        method: 'POST',
        headers: {
          'venmo-otp-secret': otpSecret,
          'Venmo-Otp': otpCode,
          'User-Agent': 'Venmo/10.0.0 (iPhone; iOS 17.0; Scale/3.0)',
        },
      });
      if (response.ok && data?.access_token) {
        await setAndPersistToken(data.access_token, data?.user?.id);
        setAuthStep('authenticated');
        setOtpSecret(''); // Clear OTP secret after successful login
        setOtpCode(''); // Clear OTP code after successful login
        Alert.alert('Success', 'Successfully authenticated with Venmo!');
      } else if (data?.error?.code === 81110) {
        Alert.alert('Code Expired', 'Your code has expired. Please sign in again and request a new code.');
        setAuthStep('login');
        setOtpSecret('');
        setOtpCode('');
      } else {
        Alert.alert('Verification Failed', data?.error?.message || 'Invalid code. Please try again.');
      }
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Auth: Logout (revoke token)
  const revokeToken = async () => {
    if (!accessToken) {
      Alert.alert('Not logged in', 'No access token to revoke');
      return;
    }
    setIsLoading(true);
    setResultTitle('Logout / Revoke Token');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/oauth/access_token', { method: 'DELETE' });
      await setAndPersistToken('', '');
      setAuthStep('login');
      setOtpSecret('');
      setOtpCode('');
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: /me
  const getMe = async () => {
    setIsLoading(true);
    setResultTitle('GET /me');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/me', { method: 'GET' });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: /users/{id}
  const getUser = async () => {
    if (!targetUserId) {
      Alert.alert('Missing user id', 'Set a user id');
      return;
    }
    setIsLoading(true);
    setResultTitle('GET /users/{id}');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest(`/users/${encodeURIComponent(targetUserId)}`, { method: 'GET' });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: /users/{id}/friends
  const getFriends = async () => {
    if (!targetUserId) {
      Alert.alert('Missing user id', 'Set a user id');
      return;
    }
    setIsLoading(true);
    setResultTitle('GET /users/{id}/friends');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest(`/users/${encodeURIComponent(targetUserId)}/friends?limit=50`, { method: 'GET' });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: /payment-methods
  const getPaymentMethods = async () => {
    setIsLoading(true);
    setResultTitle('GET /payment-methods');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest('/payment-methods', { method: 'GET' });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: POST /payments
  const makePaymentOrRequest = async () => {
    if (!targetUserId) {
      Alert.alert('Missing user id', 'Set a target Venmo user id');
      return;
    }
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number');
      return;
    }
    if (!requestMode && !fundingSourceId) {
      Alert.alert('Missing funding source', 'Enter a funding_source_id for send payments');
      return;
    }

    setIsLoading(true);
    setResultTitle('POST /payments');
    setResultBody('');
    try {
      const body = requestMode
        ? {
            note,
            metadata: { quasi_cash_disclaimer_viewed: false },
            amount: -amt,
            user_id: targetUserId,
            audience,
          }
        : {
            funding_source_id: fundingSourceId,
            metadata: { quasi_cash_disclaimer_viewed: false },
            user_id: targetUserId,
            audience,
            amount: amt,
            note,
          };
      const { response, data } = await makeVenmoRequest('/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: GET /stories/{transaction-id}
  const getTransaction = async () => {
    if (!transactionId) {
      Alert.alert('Missing transaction id', 'Enter a transaction id');
      return;
    }
    setIsLoading(true);
    setResultTitle('GET /stories/{transaction-id}');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest(`/stories/${encodeURIComponent(transactionId)}`, { method: 'GET' });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  // Endpoint: GET /stories/target-or-actor/{user-id}
  const getUserTransactions = async () => {
    if (!targetUserId) {
      Alert.alert('Missing user id', 'Set a user id');
      return;
    }
    setIsLoading(true);
    setResultTitle('GET /stories/target-or-actor/{user-id}');
    setResultBody('');
    try {
      const { response, data } = await makeVenmoRequest(`/stories/target-or-actor/${encodeURIComponent(targetUserId)}?limit=20`, { method: 'GET' });
      setResultBody(pretty({ status: response.status, data }));
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResultTitle('');
    setResultBody('');
  };

  // Test API connectivity
  const testApiConnectivity = async () => {
    setIsLoading(true);
    setResultTitle('API Connectivity Test');
    setResultBody('');
    try {
      // Try a simple GET request to test connectivity
      const { response, data } = await makeVenmoRequest('/me', { method: 'GET' });
      setResultBody(pretty({ 
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const openVenmoSignIn = async () => {
    const url = 'https://venmo.com/account/sign-in';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        Alert.alert(
          'Instructions',
          '1. Sign into Venmo in the opened browser\n' +
          '2. Open DevTools (F12)\n' +
          '3. Go to Network tab\n' +
          '4. Search for "account.venmo.com/api/auth"\n' +
          '5. Click on the request and look at Response\n' +
          '6. Find the "deviceId" field\n' +
          '7. Copy it and paste it in the Device ID field below\n' +
          '8. Then try logging in with your credentials',
          [{ text: 'Got it!', style: 'default' }]
        );
      } else {
        Alert.alert('Error', 'Cannot open browser. Please manually visit: ' + url);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open browser: ' + error.message);
    }
  };

  // Test device ID from web interface
  const testWebDeviceId = async () => {
    if (!deviceId) {
      Alert.alert('No Device ID', 'Please enter a device ID obtained from the web interface first.');
      return;
    }
    
    setIsLoading(true);
    setResultTitle('Testing Web Device ID');
    setResultBody('');
    try {
      // Try to get 2FA options with the web device ID
      const { response, data } = await makeVenmoRequest('/account/two-factor/token?client_id=1', {
        method: 'GET',
        headers: {
          'venmo-otp-secret': 'test', // This will fail but show us the response
        },
      });
      
      setResultBody(pretty({ 
        message: 'Testing device ID from web interface...',
        deviceId: deviceId,
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data 
      }));
      
      if (response.status === 400 && data?.error?.code === 81110) {
        Alert.alert('Device ID Valid!', 'The device ID appears to be valid (got expected 2FA error). You can now try logging in.');
      } else if (response.status === 403) {
        Alert.alert('Device ID Invalid', 'The device ID from the web interface is not working. Try getting a fresh one.');
      } else {
        Alert.alert('Unexpected Response', `Got status ${response.status}. Check the result for details.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Open internal browser for automated extraction
  const openInternalBrowser = () => {
    setShowInternalBrowser(true);
    setExtractedData({ deviceId: '', username: '', password: '', accessToken: '' });
  };

  // Handle WebView navigation and data extraction
  const handleWebViewNavigationStateChange = (navState) => {
    console.log('Navigation state changed:', navState.url);
    
    // Check if we're on the Venmo sign-in page
    if (navState.url.includes('venmo.com/account/sign-in')) {
      console.log('On Venmo sign-in page');
    }
    
    // Check if we're on the dashboard (successful login)
    if (navState.url.includes('venmo.com/account') && !navState.url.includes('sign-in')) {
      console.log('Successfully logged in, extracting data...');
      // We'll extract data using injected JavaScript
    }
  };

  // JavaScript code to inject into WebView for data extraction
  const injectedJavaScript = `
    (function() {
      console.log('Injected script running...');
      
      // Function to extract data from the page
      function extractData() {
        const data = {
          deviceId: '',
          username: '',
          password: '',
          accessToken: '',
          cookies: document.cookie,
          localStorage: JSON.stringify(localStorage),
          sessionStorage: JSON.stringify(sessionStorage)
        };
        
        // Try to find device ID in various places
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
          const content = script.textContent || script.innerHTML;
          if (content.includes('deviceId') || content.includes('device-id')) {
            const match = content.match(/["']deviceId["']\s*:\s*["']([^"']+)["']/i) || 
                         content.match(/["']device-id["']\s*:\s*["']([^"']+)["']/i);
            if (match) {
              data.deviceId = match[1];
            }
          }
        });
        
        // Try to find username/email in form fields
        const usernameField = document.querySelector('input[type="email"], input[name*="email"], input[name*="username"], input[placeholder*="email"], input[placeholder*="username"]');
        if (usernameField) {
          data.username = usernameField.value;
        }
        
        // Try to find password field (but we can't get the value for security)
        const passwordField = document.querySelector('input[type="password"]');
        if (passwordField) {
          data.password = '[HIDDEN]';
        }
        
        // Look for access tokens in localStorage or sessionStorage
        const storage = { ...localStorage, ...sessionStorage };
        Object.keys(storage).forEach(key => {
          if (key.toLowerCase().includes('token') || key.toLowerCase().includes('access')) {
            data.accessToken = storage[key];
          }
        });
        
        // Send data back to React Native
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
        
        return data;
      }
      
      // Run extraction immediately
      extractData();
      
      // Also run extraction when the page loads
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', extractData);
      } else {
        extractData();
      }
      
      // Run extraction periodically to catch dynamic content
      setInterval(extractData, 2000);
      
      // Listen for form submissions to catch login attempts
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        form.addEventListener('submit', function() {
          setTimeout(extractData, 1000);
        });
      });
      
      // Listen for network requests (if possible)
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        return originalFetch.apply(this, args).then(response => {
          if (args[0] && args[0].includes && args[0].includes('api/auth')) {
            console.log('API auth request detected');
            setTimeout(extractData, 500);
          }
          return response;
        });
      };
    })();
    true;
  `;

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Extracted data:', data);
      
      setExtractedData(prev => ({
        ...prev,
        ...data
      }));
      
      // If we found a device ID, update the main device ID field
      if (data.deviceId) {
        setDeviceId(data.deviceId);
        AsyncStorage.setItem(STORAGE_KEYS.deviceId, data.deviceId);
      }
      
      // If we found username, update the username field
      if (data.username) {
        setUsernameOrPhone(data.username);
      }
      
      // If we found an access token, show success
      if (data.accessToken) {
        Alert.alert('Success!', 'Found access token! You can now close the browser and try the API calls.');
      }
      
    } catch (error) {
      console.log('Error parsing WebView message:', error);
    }
  };

  // Close internal browser and apply extracted data
  const closeInternalBrowser = () => {
    setShowInternalBrowser(false);
    
    if (extractedData.deviceId) {
      Alert.alert('Data Extracted', `Found device ID: ${extractedData.deviceId}\\nUsername: ${extractedData.username || 'Not found'}\\nAccess Token: ${extractedData.accessToken ? 'Found!' : 'Not found'}`);
    } else {
      Alert.alert('No Data Found', 'Could not extract device ID. Please try manually or check the browser console for errors.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}> 
          <Ionicons name="card-outline" size={48} color={Colors.accent} />
          <Text style={styles.headerTitle}>Venmo API Test</Text>
          <Text style={styles.headerSubtitle}>Login, 2FA, and call endpoints</Text>
        </View>

        <Card variant="outlined" margin="large" padding="large" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Ionicons name="warning" size={20} color="#856404" />
            <Text style={[styles.sectionTitle, { color: '#856404', marginLeft: Spacing.sm }]}>API Status Warning</Text>
          </View>
          <Text style={[styles.help, { color: '#856404' }]}>
            As of March 2024, Venmo's public API appears to be unavailable or restricted. 
            Users are reporting OAuth2 errors (code 240) and 403 Forbidden responses.
          </Text>
          <Text style={[styles.help, { color: '#856404', marginTop: Spacing.xs }]}>
            This may be due to API changes, security restrictions, or API shutdown.
            See: https://github.com/mmohades/Venmo/issues/86
          </Text>
        </Card>

        <Card variant="outlined" margin="large" padding="large" style={{ backgroundColor: '#d1ecf1', borderColor: '#0c5460' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Ionicons name="bulb" size={20} color="#0c5460" />
            <Text style={[styles.sectionTitle, { color: '#0c5460', marginLeft: Spacing.sm }]}>Workaround Method</Text>
          </View>
          <Text style={[styles.help, { color: '#0c5460' }]}>
            Try this workaround to get a valid device ID from the web interface:
          </Text>
          <Text style={[styles.help, { color: '#0c5460', marginTop: Spacing.xs, fontFamily: 'Courier', fontSize: 12 }]}>
            1. Click "Open Venmo Sign-In" below{'\n'}
            2. Sign into Venmo in the opened browser{'\n'}
            3. Open DevTools (F12){'\n'}
            4. Go to Network tab{'\n'}
            5. Search for "account.venmo.com/api/auth"{'\n'}
            6. Click on the request and look at Response{'\n'}
            7. Find the "deviceId" field{'\n'}
            8. Copy it and paste it in the Device ID field below
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#0c5460', flex: 1 }]} onPress={openVenmoSignIn}>
              <Ionicons name="globe" size={18} color="#fff" />
              <Text style={styles.buttonText}>Open External Browser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#28a745', flex: 1 }]} onPress={openInternalBrowser}>
              <Ionicons name="eye" size={18} color="#fff" />
              <Text style={styles.buttonText}>Auto Extract Data</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card variant="outlined" margin="large" padding="large">
          <Text style={styles.sectionTitle}>Authentication</Text>

          {authStep === 'login' && (
            <>
              <Text style={styles.label}>Phone / Email / Username</Text>
              <TextInput
                style={styles.input}
                value={usernameOrPhone}
                onChangeText={setUsernameOrPhone}
                placeholder="example@domain.com or @username or +15551234567"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
              />

              <Text style={styles.label}>Device ID (from web interface)</Text>
              <Text style={[styles.help, { marginBottom: Spacing.xs }]}>
                Get this from: https://venmo.com/account/sign-in → DevTools → Network → "account.venmo.com/api/auth" → Response
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#f8f9fa', borderColor: '#28a745' }]}
                value={deviceId}
                onChangeText={async (v) => {
                  setDeviceId(v);
                  await AsyncStorage.setItem(STORAGE_KEYS.deviceId, v);
                }}
                placeholder="Paste device ID from web interface here"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
              />
              <TouchableOpacity style={[styles.button, styles.outlinedButton]} onPress={testWebDeviceId} disabled={isLoading}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                <Text style={[styles.buttonText, { color: Colors.accent }]}>Test Web Device ID</Text>
              </TouchableOpacity>

              <Text style={styles.label}>API Endpoint (Current: {currentApiEndpoint + 1}/{API_ENDPOINTS.length})</Text>
              <Text style={styles.help}>{API_ENDPOINTS[currentApiEndpoint]}</Text>
              <TouchableOpacity style={[styles.button, styles.outlinedButton]} onPress={() => {
                if (tryNextApiEndpoint()) {
                  Alert.alert('API Endpoint Changed', `Now using: ${API_ENDPOINTS[currentApiEndpoint]}`);
                } else {
                  Alert.alert('No More Endpoints', 'All API endpoints have been tried.');
                }
              }}>
                <Ionicons name="globe" size={18} color={Colors.accent} />
                <Text style={[styles.buttonText, { color: Colors.accent }]}>Try Next Endpoint</Text>
              </TouchableOpacity>

              <Text style={styles.label}>User-Agent (Current: {currentUserAgent + 1}/{USER_AGENTS.length})</Text>
              <Text style={styles.help}>{USER_AGENTS[currentUserAgent]}</Text>
              <TouchableOpacity style={[styles.button, styles.outlinedButton]} onPress={() => {
                if (tryNextUserAgent()) {
                  Alert.alert('User-Agent Changed', `Now using: ${USER_AGENTS[currentUserAgent]}`);
                } else {
                  Alert.alert('No More User-Agents', 'All User-Agent strings have been tried.');
                }
              }}>
                <Ionicons name="refresh" size={18} color={Colors.accent} />
                <Text style={[styles.buttonText, { color: Colors.accent }]}>Try Next User-Agent</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.outlinedButton]} onPress={testApiConnectivity} disabled={isLoading}>
                <Ionicons name="wifi" size={18} color={Colors.accent} />
                <Text style={[styles.buttonText, { color: Colors.accent }]}>Test API Connectivity</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={login} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name="log-in" size={18} color="#fff" />}
                <Text style={styles.buttonText}>{isLoading ? 'Logging in...' : 'Login'}</Text>
              </TouchableOpacity>
            </>
          )}

          {authStep === '2fa-options' && (
            <>
              <Text style={styles.help}>Two-factor required. You can fetch options or directly request SMS.</Text>

              <TouchableOpacity style={styles.button} onPress={getTwoFactorOptions} disabled={isLoading}>
                <Ionicons name="list" size={18} color="#fff" />
                <Text style={styles.buttonText}>Get 2FA Options</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={requestSmsCode} disabled={isLoading}>
                <Ionicons name="phone-portrait" size={18} color="#fff" />
                <Text style={styles.buttonText}>Send SMS Code</Text>
              </TouchableOpacity>
            </>
          )}

          {authStep === '2fa-verify' && (
            <>
              <Text style={styles.label}>Enter 6-digit code</Text>
              <TextInput
                style={styles.input}
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="123456"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={isLoading}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.buttonText}>{isLoading ? 'Verifying...' : 'Verify Code'}</Text>
              </TouchableOpacity>
            </>
          )}

          {authStep === 'authenticated' && (
            <>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                <Text style={styles.successText}>Authenticated</Text>
              </View>
              <TouchableOpacity style={[styles.button, styles.outlinedDanger]} onPress={revokeToken} disabled={isLoading}>
                <Ionicons name="log-out" size={18} color={Colors.danger} />
                <Text style={[styles.buttonText, { color: Colors.danger }]}>Logout / Revoke Token</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        <Card variant="outlined" margin="large" padding="large">
          <Text style={styles.sectionTitle}>Parameters</Text>
          <Text style={styles.label}>Target User Id</Text>
          <TextInput
            style={styles.input}
            value={targetUserId}
            onChangeText={setTargetUserId}
            placeholder="e.g. 4696228937479104362"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Transaction Id</Text>
          <TextInput
            style={styles.input}
            value={transactionId}
            onChangeText={setTransactionId}
            placeholder="e.g. 5296429055819060535"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Funding Source Id (for send)</Text>
          <TextInput
            style={styles.input}
            value={fundingSourceId}
            onChangeText={setFundingSourceId}
            placeholder="e.g. 1208112335595142453"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="5.00"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={styles.label}>Audience</Text>
              <TextInput
                style={styles.input}
                value={audience}
                onChangeText={setAudience}
                placeholder="private | friends | public"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
              />
            </View>
          </View>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Transaction note"
            placeholderTextColor={Colors.textSecondary}
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, !requestMode ? styles.chipActive : null]}
              onPress={() => setRequestMode(false)}
            >
              <Text style={[styles.chipText, !requestMode ? styles.chipTextActive : null]}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, requestMode ? styles.chipActive : null]}
              onPress={() => setRequestMode(true)}
            >
              <Text style={[styles.chipText, requestMode ? styles.chipTextActive : null]}>Request</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card variant="elevated" margin="large" padding="large">
          <Text style={styles.sectionTitle}>Endpoints</Text>
          <View style={styles.grid}>
            <TouchableOpacity style={styles.gridButton} onPress={getMe} disabled={isLoading}>
              <Ionicons name="person" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>GET /me</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridButton} onPress={getUser} disabled={isLoading}>
              <Ionicons name="search" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>GET /users/:id</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridButton} onPress={getFriends} disabled={isLoading}>
              <Ionicons name="people" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>GET friends</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridButton} onPress={getPaymentMethods} disabled={isLoading}>
              <Ionicons name="card" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>GET payment-methods</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridButton} onPress={makePaymentOrRequest} disabled={isLoading}>
              <Ionicons name="cash" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>POST /payments</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridButton} onPress={getTransaction} disabled={isLoading}>
              <Ionicons name="receipt-outline" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>GET transaction</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridButton} onPress={getUserTransactions} disabled={isLoading}>
              <Ionicons name="time" size={18} color="#fff" />
              <Text style={styles.gridButtonText}>GET user stories</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.danger }]} onPress={revokeToken} disabled={isLoading}>
              <Ionicons name="log-out" size={18} color={Colors.danger} />
              <Text style={[styles.gridButtonText, { color: Colors.danger }]}>DELETE token</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card variant="outlined" margin="large" padding="large">
          <View style={styles.resultsHeader}>
            <Text style={styles.sectionTitle}>Result</Text>
            <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          {!!resultTitle && <Text style={styles.resultTitle}>{resultTitle}</Text>}
          <View style={styles.resultBox}>
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.mono}>{resultBody || 'No result yet'}</Text>
            )}
          </View>
        </Card>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Internal Browser Modal */}
      <Modal
        visible={showInternalBrowser}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Venmo Sign-In (Auto Extract)</Text>
            <TouchableOpacity style={styles.closeButton} onPress={closeInternalBrowser}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.extractedDataContainer}>
            <Text style={styles.extractedDataTitle}>Extracted Data:</Text>
            <Text style={styles.extractedDataText}>
              Device ID: {extractedData.deviceId || 'Not found'}
            </Text>
            <Text style={styles.extractedDataText}>
              Username: {extractedData.username || 'Not found'}
            </Text>
            <Text style={styles.extractedDataText}>
              Access Token: {extractedData.accessToken ? 'Found!' : 'Not found'}
            </Text>
          </View>

          <WebView
            source={{ uri: 'https://venmo.com/account/sign-in' }}
            style={styles.webView}
            injectedJavaScript={injectedJavaScript}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.loadingText}>Loading Venmo...</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  button: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  outlinedDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  outlinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  buttonText: {
    ...Typography.title,
    color: '#fff',
    marginLeft: Spacing.sm,
  },
  help: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  successText: {
    ...Typography.h3,
    color: Colors.success,
    marginLeft: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: '#fff',
    fontFamily: Typography.familySemiBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridButton: {
    width: '48%',
    backgroundColor: Colors.accent,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  gridButtonText: {
    ...Typography.body,
    color: '#fff',
    marginLeft: Spacing.xs,
    fontFamily: Typography.familyMedium,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: '#fff',
  },
  clearButtonText: {
    ...Typography.label,
    color: Colors.danger,
    marginLeft: 6,
  },
  resultTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  resultBox: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  extractedDataContainer: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  extractedDataTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  extractedDataText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontFamily: 'Courier',
    fontSize: 12,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
});

export default VenmoTest;


