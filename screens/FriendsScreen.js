import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Share,
  Linking,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import ProfilePicture from '../components/VenmoProfilePicture';
import DeleteButton from '../components/DeleteButton';
import { getCurrentUser } from '../services/authService';
import { 
  getUserFriends, 
  getFriendRequests, 
  acceptFriendRequest, 
  declineFriendRequest,
  removeFriend,
  createFriendRequest,
  generateFriendInviteLink,
  listenToFriends,
  listenToFriendRequests
} from '../services/friendService';

const FriendsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser) {
      loadFriendsData();
      setupListeners(currentUser.uid);
    }
  }, []);

  const setupListeners = (userId) => {
    // Listen to friends in real-time
    const friendsUnsubscribe = listenToFriends(userId, (updatedFriends) => {
      setFriends(updatedFriends);
    });

    // Listen to friend requests in real-time
    const requestsUnsubscribe = listenToFriendRequests(userId, (updatedRequests) => {
      setFriendRequests(updatedRequests);
    });

    // Cleanup listeners on unmount
    return () => {
      if (friendsUnsubscribe) friendsUnsubscribe();
      if (requestsUnsubscribe) requestsUnsubscribe();
    };
  };

  const loadFriendsData = async () => {
    try {
      if (currentUser) {
        const [userFriends, userRequests] = await Promise.all([
          getUserFriends(currentUser.uid),
          getFriendRequests(currentUser.uid)
        ]);
        
        setFriends(userFriends);
        setFriendRequests(userRequests);
      }
    } catch (error) {
      console.error('Error loading friends data:', error);
      Alert.alert('Error', 'Failed to load friends data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFriendsData();
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await declineFriendRequest(requestId);
      Alert.alert('Success', 'Friend request declined');
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const handleRemoveFriend = (friendId, friendName) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friendId);
              Alert.alert('Success', 'Friend removed');
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const handleUserSelect = useCallback(async (user) => {
    try {
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      if (user.id === currentUser.uid) {
        Alert.alert('Not Allowed', 'You cannot add yourself as a friend');
        return;
      }

      // Check if already friends
      const isAlreadyFriend = friends.some(friend => friend.friendId === user.id);
      if (isAlreadyFriend) {
        Alert.alert('Already Friends', 'You are already friends with this user');
        return;
      }

      // Check if friend request already sent
      const hasRequest = friendRequests.some(request => 
        request.fromUserId === user.id || request.toUserId === user.id
      );
      if (hasRequest) {
        Alert.alert('Already Sent', 'You have already sent a friend request to this user');
        return;
      }

      await createFriendRequest(currentUser.uid, user.id);
      Alert.alert('Success', 'Friend request sent!');
      
      // Clear search results
      setSearchResults([]);
      setHasSearched(false);
      
    } catch (error) {
      console.error('Error sending friend request:', error);
      if (error.message.includes('already exists')) {
        Alert.alert('Already Sent', 'You have already sent a friend request to this user');
      } else if (error.message.includes('Already friends')) {
        Alert.alert('Already Friends', 'You are already friends with this user');
      } else {
        Alert.alert('Error', 'Failed to send friend request');
      }
    }
  }, [currentUser, friends, friendRequests]);

  const handleShareInvite = async () => {
    try {
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      const inviteLink = generateFriendInviteLink(currentUser.uid, {
        firstName: currentUser.displayName?.split(' ')[0] || 'User',
        lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || '',
        phoneNumber: currentUser.phoneNumber || ''
      });

      await Share.share({
        message: `Hey! I'm using IOU App to track shared expenses. Join me by clicking this link: ${inviteLink}`,
        title: 'Join me on IOU App!'
      });
    } catch (error) {
      console.error('Error sharing invite:', error);
      Alert.alert('Error', 'Failed to share invite');
    }
  };

  const renderFriendRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestInfo}>
        <View style={styles.requestAvatar}>
          <ProfilePicture
            source={item.fromUserProfile?.profilePhoto}
            size={36}
            username={item.fromUserProfile?.username || `${item.fromUserProfile?.firstName || ''} ${item.fromUserProfile?.lastName || ''}`}
          />
        </View>
        <Text style={styles.requestName}>
          {`${item.fromUserProfile?.firstName || ''} ${item.fromUserProfile?.lastName || ''}`.trim() || 'Unknown Name'}
        </Text>
        {item.fromUserProfile?.username && (
          <Text style={styles.requestUsername}>@{item.fromUserProfile.username}</Text>
        )}
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          accessibilityLabel="Accept friend request"
          style={styles.iconAction}
          onPress={() => handleAcceptRequest(item.id)}
        >
          <Ionicons name="checkmark-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
        <DeleteButton
          onPress={() => handleDeclineRequest(item.id)}
          size="large"
          variant="subtle"
          testID="decline-friend-request"
        />
      </View>
    </View>
  );

  const renderFriend = ({ item }) => (
    <TouchableOpacity 
      style={styles.friendCard}
      onPress={() => navigation.navigate('FriendProfile', { 
        friend: {
          friendId: item.friendId,
          name: `${item.friendData.firstName || ''} ${item.friendData.lastName || ''}`.trim() || 'Unknown Name',
          username: item.friendData.username,
          profilePhoto: item.friendData.profilePhoto,
          firstName: item.friendData.firstName,
          lastName: item.friendData.lastName,
        }
      })}
      activeOpacity={0.7}
    >
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatar}>
          <ProfilePicture
            source={item.friendData.profilePhoto}
            size={40}
            username={item.friendData.username || `${item.friendData.firstName || ''} ${item.friendData.lastName || ''}`}
          />
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>
            {`${item.friendData.firstName || ''} ${item.friendData.lastName || ''}`.trim() || 'Unknown Name'}
          </Text>
          {item.friendData.username && (
            <Text style={styles.friendUsername}>@{item.friendData.username}</Text>
          )}
        </View>
      </View>
      <View style={styles.friendActions}>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading friends...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
          <Ionicons name="share-outline" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friend Requests ({friendRequests.length})</Text>
            {friendRequests.map((item) => (
              <View key={item.id}>
                {renderFriendRequest({ item })}
              </View>
            ))}
          </View>
        )}

        {/* Add Friend Section with Algolia Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Friend</Text>
          <Text style={styles.sectionDescription}>
            Search for users by name, username, or phone number
          </Text>
          <View style={styles.searchContainer}>
          
          </View>
        </View>

        {/* Friends List Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Friends ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyStateText}>No friends yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add friends to start sharing expenses together
              </Text>
            </View>
          ) : (
            friends.map((item) => (
              <View key={item.id}>
                {renderFriend({ item })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  scrollContent: {
    paddingBottom: Spacing.xl, // Add padding at the bottom to prevent content from being cut off
  },
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    ...Shadows.card,
    minHeight: 120, // Ensure minimum height for sections
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 18, // Ensure readable font size
  },
  sectionDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg, // Increased margin
    fontStyle: 'italic',
    fontSize: 14, // Ensure readable font size
    lineHeight: 20, // Better line spacing
  },
  searchContainer: {
    marginTop: Spacing.md, // Increased margin
    minHeight: 80, // Ensure minimum height for search container
  },

  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  requestInfo: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  requestAvatar: {
    marginBottom: Spacing.xs,
  },
  requestName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  requestUsername: {
    ...Typography.body,
    color: Colors.accent,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  iconAction: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.sm,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  friendUsername: {
    ...Typography.body,
    color: Colors.accent,
  },
  friendActions: {
    padding: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});

export default FriendsScreen;

