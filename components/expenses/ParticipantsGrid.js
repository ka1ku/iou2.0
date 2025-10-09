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
        activeOpacity={0.8}
      >
        <View style={styles.avatarStackContainer}>
          {displayParticipants.slice(0, 4).map((participant, index) => (
            <View
              key={participant.id}
              style={[
                styles.avatarStackItem,
                { zIndex: displayParticipants.length - index }
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
            <View style={styles.overflowContainer}>
              <Text style={styles.overflowText}>+{displayParticipants.length - 4}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionContainer}>
          <Text style={styles.actionText}>Manage group</Text>
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
    marginBottom: Spacing.sm,
  },
  participantSnapshotContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  avatarStackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.lg,
  },
  avatarStackItem: {
    width: 40,
    height: 40,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarStackPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackInitials: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Typography.familySemiBold,
  },
  overflowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  overflowText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
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
    marginRight: Spacing.xs,
  },
});

export default ParticipantsGrid;