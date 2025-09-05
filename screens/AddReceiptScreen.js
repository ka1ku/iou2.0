import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { createExpense, updateExpense, updateExpenseParticipants } from '../services/expenseService';
import { 
  FriendSelector, 
  PriceInput,
  ExpenseHeader,
  ExpenseFooter,
  ParticipantsGrid
} from '../components';
import { useFocusEffect } from '@react-navigation/native';

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
    selectedConsumers: [],
    splits: [],
    selectedPayers: [0]
  }]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayers, setSelectedPayers] = useState([0]);
  const [editingItem, setEditingItem] = useState(null);
  const [editingFee, setEditingFee] = useState(null);
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

  const calculateTotal = () => itemsSubtotal + feesSubtotal;

  // Simple inline action handlers to replace expenseFunctions
  const handleAddItem = () => {
    const newItem = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      selectedConsumers: [],
      splits: [],
      selectedPayers: [0]
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // If updating selectedConsumers or amount, recalculate splits
    if (field === 'selectedConsumers' || field === 'amount') {
      const amount = parseFloat(updated[index].amount) || 0;
      const selectedConsumers = updated[index].selectedConsumers || [];
      
      if (selectedConsumers.length > 0 && amount > 0) {
        if (selectedConsumers.length === 1) {
          // Single consumer gets 100% of the amount
          updated[index].splits = [{
            participantIndex: selectedConsumers[0],
            amount: amount,
            percentage: 100
          }];
        } else {
          // Multiple consumers split evenly
          const baseAmount = Math.floor((amount * 100) / selectedConsumers.length) / 100;
          const remainder = Math.round((amount - (baseAmount * selectedConsumers.length)) * 100) / 100;
          const splitAmounts = new Array(selectedConsumers.length).fill(baseAmount);
          const remainderCents = Math.round(remainder * 100);
          for (let i = 0; i < remainderCents; i++) {
            splitAmounts[i] = Math.round((splitAmounts[i] + 0.01) * 100) / 100;
          }
          updated[index].splits = selectedConsumers.map((consumerIndex, i) => ({
            participantIndex: consumerIndex,
            amount: splitAmounts[i],
            percentage: 100 / selectedConsumers.length
          }));
        }
      } else {
        updated[index].splits = [];
      }
    }
    
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddFee = () => {
    const newFee = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'percentage',
      percentage: 15,
      splitType: 'proportional',
      splits: []
    };
    setFees([...fees, newFee]);
  };

  const handleUpdateFee = (index, field, value) => {
    const updated = [...fees];
    updated[index] = { ...updated[index], [field]: value };
    setFees(updated);
  };

  const handleRemoveFee = (index) => {
    setFees(fees.filter((_, i) => i !== index));
  };

  // Simple form change tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialStateRef = useRef(null);

  // Initialize baseline state
  useEffect(() => {
    if (!initialStateRef.current) {
      initialStateRef.current = isEditing && expense ? {
        title: expense.title || '',
        participantCount: expense.participants?.length || 1,
        itemCount: expense.items?.length || 1,
        feeCount: expense.fees?.length || 0
      } : {
        title: '',
        participantCount: 1,
        itemCount: 1,
        feeCount: 0
      };
    }
  }, [isEditing, expense]);

  // Check for changes on state updates
  useEffect(() => {
    if (initialStateRef.current) {
      const currentState = {
        title: title,
        participantCount: participants.length,
        itemCount: items.length,
        feeCount: fees.length
      };
      
      const hasChanges = JSON.stringify(currentState) !== JSON.stringify(initialStateRef.current);
      setHasUnsavedChanges(hasChanges);
    }
  }, [title, participants.length, items.length, fees.length]);

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
          'You have unsaved changes to this receipt. Are you sure you want to leave?',
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

  const resetChanges = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

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
      setTitle(scannedReceipt.title || '');
      
      if (scannedReceipt.participants && scannedReceipt.participants.length > 0) {
        setParticipants(scannedReceipt.participants);
      }
      
      if (scannedReceipt.items && scannedReceipt.items.length > 0) {
        const formattedItems = scannedReceipt.items.map((item, index) => ({
          id: Date.now().toString() + index,
          name: item.name || '',
          amount: parseFloat(item.amount) || 0,
          selectedConsumers: [],
          splits: []
        }));
        setItems(formattedItems);
      }
      
      setSelectedPayers([0]);
      
      if (scannedReceipt.fees && scannedReceipt.fees.length > 0) {
        const formattedFees = scannedReceipt.fees.map((fee, index) => ({
            id: Date.now().toString() + 'fee' + index,
            name: fee.name || 'Fee',
          amount: parseFloat(fee.amount) || 0,
          type: fee.type || 'fixed',
          percentage: fee.percentage || null,
            splitType: 'proportional',
            splits: []
        }));
        setFees(formattedFees);
      }
      
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
      setParticipants([
        createMeParticipant(),
        ...existingFriends.map((friend, index) => ({ 
          name: friend.name || '', 
          id: `friend-${friend.id || index}`,
          userId: friend.id || null,
          phoneNumber: friend.phoneNumber || null,
          username: friend.username || null,
          profilePhoto: friend.profilePhoto || null,
          placeholder: false
        }))
      ]);

      if (expense.title) setTitle(expense.title);
      if (expense.fees) setFees(expense.fees);
      if (expense.items) {
        const itemsWithPayers = expense.items.map(item => ({
          ...item,
          selectedPayers: item.selectedPayers || [0],
          selectedConsumers: item.selectedConsumers || []
        }));
        setItems(itemsWithPayers);
      }
      if (expense.selectedPayers) setSelectedPayers(expense.selectedPayers);
    }
  }, [expense, isEditing]);

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
      
    setParticipants(allParticipants);
  }, [selectedFriends]);
  
  // Form change tracking is now handled above with simpler logic

  const handleSaveExpense = async () => {
    const finalTitle = title.trim() || (items.length > 0 && items[0].name.trim()) || 'Receipt';

    if (participants.some(p => !p.name.trim())) {
      Alert.alert('Error', 'Please enter names for all participants');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    if (!selectedPayers || selectedPayers.length === 0) {
      Alert.alert('Error', 'Please select at least one person who paid for this receipt');
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

      const expenseData = {
        title: finalTitle,
        total: calculateTotal(),
        expenseType: 'receipt',
        participants: mappedParticipants,
        items: items.map(item => ({
          id: item.id,
          name: item.name.trim(),
          amount: parseFloat(item.amount) || 0,
          selectedConsumers: item.selectedConsumers || [],
          splits: item.splits || []
        })),
        fees: fees.map(fee => ({
          id: fee.id,
          name: fee.name.trim(),
          amount: parseFloat(fee.amount) || 0,
          type: fee.type || 'fixed',
          percentage: fee.percentage || null,
          splitType: fee.splitType || 'proportional',
          splits: fee.splits || []
        })),
        selectedPayers: selectedPayers || [0],
        join: { enabled: true }
      };
      
      if (isEditing) {
        await updateExpenseParticipants(expense.id, expenseData.participants, currentUser.uid);
        const { participants, ...otherFields } = expenseData;
        await updateExpense(expense.id, otherFields, currentUser.uid);
        Alert.alert('Success', 'Receipt updated successfully');
        resetChanges();
      } else {
        await createExpense(expenseData, currentUser.uid);
        Alert.alert('Success', 'Receipt created successfully');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving receipt:', error);
      Alert.alert('Error', 'Failed to save receipt: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Simple PaidBySection component
  const PaidBySection = ({ participants, selectedPayers, onPayersChange }) => {
    const togglePayer = (participantIndex) => {
      const newPayers = selectedPayers.includes(participantIndex)
        ? selectedPayers.filter(i => i !== participantIndex)
        : [...selectedPayers, participantIndex];
      
      onPayersChange(newPayers);
    };

    return (
      <View style={styles.paidByContainer}>
        <View style={styles.paidByButtons}>
          {participants.map((participant, pIndex) => (
            <TouchableOpacity
              key={pIndex}
              style={[
                styles.paidByButton,
                selectedPayers.includes(pIndex) && styles.paidByButtonActive
              ]}
              onPress={() => togglePayer(pIndex)}
              activeOpacity={0.7}
            >
              <View style={styles.paidByButtonContent}>
                {selectedPayers.includes(pIndex) && (
                  <View style={styles.checkmarkContainer}>
                    <Ionicons name="checkmark" size={12} color={Colors.surface} />
                  </View>
                )}
                <Text style={[
                  styles.paidByText,
                  selectedPayers.includes(pIndex) && styles.paidByTextActive
                ]}>
                  {participant.name || `Person ${pIndex + 1}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {selectedPayers.length > 0 && (
          <View style={styles.payerSummary}>
            <Text style={styles.payerSummaryText}>
              {selectedPayers.length} {selectedPayers.length === 1 ? 'person' : 'people'} paying
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ExpenseHeader
        title={isEditing ? 'Edit Receipt' : 'Add Receipt'}
        onBackPress={() => navigation.goBack()}
        onSettingsPress={() => navigation.navigate('ExpenseSettings', { expense: { 
          id: expense?.id,
          title,
          participants,
          items,
          fees,
          createdBy: getCurrentUser()?.uid,
          join: { enabled: true }
        }})}
        isEditing={isEditing}
      />
      
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
            
            <ParticipantsGrid
              participants={participants}
              selectedFriends={selectedFriends}
              onFriendsChange={setSelectedFriends}
              onParticipantPress={(participant, index) => {
                if (participant.userId && participant.userId !== currentUserId) {
                  navigation.navigate('FriendProfile', { friendId: participant.userId });
                }
              }}
              participantsExpanded={participantsExpanded}
              onToggleExpanded={() => setParticipantsExpanded(!participantsExpanded)}
              expenseId={expense?.id}
              currentUserId={currentUserId}
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

                      <TouchableOpacity
                        style={styles.removeItemButton}
                        onPress={() => handleRemoveItem(index)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                      </TouchableOpacity>
                      </View>
                    ))}
                   
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

              {/* Tips & Fees Section */}
              <View style={styles.feesSection}>
                <Text style={styles.subsectionTitle}>Tips & Fees</Text>

                {fees.length > 0 && (
                  <View>
                    {fees.map((fee, originalIndex) => (
                         <View key={fee.id} style={styles.feeRowContainer}>
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

                           <TouchableOpacity
                             style={styles.removeFeeButton}
                             onPress={() => handleRemoveFee(originalIndex)}
                             activeOpacity={0.7}
                           >
                             <Ionicons name="close" size={16} color={Colors.destructive} />
                           </TouchableOpacity>
                         </View>
                    ))}
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddFee}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color={Colors.accent} />
                  <Text style={styles.addButtonText}>Add Fee</Text>
                </TouchableOpacity>
                
                {fees.length > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Tips & Fees</Text>
                    <Text style={styles.subtotalAmount}>
                      ${feesSubtotal.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>
                  ${calculateTotal().toFixed(2)}
                </Text>
              </View>
            </View>
          )}

        </ScrollView>

        <ExpenseFooter
          isEditing={isEditing}
          loading={loading}
          onSavePress={handleSaveExpense}
          onSettlePress={handleSaveExpense}
          saveButtonText={isEditing ? 'Update Receipt' : 'Save Receipt'}
          settleButtonText={isEditing ? 'Update & Settle' : 'Settle Now'}
        />
      </KeyboardAvoidingView>
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
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
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
  receiptItemContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
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
  // PaidBy component styles
  paidByContainer: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  paidByButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  paidByButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 2,
  },
  paidByButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 3,
  },
  paidByButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  checkmarkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidByText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 12,
  },
  paidByTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  payerSummary: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  payerSummaryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontSize: 11,
  },
});

export default AddReceiptScreen;