import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer, getFocusedRouteNameFromRoute, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import LottieView from 'lottie-react-native';
import Purchases from 'react-native-purchases';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Colors, Typography, Shadows, Radius } from './design/tokens';
import LoadingSpinner from './components/LoadingSpinner';

import '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';
import '@react-native-firebase/ai';

import { onAuthStateChange, getUserPreferences } from './services/authService';
import deepLinkService from './services/deepLinkService';
import expoNotificationService from './services/expoNotificationService';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SetupExpenseScreen from './screens/SetupExpenseScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import AddReceiptScreen from './screens/AddReceiptScreen';
import ExpenseSettingsScreen from './screens/ExpenseSettingsScreen';
import ProfileSettingsScreen from './screens/settings/ProfileSettingsScreen';
import TermsOfServiceScreen from './screens/settings/TermsOfServiceScreen';
import LanguageRegionSettingsScreen from './screens/settings/LanguageRegionSettingsScreen';
import SettingsScreen from './screens/SettingsScreen';
import FriendProfileScreen from './screens/FriendProfileScreen';

import WelcomeScreen from './screens/auth/WelcomeScreen';
import SignInScreen from './screens/auth/SignInScreen';
import SignUpScreen from './screens/auth/SignUpScreen';
import VerifyOTPScreen from './screens/auth/VerifyOTPScreen';
import ContactInviteScreen from './screens/auth/ContactInviteScreen';

import ExpenseJoinHandler from './components/expenses/ExpenseJoinHandler';
import CreateBottomSheet from './components/CreateBottomSheet';

import { ExpenseProvider } from './contexts/ExpenseContext';
import { ExpenseDataProvider, useExpenseData } from './contexts/ExpenseDataContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ReceiptScanningProvider, useReceiptScanning } from './contexts/ReceiptScanningContext';
import { useSettingsStore } from './stores/useSettingsStore';
import i18n from './utils/i18n';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

// Component to set up notification navigation handler
const NotificationNavigationSetup = () => {
  const navigation = useNavigation();
  const { isInitialized } = useNotifications();

  useEffect(() => {
    if (!isInitialized) return;

    // Create navigation handler
    const handleNotificationNavigation = (data) => {
      if (!data) return;
      
      const { route, expenseId, userId, screen } = data;
      
      try {
        switch (route) {
          case 'expense':
            if (expenseId) {
              // Navigate to the global ExpenseSettings screen
              navigation.navigate('ExpenseSettings', { expenseId });
            }
            break;
          case 'friend':
            if (userId) {
              // Navigate to the global FriendProfile screen
              navigation.navigate('FriendProfile', { userId });
            }
            break;
          case 'settle':
            // Settlement is now handled in AddExpenseScreen's Split tab
            // Navigate to home instead
            navigation.navigate('Home');
            break;
          case 'profile':
            navigation.navigate('Profile');
            break;
          case 'home':
            navigation.navigate('Home');
            break;
          default:
            if (screen) {
              navigation.navigate(screen);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to navigate from notification:', error);
      }
    };

    // Update notification service with navigation handler
    expoNotificationService.setNavigationHandler(handleNotificationNavigation);

    // Check for notification that opened the app
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data) {
          handleNotificationNavigation(data);
        }
      }
    });
  }, [isInitialized, navigation]);

  return null;
};

// Empty component for Create tab (doesn't render anything)
const CreateTabScreen = () => null;

const MainTabs = () => {
  const navigation = useNavigation();
  const bottomSheetRef = useRef(null);
  const { isReceiptScanning, showScanningOverlay } = useReceiptScanning();

  const getTabBarIcon = (routeName, focused, color, size) => {
    const iconMap = {
      Home: focused ? 'home' : 'home-outline',
      Create: 'add-circle',
      Profile: focused ? 'person' : 'person-outline',
    };
    return <Ionicons name={iconMap[routeName]} size={size} color={color} />;
  };

  const handleTabPress = (routeName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => getTabBarIcon(route.name, focused, color, size),
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
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontFamily: Typography.familyMedium,
            marginTop: 4,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeStack}
          listeners={{
            tabPress: () => handleTabPress('Home'),
          }}
        />
        <Tab.Screen
          name="Create"
          component={CreateTabScreen}
          options={{
            tabBarButton: (props) => (
              <View style={styles.createButtonContainer}>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    bottomSheetRef.current?.open();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={32} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ),
            tabBarLabel: '',
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileStack}
          listeners={{
            tabPress: () => handleTabPress('Profile'),
          }}
        />
      </Tab.Navigator>
      
      <CreateBottomSheet 
        ref={bottomSheetRef}
        navigation={navigation}
      />
      
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
    <LoadingSpinner size="large" />
  </SafeAreaView>
);

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    <Stack.Screen name="SignIn" component={SignInScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
    <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
    <Stack.Screen name="ContactInvite" component={ContactInviteScreen} />
  </Stack.Navigator>
);

SplashScreen.preventAutoHideAsync();

const OnboardingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ContactInvite" component={ContactInviteScreen} />
  </Stack.Navigator>
);

const RootStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      
      {/* Global Screens (Push over tabs) */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="LanguageRegion" component={LanguageRegionSettingsScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      
      {/* Expense Flow Screens */}
      <Stack.Screen name="SetupExpense" component={SetupExpenseScreenWithProvider} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreenWithProvider} />
      <Stack.Screen name="AddReceipt" component={AddReceiptScreenWithProvider} />
      <Stack.Screen name="ExpenseSettings" component={ExpenseSettingsScreen} />
    </Stack.Navigator>
  );
};

const AppContent = ({ user, loading }) => {
  const { userProfile } = useExpenseData();

  if (loading) {
     return <LoadingScreen />;
  }

  if (user) {
    // If we have a user but profile hasn't loaded yet, show loading
    if (!userProfile) {
       return <LoadingScreen />;
    }
    
    // Check if onboarding is completed
    if (userProfile.onboardingCompleted === false) {
      return <OnboardingStack />;
    }
    
    return <RootStack />;
  }
  
  return <AuthStack />;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef();
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const { language } = useSettingsStore();

  useEffect(() => {
    i18n.locale = language;
  }, [language]);

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
        
        await Purchases.getOfferings();
        
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
        // Sync preferences from Firebase
        try {
          const preferences = await getUserPreferences();
          if (preferences) {
            const { language, region, currency } = preferences;
            const store = useSettingsStore.getState();
            
            if (language) {
               store.setLanguage(language);
               i18n.locale = language;
            }
            if (region) store.setRegion(region);
            if (currency) store.setCurrency(currency);
          }
        } catch (error) {
           console.error('Failed to sync preferences:', error);
        }

      }

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

  if (!fontsLoaded && !fontError) {
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <BottomSheetModalProvider>
            <NavigationContainer ref={navigationRef} onReady={onLayoutRootView}>
              <StatusBar style="dark" />
              <ExpenseDataProvider>
                <NotificationProvider>
                  <ReceiptScanningProvider>
                    <AppContent user={user} loading={loading} />
                    <ExpenseJoinHandler />
                    {user && <NotificationNavigationSetup />}
                  </ReceiptScanningProvider>
                </NotificationProvider>
              </ExpenseDataProvider>
            </NavigationContainer>
          </BottomSheetModalProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
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
  createButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -20,
  },
  createButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
    borderWidth: 4,
    borderColor: Colors.surface,
  },
});
