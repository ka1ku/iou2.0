import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Colors,
  Spacing,
  Radius,
  Shadows,
  Typography,
} from "../../design/tokens"; // Assuming your design tokens are here
import { useExpense } from "../../contexts/ExpenseContext";
import ProfilePicture from "../VenmoProfilePicture"; // Assuming this is your custom component

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
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={[Colors.surfaceLight, Colors.surface]}
        style={styles.card}
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* Split Details */}
        <View style={styles.splitSection}>
          <Text style={styles.sectionTitle}>Split Details</Text>
          {splitInfo.map((split, index) => (
            <View key={index} style={styles.splitItem}>
              <View style={styles.participantInfo}>
                <ProfilePicture
                  source={split.profilePhoto}
                  size={32}
                  username={split.name}
                />
                <Text style={styles.participantName}>{split.name}</Text>
              </View>
              <Text style={styles.splitAmount}>${split.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    ...Shadows.card,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    overflow: "hidden",
  },

  // Header Section
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  titleSection: {
    flex: 1,
    marginRight: Spacing.md,
  },
  itemName: {
    ...Typography.h3,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  totalAmount: {
    ...Typography.h2,
    color: Colors.accent,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  paidByText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: "500",
  },

  // Menu Button
  menuButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.md,
  },

  // Split Section
  splitSection: {
    // No background needed, it's on the card directly
  },
  sectionTitle: {
    ...Typography.title,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  splitItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider + '40',
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  participantName: {
    ...Typography.body1,
    fontWeight: "500",
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
  },
  splitAmount: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: "600",
  },
});

export default ExpenseViewCard;   