import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import deepLinkService from '../services/deepLinkService';
import { getCurrentUser } from '../services/authService';
import { joinExpense } from '../services/expenseService';

const ExpenseJoinHandler = () => {
  const [joinData, setJoinData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Helper function to format phone number nicely
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    
    // Decode URL encoding first
    const decoded = decodeURIComponent(phone);
    
    // Remove all non-digits
    const digits = decoded.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // Format as +X (XXX) XXX-XXXX for international numbers
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    // Return decoded version if can't format
    return decoded;
  };

  useEffect(() => {
    const unsubscribe = deepLinkService.addListener('expenseJoin', (data) => {
      setJoinData(data);
      setShowModal(true);
    });

    const initialURL = deepLinkService.getInitialURL();
    if (initialURL) {
      // Handled by deep link service already
      deepLinkService.clearInitialURL();
    }

    return unsubscribe;
  }, []);

  const handleJoin = async () => {
    if (!joinData) return;
    try {
      setProcessing(true);
      const user = getCurrentUser();
      if (!user) {
        Alert.alert('Sign in required', 'Please sign in to join this expense.');
        return;
      }
      await joinExpense({ 
        expenseId: joinData.expenseId, 
        token: joinData.token, 
        code: joinData.code, 
        phone: joinData.phone, // Pass phone number for identification
        user 
      });
      Alert.alert('Joined', 'You have joined the expense.');
      setShowModal(false);
      setJoinData(null);
    } catch (error) {
      let errorTitle = 'Error';
      let errorMessage = error.message || 'Failed to join';
      
      // Handle specific phone validation errors
      if (error.message.includes('Phone number mismatch')) {
        errorTitle = 'Phone Number Mismatch';
        errorMessage = 'You can only join expenses you were specifically invited to. Please check that your phone number matches the invitation.';
      } else if (error.message.includes('Phone number required')) {
        errorTitle = 'Phone Number Required';
        errorMessage = 'Please add your phone number to your profile before joining expenses.';
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (!joinData) return null;

  return (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="people" size={28} color={Colors.accent} />
            </View>
            <Text style={styles.modalTitle}>Join Expense</Text>
            <Text style={styles.modalSubtitle}>Tap join to start splitting expenses</Text>
          </View>

          <View style={styles.detailsBox}>
            <View style={styles.inviteInfo}>
              <Ionicons name="mail" size={16} color={Colors.accent} style={styles.infoIcon} />
              <Text style={styles.inviteText}>You were invited to join an expense</Text>
            </View>
            {joinData.phone ? (
              <View style={styles.phoneInfo}>
                <Ionicons name="call" size={16} color={Colors.accent} style={styles.infoIcon} />
                <View style={styles.phoneDetails}>
                  <Text style={styles.phoneLabel}>Invited as</Text>
                  <Text style={styles.phoneNumber}>{formatPhoneNumber(joinData.phone)}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.instructionBox}>
              <Ionicons name="information-circle" size={16} color={Colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.instructionText}>
                Make sure your phone number matches to join
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={() => setShowModal(false)} disabled={processing}>
              <Text style={styles.declineText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.joinButton]} onPress={handleJoin} disabled={processing}>
              <Text style={styles.joinText}>{processing ? 'Joining...' : 'Join expense'}</Text>
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
    maxWidth: 420,
    ...Shadows.card,
  },
  modalHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.xs },
  modalSubtitle: { ...Typography.body, color: Colors.textSecondary },
  detailsBox: { 
    backgroundColor: Colors.background, 
    borderRadius: Radius.md, 
    padding: Spacing.lg, 
    marginBottom: Spacing.xl 
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  phoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  phoneDetails: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  phoneLabel: { 
    ...Typography.label, 
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  phoneNumber: { 
    ...Typography.title, 
    color: Colors.textPrimary,
    fontFamily: Typography.familyMedium,
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  instructionText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    flex: 1,
    marginLeft: Spacing.sm,
    lineHeight: 18,
  },
  infoIcon: {
    marginRight: Spacing.sm,
  },
  inviteText: { 
    ...Typography.body, 
    color: Colors.textPrimary,
    flex: 1,
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, alignItems: 'center' },
  declineButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.divider },
  joinButton: { backgroundColor: Colors.accent },
  declineText: { ...Typography.title, color: Colors.textSecondary },
  joinText: { ...Typography.title, color: Colors.surface, fontWeight: '600' },
});

export default ExpenseJoinHandler;


