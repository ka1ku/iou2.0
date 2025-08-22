import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { Card, Header } from '../components';

const NotificationSettingsScreen = ({ navigation }) => {
  useEffect(() => {
    // Set navigation header
    navigation.setOptions({
      title: 'Notification Settings',
      headerShown: true,
      headerStyle: {
        backgroundColor: Colors.surface,
      },
      headerTintColor: Colors.textPrimary,
      headerShadowVisible: false,
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Header
          title="Notification Preferences"
          subtitle="Push notifications are not currently implemented"
          style={styles.header}
        />

        <Card variant="elevated" margin="large" padding="large">
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.infoTitle}>Notifications Coming Soon</Text>
            <Text style={styles.infoDescription}>
              Push notifications are not currently implemented in this version of the app. 
              This feature will be added in a future update.
            </Text>
          </View>
        </Card>

        <Card variant="outlined" margin="large" padding="large">
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>Planned Features:</Text>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={styles.featureText}>Expense updates and reminders</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={styles.featureText}>Friend request notifications</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={styles.featureText}>Payment due reminders</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
              <Text style={styles.featureText}>Group activity updates</Text>
            </View>
          </View>
        </Card>
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
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    margin: Spacing.lg,
    ...Shadows.card,
  },
  infoContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  infoTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  infoDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  featuresContainer: {
    paddingVertical: Spacing.md,
  },
  featuresTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  featureText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
});

export default NotificationSettingsScreen;
