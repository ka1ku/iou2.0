import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Alert,
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
  Card, 
  DeleteButton, 
  PriceInput, 
  SmartSplitInput,
  ExpenseHeader,
  ExpenseFooter,
  ParticipantsGrid
} from '../components';
import { useFocusEffect } from '@react-navigation/native';

// Unified expense state management
const useExpenseState = (initialExpense = null) => {
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

  const [state, setState] = useState(() => ({
    title: initialExpense?.title || '',
    participants: [{
      name: 'Me',
      id: 'me-participant',
      userId: currentUserId,
      placeholder: false,
      phoneNumber: null,
      username: null,
      profilePhoto: null
    }],
    selectedFriends: [],
    items: [{
      id: Date.now().toString(),
      name: '',
      amount: 0,
      selectedConsumers: [0],
      splits: [],
      selectedPayers: [0]
    }],
    fees: [],
    selectedPayers: [0],
    joinEnabled: initialExpense?.join?.enabled ?? true,
    loading: false,
    showAllParticipants: false,
    showGroupMembers: false,
    participantsExpanded: false
  }));

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const total = useMemo(() => {
    const itemsTotal = state.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const feesTotal = state.fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    return itemsTotal + feesTotal;
  }, [state.items, state.fees]);

  return { state, updateState, total, createMeParticipant };
};

const AddExpenseScreen = ({ route, navigation }) => {
  const { expense } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();
  const { state, updateState, total, createMeParticipant } = useExpenseState(expense);
  const friendSelectorRef = useRef(null);
  const scrollViewRef = useRef(null);

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
        title: state.title,
        participantCount: state.participants.length,
        itemCount: state.items.length,
        feeCount: state.fees.length
      };
      
      const hasChanges = JSON.stringify(currentState) !== JSON.stringify(initialStateRef.current);
      setHasUnsavedChanges(hasChanges);
    }
  }, [state.title, state.participants.length, state.items.length, state.fees.length]);

  // Navigation warning
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (!hasUnsavedChanges || state.loading) {
          return;
        }

        e.preventDefault();
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes to this expense. Are you sure you want to leave?',
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
    }, [navigation, hasUnsavedChanges, state.loading])
  );

  const resetChanges = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  // Unified action handlers
  const actions = useMemo(() => ({
    addItem: () => {
      const lastItem = state.items[state.items.length - 1];
      const payersToUse = lastItem?.selectedPayers || [0];
      const newItem = {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        selectedConsumers: [],
        splits: [],
        selectedPayers: payersToUse
      };
      updateState({ items: [...state.items, newItem] });
    },

    updateItem: (index, field, value) => {
      const updated = [...state.items];
      updated[index] = { ...updated[index], [field]: value };
      
      if (field === 'amount') {
        const amount = parseFloat(value) || 0;
        const selectedConsumers = updated[index].selectedConsumers || [0];
        if (selectedConsumers.length > 0) {
          if (selectedConsumers.length === 1) {
            updated[index].splits = [{
              participantIndex: selectedConsumers[0],
              amount: amount,
              percentage: 100
            }];
          } else {
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
        }
      }
      
      const updatedState = { items: updated };
      
      if (field === 'amount') {
        const updatedFees = state.fees.map(fee => {
          if (fee.type === 'percentage') {
            const itemsTotal = updated.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            return { ...fee, amount: (itemsTotal * fee.percentage) / 100 };
          }
          return fee;
        });
        updatedState.fees = updatedFees;
      }
      
      updateState(updatedState);
    },

    removeParticipant: (index) => {
      if (state.participants.length > 1) {
        const newParticipants = state.participants.filter((_, i) => i !== index);
        const newItems = state.items.map(item => ({
          ...item,
          selectedConsumers: item.selectedConsumers?.filter(consumerIndex => consumerIndex !== index)
            .map(consumerIndex => consumerIndex > index ? consumerIndex - 1 : consumerIndex) || [],
          splits: item.splits?.filter(split => split.participantIndex !== index)
            .map(split => ({
              ...split,
              participantIndex: split.participantIndex > index ? split.participantIndex - 1 : split.participantIndex
            }))
        }));
        updateState({ participants: newParticipants, items: newItems });
      } else {
        Alert.alert('Error', 'Cannot remove the last participant');
      }
    }
  }), [state, updateState]);

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
            const updatedParticipants = [...state.participants];
            if (updatedParticipants.length > 0 && updatedParticipants[0].name === 'Me') {
              updatedParticipants[0] = {
                ...updatedParticipants[0],
                name: 'Me',
                userId: currentUser.uid,
                placeholder: false,
                phoneNumber: userProfile.phoneNumber,
                username: userProfile.username,
                profilePhoto: userProfile.profilePhoto
              };
              updateState({ participants: updatedParticipants });
            }
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
      const currentUserId = getCurrentUser()?.uid;
      const existingFriends = expense.participants
        .filter(p => p.name !== 'Me' && !p.placeholder && p.userId && p.userId !== currentUserId)
        .map(p => ({
          id: p.userId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto
        }));
      
      const newParticipants = [
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
      ];
      
      const itemsWithPayers = expense.items?.map(item => ({
        ...item,
        selectedPayers: item.selectedPayers || [0],
        selectedConsumers: item.selectedConsumers || [0]
      })) || [];
      
      updateState({
        selectedFriends: existingFriends,
        participants: newParticipants,
        title: expense.title || '',
        joinEnabled: expense.join?.enabled ?? true,
        fees: expense.fees || [],
        items: itemsWithPayers,
        selectedPayers: expense.selectedPayers || [0]
      });
    }
  }, [expense, isEditing, createMeParticipant, updateState]);

  // Form change tracking is now handled above with simpler logic

  // Update participants when friends are selected
  useEffect(() => {
    const meParticipant = state.participants.find(p => p.name === 'Me');
    const allParticipants = [
      meParticipant || createMeParticipant(),
      ...state.selectedFriends.map((friend, index) => ({ 
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
    const participantsChanged = JSON.stringify(allParticipants) !== JSON.stringify(state.participants);
    if (participantsChanged) {
      updateState({ participants: allParticipants });
    }
  }, [state.selectedFriends, createMeParticipant, updateState, state.participants]);
  
  // Update initial item to include all participants as consumers when participants change (only for new expenses)
  useEffect(() => {
    if (state.participants.length > 0 && state.items.length > 0 && !isEditing) {
      const allParticipantIndices = state.participants.map((_, index) => index);
      const updatedItems = [...state.items];
      if (updatedItems[0] && !updatedItems[0].name && updatedItems[0].amount === 0) {
        const newItem = {
          ...updatedItems[0],
          selectedConsumers: allParticipantIndices
        };
        
        // Only update if the item actually changed
        const itemChanged = JSON.stringify(newItem) !== JSON.stringify(updatedItems[0]);
        if (itemChanged) {
          updatedItems[0] = newItem;
          updateState({ items: updatedItems });
        }
      }
    }
  }, [state.participants.length, isEditing, updateState]);
  
  // Save functions
  const handleSaveExpense = useCallback(async () => {
    const finalTitle = state.title.trim() || (state.items.length > 0 && state.items[0].name.trim()) || 'Expense';

    if (state.participants.some(p => !p.name.trim())) {
      Alert.alert('Error', 'Please enter names for all participants');
      return;
    }

    if (state.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    const invalidItems = state.items.filter(item => {
      if (!item.name || !item.name.trim()) return true;
      if (item.amount !== null && item.amount !== undefined && item.amount !== '') {
        const numAmount = parseFloat(item.amount);
        if (isNaN(numAmount) || numAmount < 0) return true;
      }
      return false;
    });
    
    if (invalidItems.length > 0) {
      Alert.alert('Error', 'Please fill in all item names and ensure amounts are valid (0 or positive numbers)');
      return;
    }

    if (state.fees.some(fee => !fee.name.trim())) {
      Alert.alert('Error', 'Please fill in all fee names');
      return;
    }

    if (!state.selectedPayers || state.selectedPayers.length === 0) {
      Alert.alert('Error', 'Please select at least one person who paid for this expense');
      return;
    }

    updateState({ loading: true });
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) throw new Error('No user signed in');

      const userProfile = await getUserProfile(currentUser.uid);
      if (!userProfile) throw new Error('Failed to get user profile');

      const mappedParticipants = state.participants.map((p) => {
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
        total: total,
        expenseType: 'expense',
        participants: mappedParticipants,
        items: state.items.map(item => ({
          id: item.id,
          name: item.name.trim(),
          amount: item.amount === null || item.amount === undefined || item.amount === '' ? 0 : parseFloat(item.amount) || 0,
          selectedConsumers: item.selectedConsumers || [0],
          splits: item.splits || []
        })),
        fees: state.fees.map(fee => ({
          id: fee.id,
          name: fee.name.trim(),
          amount: fee.amount === null || fee.amount === undefined || fee.amount === '' ? 0 : parseFloat(fee.amount) || 0,
          type: fee.type || 'fixed',
          percentage: fee.percentage || null,
          splitType: fee.splitType || 'proportional',
          splits: fee.splits || []
        })),
        selectedPayers: state.selectedPayers || [0],
        join: { enabled: state.joinEnabled || false }
      };
      
      if (isEditing) {
        await updateExpenseParticipants(expense.id, expenseData.participants, currentUser.uid);
        const { participants, ...otherFields } = expenseData;
        await updateExpense(expense.id, otherFields, currentUser.uid);
        Alert.alert('Success', 'Expense updated successfully');
        resetChanges();
      } else {
        await createExpense(expenseData, currentUser.uid);
        Alert.alert('Success', 'Expense created successfully');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense: ' + error.message);
    } finally {
      updateState({ loading: false });
    }
  }, [state, total, isEditing, expense, navigation, resetChanges, updateState]);

  const saveExpenseSilently = useCallback(async () => {
    const finalTitle = state.title.trim() || 'Expense';
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('No user signed in');

    const userProfile = await getUserProfile(currentUser.uid);
    if (!userProfile) throw new Error('Failed to get user profile');

    const mappedParticipants = state.participants.map((p) => {
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

    const expenseData = {
      title: finalTitle,
      total: total,
      expenseType: 'expense',
      participants: mappedParticipants,
      items: state.items.map(item => ({
        id: item.id || null,
        name: item.name.trim(),
        amount: item.amount === null || item.amount === undefined || item.amount === '' ? 0 : parseFloat(item.amount) || 0,
        selectedConsumers: item.selectedConsumers || [0],
        splits: item.splits || [],
        selectedPayers: item.selectedPayers || [0]
      })),
      fees: state.fees.map(fee => ({
        id: fee.id || null,
        name: fee.name.trim(),
        amount: fee.amount === null || fee.amount === undefined || fee.amount === '' ? 0 : parseFloat(fee.amount) || 0,
        type: fee.type || 'fixed',
        percentage: fee.percentage || null,
        splitType: fee.splitType || 'proportional',
        splits: fee.splits || []
      })),
      selectedPayers: state.selectedPayers || [0],
      join: { enabled: state.joinEnabled || false },
      createdBy: currentUser.uid,
      createdAt: expense?.createdAt || new Date()
    };

    if (isEditing && expense?.id) expenseData.id = expense.id;

    if (isEditing) {
      await updateExpenseParticipants(expense.id, expenseData.participants, currentUser.uid);
      const { participants, ...otherFields } = expenseData;
      await updateExpense(expense.id, otherFields, currentUser.uid);
    } else {
      await createExpense(expenseData, currentUser.uid);
    }

    resetChanges();
  }, [state, total, isEditing, expense, resetChanges]);

  const handleSettleNow = useCallback(async () => {
    try {
      await saveExpenseSilently();
      navigation.navigate('SettleUp', {
        expense: {
          title: state.title,
          participants: state.participants,
          items: state.items,
          fees: state.fees,
          selectedPayers: state.selectedPayers,
          joinEnabled: state.joinEnabled,
          ...(isEditing && expense ? { id: expense.id } : {})
        },
        participants: state.participants
      });
    } catch (error) {
      console.error('Error saving expense before settlement:', error);
      navigation.navigate('SettleUp', {
        expense: {
          title: state.title,
          participants: state.participants,
          items: state.items,
          fees: state.fees,
          selectedPayers: state.selectedPayers,
          joinEnabled: state.joinEnabled,
          ...(isEditing && expense ? { id: expense.id } : {})
        },
        participants: state.participants
      });
    }
  }, [saveExpenseSilently, navigation, state, isEditing, expense]);

  const handleSettleLater = useCallback(async () => {
    await handleSaveExpense();
  }, [handleSaveExpense]);

  // Unified item rendering component
  const renderExpenseItem = useCallback((item, index) => {
    const togglePayer = (participantIndex) => {
      const newPayers = item.selectedPayers.includes(participantIndex)
        ? item.selectedPayers.filter(i => i !== participantIndex)
        : [...item.selectedPayers, participantIndex];
      
      const updatedItems = [...state.items];
      updatedItems[index].selectedPayers = newPayers;
      updateState({ items: updatedItems });
    };

    const toggleConsumer = (participantIndex) => {
      const newConsumers = item.selectedConsumers.includes(participantIndex)
        ? item.selectedConsumers.filter(i => i !== participantIndex)
        : [...item.selectedConsumers, participantIndex];
      
      if (newConsumers.length > 0) {
        actions.updateItem(index, 'selectedConsumers', newConsumers);
      }
    };

    return (
      <Card 
        key={item.id} 
        variant="default" 
        padding="large" 
        margin="none"
        style={{ 
          marginBottom: 16,
          backgroundColor: Colors.surfaceLight
        }}
      >
        {/* Item Header with Delete Button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <View style={itemStyles.itemHeader}>
              <View style={itemStyles.itemNameContainer}>
                <Text style={itemStyles.itemNameLabel}>Item Name</Text>
                <TextInput
                  style={itemStyles.itemNameInput}
                  placeholder="Enter item name"
                  placeholderTextColor={Colors.textSecondary}
                  value={item.name}
                  onChangeText={(text) => actions.updateItem(index, 'name', text)}
                />
              </View>
            </View>
          </View>
          {state.items.length > 1 && (
            <DeleteButton
              onPress={() => {
                const updatedItems = state.items.filter((_, i) => i !== index);
                updateState({ items: updatedItems });
              }}
              size="small"
              variant="subtle"
              style={{ marginLeft: 8 }}
            />
          )}
        </View>

        {/* Price Section */}
        <View style={priceStyles.priceSection}>
          <Text style={priceStyles.priceLabel}>Price</Text>
          <View style={priceStyles.priceInputContainer}>
            <PriceInput
              value={item.amount}
              onChangeText={(amount) => actions.updateItem(index, 'amount', amount)}
              placeholder="0.00"
              style={priceStyles.amountInput}
              showCurrency={true}
            />
          </View>
          
          {/* Who Paid Section */}
          <View style={priceStyles.whoPaidSection}>
            <Text style={priceStyles.whoPaidLabel}>Payers</Text>        
            <View style={priceStyles.payerChips}>
              {state.participants.map((participant, pIndex) => (
                <TouchableOpacity
                  key={pIndex}
                  style={[
                    priceStyles.payerChip,
                    item.selectedPayers.includes(pIndex) && priceStyles.payerChipActive
                  ]}
                  onPress={() => togglePayer(pIndex)}
                  activeOpacity={0.7}
                >
                  <View style={priceStyles.payerChipContent}>
                    {item.selectedPayers.includes(pIndex) && (
                      <View style={priceStyles.checkmarkContainer}>
                        <Ionicons name="checkmark" size={12} color={Colors.surface} />
                      </View>
                    )}
                    <Text style={[
                      priceStyles.payerChipText,
                      item.selectedPayers.includes(pIndex) && priceStyles.payerChipTextActive
                    ]}>
                      {participant.name || `Person ${pIndex + 1}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {item.selectedPayers.length > 0 && (
              <View style={priceStyles.payerSummary}>
                <Text style={priceStyles.payerSummaryText}>
                  {item.selectedPayers.length} {item.selectedPayers.length === 1 ? 'person' : 'people'} paying
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Split Section */}
        <View style={splitStyles.container}>
          <Text style={splitStyles.label}>Split</Text>
          
          <View style={splitStyles.splitCard}>
            {item.selectedConsumers.length > 0 && (
              <View style={splitStyles.consumerInfo}>
                <Text style={splitStyles.consumerCount}>
                  {item.selectedConsumers.length} {item.selectedConsumers.length === 1 ? 'person' : 'people'} selected
                </Text>
              </View>
            )}

            <SmartSplitInput
              participants={state.participants}
              total={parseFloat(item.amount) || 0}
              initialSplits={item.splits || []}
              onSplitsChange={(newSplits) => {
                const updatedItems = [...state.items];
                updatedItems[index].splits = newSplits;
                updateState({ items: updatedItems });
              }}
              selectedConsumers={item.selectedConsumers}
              renderRow={(participant, pIndex, splitState, handlers) => {
                const isSelected = item.selectedConsumers.includes(pIndex);
                
                return (
                  <View key={pIndex} style={pIndex === 0 ? splitStyles.splitRowFirst : splitStyles.splitRow}>
                    <TouchableOpacity
                      style={[
                        splitStyles.checkbox,
                        isSelected && splitStyles.checkboxSelected
                      ]}
                      onPress={() => toggleConsumer(pIndex)}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </TouchableOpacity>

                    <View style={splitStyles.participantInfo}>
                      <View style={splitStyles.participantTextContainer}>
                        <Text 
                          style={[
                            splitStyles.participantName,
                            !isSelected && splitStyles.participantNameDisabled
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {participant.name || `Person ${pIndex + 1}`}
                        </Text>
                        {participant.username && (
                          <Text 
                            style={[
                              splitStyles.participantUsername,
                              !isSelected && splitStyles.participantUsernameDisabled
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            @{participant.username}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={splitStyles.inputContainer}>
                      <PriceInput
                        value={isSelected ? splitState.amount : 0}
                        onChangeText={handlers.onAmountChange}
                        onBlur={handlers.onBlur}
                        placeholder="0.00"
                        style={[
                          splitStyles.amountInput,
                          !isSelected && splitStyles.disabledAmountInput
                        ]}
                        editable={isSelected}
                        showCurrency={true}
                        selected={isSelected}
                      />
                    </View>

                    <TouchableOpacity
                      style={[
                        splitStyles.lockButton,
                        splitState.locked && splitStyles.lockButtonLocked,
                        isSelected ? splitStyles.lockButtonSelected : splitStyles.lockButtonUnselected
                      ]}
                      onPress={handlers.onToggleLock}
                      disabled={!isSelected}
                    >
                      <Ionicons 
                        name={splitState.locked ? "lock-closed" : "lock-open"} 
                        size={18} 
                        color={splitState.locked ? Colors.accent : Colors.textSecondary} 
                      />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Card>
    );
  }, [state, actions, updateState]);


  return (
    <View style={styles.container}>
      <ExpenseHeader
        title={isEditing ? 'Edit Expense' : 'Add Expense'}
        onBackPress={() => navigation.goBack()}
        onSettingsPress={() => navigation.navigate('ExpenseSettings', { expense: { 
          id: expense?.id,
          title: state.title,
          participants: state.participants,
          items: state.items,
          fees: state.fees,
          createdBy: getCurrentUser()?.uid,
          join: { enabled: state.joinEnabled }
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
          {/* Expense Title Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expense Title</Text>
            <TextInput
              style={styles.titleInput}
              value={state.title}
              onChangeText={(text) => updateState({ title: text })}
              placeholder="Enter expense title..."
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Participants</Text>
              <View style={styles.participantsCount}>
                <Text style={styles.participantsCountText}>
                  {state.participants.length} {state.participants.length === 1 ? 'person' : 'people'}
                </Text>
              </View>
            </View>
            
            <ParticipantsGrid
              participants={state.participants}
              selectedFriends={state.selectedFriends}
              onFriendsChange={(friends) => updateState({ selectedFriends: friends })}
              onParticipantPress={(participant, index) => {
                if (participant.userId && participant.userId !== getCurrentUser()?.uid) {
                  navigation.navigate('FriendProfile', { friendId: participant.userId });
                }
              }}
              participantsExpanded={state.participantsExpanded}
              onToggleExpanded={() => updateState({ participantsExpanded: !state.participantsExpanded })}
              expenseId={expense?.id}
              currentUserId={getCurrentUser()?.uid}
            />
          </View>

          {/* Items Section */}
          <Text style={styles.sectionTitle}>Items</Text>
          
          {state.items.map((item, index) => renderExpenseItem(item, index))}
          
          {/* Add Item Button - Below the item cards */}
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() => {
              actions.addItem();
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={Colors.accent} />
            <Text style={styles.addItemText}>Add Item</Text>
          </TouchableOpacity>
        </ScrollView>

        <ExpenseFooter
          isEditing={isEditing}
          loading={state.loading}
          onSavePress={handleSettleLater}
          onSettlePress={handleSettleNow}
        />
      </KeyboardAvoidingView>

      {/* All Participants Modal */}
      <Modal
        visible={state.showAllParticipants}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => updateState({ showAllParticipants: false })}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => updateState({ showAllParticipants: false })}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>All Participants</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.allParticipantsList}>
              {state.participants.map((participant, index) => (
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
                          updateState({ showAllParticipants: false });
                          actions.removeParticipant(index);
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
        visible={state.showGroupMembers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => updateState({ showGroupMembers: false })}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => updateState({ showGroupMembers: false })}
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
                selectedFriends={state.selectedFriends}
                onFriendsChange={(friends) => updateState({ selectedFriends: friends })}
                placeholder="Add friends to split with..."
                expenseId={expense?.id}
                showAddButton={false}
              />
            </View>
            
            {/* Current Participants List */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Current Participants</Text>
              <View style={styles.currentParticipantsList}>
                {state.participants.map((participant, index) => (
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
                            updateState({ showGroupMembers: false });
                            actions.removeParticipant(index);
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




  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    minWidth: 160,
    gap: Spacing.sm,
  },
  addItemText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 16,
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

// Style definitions for unified components
const itemStyles = StyleSheet.create({
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemNameLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemNameInput: {
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
});

const priceStyles = StyleSheet.create({
  priceSection: {
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceInputContainer: {
    flex: 1,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amountInput: {
    marginBottom: Spacing.sm,
    minHeight: 48,
  },
  whoPaidSection: {
    marginBottom: Spacing.sm,
  },
  whoPaidLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  payerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  payerChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
    elevation: 1,
  },
  payerChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.button,
    elevation: 2,
  },
  payerChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  payerChipText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 12,
  },
  payerChipTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  checkmarkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
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

const splitStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  splitRowFirst: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderBottomColor: Colors.border,
    borderTopColor: Colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  participantTextContainer: {
    flexDirection: 'column',
  },
  participantName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    fontSize: 15,
  },
  participantNameDisabled: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  participantUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  participantUsernameDisabled: {
    opacity: 0.6,
  },
  inputContainer: {
    width: 90,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    textAlign: 'right',
    ...Typography.body,
    color: Colors.textPrimary,
  },
  disabledAmountInput: {
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  lockButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.border,
  },
  lockButtonSelected: {
    borderColor: Colors.accent,
  },
  lockButtonUnselected: {
    borderColor: Colors.border,
    opacity: 0.6,
  },
  lockButtonLocked: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '20',
  },
  consumerInfo: {
    alignItems: 'center',
  },
  consumerCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});

export default AddExpenseScreen;
