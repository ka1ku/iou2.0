import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

import { useTranslation } from '../../contexts/LanguageContext';

const TermsOfServiceScreen = ({ navigation }) => {
  const { t } = useTranslation();
  React.useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.terms')}</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <Text style={styles.lastUpdated}>{t('settings.termsOfService.lastUpdated')}</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.1.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.1.content')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.2.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.2.content')}
            </Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.2.bullets.1')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.2.bullets.2')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.2.bullets.3')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.2.bullets.4')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.3.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.3.content')}
            </Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.3.bullets.1')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.3.bullets.2')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.3.bullets.3')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.3.bullets.4')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.4.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.4.content')}
            </Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.4.bullets.1')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.4.bullets.2')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.4.bullets.3')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.5.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.5.content')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.6.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.6.content')}
            </Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.6.bullets.1')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.6.bullets.2')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.6.bullets.3')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.6.bullets.4')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.6.bullets.5')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.6.content2')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.7.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.7.content')}
            </Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.7.bullets.1')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.7.bullets.2')}</Text>
            <Text style={styles.bulletPoint}>• {t('settings.termsOfService.sections.7.bullets.3')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.8.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.8.content')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.9.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.9.content')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.10.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.10.content')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.termsOfService.sections.11.title')}</Text>
            <Text style={styles.sectionText}>
              {t('settings.termsOfService.sections.11.content')}
            </Text>
            <Text style={styles.contactInfo}>{t('settings.termsOfService.sections.11.email')}</Text>
            <Text style={styles.contactInfo}>{t('settings.termsOfService.sections.11.support')}</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('settings.termsOfService.footer')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
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
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  lastUpdated: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontFamily: Typography.familySemiBold,
  },
  sectionText: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  bulletPoint: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginLeft: Spacing.md,
    marginBottom: Spacing.xs,
  },
  contactInfo: {
    ...Typography.body,
    color: Colors.accent,
    fontFamily: Typography.familySemiBold,
    marginTop: Spacing.xs,
  },
  footer: {
    backgroundColor: Colors.surface, // Clean flat surface for footer instead of elevated card
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
  },
  footerText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },
});

export default TermsOfServiceScreen;
