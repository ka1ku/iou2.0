import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
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
import Card from "../Card";
import DeleteButton from "../DeleteButton";
import PriceInput from "./PriceInput";

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

const ExpenseItemCard = ({ item, index, canDelete = true }) => {
  const { state, actions } = useExpense();
  const { participants } = state;

  const [manualSplits, setManualSplits] = useState({});

  // NEW: State to track the currently focused input for a smoother editing experience.
  const [activeInput, setActiveInput] = useState(null); // e.g., { index: 1, value: '12.' }

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
    actions.updateItem(index, { splits: derivedSplits.map((s) => s.amount) });
  }, [derivedSplits]);

  // Handler for updating the core logic based on input.
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

  // NEW: Handler for when a user taps into an input box.
  const handleFocus = (pIndex) => {
    const initialValue = derivedSplits[pIndex]?.amount;
    setActiveInput({
      index: pIndex,
      value: initialValue === 0 ? "0" : String(initialValue || ""),
    });
  };

  // NEW: Handler for when a user taps away from an input box.
  const handleBlur = () => {
    setActiveInput(null);
  };

  // NEW: A combined handler for live text changes.
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
  };

  const togglePayer = (participantIndex) => {
    const newPayers = item.selectedPayers.includes(participantIndex)
      ? item.selectedPayers.filter((i) => i !== participantIndex)
      : [...item.selectedPayers, participantIndex];
    actions.updateItem(index, { selectedPayers: newPayers });
  };

  const totalAllocated = derivedSplits.reduce(
    (sum, split) => sum + (split.amount || 0),
    0
  );
  const totalAmount = parseFloat(item.amount) || 0;
  const remainingAmount = totalAmount - totalAllocated;
  let errorMessage = null;
  if (Math.abs(remainingAmount) > 0.015) {
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
      {/* Item Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.itemNameLabel}>Item Name</Text>
          <TextInput
            style={styles.itemNameInput}
            placeholder="Enter item name"
            placeholderTextColor={Colors.textSecondary}
            value={item.name}
            onChangeText={(text) => actions.updateItem(index, { name: text })}
          />
        </View>
        {canDelete && (
          <DeleteButton
            onPress={() => actions.removeItem(index)}
            size="small"
            variant="subtle"
            style={{ marginLeft: 8 }}
          />
        )}
      </View>

      {/* Price Section */}
      <View style={styles.priceSection}>
        <Text style={styles.priceLabel}>Price</Text>
        <PriceInput
          value={item.amount}
          onChangeText={(amount) => {
            setManualSplits({});
            actions.updateItem(index, { amount });
          }}
          placeholder="0.00"
          style={styles.amountInput}
          showCurrency={true}
        />

        {/* Payers Section */}
        <View style={styles.whoPaidSection}>
          <Text style={styles.whoPaidLabel}>Payers</Text>
          <View style={styles.payerChips}>
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
                        color={Colors.surface}
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

      {/* Split Section */}
      <View style={styles.splitContainer}>
        <Text style={styles.splitLabel}>Split</Text>
        <View style={styles.splitCard}>
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
    </Card>
  );
};

const styles = StyleSheet.create({
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
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
    backgroundColor: "rgba(255,255,255,0.2)",
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
});

export default ExpenseItemCard;
