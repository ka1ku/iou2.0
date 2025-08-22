import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';
import Button from '../../components/Button';

const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/appstore.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Welcome to IOU</Text>
        <Text style={styles.subtitle}>
          Split expenses easily with friends and family
        </Text>
      </View>

      {/* Background Accent */}
      <View style={styles.backgroundAccent} />

      {/* Features Section */}
      <View style={styles.featuresContainer}>
        <View style={styles.feature}>
          <View style={styles.iconContainer}>
            <Ionicons name="people-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>Split with Groups</Text>
        </View>
        <View style={styles.feature}>
          <View style={styles.iconContainer}>
            <Ionicons name="calculator-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>Auto Calculate</Text>
        </View>
        <View style={styles.feature}>
          <View style={styles.iconContainer}>
            <Ionicons name="sync-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>Real-time Sync</Text>
        </View>
      </View>

      {/* Visual Separator */}
      <View style={styles.separator} />

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title="Create Account"
          onPress={() => navigation.navigate('SignUp')}
          variant="primary"
          size="large"
          fullWidth
          style={styles.createAccountButton}
        />
        
        <Button
          title="Sign In"
          onPress={() => navigation.navigate('SignIn')}
          variant="outline"
          size="large"
          fullWidth
          style={styles.button}
        />
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
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.xl,
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
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
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
    paddingHorizontal: Spacing.xs,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
  },
  featureText: {
    ...Typography.label,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  createAccountButton: {
    marginBottom: Spacing.md,
    shadowOpacity: 0,
    elevation: 0,
    color: Colors.white,
  },
  button: {
    marginBottom: Spacing.md,
  },
  backgroundAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: Colors.accent + '05', // A very subtle accent background
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  separator: {
    height: Spacing.md,
    backgroundColor: Colors.background,
    marginVertical: Spacing.md,
  },

});

export default WelcomeScreen;
