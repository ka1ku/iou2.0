import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
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

const ExpenseItemCard = ({ item, index, onCancelEdit, onDelete, expenseId, isEditing = false }) => {
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

    const manualTotal = consumers.reduce((sum, pIndex) => {
      return sum + (manualSplits[pIndex] || 0);
    }, 0);

    const remainingBalance = total - manualTotal;
    const autoParticipants = consumers.filter(
      (pIndex) => manualSplits[pIndex] === undefined
    );
    const autoSplitAmounts = smartRoundSplit(
      remainingBalance,
      autoParticipants.length
    );

    return participants.map((_, pIndex) => {
      if (!consumers.includes(pIndex)) return { amount: 0 };
      if (manualSplits[pIndex] !== undefined)
        return { amount: manualSplits[pIndex] };
      const autoIndex = autoParticipants.indexOf(pIndex);
      return { amount: autoSplitAmounts[autoIndex] || 0 };
    });
  }, [item.amount, item.selectedConsumers, manualSplits, participants]);

  useEffect(() => {
    const splitsForSelectedConsumers = (item.selectedConsumers || []).map(
      (consumerIndex) => {
        const split = derivedSplits[consumerIndex];
        return split && typeof split.amount === "number" ? split.amount : 0;
      }
    );
    actions.updateItem(index, { splits: splitsForSelectedConsumers });
  }, [derivedSplits, item.selectedConsumers]);

  const handleAmountChange = (pIndex, value) => {
    if (value === "" || value === null || value === undefined) {
      setManualSplits((prev) => {
        const newSplits = { ...prev };
        delete newSplits[pIndex];
        return newSplits;
      });
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setManualSplits((prev) => {
        const newSplits = { ...prev };
        delete newSplits[pIndex];
        return newSplits;
      });
      return;
    }
    setManualSplits((prev) => ({ ...prev, [pIndex]: numValue }));
  };

  const handleFocus = (pIndex) => {
    const initialValue = derivedSplits[pIndex]?.amount;
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
    setManualSplits((prev) => {
      const newSplits = { ...prev };
      delete newSplits[pIndex];
      return newSplits;
    });
    const newConsumers = item.selectedConsumers.includes(pIndex)
      ? item.selectedConsumers.filter((i) => i !== pIndex)
      : [...item.selectedConsumers, pIndex];
    if (newConsumers.length > 0)
      actions.updateItem(index, { selectedConsumers: newConsumers });
    if ((validationErrors.consumers || validationErrors.splitMismatch) && newConsumers.length > 0) {
      setValidationErrors(prev => ({ ...prev, consumers: false, splitMismatch: false }));
    }
  };

  const togglePayer = (participantIndex) => {
    const newPayers = item.selectedPayers.includes(participantIndex)
      ? item.selectedPayers.filter((i) => i !== participantIndex)
      : [...item.selectedPayers, participantIndex];
    actions.updateItem(index, { selectedPayers: newPayers });
    if (validationErrors.payers && newPayers.length > 0) {
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
      if (errors.name) missingFields.push("item name");
      if (errors.amount) missingFields.push("price");
      if (errors.payers) missingFields.push("at least one payer");
      if (errors.consumers) missingFields.push("at least one person in the split");
      
      Alert.alert(
        "Missing Information",
        `Please provide: ${missingFields.join(", ")}`
      );
      return false;
    }

    const allocatedTotal = (item.selectedConsumers || []).reduce((sum, consumerIndex) => {
      const split = derivedSplits[consumerIndex];
      return sum + (split && typeof split.amount === "number" ? split.amount : 0);
    }, 0);
    const totalAmount = parseFloat(item.amount) || 0;

    if (Math.abs(totalAmount - allocatedTotal) > SPLIT_TOLERANCE) {
      setValidationErrors(prev => ({ ...prev, splitMismatch: true }));
      Alert.alert(
        "Split Mismatch",
        "Split amounts must add up to the item total before you can save this item."
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

    if (!isEditing) {
      onCancelEdit && onCancelEdit({ revertChanges: false });
      return;
    }

    if (!expenseId) {
      onCancelEdit && onCancelEdit({ revertChanges: false });
      return;
    }

    setSaving(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const expenseData = {
        title: state.title,
        items: state.items,
        fees: state.fees,
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
      Alert.alert("Error", "Failed to save expense: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const totalAllocated = (item.selectedConsumers || []).reduce((sum, consumerIndex) => {
    const split = derivedSplits[consumerIndex];
    return sum + (split && typeof split.amount === "number" ? split.amount : 0);
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
      errorMessage = `Total exceeds bill by $${Math.abs(
        remainingAmount
      ).toFixed(2)}`;
    else errorMessage = `Unallocated: $${remainingAmount.toFixed(2)}`;
  }

  return (
    <Card
      key={item.id}
      variant="default"
      padding="large"
      margin="none"
      style={{ marginBottom: 16, backgroundColor: Colors.surfaceLight }}
    >
      <View style={styles.itemHeader}>
          <View style={styles.itemNameSection}>
            <Text style={[styles.itemNameLabel, validationErrors.name && styles.errorLabel]}>
              Item Name{validationErrors.name && " *"}
            </Text>
            <TextInput
              style={[
                styles.itemNameInput,
                validationErrors.name && styles.inputError
              ]}
              placeholder="Enter item name"
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
        <Text style={[styles.priceLabel, validationErrors.amount && styles.errorLabel]}>
          Price{validationErrors.amount && " *"}
        </Text>
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
            Payers{validationErrors.payers && " *"}
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
                    {participant.name || `Person ${pIndex + 1}`}
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
          Split{(validationErrors.consumers || validationErrors.splitMismatch) && " *"}
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
                  ? "All funds allocated"
                  : "Enter a price to split"}
              </Text>
            )}
          </View>
          {participants.map((participant, pIndex) => {
            const split = derivedSplits[pIndex] || { amount: 0 };
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
                    {participant.name || `Person ${pIndex + 1}`}
                  </Text>
                </View>
                <View style={styles.inputContainer}>
                  <PriceInput
                    value={
                      activeInput && activeInput.index === pIndex
                        ? activeInput.value
                        : split.amount
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
          <TouchableOpacity
            style={[styles.footerButton, styles.footerButtonCancel, saving && styles.buttonDisabled]}
            onPress={handleCancelPress}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.footerButtonCancelText}>Cancel</Text>
          </TouchableOpacity>
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
                <Text style={styles.footerButtonSaveText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
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
  itemNameLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  priceLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
});

export default ExpenseItemCard;
