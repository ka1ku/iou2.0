import React, { useMemo } from "react";
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
import ProfilePicture from "../VenmoProfilePicture";
import Card from "../Card";

const ExpenseViewCard = ({ item, onEdit, onDelete }) => {
  const { state } = useExpense();
  const { participants } = state;

  // Calculate total amount for this item
  const totalAmount = parseFloat(item.amount) || 0;

  // Memoized calculation for who paid
  const paidByInfo = useMemo(() => {
    const payers = item.selectedPayers || [];
    if (payers.length === 0) return "Paid by Unassigned";

    const payerDetails = payers.map((index) => participants[index]).filter(Boolean);
    if (payerDetails.length === 0) return "Paid by Unassigned";

    if (payerDetails.length === 1) {
      return `Paid by ${payerDetails[0].name}`;
    }
    if (payerDetails.length === 2) {
      return `Paid by ${payerDetails[0].name} and ${payerDetails[1].name}`;
    }
    return `Paid by ${payerDetails[0].name} and ${payerDetails.length - 1} others`;
  }, [item.selectedPayers, participants]);

  // Memoized calculation for how the expense is split
  const splitInfo = useMemo(() => {
    const consumers = item.selectedConsumers || [];
    const splits = item.splits || [];
    if (consumers.length === 0) return [];

    return consumers.map((consumerIndex, i) => {
      const consumer = participants[consumerIndex];
      const splitAmount = parseFloat(splits[i]) || 0;
      return {
        name: consumer?.name || `Person ${consumerIndex + 1}`,
        profilePhoto: consumer?.profilePhoto,
        amount: splitAmount,
      };
    });
  }, [item.selectedConsumers, item.splits, participants]);

  const handleMenuPress = () => {
    Alert.alert(
      "Expense Actions",
      "What would you like to do?",
      [
        { text: "Edit", onPress: () => onEdit && onEdit() },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete && onDelete(),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  return (
    <Card 
      variant="flat" 
      padding="large" 
      margin="none"
      style={[styles.cardContainer, styles.noBorder]}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name || "Untitled Item"}
          </Text>
          <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
          <Text style={styles.paidByText} numberOfLines={1}>{paidByInfo}</Text>
        </View>
        <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Split Details */}
      <View style={styles.splitSection}>
        <Text style={styles.sectionTitle}>Split Details</Text>
        <View style={styles.splitList}>
          {splitInfo.map((split, index) => (
            <View key={index} style={styles.splitItem}>
              <View style={styles.participantInfo}>
                <ProfilePicture
                  source={split.profilePhoto}
                  size={28}
                  username={split.name}
                />
                <Text style={styles.participantName}>{split.name}</Text>
              </View>
              <Text style={styles.splitAmount}>${split.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: Spacing.lg,
  },
  noBorder: {
    borderWidth: 0,
    borderColor: 'transparent',
    ...Shadows.card,
  },

  // Header Section
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  titleSection: {
    flex: 1,
    marginRight: Spacing.md,
  },
  itemName: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    lineHeight: 24,
  },
  totalAmount: {
    ...Typography.h2,
    color: Colors.accent,
    marginBottom: Spacing.xs,
    lineHeight: 28,
  },
  paidByText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },

  // Menu Button
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.divider,
  },

  // Split Section
  splitSection: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  splitList: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: "hidden",
  },
  splitItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  participantName: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  splitAmount: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: "600",
    fontSize: 15,
  },
});

export default ExpenseViewCard;   