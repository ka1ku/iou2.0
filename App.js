import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { BlurView } from 'expo-blur';
import { Colors, Typography, Spacing } from './design/tokens';

// Initialize Firebase
import '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';

// Import auth service 
import { onAuthStateChange } from './services/authService';
import deepLinkService from './services/deepLinkService';

// Import screens
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import VenmoLinkScreen from './screens/VenmoLinkScreen';
import VerifyOTPScreen from './screens/VerifyOTPScreen';
import TwoFactorAuthScreen from './screens/TwoFactorAuthScreen';
import FriendsScreen from './screens/FriendsScreen';
import FriendInvitationHandler from './components/FriendInvitationHandler';
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
    </Stack.Navigator>
  );
};

// Stack navigator for Profile tab (includes TwoFactorAuth screen)
const ProfileStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TwoFactorAuth"
        component={TwoFactorAuthScreen}
        options={{
          headerShown: false,
        }}
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

  // Animation refs
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const cornerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const particle1Anim = useRef(new Animated.Value(0)).current;
  const particle2Anim = useRef(new Animated.Value(0)).current;
  const particle3Anim = useRef(new Animated.Value(0)).current;

  // Animation functions
  const startScanningAnimation = () => {
    setShowScanningOverlay(true);
    
    // Reset all animations
    [scanLineAnim, cornerAnim, pulseAnim, textAnim, particle1Anim, particle2Anim, particle3Anim]
      .forEach(anim => anim.setValue(anim === pulseAnim ? 1 : 0));
    
    // Create animation loops
    const createLoop = (anim, toValue, duration) => 
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue, duration, useNativeDriver: false }),
          Animated.timing(anim, { toValue: anim === pulseAnim ? 1 : 0, duration, useNativeDriver: false }),
        ])
      );
    
    // Start all animations
    createLoop(scanLineAnim, 1, 2000).start();
    createLoop(cornerAnim, 1, 1500).start();
    createLoop(pulseAnim, 1.2, 1000).start();
    createLoop(particle1Anim, 1, 3000).start();
    createLoop(particle2Anim, 1, 2500).start();
    createLoop(particle3Anim, 1, 3500).start();
    
    // Text fade in
    Animated.timing(textAnim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  };

  const stopScanningAnimation = () => {
    setShowScanningOverlay(false);
    [scanLineAnim, cornerAnim, pulseAnim, textAnim, particle1Anim, particle2Anim, particle3Anim]
      .forEach(anim => anim.stopAnimation());
  };

  const value = {
    isReceiptScanning,
    setIsReceiptScanning,
    showScanningOverlay,
    setShowScanningOverlay,
    scanLineAnim,
    cornerAnim,
    pulseAnim,
    textAnim,
    particle1Anim,
    particle2Anim,
    particle3Anim,
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
  const { isReceiptScanning, showScanningOverlay, scanLineAnim, cornerAnim, pulseAnim, textAnim, particle1Anim, particle2Anim, particle3Anim } = useReceiptScanning();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Friends') {
              iconName = focused ? 'people' : 'people-outline';
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
        />
        <Tab.Screen
          name="Friends"
          component={FriendsScreen}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
        />
      </Tab.Navigator>
      
      {/* Receipt Scanning Blur Overlay - covers entire screen including tab bar */}
      {isReceiptScanning && (
        <BlurView 
          tint="dark"
          intensity={50}
          style={[StyleSheet.absoluteFillObject, { zIndex: 1000 }]}
        />
      )}
      
      {/* Receipt Scanning Animation Overlay - appears on top of blur */}
      {showScanningOverlay && (
        <View style={styles.scanningOverlay}>
          {/* Scanning frame */}
          <View style={styles.scanningFrame}>
            {/* Corner brackets - properly oriented to form a box */}
            <View style={styles.cornerTopLeft}>
              <View style={[styles.cornerLine, styles.cornerTopLeftHorizontal]} />
              <View style={[styles.cornerLine, styles.cornerTopLeftVertical]} />
            </View>
            <View style={styles.cornerTopRight}>
              <View style={[styles.cornerLine, styles.cornerTopRightHorizontal]} />
              <View style={[styles.cornerLine, styles.cornerTopRightVertical]} />
            </View>
            <View style={styles.cornerBottomLeft}>
              <View style={[styles.cornerLine, styles.cornerBottomLeftHorizontal]} />
              <View style={[styles.cornerLine, styles.cornerBottomLeftVertical]} />
            </View>
            <View style={styles.cornerBottomRight}>
              <View style={[styles.cornerLine, styles.cornerBottomRightHorizontal]} />
              <View style={[styles.cornerLine, styles.cornerBottomRightVertical]} />
            </View>
            
            {/* Animated scanning line */}
            <Animated.View 
              style={[
                styles.scanningLine,
                {
                  transform: [{
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 200], // Full frame height
                    })
                  }]
                }
              ]} 
            />
            
            {/* Animated corner brackets */}
            <Animated.View 
              style={[
                styles.cornerBrackets,
                {
                  opacity: cornerAnim,
                  transform: [{ scale: cornerAnim }]
                }
              ]}
            >
              <View style={styles.cornerTopLeft}>
                <View style={[styles.cornerLine, styles.cornerTopLeftHorizontal]} />
                <View style={[styles.cornerLine, styles.cornerTopLeftVertical]} />
              </View>
              <View style={styles.cornerTopRight}>
                <View style={[styles.cornerLine, styles.cornerTopRightHorizontal]} />
                <View style={[styles.cornerLine, styles.cornerTopRightVertical]} />
              </View>
              <View style={styles.cornerBottomLeft}>
                <View style={[styles.cornerLine, styles.cornerBottomLeftHorizontal]} />
                <View style={[styles.cornerLine, styles.cornerBottomLeftVertical]} />
              </View>
              <View style={styles.cornerBottomRight}>
                <View style={[styles.cornerLine, styles.cornerBottomRightHorizontal]} />
                <View style={[styles.cornerLine, styles.cornerBottomRightVertical]} />
              </View>
            </Animated.View>
            
            {/* Floating particles - simplified */}
            <Animated.View style={[styles.particle, styles.particle1, { opacity: particle1Anim }]} />
            <Animated.View style={[styles.particle, styles.particle2, { opacity: particle2Anim }]} />
            <Animated.View style={[styles.particle, styles.particle3, { opacity: particle3Anim }]} />
          </View>
          
          {/* Scanning text */}
          <Animated.View 
            style={[
              styles.scanningTextContainer,
              {
                opacity: textAnim,
                transform: [{ translateY: textAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                }) }]
              }
            ]}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="scan-outline" size={32} color="#4A90E2" />
            </Animated.View>
            <Text style={styles.scanningText}>Scanning Receipt...</Text>
            <Text style={styles.scanningSubtext}>AI is analyzing your receipt</Text>
          </Animated.View>
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
      <Stack.Screen name="VenmoLink" component={VenmoLinkScreen} />
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
    });

    // Initialize deep link service
    deepLinkService.initialize();

    // Cleanup subscription on unmount
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
          <FriendInvitationHandler />
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
  scanningFrame: {
    width: 280,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 50,
  },
  // Corner container styles
  cornerTopLeft: { position: 'absolute', top: -2, left: -2, width: 20, height: 20 },
  cornerTopRight: { position: 'absolute', top: -2, right: -2, width: 20, height: 20 },
  cornerBottomLeft: { position: 'absolute', bottom: -2, left: -2, width: 20, height: 20 },
  cornerBottomRight: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20 },
  
  // Corner line styles - simplified
  cornerLine: {
    position: 'absolute',
    backgroundColor: '#4A90E2',
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 6,
  },
  // Corner orientations - single line each
  cornerTopLeftHorizontal: { width: 20, height: 2, top: 0, left: 0 },
  cornerTopLeftVertical: { width: 2, height: 20, top: 0, left: 0 },
  cornerTopRightHorizontal: { width: 20, height: 2, top: 0, right: 0 },
  cornerTopRightVertical: { width: 2, height: 20, top: 0, right: 0 },
  cornerBottomLeftHorizontal: { width: 20, height: 2, bottom: 0, left: 0 },
  cornerBottomLeftVertical: { width: 2, height: 20, bottom: 0, left: 0 },
  cornerBottomRightHorizontal: { width: 20, height: 2, bottom: 0, right: 0 },
  cornerBottomRightVertical: { width: 2, height: 20, bottom: 0, right: 0 },
  
  cornerBrackets: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  
  scanningLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    backgroundColor: '#4A90E2',
    borderRadius: 1.5,
    marginBottom: 230,
  },
  
  scanningTextContainer: {
    position: 'absolute',
    bottom: -120,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  scanningText: { ...Typography.title, color: 'white', marginTop: Spacing.md, textAlign: 'center' },
  scanningSubtext: { ...Typography.body, color: 'rgba(255, 255, 255, 0.8)', marginTop: Spacing.sm, textAlign: 'center' },
  
  // Particle styles - simplified
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4A90E2',
  },
  particle1: { top: 20, left: 50 },
  particle2: { top: 80, right: 30 },
  particle3: { bottom: 40, left: 30 },
});
