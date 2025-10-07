import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import Purchases from 'react-native-purchases';

import { Colors, Typography } from './design/tokens';

import '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';
import '@react-native-firebase/ai';

import { onAuthStateChange } from './services/authService';
import deepLinkService from './services/deepLinkService';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SetupExpenseScreen from './screens/SetupExpenseScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import AddReceiptScreen from './screens/AddReceiptScreen';
import SettleUpScreen from './screens/SettleUpScreen';
import ExpenseSettingsScreen from './screens/ExpenseSettingsScreen';
import NotificationSettingsScreen from './screens/settings/NotificationSettingsScreen';
import VenmoTestScreen from './screens/settings/VenmoTest';
import SettingsScreen from './screens/SettingsScreen';
import FriendProfileScreen from './screens/FriendProfileScreen';

import WelcomeScreen from './screens/auth/WelcomeScreen';
import SignInScreen from './screens/auth/SignInScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import VerifyOTPScreen from './screens/auth/VerifyOTPScreen';

import ExpenseJoinHandler from './components/expenses/ExpenseJoinHandler';

import { ExpenseProvider } from './contexts/ExpenseContext';
import { ExpenseDataProvider, useExpenseData } from './contexts/ExpenseDataContext';
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const SetupExpenseScreenWithProvider = (props) => {
  const { userProfile } = useExpenseData();
  return (
    <ExpenseProvider userProfile={userProfile}>
      <SetupExpenseScreen {...props} />
    </ExpenseProvider>
  );
};

const AddExpenseScreenWithProvider = (props) => {
  const { userProfile } = useExpenseData();
  return (
    <ExpenseProvider userProfile={userProfile}>
      <AddExpenseScreen {...props} />
    </ExpenseProvider>
  );
};

const AddReceiptScreenWithProvider = (props) => {
  const { userProfile } = useExpenseData();
  return (
    <ExpenseProvider userProfile={userProfile}>
      <AddReceiptScreen {...props} />
    </ExpenseProvider>
  );
};

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SetupExpense" component={SetupExpenseScreenWithProvider} options={{ headerShown: false }} />
    <Stack.Screen name="AddExpense" component={AddExpenseScreenWithProvider} options={{ headerShown: false }} />
    <Stack.Screen name="AddReceipt" component={AddReceiptScreenWithProvider} options={{ headerShown: false }} />
    <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ExpenseSettings" component={ExpenseSettingsScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="VenmoTest" component={VenmoTestScreen} options={{ headerShown: false }} />
    <Stack.Screen name="FriendProfile" component={FriendProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AddExpense" component={AddExpenseScreenWithProvider} options={{ headerShown: false }} />
    <Stack.Screen name="AddReceipt" component={AddReceiptScreenWithProvider} options={{ headerShown: false }} />
    <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ExpenseSettings" component={ExpenseSettingsScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const ReceiptScanningContext = createContext();

export const useReceiptScanning = () => {
  const context = useContext(ReceiptScanningContext);
  if (!context) {
    throw new Error('useReceiptScanning must be used within a ReceiptScanningProvider');
  }
  return context;
};

const ReceiptScanningProvider = ({ children }) => {
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [showScanningOverlay, setShowScanningOverlay] = useState(false);

  const startScanningAnimation = () => setShowScanningOverlay(true);
  const stopScanningAnimation = () => setShowScanningOverlay(false);

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

const MainTabs = () => {
  const { isReceiptScanning, showScanningOverlay } = useReceiptScanning();

  const getTabBarIcon = (routeName, focused, color, size) => {
    const iconMap = {
      Home: focused ? 'home' : 'home-outline',
      Profile: focused ? 'person' : 'person-outline',
    };
    return <Ionicons name={iconMap[routeName]} size={size} color={color} />;
  };

  const getTabBarStyle = (route) => {
    const routeName = getFocusedRouteNameFromRoute(route);
    const hiddenRoutes = ['AddExpense', 'AddReceipt', 'SettleUp', 'SetupExpense', 'ExpenseSettings', 'NotificationSettings', 'VenmoTest', 'FriendProfile', 'Settings'];

    return {
      backgroundColor: Colors.surface,
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      height: 90,
      paddingBottom: 30,
      paddingTop: 10,
      display: hiddenRoutes.includes(routeName) ? 'none' : 'flex',
    };
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => getTabBarIcon(route.name, focused, color, size),
          tabBarActiveTintColor: Colors.tabActive,
          tabBarInactiveTintColor: Colors.tabInactive,
          tabBarStyle: getTabBarStyle(route),
          tabBarLabelStyle: {
            fontSize: 12,
            fontFamily: Typography.familyMedium,
            marginTop: 4,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Profile" component={ProfileStack} />
      </Tab.Navigator>
      
      {isReceiptScanning && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, backgroundColor: 'white' }]} />
      )}
      
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



const LoadingScreen = () => (
  <SafeAreaView style={styles.loadingContainer}>
    <Ionicons name="card-outline" size={64} color={Colors.accent} />
    <Text style={styles.loadingText}>IOU</Text>
    <Text style={styles.loadingSubtext}>Setting up your account...</Text>
  </SafeAreaView>
);

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    <Stack.Screen name="SignIn" component={SignInScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
    <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
  </Stack.Navigator>
);

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
    const initializeServices = async () => {
      try {
        await Purchases.configure({
          apiKey: 'appl_pgTAldGQhisRrPVshAixwbYUgYe',
          appUserID: null,
        });
        
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        
        const offerings = await Purchases.getOfferings();
        
      } catch (error) {
      }
      
      try {
        deepLinkService.initialize();
      } catch (error) {
      }
    };

    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user);
      setLoading(false);
      
      if (user?.uid) {
        try {
          await Purchases.setAppUserID(user.uid);
        } catch (error) {
        }
      }
    });

    initializeServices();

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
        <ExpenseDataProvider>
          <ReceiptScanningProvider>
            {user ? <MainTabs /> : <AuthStack />}
            <ExpenseJoinHandler />
          </ReceiptScanningProvider>
        </ExpenseDataProvider>
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
    zIndex: 1001,
  },
  lottieAnimation: {
    width: 300,
    height: 300,
  },
});
