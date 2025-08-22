import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Share,
  Linking
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
  findUserByPhoneNumber,
  findUserByUsername,
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
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showAddFriend, setShowAddFriend] = useState(true); // always show search
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const currentUser = getCurrentUser();
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
      const currentUser = getCurrentUser();
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

  const handleSearchUser = async () => {
    const raw = (searchInput || '').trim();
    if (!raw) {
      Alert.alert('Error', 'Please enter a phone number or @username');
      return;
    }

    setSearching(true);
    try {
      let user = null;
      const looksLikeUsername = /[a-zA-Z@]/.test(raw);
      user = looksLikeUsername ? await findUserByUsername(raw) : await findUserByPhoneNumber(raw);

      if (user) {
        setSearchResults([user]);
      } else {
        setSearchResults([]);
        Alert.alert('Not Found', 'No user found with that phone or username');
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      Alert.alert('Error', 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (userData) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      if (userData.id === currentUser.uid) {
        Alert.alert('Not Allowed', 'You cannot add yourself as a friend');
        return;
      }

      await createFriendRequest(currentUser.uid, userData.id);

      Alert.alert('Success', 'Friend request sent!');
      setSearchResults([]);
      setSearchInput('');
      setShowAddFriend(false);
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
  };

  const handleShareInvite = async () => {
    try {
      const currentUser = getCurrentUser();
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

  const formatPhone = (value) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    let rest = digits;
    if (digits.startsWith('1')) rest = digits.slice(1);
    const area = rest.slice(0,3);
    const mid = rest.slice(3,6);
    const last = rest.slice(6,10);
    if (area && mid && last) return `+1 (${area}) ${mid}-${last}`;
    return value;
  };

  const renderFriendRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestInfo}>
        <View style={styles.requestAvatar}>
          <ProfilePicture
            source={item.fromUserProfile?.profilePhoto}
            size={36}
            username={item.fromUserProfile?.venmoUsername || `${item.fromUserProfile?.firstName || ''} ${item.fromUserProfile?.lastName || ''}`}
          />
        </View>
        <Text style={styles.requestName}>
          {`${item.fromUserProfile?.firstName || ''} ${item.fromUserProfile?.lastName || ''}`.trim() || 'Unknown Name'}
        </Text>
        {item.fromUserProfile?.venmoUsername && (
          <Text style={styles.requestUsername}>@{item.fromUserProfile.venmoUsername}</Text>
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
          name: item.friendData.venmoUsername
            ? `@${item.friendData.venmoUsername}`
            : `${item.friendData.firstName} ${item.friendData.lastName}`,
          venmoUsername: item.friendData.venmoUsername,
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
            username={item.friendData.venmoUsername || `${item.friendData.firstName || ''} ${item.friendData.lastName || ''}`}
          />
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>
            {`${item.friendData.firstName || ''} ${item.friendData.lastName || ''}`.trim() || 'Unknown Name'}
          </Text>
          {item.friendData.venmoUsername && (
            <Text style={styles.friendUsername}>@{item.friendData.venmoUsername}</Text>
          )}
        </View>
      </View>
      <View style={styles.friendActions}>
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }) => (
    <View style={styles.searchResultCard}>
      <View style={styles.searchResultInfo}>
        <View style={styles.searchResultAvatar}>
          <ProfilePicture
            source={item.profilePhoto}
            size={40}
            username={item.venmoUsername || `${item.firstName || ''} ${item.lastName || ''}`}
          />
        </View>
        <View style={styles.searchResultDetails}>
          <Text style={styles.searchResultName}>
            {`${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown Name'}
          </Text>
          {item.venmoUsername && (
            <Text style={styles.searchResultUsername}>@{item.venmoUsername}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.addFriendButton}
        onPress={() => handleSendFriendRequest(item)}
      >
        <Text style={styles.addFriendButtonText}>Add Friend</Text>
      </TouchableOpacity>
    </View>
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

      <View style={styles.content}>
        {/* Friend Requests Section */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friend Requests ({friendRequests.length})</Text>
            <FlatList
              data={friendRequests}
              renderItem={renderFriendRequest}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* Add Friend Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Friend</Text>
          <View style={styles.addFriendForm}>
            <TextInput
              style={styles.phoneInput}
              placeholder="Enter phone number or @username"
              placeholderTextColor={Colors.textSecondary}
              value={searchInput}
              onChangeText={setSearchInput}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearchUser}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color={Colors.surface} />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
            
            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
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
            <FlatList
              data={friends}
              renderItem={renderFriend}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
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
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  toggleButton: {
    padding: Spacing.sm,
  },
  addFriendForm: {
    marginTop: Spacing.sm,
  },
  phoneInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  searchButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  searchButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
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
  requestVenmo: {
    ...Typography.label,
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
  requestButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.accent,
  },
  acceptButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: Colors.danger,
  },
  declineButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
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
  friendInitials: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
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
  friendVenmo: {
    ...Typography.label,
    color: Colors.accent,
  },

  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  searchResultInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.sm,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  searchResultInitials: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
  searchResultDetails: {
    flex: 1,
  },
  searchResultName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  searchResultUsername: {
    ...Typography.body,
    color: Colors.accent,
  },
  searchResultVenmo: {
    ...Typography.label,
    color: Colors.accent,
  },
  addFriendButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  addFriendButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
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

