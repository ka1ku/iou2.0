import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  FlatList,
  TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';

import FriendSelector from '../components/FriendSelector';
import DeleteButton from '../components/DeleteButton';
import { ItemHeader, PriceInputSection, SmartSplitSection, SplitTypeSection, WhoConsumedSection, FeeHeader, FeeTypeSection, PercentageSection, FixedAmountSection, TotalFeeSection, CombinedConsumersAndSplitSection } from './AddExpenseScreenItems';
import {
  updateItem,
  updateItemSplit,
  saveExpense,
  renderItem,
  removeParticipant,
  addItem
} from './AddExpenseScreenFunctions';
import useFormChangeTracker from '../hooks/useFormChangeTracker';
import useNavigationWarning from '../hooks/useNavigationWarning';

const AddExpenseScreen = ({ route, navigation }) => {
  const { expense } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState([{ 
    name: 'Me',
    id: 'me-participant', // Use a unique ID for "Me"
    userId: getCurrentUser()?.uid || null, // Use current user's UID
    placeholder: false,
    phoneNumber: null,
    username: null,
    profilePhoto: null
  }]);
  const [selectedFriends, setSelectedFriends] = useState([]);

  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [joinEnabled, setJoinEnabled] = useState(true);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [items, setItems] = useState([{
    id: Date.now().toString(),
    name: '',
    amount: 0,
    selectedConsumers: [0], // Will be updated when participants are loaded
    splits: [],
    selectedPayers: [0] // Default to "Me"
  }]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayers, setSelectedPayers] = useState([0]); // Default to "Me"
  const friendSelectorRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Form change tracking for navigation warning
  const { hasChanges, updateChangeStatus, resetChanges } = useFormChangeTracker(
    isEditing && expense ? {
      title: expense.title || '',
      participants: expense.participants || [],
      items: expense.items || [],
      fees: expense.fees || [],
      selectedPayers: expense.selectedPayers || [0],
      joinEnabled: expense.join?.enabled || true
    } : null,
    isEditing
  );

  // Navigation warning when trying to leave with unsaved changes
  useNavigationWarning(
    hasChanges,
    navigation,
    null,
    'You have unsaved changes to this expense. Are you sure you want to leave?'
  );

  // Calculate total from items and fees
  const calculateTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const feesTotal = fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    return itemsTotal + feesTotal;
  };

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Expense' : 'Add Expense',
      tabBarStyle: { display: 'none' },
    });
  }, [isEditing, navigation]);

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
                  ...updated[0], // Preserve existing ID and structure
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



  // Initialize selectedFriends when editing an existing expense
  useEffect(() => {
    if (expense && isEditing) {
      // Extract friends from existing participants (exclude current user)
      const existingFriends = expense.participants
        .filter(p => p.name !== 'Me' && !p.placeholder && p.userId && p.userId !== getCurrentUser()?.uid)
        .map(p => ({
          id: p.userId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto
        }));
      
      setSelectedFriends(existingFriends);
      setParticipants(prev => [
        { 
          name: 'Me',
          id: 'me-participant', // Use a unique ID for "Me"
          userId: getCurrentUser()?.uid || null, // Use current user's UID
          placeholder: false,
          phoneNumber: null,
          username: null,
          profilePhoto: null
        },
        ...existingFriends.map((friend, index) => ({ 
          name: friend.name || '', 
          id: `friend-${friend.id || index}`, // Ensure unique ID
          userId: friend.id || null,
          phoneNumber: friend.phoneNumber || null,
          username: friend.username || null,
          profilePhoto: friend.profilePhoto || null,
          placeholder: false
        }))
      ]);
      // Set title and other fields from existing expense
      if (expense.title) {
        setTitle(expense.title);
      }
      if (expense.join) {
        setJoinEnabled(expense.join.enabled);
      }
      if (expense.fees) {
        setFees(expense.fees);
      }
      if (expense.items) {
        // Ensure each item has selectedPayers field and selectedConsumers field
        const itemsWithPayers = expense.items.map(item => ({
          ...item,
          selectedPayers: item.selectedPayers || [0], // Default to "Me" if not set
          selectedConsumers: item.selectedConsumers || [0] // Default to "Me" if not set
        }));
        setItems(itemsWithPayers);
      }
      // Set selected payers if available
      if (expense.selectedPayers) {
        setSelectedPayers(expense.selectedPayers);
      }
    }
  }, [expense, isEditing]);

  // Track form changes for navigation warning
  useEffect(() => {
    const currentFormData = {
      title,
      participants: participants.map(p => ({ name: p.name, userId: p.userId, placeholder: p.placeholder })),
      items: items.map(item => ({ name: item.name, amount: item.amount, selectedConsumers: item.selectedConsumers })),
      fees: fees.map(fee => ({ name: fee.name, amount: fee.amount, type: fee.type, percentage: fee.percentage })),
      selectedPayers,
      joinEnabled
    };
    updateChangeStatus(currentFormData);
  }, [title, participants, items, fees, selectedPayers, joinEnabled, updateChangeStatus]);

  // Update participants when friends are selected
  useEffect(() => {
    setParticipants(prevParticipants => {
      const meParticipant = prevParticipants.find(p => p.name === 'Me');
      
      const allParticipants = [
        meParticipant || { 
          name: 'Me',
          id: 'me-participant', // Use a unique ID for "Me"
          userId: getCurrentUser()?.uid || null, // Use current user's UID
          placeholder: false,
          phoneNumber: null,
          username: null,
          profilePhoto: null
        },
        ...selectedFriends.map((friend, index) => ({ 
          name: friend.name || '', 
          id: `friend-${friend.id || index}`, // Ensure unique ID
          userId: friend.id || null,
          phoneNumber: friend.phoneNumber || null,
          username: friend.username || null,
          profilePhoto: friend.profilePhoto || null,
          placeholder: false
        }))
      ];
      
      return allParticipants;
    });
  }, [selectedFriends]);
  
  // Update initial item to include all participants as consumers when participants change (only for new expenses)
  useEffect(() => {
    if (participants.length > 0 && items.length > 0 && !isEditing) {
      const allParticipantIndices = participants.map((_, index) => index);
      setItems(prevItems => {
        const updatedItems = [...prevItems];
        // Update the first item if it's empty (initial state)
        if (updatedItems[0] && !updatedItems[0].name && updatedItems[0].amount === 0) {
          updatedItems[0] = {
            ...updatedItems[0],
            selectedConsumers: allParticipantIndices
          };
        }
        return updatedItems;
      });
    }
  }, [participants, isEditing]);
  
  const handleRemoveParticipant = (index) => {
    removeParticipant(index, participants, setParticipants, items, setItems);
  };



  const handleUpdateItem = (index, field, value) => {
    updateItem(index, field, value, items, setItems, fees, setFees);
  };

  const handleUpdateItemSplit = (itemIndex, participantIndex, amount) => {
    updateItemSplit(itemIndex, participantIndex, amount, items, setItems);
  };



  const handleSaveExpense = async () => {
    saveExpense(
      title,
      participants,
      items,
      fees,
      selectedPayers,
      joinEnabled,
      isEditing,
      expense,
      navigation,
      setLoading,
      calculateTotal,
      'expense',
      resetChanges
    );
  };

  const saveExpenseSilently = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('No user signed in');
    }

    // Get user profile for proper participant mapping
    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) {
      throw new Error('Failed to get user profile');
    }

    // Map participants with proper user data
    const mappedParticipants = participants.map((p, index) => {
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
      return p;
    });

    // Create expense data
    const expenseData = {
      title: title.trim() || 'Expense',
      total: calculateTotal(),
      expenseType: 'expense', // Mark as manual expense
      participants: mappedParticipants,
      items: items.map(item => ({
        id: item.id || null,
        name: item.name.trim(),
        amount: item.amount === null || item.amount === undefined || item.amount === '' ? 0 : parseFloat(item.amount) || 0,
        selectedConsumers: item.selectedConsumers || [0],
        splits: item.splits || [],
        selectedPayers: item.selectedPayers || [0]
      })),
      fees: fees.map(fee => ({
        id: fee.id || null,
        name: fee.name.trim(),
        amount: fee.amount === null || fee.amount === undefined || fee.amount === '' ? 0 : parseFloat(fee.amount) || 0,
        type: fee.type || 'fixed',
        percentage: fee.percentage || null,
        splitType: fee.splitType || 'proportional',
        splits: fee.splits || []
      })),
      selectedPayers: selectedPayers || [0],
      join: {
        enabled: joinEnabled || false,
      },
      createdBy: currentUser.uid,
      createdAt: expense?.createdAt || new Date()
    };

    // Only include ID if editing
    if (isEditing && expense?.id) {
      expenseData.id = expense.id;
    }

    console.log('Expense data being saved:', JSON.stringify(expenseData, null, 2));

    // Check for undefined values that would cause Firestore errors
    const checkForUndefined = (obj, path = '') => {
      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        if (obj[key] === undefined) {
          console.error(`Found undefined value at path: ${currentPath}`);
          return false;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (!checkForUndefined(obj[key], currentPath)) {
            return false;
          }
        }
      }
      return true;
    };

    if (!checkForUndefined(expenseData)) {
      throw new Error('Expense data contains undefined values');
    }

    // Import the service functions
    const { createExpense, updateExpense, updateExpenseParticipants } = await import('../services/expenseService');

    // Save the expense
    if (isEditing) {
      // Update participants separately to ensure participantsMap is updated
      await updateExpenseParticipants(expense.id, expenseData.participants, currentUser.uid);
      
      // Update other fields
      const { participants, ...otherFields } = expenseData;
      await updateExpense(expense.id, otherFields, currentUser.uid);
    } else {
      await createExpense(expenseData, currentUser.uid);
    }

    // Reset change tracker after successful save
    if (resetChanges) {
      resetChanges();
    }
  };

  const handleSettleNow = async () => {
    try {
      // Save the expense silently first
      await saveExpenseSilently();
      
      // Then navigate to SettleUp screen
      navigation.navigate('SettleUp', {
        expense: {
          title,
          participants,
          items,
          fees,
          selectedPayers,
          joinEnabled,
          ...(isEditing && expense ? { id: expense.id } : {})
        },
        participants
      });
    } catch (error) {
      console.error('Error saving expense before settlement:', error);
      // Still navigate even if save fails
      navigation.navigate('SettleUp', {
        expense: {
          title,
          participants,
          items,
          fees,
          selectedPayers,
          joinEnabled,
          ...(isEditing && expense ? { id: expense.id } : {})
        },
        participants
      });
    }
  };

  const handleSettleLater = async () => {
    // Just save the expense without showing settlement modal
    await handleSaveExpense();
  };

  const handleRenderItem = (item, index) => {
    return renderItem(
      item,
      index,
      participants,
      items,
      setItems,
      handleUpdateItem,
      fees,
      setFees,
      styles,
      false, // isReceipt = false for AddExpenseScreen
      selectedPayers
    );
  };


  return (
            <View style={styles.container}>
        <BlurView intensity={30} tint="light" style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Expense' : 'Add Expense'}
          </Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('ExpenseSettings', { expense: { 
              id: expense?.id,
              title,
              participants,
              items,
              fees,
              createdBy: getCurrentUser()?.uid,
              join: { enabled: joinEnabled }
            }})}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </BlurView>
        
        <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 100, paddingBottom: 120 }}
        >
          {/* Expense Title Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expense Title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter expense title..."
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Participants</Text>
              <View style={styles.participantsCount}>
                <Text style={styles.participantsCountText}>
                  {participants.length} {participants.length === 1 ? 'person' : 'people'}
                </Text>
              </View>
            </View>
            

            
            {/* Participants Compact Grid Layout */}
            <FlatList
              data={[
                // Add button always first
                { id: 'add-button', type: 'add-button' },
                // Then participants in order: Me → real friends
                ...(participantsExpanded ? participants : participants.slice(0, 5))
              ]}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                if (item.type === 'add-button') {
                  return (
                    <TouchableOpacity 
                      style={styles.addParticipantGridButton}
                      onPress={() => {
                        if (friendSelectorRef.current) {
                          friendSelectorRef.current.openModal();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.addParticipantGridIcon}>
                        <Ionicons name="add" size={24} color={Colors.accent} />
                      </View>
                      <Text style={styles.addParticipantGridText}>Add</Text>
                    </TouchableOpacity>
                  );
                }

                const participant = item;
                return (
                  <TouchableOpacity 
                    key={participant.id}
                    style={styles.participantGridItem}
                    onPress={() => {
                      if (participant.userId && participant.userId !== getCurrentUser()?.uid) {
                        navigation.navigate('FriendProfile', { friendId: participant.userId });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.participantGridAvatarContainer}>
                      {participant.profilePhoto ? (
                        <Image source={{ uri: participant.profilePhoto }} style={styles.participantGridAvatar} />
                      ) : (
                        <View style={[
                          styles.participantGridAvatarPlaceholder,
                          participant.name === 'Me' && styles.currentUserAvatar
                        ]}>
                          <Text style={[
                            styles.participantGridAvatarInitials,
                            participant.name === 'Me' && styles.currentUserInitials
                          ]}>
                            {participant.name === 'Me' ? 'M' : (participant.name[0] || 'U').toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.participantGridName} numberOfLines={1}>
                      {participant.name}
                    </Text>
                    {participant.username && (
                      <Text style={styles.participantGridUsername} numberOfLines={1}>
                        @{participant.username}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.participantsGridContainer}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
            
            {/* Show More/Less toggle button */}
            {participants.length > 5 && (
              <TouchableOpacity 
                style={styles.toggleParticipantsButton}
                onPress={() => setParticipantsExpanded(!participantsExpanded)}
                activeOpacity={0.7}
              >
                <View style={styles.toggleParticipantsIcon}>
                  <Ionicons 
                    name={participantsExpanded ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color={Colors.surface} 
                  />
                </View>
                <Text style={styles.toggleParticipantsText}>
                  {participantsExpanded ? "Show Less" : `Show ${participants.length - 5} More`}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Group Management Row */}
            <View style={styles.groupManagementRow}>
              <View style={styles.groupInfo}>
                <Text style={styles.groupInfoText}>
                  {participants.length} {participants.length === 1 ? 'person' : 'people'} in this expense
                </Text>
                {participants.length > 5 && (
                  <Text style={styles.pendingInvitesText}>
                    Tap "More" to see all participants
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.manageGroupButton}
                onPress={() => {
                  if (friendSelectorRef.current) {
                    friendSelectorRef.current.openModal();
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={16} color={Colors.surface} />
                <Text style={styles.manageGroupButtonText}>Manage</Text>
              </TouchableOpacity>
            </View>
            
            <FriendSelector
              ref={friendSelectorRef}
              selectedFriends={selectedFriends}
              onFriendsChange={setSelectedFriends}
              placeholder="Add friends to split with..."
              expenseId={expense?.id}
              showAddButton={false}
            />

          </View>

          {/* Items Section */}
          <Text style={styles.sectionTitle}>Items</Text>
          
          {items.map((item, index) => handleRenderItem(item, index))}
          
          {/* Add Item Button - Below the item cards */}
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() => {
              addItem(items, setItems, participants);
              // Scroll to bottom after adding item
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.addItemIcon}>
              <Ionicons name="add" size={20} color={Colors.white} />
            </View>
            <Text style={styles.addItemText}>Add Item</Text>
          </TouchableOpacity>
        </ScrollView>

        <BlurView intensity={30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom}]}>
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={[styles.settleLaterButton, loading && styles.buttonDisabled]}
              onPress={handleSettleLater}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.settleLaterButtonText}>
                {loading ? 'Saving...' : (isEditing ? 'Update Expense' : 'Settle Later')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settleNowButton, loading && styles.buttonDisabled]}
              onPress={handleSettleNow}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.settleNowButtonText}>
                {isEditing ? 'Update & Settle' : 'Settle Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>

      {/* All Participants Modal */}
      <Modal
        visible={showAllParticipants}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllParticipants(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAllParticipants(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>All Participants</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.allParticipantsList}>
              {participants.map((participant, index) => (
                <View key={participant.id} style={styles.allParticipantItem}>
                  <View style={styles.allParticipantContent}>
                    <View style={styles.allParticipantAvatarContainer}>
                      {participant.profilePhoto ? (
                        <Image source={{ uri: participant.profilePhoto }} style={styles.allParticipantAvatar} />
                      ) : (
                        <View style={[
                          styles.allParticipantAvatarPlaceholder,
                          participant.name === 'Me' && styles.currentUserAvatar
                        ]}>
                          <Text style={[
                            styles.allParticipantAvatarInitials,
                            participant.name === 'Me' && styles.currentUserInitials
                          ]}>
                            {participant.name === 'Me' ? 'M' : (participant.name[0] || 'U').toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.allParticipantInfo}>
                      <Text style={styles.allParticipantName}>{participant.name}</Text>
                      {participant.username && (
                        <Text style={styles.allParticipantUsername}>@{participant.username}</Text>
                      )}
                      {participant.name === 'Me' && (
                        <Text style={styles.allParticipantTag}>You</Text>
                      )}
                    </View>
                  </View>
                  {participant.name !== 'Me' && (
                    <View style={styles.allParticipantActions}>
                      <TouchableOpacity 
                        style={styles.removeParticipantButton}
                        onPress={() => {
                          setShowAllParticipants(false);
                          handleRemoveParticipant(index);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Group Members Modal */}
      <Modal
        visible={showGroupMembers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGroupMembers(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowGroupMembers(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Manage Group Members</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.modalContent}>
            {/* Participants Management Section */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Add/Remove Participants</Text>
              <FriendSelector
                selectedFriends={selectedFriends}
                onFriendsChange={setSelectedFriends}
                placeholder="Add friends to split with..."
                expenseId={expense?.id}
                showAddButton={false}
              />
            </View>
            
            {/* Current Participants List */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Current Participants</Text>
              <View style={styles.currentParticipantsList}>
                {participants.map((participant, index) => (
                  <View key={participant.id} style={styles.currentParticipantItem}>
                    <View style={styles.currentParticipantContent}>
                      <View style={styles.currentParticipantAvatarContainer}>
                        {participant.profilePhoto ? (
                          <Image source={{ uri: participant.profilePhoto }} style={styles.currentParticipantAvatar} />
                        ) : (
                          <View style={[
                            styles.currentParticipantAvatarPlaceholder,
                            participant.name === 'Me' && styles.currentUserAvatar
                          ]}>
                            <Text style={[
                              styles.currentParticipantAvatarInitials,
                              participant.name === 'Me' && styles.currentUserInitials
                            ]}>
                              {participant.name === 'Me' ? 'M' : (participant.name[0] || 'U').toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.currentParticipantInfo}>
                        <Text style={styles.currentParticipantName}>{participant.name}</Text>
                        {participant.username && (
                          <Text style={styles.currentParticipantUsername}>@{participant.username}</Text>
                        )}
                        {participant.name === 'Me' && (
                          <Text style={styles.currentParticipantTag}>You</Text>
                        )}
                      </View>
                    </View>
                    {participant.name !== 'Me' && (
                      <View style={styles.currentParticipantActions}>
                        <TouchableOpacity 
                          style={styles.removeParticipantButton}
                          onPress={() => {
                            setShowGroupMembers(false);
                            handleRemoveParticipant(index);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={20} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.card,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },




  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalSection: {
    marginBottom: Spacing.xl,
  },
  modalSectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  settleLaterButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  settleLaterButtonText: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  settleNowButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  settleNowButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: Colors.textSecondary,
  },

  participantsGridContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  participantGridItem: {
    alignItems: 'center',
    width: '33.33%', // Exactly one-third width for 3 columns
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 100,
  },
  participantGridAvatarContainer: {
    position: 'relative',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  participantGridAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  participantGridAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  participantGridAvatarInitials: {
    color: Colors.white,
    fontSize: 24,
    fontFamily: Typography.familySemiBold,
  },
  participantGridName: {
    ...Typography.body,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
  },
  participantGridUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontSize: 9,
  },
  addParticipantGridButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '33.33%', // Exactly one-third width for 3 columns
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 100,
  },
  addParticipantGridIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  addParticipantGridText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 11,
  },

  groupManagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  groupInfo: {
    flex: 1,
  },
  groupInfoText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  pendingInvitesText: {
    ...Typography.caption,
    color: Colors.accent,
    fontSize: 11,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  manageGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 2,
  },
  manageGroupButtonText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 12,
  },
  participantsCount: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 3,
  },
  participantsCountText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
    fontSize: 11,
  },

  currentUserAvatar: {
    borderColor: Colors.accent,
    borderWidth: 3,
    backgroundColor: Colors.accent,
  },
  currentUserInitials: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 24,
  },

  allParticipantsList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  allParticipantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
    elevation: 2,
    minHeight: 72,
  },
  allParticipantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  allParticipantAvatarContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  allParticipantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  allParticipantAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  allParticipantAvatarInitials: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: Typography.familySemiBold,
  },
  allParticipantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  allParticipantName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  allParticipantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  allParticipantTag: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  allParticipantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  removeParticipantButton: {
    padding: Spacing.sm,
  },

  currentParticipantsList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  currentParticipantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
    elevation: 2,
    minHeight: 72,
  },
  currentParticipantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currentParticipantAvatarContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  currentParticipantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.avatar,
  },
  currentParticipantAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.avatar,
  },
  currentParticipantAvatarInitials: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: Typography.familySemiBold,
  },
  currentParticipantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  currentParticipantName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  currentParticipantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  currentParticipantTag: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  currentParticipantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },



  toggleParticipantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 2,
  },
  toggleParticipantsIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  toggleParticipantsText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 12,
  },

  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    alignSelf: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  addItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  addItemText: {
    ...Typography.label,
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },

  titleInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    fontSize: 16,
  },

});

export default AddExpenseScreen;
