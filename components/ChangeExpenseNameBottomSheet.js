import React, { forwardRef, useImperativeHandle, useRef, useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';
import LoadingSpinner from './LoadingSpinner';

const ChangeExpenseNameBottomSheet = forwardRef(({ expense, onSave, loading }, ref) => {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const [expenseName, setExpenseName] = useState(expense?.title || '');

  // Update expenseName when expense changes
  useEffect(() => {
    if (expense?.title) {
      setExpenseName(expense.title);
    }
  }, [expense?.title]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setExpenseName(expense?.title || '');
      bottomSheetRef.current?.present();
    },
    close: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const handleDismiss = useCallback(() => {
    // Reset state when dismissing
    setExpenseName(expense?.title || '');
  }, [expense?.title]);

  const handleSave = useCallback(() => {
    if (!expenseName.trim()) {
      return;
    }
    if (onSave) {
      onSave(expenseName.trim());
    }
  }, [expenseName, onSave]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        enableTouchThrough={false}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDismissOnClose
    >
      <BottomSheetScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + Spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="create-outline" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Change Expense Name</Text>
          <Text style={styles.subtitle}>
            Enter a new name for this expense
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Expense Name</Text>
            <BottomSheetTextInput
              style={styles.textInput}
              value={expenseName}
              onChangeText={setExpenseName}
              placeholder="Enter expense name"
              placeholderTextColor={Colors.textSecondary}
              autoFocus={true}
              maxLength={50}
              keyboardType="default"
              autoCorrect={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            (loading || !expenseName.trim()) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={loading || !expenseName.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <LoadingSpinner size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={styles.saveButtonText}>Save Changes</Text>
              <Ionicons name="checkmark" size={20} color="white" style={styles.buttonIcon} />
            </>
          )}
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

ChangeExpenseNameBottomSheet.displayName = 'ChangeExpenseNameBottomSheet';

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  handleIndicator: {
    backgroundColor: Colors.divider,
    width: 40,
    height: 4,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  formContainer: {
    flex: 1,
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    fontWeight: '500',
    minHeight: 52,
  },
  saveButton: {
    height: 52,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  buttonIcon: {
    marginLeft: Spacing.xs,
  },
});

export default ChangeExpenseNameBottomSheet;

