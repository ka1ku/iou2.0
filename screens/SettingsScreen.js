import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { signOutUser } from '../services/authService';
import ChangeVenmoBottomSheet from '../components/ChangeVenmoBottomSheet';
import i18n from '../utils/i18n';
import { useSettingsStore } from '../stores/useSettingsStore';
import { presentPaywall } from '../services/revenueCatService';

const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const SettingItem = ({ 
  icon, 
  title, 
  onPress, 
  showChevron = true, 
  textColor = Colors.textPrimary,
  rightElement,
  danger = false
}) => (
  <TouchableOpacity 
    style={styles.settingItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.iconContainer, danger && styles.iconContainerDanger]}>
      <Ionicons name={icon} size={20} color={danger ? Colors.danger : (Colors.textPrimary === '#FFFFFF' ? Colors.textPrimary : '#555')} />
    </View>
    <Text style={[styles.settingText, { color: textColor }]}>{title}</Text>
    {rightElement}
    {showChevron && !rightElement && (
      <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
    )}
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const changeVenmoBottomSheetRef = useRef(null);
  const { language, currency, region } = useSettingsStore();

  const handleSignOut = () => {
    Alert.alert(
      i18n.t('settings.signOut'),
      'Are you sure you want to sign out?',
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('settings.signOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutUser();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      i18n.t('settings.deleteAccount'),
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('settings.deleteAccount'),
          style: 'destructive',
          onPress: () => {
            Alert.alert('Coming Soon', 'Account deletion feature will be available soon.');
          }
        }
      ]
    );
  };

  const handleTermsOfService = () => {
    navigation.navigate('TermsOfService');
  };

  const handleRateApp = () => {
    const url = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/id123456789' 
      : 'https://play.google.com/store/apps/details?id=com.yourapp.iou';
    Linking.openURL(url);
  };

  const handleManageSubscription = async () => {
    try {
      await presentPaywall();
    } catch (error) {
      Alert.alert('Error', 'Unable to open subscription management');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{i18n.t('settings.title')}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <SectionHeader title={i18n.t('settings.account')} />
        <View style={styles.sectionContainer}>
          <SettingItem 
            icon="person-outline" 
            title={i18n.t('settings.profile')} 
            onPress={() => navigation.navigate('ProfileSettings')} 
          />
          <View style={styles.separator} />
          <SettingItem 
            icon="card-outline" 
            title={i18n.t('settings.venmo')} 
            onPress={() => changeVenmoBottomSheetRef.current?.open()} 
          />
          <View style={styles.separator} />
          <SettingItem 
            icon="diamond-outline" 
            title="Manage Subscription" 
            onPress={handleManageSubscription} 
          />
        </View>

        <SectionHeader title={i18n.t('settings.preferences')} />
        <View style={styles.sectionContainer}>
          <SettingItem 
            icon="globe-outline" 
            title={i18n.t('settings.language')} 
            rightElement={<Text style={styles.rightValueText}>{language.toUpperCase()} • {region} • {currency}</Text>}
            onPress={() => navigation.navigate('LanguageRegion')} 
          />
        </View>

        <SectionHeader title={i18n.t('settings.support')} />
        <View style={styles.sectionContainer}>
          <SettingItem 
            icon="document-text-outline" 
            title={i18n.t('settings.terms')} 
            onPress={handleTermsOfService} 
          />
          <View style={styles.separator} />
          <SettingItem 
            icon="star-outline" 
            title={i18n.t('settings.rate')} 
            onPress={handleRateApp} 
          />
        </View>

        <View style={styles.sectionSpacing} />
        
        <View style={styles.sectionContainer}>
          <SettingItem 
            icon="log-out-outline" 
            title={i18n.t('settings.signOut')} 
            onPress={handleSignOut}
            danger
            showChevron={false}
          />
          <View style={styles.separator} />
          <SettingItem 
            icon="close-circle-outline" 
            title={i18n.t('settings.deleteAccount')} 
            onPress={handleDeleteAccount}
            danger
            showChevron={false}
          />
        </View>

        <Text style={styles.versionText}>Version 1.0.0</Text>

      </ScrollView>
      <ChangeVenmoBottomSheet ref={changeVenmoBottomSheetRef} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background, // Seamless header
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm, // Align with content
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.card,
    elevation: 2, 
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: Colors.surface, // Or transparent if using shadow
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    minHeight: 56,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 16 + 32 + 12, // padding + icon width + icon margin (approx)
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm, // Slightly rounded square for iOS look
    backgroundColor: Colors.background, // or subtle grey
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconContainerDanger: {
    backgroundColor: '#FFE5E5',
    // color handled in icon prop
  },
  settingText: {
    ...Typography.body1,
    flex: 1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
  },
  sectionSpacing: {
    height: Spacing.lg,
  },
  versionText: {
    ...Typography.caption,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  rightValueText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
});

export default SettingsScreen;
