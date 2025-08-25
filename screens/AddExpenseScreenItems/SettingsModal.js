import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../design/tokens';

/**
 * SettingsModal Component
 * 
 * Displays the settings modal for expense configuration.
 * Used in the AddExpenseScreen for managing expense settings.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.visible - Whether the modal is visible
 * @param {Function} props.onClose - Callback when modal should close
 * @param {boolean} props.joinEnabled - Whether join by room code is enabled
 * @param {Function} props.onToggleJoin - Callback when join setting is toggled
 * @returns {React.ReactElement} Settings modal with expense configuration
 */
const SettingsModal = ({ visible, onClose, joinEnabled, onToggleJoin }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Expense Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.modalContent}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Allow join by room code</Text>
              <Text style={styles.settingDescription}>
                Let others join this expense using the room code
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                joinEnabled && styles.toggleButtonActive
              ]}
              onPress={onToggleJoin}
            >
              <View style={[
                styles.toggleThumb,
                joinEnabled && styles.toggleThumbActive
              ]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  toggleButton: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleButtonActive: {
    backgroundColor: Colors.accent,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
});

export default SettingsModal;
