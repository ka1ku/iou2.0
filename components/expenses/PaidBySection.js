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
import { useTranslation } from '../../contexts/LanguageContext';

const PaidBySection = ({ disabled = false, onTogglePayer }) => {
  const { t } = useTranslation();
  const { state, actions } = useExpense();
  const { participants, selectedPayers } = state;

  const togglePayer = async (participantIndex) => {
    if (disabled) return;

    // Just call the callback - parent handles all logic
    if (onTogglePayer) {
      await onTogglePayer(participantIndex);
    }
  };

  return (
    <View style={[styles.paidByContainer, disabled && styles.disabledContainer]}>
      {/* Label removed to avoid duplication with screen header */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        <View style={styles.paidByGrid}>
          {participants && participants.length > 0 ? (
            [...participants.map((p, i) => ({ participant: p, originalIndex: i }))]
              .sort((a, b) => (a.participant?.id === 'me-participant' ? -1 : b.participant?.id === 'me-participant' ? 1 : 0))
              .map(({ participant, originalIndex: pIndex }) => {
                const isSelected = selectedPayers.includes(pIndex);
                const isMe = participant?.id === 'me-participant';
                return (
                  <TouchableOpacity
                    key={pIndex}
                    style={[
                      styles.paidByItem,
                      isSelected && styles.paidByItemSelected
                    ]}
                    onPress={async () => {
                      await togglePayer(pIndex);
                    }}
                    activeOpacity={0.7}
                    disabled={disabled}
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
                            isMe && styles.currentUserAvatar
                          ]}>
                            <Text style={[
                              styles.paidByAvatarText,
                              isMe && styles.currentUserInitials
                            ]}>
                              {(participant?.name?.[0] || 'U').toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {isSelected && (
                          <View style={styles.paidByCheckmark}>
                            <Ionicons name="checkmark" size={12} color={Colors.surface} />
                          </View>
                        )}
                      </View>
                      <View style={styles.nameContainer}>
                        <Text style={[
                          styles.paidByName,
                          isSelected && styles.paidByNameSelected
                        ]} numberOfLines={1}>
                          {participant.name.split(' ')[0]}
                        </Text>
                        {isMe && <Text style={[styles.youText, isSelected && styles.youTextSelected]}>(you)</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })) : (
            <Text style={styles.noParticipantsText}>{t('components.expenses.paidBy.noParticipants')}</Text>
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
  disabledContainer: {
    opacity: 0.5,
  },
  scrollView: {
    marginHorizontal: -Spacing.md, // Extend beyond parent padding
  },
  scrollContent: {
    paddingVertical: 4, // ample space for shadows/selection
    paddingHorizontal: Spacing.md, // Re-add the padding as content padding
  },
  paidByGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  paidByItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, // Larger radius
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.sm,
    width: 80, // Increased width for better touch target
    height: 100, // Increased height
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidByItemSelected: {
    backgroundColor: Colors.brandLight,
    borderColor: Colors.brand, // Using brand color for active state
    borderWidth: 1.5,
  },
  paidByItemContent: {
    alignItems: 'center',
    gap: 8, // More spacing between avatar and name
  },
  paidByAvatar: {
    width: 48, // Larger avatar
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
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  paidByAvatarText: {
    fontSize: 16, // Larger text
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  paidByCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20, // Larger checkmark badge
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.brand, // Using brand color
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  paidByName: {
    ...Typography.caption,
    fontSize: 11, // Slightly larger
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  paidByNameSelected: {
    color: Colors.brand,
    fontWeight: '700',
  },
  noParticipantsText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  currentUserAvatar: {
    borderColor: Colors.brand,
    borderWidth: 2,
    backgroundColor: Colors.brandLight,
  },
  currentUserInitials: {
    color: Colors.brand, // Brand color for text
  },
  nameContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    width: '100%',
  },
  youText: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '600',
  },
  youTextSelected: {
    color: Colors.brand,
  },
});

export default PaidBySection;
