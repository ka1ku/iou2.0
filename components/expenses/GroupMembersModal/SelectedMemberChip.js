import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/tokens';
import Animated, { ZoomIn, ZoomOut, LinearTransition } from 'react-native-reanimated';
import styles from './styles';

const SelectedMemberChip = React.memo(({ item, onRemove, locked }) => (
  <Animated.View
    entering={ZoomIn.springify().damping(15)}
    exiting={ZoomOut.duration(200)}
    layout={LinearTransition.springify()}
    style={styles.memberItem}
  >
    <View style={styles.memberAvatarContainer}>
      {item.profilePhoto ? (
        <Image source={{ uri: item.profilePhoto }} style={styles.memberAvatar} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.memberAvatarPlaceholder}>
          <Text style={styles.memberAvatarInitials}>
            {item.name === 'You' ? 'Y' : (item.name[0] || 'U').toUpperCase()}
          </Text>
        </View>
      )}
      {!item.isCurrentUser && !locked && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(item.id)}
        >
          <Ionicons name="close" size={12} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
    <Text style={styles.memberName} numberOfLines={1}>
      {item.name}
    </Text>
    {item.username && (
      <Text style={styles.memberUsername} numberOfLines={1}>
        @{item.username}
      </Text>
    )}
  </Animated.View>
));

export default SelectedMemberChip;
