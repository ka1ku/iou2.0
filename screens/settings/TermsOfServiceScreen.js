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

const TermsOfServiceScreen = ({ navigation }) => {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <Text style={styles.lastUpdated}>Last updated: December 2024</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
            <Text style={styles.sectionText}>
              By accessing and using the IOU mobile application ("App"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Use License</Text>
            <Text style={styles.sectionText}>
              Permission is granted to temporarily download one copy of the IOU app for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </Text>
            <Text style={styles.bulletPoint}>• modify or copy the materials</Text>
            <Text style={styles.bulletPoint}>• use the materials for any commercial purpose or for any public display</Text>
            <Text style={styles.bulletPoint}>• attempt to reverse engineer any software contained in the app</Text>
            <Text style={styles.bulletPoint}>• remove any copyright or other proprietary notations from the materials</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. User Accounts</Text>
            <Text style={styles.sectionText}>
              To use certain features of the App, you must create an account. You are responsible for:
            </Text>
            <Text style={styles.bulletPoint}>• Providing accurate and complete information</Text>
            <Text style={styles.bulletPoint}>• Maintaining the security of your account credentials</Text>
            <Text style={styles.bulletPoint}>• All activities that occur under your account</Text>
            <Text style={styles.bulletPoint}>• Notifying us immediately of any unauthorized use</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Payment Processing</Text>
            <Text style={styles.sectionText}>
              The App facilitates expense tracking and settlement between users. We may integrate with third-party payment processors. By using these features, you agree to:
            </Text>
            <Text style={styles.bulletPoint}>• Comply with the terms of service of third-party payment providers</Text>
            <Text style={styles.bulletPoint}>• Understand that we are not responsible for payment processing</Text>
            <Text style={styles.bulletPoint}>• Bear any fees charged by payment processors</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Privacy Policy</Text>
            <Text style={styles.sectionText}>
              Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the App, to understand our practices.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Prohibited Uses</Text>
            <Text style={styles.sectionText}>
              You may not use our App:
            </Text>
            <Text style={styles.bulletPoint}>• For any unlawful purpose or to solicit others to perform unlawful acts</Text>
            <Text style={styles.bulletPoint}>• To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</Text>
            <Text style={styles.bulletPoint}>• To infringe upon or violate our intellectual property rights or the intellectual property rights of others</Text>
            <Text style={styles.bulletPoint}>• To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</Text>
            <Text style={styles.bulletPoint}>• To submit false or misleading information</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Disclaimer</Text>
            <Text style={styles.sectionText}>
              The information on this App is provided on an "as is" basis. To the fullest extent permitted by law, this Company:
            </Text>
            <Text style={styles.bulletPoint}>• Excludes all representations and warranties relating to this app and its contents</Text>
            <Text style={styles.bulletPoint}>• Does not guarantee the accuracy, completeness, or timeliness of information</Text>
            <Text style={styles.bulletPoint}>• Excludes all liability for damages arising out of or in connection with your use of this app</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
            <Text style={styles.sectionText}>
              In no event shall IOU or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the App, even if IOU or an authorized representative has been notified orally or in writing of the possibility of such damage.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Revisions</Text>
            <Text style={styles.sectionText}>
              The materials appearing on the App could include technical, typographical, or photographic errors. IOU does not warrant that any of the materials on its App are accurate, complete, or current. IOU may make changes to the materials contained on its App at any time without notice.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Governing Law</Text>
            <Text style={styles.sectionText}>
              These terms and conditions are governed by and construed in accordance with the laws of the United States and you irrevocably submit to the exclusive jurisdiction of the courts in that state or location.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Contact Information</Text>
            <Text style={styles.sectionText}>
              If you have any questions about these Terms of Service, please contact us at:
            </Text>
            <Text style={styles.contactInfo}>Email: legal@iou-app.com</Text>
            <Text style={styles.contactInfo}>Support: support@iou-app.com</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By using IOU, you acknowledge that you have read and understood these Terms of Service and agree to be bound by them.
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
