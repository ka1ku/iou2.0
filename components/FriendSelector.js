import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import ProfilePicture from '../components/VenmoProfilePicture';
import DeleteButton from '../components/DeleteButton';
import { getCurrentUser } from '../services/authService';
import { getUserFriends } from '../services/friendService';

const FriendSelector = ({ 
  selectedFriends, 
  onFriendsChange, 
  maxFriends = null, // Remove limit - can have unlimited friends
  showAddButton = true,
  placeholder = "Select friends to split with...",
  allowPlaceholders = true,
  onAddPlaceholder
}) => {
  const [friends, setFriends] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState({ name: '', phone: '' });

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      if (currentUser) {
        const userFriends = await getUserFriends(currentUser.uid);
        setFriends(userFriends);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(friend => {
    const fullName = `${friend.friendData.firstName} ${friend.friendData.lastName}`.toLowerCase();
    const search = searchQuery.toLowerCase();
    return fullName.includes(search) || 
           (friend.friendData.venmoUsername && friend.friendData.venmoUsername.toLowerCase().includes(search));
  });

  const toggleFriendSelection = (friend) => {
    const isSelected = selectedFriends.some(selected => selected.id === friend.friendId);
    
    if (isSelected) {
      // Remove friend
      const updated = selectedFriends.filter(selected => selected.id !== friend.friendId);
      onFriendsChange(updated);
    } else {
      // Add friend (no limit)
      const newFriend = {
        id: friend.friendId,
        name: `${friend.friendData.firstName || ''} ${friend.friendData.lastName || ''}`.trim() || 'Unknown Name',
        username: friend.friendData.venmoUsername,
        profilePhoto: friend.friendData.profilePhoto
      };
      
      onFriendsChange([...selectedFriends, newFriend]);
    }
  };

  const removeSelectedFriend = (friendId) => {
    const updated = selectedFriends.filter(friend => friend.id !== friendId);
    onFriendsChange(updated);
  };

  const renderFriendItem = ({ item }) => {
    const isSelected = selectedFriends.some(selected => selected.id === item.friendId);
    
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => toggleFriendSelection(item)}
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
              <Text style={styles.friendVenmo}>@{item.friendData.venmoUsername}</Text>
            )}
          </View>
        </View>
        <View style={styles.selectionIndicator}>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
          )}
        </View>
      </TouchableOpacity>
    );
  };



  return (
    <View style={styles.container}>
      {/* Friend Selection Button */}
      {showAddButton && (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="people-outline" size={20} color={Colors.accent} />
          <Text style={styles.selectButtonText}>
            {selectedFriends.length === 0 ? placeholder : `Add/Remove Friends (${selectedFriends.length})`}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Selected Friends Display */}
      {selectedFriends.length > 0 && (
        <View style={styles.selectedFriendsContainer}>
          <Text style={styles.selectedFriendsLabel}>Selected Friends:</Text>
          {selectedFriends.map((friend) => (
            <View key={friend.id} style={styles.selectedFriendChip}>
              <View style={styles.friendAvatar}>
                <ProfilePicture
                  source={friend.profilePhoto || null}
                  size={40}
                  username={friend.name}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedFriendName}>{friend.name}</Text>
                {friend.username && (
                  <Text style={styles.selectedFriendUsername}>@{friend.username}</Text>
                )}
              </View>
              <DeleteButton
                onPress={() => removeSelectedFriend(friend.id)}
                size="small"
                variant="subtle"
              />
            </View>
          ))}
        </View>
      )}

      {/* Friend Selection Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Friends</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="checkmark" size={24} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search friends or add placeholder"
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Quick Add Placeholder (integrated with search) */}
            {allowPlaceholders && searchQuery.trim().length > 0 && (
              <View style={styles.quickAddCard}>
                <View style={styles.quickAddRow}>
                  <Ionicons name="person-add" size={20} color={Colors.accent} />
                  <Text style={styles.quickAddText}>
                    Add "{searchQuery.trim()}" as placeholder
                  </Text>
                  <TouchableOpacity
                    style={styles.quickAddButton}
                    onPress={() => {
                      const name = searchQuery.trim();
                      if (!name) return;
                      const ghost = {
                        id: `ghost-${Date.now()}`,
                        name,
                        isPlaceholder: true,
                      };
                      onAddPlaceholder?.(ghost);
                      setSearchQuery('');
                      setNewPlaceholder({ name: '', phone: '' });
                      setShowModal(false); // Close modal after adding placeholder
                    }}
                  >
                    <Text style={styles.quickAddButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Friends List */}
            <FlatList
              data={filteredFriends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.friendId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.friendsList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={Colors.textSecondary} />
                  <Text style={styles.emptyStateText}>
                    {loading ? 'Loading friends...' : 'No friends found'}
                  </Text>
                  {!loading && searchQuery && (
                    <Text style={styles.emptyStateSubtext}>
                      Try adjusting your search terms
                    </Text>
                  )}
                </View>
              }
            />
          </View>


        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
  },
  selectedFriendsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  selectedFriendsLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },

  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  selectedFriendName: {
    ...Typography.title,
    color: Colors.textPrimary,
  },
  selectedFriendUsername: {
    ...Typography.body,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },

  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.lg, // Slightly more rounded
    padding: Spacing.lg, // More padding for better touch target
    marginTop: Spacing.md, // Add top margin for better spacing
    ...Shadows.card,
  },
  selectButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  doneButton: {
    padding: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  friendsList: {
    paddingBottom: Spacing.xl,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  friendItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '10',
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
  friendVenmo: {
    ...Typography.label,
    color: Colors.accent,
  },
  selectionIndicator: {
    width: 24,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  quickAddCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickAddText: { ...Typography.body, color: Colors.textPrimary, flex: 1, marginLeft: Spacing.sm },
  quickAddButton: { backgroundColor: Colors.accent, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  quickAddButtonText: { ...Typography.label, color: Colors.surface, fontWeight: '600' },

});

export default FriendSelector;
