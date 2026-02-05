import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
      <Text style={styles.label}>Paid by</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
                    {participant.name === 'Me' ? 'You' : participant.name.split(' ')[0]}
                    </Text>
                </View>
                </TouchableOpacity>
            );
            }) : (
            <Text style={styles.noParticipantsText}>No participants</Text>
            )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  paidByContainer: {
    // Clean container
  },
  label: {
      ...Typography.caption,
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      fontWeight: '600',
  },
  scrollContent: {
      paddingVertical: 2, // avoid shadow clipping
  },
  paidByGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  paidByItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.sm,
    width: 70, // Compact width
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidByItemSelected: {
    backgroundColor: Colors.brandLight,
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  paidByItemContent: {
    alignItems: 'center',
    gap: 6,
  },
  paidByAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidByAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  paidByAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  paidByAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  paidByCheckmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  paidByName: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  paidByNameSelected: {
    color: Colors.accent,
    fontWeight: '700',
  },
  noParticipantsText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  currentUserAvatar: {
    borderColor: Colors.accent,
    borderWidth: 2,
    backgroundColor: Colors.accent,
  },
  currentUserInitials: {
    color: Colors.white,
  },
});

export default PaidBySection;
