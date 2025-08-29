import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Image,
  ScrollView,
  Share,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Typography, Spacing, Radius } from '../design/tokens';
import ProfilePicture from '../components/VenmoProfilePicture';
import DeleteButton from '../components/DeleteButton';
import * as Contacts from 'expo-contacts';
import algoliasearch from 'algoliasearch';
import { Configure, InstantSearch, useInfiniteHits, useSearchBox } from 'react-instantsearch-core';
import { getCurrentUser } from '../services/authService';
import { generateExpenseJoinLink, getExpenseJoinInfo } from '../services/expenseService';

const searchClient = algoliasearch('I0T07P5NB6', 'adfc79b41b2490c5c685b1adebac864c');

// Memoized components to prevent unnecessary re-renders
const MemoizedFriendItem = React.memo(({ item, isSelected, onToggleSelect }) => {
  const name = (item.fullName || `${item.firstName || ''} ${item.lastName || ''}`).trim() || 'Unknown';
  
  return (
    <TouchableOpacity style={styles.listItem} onPress={() => onToggleSelect({ id: item.objectID, name, username: item.username, profilePhoto: item.profilePhoto })}>
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
        onPress={() => onToggleSelect({ id: item.objectID, name, username: item.username, profilePhoto: item.profilePhoto })}
      >
        {isSelected ? (
          <Ionicons name="checkmark" size={16} color={Colors.white} />
        ) : (
          <Text style={styles.addButtonText}>Add</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const MemoizedContactItem = React.memo(({ item, onInviteContact, onSMSInvite }) => {
  const [inviteSent, setInviteSent] = useState(false);
  const name = (item.firstName && item.lastName)
    ? `${item.firstName} ${item.lastName}`
    : (item.name || 'Unknown Contact');
  const phone = item.phoneNumbers?.[0]?.number || '';
  
  const handleInvitePress = () => {
    if (!inviteSent) {
      // First time - send SMS and add placeholder
      setInviteSent(true);
      onSMSInvite(item);
      onInviteContact(item); // Add as placeholder
    } else {
      // Already invited - just open SMS again
      onSMSInvite(item);
    }
  };
  
  return (
    <TouchableOpacity style={styles.listItem} onPress={() => onInviteContact(item)}>
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
      <TouchableOpacity 
        style={[
          styles.inviteButton, 
          inviteSent && styles.inviteButtonSent
        ]} 
        onPress={handleInvitePress}
        activeOpacity={0.8}
      >
        {inviteSent ? (
          <>
            <Ionicons name="checkmark" size={16} color={Colors.white} />
            <Text style={styles.inviteButtonText}>Invited</Text>
          </>
        ) : (
          <>
            <Ionicons name="paper-plane" size={16} color={Colors.accent} />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const MemoizedMemberItem = React.memo(({ item, onRemoveFriend }) => (
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
          onPress={() => onRemoveFriend(item.id)}
        >
          <Ionicons name="close" size={12} color={Colors.textPrimary} />
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
));

// Move SearchPane outside to prevent recreation on every render
const SearchPane = React.memo(({ 
  debouncedQuery, 
  selectedFriends, 
  toggleSelectUser, 
  inviteContact, 
  handleSMSInvite,
  filteredContacts 
}) => {
  const { hits } = useInfiniteHits();
  const { refine } = useSearchBox();
  
  // Add 200ms delay for Algolia queries to prevent API calls while typing
  const debouncedRefine = useRef(null);
  
  useEffect(() => {
    if (debouncedRefine.current) {
      clearTimeout(debouncedRefine.current);
    }
    
    debouncedRefine.current = setTimeout(() => {
      refine(debouncedQuery);
    }, 200);
    
    return () => {
      if (debouncedRefine.current) {
        clearTimeout(debouncedRefine.current);
      }
    };
  }, [debouncedQuery, refine]);

  // Get current user to filter out from results
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.uid;

  // Filter out current user from Algolia search results
  const filteredHits = useMemo(() => {
    return currentUserId ? hits.filter(friend => friend && friend.objectID && friend.objectID !== currentUserId) : hits;
  }, [hits, currentUserId]);

  // Memoize render functions to prevent recreation
  const renderFriendItem = useCallback(({ item }) => {
    const isSelected = selectedFriends.some(f => f.id === item.objectID);
    return (
      <MemoizedFriendItem 
        item={item} 
        isSelected={isSelected} 
        onToggleSelect={toggleSelectUser} 
      />
    );
  }, [selectedFriends, toggleSelectUser]);

  const renderContact = useCallback(({ item }) => (
    <MemoizedContactItem item={item} onInviteContact={inviteContact} onSMSInvite={handleSMSInvite} />
  ), [inviteContact, handleSMSInvite]);

  return (
    <View style={styles.searchContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent people</Text>
        {filteredHits.map((friend) => (
          <View key={friend.objectID}>
            {renderFriendItem({ item: friend })}
          </View>
        ))}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contacts</Text>
        {filteredContacts.map((contact, index) => (
          <View key={`contact-${index}`}>
            {renderContact({ item: contact })}
          </View>
        ))}
      </View>
    </View>
  );
});

// Memoized search input to prevent re-renders
const MemoizedSearchInput = React.memo(({ value, onChangeText }) => (
  <View style={styles.searchContainer}>
    <View style={styles.searchBar}>
      <Ionicons name="person" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or username"
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
    </View>
  </View>
));

// Memoized search results wrapper to prevent unnecessary re-renders
const MemoizedSearchResults = React.memo(({ searchPaneProps }) => (
  <View style={styles.resultsContainer}>
    <InstantSearch 
      searchClient={searchClient} 
      indexName="users"
      stalledSearchDelay={500}
    >
      <Configure 
        hitsPerPage={10} 
        attributesToRetrieve={[ 'objectID','firstName','lastName','username','profilePhoto','fullName' ]} 
      />
      <SearchPane {...searchPaneProps} />
    </InstantSearch>
  </View>
));

const FriendSelector = forwardRef(({ 
  selectedFriends, 
  onFriendsChange, 
  showAddButton = true,
  placeholder = "Select friends to split with...",
  onClose,
  expenseId,
  placeholders = []
}, ref) => {
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [localQuery, setLocalQuery] = useState('');
  
  // Use deferred value to prevent UI flicker
  const deferredQuery = useDeferredValue(localQuery);

  useEffect(() => {
    initContacts();
  }, []);

  const initContacts = useCallback(async () => {
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
  }, []);

  const toggleSelectUser = useCallback((user) => {
    const isSelected = selectedFriends.some(f => f.id === user.id);
    if (isSelected) {
      const updated = selectedFriends.filter(f => f.id !== user.id);
      onFriendsChange(updated);
    } else {
      onFriendsChange([...selectedFriends, user]);
    }
  }, [selectedFriends, onFriendsChange]);

  const inviteContact = useCallback(async (contact) => {
    // Check if already added as a friend or placeholder
    const isAlreadyAdded = selectedFriends.some(friend => 
      friend.phoneNumber === contact.phoneNumbers?.[0]?.number ||
      friend.name.toLowerCase() === ((contact.firstName && contact.lastName) ? `${contact.firstName} ${contact.lastName}` : (contact.name || '')).toLowerCase()
    );
    
    // Also check against existing placeholders
    const isAlreadyPlaceholder = placeholders.some(placeholder => 
      placeholder.phoneNumber === contact.phoneNumbers?.[0]?.number ||
      placeholder.name.toLowerCase() === ((contact.firstName && contact.lastName) ? `${contact.firstName} ${contact.lastName}` : (contact.name || '')).toLowerCase()
    );
    
    if (isAlreadyAdded || isAlreadyPlaceholder) {
      // Already added, don't add again
      return;
    }
    
    // Create placeholder contact
    const name = (contact.firstName && contact.lastName)
      ? `${contact.firstName} ${contact.lastName}`
      : (contact.name || 'Unknown');
    
    const placeholder = {
      id: `placeholder-${Date.now()}-${Math.random()}`,
      name,
      phoneNumber: contact.phoneNumbers?.[0]?.number,
      isPlaceholder: true,
      invited: true, // Mark as invited
      invitedAt: new Date().toISOString()
    };
    
    // Add to selected friends (this will show in the horizontal list)
    onFriendsChange([...selectedFriends, placeholder]);
  }, [selectedFriends, onFriendsChange, placeholders]);

  const handleSMSInvite = useCallback((contact) => {
    const phoneNumber = contact.phoneNumbers?.[0]?.number;
    if (!phoneNumber) {
      Alert.alert('No Phone Number', 'This contact doesn\'t have a phone number.');
      return;
    }

    // Create a simple invite message immediately
    const contactName = (contact.firstName && contact.lastName)
      ? `${contact.firstName} ${contact.lastName}`
      : (contact.name || 'Unknown');
    
    let message = `Hi ${contactName}! I'd like to invite you to join IOU App so we can split expenses together. Download it from the App Store!`;
    
    // If we have an expenseId, try to add a deep link (non-blocking)
    if (expenseId) {
      // Fire and forget - don't block the UI
      getExpenseJoinInfo(expenseId, { initializeIfMissing: true })
        .then(joinInfo => {
          if (joinInfo && joinInfo.code) {
            const deepLink = generateExpenseJoinLink({ 
              expenseId, 
              code: joinInfo.code,
              phone: phoneNumber
            });
            message = `Hi ${contactName}! Join me on IOU App to split expenses: ${deepLink}`;
            
            // Open SMS with updated message
            const body = encodeURIComponent(message);
            const separator = Platform.OS === 'ios' ? '&' : '?';
            const smsUrl = `sms:${phoneNumber}${separator}body=${body}`;
            Linking.openURL(smsUrl).catch(() => {
              // Fallback to basic SMS
              Linking.openURL(`sms:${phoneNumber}`);
            });
          }
        })
        .catch(error => {
          console.log('Could not generate deep link, using fallback message');
          // Use fallback message and open SMS immediately
          const body = encodeURIComponent(message);
          const separator = Platform.OS === 'ios' ? '&' : '?';
          const smsUrl = `sms:${phoneNumber}${separator}body=${body}`;
          Linking.openURL(smsUrl).catch(() => {
            Linking.openURL(`sms:${phoneNumber}`);
          });
        });
    } else {
      // No expenseId, open SMS immediately with fallback message
      const body = encodeURIComponent(message);
      const separator = Platform.OS === 'ios' ? '&' : '?';
      const smsUrl = `sms:${phoneNumber}${separator}body=${body}`;
      Linking.openURL(smsUrl).catch(() => {
        Linking.openURL(`sms:${phoneNumber}`);
      });
    }
  }, [expenseId]);

  const removeFriend = useCallback((friendId) => {
    const updated = selectedFriends.filter(f => f.id !== friendId);
    onFriendsChange(updated);
  }, [selectedFriends, onFriendsChange]);

  // Memoize current user data to prevent recreation
  const currentUserData = useMemo(() => {
    const currentUser = getCurrentUser();
    return {
      id: 'current-user',
      name: 'You',
      profilePhoto: currentUser?.profilePhoto,
      isCurrentUser: true
    };
  }, []);

  // Memoize all members array
  const allMembers = useMemo(() => [currentUserData, ...selectedFriends], [currentUserData, selectedFriends]);

  // Memoize filtered contacts based on debounced query
  const filteredContacts = useMemo(() => {
    const q = (deferredQuery || '').trim().toLowerCase();
    if (q.length === 0) return contacts;
    
    return contacts.filter(c => {
      const name = (c.firstName && c.lastName) ? `${c.firstName} ${c.lastName}` : (c.name || '');
      const phone = (c.phoneNumbers?.[0]?.number || '').toLowerCase();
      return name.toLowerCase().includes(q) || phone.includes(q);
    });
  }, [contacts, deferredQuery]);

  // Memoize key extractors for FlatList
  const memberKeyExtractor = useCallback((item) => item.id, []);
  const friendKeyExtractor = useCallback((item) => item.objectID, []);
  const contactKeyExtractor = useCallback((item, index) => `contact-${index}`, []);

  // Memoize render functions for FlatList
  const renderMemberItem = useCallback(({ item }) => (
    <MemoizedMemberItem item={item} onRemoveFriend={removeFriend} />
  ), [removeFriend]);

  const handleModalClose = useCallback(() => {
    if (onClose) {
      onClose(selectedFriends);
    }
    setShowModal(false);
  }, [onClose, selectedFriends]);

  // Memoize the search pane props to prevent unnecessary re-renders
  const searchPaneProps = useMemo(() => ({
    debouncedQuery: deferredQuery,
    selectedFriends,
    toggleSelectUser,
    inviteContact,
    handleSMSInvite,
    filteredContacts
  }), [deferredQuery, selectedFriends, toggleSelectUser, inviteContact, handleSMSInvite, filteredContacts]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openModal: () => setShowModal(true),
    closeModal: () => setShowModal(false)
  }));

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
              onPress={handleModalClose}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Group Members</Text>
            </View>
          </View>

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {/* Current Members */}
            <View style={styles.membersContainer}>
              <FlatList
                data={allMembers}
                horizontal
                keyExtractor={memberKeyExtractor}
                renderItem={renderMemberItem}
                contentContainerStyle={styles.membersList}
                showsHorizontalScrollIndicator={false}
                scrollEnabled={true}
                bounces={true}
                decelerationRate="normal"
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                getItemLayout={(data, index) => ({
                  length: 88, // 80 + Spacing.lg margin
                  offset: 88 * index,
                  index,
                })}
              />
            </View>

            {/* Search Bar */}
            <MemoizedSearchInput value={localQuery} onChangeText={setLocalQuery} />

            {/* Search Results */}
            <MemoizedSearchResults searchPaneProps={searchPaneProps} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});

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
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  membersList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  memberItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
    width: 80,
    flexShrink: 0,
  },
  memberAvatarContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  memberAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  memberAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  memberAvatarInitials: {
    color: Colors.white,
    fontSize: 20,
    fontFamily: Typography.familySemiBold,
  },
  removeButton: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  memberName: {
    ...Typography.body2,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  memberUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
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
    paddingBottom: Spacing.xxl, // Add bottom padding for scroll space
  },
  searchContent: {
    flex: 1, // Take remaining space
  },
  section: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  inviteButtonSent: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  inviteButtonText: {
    ...Typography.body2,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: Spacing.xxl,
  },
  contactActions: {
    flexDirection: 'row',
    marginLeft: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  smsInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.blue,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    minWidth: 60,
    justifyContent: 'center',
  },
  smsInviteButtonPressed: {
    backgroundColor: Colors.success,
    opacity: 0.8,
  },
  smsInviteButtonText: {
    ...Typography.body2,
    fontFamily: Typography.familySemiBold,
    color: Colors.white,
    marginLeft: Spacing.xs,
    fontSize: 12,
  },
});

export default FriendSelector;