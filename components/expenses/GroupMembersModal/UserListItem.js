import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/tokens';
import styles from './styles';

const UserListItem = React.memo(({ item, isSelected, onToggleSelect, isStarred, onToggleStar }) => {
  const name = (item.fullName || `${item.firstName || ''} ${item.lastName || ''}`).trim() || 'Unknown';
  const userId = item.objectID || item.id;

  const userPayload = { id: userId, name, username: item.username, profilePhoto: item.profilePhoto };

  return (
    <View style={styles.listItem}>
      <Pressable style={styles.listItemBody} onPress={() => onToggleSelect(userPayload)}>
        <View style={styles.avatarContainer}>
          {item.profilePhoto ? (
            <Image source={{ uri: item.profilePhoto }} style={styles.avatar} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{(name[0] || 'U').toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{name}</Text>
          {item.username && <Text style={styles.userHandle}>@{item.username}</Text>}
        </View>
      </Pressable>
      <View style={styles.actionButtons}>
        <Pressable
          style={styles.starButton}
          onPress={onToggleStar}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isStarred ? 'star' : 'star-outline'}
            size={20}
            color={isStarred ? Colors.brand : Colors.navInactive}
          />
        </Pressable>
        <Pressable
          style={[styles.addButton, isSelected && styles.addButtonSelected]}
          onPress={() => onToggleSelect(userPayload)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isSelected ? 'checkmark-sharp' : 'add'}
            size={16}
            color={isSelected ? Colors.white : Colors.navInactive}
          />
        </Pressable>
      </View>
    </View>
  );
});

export default UserListItem;
