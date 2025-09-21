import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import Card from "../Card";
import ProfilePicture from "../VenmoProfilePicture";

const ExpenseViewCard = ({ item, index, onEdit, onDelete }) => {
  const { state } = useExpense();
  const { participants } = state;

  // Calculate total amount for this item
  const totalAmount = parseFloat(item.amount) || 0;

  // Calculate who paid and how much
  const paidByInfo = useMemo(() => {
    const payers = item.selectedPayers || [];
    if (payers.length === 0) return { text: "No payers selected", amount: 0 };

    if (payers.length === 1) {
      const payer = participants[payers[0]];
      const amount = totalAmount / payers.length;
      return {
        text: `${payer?.name || `Person ${payers[0] + 1}`} paid`,
        amount: amount
      };
    } else {
      const splitAmount = totalAmount / payers.length;
      return {
        text: `${payers.length} people split`,
        amount: splitAmount
      };
    }
  }, [item.selectedPayers, participants, totalAmount]);

  // Calculate split amounts for display
  const splitInfo = useMemo(() => {
    const consumers = item.selectedConsumers || [];
    const splits = item.splits || [];

    if (consumers.length === 0) {
      return { text: "No one selected", splits: [] };
    }

    const splitDetails = consumers.map((consumerIndex, i) => {
      const consumer = participants[consumerIndex];
      const splitAmount = parseFloat(splits[i]) || 0;
      return {
        name: consumer?.name || `Person ${consumerIndex + 1}`,
        amount: splitAmount
      };
    });

    return { text: "Split among participants", splits: splitDetails };
  }, [item.selectedConsumers, item.splits, participants]);

  const handleMenuPress = () => {
    Alert.alert(
      "Item Actions",
      "Choose an action",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Edit", onPress: () => onEdit && onEdit() },
        { text: "Delete", style: "destructive", onPress: () => onDelete && onDelete() },
      ]
    );
  };

  return (
    <Card
      variant="default"
      padding="large"
      margin="none"
      style={styles.card}
    >
      {/* Header with item name and menu button */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.itemName}>{item.name || "Untitled Item"}</Text>
          <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleMenuPress}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Payment info */}
      <View style={styles.paymentInfo}>
        <View style={styles.paymentRow}>
          <Ionicons name="card-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.paymentText}>{paidByInfo.text}</Text>
          {paidByInfo.amount > 0 && (
            <Text style={styles.paymentAmount}>${paidByInfo.amount.toFixed(2)} each</Text>
          )}
        </View>
      </View>

      {/* Split information */}
      <View style={styles.splitInfo}>
        <View style={styles.splitHeader}>
          <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.splitHeaderText}>Split between {splitInfo.splits.length} people</Text>
        </View>
        
        <View style={styles.splitList}>
          {splitInfo.splits.map((split, index) => {
            const participant = participants.find(p => p.name === split.name);
            return (
              <View key={index} style={styles.splitItem}>
                <View style={styles.splitItemLeft}>
                  <ProfilePicture
                    source={participant?.profilePhoto}
                    size={28}
                    username={split.name}
                    style={styles.participantAvatar}
                  />
                  <Text style={styles.splitName}>{split.name}</Text>
                </View>
                <Text style={styles.splitAmount}>${split.amount.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  titleContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemName: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  totalAmount: {
    ...Typography.h2,
    color: Colors.accent,
    fontWeight: "700",
  },
  menuButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  paymentInfo: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  paymentText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "500",
    flex: 1,
  },
  paymentAmount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  splitInfo: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  splitHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  splitList: {
    gap: Spacing.xs,
  },
  splitItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  splitItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  participantAvatar: {
    // ProfilePicture component handles its own styling
  },
  splitName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  splitAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "600",
  },
});

export default ExpenseViewCard;