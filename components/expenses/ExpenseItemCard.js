import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  Spacing,
  Radius,
  Shadows,
  Typography,
} from "../../design/tokens";
import { useExpense } from "../../contexts/ExpenseContext";
import { useTranslation } from "../../contexts/LanguageContext";
import { updateExpense, updateExpenseParticipants } from "../../services/expenseService";
import { getCurrentUser } from "../../services/authService";
import Card from "../Card";
import DeleteButton from "../DeleteButton";
import PriceInput from "./PriceInput";
import LoadingSpinner from "../LoadingSpinner";

const smartRoundSplit = (total, count) => {
  if (count <= 0 || total <= 0) return new Array(count).fill(0);

  const totalCents = Math.round(total * 100);
  const baseAmountCents = Math.floor(totalCents / count);
  let remainderCents = totalCents % count;

  const amounts = new Array(count).fill(baseAmountCents / 100);

  for (let i = 0; i < remainderCents; i++) {
    amounts[i] = Math.round((amounts[i] + 0.01) * 100) / 100;
  }

  return amounts;
};

const SPLIT_TOLERANCE = 0.01;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ExpenseItemCard = ({ item, index, onCancelEdit, onDelete, expenseId, isEditing = false, isLocked = false }) => {
  const { t } = useTranslation();
  const { state, actions } = useExpense();
  const { participants } = state;

  const [manualSplits, setManualSplits] = useState({});
  const [saving, setSaving] = useState(false);

  const [activeInput, setActiveInput] = useState(null);
  
  const [validationErrors, setValidationErrors] = useState({
    name: false,
    amount: false,
    payers: false,
    consumers: false,
    splitMismatch: false,
  });

  useEffect(() => {
    if (item.splits && Array.isArray(item.splits) && item.selectedConsumers) {
      const initialManualSplits = {};
      item.selectedConsumers.forEach((consumerIndex, i) => {
        const splitAmount = item.splits[i];
        if (splitAmount !== undefined && splitAmount !== null && !isNaN(splitAmount)) {
          initialManualSplits[consumerIndex] = parseFloat(splitAmount);
        }
      });
      setManualSplits(initialManualSplits);
    }
  }, []);

  const derivedSplits = useMemo(() => {
    const total = parseFloat(item.amount) || 0;
    const consumers = item.selectedConsumers || [];

    if (consumers.length === 0 || total <= 0) {
      return [];
    }

    // Calculate manual total
    const manualTotal = consumers.reduce((sum, pIndex) =>
      sum + (manualSplits[pIndex] || 0), 0);

    // If manual splits exceed total, scale them down proportionally
    if (manualTotal > total) {
      const scaleFactor = total / manualTotal;
      return consumers.map(pIndex => {
        const manualAmount = manualSplits[pIndex];
        return manualAmount !== undefined
          ? Math.round(manualAmount * scaleFactor * 100) / 100
          : 0;
      });
    }

    // Calculate remaining balance for auto-split
    const remainingBalance = total - manualTotal;
    const autoConsumers = consumers.filter(pIndex => manualSplits[pIndex] === undefined);
    const autoAmounts = smartRoundSplit(remainingBalance, autoConsumers.length);

    // Map splits in order of consumers
    let autoIndex = 0;
    return consumers.map(pIndex =>
      manualSplits[pIndex] !== undefined
        ? manualSplits[pIndex]
        : autoAmounts[autoIndex++] || 0
    );
  }, [item.amount, item.selectedConsumers, manualSplits]);

  // Sync derived splits to item
  useEffect(() => {
    const consumers = item.selectedConsumers || [];
    if (derivedSplits.length === consumers.length && consumers.length > 0) {
      actions.updateItem(index, { splits: derivedSplits });
    }
  }, [derivedSplits, item.selectedConsumers, index, actions]);

  const handleAmountChange = (pIndex, value) => {
    const numValue = parseFloat(value);

    setManualSplits(prev => {
      const updated = { ...prev };

      // Clear manual split if value is invalid or empty
      if (value === "" || value === null || value === undefined || isNaN(numValue)) {
        delete updated[pIndex];
      } else {
        updated[pIndex] = numValue;
      }

      return updated;
    });
  };

  const handleFocus = (pIndex) => {
    const consumerPosition = item.selectedConsumers.indexOf(pIndex);
    const initialValue = consumerPosition >= 0 ? derivedSplits[consumerPosition] : 0;
    setActiveInput({
      index: pIndex,
      value: initialValue === 0 ? "0" : String(initialValue || ""),
    });
  };

  const handleBlur = () => {
    setActiveInput(null);
  };

  const handleLiveTextChange = (pIndex, text) => {
    setActiveInput({ index: pIndex, value: text });
    handleAmountChange(pIndex, text);
  };

  const toggleConsumer = (pIndex) => {
    const isSelected = item.selectedConsumers.includes(pIndex);
    const newConsumers = isSelected
      ? item.selectedConsumers.filter(i => i !== pIndex)
      : [...item.selectedConsumers, pIndex];

    // Must have at least one consumer
    if (newConsumers.length === 0) return;

    // Clear manual split for removed consumer
    if (isSelected && manualSplits[pIndex] !== undefined) {
      setManualSplits(prev => {
        const updated = { ...prev };
        delete updated[pIndex];
        return updated;
      });
    }

    // Update selected consumers
    actions.updateItem(index, { selectedConsumers: newConsumers });

    // Clear validation errors
    if (validationErrors.consumers || validationErrors.splitMismatch) {
      setValidationErrors(prev => ({
        ...prev,
        consumers: false,
        splitMismatch: false
      }));
    }
  };

  const togglePayer = (participantIndex) => {
    // Single payer only — selecting a payer replaces the current one
    const newPayers = [participantIndex];
    actions.updateItem(index, { selectedPayers: newPayers });
    if (validationErrors.payers) {
      setValidationErrors(prev => ({ ...prev, payers: false }));
    }
  };

  const handleCancelPress = () => {
    if (onDelete) {
      onDelete();
    } else {
      onCancelEdit && onCancelEdit({ revertChanges: true });
    }
  };

  const validateItem = () => {
    const errors = {
      name: !item.name || item.name.trim() === "",
      amount: !item.amount || parseFloat(item.amount) <= 0 || isNaN(parseFloat(item.amount)),
      payers: !item.selectedPayers || item.selectedPayers.length === 0,
      consumers: !item.selectedConsumers || item.selectedConsumers.length === 0,
      splitMismatch: false,
    };

    setValidationErrors(errors);

    const hasErrors = Object.values(errors).some(error => error);

    if (hasErrors) {
      const missingFields = [];
      if (errors.name) missingFields.push(t('components.expenses.expenseItemCard.fields.name'));
      if (errors.amount) missingFields.push(t('components.expenses.expenseItemCard.fields.price'));
      if (errors.payers) missingFields.push(t('components.expenses.expenseItemCard.fields.payer'));
      if (errors.consumers) missingFields.push(t('components.expenses.expenseItemCard.fields.consumer'));

      Alert.alert(
        t('components.expenses.expenseItemCard.alerts.incomplete'),
        t('components.expenses.expenseItemCard.alerts.incompleteDesc', { fields: missingFields.join(", ") })
      );
      return false;
    }

    const allocatedTotal = derivedSplits.reduce((sum, splitAmount) => {
      return sum + (typeof splitAmount === "number" ? splitAmount : 0);
    }, 0);
    const totalAmount = parseFloat(item.amount) || 0;

    if (Math.abs(totalAmount - allocatedTotal) > SPLIT_TOLERANCE) {
      setValidationErrors(prev => ({ ...prev, splitMismatch: true }));
      Alert.alert(
        t('components.expenses.expenseItemCard.alerts.uneven'),
        t('components.expenses.expenseItemCard.alerts.unevenDesc')
      );
      return false;
    }

    setValidationErrors(prev => ({ ...prev, splitMismatch: false }));

    return true;
  };

  const handleDonePress = async () => {
    if (!validateItem()) {
      return;
    }

    setValidationErrors({
      name: false,
      amount: false,
      payers: false,
      consumers: false,
      splitMismatch: false,
    });

    // If no expenseId, just update local state and exit edit mode
    if (!expenseId) {
      onCancelEdit && onCancelEdit({ revertChanges: false });
      return;
    }

    // If editing existing expense, persist to Firestore
    setSaving(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert(t('common.error'), t('auth.errors.unauthenticated'));
        setSaving(false);
        return;
      }

      const expenseData = {
        title: state.title,
        items: state.items,
        fees: [],
        selectedPayers: state.selectedPayers,
        participants: state.participants,
        joinEnabled: state.joinEnabled,
        updatedAt: new Date().toISOString(),
      };

      await updateExpenseParticipants(
        expenseId,
        expenseData.participants,
        currentUser.uid
      );

      const { participants, ...otherFields } = expenseData;
      await updateExpense(expenseId, otherFields, currentUser.uid);

      onCancelEdit && onCancelEdit({ revertChanges: false });
    } catch (error) {
      Alert.alert(t('common.error'), t('components.expenses.expenseItemCard.alerts.saveError', { error: error.message }));
    } finally {
      setSaving(false);
    }
  };

  const totalAllocated = derivedSplits.reduce((sum, splitAmount) => {
    return sum + (typeof splitAmount === "number" ? splitAmount : 0);
  }, 0);
  const totalAmount = parseFloat(item.amount) || 0;
  const remainingAmount = totalAmount - totalAllocated;
  useEffect(() => {
    if (validationErrors.splitMismatch && Math.abs(remainingAmount) <= SPLIT_TOLERANCE) {
      setValidationErrors(prev => ({ ...prev, splitMismatch: false }));
    }
  }, [remainingAmount, validationErrors.splitMismatch]);

  let errorMessage = null;

  if (Math.abs(remainingAmount) > SPLIT_TOLERANCE) {
    if (remainingAmount < 0)
      errorMessage = t('components.expenses.expenseItemCard.totalExceeds', { amount: Math.abs(remainingAmount).toFixed(2) });
    else errorMessage = t('components.expenses.expenseItemCard.unallocated', { amount: remainingAmount.toFixed(2) });
  }

  return (
    <Card
      key={item.id}
      variant="flat"
      padding="large"
      margin="none"
      style={{ marginBottom: 16, backgroundColor: Colors.surfaceLight }}
    >
      <View style={styles.itemHeader}>
          <View style={styles.itemNameSection}>
            <TextInput
              style={[
                styles.itemNameInput,
                validationErrors.name && styles.inputError
              ]}
              placeholder={t('components.expenses.expenseItemCard.itemNamePlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              value={item.name}
              onChangeText={(text) => {
                actions.updateItem(index, { name: text });
                if (validationErrors.name) {
                  setValidationErrors(prev => ({ ...prev, name: false }));
                }
              }}
              keyboardType="default"
              autoCorrect={false}
            />
          </View>
        </View>

      <View style={styles.priceSection}>
        <PriceInput
          value={item.amount}
          onChangeText={(amount) => {
            setManualSplits({});
            actions.updateItem(index, { amount });
            if (validationErrors.amount) {
              setValidationErrors(prev => ({ ...prev, amount: false }));
            }
          }}
          placeholder="0.00"
          style={[
            styles.amountInput,
            validationErrors.amount && styles.inputError
          ]}
          showCurrency={true}
        />

        <View style={styles.whoPaidSection}>
          <Text style={[styles.whoPaidLabel, validationErrors.payers && styles.errorLabel]}>
            {t('components.expenses.expenseItemCard.payers')}{validationErrors.payers && " *"}
          </Text>
          <View style={[
            styles.payerChips,
            validationErrors.payers && styles.sectionError
          ]}>
            {participants.map((participant, pIndex) => (
              <TouchableOpacity
                key={pIndex}
                style={[
                  styles.payerChip,
                  item.selectedPayers.includes(pIndex) &&
                    styles.payerChipActive,
                ]}
                onPress={() => togglePayer(pIndex)}
                activeOpacity={0.7}
              >
                <View style={styles.payerChipContent}>
                  {item.selectedPayers.includes(pIndex) && (
                    <View style={styles.checkmarkContainer}>
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={Colors.accent}
                      />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.payerChipText,
                      item.selectedPayers.includes(pIndex) &&
                        styles.payerChipTextActive,
                    ]}
                  >
                    {participant.name || t('components.expenses.expenseItemCard.person', { index: pIndex + 1 })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.splitContainer}>
        <Text
          style={[
            styles.splitLabel,
            (validationErrors.consumers || validationErrors.splitMismatch) && styles.errorLabel
          ]}
        >
          {t('components.expenses.expenseItemCard.split')}{(validationErrors.consumers || validationErrors.splitMismatch) && " *"}
        </Text>
        <View style={[
          styles.splitCard,
          (validationErrors.consumers || validationErrors.splitMismatch) && styles.sectionError
        ]}>
          <View style={styles.header}>
            {errorMessage ? (
              <Text
                style={
                  remainingAmount < 0
                    ? styles.errorText
                    : styles.unallocatedText
                }
              >
                {errorMessage}
              </Text>
            ) : (
              <Text style={styles.unallocatedText}>
                {totalAmount > 0
                  ? t('components.expenses.expenseItemCard.allAllocated')
                  : t('components.expenses.expenseItemCard.enterPrice')}
              </Text>
            )}
          </View>
          {participants.map((participant, pIndex) => {
            const consumerPosition = item.selectedConsumers.indexOf(pIndex);
            const splitAmount = consumerPosition >= 0 ? derivedSplits[consumerPosition] : 0;
            const isSelected = item.selectedConsumers.includes(pIndex);
            const isAuto = isSelected && manualSplits[pIndex] === undefined;
            return (
              <View key={pIndex} style={styles.splitRow}>
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                  ]}
                  onPress={() => toggleConsumer(pIndex)}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </TouchableOpacity>
                <View style={styles.participantInfo}>
                  <Text
                    style={[
                      styles.participantName,
                      !isSelected && styles.participantNameDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {participant.name || t('components.expenses.expenseItemCard.person', { index: pIndex + 1 })}
                  </Text>
                </View>
                <View style={styles.inputContainer}>
                  <PriceInput
                    value={
                      activeInput && activeInput.index === pIndex
                        ? activeInput.value
                        : splitAmount
                    }
                    onChangeText={(text) => handleLiveTextChange(pIndex, text)}
                    onFocus={() => handleFocus(pIndex)}
                    onBlur={handleBlur}
                    placeholder="0.00"
                    style={[
                      styles.amountInput,
                      !isSelected && styles.disabledAmountInput,
                      isAuto &&
                        !(activeInput && activeInput.index === pIndex) &&
                        styles.autoAmountInput,
                    ]}
                    editable={isSelected}
                    showCurrency={true}
                    selected={isSelected}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {onCancelEdit && (
        <View style={styles.actionFooter}>
          {!saving && (
            <TouchableOpacity
              style={[
                styles.footerButton,
                styles.footerButtonCancel,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleCancelPress}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.footerButtonCancelText}>{t('components.expenses.expenseItemCard.cancel')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.footerButton, styles.footerButtonSave]}
            onPress={handleDonePress}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <LoadingSpinner size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={Colors.white}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.footerButtonSaveText}>{t('components.expenses.expenseItemCard.save')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Locked Overlay */}
      {isLocked && (
        <View style={styles.lockedOverlay}>
          <View style={styles.lockedContent}>
            <Ionicons name="lock-closed" size={20} color={Colors.warning} />
            <Text style={styles.lockedText}>{t('components.expenses.expenseItemCard.settled')}</Text>
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.lg,
  },
  itemNameSection: {
    flex: 1,
  },

  itemNameInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
  actionFooter: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  footerButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonCancel: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  footerButtonSave: {
    backgroundColor: Colors.accent,
  },
  footerButtonCancelText: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  footerButtonSaveText: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.white,
  },
  priceSection: { marginBottom: Spacing.md },

  amountInput: { minHeight: 48 },
  whoPaidSection: { marginTop: Spacing.md },
  whoPaidLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  payerChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  payerChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  payerChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  payerChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  payerChipText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: "500",
    fontSize: 12,
  },
  payerChipTextActive: { color: Colors.surface, fontWeight: "600" },
  checkmarkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  splitContainer: { marginTop: Spacing.md },
  splitLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  splitCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  splitRowLast: { borderBottomWidth: 0 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.divider,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  participantInfo: { flex: 1 },
  participantName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  participantNameDisabled: { color: Colors.textSecondary, opacity: 0.6 },
  inputContainer: { width: 100 },
  disabledAmountInput: {
    backgroundColor: "transparent",
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  header: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: "center",
  },
  unallocatedText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  errorText: { ...Typography.body2, color: Colors.danger, fontWeight: "600" },
  autoAmountInput: { fontStyle: "italic", color: Colors.textSecondary },
  buttonDisabled: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  errorLabel: {
    color: Colors.danger,
  },
  sectionError: {
    borderColor: Colors.danger,
    borderWidth: 2,
    borderRadius: Radius.sm,
    padding: Spacing.xs,
  },
  lockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface + "DD",
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  lockedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.warning + "15",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.warning + "40",
  },
  lockedText: {
    fontSize: 14,
    color: Colors.warning,
    fontFamily: Typography.familyMedium,
    fontWeight: "600",
  },
});

export default ExpenseItemCard;
