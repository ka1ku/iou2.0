import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import ProfilePicture from './VenmoProfilePicture';

/**
 * Reusable component for displaying verified Venmo profile information
 */
const VenmoProfileDisplay = ({ 
  username, 
  profilePic, 
  onChangeAccount, 
  profileSize = 50,
  showChangeButton = true 
}) => {
  // Check if this is a real Venmo profile picture (not a fallback avatar)
  const isRealVenmoProfile = profilePic && !profilePic.includes('ui-avatars.com');
  
  // Determine status text and color
  let statusText, statusColor;
  
  if (isRealVenmoProfile) {
    statusText = '✓ Verified Venmo Account';
    statusColor = Colors.success;
  } else {
    // User exists but no profile picture
    statusText = '✓ Venmo Account (No Profile Picture)';
    statusColor = Colors.textSecondary;
  }
  
  return (
    <View style={styles.verifiedContainer}>
      <View style={styles.profileContainer}>
        <ProfilePicture
          source={profilePic}
          size={profileSize}
          username={username}
          style={styles.profilePic}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>@{username}</Text>
          <Text style={[styles.profileStatus, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
      </View>
      
      {showChangeButton && (
        <TouchableOpacity
          style={styles.changeButton}
          onPress={onChangeAccount}
        >
          <Text style={styles.changeButtonText}>Change Account</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  verifiedContainer: {
    width: '100%',
    alignItems: 'center',

  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    width: '100%',
    ...Shadows.card,
  },
  profilePic: {
    marginRight: 48,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontSize: 16,
  },
  profileStatus: {
    ...Typography.body,
    fontSize: 12,
  },
  changeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  changeButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default VenmoProfileDisplay;
