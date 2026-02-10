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
import { useTranslation } from "../../contexts/LanguageContext";
import ProfilePicture from "../VenmoProfilePicture";
import Card from "../Card";

// Helper function for relative time display
const getRelativeTime = (timestamp) => {
  if (!timestamp) return null;
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
};

const ExpenseViewCard = ({ item, onEdit, onDelete, isLocked = false }) => {
  const { t } = useTranslation();
  const { state } = useExpense();
  const { participants } = state;
  const [isExpanded, setIsExpanded] = useState(false);

  const totalAmount = parseFloat(item.amount) || 0;

  const paidByInfo = useMemo(() => {
    const payers = item.selectedPayers || [];
    if (payers.length === 0) return t('components.expenses.expenseViewCard.paidByUnassigned');

    const payerDetails = payers.map((index) => participants[index]).filter(Boolean);
    if (payerDetails.length === 0) return t('components.expenses.expenseViewCard.paidByUnassigned');

    if (payerDetails.length === 1) {
      return t('components.expenses.expenseViewCard.paidByOne', { name: payerDetails[0].name });
    }
    if (payerDetails.length === 2) {
      return t('components.expenses.expenseViewCard.paidByTwo', { name1: payerDetails[0].name, name2: payerDetails[1].name });
    }
    return t('components.expenses.expenseViewCard.paidByMany', { name: payerDetails[0].name, count: payerDetails.length - 1 });
  }, [item.selectedPayers, participants, t]);

  const splitInfo = useMemo(() => {
    const consumers = item.selectedConsumers || [];
    const splits = item.splits || [];
    if (consumers.length === 0) return [];

    return consumers
      .map((consumerIndex, i) => {
        const consumer = participants[consumerIndex];
        // Skip current user
        if (consumer?.name === 'Me') return null;

        // Validate split amount exists and is a number
        const splitValue = splits[i];
        const splitAmount = (splitValue !== undefined && !isNaN(parseFloat(splitValue)))
          ? parseFloat(splitValue)
          : 0;

        return {
          name: consumer?.name || `Person ${consumerIndex + 1}`,
          profilePhoto: consumer?.profilePhoto,
          amount: splitAmount,
        };
      })
      .filter(Boolean); // Remove null entries
  }, [item.selectedConsumers, item.splits, participants]);

  const handleMenuPress = () => {
    if (isLocked) {
      Alert.alert(
        t('components.expenses.expenseViewCard.locked.title'),
        t('components.expenses.expenseViewCard.locked.message')
      );
      return;
    }
    Alert.alert(
      t('components.expenses.expenseViewCard.actions.title'),
      t('components.expenses.expenseViewCard.actions.message'),
      [
        { text: t('components.expenses.expenseViewCard.actions.edit'), onPress: () => onEdit && onEdit() },
        {
          text: t('components.expenses.expenseViewCard.actions.delete'),
          style: "destructive",
          onPress: () => onDelete && onDelete(),
        },
        { text: t('components.expenses.expenseViewCard.actions.cancel'), style: "cancel" },
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
          <View style={styles.itemNameRow}>
            <Text style={[styles.itemName, isLocked && styles.itemNameLocked]} numberOfLines={2}>
              {item.name || t('components.expenses.expenseViewCard.untitledItem')}
            </Text>
            {isLocked && (
              <View style={styles.settledBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.settledBadgeText}>{t('components.expenses.expenseViewCard.settled')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.totalAmount, isLocked && styles.totalAmountLocked]}>${totalAmount.toFixed(2)}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.paidByText} numberOfLines={1}>{paidByInfo}</Text>
            {item.createdAt && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.timestampText}>{getRelativeTime(item.createdAt)}</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
          <Ionicons
            name={isLocked ? "lock-closed" : "ellipsis-horizontal"}
            size={20}
            color={isLocked ? Colors.textSecondary : Colors.textSecondary}
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
            <Text style={styles.sectionTitle}>{t('components.expenses.expenseViewCard.splitWith')}</Text>
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
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  itemName: {
    ...Typography.h3,
    color: Colors.textPrimary,
    lineHeight: 24,
    flex: 1,
  },
  itemNameLocked: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  totalAmount: {
    ...Typography.h2,
    color: Colors.accent,
    marginBottom: Spacing.xs,
    lineHeight: 28,
  },
  totalAmountLocked: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    gap: 3,
  },
  settledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  paidByText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  metaDot: {
    fontSize: 13,
    color: Colors.textSecondary,
    opacity: 0.5,
  },
  timestampText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 12,
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