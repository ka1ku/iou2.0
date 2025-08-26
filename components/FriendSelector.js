import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/tokens';
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
  onAddPlaceholder
}) => {
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState([]);

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

  const SearchPane = () => {
    const { hits, isLastPage, showMore, isSearching } = useInfiniteHits();
    const { refine } = useSearchBox();
    
    const [localQuery, setLocalQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedQuery(localQuery);
        refine(localQuery);
      }, 300);
      return () => clearTimeout(timer);
    }, [localQuery, refine]);

    const q = (debouncedQuery || '').trim().toLowerCase();

    // Filter contacts by query
    const filteredContacts = contacts.filter(c => {
      if (q.length === 0) return true;
      const name = (c.firstName && c.lastName) ? `${c.firstName} ${c.lastName}` : (c.name || '');
      const phone = (c.phoneNumbers?.[0]?.number || '').toLowerCase();
      return name.toLowerCase().includes(q) || phone.includes(q);
    });

    const renderContact = ({ item }) => {
      const name = (item.firstName && item.lastName)
        ? `${item.firstName} ${item.lastName}`
        : (item.name || 'Unknown Contact');
      
      return (
        <View style={styles.rowCard}>
          <View style={styles.avatar}>
            {item.imageAvailable && item.image?.uri ? (
              <Image source={{ uri: item.image.uri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.placeholderInitials}>{(name[0] || 'U').toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.subtitle}>Phone Contact</Text>
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={() => inviteContact(item)}>
            <Text style={styles.actionButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Ionicons style={styles.searchIcon} name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search friends and contacts..."
              placeholderTextColor={Colors.textSecondary}
              value={localQuery}
              onChangeText={setLocalQuery}
              autoCapitalize="none"
            />
            {isSearching && (
              <View style={styles.loadingIndicator}>
                <View style={styles.loadingDot} />
                <View style={[styles.loadingDot, { animationDelay: '0.1s' }]} />
                <View style={[styles.loadingDot, { animationDelay: '0.2s' }]} />
              </View>
            )}
          </View>
        </View>
        
        <FlatList
          data={[
            { type: 'friends', data: hits, title: 'Friends' },
            { type: 'contacts', data: filteredContacts, title: 'Contacts' }
          ]}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={({ item: section }) => (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              {section.type === 'friends' ? (
                <FlatList
                  data={section.data}
                  keyExtractor={(friend) => friend.objectID}
                  renderItem={({ item }) => {
                    const name = (item.fullName || `${item.firstName || ''} ${item.lastName || ''}`).trim() || 'Unknown';
                    const isSelected = selectedFriends.some(f => f.id === item.objectID);
                    
                    return (
                      <TouchableOpacity style={styles.rowCard} onPress={() => toggleSelectUser({ id: item.objectID, name, username: item.username, profilePhoto: item.profilePhoto })}>
                        <View style={styles.avatar}>
                          {item.profilePhoto ? (
                            <Image source={{ uri: item.profilePhoto }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.initials}>{(name[0] || 'U').toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{name}</Text>
                          {item.username ? <Text style={styles.username}>@{item.username}</Text> : null}
                        </View>
                        <TouchableOpacity 
                          style={[styles.actionButton, isSelected && styles.actionButtonSelected]} 
                          onPress={() => toggleSelectUser({ id: item.objectID, name, username: item.username, profilePhoto: item.profilePhoto })}
                        >
                          {isSelected ? (
                            <Ionicons name="checkmark" size={16} color={Colors.white} />
                          ) : (
                            <Text style={styles.actionButtonText}>Add</Text>
                          )}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  }}
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
          contentContainerStyle={styles.listPad}
          onEndReached={() => {
            if (q.length > 0 && !isLastPage) showMore();
          }}
          onEndReachedThreshold={0.5}
        />
      </View>
    );
  };

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

      {selectedFriends.length > 0 && (
        <View style={styles.selectedFriendsContainer}>
          <Text style={styles.selectedFriendsLabel}>Selected Friends:</Text>
          {selectedFriends.map((friend) => (
            <View key={friend.id} style={styles.selectedFriendChip}>
              <View style={styles.friendAvatar}>
                <ProfilePicture source={friend.profilePhoto || null} size={40} username={friend.name} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedFriendName}>{friend.name}</Text>
                {friend.username && (
                  <Text style={styles.selectedFriendUsername}>@{friend.username}</Text>
                )}
              </View>
              <DeleteButton onPress={() => onFriendsChange(selectedFriends.filter(f => f.id !== friend.id))} size="small" variant="subtle" />
            </View>
          ))}
        </View>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Friends</Text>
            <TouchableOpacity style={styles.doneButton} onPress={() => setShowModal(false)}>
              <Ionicons name="checkmark" size={24} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
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
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  selectButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  
  // Selected friends section
  selectedFriendsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 16,
    marginTop: 16,
  },
  selectedFriendsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  selectedFriendName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  selectedFriendUsername: {
    fontSize: 14,
    color: Colors.accent,
    marginBottom: 4,
  },
  
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  closeButton: {
    padding: 8,
  },
  doneButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  
  // Search
  searchBarWrap: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 36,
    borderWidth: 0.5,
    borderColor: Colors.divider,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  
  // List items
  listPad: {
    paddingHorizontal: 0,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  
  // Avatar
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  initials: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInitials: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Text
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  
  // Buttons
  actionButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  actionButtonSelected: {
    backgroundColor: Colors.success,
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  
  // Loading
  loadingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginHorizontal: 3,
  },
});

export default FriendSelector;
