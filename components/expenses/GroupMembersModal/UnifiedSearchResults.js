import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text } from 'react-native';
import { useInfiniteHits, useSearchBox, useInstantSearch } from 'react-instantsearch-core';
import { getCurrentUser } from '../../../services/authService';
import { normalizePhoneNumber } from '../../../services/contactInviteService';
import UserListItem from './UserListItem';
import ContactListItem from './ContactListItem';
import InvitedContactListItem from './InvitedContactListItem';
import RecommendedSection from './RecommendedSection';
import EmptyState from './EmptyState';
import { SkeletonUserItem } from './SkeletonUserItem';
import styles from './styles';

const UnifiedSearchResults = React.memo(({
  debouncedQuery,
  selectedFriends,
  toggleSelectUser,
  inviteContact,
  handleSMSInvite,
  filteredInvitedContacts,
  starredUsers,
  starredUserIds,
  onToggleStar,
  recommendedUsers,
  contactResults,
  isLoading,
  loadingStarred,
  loadingRecent,
  loadingContacts,
}) => {
  const { hits } = useInfiniteHits();
  const { refine } = useSearchBox();
  const { status } = useInstantSearch();
  const refineRef = useRef(refine);
  refineRef.current = refine;

  // Sync Algolia query with debouncedQuery (already debounced via useDeferredValue)
  useEffect(() => {
    const q = (debouncedQuery || '').trim();
    refineRef.current(q);
  }, [debouncedQuery]);

  const isSearching = status === 'loading' || status === 'stalled';

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.uid;

  // Filter out current user and starred users from Algolia hits, limit to 4
  const algoliaHits = useMemo(() => {
    const filtered = currentUserId
      ? hits.filter((h) => h && h.objectID && h.objectID !== currentUserId)
      : hits;
    return filtered
      .filter((hit) => !starredUserIds.includes(hit.objectID || hit.id))
      .slice(0, 4);
  }, [hits, currentUserId, starredUserIds]);

  // Build a set of Algolia user IDs and phone numbers for deduplication against contacts
  const algoliaUserIds = useMemo(() => {
    const ids = new Set(algoliaHits.map((h) => h.objectID || h.id));
    // Also include starred user IDs so contacts matching them are excluded
    starredUserIds.forEach((id) => ids.add(id));
    return ids;
  }, [algoliaHits, starredUserIds]);

  const algoliaPhoneNumbers = useMemo(() => {
    const phones = new Set();
    algoliaHits.forEach((h) => {
      if (h.phoneNumber) {
        const normalized = normalizePhoneNumber(h.phoneNumber);
        if (normalized) phones.add(normalized);
      }
    });
    // Also include starred users' phone numbers
    starredUsers.forEach((u) => {
      if (u.phoneNumber) {
        const normalized = normalizePhoneNumber(u.phoneNumber);
        if (normalized) phones.add(normalized);
      }
    });
    return phones;
  }, [algoliaHits, starredUsers]);

  // Deduplicate contacts: skip if their linked userId or phone number matches an Algolia hit or starred user
  const dedupedContacts = useMemo(() => {
    return contactResults.filter((c) => {
      const linkedUserId = c.userData?.userId || c.userData?.id;
      if (linkedUserId && algoliaUserIds.has(linkedUserId)) return false;

      const contactPhone = c.phoneNumber || c.phoneNumbers?.[0]?.number;
      if (contactPhone) {
        const normalized = normalizePhoneNumber(contactPhone);
        if (normalized && algoliaPhoneNumbers.has(normalized)) return false;
      }

      return true;
    });
  }, [contactResults, algoliaUserIds, algoliaPhoneNumbers]);

  // Filter starred users locally based on query
  const matchedStarredUsers = useMemo(() => {
    const q = (debouncedQuery || '').trim().toLowerCase();
    if (q.length === 0) return [];

    return starredUsers.filter((user) => {
      const fullName = (user.fullName || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      const firstName = (user.firstName || '').toLowerCase();
      const lastName = (user.lastName || '').toLowerCase();
      
      return fullName.includes(q) || username.includes(q) || firstName.includes(q) || lastName.includes(q);
    }).sort((a, b) => {
        const nameA = (a.fullName || a.firstName || '').toLowerCase();
        const nameB = (b.fullName || b.firstName || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
  }, [starredUsers, debouncedQuery]);

  const hasQuery = (debouncedQuery || '').trim().length > 0;

  // Unified results: merge Starred Matches, Algolia users, and contacts into a single ranked list
  const unifiedResults = useMemo(() => {
    const items = [];

    // 1. Matched Starred Users (Highest Priority)
    matchedStarredUsers.forEach((user, index) => {
      items.push({ 
        type: 'user', 
        key: user.objectID || user.id, 
        sortScore: -100 + index, // Negative score ensures they are at the top
        data: user 
      });
    });

    // 2. Algolia Hits
    algoliaHits.forEach((hit, index) => {
      items.push({ type: 'user', key: hit.objectID || hit.id, sortScore: index, data: hit });
    });

    // 3. Contacts
    dedupedContacts.forEach((contact, index) => {
      items.push({ type: 'contact', key: contact.id || `contact-${index}`, sortScore: 1000 + index, data: contact });
    });

    items.sort((a, b) => a.sortScore - b.sortScore);
    return items.slice(0, 10);
  }, [algoliaHits, dedupedContacts, matchedStarredUsers]);

  const renderAlgoliaItem = useCallback(
    (item) => {
      const userId = item.objectID || item.id;
      const isSelected = selectedFriends.some((f) => f.id === userId);
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
        <UserListItem
          key={userId}
          item={item}
          isSelected={isSelected}
          onToggleSelect={toggleSelectUser}
          isStarred={isStarred}
          onToggleStar={handleStarToggle}
        />
      );
    },
    [selectedFriends, toggleSelectUser, starredUserIds, onToggleStar]
  );

  return (
    <View style={styles.searchContent}>
      {/* Unified search results: Algolia users + phone contacts */}
      {hasQuery && isSearching && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {[1, 2, 3, 4].map((i) => <SkeletonUserItem key={`skeleton-search-${i}`} />)}
        </View>
      )}
      {hasQuery && !isSearching && unifiedResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          {unifiedResults.map((result) =>
            result.type === 'user'
              ? renderAlgoliaItem(result.data)
              : (
                <ContactListItem
                  key={result.key}
                  item={result.data}
                  onInviteContact={inviteContact}
                />
              )
          )}
        </View>
      )}

      {/* Recommended section — only when not searching */}
      {!hasQuery && (
        <RecommendedSection
          recommendedUsers={recommendedUsers}
          selectedFriends={selectedFriends}
          toggleSelectUser={toggleSelectUser}
          onToggleStar={onToggleStar}
          loadingStarred={loadingStarred}
          loadingRecent={loadingRecent}
        />
      )}

      {/* Invited contacts */}
      {filteredInvitedContacts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invited</Text>
          {filteredInvitedContacts.map((contact, index) => (
            <InvitedContactListItem
              key={contact.id || `invited-contact-${index}`}
              item={contact}
              onSMSInvite={handleSMSInvite}
            />
          ))}
        </View>
      )}

      {/* Empty states */}
      {!hasQuery &&
        recommendedUsers.length === 0 &&
        filteredInvitedContacts.length === 0 && (
          <EmptyState
            icon="star-outline"
            title="No recommended people"
            text="Search for people and star them to add them to your recommended list"
          />
        )}

      {hasQuery && !isSearching && unifiedResults.length === 0 && (
        <EmptyState
          icon="search-outline"
          title="No results found"
          text="Try searching with a different name or username"
        />
      )}
    </View>
  );
});

export default UnifiedSearchResults;
