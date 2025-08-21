import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import deepLinkService from '../services/deepLinkService';
import { createFriendRequest } from '../services/friendService';
import { getCurrentUser } from '../services/authService';

const FriendInvitationHandler = () => {
  const [invitation, setInvitation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Listen for friend invitations from deep links
    const unsubscribe = deepLinkService.addListener('friendInvite', (inviteData) => {
      setInvitation(inviteData);
      setShowModal(true);
    });

    // Check for initial deep link
    const initialURL = deepLinkService.getInitialURL();
    if (initialURL) {
      // The deep link service will handle this automatically
      deepLinkService.clearInitialURL();
    }

    return unsubscribe;
  }, []);

  const handleAcceptInvitation = async () => {
    if (!invitation) return;

    try {
      setProcessing(true);
      const currentUser = getCurrentUser();
      
      if (!currentUser) {
        Alert.alert('Error', 'You must be signed in to accept friend requests');
        return;
      }

      await createFriendRequest(currentUser.uid, invitation.uid);

      Alert.alert('Success', 'Friend request sent!');
      setShowModal(false);
      setInvitation(null);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      if (error.message.includes('already exists')) {
        Alert.alert('Already Sent', 'You have already sent a friend request to this user');
      } else if (error.message.includes('Already friends')) {
        Alert.alert('Already Friends', 'You are already friends with this user');
      } else {
        Alert.alert('Error', 'Failed to send friend request: ' + error.message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDeclineInvitation = () => {
    setShowModal(false);
    setInvitation(null);
  };

  if (!invitation) return null;

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent={true}
      onRequestClose={handleDeclineInvitation}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.invitationIcon}>
              <Ionicons name="person-add" size={32} color={Colors.accent} />
            </View>
            <Text style={styles.modalTitle}>Friend Invitation</Text>
            <Text style={styles.modalSubtitle}>
              Someone wants to be your friend on IOU App!
            </Text>
          </View>

          <View style={styles.invitationDetails}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitials}>
                  {invitation.firstName?.[0] || ''}{invitation.lastName?.[0] || ''}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {invitation.firstName} {invitation.lastName}
                </Text>
                <Text style={styles.userPhone}>{invitation.phoneNumber}</Text>
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={handleDeclineInvitation}
              disabled={processing}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAcceptInvitation}
              disabled={processing}
            >
              {processing ? (
                <Text style={styles.acceptButtonText}>Sending...</Text>
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...Shadows.card,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  invitationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  invitationDetails: {
    marginBottom: Spacing.xl,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userInitials: {
    ...Typography.h2,
    color: Colors.surface,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  userPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  declineButtonText: {
    ...Typography.title,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: Colors.accent,
  },
  acceptButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default FriendInvitationHandler;
