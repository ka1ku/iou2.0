import React, { useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';
import { getCurrentUser } from '../../services/authService';
import { useExpense } from '../../contexts/ExpenseContext';
import GroupMembersModal from './GroupMembersModal';


const ParticipantsGrid = forwardRef(({ 
  expenseId = null,
  currentUserId = null
}, ref) => {
  const { state } = useExpense();
  const { participants } = state;
  const [showModal, setShowModal] = useState(false);

  const displayParticipants = useMemo(() => {
    const currentUser = getCurrentUser();
    return participants.filter(p => p.userId !== currentUser?.uid);
  }, [participants]);

  useImperativeHandle(ref, () => ({
    openModal: () => setShowModal(true),
    closeModal: () => setShowModal(false)
  }));
  

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.participantSnapshotContainer}
        onPress={() => setShowModal(true)}
        activeOpacity={0.6}
      >
        <View style={styles.avatarStackContainer}>
          {displayParticipants.slice(0, 4).map((participant, index) => (
            <View
              key={participant.id}
              style={[
                styles.avatarStackItem,
                { zIndex: displayParticipants.length - index, marginLeft: index === 0 ? 0 : -10 }
              ]}
            >
              {participant.profilePhoto ? (
                <Image source={{ uri: participant.profilePhoto }} style={styles.avatarStackImage} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.avatarStackPlaceholder}>
                  <Text style={styles.avatarStackInitials}>
                    {(participant.name?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          ))}

          {displayParticipants.length > 4 && (
            <View style={[styles.overflowContainer, { zIndex: 0, marginLeft: -10 }]}>
              <Text style={styles.overflowText}>+{displayParticipants.length - 4}</Text>
            </View>
          )}

          {displayParticipants.length === 0 && (
             <Text style={styles.emptyText}>Add friends</Text>
          )}
        </View>

        <View style={styles.actionContainer}>
          <Text style={styles.actionText}>Manage</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </View>
      </TouchableOpacity>

      <GroupMembersModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        expenseId={expenseId}
      />
    </View>
  );
});

ParticipantsGrid.displayName = 'ParticipantsGrid';

const styles = StyleSheet.create({
  container: {
    // No margin, handled by parent
  },
  participantSnapshotContainer: {
    // Transparent background to fit in parent card
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm, 
  },
  avatarStackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingLeft: 4, // For the first negative margin adjustment if needed, or just 0
  },
  avatarStackItem: {
    width: 32, // Slightly smaller to fit nicely
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.surface, // Matches the card background
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  avatarStackImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarStackPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackInitials: {
    color: Colors.white,
    fontSize: 10,
    fontFamily: Typography.familySemiBold,
  },
  overflowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  actionText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: 4,
  },
});

export default ParticipantsGrid;