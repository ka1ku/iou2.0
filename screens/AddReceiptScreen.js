import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';

import FriendSelector from '../components/FriendSelector';
import PriceInput from '../components/PriceInput';
import { PaidBySection } from './AddExpenseScreenItems';
import {
  addItem,
  updateItem,
  removeItem,
  addFee,
  updateFee,
  removeFee,
  saveExpense,
} from './AddExpenseScreenFunctions';
import useFormChangeTracker from '../hooks/useFormChangeTracker';
import useNavigationWarning from '../hooks/useNavigationWarning';

const AddReceiptScreen = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();
  const currentUserId = getCurrentUser()?.uid || null;

  const createMeParticipant = () => ({
    name: 'Me',
    id: 'me-participant',
    userId: currentUserId,
    placeholder: false,
    phoneNumber: null,
    username: null,
    profilePhoto: null
  });
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState([createMeParticipant()]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [items, setItems] = useState([{
    id: Date.now().toString(),
    name: '',
    amount: 0,
    selectedConsumers: [], // No one selected by default
    splits: [],
    selectedPayers: [0] // Default to "Me"
  }]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayers, setSelectedPayers] = useState([0]); // Default to "Me"
  const [editingItem, setEditingItem] = useState(null); // {index, field, value}
  const [editingFee, setEditingFee] = useState(null); // {index, field, value}
  const friendSelectorRef = useRef(null);
  const scrollViewRef = useRef(null);



  const itemsSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [items]
  );
  const feesSubtotal = useMemo(
    () => fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0),
    [fees]
  );

  const openFriendSelector = () => {
    if (friendSelectorRef.current) {
      friendSelectorRef.current.openModal();
    }
  };



  const toggleParticipantsExpanded = () => setParticipantsExpanded(!participantsExpanded);



  const handleNavigateToProfile = (participant) => {
    if (participant.userId && participant.userId !== currentUserId) {
      navigation.navigate('FriendProfile', { friendId: participant.userId });
    }
  };







  // Form change tracking for navigation warning
  const { hasChanges, updateChangeStatus, resetChanges } = useFormChangeTracker(
    isEditing && expense ? {
      title: expense.title || '',
      participants: expense.participants || [],
      items: expense.items || [],
      fees: expense.fees || [],
      selectedPayers: expense.selectedPayers || [0]
    } : null,
    isEditing
  );

  // Navigation warning when trying to leave with unsaved changes
  useNavigationWarning(
    hasChanges,
    navigation,
    null,
    'You have unsaved changes to this receipt. Are you sure you want to leave?'
  );

  // Calculate total from items and fees
  const calculateTotal = () => itemsSubtotal + feesSubtotal;

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Receipt' : 'Add Receipt',
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

  // Handle scanned receipt data
  useEffect(() => {
    if (scannedReceipt && fromReceiptScan) {
      // Populate form with scanned data
      setTitle(scannedReceipt.title || '');
      
      // Set participants if available
      if (scannedReceipt.participants && scannedReceipt.participants.length > 0) {
        setParticipants(scannedReceipt.participants);
      }
      
      // Set items if available
      if (scannedReceipt.items && scannedReceipt.items.length > 0) {
        const formattedItems = scannedReceipt.items.map((item, index) => ({
          id: Date.now().toString() + index,
          name: item.name || '',
          amount: parseFloat(item.amount) || 0,
          selectedConsumers: [], // No one selected by default
          splits: []
        }));
        setItems(formattedItems);
      }
      
      // Set default payers to first participant
      setSelectedPayers([0]);
      
      // Set fees if available (e.g., tax, tip)
      if (scannedReceipt.fees && scannedReceipt.fees.length > 0) {
        const subtotalFromReceipt = Number(scannedReceipt.subtotal);
        const fallbackItemsTotal = (scannedReceipt.items || []).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
        const baseline = Number.isFinite(subtotalFromReceipt) ? subtotalFromReceipt : fallbackItemsTotal;

        const formattedFees = scannedReceipt.fees.map((fee, index) => {
          const rawType = fee.type === 'percentage' || fee.type === 'fixed' ? fee.type : undefined;
          let percentage = fee.percentage !== undefined && fee.percentage !== null ? Number(fee.percentage) : null;
          let amount = fee.amount !== undefined && fee.amount !== null ? Number(fee.amount) : null;
          let type = rawType || (Number.isFinite(percentage) ? 'percentage' : 'fixed');

          if (type === 'percentage') {
            if (!Number.isFinite(percentage)) {
              // Try deriving percentage from amount
              if (Number.isFinite(amount) && baseline > 0) {
                percentage = (amount / baseline) * 100;
              }
            }
            if (!Number.isFinite(amount) && Number.isFinite(percentage)) {
              amount = (baseline * percentage) / 100;
            }
          }

          if (!Number.isFinite(amount)) amount = 0;
          if (!Number.isFinite(percentage)) percentage = null;

          return {
            id: Date.now().toString() + 'fee' + index,
            name: fee.name || 'Fee',
            amount,
            type,
            percentage,
            splitType: 'proportional',
            splits: []
          };
        });
        setFees(formattedFees);
      }
      
      // Show success message
      Alert.alert(
        'Receipt Scanned Successfully!',
        'The receipt information has been automatically filled in. Please review and make any necessary adjustments.',
        [{ text: 'OK' }]
      );
    }
  }, [scannedReceipt, fromReceiptScan]);

  // Initialize selectedFriends when editing an existing expense
  useEffect(() => {
    if (expense && isEditing) {
      // Extract friends from existing participants (exclude current user)
      const existingFriends = expense.participants
        .filter(p => p.name !== 'Me' && !p.placeholder && p.userId && p.userId !== currentUserId)
        .map(p => ({
          id: p.userId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto
        }));
      
      setSelectedFriends(existingFriends);
      setParticipants(prev => [
        createMeParticipant(),
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
      if (expense.fees) {
        setFees(expense.fees);
      }
      if (expense.items) {
        // Ensure each item has selectedPayers field and selectedConsumers field
        const itemsWithPayers = expense.items.map(item => ({
          ...item,
          selectedPayers: item.selectedPayers || [0], // Default to "Me" if not set
          selectedConsumers: item.selectedConsumers || [] // No one selected by default
        }));
        setItems(itemsWithPayers);
      }
      // Set selected payers if available
      if (expense.selectedPayers) {
        setSelectedPayers(expense.selectedPayers);
      }
    }
  }, [expense, isEditing]);

  // Update participants when friends are selected
  useEffect(() => {
    setParticipants(prevParticipants => {
      const meParticipant = prevParticipants.find(p => p.name === 'Me');
      
      const allParticipants = [
        meParticipant || createMeParticipant(),
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
  
  // Removed auto-selection of all participants - users should manually select who consumed each item
  


  const handleAddItem = () => {
    addItem(items, setItems, participants);
  };

  const handleUpdateItem = (index, field, value) => {
    updateItem(index, field, value, items, setItems, fees, setFees);
  };



  const handleRemoveItem = (index) => {
    removeItem(index, items, setItems, fees, setFees);
  };

  const handleAddFee = () => {
    addFee(fees, setFees);
  };

  const handleUpdateFee = (index, field, value) => {
    updateFee(index, field, value, fees, setFees, items);
  };

  const handleRemoveFee = (index) => {
    removeFee(index, fees, setFees);
  };

  const handleSaveExpense = async () => {
    saveExpense(
      title,
      participants,
      items,
      fees,
      selectedPayers,
      true, // joinEnabled always true for receipts
      isEditing,
      expense,
      navigation,
      setLoading,
      calculateTotal,
      'receipt', // Mark as receipt
      resetChanges
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
          {isEditing ? 'Edit Receipt' : 'Add Receipt'}
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
              join: { enabled: true }
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
          {/* Receipt Title Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt Title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter receipt title..."
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          {/* Participants Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            
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
                      onPress={openFriendSelector}
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
                    onPress={() => handleNavigateToProfile(participant)}
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
                            {(participant.name?.[0] || 'U').toUpperCase()}
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
                onPress={toggleParticipantsExpanded}
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
              <Text style={styles.groupInfoText}>
                {participants.length} {participants.length === 1 ? 'person' : 'people'} in this receipt
              </Text>
              <TouchableOpacity 
                style={styles.manageGroupButton}
                onPress={openFriendSelector}
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

          {/* Who Paid Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who Paid for This Receipt?</Text>
            <PaidBySection
              participants={participants}
              selectedPayers={selectedPayers}
              onPayersChange={setSelectedPayers}
            />
          </View>

          {/* Receipt Breakdown */}
          {(items.length > 0 || fees.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Receipt Breakdown</Text>
                
              {/* Items Section */}
              {items.length > 0 && (
                <View style={styles.itemsSection}>
                  <Text style={styles.subsectionTitle}>Items</Text>
                      {items.map((item, index) => (
                    <View key={item.id} style={styles.receiptItemContainer}>
                      {/* Item Name and Amount Row */}
                      <View style={styles.receiptItemHeader}>
                        <TouchableOpacity 
                          style={styles.receiptItemNameContainer}
                          onPress={() => setEditingItem({ index, field: 'name', value: item.name || `Item ${index + 1}` })}
                          activeOpacity={0.8}
                        >
                          {editingItem?.index === index && editingItem?.field === 'name' ? (
                            <TextInput
                              style={styles.receiptItemNameInput}
                              value={editingItem.value}
                              onChangeText={(text) => setEditingItem({...editingItem, value: text})}
                              onBlur={() => {
                                handleUpdateItem(index, 'name', editingItem.value);
                                setEditingItem(null);
                              }}
                              onSubmitEditing={() => {
                                handleUpdateItem(index, 'name', editingItem.value);
                                setEditingItem(null);
                              }}
                              placeholder="Enter item name..."
                              placeholderTextColor={Colors.textSecondary}
                              autoFocus={true}
                              selectTextOnFocus={true}
                              multiline={false}
                              numberOfLines={1}
                            />
                          ) : (
                            <View style={styles.receiptItemNameDisplay}>
                          <Text style={styles.receiptItemName} numberOfLines={2}>
                            {item.name || `Item ${index + 1}`}
                          </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.receiptItemAmountContainer}
                          onPress={() => setEditingItem({ index, field: 'amount', value: item.amount === null || item.amount === undefined ? 0 : item.amount })}
                          activeOpacity={0.8}
                        >
                          {editingItem?.index === index && editingItem?.field === 'amount' ? (
                            <PriceInput
                              value={editingItem.value}
                              onChangeText={(text) => setEditingItem({...editingItem, value: text})}
                              onBlur={() => {
                                handleUpdateItem(index, 'amount', editingItem.value);
                                setEditingItem(null);
                              }}
                              placeholder="0.00"
                              autoFocus={true}
                              style={styles.receiptItemAmountInput}
                            />
                          ) : (
                            <View style={styles.receiptItemAmountDisplay}>
                          <Text style={styles.receiptItemAmount}>
                            ${(parseFloat(item.amount) || 0).toFixed(2)}
                          </Text>
                        </View>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Participants Assignment Row */}
                      <View style={styles.itemParticipantsContainer}>
                        <Text style={styles.itemParticipantsLabel}>Split between:</Text>
                        <View style={styles.itemParticipantsList}>
                          {participants.map((participant, participantIndex) => {
                            const isSelected = item.selectedConsumers?.includes(participantIndex);
                            return (
                              <TouchableOpacity
                                key={participant.id}
                                style={[
                                  styles.itemParticipantAvatar,
                                  isSelected && styles.itemParticipantAvatarSelected
                                ]}
                                onPress={() => {
                                  const currentConsumers = item.selectedConsumers || [];
                                  let newConsumers;
                                  
                                  if (currentConsumers.includes(participantIndex)) {
                                    // Remove participant
                                    newConsumers = currentConsumers.filter(i => i !== participantIndex);
                                  } else {
                                    // Add participant
                                    newConsumers = [...currentConsumers, participantIndex];
                                  }
                                  
                                  handleUpdateItem(index, 'selectedConsumers', newConsumers);
                                }}
                                activeOpacity={0.7}
                              >
                                {participant?.profilePhoto ? (
                                  <Image
                                    source={{ uri: participant.profilePhoto }}
                                    style={[
                                      styles.itemParticipantImage,
                                      isSelected && styles.itemParticipantImageSelected
                                    ]}
                                  />
                                ) : (
                                  <View style={[
                                    styles.itemParticipantPlaceholder,
                                    isSelected && styles.itemParticipantPlaceholderSelected,
                                    participant?.name === 'Me' && styles.currentUserAvatar
                                  ]}>
                                    <Text style={[
                                      styles.itemParticipantInitials,
                                      isSelected && styles.itemParticipantInitialsSelected,
                                      participant?.name === 'Me' && styles.currentUserInitials
                                    ]}>
                                      {(participant?.name?.[0] || 'U').toUpperCase()}
                        </Text>
                      </View>
                                )}
                                {isSelected && (
                                  <View style={styles.itemParticipantCheckmark}>
                                    <Ionicons name="checkmark" size={12} color={Colors.white} style={{fontWeight: 'bold'}} />
                    </View>
                                )}
                              </TouchableOpacity>
                            );
                                                    })}
                        </View>
                      </View>

                      {/* Delete Button - Bottom Right */}
                      <TouchableOpacity
                        style={styles.removeItemButton}
                        onPress={() => handleRemoveItem(index)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                      </TouchableOpacity>
                      </View>
                    ))}
                   
                  {/* Add Item Button */}
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddItem}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={20} color={Colors.accent} />
                    <Text style={styles.addButtonText}>Add Item</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Items Subtotal</Text>
                    <Text style={styles.subtotalAmount}>
                      ${itemsSubtotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* If no items, show add item button */}
              {items.length === 0 && (
                <View style={styles.itemsSection}>
                  <Text style={styles.subsectionTitle}>Items</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddItem}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={20} color={Colors.accent} />
                    <Text style={styles.addButtonText}>Add First Item</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Tips & Fees Section */}
              <View style={styles.feesSection}>
                <Text style={styles.subsectionTitle}>Tips & Fees</Text>

                {/* Fees List */}
                {fees.length > 0 && (
                  <View>
                    {fees.map((fee, originalIndex) => {
                       return (
                         <View key={fee.id} style={styles.feeRowContainer}>
                           {/* Fee Name */}
                           <TouchableOpacity
                             style={styles.feeNameContainer}
                             onPress={() => setEditingFee({ index: originalIndex, field: 'name', value: fee.name || `Fee ${originalIndex + 1}` })}
                             activeOpacity={0.8}
                           >
                             {editingFee?.index === originalIndex && editingFee?.field === 'name' ? (
                               <TextInput
                                 style={styles.feeNameInput}
                                 value={editingFee.value}
                                 onChangeText={(text) => setEditingFee({...editingFee, value: text})}
                                 onBlur={() => {
                                   handleUpdateFee(originalIndex, 'name', editingFee.value);
                                   setEditingFee(null);
                                 }}
                                 onSubmitEditing={() => {
                                   handleUpdateFee(originalIndex, 'name', editingFee.value);
                                   setEditingFee(null);
                                 }}
                                 placeholder="Fee name..."
                                 placeholderTextColor={Colors.textSecondary}
                                 autoFocus={true}
                                 selectTextOnFocus={true}
                               />
                             ) : (
                               <Text style={styles.feeName} numberOfLines={1}>
                                 {fee.name || `Fee ${originalIndex + 1}`}
                               </Text>
                             )}
                           </TouchableOpacity>

                           {/* Fee Amount */}
                           <TouchableOpacity
                             style={styles.feeAmountContainer}
                             onPress={() => setEditingFee({ index: originalIndex, field: 'amount', value: fee.amount === null || fee.amount === undefined ? 0 : fee.amount })}
                             activeOpacity={0.8}
                           >
                             {editingFee?.index === originalIndex && editingFee?.field === 'amount' ? (
                               <PriceInput
                                 value={editingFee.value}
                                 onChangeText={(text) => setEditingFee({...editingFee, value: text})}
                                 onBlur={() => {
                                   handleUpdateFee(originalIndex, 'amount', editingFee.value);
                                   setEditingFee(null);
                                 }}
                                 placeholder="0.00"
                                 autoFocus={true}
                                 style={styles.feeAmountInput}
                               />
                             ) : (
                               <Text style={styles.feeAmount}>
                                 ${(parseFloat(fee.amount) || 0).toFixed(2)}
                               </Text>
                             )}
                           </TouchableOpacity>

                           {/* Remove Button */}
                           <TouchableOpacity
                             style={styles.removeFeeButton}
                             onPress={() => handleRemoveFee(originalIndex)}
                             activeOpacity={0.7}
                           >
                             <Ionicons name="close" size={16} color={Colors.destructive} />
                           </TouchableOpacity>
                         </View>
                       );
                    })}
                  </View>
                )}
                
                {/* Add Fee Button */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddFee}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color={Colors.accent} />
                  <Text style={styles.addButtonText}>Add Fee</Text>
                </TouchableOpacity>
                
                {/* Fees Subtotal */}
                {fees.length > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Tips & Fees</Text>
                    <Text style={styles.subtotalAmount}>
                      ${feesSubtotal.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Total Amount */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>
                  ${calculateTotal().toFixed(2)}
                </Text>
              </View>
            </View>
          )}


        </ScrollView>

        <BlurView intensity={30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom}]}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSaveExpense}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : (isEditing ? 'Update Receipt' : 'Save Receipt')}
            </Text>
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>




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
  addButton: {
    padding: Spacing.sm,
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
  // Section styles
  itemsSection: {
    marginBottom: Spacing.md,
  },
  feesSection: {
    marginBottom: Spacing.md,
  },
  subsectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },

  // Item container styles
  receiptItemContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    paddingBottom: Spacing.xl, // Extra padding for delete button
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    position: 'relative',
  },
  receiptItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  receiptItemNameContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  receiptItemAmountContainer: {
    marginRight: Spacing.md,
  },
  receiptItemNameDisplay: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 40,
    justifyContent: 'center',
  },
  receiptItemAmountDisplay: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 40,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  receiptItemName: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  receiptItemAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
  },
  receiptItemNameInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.accent,
    minHeight: 40,
  },
  receiptItemAmountInput: {
    textAlign: 'right',
    minWidth: 80,
    minHeight: 40,
  },
  removeItemButton: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
    zIndex: 1,
  },
  itemParticipantsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
  },
  itemParticipantsLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  itemParticipantsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  itemParticipantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    position: 'relative',
    borderWidth: 2,
    borderColor: Colors.divider,
  },
  itemParticipantAvatarSelected: {
    borderColor: Colors.accent,
    borderWidth: 3,
  },
  itemParticipantImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  itemParticipantImageSelected: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  itemParticipantPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemParticipantPlaceholderSelected: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
  },
  itemParticipantInitials: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  itemParticipantInitialsSelected: {
    color: Colors.white,
  },
  itemParticipantCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  // Add Button Styles
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  addButtonText: {
    ...Typography.body,
    color: Colors.accent,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },

  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  feeRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  feeNameContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  feeAmountContainer: {
    marginRight: Spacing.sm,
    minWidth: 80,
  },
  feeName: {
    ...Typography.body,
    color: Colors.textPrimary,
    padding: Spacing.sm,
    minHeight: 40,
    textAlignVertical: 'center',
  },
  feeNameInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.accent,
    minHeight: 40,
  },
  feeAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    padding: Spacing.sm,
    minHeight: 40,
    textAlign: 'right',
    textAlignVertical: 'center',
  },
  feeAmountInput: {
    textAlign: 'right',
    minWidth: 80,
    minHeight: 40,
  },
  removeFeeButton: {
    padding: Spacing.xs,
  },

  // Item Assignment Styles
  itemAssignmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  itemAssignmentAvatar: {
    marginRight: Spacing.xs,
  },
  itemAssignmentImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  itemAssignmentPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAssignmentInitials: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
  itemAssignmentMore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAssignmentMoreText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '600',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  subtotalLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  subtotalAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 2,
    borderTopColor: Colors.accent,
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  totalAmount: {
    ...Typography.h2,
    color: Colors.accent,
    fontWeight: '700',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.textSecondary,
  },
  totalText: {
    ...Typography.h2,
    color: Colors.accent,
    fontWeight: '600',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  participantInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  removeParticipantButton: {
    padding: Spacing.sm,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    paddingBottom: 0,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  addMoreItemsButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  addMoreItemsButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.md,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  participantsNote: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
  },
  participantsNoteContainer: {
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  // Participants Grid Styles
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
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.divider,
    position: 'relative',
  },
  placeholderInitials: { 
    ...Typography.title, 
    color: Colors.textSecondary, 
    fontWeight: '600',
    fontSize: 18,
  },
  placeholderName: { ...Typography.title, color: Colors.textPrimary },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  inviteButtonText: { ...Typography.label, color: Colors.surface, fontWeight: '600' },
  // Group Management Styles
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
  saveButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  saveButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
  lastSection: {
    marginBottom: 0,
  },
  // Fee styles
  feeCard: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  feeNameContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  feeNameLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeNameInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },

  feeTypeSection: {
    marginBottom: Spacing.md,
  },
  feeTypeLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeTypeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  feeTypeButton: {
    flex: 1,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    minHeight: 48,
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  feeTypeButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  feeTypeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  feeTypeTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  percentageSection: {
    marginBottom: Spacing.md,
  },
  percentageLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  percentageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  percentageButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  percentageButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  percentageButtonText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  percentageButtonTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  customPercentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  customPercentageLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  customPercentageInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.body,
    textAlign: 'center',
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
    width: 60,
    marginRight: Spacing.xs,
  },
  percentageSymbol: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  calculatedAmount: {
    ...Typography.label,
    color: Colors.accent,
    textAlign: 'center',
    fontWeight: '600',
  },
  fixedAmountSection: {
    marginBottom: Spacing.md,
  },
  fixedAmountLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeAmountInput: {
    marginBottom: 0,
  },

  feeTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  feeTotalLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  feeTotalAmount: {
    ...Typography.title,
    color: Colors.accent,
    fontWeight: '700',
  },

  participantsCount: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    ...Shadows.button,
    elevation: 2,
  },
  participantsCountText: {
    ...Typography.label,
    color: Colors.surface,
    fontWeight: '600',
  },
  // Current User Styles
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


});

export default AddReceiptScreen;
