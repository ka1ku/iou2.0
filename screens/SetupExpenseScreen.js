import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';
import { createExpense } from '../services/expenseService';
import { 
  ExpenseHeader,
  ParticipantsGrid,
  FriendSelector
} from '../components';

const SetupExpenseScreen = ({ route, navigation }) => {
  const { expenseType = 'expense', scannedReceipt, fromReceiptScan } = route.params || {};
  const insets = useSafeAreaInsets();
  const currentUserId = getCurrentUser()?.uid;

  const createMeParticipant = useCallback(() => ({
    name: 'Me',
    id: 'me-participant',
    userId: currentUserId,
    placeholder: false,
    phoneNumber: null,
    username: null,
    profilePhoto: null
  }), [currentUserId]);

  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState([createMeParticipant()]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [titleInputFocused, setTitleInputFocused] = useState(false);
  const friendSelectorRef = useRef(null);

  // Set title from scanned receipt if available
  useEffect(() => {
    if (scannedReceipt?.title) {
      setTitle(scannedReceipt.title);
    }
  }, [scannedReceipt]);

  // Initialize "Me" participant with current user's profile data
  useEffect(() => {
    const initializeMeParticipant = async () => {
      try {
        const currentUser = getCurrentUser();
        if (currentUser) {
          const userProfile = await getUserProfile(currentUser.uid);
          if (userProfile) {
            setParticipants(prev => {
              const updated = [...prev];
              if (updated.length > 0 && updated[0].name === 'Me') {
                updated[0] = {
                  ...updated[0],
                  name: 'Me',
                  userId: currentUser.uid,
                  placeholder: false,
                  phoneNumber: userProfile.phoneNumber,
                  username: userProfile.username,
                  profilePhoto: userProfile.profilePhoto
                };
              }
              return updated;
            });
          }
        }
      } catch (error) {
        console.error('Error initializing user participant:', error);
      }
    };

    initializeMeParticipant();
  }, []);

  // Handle scanned receipt data
  useEffect(() => {
    if (scannedReceipt && fromReceiptScan) {
      if (scannedReceipt.participants && scannedReceipt.participants.length > 0) {
        setParticipants(scannedReceipt.participants);
      }
    }
  }, [scannedReceipt, fromReceiptScan]);

  // Update participants when friends are selected
  useEffect(() => {
    const meParticipant = participants.find(p => p.name === 'Me');
    const allParticipants = [
      meParticipant || createMeParticipant(),
      ...selectedFriends.map((friend, index) => ({ 
        name: friend.name || '', 
        id: `friend-${friend.id || index}`,
        userId: friend.id || null,
        phoneNumber: friend.phoneNumber || null,
        username: friend.username || null,
        profilePhoto: friend.profilePhoto || null,
        placeholder: false
      }))
    ];
    
    // Only update if participants actually changed
    const participantsChanged = JSON.stringify(allParticipants) !== JSON.stringify(participants);
    if (participantsChanged) {
      setParticipants(allParticipants);
      setHasUnsavedChanges(true);
    }
  }, [selectedFriends, createMeParticipant]);
  // Track changes for navigation warning
  useEffect(() => {
    if (title.trim() !== '') {
      setHasUnsavedChanges(true);
    }
  }, [title]);

  // Navigation warning
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (!hasUnsavedChanges || loading) {
          return;
        }

        e.preventDefault();
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes. Are you sure you want to leave?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => navigation.dispatch(e.data.action),
            },
          ]
        );
      });

      return unsubscribe;
    }, [navigation, hasUnsavedChanges, loading])
  );

  useEffect(() => {
    navigation.setOptions({
      title: expenseType === 'receipt' ? 'Setup Receipt' : 'Setup Expense',
      tabBarStyle: { display: 'none' },
    });
  }, [expenseType, navigation]);

  const handleCreateExpense = async () => {
    const finalTitle = title.trim();
    
    if (!finalTitle) {
      Alert.alert('Error', 'Please enter a title for this ' + expenseType);
      return;
    }

    if (participants.some(p => !p.name.trim())) {
      Alert.alert('Error', 'Please enter names for all participants');
      return;
    }

    setLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) throw new Error('No user signed in');

      const userProfile = await getUserProfile(currentUser.uid);
      if (!userProfile) throw new Error('Failed to get user profile');

      const mappedParticipants = participants.map((p) => {
        if (p.name === 'Me') {
          return {
            ...p,
            name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
            userId: p.userId || currentUser.uid,
            placeholder: false,
            phoneNumber: userProfile.phoneNumber,
            username: userProfile.username,
            profilePhoto: userProfile.profilePhoto
          };
        }
        return {
          ...p,
          name: p.name.trim(),
          userId: p.userId || null,
          placeholder: p.placeholder || false,
          phoneNumber: p.phoneNumber || null,
          username: p.username || null,
          profilePhoto: p.profilePhoto || null
        };
      });

      // Create basic expense/receipt structure
      const expenseData = {
        title: finalTitle,
        total: 0, // Will be updated when items are added
        expenseType: expenseType,
        participants: mappedParticipants,
        items: [{
          id: Date.now().toString(),
          name: '',
          amount: 0,
          selectedConsumers: [0],
          splits: [],
          selectedPayers: [0]
        }],
        fees: [],
        selectedPayers: [0], // Default to first participant (Me)
        join: { enabled: true },
        isSetupComplete: false // Flag to indicate this needs further editing
      };

      // Create the expense in Firestore
      const createdExpense = await createExpense(expenseData, currentUser.uid);
      
      // Navigate to the appropriate detail screen with the created expense
      if (expenseType === 'receipt') {
        navigation.replace('AddReceipt', { 
          expense: createdExpense,
          isNewExpense: true, // Flag to indicate this is a new expense creation
          ...(scannedReceipt && fromReceiptScan ? { scannedReceipt, fromReceiptScan } : {})
        });
      } else {
        navigation.replace('AddExpense', { 
          expense: createdExpense,
          isNewExpense: true // Flag to indicate this is a new expense creation
        });
      }

    } catch (error) {
      console.error('Error creating basic expense:', error);
      Alert.alert('Error', 'Failed to create ' + expenseType + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* <ExpenseHeader
        title={expenseType === 'receipt' ? 'Setup Receipt' : 'Setup Expense'}
        onBackPress={() => navigation.goBack()}
        hideSettings={true}
      /> */}
        
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: insets.top,
            paddingBottom: 140,
            paddingHorizontal: 0
          }}
        >
          {/* Main Content */}
          <View style={styles.mainContent}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.mainTitle}>
                What would you like to call this {expenseType}?
              </Text>
              <TextInput
                style={[
                  styles.titleInput,
                  titleInputFocused && styles.titleInputFocused
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder={`Enter ${expenseType} name...`}
                placeholderTextColor={Colors.textSecondary}
                autoFocus={!scannedReceipt}
                returnKeyType="next"
                onFocus={() => setTitleInputFocused(true)}
                onBlur={() => setTitleInputFocused(false)}
              />
            </View>

            {/* Participants Section */}
            <View style={styles.participantsSection}>
              <Text style={styles.sectionTitle}>Who's splitting this?</Text>
              
              {/* Current Participants */}
              <View style={styles.participantsContainer}>
                <View style={styles.participantsList}>
                  {/* Add People Button - First Item */}
                  <TouchableOpacity 
                    style={styles.addPersonButton}
                    onPress={() => friendSelectorRef.current?.openModal()}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addPersonIcon}>
                      <Ionicons name="add" size={28} color={Colors.accent} />
                    </View>
                    <Text style={styles.addPersonText} numberOfLines={1}>Add people</Text>
                  </TouchableOpacity>

                  {participants.map((participant, index) => (
                    <View key={participant.id} style={styles.participantItem}>
                      <View style={styles.participantAvatar}>
                        {participant.profilePhoto ? (
                          <Image 
                            source={{ uri: participant.profilePhoto }} 
                            style={styles.participantImage}
                          />
                        ) : (
                          <View style={[
                            styles.participantPlaceholder,
                            participant.name === 'Me' && styles.currentUserPlaceholder
                          ]}>
                            <Text style={[
                              styles.participantInitials,
                              participant.name === 'Me' && styles.currentUserInitials
                            ]}>
                              {participant.name === 'Me' ? 'M' : (participant.name[0] || 'U').toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {/* {participant.name === 'Me' && (
                          <View style={styles.currentUserBadge}>
                            <Text style={styles.currentUserBadgeText}>You</Text>
                          </View>
                        )} */}
                      </View>
                      <Text style={styles.participantName} numberOfLines={1}>
                        {participant.name === 'Me' ? 'You' : participant.name}
                      </Text>
                      {participant.username && (
                        <Text style={styles.participantUsername} numberOfLines={1}>@{participant.username}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>

            </View>
          </View>
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.continueButton, 
              (loading || !title.trim()) && styles.continueButtonDisabled
            ]}
            onPress={handleCreateExpense}
            disabled={loading || !title.trim()}
            activeOpacity={0.85}
          >
            <View style={styles.buttonContent}>
              {loading ? (
                <>
                  <View style={styles.loadingSpinner}>
                    <Ionicons name="hourglass" size={20} color={Colors.white} />
                  </View>
                  <Text style={styles.continueButtonText}>Creating...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.continueButtonText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                </>
              )}
            </View>
          </TouchableOpacity>
          
        </View>
      </KeyboardAvoidingView>

      {/* Hidden FriendSelector for modal functionality */}
      <View style={{ position: 'absolute', left: -9999 }}>
        <FriendSelector
          ref={friendSelectorRef}
          selectedFriends={selectedFriends}
          onFriendsChange={setSelectedFriends}
          placeholder="Add friends to split with..."
          expenseId={null}
          showAddButton={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: Spacing.xl,
  },
  titleSection: {
    marginBottom: Spacing.xxl,
  },
  mainTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.xl,
    lineHeight: 36,
  },
  titleInput: {
    ...Typography.h3,
    color: Colors.textPrimary,
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: Colors.divider,
    paddingVertical: Spacing.lg,
    paddingHorizontal: 0,
    fontSize: 24,
    fontWeight: '600',
  },
  titleInputFocused: {
    borderBottomColor: Colors.accent,
  },
  participantsSection: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xl,
  },
  participantsContainer: {
    width: '100%',
  },
  participantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
  },
  participantItem: {
    alignItems: 'center',
    width: '33.3333%',
    marginBottom: Spacing.xl,
  },
  participantAvatar: {
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  participantImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  participantPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.accent + '30',
    borderWidth: 3,
    borderColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentUserPlaceholder: {
    backgroundColor: Colors.accent,
  },
  participantInitials: {
    ...Typography.title,
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 20,
  },
  currentUserInitials: {
    color: Colors.white,
  },
  currentUserBadge: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    marginLeft: -15,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  currentUserBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 10,
  },
  participantName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
    fontSize: 14,
    lineHeight: 18,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  addPersonButton: {
    alignItems: 'center',
    width: '33.3333%',
    marginBottom: Spacing.xl,
  },
  addPersonIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.accent + '15',
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addPersonText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '500',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
  },
  bottomContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  continueButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accentDark,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 56,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  continueButtonText: {
    ...Typography.title,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  loadingSpinner: {
    transform: [{ rotate: '0deg' }],
  },
});

export default SetupExpenseScreen;
