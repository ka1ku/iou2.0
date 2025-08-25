import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';
import FriendSelector from '../../components/FriendSelector';
import DeleteButton from '../../components/DeleteButton';

/**
 * ParticipantsSection Component
 * 
 * Displays the participants section with friend selector, placeholders, and participant count.
 * Used in the AddExpenseScreen for managing who is involved in the expense.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.selectedFriends - Array of selected friends
 * @param {Function} props.onFriendsChange - Callback when friends selection changes
 * @param {Array} props.placeholders - Array of placeholder participants
 * @param {Function} props.onAddPlaceholder - Callback when adding a placeholder
 * @param {Function} props.onInvitePlaceholder - Callback when inviting a placeholder
 * @param {Function} props.onRemovePlaceholder - Callback when removing a placeholder
 * @param {number} props.participantCount - Total number of participants
 * @returns {React.ReactElement} Participants section with friend selector and placeholders
 */
const ParticipantsSection = ({
  selectedFriends,
  onFriendsChange,
  placeholders,
  onAddPlaceholder,
  onInvitePlaceholder,
  onRemovePlaceholder,
  participantCount
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Participants</Text>
        <View style={styles.participantsCount}>
          <Text style={styles.participantsCountText}>
            {participantCount} {participantCount === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </View>
      
      <FriendSelector
        selectedFriends={selectedFriends}
        onFriendsChange={onFriendsChange}
        placeholder="Add friends to split with..."
        allowPlaceholders={true}
        onAddPlaceholder={onAddPlaceholder}
      />
      
      {/* Render placeholder chips with Invite buttons */}
      {placeholders.length > 0 && (
        <View style={styles.placeholdersContainer}>
          <Text style={styles.placeholdersLabel}>Pending Invites</Text>
          {placeholders.map((p) => (
            <View key={p.id} style={styles.placeholderCard}>
              <View style={styles.placeholderContent}>
                <View style={styles.placeholderAvatar}>
                  <Text style={styles.placeholderInitials}>
                    {p.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.placeholderInfo}>
                  <Text style={styles.placeholderName}>{p.name}</Text>
                  {p.phoneNumber && (
                    <Text style={styles.placeholderPhone}>{p.phoneNumber}</Text>
                  )}
                  <Text style={styles.placeholderTag}>Placeholder</Text>
                </View>
              </View>
              <View style={styles.placeholderActions}>
                <TouchableOpacity 
                  style={styles.inviteButton} 
                  onPress={() => onInvitePlaceholder(p)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="qr-code-outline" size={16} color={Colors.surface} />
                  <Text style={styles.inviteButtonText}>Invite</Text>
                </TouchableOpacity>
                <DeleteButton
                  onPress={() => onRemovePlaceholder(p.id)}
                  size="small"
                  variant="subtle"
                />
              </View>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.participantsNoteContainer}>
        <Text style={styles.participantsNote}>
          You'll automatically be included as a participant
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
  },
  participantsCount: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 2,
  },
  participantsCountText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
  },
  placeholdersContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  placeholdersLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
    elevation: 2,
    minHeight: 72,
  },
  placeholderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.divider,
    position: 'relative',
  },
  placeholderInitials: { 
    ...Typography.title, 
    color: Colors.textSecondary, 
    fontWeight: '600',
    fontSize: 18,
  },
  placeholderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  placeholderName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  placeholderPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  placeholderTag: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  placeholderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inviteButton: {
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
  inviteButtonText: { 
    ...Typography.label, 
    color: Colors.surface, 
    fontWeight: '600',
    fontSize: 14,
  },
  participantsNoteContainer: {
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  participantsNote: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default ParticipantsSection;
