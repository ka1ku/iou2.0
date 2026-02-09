import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useTranslation } from '../../contexts/LanguageContext';
import i18n from '../../utils/i18n';

const FLAG_MAP = {
  en: require('../../assets/flags/us.png'),
  es: require('../../assets/flags/es.png'),
  fr: require('../../assets/flags/fr.png'),
  de: require('../../assets/flags/de.png'),
  it: require('../../assets/flags/it.png'),
  pt: require('../../assets/flags/pt.png'),
  zh: require('../../assets/flags/cn.png'),
  ja: require('../../assets/flags/jp.png'),
  ko: require('../../assets/flags/kr.png'),
  vi: require('../../assets/flags/vn.png'),
};

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Italiano', value: 'it' },
  { label: 'Português', value: 'pt' },
  { label: '简体中文', value: 'zh' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Tiếng Việt', value: 'vi' },
];

const CURRENCIES = [
  { labelKey: 'settings.currencies.usd', value: 'USD', symbol: '$' },
  { labelKey: 'settings.currencies.eur', value: 'EUR', symbol: '€' },
  { labelKey: 'settings.currencies.gbp', value: 'GBP', symbol: '£' },
  { labelKey: 'settings.currencies.mxn', value: 'MXN', symbol: '$' },
  { labelKey: 'settings.currencies.cad', value: 'CAD', symbol: '$' },
  { labelKey: 'settings.currencies.cny', value: 'CNY', symbol: '¥' },
  { labelKey: 'settings.currencies.jpy', value: 'JPY', symbol: '¥' },
  { labelKey: 'settings.currencies.krw', value: 'KRW', symbol: '₩' },
  { labelKey: 'settings.currencies.vnd', value: 'VND', symbol: '₫' },
];



import { updateUserPreferences } from '../../services/authService';

const LanguageRegionSettingsScreen = ({ navigation }) => {
  const { language, setLanguage, currency, setCurrency } = useSettingsStore();
  const { t } = useTranslation();

  const syncPreferences = (updates) => {
    // Current state merged with updates
    const currentPrefs = {
      language,
      currency,
      ...updates
    };
    
    updateUserPreferences(currentPrefs);
  };

  const handleSetLanguage = (lang) => {
    setLanguage(lang);
    i18n.locale = lang;
    syncPreferences({ language: lang });
  };



  const handleSetCurrency = (curr) => {
    setCurrency(curr);
    syncPreferences({ currency: curr });
  };

  const SelectionSection = ({ title, data, value, onSelect, icon }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
      <View style={styles.card}>
        {data.map((item, index) => (
          <React.Fragment key={item.value}>
            <TouchableOpacity
              style={styles.item}
              onPress={() => onSelect(item.value)}
              activeOpacity={0.7}
            >
              <View style={styles.itemContent}>
                {FLAG_MAP[item.value] && (
                  <Image source={FLAG_MAP[item.value]} style={styles.flag} />
                )}
                <Text style={styles.itemText}>
                  {item.label || t(item.labelKey)}
                </Text>
              </View>
              {value === item.value && (
                <Ionicons name="checkmark" size={20} color={Colors.accent} />
              )}
            </TouchableOpacity>
            {index < data.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.preferences')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SelectionSection
          title={t('settings.language')}
          data={LANGUAGES}
          value={language}
          onSelect={handleSetLanguage}
          icon="language-outline"
        />



        <SelectionSection
          title={t('settings.currency')}
          data={CURRENCIES}
          value={currency}
          onSelect={handleSetCurrency}
          icon="cash-outline"
        />
      </ScrollView>
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
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
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
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadows.card,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    width: 24,
    height: 16,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  itemText: {
    ...Typography.body1,
    color: Colors.textPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.lg,
  },
});

export default LanguageRegionSettingsScreen;
