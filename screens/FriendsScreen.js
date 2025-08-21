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
import VenmoProfilePicture from '../components/VenmoProfilePicture';
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
          <VenmoProfilePicture
            source={item.fromUserProfile?.venmoProfilePic}
            size={36}
            username={item.fromUserProfile?.venmoUsername || `${item.fromUserProfile?.firstName || ''} ${item.fromUserProfile?.lastName || ''}`}
          />
        </View>
        <Text style={styles.requestName}>
          {item.fromUserProfile?.venmoUsername ? `@${item.fromUserProfile.venmoUsername}` : `${item.fromUserProfile?.firstName || ''} ${item.fromUserProfile?.lastName || ''}`}
        </Text>
        <Text style={styles.requestPhone}>{formatPhone(item.fromUserProfile?.phoneNumber || '')}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          accessibilityLabel="Accept friend request"
          style={styles.iconAction}
          onPress={() => handleAcceptRequest(item.id)}
        >
          <Ionicons name="checkmark-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Decline friend request"
          style={styles.iconAction}
          onPress={() => handleDeclineRequest(item.id)}
        >
          <Ionicons name="close-circle" size={28} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatar}>
          <VenmoProfilePicture
            source={item.friendData.venmoProfilePic}
            size={40}
            username={item.friendData.venmoUsername || `${item.friendData.firstName || ''} ${item.friendData.lastName || ''}`}
          />
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>
            {item.friendData.venmoUsername
              ? `@${item.friendData.venmoUsername}`
              : `${item.friendData.firstName} ${item.friendData.lastName}`}
          </Text>
          <Text style={styles.friendPhone}>{formatPhone(item.friendData.phoneNumber)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeFriendButton}
        onPress={() => handleRemoveFriend(item.friendId, `${item.friendData.firstName} ${item.friendData.lastName}`)}
      >
        <Ionicons name="close-circle" size={22} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  const renderSearchResult = ({ item }) => (
    <View style={styles.searchResultCard}>
      <View style={styles.searchResultInfo}>
        <View style={styles.searchResultAvatar}>
          <VenmoProfilePicture
            source={item.venmoProfilePic}
            size={40}
            username={item.venmoUsername || `${item.firstName || ''} ${item.lastName || ''}`}
          />
        </View>
        <View style={styles.searchResultDetails}>
          <Text style={styles.searchResultName}>
            {item.venmoUsername ? `@${item.venmoUsername}` : `${item.firstName} ${item.lastName}`}
          </Text>
          <Text style={styles.searchResultPhone}>{formatPhone(item.phoneNumber)}</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
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
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
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
    paddingTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.lg,
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
  },
  toggleButton: {
    padding: Spacing.sm,
  },
  addFriendForm: {
    marginTop: Spacing.md,
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
  },
  requestName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  requestPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  requestVenmo: {
    ...Typography.label,
    color: Colors.accent,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  friendPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  friendVenmo: {
    ...Typography.label,
    color: Colors.accent,
  },
  removeFriendButton: {
    padding: Spacing.sm,
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
  searchResultPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
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
    paddingVertical: Spacing.xl,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});

export default FriendsScreen;
