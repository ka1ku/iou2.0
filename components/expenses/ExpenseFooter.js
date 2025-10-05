import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';

const ExpenseFooter = ({ 
  loading = false,
  onSettlePress,
  settleButtonText = 'Settle Up'
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
      <TouchableOpacity
        style={[styles.settleButton, loading && styles.buttonDisabled]}
        onPress={onSettlePress}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={styles.buttonContent}>
          <Ionicons name="card" size={22} color={Colors.white} />
          <Text style={styles.settleButtonText}>
            {loading ? 'Processing...' : settleButtonText}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  settleButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accentDark,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settleButtonText: {
    ...Typography.title,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
});

export default ExpenseFooter;