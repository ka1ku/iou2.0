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
  Alert,
  Linking,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../../design/tokens';
import * as Contacts from 'expo-contacts';
import algoliasearch from 'algoliasearch';
import { Configure, InstantSearch, useInfiniteHits, useSearchBox } from 'react-instantsearch-core';
import { getCurrentUser } from '../../services/authService';
import { generateExpenseJoinLink, getExpenseJoinInfo, updateExpenseParticipants, sendExpenseInviteSMS } from '../../services/expenseService';
import { useExpense } from '../../contexts/ExpenseContext';

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
  const name = (item.firstName && item.lastName)
    ? `${item.firstName} ${item.lastName}`
    : (item.name || 'Unknown Contact');
  const phone = item.phoneNumbers?.[0]?.number || '';
  
  const handleInvitePress = () => {
    onInviteContact(item);
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
        style={styles.inviteButton} 
        onPress={handleInvitePress}
        activeOpacity={0.8}
      >
        <Ionicons name="paper-plane" size={16} color={Colors.accent} />
        <Text style={styles.inviteButtonText}>Invite</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const MemoizedInvitedContactItem = React.memo(({ item, onSMSInvite }) => {
  return (
    <View style={styles.listItem}>
      <View style={styles.avatarContainer}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{(item.name[0] || 'U').toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userPhone}>{item.phoneNumber}</Text>
      </View>
      <TouchableOpacity 
        style={styles.inviteButton} 
        onPress={() => onSMSInvite(item)}
        activeOpacity={0.8}
      >
        <Ionicons name="paper-plane" size={16} color={Colors.accent} />
        <Text style={styles.inviteButtonText}>Invite</Text>
      </TouchableOpacity>
    </View>
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

// Search components
const SearchPane = React.memo(({ 
  debouncedQuery, 
  selectedFriends, 
  toggleSelectUser, 
  inviteContact, 
  handleSMSInvite,
  filteredContacts,
  invitedContacts,
  filteredInvitedContacts
}) => {
  const { hits } = useInfiniteHits();
  const { refine } = useSearchBox();
  
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

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.uid;

  const filteredHits = useMemo(() => {
    return currentUserId ? hits.filter(friend => friend && friend.objectID && friend.objectID !== currentUserId) : hits;
  }, [hits, currentUserId]);

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

  const renderInvitedContact = useCallback(({ item }) => (
    <MemoizedInvitedContactItem item={item} onSMSInvite={handleSMSInvite} />
  ), [handleSMSInvite]);

  return (
    <View style={styles.searchContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent people</Text>
        {filteredHits.map((friend) => (
          <View key={friend.objectID}>
            {renderFriendItem({ item: friend })}
          </View>
        ))}
        {filteredInvitedContacts.map((contact) => (
          <View key={contact.id}>
            <MemoizedInvitedContactItem 
              item={contact} 
              onSMSInvite={handleSMSInvite}
            />
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

const ParticipantsGrid = forwardRef(({ 
  onParticipantPress,
  expenseId = null,
  currentUserId = null
}, ref) => {
  // Use context instead of props
  const { state, actions } = useExpense();
  const { participants, selectedFriends } = state;

  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [localQuery, setLocalQuery] = useState('');
  const [invitedContacts, setInvitedContacts] = useState([]);
  
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
      actions.setSelectedFriends(updated);
    } else {
      actions.setSelectedFriends([...selectedFriends, user]);
    }
  }, [selectedFriends, actions]);

  const inviteContact = useCallback(async (contact) => {
    const isAlreadyAdded = selectedFriends.some(friend => 
      friend.phoneNumber === contact.phoneNumbers?.[0]?.number ||
      friend.name.toLowerCase() === ((contact.firstName && contact.lastName) ? `${contact.firstName} ${contact.lastName}` : (contact.name || '')).toLowerCase()
    );
    
    if (isAlreadyAdded) {
      return;
    }
    
    const name = (contact.firstName && contact.lastName)
      ? `${contact.firstName} ${contact.lastName}`
      : (contact.name || 'Unknown');
    
    const invitedContact = {
      id: `invited-${Date.now()}-${Math.random()}`,
      name,
      phoneNumber: contact.phoneNumbers?.[0]?.number,
      profilePhoto: contact.imageAvailable && contact.image?.uri ? contact.image.uri : null,
      isInvited: true,
      invitedAt: new Date().toISOString()
    };
    
    setInvitedContacts(prev => {
      const alreadyInvited = prev.some(ic => 
        ic.phoneNumber === invitedContact.phoneNumber ||
        ic.name.toLowerCase() === invitedContact.name.toLowerCase()
      );
      if (alreadyInvited) return prev;
      return [...prev, invitedContact];
    });
    
    handleSMSInvite({
      ...contact,
      // Normalize phone before passing to SMS invite
      phoneNumbers: [{ number: (contact.phoneNumbers?.[0]?.number || '').replace(/\D/g, '') }]
    });
  }, [selectedFriends]);

  const handleSMSInvite = useCallback((contact) => {
    const rawPhone = contact.phoneNumbers?.[0]?.number || contact.phoneNumber;
    const contactName = (contact.firstName && contact.lastName)
      ? `${contact.firstName} ${contact.lastName}`
      : (contact.name || 'Unknown');
    sendExpenseInviteSMS({ expenseId, phoneNumber: rawPhone, contactName, preferUniversal: false })
      .catch(() => {
        Alert.alert('Invite failed', 'Could not open Messages.');
      });
  }, [expenseId]);

  const removeFriend = useCallback((friendId) => {
    const updated = selectedFriends.filter(f => f.id !== friendId);
    actions.setSelectedFriends(updated);
  }, [selectedFriends, actions]);

  const currentUserData = useMemo(() => {
    const currentUser = getCurrentUser();
    return {
      id: 'current-user',
      name: 'You',
      profilePhoto: currentUser?.profilePhoto,
      isCurrentUser: true
    };
  }, []);

  const allMembers = useMemo(() => [currentUserData, ...selectedFriends], [currentUserData, selectedFriends]);

  const filteredContacts = useMemo(() => {
    const q = (deferredQuery || '').trim().toLowerCase();
    if (q.length === 0) return contacts;
    
    return contacts.filter(c => {
      const name = (c.firstName && c.lastName) ? `${c.firstName} ${c.lastName}` : (c.name || '');
      const phone = (c.phoneNumbers?.[0]?.number || '').toLowerCase();
      return name.toLowerCase().includes(q) || phone.includes(q);
    });
  }, [contacts, deferredQuery]);

  const filteredInvitedContacts = useMemo(() => {
    const q = (deferredQuery || '').trim().toLowerCase();
    if (q.length === 0) return invitedContacts;
    
    return invitedContacts.filter(ic => {
      const name = ic.name.toLowerCase();
      const phone = (ic.phoneNumber || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [invitedContacts, deferredQuery]);


  const renderMemberItem = useCallback(({ item }) => (
    <MemoizedMemberItem item={item} onRemoveFriend={removeFriend} />
  ), [removeFriend]);



  useImperativeHandle(ref, () => ({
    openModal: () => setShowModal(true),
    closeModal: () => setShowModal(false)
  }));
  

  return (
    <View style={styles.container}>
      {/* Participant Snapshot Section */}
      <TouchableOpacity
        style={styles.participantSnapshotContainer}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        {/* Avatar Stack */}
        <View style={styles.avatarStackContainer}>
          {participants.filter(p => p.name !== 'Me').slice(0, 4).map((participant, index) => (
            <View
              key={participant.id}
              style={[
                styles.avatarStackItem,
                { zIndex: participants.filter(p => p.name !== 'Me').length - index }
              ]}
            >
              {participant.profilePhoto ? (
                <Image source={{ uri: participant.profilePhoto }} style={styles.avatarStackImage} />
              ) : (
                <View style={styles.avatarStackPlaceholder}>
                  <Text style={styles.avatarStackInitials}>
                    {(participant.name?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          ))}

          {/* Overflow Indicator */}
          {participants.filter(p => p.name !== 'Me').length > 4 && (
            <View style={styles.overflowContainer}>
              <Text style={styles.overflowText}>+{participants.filter(p => p.name !== 'Me').length - 4}</Text>
            </View>
          )}
        </View>

        {/* Action Text */}
        <View style={styles.actionContainer}>
          <Text style={styles.actionText}>Manage group</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* Friend Selection Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={async () => {
                try {
                  // Build participants list: current user + selected friends
                  const authUser = getCurrentUser();
                  if (expenseId && authUser?.uid) {
                    const participantsToSave = allMembers.map((member) => {
                      if (member.isCurrentUser) {
                        return {
                          name: member.name,
                          userId: authUser.uid,
                          profilePhoto: authUser.profilePhoto || member.profilePhoto || null,
                          username: authUser.username || null,
                        };
                      }
                      return {
                        name: member.name,
                        userId: member.id,
                        profilePhoto: member.profilePhoto || null,
                        username: member.username || null,
                      };
                    });
                    await updateExpenseParticipants(expenseId, participantsToSave, authUser.uid);
                  }
                } catch (e) {
                  console.error('Failed to save participants:', e);
                  Alert.alert('Error', 'Could not save group members.');
                } finally {
                  setShowModal(false);
                }
              }}
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
                data={allMembers.filter(member => !member.isCurrentUser)}
                horizontal
                keyExtractor={(item) => item.id}
                renderItem={renderMemberItem}
                contentContainerStyle={styles.membersList}
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Search Bar */}
            <MemoizedSearchInput value={localQuery} onChangeText={setLocalQuery} />

            {/* Search Results */}
            <MemoizedSearchResults 
              searchPaneProps={{
                debouncedQuery: deferredQuery,
                selectedFriends,
                toggleSelectUser,
                inviteContact,
                handleSMSInvite,
                filteredContacts,
                invitedContacts,
                filteredInvitedContacts
              }} 
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});

ParticipantsGrid.displayName = 'ParticipantsGrid';

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  // Participant Snapshot Styles
  participantSnapshotContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    ...Shadows.card,
  },
  avatarStackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.lg,
  },
  avatarStackItem: {
    width: 40,
    height: 40,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  avatarStackImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarStackPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackInitials: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Typography.familySemiBold,
  },
  overflowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    ...Shadows.button,
  },
  overflowText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  actionText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  currentUserAvatarStack: {
    borderColor: Colors.accent,
    borderWidth: 3,
    backgroundColor: Colors.accent,
  },
  currentUserInitials: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },

  // FriendSelector Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
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
  resultsContainer: {
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.xxl,
  },
  searchContent: {
    flex: 1,
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
  inviteButtonText: {
    ...Typography.body2,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: Spacing.xxl,
  },
});

export default ParticipantsGrid;