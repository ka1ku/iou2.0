import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import UserListItem from './UserListItem';
import { SkeletonUserItem } from './SkeletonUserItem';
import styles from './styles';

const RecommendedItem = React.memo(({ item, selectedFriends, toggleSelectUser, onToggleStar }) => {
  const userId = item.objectID || item.id;
  const isSelected = selectedFriends.some((f) => f.id === userId);

  const handleStarToggle = useCallback(() => {
    onToggleStar(userId, {
      firstName: item.firstName,
      lastName: item.lastName,
      fullName: item.fullName,
      username: item.username,
      profilePhoto: item.profilePhoto,
    });
  }, [userId, item.firstName, item.lastName, item.fullName, item.username, item.profilePhoto, onToggleStar]);

  return (
    <UserListItem
      item={item}
      isSelected={isSelected}
      onToggleSelect={toggleSelectUser}
      isStarred={item._isStarred}
      onToggleStar={handleStarToggle}
    />
  );
});

const RecommendedSection = React.memo(({
  recommendedUsers,
  selectedFriends,
  toggleSelectUser,
  onToggleStar,
  loadingStarred,
  loadingRecent,
}) => {
  const isLoading = loadingStarred || loadingRecent;

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommended</Text>
        {[1, 2, 3].map((i) => <SkeletonUserItem key={`skeleton-recommended-${i}`} />)}
      </View>
    );
  }

  if (recommendedUsers.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Recommended</Text>
      {recommendedUsers.map((user) => (
        <RecommendedItem
          key={user.objectID || user.id}
          item={user}
          selectedFriends={selectedFriends}
          toggleSelectUser={toggleSelectUser}
          onToggleStar={onToggleStar}
        />
      ))}
    </View>
  );
});

export default RecommendedSection;
