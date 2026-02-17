import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { signOutUser, deleteUserAccount } from '../services/authService';
import ChangeVenmoBottomSheet from '../components/ChangeVenmoBottomSheet';
import { useTranslation } from '../contexts/LanguageContext';
import { useSettingsStore } from '../stores/useSettingsStore';
import { presentPaywall, restorePurchases } from '../services/revenueCatService';

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
  const { language, currency } = useSettingsStore();
  const { t } = useTranslation();

  const handleSignOut = () => {
    Alert.alert(
      t('settings.signOut'),
      'Are you sure you want to sign out?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOut'),
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

  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteUserAccount();
              // Navigation to auth screen handled by auth state listener or navigation reset if needed
            } catch (error) {
              setIsDeleting(false);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://tryiou.com/privacy');
  };

  const handleTermsOfService = () => {
    navigation.navigate('TermsOfService');
  };

  const handleManageSubscription = async () => {
    try {
      await presentPaywall();
    } catch (error) {
      Alert.alert(t('common.error'), 'Unable to open subscription management');
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo.activeSubscriptions.length > 0) {
        Alert.alert(t('common.success'), t('settings.restoreSuccess'));
      } else {
        Alert.alert(t('common.error'), t('settings.noSubscriptions'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.restoreError'));
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
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <SectionHeader title={t('settings.account')} />
        <View style={styles.sectionContainer}>
          <SettingItem
            icon="person-outline"
            title={t('settings.profile')}
            onPress={() => navigation.navigate('ProfileSettings')}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="card-outline"
            title={t('settings.venmo')}
            onPress={() => changeVenmoBottomSheetRef.current?.open()}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="rocket-outline"
            title={t('settings.manageSubscription')}
            onPress={handleManageSubscription}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="refresh-outline"
            title={t('settings.restorePurchases')}
            onPress={handleRestorePurchases}
          />
        </View>



        <SectionHeader title={t('settings.preferences')} />
        <View style={styles.sectionContainer}>
          <SettingItem
            icon="globe-outline"
            title={t('settings.language')}
            rightElement={<Text style={styles.rightValueText}>{language.toUpperCase()} • {currency}</Text>}
            onPress={() => navigation.navigate('LanguageRegion')}
          />
        </View>

        <SectionHeader title={t('settings.support')} />
        <View style={styles.sectionContainer}>
          <SettingItem
            icon="shield-checkmark-outline"
            title={t('settings.privacy')}
            onPress={handlePrivacyPolicy}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="document-text-outline"
            title={t('settings.terms')}
            onPress={handleTermsOfService}
          />
        </View>

        <View style={styles.sectionSpacing} />

        <View style={styles.sectionContainer}>
          <SettingItem
            icon="log-out-outline"
            title={t('settings.signOut')}
            onPress={handleSignOut}
            danger
            showChevron={false}
          />
          <View style={styles.separator} />
          <SettingItem
            icon="close-circle-outline"
            title={t('settings.deleteAccount')}
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
