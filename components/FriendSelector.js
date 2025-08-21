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
import VenmoProfilePicture from '../components/VenmoProfilePicture';
import { getCurrentUser } from '../services/authService';
import { getUserFriends } from '../services/friendService';

const FriendSelector = ({ 
  selectedFriends, 
  onFriendsChange, 
  maxFriends = 10,
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
  const [showPhoneQuick, setShowPhoneQuick] = useState(false);

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
           friend.friendData.phoneNumber.includes(search) ||
           (friend.friendData.venmoUsername && friend.friendData.venmoUsername.toLowerCase().includes(search));
  });

  const toggleFriendSelection = (friend) => {
    const isSelected = selectedFriends.some(selected => selected.id === friend.friendId);
    
    if (isSelected) {
      // Remove friend
      const updated = selectedFriends.filter(selected => selected.id !== friend.friendId);
      onFriendsChange(updated);
    } else {
      // Add friend (check max limit)
      if (selectedFriends.length >= maxFriends) {
        Alert.alert('Maximum Friends Reached', `You can only select up to ${maxFriends} friends for an expense.`);
        return;
      }
      
      const newFriend = {
        id: friend.friendId,
        name: friend.friendData.venmoUsername
          ? `@${friend.friendData.venmoUsername}`
          : `${friend.friendData.firstName} ${friend.friendData.lastName}`,
        phoneNumber: friend.friendData.phoneNumber,
        venmoUsername: friend.friendData.venmoUsername,
        venmoProfilePic: friend.friendData.venmoProfilePic
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
            <Text style={styles.friendPhone}>{item.friendData.phoneNumber}</Text>
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

  const renderSelectedFriend = ({ item }) => (
    <View style={styles.selectedFriendChip}>
      <Text style={styles.selectedFriendName}>{item.name}</Text>
      <TouchableOpacity
        style={styles.removeFriendButton}
        onPress={() => removeSelectedFriend(item.id)}
      >
        <Ionicons name="close-circle" size={16} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Selected Friends Display */}
      {selectedFriends.length > 0 && (
        <View style={styles.selectedFriendsContainer}>
          <Text style={styles.selectedFriendsLabel}>Selected Friends:</Text>
          <FlatList
            data={selectedFriends}
            renderItem={renderSelectedFriend}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedFriendsList}
          />
        </View>
      )}

      {/* Friend Selection Button */}
      {showAddButton && (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="people-outline" size={20} color={Colors.accent} />
          <Text style={styles.selectButtonText}>
            {selectedFriends.length === 0 ? placeholder : `Add/Remove Friends (${selectedFriends.length}/${maxFriends})`}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
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
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.modalContent}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search friends..."
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
                        phoneNumber: newPlaceholder.phone.trim() || undefined,
                        isPlaceholder: true,
                      };
                      onAddPlaceholder?.(ghost);
                      setSearchQuery('');
                      setNewPlaceholder({ name: '', phone: '' });
                      setShowPhoneQuick(false);
                    }}
                  >
                    <Text style={styles.quickAddButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setShowPhoneQuick(v => !v)}>
                  <Text style={styles.quickAddPhoneToggle}>
                    {showPhoneQuick ? 'Hide phone' : 'Add phone number'}
                  </Text>
                </TouchableOpacity>
                {showPhoneQuick && (
                  <TextInput
                    style={[styles.input, { marginTop: Spacing.sm }]}
                    placeholder="Phone (optional)"
                    keyboardType="phone-pad"
                    placeholderTextColor={Colors.textSecondary}
                    value={newPlaceholder.phone}
                    onChangeText={(t) => setNewPlaceholder({ ...newPlaceholder, phone: t })}
                  />
                )}
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

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <Text style={styles.selectionSummary}>
              {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''} selected
            </Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  selectedFriendsContainer: {
    marginBottom: Spacing.sm,
  },
  selectedFriendsLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  selectedFriendsList: {
    paddingRight: Spacing.md,
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    marginRight: Spacing.sm,
  },
  selectedFriendName: {
    ...Typography.label,
    color: Colors.surface,
    marginRight: Spacing.xs,
  },
  removeFriendButton: {
    padding: 2,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    padding: Spacing.md,
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
  friendPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
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
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
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
  quickAddPhoneToggle: { ...Typography.label, color: Colors.accent, marginTop: Spacing.sm },
  selectionSummary: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  doneButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  doneButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
  inputRow: { marginBottom: Spacing.md },
  inputLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    ...Typography.body,
    color: Colors.textPrimary,
  },
});

export default FriendSelector;
