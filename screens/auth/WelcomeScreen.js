import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';
import Button from '../../components/Button';
import { useTranslation } from '../../contexts/LanguageContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LINE_SPACING = 28; // Spacing between lines for notebook paper
const LINE_COLOR = '#90CAF9'; // Light blue for notebook lines (Material Blue 300)
const PAPER_BACKGROUND = '#FFFEFB'; // Very subtle off-white cream

// Component to render lined paper background
const LinedPaperBackground = () => {
  const numberOfLines = Math.ceil(SCREEN_HEIGHT / LINE_SPACING) + 10; // Extra lines for scrolling
  
  return (
    <View style={styles.linedPaperContainer}>
      {Array.from({ length: numberOfLines }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.line,
            { top: index * LINE_SPACING },
          ]}
        />
      ))}
    </View>
  );
};

const WelcomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={PAPER_BACKGROUND} />
      
      {/* Lined Paper Background */}
      <LinedPaperBackground />
      
      {/* Header Section */}
      <View style={[styles.header, { zIndex: 1 }]}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/transparent_logo.png')} 
            style={styles.logoImage}
            contentFit="contain"
            transition={200}
          />
        </View>
        <Text style={styles.title}>{t('auth.welcome.title')}</Text>

      </View>

      <View style={[styles.featuresContainer, { zIndex: 1 }]}>
        <View style={styles.feature}>
          <View style={styles.iconContainer}>
            <Ionicons name="people-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>{t('auth.welcome.split')}</Text>
        </View>
        <View style={styles.feature}>
          <View style={styles.iconContainer}>
            <Ionicons name="calculator-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>{t('auth.welcome.autoCalculate')}</Text>
        </View>
        <View style={styles.feature}>
          <View style={styles.iconContainer}>
            <Ionicons name="sync-outline" size={28} color={Colors.accent} />
          </View>
          <Text style={styles.featureText}>{t('auth.welcome.realTime')}</Text>
        </View>
      </View>

      <View style={[styles.separator, { zIndex: 1 }]} />

      <View style={[styles.buttonContainer, { zIndex: 1 }]}>
        <Button
          title={t('auth.welcome.createAccount')}
          onPress={() => navigation.navigate('SignUp')}
          variant="primary"
          size="large"
          fullWidth
          style={styles.createAccountButton}
        />
        
        <Button
          title={t('auth.welcome.signIn')}
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
    backgroundColor: PAPER_BACKGROUND,
  },
  linedPaperContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: LINE_COLOR,
    opacity: 0.25,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: '150%',
    height: '150%',
  },
  title: {
    fontSize: 32,
    fontFamily: Typography.familyRegular,
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
    fontSize: 12,
    fontFamily: Typography.familyRegular,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
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
    backgroundColor: PAPER_BACKGROUND,
    shadowOpacity: 0,
    elevation: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowColor: 'transparent',
  },
  separator: {
    height: Spacing.md,
    backgroundColor: 'transparent',
    marginVertical: Spacing.md,
  },

});

export default WelcomeScreen;
