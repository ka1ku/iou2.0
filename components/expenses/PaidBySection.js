import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import { useExpense } from '../../contexts/ExpenseContext';

const PaidBySection = () => {
  const { state, actions } = useExpense();
  const { participants, selectedPayers, items } = state;

  const togglePayer = (participantIndex) => {
    const newPayers = selectedPayers.includes(participantIndex)
      ? selectedPayers.filter(i => i !== participantIndex)
      : [...selectedPayers, participantIndex];

    actions.setSelectedPayers(newPayers);
    
    // Update all items to have the same payers
    const updatedItems = items.map(item => ({
      ...item,
      selectedPayers: newPayers
    }));
    actions.setItems(updatedItems);
  };

  return (
    <View style={styles.paidByContainer}>
      <Text style={styles.sectionTitle}>Who Paid for This Receipt?</Text>
      
      <View style={styles.paidByGrid}>
        {participants && participants.length > 0 ? participants.map((participant, pIndex) => {
          const isSelected = selectedPayers.includes(pIndex);
          return (
            <TouchableOpacity
              key={pIndex}
              style={[
                styles.paidByItem,
                isSelected && styles.paidByItemSelected
              ]}
              onPress={() => {
                togglePayer(pIndex);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.paidByItemContent}>
                <View style={styles.paidByAvatar}>
                  {participant?.profilePhoto ? (
                    <Image
                      source={{ uri: participant.profilePhoto }}
                      style={styles.paidByAvatarImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={[
                      styles.paidByAvatarPlaceholder,
                      participant?.name === 'Me' && styles.currentUserAvatar
                    ]}>
                      <Text style={[
                        styles.paidByAvatarText,
                        participant?.name === 'Me' && styles.currentUserInitials
                      ]}>
                        {(participant?.name?.[0] || 'U').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {isSelected && (
                    <View style={styles.paidByCheckmark}>
                      <Ionicons name="checkmark" size={10} color={Colors.surface} />
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.paidByName,
                  isSelected && styles.paidByNameSelected
                ]} numberOfLines={1}>
                  {participant.name === 'Me' ? 'You' : participant.name || `Person ${pIndex + 1}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }) : (
          <Text style={styles.noParticipantsText}>No participants available</Text>
        )}
      </View>
      
      {selectedPayers.length > 0 && (
        <View style={styles.payerSummary}>
          <View style={styles.payerSummaryContent}>
            <Ionicons name="card-outline" size={14} color={Colors.accent} />
            <Text style={styles.payerSummaryText}>
              {selectedPayers.length} {selectedPayers.length === 1 ? 'person' : 'people'} will pay
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  paidByContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  paidByGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  paidByItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    minWidth: 100,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
    elevation: 2,
  },
  paidByItemSelected: {
    backgroundColor: Colors.accent + '10',
    borderColor: Colors.accent,
    borderWidth: 2,
    ...Shadows.card,
    elevation: 4,
  },
  paidByItemContent: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  paidByAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidByAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  paidByAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.divider,
  },
  paidByAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  paidByCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.card,
    elevation: 3,
  },
  paidByName: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 80,
  },
  paidByNameSelected: {
    color: Colors.accent,
    fontWeight: '700',
  },
  payerSummary: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  payerSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  payerSummaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  noParticipantsText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  currentUserAvatar: {
    borderColor: Colors.accent,
    borderWidth: 3,
    backgroundColor: Colors.accent,
  },
  currentUserInitials: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 24,
  },
});

export default PaidBySection;
