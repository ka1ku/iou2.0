import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Dimensions } from 'react-native';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';

import LottieView from 'lottie-react-native';
import { Colors, Typography, Spacing } from './design/tokens';

// Initialize Firebase
import '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';

// Initialize RevenueCat
import Purchases from 'react-native-purchases';

// Import auth service 
import { onAuthStateChange } from './services/authService';
import deepLinkService from './services/deepLinkService';

// Import screens
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import AddReceiptScreen from './screens/AddReceiptScreen';
import SettleUpScreen from './screens/SettleUpScreen';
import ExpenseSettingsScreen from './screens/ExpenseSettingsScreen';
import WelcomeScreen from './screens/auth/WelcomeScreen';
import SignInScreen from './screens/auth/SignInScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import VerifyOTPScreen from './screens/auth/VerifyOTPScreen';
// TwoFactorAuthScreen removed
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';
import FriendProfileScreen from './screens/FriendProfileScreen';
import ExpenseJoinHandler from './components/ExpenseJoinHandler';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack navigator for Home tab (includes AddExpense)
const HomeStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddReceipt"
        component={AddReceiptScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SettleUp"
        component={SettleUpScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ExpenseSettings"
        component={ExpenseSettingsScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

// Stack navigator for Profile tab (includes NotificationSettings)
const ProfileStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="FriendProfile"
        component={FriendProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

// Create context for receipt scanning state
const ReceiptScanningContext = createContext();

// Hook to use the receipt scanning context
export const useReceiptScanning = () => {
  const context = useContext(ReceiptScanningContext);
  if (!context) {
    throw new Error('useReceiptScanning must be used within a ReceiptScanningProvider');
  }
  return context;
};

// Provider component for receipt scanning state
const ReceiptScanningProvider = ({ children }) => {
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [showScanningOverlay, setShowScanningOverlay] = useState(false);

  // Animation functions
  const startScanningAnimation = () => {
    setShowScanningOverlay(true);
  };

  const stopScanningAnimation = () => {
    setShowScanningOverlay(false);
  };

  const value = {
    isReceiptScanning,
    setIsReceiptScanning,
    showScanningOverlay,
    setShowScanningOverlay,
    startScanningAnimation,
    stopScanningAnimation,
  };

  return (
    <ReceiptScanningContext.Provider value={value}>
      {children}
    </ReceiptScanningContext.Provider>
  );
};

// Main tab navigator
const MainTabs = () => {
  const { isReceiptScanning, showScanningOverlay } = useReceiptScanning();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => {
          // Get the currently focused route name within the stack
          const routeName = getFocusedRouteNameFromRoute(route);
          
          return {
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person' : 'person-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: Colors.tabActive,
            tabBarInactiveTintColor: Colors.tabInactive,
            tabBarStyle: {
              backgroundColor: Colors.surface,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              height: 90,
              paddingBottom: 30,
              paddingTop: 10,
              // Hide tab bar when on AddExpense, AddReceipt, or SettleUp screens
              display: (routeName === 'AddExpense' || routeName === 'AddReceipt' || routeName === 'SettleUp') ? 'none' : 'flex',
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontFamily: Typography.familyMedium,
              marginTop: 4,
            },
            headerShown: false,
          };
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
        />
      </Tab.Navigator>
      
      {/* Receipt Scanning Background Overlay - covers entire screen including tab bar */}
      {isReceiptScanning && (
        <View 
          style={[StyleSheet.absoluteFillObject, { zIndex: 1000, backgroundColor: 'white' }]}
        />
      )}
      
      {/* Receipt Scanning Animation Overlay - appears on top of blur */}
      {showScanningOverlay && (
        <View style={styles.scanningOverlay}>
          <LottieView
            source={require('./assets/Data Scanning.json')}
            autoPlay
            loop
            style={styles.lottieAnimation}
          />
        </View>
      )}
    </View>
  );
};



// Loading screen component
const LoadingScreen = () => {
  return (
    <SafeAreaView style={styles.loadingContainer}>
      <Ionicons name="card-outline" size={64} color={Colors.accent} />
      <Text style={styles.loadingText}>IOU</Text>
      <Text style={styles.loadingSubtext}>Setting up your account...</Text>
    </SafeAreaView>
  );
};

// Authentication Stack Navigator
const AuthStack = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
    </Stack.Navigator>
  );
};

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user);
      setLoading(false);
      
      // Update RevenueCat user ID when user changes
      if (user?.uid) {
        Purchases.setAppUserID(user.uid);
      }
    });

    // Initialize deep link service
    deepLinkService.initialize();

    // Initialize RevenueCat
    // TODO: Replace 'YOUR_REVENUECAT_API_KEY' with your actual API key
    Purchases.configure({
      apiKey: 'appl_pgTAldGQhisRrPVshAixwbYUgYe', // Replace with your actual API key
      appUserID: null, // Will be set when user logs in
    });

    // Add RevenueCat debug logging
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    
    // Test RevenueCat connection
    Purchases.getOfferings()
      .then(offerings => {
        console.log('RevenueCat offerings loaded successfully:', offerings);
        if (offerings.current) {
          console.log('Current offering:', offerings.current);
          console.log('Available packages:', offerings.current.availablePackages);
        } else {
          console.warn('No current offering available');
        }
      })
      .catch(error => {
        console.error('RevenueCat offerings error:', error);
      });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      deepLinkService.cleanup();
    };
  }, []);

  if (loading || !fontsLoaded) {
    return <LoadingScreen />;
  }

  if (fontError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.danger} />
          <Text style={styles.errorText}>Failed to load fonts</Text>
          <Text style={styles.errorSubtext}>Please restart the app</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer onReady={onLayoutRootView}>
        <StatusBar style="dark" />
        <ReceiptScanningProvider>
          {user ? <MainTabs /> : <AuthStack />}
          <ExpenseJoinHandler />
        </ReceiptScanningProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.accent,
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.danger,
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },

  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001, // Ensure it's above blur and other content
  },
  lottieAnimation: {
    width: 300,
    height: 300,
  },
  scanningText: { 
    ...Typography.title, 
    color: 'white', 
    marginTop: Spacing.lg, 
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
});
