import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
  Image,
} from 'react-native';
import {
  InstantSearch,
  Configure,
  useSearchBox,
  useInfiniteHits,
} from 'react-instantsearch-core';
import algoliasearch from 'algoliasearch';
import * as Contacts from 'expo-contacts';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';

// Initialize Algolia client
const searchClient = algoliasearch('I0T07P5NB6', 'adfc79b41b2490c5c685b1adebac864c');

// Search Box Component
function SearchBox({ onChange }) {
  const { query, refine } = useSearchBox();
  
  return (
    <View style={styles.searchContainer}>
      <Text style={styles.searchTitle}>Search Users & Contacts</Text>
      <Text style={styles.searchDescription}>
        Search by name, username, phone, or any user information
      </Text>
      
      <TextInput
        style={styles.searchInput}
        placeholder="Search for users or contacts..."
        value={query}
        onChangeText={refine}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

// Hit Component for displaying search results
function Hit({ hit, onUserSelect, contacts }) {
  const getImageUri = () => {
    if (hit.profilePhoto) return hit.profilePhoto;
    const hitName = (hit.fullName || `${hit.firstName || ''} ${hit.lastName || ''}`).trim().toLowerCase();
    if (!hitName) return null;
    const match = contacts?.find((c) => {
      const contactName = (c.firstName && c.lastName)
        ? `${c.firstName} ${c.lastName}`
        : (c.name || '');
      return contactName.trim().toLowerCase() === hitName;
    });
    if (match && match.imageAvailable && match.image?.uri) return match.image.uri;
    return null;
  };
  const imageUri = getImageUri();

  return (
    <TouchableOpacity style={styles.hitContainer} onPress={() => onUserSelect(hit)}>
      <View style={styles.hitAvatar}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.hitInitials}>
            {(hit.firstName?.[0] || '') + (hit.lastName?.[0] || '')}
          </Text>
        )}
      </View>
      <View style={styles.hitInfo}>
        <Text style={styles.hitName}>
          {hit.fullName || `${hit.firstName} ${hit.lastName}`}
        </Text>
        <Text style={styles.hitUsername}>@{hit.username}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Contact Item Component
function ContactItem({ contact, onSelect }) {
  const getContactInitials = (contact) => {
    if (contact.firstName && contact.lastName) {
      return (contact.firstName[0] + contact.lastName[0]).toUpperCase();
    } else if (contact.firstName) {
      return contact.firstName[0].toUpperCase();
    } else if (contact.lastName) {
      return contact.lastName[0].toUpperCase();
    } else if (contact.name) {
      return contact.name[0].toUpperCase();
    }
    return '?';
  };
  const getContactName = (contact) => {
    if (contact.firstName && contact.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    } else if (contact.firstName) {
      return contact.firstName;
    } else if (contact.lastName) {
      return contact.lastName;
    } else if (contact.name) {
      return contact.name;
    }
    return 'Unknown Contact';
  };
  const getContactPhone = (contact) => {
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      return contact.phoneNumbers[0].number;
    }
    return null;
  };

  return (
    <TouchableOpacity style={styles.contactItem} onPress={() => onSelect(contact)}>
      <View style={styles.contactAvatar}>
        {contact.imageAvailable && contact.image?.uri ? (
          <Image source={{ uri: contact.image.uri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.contactInitials}>
            {getContactInitials(contact)}
          </Text>
        )}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{getContactName(contact)}</Text>
        {getContactPhone(contact) && (
          <Text style={styles.contactPhone}>📱 {getContactPhone(contact)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Two-section results: App Users (Algolia) and Contacts
function CombinedResults({ contacts, onContactSelect, onUserSelect }) {
  const { hits: algoliaHits, isLastPage, showMore } = useInfiniteHits();
  const { query } = useSearchBox();

  // Filter contacts locally by query (name or phone)
  const normalized = (s) => (s || '').toString().toLowerCase();
  const q = normalized(query);
  const filteredContacts = q.length === 0
    ? contacts
    : contacts.filter(c => {
        const name = normalized(
          (c.firstName && c.lastName) ? `${c.firstName} ${c.lastName}` : (c.name || '')
        );
        const phone = normalized(c.phoneNumbers?.[0]?.number || '');
        return name.includes(q) || phone.includes(q);
      });

  const sections = [
    { key: 'algolia', title: 'App Users', data: algoliaHits },
    { key: 'contacts', title: 'Contacts', data: filteredContacts },
  ];

  return (
    <View style={styles.resultsContainer}>
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        renderItem={({ item: section }) => (
          <View>
            {/* Section header shown only if section has items or query is empty */}
            {(section.data && section.data.length > 0) || q.length === 0 ? (
              <Text style={styles.resultsTitle}>{section.title}</Text>
            ) : null}

            {section.key === 'algolia' ? (
              <FlatList
                data={section.data}
                keyExtractor={(it) => it.objectID}
                renderItem={({ item }) => <Hit hit={item} onUserSelect={onUserSelect} contacts={contacts} />}
                onEndReached={() => {
                  if (!isLastPage) {
                    showMore();
                  }
                }}
                onEndReachedThreshold={0.5}
                style={styles.resultsList}
              />
            ) : (
              <FlatList
                data={section.data}
                keyExtractor={(c, idx) => `contact-${idx}`}
                renderItem={({ item }) => (
                  <ContactItem contact={item} onSelect={onContactSelect} />
                )}
                style={styles.resultsList}
              />
            )}
          </View>
        )}
      />
    </View>
  );
}

// Filters Component
function Filters({ isModalOpen, onToggleModal, onChange }) {
  // Since accountStatus field doesn't exist, we'll show a simple info message
  return (
    <>
      <TouchableOpacity style={styles.filtersButton} onPress={onToggleModal}>
        <Text style={styles.filtersButtonText}>Search Info</Text>
      </TouchableOpacity>

      <Modal animationType="slide" visible={isModalOpen}>
        <SafeAreaView>
          <View style={styles.modalContainer}>
            <View style={styles.modalTitle}>
              <Text style={styles.modalTitleText}>Search Information</Text>
            </View>
            <View style={styles.modalList}>
              <View style={styles.modalItem}>
                <Text style={styles.modalLabelText}>
                  Search works across multiple sources:
                </Text>
              </View>
              <View style={styles.modalItem}>
                <Text style={styles.modalDetailText}>📱 App Users (Algolia)</Text>
              </View>
              <View style={styles.modalItem}>
                <Text style={styles.modalDetailText}>📞 Phone Contacts</Text>
              </View>
              <View style={styles.modalItem}>
                <Text style={styles.modalDetailText}>🔍 Search by name, phone, username</Text>
              </View>
              <View style={styles.modalItem}>
                <Text style={styles.modalDetailText}>⚡ Real-time results from both sources</Text>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={onToggleModal}
              >
                <Text style={styles.modalButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// Main App Component
export default function AlgoliaSearchDemo() {
  const [contacts, setContacts] = useState([]);
  const [hasContactsPermission, setHasContactsPermission] = useState(false);
  const listRef = useRef(null);

  const scrollToTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Request contacts permission and load contacts
  useEffect(() => {
    requestContactsPermission();
  }, []);

  const requestContactsPermission = async () => {
    try {
      // First check if we already have permission
      const { status: existingStatus } = await Contacts.getPermissionsAsync();
      
      if (existingStatus === 'granted') {
        setHasContactsPermission(true);
        loadContacts();
        return;
      }

      // Request permission if we don't have it
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status === 'granted') {
        setHasContactsPermission(true);
        loadContacts();
      } else {
        console.log('Contacts permission denied');
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
    }
  };

  const loadContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
        ],
      });

      if (data.length > 0) {
        setContacts(data);
        console.log(`Loaded ${data.length} contacts`);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const handleContactSelect = (contact) => {
    const contactName = contact.firstName && contact.lastName 
      ? `${contact.firstName} ${contact.lastName}` 
      : contact.name || 'Unknown Contact';
    
    Alert.alert(
      'Contact Selected',
      `Selected: ${contactName}\nPhone: ${contact.phoneNumbers?.[0]?.number || 'N/A'}`,
      [{ text: 'OK' }]
    );
  };

  const handleUserSelect = (user) => {
    Alert.alert(
      'User Selected',
      `Selected: ${user.fullName || `${user.firstName} ${user.lastName}`}\nUsername: ${user.username}\nPhone: ${user.phoneNumber || 'N/A'}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <InstantSearch 
        searchClient={searchClient} 
        indexName="users"
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <Configure 
          hitsPerPage={10}
          attributesToRetrieve={[
            'objectID',
            'firstName',
            'lastName',
            'username',
            'phoneNumber',
            'venmoUsername',
            'fullName'
          ]}
        />
        
        <SearchBox onChange={scrollToTop} />
        
        {/* Contacts Status and Manual Load Button */}
        <View style={styles.contactsStatusContainer}>
          {!hasContactsPermission ? (
            <TouchableOpacity 
              style={styles.loadContactsButton}
              onPress={requestContactsPermission}
            >
              <Text style={styles.loadContactsButtonText}>
                📞 Load Phone Contacts
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        
        <CombinedResults
          contacts={contacts}
          onContactSelect={handleContactSelect}
          onUserSelect={handleUserSelect}
        />
      </InstantSearch>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  searchTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  searchDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    fontSize: 16,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  filtersButton: {
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    marginBottom: 1,
  },
  filtersButtonText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007AFF',
    fontWeight: '500',
  },
  itemCount: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  itemCountText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  modalContainer: {
    padding: 18,
    backgroundColor: '#ffffff',
    flex: 1,
  },
  modalTitle: {
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitleText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  modalList: {
    flex: 1,
  },
  modalItem: {
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  modalLabelText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  modalItemCount: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalItemCountText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  hitsContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  hitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    padding: 20,
    paddingBottom: 10,
  },
  hitsList: {
    flex: 1,
  },
  hitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  hitAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  hitInitials: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  hitInfo: {
    flex: 1,
  },
  hitName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  hitUsername: {
    ...Typography.body,
    color: Colors.accentDark,
  },
  hitDetail: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  hitSource: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  contactAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
    overflow: 'hidden',
  },
  contactInitials: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    ...Typography.body1,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  contactPhone: {
    ...Typography.body,
    color: Colors.accentDark,
  },
  contactSource: {
    fontSize: 12,
    color: '#8E8E93',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    marginTop: Spacing.sm,
  },
  resultsTitle: {
    ...Typography.title,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  resultsList: {
    flex: 1,
  },
  modalDetailText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  contactsStatusContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  loadContactsButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    alignItems: 'center',
    ...Shadows.button,
  },
  loadContactsButtonText: {
    color: Colors.white,
    ...Typography.label,
  },
  contactsStatusText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 10,
  },
});
