import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Share, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCodeStyled from 'react-native-qrcode-styled';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getExpenseJoinInfo, generateExpenseJoinLink } from '../services/expenseService';

const InviteFriendSheet = ({
  visible,
  onClose,
  expenseId,
  placeholderName,
  phoneNumber,
}) => {
  const [loading, setLoading] = useState(false);
  const [joinInfo, setJoinInfo] = useState(null);

  useEffect(() => {
    const ensureInvite = async () => {
      if (!visible) return;
      if (!expenseId) {
        Alert.alert('Save required', 'Please save the expense first to invite.');
        onClose?.();
        return;
      }
      try {
        setLoading(true);
        const info = await getExpenseJoinInfo(expenseId, { initializeIfMissing: true });
        setJoinInfo(info);
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to create invite');
        onClose?.();
      } finally {
        setLoading(false);
      }
    };
    ensureInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, expenseId, placeholderName, phoneNumber]);

  const deepLink = useMemo(() => {
    if (!joinInfo) return '';
    return generateExpenseJoinLink({ expenseId, token: joinInfo.token, code: joinInfo.code });
  }, [joinInfo, expenseId]);

  const handleShare = async () => {
    if (!deepLink) return;
    try {
      await Share.share({ message: deepLink, url: deepLink });
    } catch (e) {
      // no-op
    }
  };

  const handleSMS = async () => {
    if (!deepLink) return;
    if (!phoneNumber) {
      Alert.alert('No phone number', 'Add a phone number to send an SMS invite.');
      return;
    }
    const body = encodeURIComponent(`Join our expense on IOU: ${deepLink}`);
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const smsUrl = `sms:${phoneNumber}${separator}body=${body}`;
    try {
      const supported = await Linking.canOpenURL(smsUrl);
      if (supported) await Linking.openURL(smsUrl);
    } catch (e) {}
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Have them scan to join</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <View style={styles.qrCard}>
            {joinInfo && deepLink ? (
              <QRCodeStyled
                data={deepLink}
                padding={20}
                pieceSize={7}
                pieceBorderRadius={4}
                isPiecesGlued
                color={'#1d5480'}
                preserveAspectRatio="none"
                logo={{
                    href: require('../assets/appstore.png'),
                    padding: 10,
                    scale: 1.4,
                    hidePieces: true,
                  }}
                style={{ backgroundColor: 'white' }}
              />
            ) : (
              <View style={styles.qrPlaceholder} />
            )}
            <Text style={styles.placeholderName}>{placeholderName}</Text>
            {joinInfo?.code ? (
              <Text style={styles.codeText}>Room code: {joinInfo.code}</Text>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, styles.smsButton]} onPress={handleSMS} disabled={!phoneNumber || loading}>
              <Ionicons name="chatbubble-ellipses" size={18} color={Colors.surface} />
              <Text style={styles.actionText}>Text invite</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={handleShare} disabled={loading}>
              <Ionicons name="share-social" size={18} color={Colors.surface} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
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
  closeButton: { padding: Spacing.sm },
  headerSpacer: { width: 40 },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center', flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
  qrCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  qrPlaceholder: { width: 220, height: 220, backgroundColor: Colors.background, borderRadius: Radius.md },
  placeholderName: { ...Typography.title, color: Colors.textPrimary, marginTop: Spacing.md },
  codeText: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  actionButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.md },
  smsButton: { backgroundColor: Colors.accent },
  shareButton: { backgroundColor: Colors.textPrimary },
  actionText: { ...Typography.title, color: Colors.surface, fontWeight: '600' },
});

export default InviteFriendSheet;


