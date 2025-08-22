import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, Typography } from '../design/tokens';
import DeleteButton from './DeleteButton';

const DeleteButtonDemo = () => {
  const handleDelete = () => {
    console.log('Delete button pressed');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delete Button Component</Text>
        <Text style={styles.subtitle}>
          Consistent delete/remove buttons throughout the app
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sizes</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Small</Text>
            <DeleteButton
              onPress={handleDelete}
              size="small"
              variant="default"
            />
          </View>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Medium</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="default"
            />
          </View>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Large</Text>
            <DeleteButton
              onPress={handleDelete}
              size="large"
              variant="default"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Variants</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Default</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="default"
            />
          </View>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Subtle</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="subtle"
            />
          </View>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Filled</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="filled"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>States</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Normal</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="subtle"
            />
          </View>
          <View style={styles.buttonExample}>
            <Text style={styles.buttonLabel}>Disabled</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="subtle"
              disabled={true}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage Examples</Text>
        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Expense Item</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>Coffee - $4.50</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="subtle"
            />
          </View>
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>Friend Selection</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>@john_doe</Text>
            <DeleteButton
              onPress={handleDelete}
              size="small"
              variant="subtle"
            />
          </View>
        </View>

        <View style={styles.exampleCard}>
          <Text style={styles.exampleTitle}>2FA Factor</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>Phone: (555) 123-4567</Text>
            <DeleteButton
              onPress={handleDelete}
              size="medium"
              variant="subtle"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        <Text style={styles.featureText}>
          • Consistent styling across all screens{'\n'}
          • Multiple size options (small, medium, large){'\n'}
          • Multiple variants (default, subtle, filled){'\n'}
          • Disabled state support{'\n'}
          • Touch feedback with activeOpacity{'\n'}
          • Accessible with testID support{'\n'}
          • Customizable with style prop
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  buttonExample: {
    alignItems: 'center',
  },
  buttonLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  exampleCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  exampleTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exampleText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  featureText: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

export default DeleteButtonDemo;
