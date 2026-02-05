import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../design/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { sendInviteSMS, trackInvite, normalizePhoneNumber } from '../../services/contactInviteService';

const ContactItem = ({ contact, onInvite, isInvited, isJoined }) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (isInvited || isJoined) return;
    
    setLoading(true);
    try {
      const phoneNumber = contact.phoneNumbers?.[0]?.number;
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const name = contact.name || 'Friend';
      
      const success = await sendInviteSMS(phoneNumber, name);
      
      if (success) {
        // Track the invite in Firestore
        const result = await trackInvite(normalizedPhone, name);
        onInvite(contact.id, result?.unlockedPremium);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.itemContainer}>
      <View style={styles.avatarContainer}>
        {contact.imageAvailable && contact.image ? (
          <Image source={{ uri: contact.image.uri }} style={styles.avatar} />
        ) : (
          <View style={styles.placeholderAvatar}>
            <Text style={styles.initials}>
              {contact.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        {isJoined && (
          <View style={styles.joinedBadge}>
            <Ionicons name="checkmark" size={10} color="white" />
          </View>
        )}
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.phone}>
          {contact.phoneNumbers?.[0]?.number}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.inviteButton,
          isInvited && styles.invitedButton,
          isJoined && styles.joinedButton
        ]}
        onPress={handlePress}
        disabled={isInvited || isJoined || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isInvited ? Colors.textSecondary : "white"} />
        ) : (
          <Text style={[
            styles.inviteText,
            isInvited && styles.invitedText,
            isJoined && styles.joinedText
          ]}>
            {isJoined ? 'Connected' : isInvited ? 'Invited' : 'Invite'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const ContactList = ({ contacts, onInviteSuccess }) => {
  const [search, setSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState(new Set());

  const filteredContacts = useMemo(() => {
    // Flatten the sections for easier searching/display if simple list
    // But we have sections: On App, Suggestions, Others
    const { onApp, suggestions, others } = contacts;
    
    const filterFn = (c) => c.name?.toLowerCase().includes(search.toLowerCase());
    
    return {
      onApp: onApp.filter(filterFn),
      suggestions: suggestions.filter(filterFn),
      others: others.filter(filterFn)
    };
  }, [contacts, search]);

  const handleInvite = (id, premiumUnlocked) => {
    setInvitedIds(prev => new Set(prev).add(id));
    onInviteSuccess(premiumUnlocked);
  };

  const sections = [
    { title: 'Already on IOU', data: filteredContacts.onApp, type: 'joined' },
    { title: 'Suggested Friends', data: filteredContacts.suggestions, type: 'invite' },
    { title: 'All Contacts', data: filteredContacts.others, type: 'invite' }
  ].filter(s => s.data.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.title}
        renderItem={({ item: section }) => (
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map(contact => (
              <ContactItem
                key={contact.id}
                contact={contact}
                onInvite={handleInvite}
                isInvited={invitedIds.has(contact.id)}
                isJoined={section.type === 'joined'}
              />
            ))}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    ...Typography.h4,
    color: Colors.primary,
  },
  joinedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.success,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  phone: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  inviteButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    minWidth: 80,
    alignItems: 'center',
  },
  invitedButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  joinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  inviteText: {
    ...Typography.captionBold,
    color: 'white',
  },
  invitedText: {
    color: Colors.textSecondary,
  },
  joinedText: {
    color: Colors.success,
  }
});

export default ContactList;
