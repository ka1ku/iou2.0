import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import FriendSelector from './FriendSelector';

const ParticipantsGrid = ({ 
  participants = [], 
  selectedFriends = [], 
  onFriendsChange, 
  onParticipantPress, 
  onManagePress,
  participantsExpanded = false,
  onToggleExpanded,
  expenseId = null,
  currentUserId = null
}) => {
  const friendSelectorRef = useRef(null);

  const handleManagePress = () => {
    if (onManagePress) {
      onManagePress();
    } else if (friendSelectorRef.current) {
      friendSelectorRef.current.openModal();
    }
  };

  const renderParticipantItem = ({ item, index }) => {
    if (item.type === 'add-button') {
      return (
        <TouchableOpacity 
          style={styles.addParticipantGridButton}
          onPress={() => friendSelectorRef.current?.openModal()}
          activeOpacity={0.7}
        >
          <View style={styles.addParticipantGridIcon}>
            <Ionicons name="add" size={24} color={Colors.accent} />
          </View>
          <Text style={styles.addParticipantGridText}>Add</Text>
        </TouchableOpacity>
      );
    }

    const participant = item;
    return (
      <TouchableOpacity 
        key={participant.id}
        style={styles.participantGridItem}
        onPress={() => {
          if (onParticipantPress) {
            onParticipantPress(participant, index);
          } else if (participant.userId && participant.userId !== currentUserId) {
            // Default navigation behavior - can be overridden
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.participantGridAvatarContainer}>
          {participant.profilePhoto ? (
            <Image source={{ uri: participant.profilePhoto }} style={styles.participantGridAvatar} />
          ) : (
            <View style={[
              styles.participantGridAvatarPlaceholder,
              participant.name === 'Me' && styles.currentUserAvatar
            ]}>
              <Text style={[
                styles.participantGridAvatarInitials,
                participant.name === 'Me' && styles.currentUserInitials
              ]}>
                {participant.name === 'Me' ? 'M' : (participant.name?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.participantGridName} numberOfLines={1}>
          {participant.name}
        </Text>
        {participant.username && (
          <Text style={styles.participantGridUsername} numberOfLines={1}>
            @{participant.username}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[
          { id: 'add-button', type: 'add-button' },
          ...(participantsExpanded ? participants : participants.slice(0, 5))
        ]}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipantItem}
        contentContainerStyle={styles.participantsGridContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
      
      {/* Show More/Less toggle button */}
      {participants.length > 5 && (
        <TouchableOpacity 
          style={styles.toggleParticipantsButton}
          onPress={onToggleExpanded}
          activeOpacity={0.7}
        >
          <View style={styles.toggleParticipantsIcon}>
            <Ionicons 
              name={participantsExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={Colors.surface} 
            />
          </View>
          <Text style={styles.toggleParticipantsText}>
            {participantsExpanded ? "Show Less" : `Show ${participants.length - 5} More`}
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Group Management Row */}
      <View style={styles.groupManagementRow}>
        <View style={styles.groupInfo}>
          <Text style={styles.groupInfoText}>
            {participants.length} {participants.length === 1 ? 'person' : 'people'} in this expense
          </Text>
          {participants.length > 5 && (
            <Text style={styles.pendingInvitesText}>
              Tap "More" to see all participants
            </Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.manageGroupButton}
          onPress={handleManagePress}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={16} color={Colors.surface} />
          <Text style={styles.manageGroupButtonText}>Manage</Text>
        </TouchableOpacity>
      </View>
      
      <FriendSelector
        ref={friendSelectorRef}
        selectedFriends={selectedFriends}
        onFriendsChange={onFriendsChange}
        placeholder="Add friends to split with..."
        expenseId={expenseId}
        showAddButton={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  participantsGridContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  participantGridItem: {
    alignItems: 'center',
    width: '33.33%', // Exactly one-third width for 3 columns
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 100,
  },
  participantGridAvatarContainer: {
    position: 'relative',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  participantGridAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  participantGridAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  participantGridAvatarInitials: {
    color: Colors.white,
    fontSize: 24,
    fontFamily: Typography.familySemiBold,
  },
  participantGridName: {
    ...Typography.body,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
  },
  participantGridUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 9,
  },
  addParticipantGridButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '33.33%', // Exactly one-third width for 3 columns
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 100,
  },
  addParticipantGridIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  addParticipantGridText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 11,
  },
  groupManagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  groupInfo: {
    flex: 1,
  },
  groupInfoText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  pendingInvitesText: {
    ...Typography.caption,
    color: Colors.accent,
    fontSize: 11,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  manageGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 2,
  },
  manageGroupButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
  toggleParticipantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 2,
  },
  toggleParticipantsIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  toggleParticipantsText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 12,
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

export default ParticipantsGrid;