import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/tokens';
import styles from './styles';

const ContactListItem = React.memo(({ item, onInviteContact }) => {
  const name = (item.firstName && item.lastName)
    ? `${item.firstName} ${item.lastName}`
    : (item.name || 'Unknown Contact');
  const phone = item.phoneNumbers?.[0]?.number || '';

  return (
    <TouchableOpacity style={styles.listItem} onPress={() => onInviteContact(item)}>
      <View style={styles.avatarContainer}>
        {item.imageAvailable && item.image?.uri ? (
          <Image source={{ uri: item.image.uri }} style={styles.avatar} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{(name[0] || 'U').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.contactBadge}>
          <Ionicons name="call-outline" size={12} color={Colors.white} />
        </View>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{name}</Text>
        <Text style={styles.userPhone}>{phone}</Text>
      </View>
      <TouchableOpacity
        style={styles.inviteButton}
        onPress={() => onInviteContact(item)}
        activeOpacity={0.8}
      >
        <Ionicons name="paper-plane" size={16} color={Colors.accent} />
        <Text style={styles.inviteButtonText}>Invite</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default ContactListItem;
