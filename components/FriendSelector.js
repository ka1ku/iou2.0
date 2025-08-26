import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Image,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Typography, Spacing, Radius } from '../design/tokens';
import ProfilePicture from '../components/VenmoProfilePicture';
import DeleteButton from '../components/DeleteButton';
import * as Contacts from 'expo-contacts';
import algoliasearch from 'algoliasearch';
import { Configure, InstantSearch, useInfiniteHits, useSearchBox } from 'react-instantsearch-core';
import { getCurrentUser } from '../services/authService';

const searchClient = algoliasearch('I0T07P5NB6', 'adfc79b41b2490c5c685b1adebac864c');

const FriendSelector = ({ 
  selectedFriends, 
  onFriendsChange, 
  showAddButton = true,
  placeholder = "Select friends to split with...",
  allowPlaceholders = true,
  onAddPlaceholder,
  onClose
}) => {
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [localQuery, setLocalQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    initContacts();
  }, []);

  const initContacts = async () => {
    try {
      const { status: existingStatus } = await Contacts.getPermissionsAsync();
      if (existingStatus !== 'granted') {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
        ],
      });
      setContacts(data || []);
    } catch (e) {
      console.error('Contacts error', e);
    }
  };

  const toggleSelectUser = (user) => {
    const isSelected = selectedFriends.some(f => f.id === user.id);
    if (isSelected) {
      const updated = selectedFriends.filter(f => f.id !== user.id);
      onFriendsChange(updated);
    } else {
      onFriendsChange([...selectedFriends, user]);
    }
  };

  const inviteContact = (contact) => {
    if (!allowPlaceholders) return;
    const name = (contact.firstName && contact.lastName)
      ? `${contact.firstName} ${contact.lastName}`
      : (contact.name || 'Unknown');
    const ghost = {
      id: `ghost-${Date.now()}`,
      name,
      isPlaceholder: true,
    };
    onAddPlaceholder?.(ghost);
  };

  const removeFriend = (friendId) => {
    const updated = selectedFriends.filter(f => f.id !== friendId);
    onFriendsChange(updated);
  };

  // Add current user to the member list
  const getCurrentUserData = () => {
    const currentUser = getCurrentUser();
    return {
      id: 'current-user',
      name: 'You',
      profilePhoto: currentUser?.profilePhoto,
      isCurrentUser: true
    };
  };

  const allMembers = [getCurrentUserData(), ...selectedFriends];

  const SearchPane = () => {
    const { hits, isLastPage, showMore } = useInfiniteHits();
    const { refine } = useSearchBox();
    
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedQuery(localQuery);
        refine(localQuery);
      }, 300);
      return () => clearTimeout(timer);
    }, [localQuery, refine]);

    const q = (debouncedQuery || '').trim().toLowerCase();

    // Get current user to filter out from results
    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.uid;

    // Filter contacts by query and exclude current user
    const filteredContacts = contacts.filter(c => {
      if (q.length === 0) return true;
      const name = (c.firstName && c.lastName) ? `${c.firstName} ${c.lastName}` : (c.name || '');
      const phone = (c.phoneNumbers?.[0]?.number || '').toLowerCase();
      return name.toLowerCase().includes(q) || phone.includes(q);
    });

    // Filter out current user from Algolia search results
    const filteredHits = currentUserId ? hits.filter(friend => friend && friend.objectID && friend.objectID !== currentUserId) : hits;

    const renderFriendItem = ({ item }) => {
      const name = (item.fullName || `${item.firstName || ''} ${item.lastName || ''}`).trim() || 'Unknown';
      const isSelected = selectedFriends.some(f => f.id === item.objectID);
      
      return (
        <TouchableOpacity style={styles.listItem} onPress={() => toggleSelectUser({ id: item.objectID, name, username: item.username, profilePhoto: item.profilePhoto })}>
          <View style={styles.avatarContainer}>
            {item.profilePhoto ? (
              <Image source={{ uri: item.profilePhoto }} style={styles.avatar} />
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
          <TouchableOpacity 
            style={[styles.addButton, isSelected && styles.addButtonSelected]} 
            onPress={() => toggleSelectUser({ id: item.objectID, name, username: item.username, profilePhoto: item.profilePhoto })}
          >
            {isSelected ? (
              <Ionicons name="checkmark" size={16} color={Colors.white} />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      );
    };

    const renderContact = ({ item }) => {
      const name = (item.firstName && item.lastName)
        ? `${item.firstName} ${item.lastName}`
        : (item.name || 'Unknown Contact');
      const phone = item.phoneNumbers?.[0]?.number || '';
      
      return (
        <TouchableOpacity style={styles.listItem} onPress={() => inviteContact(item)}>
          <View style={styles.avatarContainer}>
            {item.imageAvailable && item.image?.uri ? (
              <Image source={{ uri: item.image.uri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{(name[0] || 'U').toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.userPhone}>{phone}</Text>
          </View>
          <TouchableOpacity style={styles.inviteButton} onPress={() => inviteContact(item)}>
            <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.searchContent}>
        <FlatList
          data={[
            { type: 'friends', data: filteredHits, title: 'Recent people' },
            { type: 'contacts', data: filteredContacts, title: 'Contacts' }
          ]}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.type === 'friends' ? (
                <FlatList
                  data={section.data}
                  keyExtractor={(friend) => friend.objectID}
                  renderItem={renderFriendItem}
                  scrollEnabled={false}
                />
              ) : (
                <FlatList
                  data={section.data}
                  keyExtractor={(contact, index) => `contact-${index}`}
                  renderItem={renderContact}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
          onEndReached={() => {
            if (q.length > 0 && !isLastPage && filteredHits.length > 0 && currentUserId) showMore();
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
        />
      </View>
    );
  };

  const renderMemberItem = ({ item }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberAvatarContainer}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto }} style={styles.memberAvatar} />
        ) : (
          <View style={styles.memberAvatarPlaceholder}>
            <Text style={styles.memberAvatarInitials}>
              {item.name === 'You' ? 'Y' : (item.name[0] || 'U').toUpperCase()}
            </Text>
          </View>
        )}
        {!item.isCurrentUser && (
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => removeFriend(item.id)}
          >
            <Ionicons name="close" size={14} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.memberName} numberOfLines={1}>
        {item.name}
      </Text>
      {!item.isCurrentUser && item.username && (
        <Text style={styles.memberUsername} numberOfLines={1}>
          @{item.username}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {showAddButton && (
        <TouchableOpacity style={styles.selectButton} onPress={() => setShowModal(true)}>
          <Ionicons name="people-outline" size={20} color={Colors.accent} />
          <Text style={styles.selectButtonText}>
            {selectedFriends.length === 0 ? placeholder : `Add/Remove Friends (${selectedFriends.length})`}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                // Call onClose callback if provided to update parent state
                if (onClose) {
                  onClose(selectedFriends);
                }
                setShowModal(false);
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Group Members</Text>
            </View>
          </View>

          {/* Current Members */}
          <View style={styles.membersContainer}>
            <FlatList
              data={allMembers}
              horizontal
              keyExtractor={(item) => item.id}
              renderItem={renderMemberItem}
              contentContainerStyle={styles.membersList}
              showsHorizontalScrollIndicator={false}
              scrollEnabled={true}
              bounces={true}
              decelerationRate="normal"
            />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="person" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or username"
                placeholderTextColor={Colors.textSecondary}
                value={localQuery}
                onChangeText={setLocalQuery}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Search Results */}
          <View style={styles.resultsContainer}>
            <InstantSearch searchClient={searchClient} indexName="users">
              <Configure hitsPerPage={10} attributesToRetrieve={[ 'objectID','firstName','lastName','username','profilePhoto','fullName' ]} />
              <SearchPane />
            </InstantSearch>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Main button
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    ...Shadows.card,
  },
  selectButtonText: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.body1,
    color: Colors.textPrimary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.surface,

  },

  // Header
  modalHeader: {
    backgroundColor: Colors.surface,
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.xl,
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    ...Typography.body1,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Members section
  membersContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl, // Add horizontal padding to container
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    overflow: 'visible', // Ensure X buttons are not clipped
    minHeight: 120,
  },
  membersList: {
    paddingHorizontal: 0,
    backgroundColor: Colors.surface,

    paddingVertical: 20, // Remove vertical padding since container handles it
  },
  memberItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
    width: 90, // Increased width to accommodate the X button
    paddingHorizontal: 8, // Add padding to prevent X button cutoff
    flexShrink: 0, // Prevent items from shrinking
  },
  memberAvatarContainer: {
    position: 'relative',
    width: 70, // Fixed width container
    height: 70, // Fixed height container
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  memberAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitials: {
    color: Colors.white,
    fontSize: 20,
    fontFamily: Typography.familySemiBold,
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4, // Adjusted position to be within the container bounds
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  memberName: {
    ...Typography.body,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  memberUsername: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  // Search
  searchContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.body1,
    color: Colors.textPrimary,
  },

  // Results
  resultsContainer: {
    backgroundColor: Colors.surface,
    flex: 1, // Take remaining space
  },
  searchContent: {
    flex: 1, // Take remaining space
  },
  section: {
    marginBottom: Spacing.xxl,
    marginTop: Spacing.lg, // Add top margin for first section
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg, // Add top margin above section titles
    paddingHorizontal: Spacing.xl,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  avatarContainer: {
    marginRight: Spacing.lg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: Typography.familySemiBold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  userHandle: {
    ...Typography.body,
    color: Colors.blue,
  },
  userPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  addButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonSelected: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  addButtonText: {
    ...Typography.body2,
    fontFamily: Typography.familySemiBold,
    color: Colors.textSecondary,
  },
  inviteButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 60,
    alignItems: 'center',
  },
  inviteButtonText: {
    ...Typography.body2,
    fontFamily: Typography.familySemiBold,
    color: Colors.textSecondary,
  },
});

export default FriendSelector;