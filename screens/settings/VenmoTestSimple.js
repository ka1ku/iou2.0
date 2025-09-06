import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { Card } from '../../components';

const VenmoTestScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [otpSecret, setOtpSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [testAmount, setTestAmount] = useState('5.00');
  const [testNote, setTestNote] = useState('Test payment from IOU app');
  const [isRequestMode, setIsRequestMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [authStep, setAuthStep] = useState('login');

  // Venmo API Base URL
  const VENMO_API_BASE = 'https://api.venmo.com/v1';

  useEffect(() => {
    try {
      // Set navigation header
      if (navigation && navigation.setOptions) {
        navigation.setOptions({
          title: 'Venmo API Test',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.surface,
          },
          headerTintColor: Colors.textPrimary,
          headerShadowVisible: false,
        });
      }
    } catch (error) {
      console.error('Error setting navigation options:', error);
    }
  }, [navigation]);

  // Generate a random device ID (in real app, this should be persistent)
  const generateDeviceId = () => {
    return '88884260-05O3-8U81-58I1-2WA76F357GR9';
  };

  // Venmo API Helper Functions
  const makeVenmoRequest = async (endpoint, options = {}) => {
    try {
      const url = `${VENMO_API_BASE}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        'device-id': deviceId || generateDeviceId(),
        ...options.headers,
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      if (otpSecret) {
        headers['venmo-otp-secret'] = otpSecret;
      }

      if (otpCode) {
        headers['Venmo-Otp'] = otpCode;
        headers['User-Agent'] = 'Venmo/7.38.0 (iPhone; iOS 13.0; Scale/2.0)';
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data = {};
      try {
        data = await response.json();
      } catch (jsonError) {
        console.warn('Failed to parse JSON response:', jsonError);
        data = { error: 'Invalid JSON response' };
      }

      return { response, data };
    } catch (error) {
      console.error('makeVenmoRequest error:', error);
      return { 
        response: { ok: false, status: 0 }, 
        data: { error: error.message } 
      };
    }
  };

  // Authentication Functions
  const loginWithPhone = async () => {
    try {
      setIsLoading(true);
      const { response, data } = await makeVenmoRequest('/oauth/access_token', {
        method: 'POST',
        body: JSON.stringify({
          phone_email_or_username: phoneNumber,
          client_id: '1',
          password: password
        })
      });

      if (response.status === 401 && data?.error?.code === 81109) {
        // 2FA required
        const otpSecretValue = response.headers?.get('venmo-otp-secret') || '';
        setOtpSecret(otpSecretValue);
        setAuthStep('2fa-options');
        Alert.alert('2FA Required', 'Please complete two-factor authentication');
        return;
      }

      if (response.ok && data?.access_token) {
        setAccessToken(data.access_token);
        setAuthStep('authenticated');
        Alert.alert('Success', `Logged in successfully! User ID: ${data?.user?.id || 'Unknown'}`);
        return;
      }

      Alert.alert('Login Failed', data?.error?.message || 'Login failed');
    } catch (error) {
      Alert.alert('Login Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const requestSMS = async () => {
    try {
      setIsLoading(true);
      const { response, data } = await makeVenmoRequest('/account/two-factor/token', {
        method: 'POST',
        body: JSON.stringify({ via: 'sms' })
      });
      
      if (response.ok) {
        setAuthStep('2fa-verify');
        Alert.alert('SMS Sent', 'Check your phone for the verification code');
      } else {
        Alert.alert('Error', 'Failed to send SMS');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    try {
      setIsLoading(true);
      const { response, data } = await makeVenmoRequest('/oauth/access_token?client_id=1', {
        method: 'POST'
      });

      if (response.ok && data?.access_token) {
        setAccessToken(data.access_token);
        setAuthStep('authenticated');
        Alert.alert('Success', `2FA completed! User ID: ${data?.user?.id || 'Unknown'}`);
        return;
      }

      Alert.alert('Verification Failed', data?.error?.message || 'OTP verification failed');
    } catch (error) {
      Alert.alert('Verification Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Venmo API Integration Test</Text>
          <Text style={styles.headerSubtitle}>Test real Venmo API endpoints and functionality</Text>
        </View>

        <Card variant="elevated" margin="large" padding="large">
          <View style={styles.infoContainer}>
            <Ionicons name="card-outline" size={64} color={Colors.accent} />
            <Text style={styles.infoTitle}>Venmo API Testing</Text>
            <Text style={styles.infoDescription}>
              This tool allows you to test the real Venmo API integration using the 
              unofficial API endpoints. Enter your access token to begin testing.
            </Text>
          </View>
        </Card>

        <Card variant="outlined" margin="large" padding="large">
          <View style={styles.authContainer}>
            <Text style={styles.sectionTitle}>Authentication</Text>
            
            {authStep === 'login' && (
              <>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Enter phone number (e.g., +1234567890)"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={Colors.textSecondary}
                  secureTextEntry={true}
                />
                
                <Text style={styles.inputLabel}>Device ID (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={deviceId}
                  onChangeText={setDeviceId}
                  placeholder="Leave empty for auto-generated"
                  placeholderTextColor={Colors.textSecondary}
                />
                
                <TouchableOpacity 
                  style={styles.authButton}
                  onPress={loginWithPhone}
                  disabled={isLoading || !phoneNumber || !password}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="log-in" size={20} color="white" />
                  )}
                  <Text style={styles.authButtonText}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {authStep === '2fa-options' && (
              <>
                <Text style={styles.inputLabel}>2FA Options</Text>
                <Text style={styles.helpText}>
                  Two-factor authentication is required. Choose your preferred method:
                </Text>
                
                <TouchableOpacity 
                  style={styles.authButton}
                  onPress={requestSMS}
                  disabled={isLoading}
                >
                  <Ionicons name="phone-portrait" size={20} color="white" />
                  <Text style={styles.authButtonText}>Send SMS Code</Text>
                </TouchableOpacity>
              </>
            )}

            {authStep === '2fa-verify' && (
              <>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <TextInput
                  style={styles.textInput}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={6}
                />
                
                <TouchableOpacity 
                  style={styles.authButton}
                  onPress={verifyOTP}
                  disabled={isLoading || !otpCode}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="checkmark" size={20} color="white" />
                  )}
                  <Text style={styles.authButtonText}>
                    {isLoading ? 'Verifying...' : 'Verify Code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {authStep === 'authenticated' && (
              <>
                <View style={styles.successAuth}>
                  <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                  <Text style={styles.successTitle}>Authenticated</Text>
                  <Text style={styles.successDescription}>
                    You are logged in and ready to test the API
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.authButton, styles.logoutButton]}
                  onPress={() => {
                    setAccessToken('');
                    setAuthStep('login');
                    setTestResults(null);
                    setPhoneNumber('');
                    setPassword('');
                    setOtpCode('');
                    setOtpSecret('');
                  }}
                >
                  <Ionicons name="log-out" size={20} color={Colors.danger} />
                  <Text style={[styles.authButtonText, { color: Colors.danger }]}>Logout</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.inputHelp}>
              {authStep === 'login' && 'Enter your Venmo phone number and password to get an access token'}
              {authStep === '2fa-options' && 'Two-factor authentication is required for security'}
              {authStep === '2fa-verify' && 'Enter the 6-digit code sent to your phone'}
              {authStep === 'authenticated' && 'You are now authenticated and can test the API'}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    margin: Spacing.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  infoContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  infoTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  infoDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  authContainer: {
    paddingVertical: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
    marginBottom: Spacing.sm,
  },
  textInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  inputHelp: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  authButton: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  authButtonText: {
    ...Typography.title,
    color: 'white',
    marginLeft: Spacing.sm,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  successAuth: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  successTitle: {
    ...Typography.h3,
    color: Colors.success,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  successDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  helpText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
});

export default VenmoTestScreen;
