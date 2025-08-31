import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Switch,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { updateExpense, getExpenseJoinInfo, generateExpenseJoinLink, updateExpenseParticipants } from '../services/expenseService';

const ExpenseSettingsScreen = ({ route, navigation }) => {
  const { expense } = route.params;
  const insets = useSafeAreaInsets();
  const currentUser = getCurrentUser();

  const [joinEnabled, setJoinEnabled] = useState(expense?.join?.enabled ?? true);
  const [loading, setLoading] = useState(false);
  const [joinInfo, setJoinInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
  }, [navigation]);

  useEffect(() => {
    if (expense?.id) {
      loadJoinInfo();
    }
  }, [expense?.id]);

  const loadJoinInfo = async () => {
    try {
      const info = await getExpenseJoinInfo(expense.id);
      setJoinInfo(info);
    } catch (error) {
      console.error('Error loading join info:', error);
    }
  };

  const handleToggleJoin = async (value) => {
    try {
      setLoading(true);
      await updateExpense(expense.id, {
        'join.enabled': value
      }, currentUser?.uid);
      setJoinEnabled(value);
    } catch (error) {
      console.error('Error updating join setting:', error);
      Alert.alert('Error', 'Failed to update join setting');
    } finally {
      setLoading(false);
    }
  };

  const handleShareInviteLink = async () => {
    try {
      if (!joinInfo) {
        await loadJoinInfo();
      }
      
      if (joinInfo && joinEnabled) {
        const inviteLink = generateExpenseJoinLink({
          expenseId: expense.id,
          token: joinInfo.token,
          code: joinInfo.code
        });
        
        await Share.share({
          message: `Join my expense "${expense.title}" on IOU: ${inviteLink}`,
          title: 'Join Expense'
        });
      }
    } catch (error) {
      console.error('Error sharing invite link:', error);
      Alert.alert('Error', 'Failed to share invite link');
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      if (!joinInfo) {
        await loadJoinInfo();
      }
      
      if (joinInfo && joinEnabled) {
        const inviteLink = generateExpenseJoinLink({
          expenseId: expense.id,
          token: joinInfo.token,
          code: joinInfo.code
        });
        
        await Clipboard.setString(inviteLink);
        setCopied(true);
        
        setTimeout(() => setCopied(false), 2000);
        
        Alert.alert('Copied!', 'Invite link copied to clipboard');
      }
    } catch (error) {
      console.error('Error copying invite link:', error);
      Alert.alert('Error', 'Failed to copy invite link');
    }
  };

  const handleLeaveExpense = () => {
    Alert.alert(
      'Leave Expense',
      'Are you sure you want to leave this expense? You will be removed from all splits and won\'t be able to access it anymore.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: confirmLeaveExpense,
        },
      ]
    );
  };

  const confirmLeaveExpense = async () => {
    try {
      setLoading(true);
      
      // Find current user's participant index
      const currentUserIndex = expense.participants.findIndex(
        p => p.userId === currentUser?.uid
      );
      
      if (currentUserIndex === -1) {
        Alert.alert('Error', 'User not found in expense participants');
        return;
      }

      // Remove user from participants
      const updatedParticipants = expense.participants.filter(
        (_, index) => index !== currentUserIndex
      );

      // Update items to remove user from splits and consumers
      const updatedItems = expense.items?.map(item => {
        if (!item || !item.name) return null;
        
        // Filter out the current user from selected consumers and adjust indices
        const validSelectedConsumers = item.selectedConsumers?.filter(
          consumerIndex => consumerIndex !== currentUserIndex && 
                          consumerIndex >= 0 && 
                          consumerIndex < expense.participants.length
        ).map(consumerIndex => 
          consumerIndex > currentUserIndex ? consumerIndex - 1 : consumerIndex
        ).filter(index => index >= 0) || [];

        // Filter out splits for the current user and adjust indices
        const validSplits = item.splits?.filter(
          split => split.participantIndex !== currentUserIndex && 
                   split.participantIndex >= 0 && 
                   split.participantIndex < expense.participants.length
        ).map(split => ({
          ...split,
          participantIndex: split.participantIndex > currentUserIndex 
            ? split.participantIndex - 1 
            : split.participantIndex
        })).filter(split => split.participantIndex >= 0) || [];

        return {
          ...item,
          selectedConsumers: validSelectedConsumers,
          splits: validSplits
        };
      }).filter(Boolean) || [];

      // Update fees to remove user from splits
      const updatedFees = expense.fees?.map(fee => {
        if (!fee || !fee.name) return null;
        
        // Filter out splits for the current user and adjust indices
        const validSplits = fee.splits?.filter(
          split => split.participantIndex !== currentUserIndex && 
                   split.participantIndex >= 0 && 
                   split.participantIndex < expense.participants.length
        ).map(split => ({
          ...split,
          participantIndex: split.participantIndex > currentUserIndex 
            ? split.participantIndex - 1 
            : split.participantIndex
        })).filter(split => split.participantIndex >= 0) || [];

        return {
          ...fee,
          splits: validSplits
        };
      }).filter(Boolean) || [];

      // Ensure we have valid data before updating
      const updateData = {
        participants: updatedParticipants.filter(p => p && p.name && p.userId), // Filter out invalid participants
        items: updatedItems.filter(item => item && item.name && typeof item.amount === 'number'), // Filter out invalid items
        fees: updatedFees.filter(fee => fee && fee.name && typeof fee.amount === 'number') // Filter out invalid fees
      };
      
      // Additional validation - ensure no undefined values exist
      const cleanUpdateData = JSON.parse(JSON.stringify(updateData));
      
      console.log('Update data before sending:', cleanUpdateData);
      
      // Update expense in Firestore with all changes at once
      await updateExpense(expense.id, cleanUpdateData, currentUser?.uid);

      Alert.alert(
        'Success',
        'You have left the expense successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('HomeMain')
          }
        ]
      );
    } catch (error) {
      console.error('Error leaving expense:', error);
      Alert.alert('Error', 'Failed to leave expense');
    } finally {
      setLoading(false);
    }
  };

  const canLeaveExpense = expense?.participants?.some(
    p => p.userId === currentUser?.uid
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <BlurView intensity={30} tint="light" style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Settings</Text>
        <View style={styles.headerSpacer} />
      </BlurView>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 100, paddingBottom: 120 }}
      >
        {/* Invite Link Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Invite Link</Text>
            <View style={styles.sectionIcon}>
              <Ionicons name="link-outline" size={24} color={Colors.accent} />
            </View>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow others to join</Text>
              <Text style={styles.settingDescription}>
                Let others join this expense using the invite link
              </Text>
            </View>
            <Switch
              value={joinEnabled}
              onValueChange={handleToggleJoin}
              disabled={loading}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor={joinEnabled ? Colors.surface : Colors.textSecondary}
            />
          </View>
          
          {joinEnabled && joinInfo && (
            <View style={styles.inviteSection}>
              <View style={styles.roomCodeContainer}>
                <Text style={styles.roomCodeLabel}>Room Code</Text>
                <Text style={styles.roomCode}>{joinInfo.code}</Text>
              </View>
              
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyInviteLink}
                  disabled={loading}
                >
                  <Ionicons name="copy-outline" size={20} color={Colors.surface} />
                  <Text style={styles.copyButtonText}>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShareInviteLink}
                  disabled={loading}
                >
                  <Ionicons name="share-outline" size={20} color={Colors.surface} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Leave Expense Section */}
        {canLeaveExpense && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Leave Expense</Text>
              <View style={styles.sectionIcon}>
                <Ionicons name="exit-outline" size={24} color={Colors.error} />
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveExpense}
              disabled={loading}
            >
              <Ionicons name="exit-outline" size={20} color={Colors.error} />
              <Text style={styles.leaveButtonText}>Leave Expense</Text>
            </TouchableOpacity>
            
            <Text style={styles.leaveDescription}>
              You will be removed from all splits and won't be able to access this expense anymore.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    flex: 1,
    fontWeight: '600',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  inviteSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
  },
  roomCodeContainer: {
    marginBottom: Spacing.md,
  },
  roomCodeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  roomCode: {
    ...Typography.h3,
    color: Colors.accent,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  copyButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  shareButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '20',
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  leaveButtonText: {
    ...Typography.label,
    color: Colors.error,
    fontWeight: '600',
  },
  leaveDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ExpenseSettingsScreen;
