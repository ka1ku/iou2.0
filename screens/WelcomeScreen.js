import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';

const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/appstore.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Welcome to IOU</Text>
        <Text style={styles.subtitle}>
          Split expenses easily with friends and family
        </Text>
      </View>

      {/* Features Section */}
      <View style={styles.featuresContainer}>
        <View style={styles.feature}>
          <Ionicons name="people-outline" size={32} color={Colors.accent} />
          <Text style={styles.featureText}>Split with Groups</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="calculator-outline" size={32} color={Colors.accent} />
          <Text style={styles.featureText}>Auto Calculate</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="sync-outline" size={32} color={Colors.accent} />
          <Text style={styles.featureText}>Real-time Sync</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Create Account</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background, // Subtle background that matches the app theme
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
    overflow: 'hidden', // Ensures the image respects the rounded corners
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.xl, // Match the container's border radius
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  button: {
    height: 56,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    ...Shadows.card,
  },
  primaryButtonText: {
    ...Typography.title,
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  secondaryButtonText: {
    ...Typography.title,
    color: Colors.accent,
  },
});

export default WelcomeScreen;
