import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/tokens';
import styles from './styles';

const InvitedContactListItem = React.memo(({ item, onSMSInvite }) => {
  return (
    <View style={styles.listItem}>
      <View style={styles.avatarContainer}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto }} style={styles.avatar} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{(item.name[0] || 'U').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.contactBadge}>
          <Ionicons name="call-outline" size={12} color={Colors.white} />
        </View>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userPhone}>{item.phoneNumber}</Text>
      </View>
      <TouchableOpacity
        style={styles.inviteButton}
        onPress={() => onSMSInvite(item)}
        activeOpacity={0.8}
      >
        <Ionicons name="paper-plane" size={16} color={Colors.accent} />
        <Text style={styles.inviteButtonText}>Invite</Text>
      </TouchableOpacity>
    </View>
  );
});

export default InvitedContactListItem;
