import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, Typography } from '../design/tokens';
import SmartSplitInput from './SmartSplitInput';

const SmartSplitDemo = () => {
  const [demoTotal, setDemoTotal] = useState(100);
  const [participants] = useState([
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Charlie' },
    { name: 'Diana' },
  ]);

  const [splits, setSplits] = useState([]);

  const handleSplitsChange = (newSplits) => {
    setSplits(newSplits);
    console.log('Splits updated:', newSplits);
  };

  const changeTotal = (newTotal) => {
    setDemoTotal(newTotal);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Split Demo</Text>
        <Text style={styles.subtitle}>
          Test the simplified smart split algorithm
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Total Amount Controls</Text>
        <View style={styles.totalControls}>
          <TouchableOpacity
            style={styles.totalButton}
            onPress={() => changeTotal(25)}
          >
            <Text style={styles.totalButtonText}>$25.00</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.totalButton}
            onPress={() => changeTotal(50)}
          >
            <Text style={styles.totalButtonText}>$50.00</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.totalButton}
            onPress={() => changeTotal(100)}
          >
            <Text style={styles.totalButtonText}>$100.00</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.totalButton}
            onPress={() => changeTotal(157.89)}
          >
            <Text style={styles.totalButtonText}>$157.89</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart Split Input</Text>
        <SmartSplitInput
          participants={participants}
          total={demoTotal}
          onSplitsChange={handleSplitsChange}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Splits</Text>
        {splits.map((split, index) => (
          <View key={index} style={styles.splitRow}>
            <Text style={styles.participantName}>
              {participants[split.participantIndex]?.name || `Person ${split.participantIndex + 1}`}
            </Text>
            <Text style={styles.splitAmount}>
              ${(split.amount || 0).toFixed(2)}
            </Text>
          </View>
        ))}
        {splits.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total:</Text>
            <Text style={styles.summaryAmount}>
              ${splits.reduce((sum, split) => sum + (split.amount || 0), 0).toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <Text style={styles.instructionText}>
          • Start with even distribution across all participants{'\n'}
          • Type in any field to lock it and auto-distribute the remaining amount{'\n'}
          • Delete all numbers and click out to return to auto-fill mode{'\n'}
          • The system handles rounding and ensures totals always match{'\n'}
          • Simple and intuitive - no percentages needed
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
  totalControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  totalButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  totalButtonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: '600',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  participantName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  splitAmount: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
    marginRight: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  summaryLabel: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  summaryAmount: {
    ...Typography.title,
    color: Colors.accent,
    fontWeight: '600',
  },
  instructionText: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

export default SmartSplitDemo;
