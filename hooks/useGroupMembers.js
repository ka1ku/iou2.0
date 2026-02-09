import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { Alert } from 'react-native';
import { getCurrentUser } from '../services/authService';
import { updateExpenseParticipants, sendExpenseInviteSMS } from '../services/expenseService';
import { getStarredUsers, starUser, unstarUser } from '../services/friendService';
import { useExpense } from '../contexts/ExpenseContext';
import { useRecentCoParticipants } from './useRecentCoParticipants';
import { useContactSearch } from './useContactSearch';

export const useGroupMembers = ({ visible, expenseId, onClose }) => {
  const { state, actions } = useExpense();
  const { selectedFriends } = state;

  const [localQuery, setLocalQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);
  
  const [invitedContacts, setInvitedContacts] = useState([]);
  const [starredUsers, setStarredUsers] = useState([]);
  const [starredUserIds, setStarredUserIds] = useState([]);
  const [loadingStarred, setLoadingStarred] = useState(false);

  // Debounce logic
  useEffect(() => {
    setIsDebouncing(true);
    const handler = setTimeout(() => {
      setDebouncedQuery(localQuery);
      setIsDebouncing(false);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [localQuery]);

  const { recentUsers, loadingRecent } = useRecentCoParticipants(visible);
  const { searchContacts, loadingContacts } = useContactSearch(visible);

  // Compute overall loading state
  const isLoading = loadingStarred || loadingRecent || loadingContacts;

  // --- Starred users ---
  const loadStarredUsers = useCallback(async () => {
    try {
      setLoadingStarred(true);
      const currentUser = getCurrentUser();
      if (!currentUser) return;

      const starred = await getStarredUsers(currentUser.uid);
      setStarredUsers(starred);
      setStarredUserIds(starred.map((user) => user.objectID || user.id));
    } catch (error) {
      console.error('Error loading starred users:', error);
    } finally {
      setLoadingStarred(false);
    }
  }, []);


  useEffect(() => {
    if (visible) {
      loadStarredUsers();
    }
  }, [visible, loadStarredUsers]);

  // --- Recommended: starred + recent co-participants (flat list) ---
  const recommendedUsers = useMemo(() => {
    const starredIds = new Set(starredUserIds);
    const starred = starredUsers.map((u) => ({ ...u, _isStarred: true }));
    const recent = recentUsers
      .filter((u) => !starredIds.has(u.id))
      .map((u) => ({ ...u, _isStarred: false }));
    return [...starred, ...recent];
  }, [starredUsers, starredUserIds, recentUsers]);

  // --- Contact search results ---
  const contactResults = useMemo(() => {
    const q = (debouncedQuery || '').trim();
    if (q.length === 0) return [];
    return searchContacts(q);
  }, [debouncedQuery, searchContacts]);

  // --- Star toggle (optimistic) ---
  const handleToggleStar = useCallback(
    (userId, userData = null) => {
      const isCurrentlyStarred = starredUserIds.includes(userId);

      if (isCurrentlyStarred) {
        // Optimistic removal
        setStarredUsers((prev) => prev.filter((user) => (user.objectID || user.id) !== userId));
        setStarredUserIds((prev) => prev.filter((id) => id !== userId));

        unstarUser(userId).catch(() => {
          Alert.alert('Error', 'Could not update star status.');
          loadStarredUsers();
        });
      } else {
        // Optimistic addition
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
          setStarredUsers((prev) => {
            if (prev.some((u) => (u.objectID || u.id) === userId)) return prev;
            return [...prev, newStarredUser];
          });
          setStarredUserIds((prev) => {
            if (prev.includes(userId)) return prev;
            return [...prev, userId];
          });
        }

        starUser(userId).catch(() => {
          Alert.alert('Error', 'Could not update star status.');
          loadStarredUsers();
        });
      }
    },
    [starredUserIds, loadStarredUsers]
  );

  // --- Select / Remove ---
  const toggleSelectUser = useCallback(
    (user) => {
      const isSelected = selectedFriends.some((f) => f.id === user.id);
      if (isSelected) {
        if (friendsOnItems.has(user.id)) {
          Alert.alert(
            'Cannot remove',
            'This person is assigned to one or more items. Remove them from all items first.'
          );
          return;
        }
        actions.setSelectedFriends(selectedFriends.filter((f) => f.id !== user.id));
      } else {
        actions.setSelectedFriends([...selectedFriends, user]);
      }
    },
    [selectedFriends, actions, friendsOnItems]
  );

  const removeFriend = useCallback(
    (friendId) => {
      if (friendsOnItems.has(friendId)) {
        Alert.alert(
          'Cannot remove',
          'This person is assigned to one or more items. Remove them from all items first.'
        );
        return;
      }
      actions.setSelectedFriends(selectedFriends.filter((f) => f.id !== friendId));
    },
    [selectedFriends, actions, friendsOnItems]
  );

  // --- Invite ---
  const handleSMSInvite = useCallback(
    (contact) => {
      const rawPhone = contact.phoneNumbers?.[0]?.number || contact.phoneNumber;
      const contactName =
        contact.firstName && contact.lastName
          ? `${contact.firstName} ${contact.lastName}`
          : contact.name || 'Unknown';
      sendExpenseInviteSMS({ expenseId, phoneNumber: rawPhone, contactName, preferUniversal: false }).catch(() => {
        Alert.alert('Invite failed', 'Could not open Messages.');
      });
    },
    [expenseId]
  );

  const inviteContact = useCallback(
    async (contact) => {
      const isAlreadyAdded = selectedFriends.some(
        (friend) =>
          friend.phoneNumber === contact.phoneNumbers?.[0]?.number ||
          friend.name.toLowerCase() ===
            (contact.firstName && contact.lastName
              ? `${contact.firstName} ${contact.lastName}`
              : contact.name || ''
            ).toLowerCase()
      );
      if (isAlreadyAdded) return;

      const name =
        contact.firstName && contact.lastName
          ? `${contact.firstName} ${contact.lastName}`
          : contact.name || 'Unknown';

      const invitedContact = {
        id: `invited-${Date.now()}-${Math.random()}`,
        name,
        phoneNumber: contact.phoneNumbers?.[0]?.number,
        profilePhoto: contact.imageAvailable && contact.image?.uri ? contact.image.uri : null,
        isInvited: true,
        invitedAt: new Date().toISOString(),
      };

      setInvitedContacts((prev) => {
        const alreadyInvited = prev.some(
          (ic) =>
            ic.phoneNumber === invitedContact.phoneNumber ||
            ic.name.toLowerCase() === invitedContact.name.toLowerCase()
        );
        if (alreadyInvited) return prev;
        return [...prev, invitedContact];
      });

      handleSMSInvite({
        ...contact,
        phoneNumbers: [{ number: (contact.phoneNumbers?.[0]?.number || '').replace(/\D/g, '') }],
      });
    },
    [selectedFriends, handleSMSInvite]
  );

  // --- Filtered invited contacts ---
  const filteredInvitedContacts = useMemo(() => {
    const q = (debouncedQuery || '').trim().toLowerCase();
    if (q.length === 0) return invitedContacts;
    return invitedContacts.filter((ic) => {
      const name = ic.name.toLowerCase();
      const phone = (ic.phoneNumber || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [invitedContacts, debouncedQuery]);

  // --- Current user + all members ---
  const currentUserData = useMemo(() => {
    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.uid;

    // Try to find "Me" in the existing participants list from context
    // This ensures we use the most up-to-date profile data (name, photo) 
    // rather than potentially stale auth data
    const meParticipant = state.participants?.find(
      (p) => p.id === 'me-participant' || p.userId === currentUserId
    );

    if (meParticipant) {
      return {
        ...meParticipant,
        isCurrentUser: true,
        // Ensure name isn't empty
        name: meParticipant.name || currentUser?.displayName || 'Me',
      };
    }

    return {
      id: currentUserId || 'current-user',
      name: currentUser?.fullName || currentUser?.firstName || 'Unknown User',
      username: currentUser?.username,
      profilePhoto: currentUser?.profilePhoto,
      isCurrentUser: true,
    };
  }, [state.participants]);

  const allMembers = useMemo(() => [currentUserData, ...selectedFriends], [currentUserData, selectedFriends]);

  // --- Friends referenced by items (non-removable) ---
  const friendsOnItems = useMemo(() => {
    const items = state.items || [];
    // Collect all participant indices used across items
    const usedIndices = new Set();
    items.forEach((item) => {
      (item.selectedConsumers || []).forEach((idx) => usedIndices.add(idx));
      (item.selectedPayers || []).forEach((idx) => usedIndices.add(idx));
    });
    // Map participant indices > 0 back to friend IDs
    // participants = [currentUser, ...selectedFriends], so friend i = participant i+1
    const ids = new Set();
    selectedFriends.forEach((friend, i) => {
      if (usedIndices.has(i + 1)) {
        ids.add(friend.id);
      }
    });
    return ids;
  }, [state.items, selectedFriends]);

  // --- Done handler ---
  const handleDone = useCallback(async () => {
    try {
      const authUser = getCurrentUser();
      if (expenseId && authUser?.uid) {
        const participantsToSave = allMembers.map((member) => {
          if (member.isCurrentUser) {
            return {
              name: member.name,
              userId: authUser.uid,
              profilePhoto: member.profilePhoto || authUser.profilePhoto || null,
              username: member.username || authUser.username || null,
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

  return {
    // State
    localQuery,
    setLocalQuery,
    debouncedQuery,
    selectedFriends,
    starredUsers,
    starredUserIds,
    recommendedUsers,
    contactResults,
    invitedContacts,
    filteredInvitedContacts,
    allMembers,
    friendsOnItems,
    loadingStarred,
    loadingRecent,
    loadingContacts,
    isLoading,
    isDebouncing,

    // Actions
    toggleSelectUser,
    removeFriend,
    handleToggleStar,
    inviteContact,
    handleSMSInvite,
    handleDone,
  };
};
