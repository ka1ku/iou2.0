import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import SelectedMemberChip from './SelectedMemberChip';
import styles from './styles';

const SelectedMembersStrip = React.memo(({ selectedFriends, onRemove, friendsOnItems }) => {
  const scrollRef = useRef(null);

  // Auto-scroll to end when a new member is added
  useEffect(() => {
    if (selectedFriends.length > 0 && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }, 300);
    }
  }, [selectedFriends.length]);

  if (selectedFriends.length === 0) {
    return (
      <View style={styles.membersContainer}>
        <View style={styles.emptyMembersPlaceholder}>
          <Text style={styles.emptyMembersText}>No group members yet</Text>
          <Text style={styles.emptyMembersSubtext}>Add friends below to create your group</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.membersContainer}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.membersList}
        layout={LinearTransition.springify()}
      >
        {selectedFriends.map((item) => (
          <SelectedMemberChip
            key={item.id}
            item={item}
            onRemove={onRemove}
            locked={friendsOnItems.has(item.id)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
});

export default SelectedMembersStrip;
