import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { algoliasearch } from 'algoliasearch';
import { Configure, InstantSearch } from 'react-instantsearch-core';
import { Colors, Spacing } from '../../../design/tokens';
import { useGroupMembers } from '../../../hooks/useGroupMembers';
import SelectedMembersStrip from './SelectedMembersStrip';
import SearchInput from './SearchInput';
import UnifiedSearchResults from './UnifiedSearchResults';
import styles from './styles';

const algoliaClient = algoliasearch('I0T07P5NB6', 'adfc79b41b2490c5c685b1adebac864c');

const searchClient = {
  ...algoliaClient,
  search(requests) {
    if (requests.constructor === Array) {
      const newRequests = requests.map((request) => {
        if (request.params) {
          const { params, ...rest } = request;
          return { ...rest, ...params };
        }
        return request;
      });
      return algoliaClient.search({ requests: newRequests });
    }
    return algoliaClient.search(requests);
  },
};

const GroupMembersModal = ({ visible, onClose, expenseId = null }) => {
  const insets = useSafeAreaInsets();

  const {
    localQuery,
    setLocalQuery,
    debouncedQuery,
    selectedFriends,
    starredUsers,
    starredUserIds,
    recommendedUsers,
    contactResults,
    filteredInvitedContacts,
    friendsOnItems,
    loadingStarred,
    loadingRecent,
    loadingContacts,
    isLoading,
    isDebouncing,
    toggleSelectUser,
    removeFriend,
    handleToggleStar,
    inviteContact,
    handleSMSInvite,
    handleDone,
  } = useGroupMembers({ visible, expenseId, onClose });

  const selectedCount = selectedFriends.length;
  const hasSelected = selectedCount > 0;

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
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add People</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
              activeOpacity={0.7}
            >
              <Ionicons
                name="checkmark-circle"
                size={32}
                color={hasSelected ? Colors.accent : Colors.divider}
              />
            </TouchableOpacity>
          </View>
        </View>

        <InstantSearch
          searchClient={searchClient}
          indexName="users"
          stalledSearchDelay={500}
          future={{ preserveSharedStateOnUnmount: true }}
        >
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
            showsVerticalScrollIndicator={false}
          >
            <SelectedMembersStrip
              selectedFriends={selectedFriends}
              onRemove={removeFriend}
              friendsOnItems={friendsOnItems}
            />

            <SearchInput
              value={localQuery}
              onChangeText={setLocalQuery}
              isDebouncing={isDebouncing}
            />

            <View style={styles.resultsContainer}>
              <Configure
                hitsPerPage={4}
                attributesToRetrieve={['objectID', 'firstName', 'lastName', 'username', 'profilePhoto', 'fullName']}
              />
              <UnifiedSearchResults
                debouncedQuery={debouncedQuery}
                selectedFriends={selectedFriends}
                toggleSelectUser={toggleSelectUser}
                inviteContact={inviteContact}
                handleSMSInvite={handleSMSInvite}
                filteredInvitedContacts={filteredInvitedContacts}
                starredUsers={starredUsers}
                starredUserIds={starredUserIds}
                onToggleStar={handleToggleStar}
                recommendedUsers={recommendedUsers}
                contactResults={contactResults}
                isLoading={isLoading}
                loadingStarred={loadingStarred}
                loadingRecent={loadingRecent}
                loadingContacts={loadingContacts}
                isDebouncing={isDebouncing}
              />
            </View>
          </ScrollView>
        </InstantSearch>
      </View>
    </Modal>
  );
};

export default GroupMembersModal;
