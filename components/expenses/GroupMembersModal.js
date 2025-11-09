import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';
import * as Contacts from 'expo-contacts';
import { algoliasearch } from 'algoliasearch';
import { Configure, InstantSearch, useInfiniteHits, useSearchBox } from 'react-instantsearch-core';
import { getCurrentUser, formatPhoneNumber } from '../../services/authService';
import { updateExpenseParticipants, sendExpenseInviteSMS } from '../../services/expenseService';
import { useExpense } from '../../contexts/ExpenseContext';
import { getStarredUsers, starUser, unstarUser, isUserStarred } from '../../services/friendService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';

const searchClient = algoliasearch('I0T07P5NB6', 'adfc79b41b2490c5c685b1adebac864c');

const MemoizedFriendItem = React.memo(({ item, isSelected, onToggleSelect, isStarred, onToggleStar }) => {
  const name = (item.fullName || `${item.firstName || ''} ${item.lastName || ''}`).trim() || 'Unknown';
  const userId = item.objectID || item.id;
  
  const handleStarPress = (e) => {
    e.stopPropagation();
    if (onToggleStar) {
      onToggleStar();
    }
  };

  const handleAddPress = (e) => {
    e.stopPropagation();
    if (userId) {
      onToggleSelect({ id: userId, name, username: item.username, profilePhoto: item.profilePhoto });
    }
  };
  
  const handleItemPress = () => {
    if (userId) {
      onToggleSelect({ id: userId, name, username: item.username, profilePhoto: item.profilePhoto });
    }
  };
  
  return (
    <TouchableOpacity style={styles.listItem} onPress={handleItemPress}>
      <View style={styles.avatarContainer}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto }} style={styles.avatar} contentFit="cover" transition={200} />
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
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.starButton}
          onPress={handleStarPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name={isStarred ? "star" : "star-outline"} 
            size={20} 
            color={isStarred ? Colors.brand : Colors.textSecondary} 
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.addButton, isSelected && styles.addButtonSelected]} 
          onPress={handleAddPress}
        >
          {isSelected ? (
            <Ionicons name="checkmark" size={16} color={Colors.white} />
          ) : (
            <Text style={styles.addButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
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
          <Image source={{ uri: item.image.uri }} style={styles.avatar} contentFit="cover" transition={200} />
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
          <Image source={{ uri: item.profilePhoto }} style={styles.avatar} contentFit="cover" transition={200} />
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
        <Image source={{ uri: item.profilePhoto }} style={styles.memberAvatar} contentFit="cover" transition={200} />
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
    {item.username && (
      <Text style={styles.memberUsername} numberOfLines={1}>
        @{item.username}
      </Text>
    )}
  </View>
));

const SearchPane = React.memo(({ 
  debouncedQuery, 
  selectedFriends, 
  toggleSelectUser, 
  inviteContact, 
  handleSMSInvite,
  invitedContacts,
  filteredInvitedContacts,
  starredUsers,
  starredUserIds,
  onToggleStar
}) => {
  const { hits } = useInfiniteHits();
  const { refine } = useSearchBox();
  
  const debouncedRefine = useRef(null);
  
  useEffect(() => {
    // Only search if there's a query
    if (!debouncedQuery || debouncedQuery.trim().length === 0) {
      return;
    }
    
    if (debouncedRefine.current) {
      clearTimeout(debouncedRefine.current);
    }
    
    debouncedRefine.current = setTimeout(() => {
      refine(debouncedQuery.trim());
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

  // Filter out starred users from search results (they show in Recommended)
  // Limit to 5 results
  const searchHits = useMemo(() => {
    return filteredHits
      .filter(hit => {
        const userId = hit.objectID || hit.id;
        return !starredUserIds.includes(userId);
      })
      .slice(0, 5);
  }, [filteredHits, starredUserIds]);

  const renderFriendItem = useCallback(({ item }) => {
    const userId = item.objectID || item.id;
    const isSelected = selectedFriends.some(f => f.id === userId);
    const isStarred = starredUserIds.includes(userId);
    const handleStarToggle = () => {
      onToggleStar(userId, {
        firstName: item.firstName,
        lastName: item.lastName,
        fullName: item.fullName,
        username: item.username,
        profilePhoto: item.profilePhoto,
      });
    };
    return (
      <MemoizedFriendItem 
        item={item} 
        isSelected={isSelected} 
        onToggleSelect={toggleSelectUser}
        isStarred={isStarred}
        onToggleStar={handleStarToggle}
      />
    );
  }, [selectedFriends, toggleSelectUser, starredUserIds, onToggleStar]);

  const renderInvitedContact = useCallback(({ item }) => (
    <MemoizedInvitedContactItem item={item} onSMSInvite={handleSMSInvite} />
  ), [handleSMSInvite]);

  const renderStarredFriendItem = useCallback(({ item }) => {
    const userId = item.objectID || item.id;
    const isSelected = selectedFriends.some(f => f.id === userId);
    const isStarred = true; // Always starred in this section
    const handleStarToggle = () => {
      onToggleStar(userId, {
        firstName: item.firstName,
        lastName: item.lastName,
        fullName: item.fullName,
        username: item.username,
        profilePhoto: item.profilePhoto,
      });
    };
    return (
      <MemoizedFriendItem 
        item={item} 
        isSelected={isSelected} 
        onToggleSelect={toggleSelectUser}
        isStarred={isStarred}
        onToggleStar={handleStarToggle}
      />
    );
  }, [selectedFriends, toggleSelectUser, onToggleStar]);

  const hasQuery = (debouncedQuery || '').trim().length > 0;

  return (
    <View style={styles.searchContent}>
      {/* Search results - show only when there's a query and results */}
      {hasQuery && searchHits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {searchHits.map((friend, index) => (
            <View key={friend.objectID || `friend-${index}`}>
              {renderFriendItem({ item: friend })}
            </View>
          ))}
        </View>
      )}

      {/* Recommended section - always show starred users */}
      {starredUsers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended</Text>
          {starredUsers.map((friend, index) => (
            <View key={friend.objectID || friend.id || `starred-${index}`}>
              {renderStarredFriendItem({ item: friend })}
            </View>
          ))}
        </View>
      )}

      {/* Invited contacts */}
      {filteredInvitedContacts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invited</Text>
          {filteredInvitedContacts.map((contact, index) => (
            <View key={contact.id || `invited-contact-${index}`}>
              <MemoizedInvitedContactItem 
                item={contact} 
                onSMSInvite={handleSMSInvite}
              />
            </View>
          ))}
        </View>
      )}

      {/* Empty state when no query, no recommended, and no invited contacts */}
      {!hasQuery && starredUsers.length === 0 && filteredInvitedContacts.length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="star-outline" size={48} color={Colors.textSecondary} style={styles.emptyStateIcon} />
          <Text style={styles.emptyStateTitle}>No recommended people</Text>
          <Text style={styles.emptyStateText}>Search for people and star them to add them to your recommended list</Text>
        </View>
      )}

      {/* Empty search state when query exists but no results */}
      {hasQuery && searchHits.length === 0 && (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="search-outline" size={48} color={Colors.textSecondary} style={styles.emptyStateIcon} />
          <Text style={styles.emptyStateTitle}>No results found</Text>
          <Text style={styles.emptyStateText}>Try searching with a different name or username</Text>
        </View>
      )}
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
        autoCorrect={false}
        keyboardType="default"
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
        hitsPerPage={5} 
        attributesToRetrieve={[ 'objectID','firstName','lastName','username','profilePhoto','fullName' ]} 
      />
      <SearchPane {...searchPaneProps} />
    </InstantSearch>
  </View>
));

const GroupMembersModal = ({ 
  visible, 
  onClose, 
  expenseId = null 
}) => {
  const { state, actions } = useExpense();
  const { selectedFriends } = state;
  const insets = useSafeAreaInsets();


  const [localQuery, setLocalQuery] = useState('');
  const [invitedContacts, setInvitedContacts] = useState([]);
  const [starredUsers, setStarredUsers] = useState([]);
  const [starredUserIds, setStarredUserIds] = useState([]);
  const [loadingStarred, setLoadingStarred] = useState(false);
  
  const deferredQuery = useDeferredValue(localQuery);

  const loadStarredUsers = useCallback(async () => {
    try {
      setLoadingStarred(true);
      const currentUser = getCurrentUser();
      if (!currentUser) {
        return;
      }
      
      const starred = await getStarredUsers(currentUser.uid);
      setStarredUsers(starred);
      setStarredUserIds(starred.map(user => user.objectID || user.id));
    } catch (error) {
      console.error('Error loading starred users:', error);
    } finally {
      setLoadingStarred(false);
    }
  }, []);

  // Auto-star contacts that have accounts when permission is first granted
  const autoStarContactsFromPhone = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      // Check if we've already done this auto-star
      const hasAutoStarred = await AsyncStorage.getItem(`auto_starred_contacts_${currentUser.uid}`);
      if (hasAutoStarred === 'true') {
        return; // Already done
      }

      // Check contacts permission
      const { status: existingStatus } = await Contacts.getPermissionsAsync();
      if (existingStatus !== 'granted') {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') return;
      }

      // Get contacts
      const { data: contactsData } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
        ],
      });

      if (!contactsData || contactsData.length === 0) {
        // Mark as done even if no contacts
        await AsyncStorage.setItem(`auto_starred_contacts_${currentUser.uid}`, 'true');
        return;
      }

      // Extract and format phone numbers
      const phoneNumbers = contactsData
        .map(contact => contact.phoneNumbers?.[0]?.number)
        .filter(Boolean)
        .map(phone => formatPhoneNumber(phone));

      if (phoneNumbers.length === 0) {
        await AsyncStorage.setItem(`auto_starred_contacts_${currentUser.uid}`, 'true');
        return;
      }

      // Get current starred users to avoid duplicates
      const currentStarred = await getStarredUsers(currentUser.uid);
      const currentStarredIds = new Set(currentStarred.map(u => u.objectID || u.id));

      // Query users by phone numbers (Firestore 'in' query limit is 10, so we need to batch)
      const firestoreInstance = getFirestore(getApp());
      const usersRef = collection(firestoreInstance, 'users');
      const batchSize = 10;
      const usersToStar = [];

      for (let i = 0; i < phoneNumbers.length; i += batchSize) {
        const batch = phoneNumbers.slice(i, i + batchSize);
        
        try {
          const q = query(usersRef, where('phoneNumber', 'in', batch));
          const querySnapshot = await getDocs(q);
          
          querySnapshot.forEach((doc) => {
            const userId = doc.id;
            
            // Skip current user and already starred users
            if (userId === currentUser.uid || currentStarredIds.has(userId)) {
              return;
            }
            
            usersToStar.push(userId);
          });
        } catch (error) {
          console.error('Error querying users by phone:', error);
        }
      }

      // Star all matched users
      if (usersToStar.length > 0) {
        const firestoreInstance = getFirestore(getApp());
        const userDocRef = doc(firestoreInstance, 'users', currentUser.uid);
        
        // Get current starredUsers array
        const userDocSnap = await getDoc(userDocRef);
        const currentStarredUsers = userDocSnap.data()?.starredUsers || [];
        
        // Combine and deduplicate
        const newStarredUsers = [...new Set([...currentStarredUsers, ...usersToStar])];
        
        await updateDoc(userDocRef, {
          starredUsers: newStarredUsers
        });

        // Reload starred users to update UI
        await loadStarredUsers();
      }

      // Mark as done
      await AsyncStorage.setItem(`auto_starred_contacts_${currentUser.uid}`, 'true');
    } catch (error) {
      console.error('Error auto-starring contacts:', error);
    }
  }, [loadStarredUsers]);

  // Load starred users when modal opens
  useEffect(() => {
    if (visible) {
      loadStarredUsers();
      autoStarContactsFromPhone();
    }
  }, [visible, loadStarredUsers, autoStarContactsFromPhone]);

  const handleToggleStar = useCallback(async (userId, userData = null) => {
    try {
      const isCurrentlyStarred = starredUserIds.includes(userId);
      
      if (isCurrentlyStarred) {
        await unstarUser(userId);
        // Remove from local state immediately
        setStarredUsers(prev => prev.filter(user => (user.objectID || user.id) !== userId));
        setStarredUserIds(prev => prev.filter(id => id !== userId));
      } else {
        await starUser(userId);
        // If we have user data from search, add it immediately for better UX
        if (userData) {
          const newStarredUser = {
            id: userId,
            objectID: userId,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            fullName: userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
            username: userData.username || '',
            profilePhoto: userData.profilePhoto || null,
          };
          setStarredUsers(prev => {
            // Check if already exists to avoid duplicates
            if (prev.some(u => (u.objectID || u.id) === userId)) {
              return prev;
            }
            return [...prev, newStarredUser];
          });
          setStarredUserIds(prev => {
            if (prev.includes(userId)) {
              return prev;
            }
            return [...prev, userId];
          });
        }
        // Reload starred users in background to ensure we have latest data
        loadStarredUsers().catch(err => console.error('Error reloading starred users:', err));
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update star status.');
      // Revert optimistic update on error
      if (!isCurrentlyStarred) {
        loadStarredUsers();
      }
    }
  }, [starredUserIds, loadStarredUsers]);

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
      id: currentUser?.uid || 'current-user',
      name: currentUser?.fullName || currentUser?.firstName || 'Unknown User',
      username: currentUser?.username,
      profilePhoto: currentUser?.profilePhoto,
      isCurrentUser: true
    };
  }, []);

  const allMembers = useMemo(() => [currentUserData, ...selectedFriends], [currentUserData, selectedFriends]);

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

  const handleDone = useCallback(async () => {
    try {
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
      Alert.alert('Error', 'Could not save group members.');
    } finally {
      onClose();
    }
  }, [expenseId, allMembers, onClose]);

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
          {Platform.OS === 'android' && <View style={styles.modalHandle} />}
          <View style={styles.headerRow}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.checkButton}
              onPress={handleDone}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={24} color={Colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.membersContainer}>
            {selectedFriends.length > 0 ? (
              <FlatList
                data={selectedFriends}
                horizontal
                keyExtractor={(item) => item.id}
                renderItem={renderMemberItem}
                contentContainerStyle={styles.membersList}
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyMembersPlaceholder}>
                <Text style={styles.emptyMembersText}>No group members yet</Text>
                <Text style={styles.emptyMembersSubtext}>Add friends below to create your group</Text>
              </View>
            )}
          </View>

          <MemoizedSearchInput value={localQuery} onChangeText={setLocalQuery} />

          <MemoizedSearchResults 
            searchPaneProps={{
              debouncedQuery: deferredQuery,
              selectedFriends,
              toggleSelectUser,
              inviteContact,
              handleSMSInvite,
              invitedContacts,
              filteredInvitedContacts,
              starredUsers,
              starredUserIds,
              onToggleStar: handleToggleStar
            }} 
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  modalHeader: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: Spacing.xs,
  },
  checkButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.xs,
  },
  membersContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  membersList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
  },
  emptyMembersPlaceholder: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  emptyMembersText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptyMembersSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
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
  },
  memberAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
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
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textSecondary,
    fontFamily: Typography.familySemiBold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonSelected: {
    backgroundColor: Colors.success,
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
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyStateContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyStateIcon: {
    marginBottom: Spacing.md,
    opacity: 0.5,
  },
  emptyStateTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },
});

export default GroupMembersModal;
