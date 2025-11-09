import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import LoadingSpinner from '../LoadingSpinner';

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
        activeOpacity={0.8}
      >
        {loading ? (
          <>
            <LoadingSpinner size="small" color={Colors.surface} />
            <Text style={styles.settleButtonText}>Processing...</Text>
          </>
        ) : (
          <>
            <Ionicons
              name="card"
              size={20}
              color={Colors.surface}
              style={styles.settleIcon}
            />
            <Text style={styles.settleButtonText}>{settleButtonText}</Text>
          </>
        )}
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
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.button,
  },
  settleIcon: {
    marginRight: Spacing.sm,
  },
  settleButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: Colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
});

export default ExpenseFooter;