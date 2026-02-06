import React, { useMemo, useState } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);

  const totalAmount = parseFloat(item.amount) || 0;

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

  const splitInfo = useMemo(() => {
    const consumers = item.selectedConsumers || [];
    const splits = item.splits || [];
    if (consumers.length === 0) return [];

    return consumers
      .map((consumerIndex, i) => {
        const consumer = participants[consumerIndex];
        // Skip current user
        if (consumer?.name === 'Me') return null;
        
        const splitAmount = parseFloat(splits[i]) || 0;
        return {
          name: consumer?.name || `Person ${consumerIndex + 1}`,
          profilePhoto: consumer?.profilePhoto,
          amount: splitAmount,
        };
      })
      .filter(Boolean); // Remove null entries
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

      <View style={styles.splitSection}>
        <View style={styles.sectionDivider} />
        
        <TouchableOpacity 
          style={styles.splitHeader}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.sectionTitle}>Split with</Text>
            {!isExpanded && (
              <View style={styles.previewContainer}>
                {splitInfo.slice(0, 3).map((split, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.previewAvatarContainer, 
                      { zIndex: index, marginLeft: index > 0 ? -8 : 0 }
                    ]}
                  >
                    <ProfilePicture
                      source={split.profilePhoto}
                      size={24}
                      username={split.name}
                    />
                  </View>
                ))}
                {splitInfo.length > 3 && (
                   <View style={[styles.previewAvatarContainer, styles.moreAvatar, { zIndex: 10, marginLeft: -8 }]}>
                      <Text style={styles.moreAvatarText}>+{splitInfo.length - 3}</Text>
                   </View>
                )}
              </View>
            )}
          </View>
          
          <Ionicons 
            name={isExpanded ? "chevron-down" : "chevron-forward"} 
            size={16} 
            color={Colors.textSecondary} 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.splitList}>
            {splitInfo.map((split, index) => (
              <View 
                key={index} 
                style={styles.splitItem}
              >
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
        )}
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
  },

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

  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4, 
    marginRight: -4,
  },

  splitSection: {
    marginTop: Spacing.md,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.md,
  },
  splitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  sectionTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewAvatarContainer: {
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  moreAvatar: {
    width: 24,
    height: 24,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  moreAvatarText: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  splitList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  splitItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  splitItemBorder: {
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
    marginLeft: Spacing.md,
    fontWeight: "500",
    fontSize: 15,
  },
  splitAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: "600",
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
});

export default ExpenseViewCard;   