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
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';

import FriendSelector from '../components/FriendSelector';
import InviteFriendSheet from '../components/InviteFriendSheet';
import PriceInput from '../components/PriceInput';
import { PaidBySection } from './AddExpenseScreenItems';
import {
  addItem,
  updateItem,
  updateItemSplit,
  removeItem,
  addFee,
  updateFee,
  removeFee,
  saveExpense,
  addParticipant,
  updateParticipant,
  removeParticipant
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
  const [inviteTarget, setInviteTarget] = useState(null); // { name, phone }

  const [joinEnabled, setJoinEnabled] = useState(true);
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

  const [receiptWidth, setReceiptWidth] = useState(0);
  const [editingItem, setEditingItem] = useState(null); // {index, field, value}
  const [editingFee, setEditingFee] = useState(null); // {index, field, value}
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [customTipValue, setCustomTipValue] = useState('');
  const [customTipType, setCustomTipType] = useState('percentage'); // 'percentage' or 'amount'
  const friendSelectorRef = useRef(null);
  const scrollViewRef = useRef(null);

  const ZIGZAG_HEIGHT = 14; // depth of teeth (bigger)
  const ZIGZAG_STEP = 22;   // width of teeth (slightly wider)

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

  const removeTip = () => setFees(prev => prev.filter(fee => fee.name !== 'Tip'));
  const setTipAmount = (amount) => setFees(prev => [
    ...prev.filter(fee => fee.name !== 'Tip'),
    { id: Date.now().toString(), name: 'Tip', amount: Number(amount).toFixed(2) }
  ]);

  const toggleParticipantsExpanded = () => setParticipantsExpanded(!participantsExpanded);



  const handleNavigateToProfile = (participant) => {
    if (participant.userId && participant.userId !== currentUserId) {
      navigation.navigate('FriendProfile', { friendId: participant.userId });
    }
  };

  const startEditingItem = (index, field, value) => {
    setEditingItem({ index, field, value });
  };

  const startEditingFee = (index, field, value) => {
    setEditingFee({ index, field, value });
  };

  const handleCustomTipTypeChange = (type) => {
    setCustomTipType(type);
    setCustomTipValue('');
    removeTip();
  };

  const handleTipPresetSelect = (tipAmount) => {
    setShowCustomTip(false);
    setCustomTipValue('');
    removeTip();
    setTipAmount(tipAmount);
  };

  const handleCustomTipToggle = () => {
    setShowCustomTip(true);
    removeTip();
  };

  const getZigzagPoints = (width, height, step, invert = false) => {
    const points = [];
    const totalSteps = Math.ceil(width / step);
    if (!invert) {
      // Top: downward triangles
      points.push(`0,0`);
      for (let i = 0; i < totalSteps; i++) {
        const xMid = i * step + step / 2;
        const xNext = (i + 1) * step;
        points.push(`${xMid},${height}`);
        points.push(`${xNext},0`);
      }
      points.push(`${width},0`);
      points.push(`0,0`);
    } else {
      // Bottom: upward triangles
      points.push(`0,${height}`);
      for (let i = 0; i < totalSteps; i++) {
        const xMid = i * step + step / 2;
        const xNext = (i + 1) * step;
        points.push(`${xMid},0`);
        points.push(`${xNext},${height}`);
      }
      points.push(`${width},${height}`);
      points.push(`0,${height}`);
    }
    return points.join(' ');
  };

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
  
  const handleAddParticipant = () => {
    addParticipant(participants, setParticipants);
  };

  const handleUpdateParticipant = (index, name) => {
    updateParticipant(index, name, participants, setParticipants);
  };

  const handleRemoveParticipant = (index) => {
    removeParticipant(index, participants, setParticipants, items, setItems);
  };

  const handleAddItem = () => {
    addItem(items, setItems, participants);
  };

  const handleUpdateItem = (index, field, value) => {
    updateItem(index, field, value, items, setItems, fees, setFees);
  };

  const handleUpdateItemSplit = (itemIndex, participantIndex, amount) => {
    updateItemSplit(itemIndex, participantIndex, amount, items, setItems);
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
      joinEnabled,
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

          {/* Enhanced Receipt Breakdown */}
            {(items.length > 0 || fees.length > 0) && (
            <View
              style={styles.receiptBreakdownContainer}
              onLayout={(e) => setReceiptWidth(e.nativeEvent.layout.width)}
            >
              {receiptWidth > 0 && (
                <>
                  <Svg
                    width={receiptWidth}
                    height={ZIGZAG_HEIGHT}
                    style={styles.zigzagTop}
                  >
                    <Polygon
                      points={getZigzagPoints(receiptWidth, ZIGZAG_HEIGHT, ZIGZAG_STEP, false)}
                      fill={Colors.background}
                    />
                  </Svg>
                  <Svg
                    width={receiptWidth}
                    height={ZIGZAG_HEIGHT}
                    style={styles.zigzagBottom}
                  >
                    <Polygon
                      points={getZigzagPoints(receiptWidth, ZIGZAG_HEIGHT, ZIGZAG_STEP, true)}
                      fill={Colors.background}
                    />
                  </Svg>
                </>
              )}

              <View style={styles.receiptBreakdown}>
                <View style={styles.receiptHeader}>
                  <View style={styles.receiptHeaderLeft}>
                  <Ionicons name="receipt-outline" size={20} color={Colors.accent} />
                  <Text style={styles.receiptTitle}>Receipt Breakdown</Text>
                  </View>
                </View>
                
                {/* Items Section */}
                {items.length > 0 && (
                    <View style={styles.receiptSection}>
                      <Text style={styles.receiptSectionTitle}>Items</Text>
                      {items.map((item, index) => (
                    <View key={item.id} style={styles.receiptItemContainer}>
                      {/* Item Name and Amount Row */}
                      <View style={styles.receiptItemHeader}>
                        <TouchableOpacity 
                          style={styles.receiptItemNameContainer}
                          onPress={() => startEditingItem(index, 'name', item.name || `Item ${index + 1}`)}
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
                          onPress={() => startEditingItem(index, 'amount', item.amount || '0.00')}
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
                     style={styles.addItemButtonBelow}
                     onPress={handleAddItem}
                     activeOpacity={0.8}
                   >
                     <Ionicons name="add" size={20} color={Colors.accent} />
                     <Text style={styles.addItemButtonText}>Add Item</Text>
                   </TouchableOpacity>
                   
                    <View style={styles.receiptSubtotal}>
                     <Text style={styles.receiptSubtotalLabel}>Items Subtotal</Text>
                      <Text style={styles.receiptSubtotalAmount}>
                       ${itemsSubtotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}

               {/* If no items, show add item button */}
               {items.length === 0 && (
                 <View style={styles.receiptSection}>
                   <Text style={styles.receiptSectionTitle}>Items</Text>
                   <TouchableOpacity
                     style={styles.addItemButtonBelow}
                     onPress={handleAddItem}
                     activeOpacity={0.8}
                   >
                     <Ionicons name="add" size={20} color={Colors.accent} />
                     <Text style={styles.addItemButtonText}>Add First Item</Text>
                   </TouchableOpacity>
              </View>
            )}

                               {/* Tips & Fees Section */}
               <View style={styles.receiptSection}>
                 <View style={styles.tipsFeesHeader}>
                   <Text style={styles.receiptSectionTitle}>Tips & Fees</Text>
                   <Text style={styles.splitNote}>Split proportionally by item consumption</Text>
                 </View>
                 
                                  {/* Tip Percentage Selector */}
                 <View style={styles.tipSection}>
                   <Text style={styles.tipLabel}>Tip</Text>
                   <View style={styles.tipPercentageRow}>
                     {[18, 20, 22].map((percentage) => {
                       const tipAmount = (itemsSubtotal * percentage / 100);
                       const isSelected = fees.some(fee => fee.name === 'Tip' && Math.abs(parseFloat(fee.amount) - tipAmount) < 0.01) && !showCustomTip;
                       
                       return (
                         <TouchableOpacity
                           key={percentage}
                           style={[
                             styles.tipPercentageButton,
                             isSelected && styles.tipPercentageButtonSelected
                           ]}
                           onPress={() => handleTipPresetSelect(tipAmount)}
                           activeOpacity={0.8}
                         >
                           <Text style={[
                             styles.tipPercentageText,
                             isSelected && styles.tipPercentageTextSelected
                           ]}>
                             {percentage}%
                           </Text>
                           <Text style={[
                             styles.tipAmountText,
                             isSelected && styles.tipAmountTextSelected
                           ]}>
                             ${tipAmount.toFixed(2)}
                           </Text>
                         </TouchableOpacity>
                       );
                     })}
                     
                     {/* Custom Tip Button */}
                     <TouchableOpacity
                       style={[
                         styles.tipPercentageButton,
                         showCustomTip && styles.tipPercentageButtonSelected
                       ]}
                       onPress={handleCustomTipToggle}
                       activeOpacity={0.8}
                     >
                       <Text style={[
                         styles.customButtonText,
                         showCustomTip && styles.customButtonTextSelected
                       ]}>
                         Custom
                       </Text>
                     </TouchableOpacity>
          </View>

                   {/* Custom Tip Input - Only show when Custom is selected */}
                   {showCustomTip && (
                     <View style={styles.customTipSection}>
                       <Text style={styles.customTipLabel}>Custom tip amount</Text>
                       
                       {/* Toggle between percentage and dollar amount */}
                       <View style={styles.customTipToggle}>
                         <TouchableOpacity
                           style={[
                             styles.customTipToggleButton,
                             styles.customTipToggleLeft,
                             customTipType === 'percentage' && styles.customTipToggleButtonActive
                           ]}
                           onPress={() => handleCustomTipTypeChange('percentage')}
                           activeOpacity={0.8}
                         >
                           <Text style={[
                             styles.customTipToggleText,
                             customTipType === 'percentage' && styles.customTipToggleTextActive
                           ]}>
                             Percentage
                </Text>
                         </TouchableOpacity>
                         
                         <TouchableOpacity
                           style={[
                             styles.customTipToggleButton,
                             styles.customTipToggleRight,
                             customTipType === 'amount' && styles.customTipToggleButtonActive
                           ]}
                           onPress={() => handleCustomTipTypeChange('amount')}
                           activeOpacity={0.8}
                         >
                           <Text style={[
                             styles.customTipToggleText,
                             customTipType === 'amount' && styles.customTipToggleTextActive
                           ]}>
                             Amount
                           </Text>
                         </TouchableOpacity>
              </View>
                       
                       {/* Input field with prefix/suffix */}
                       <View style={styles.customTipInputContainer}>
                         {customTipType === 'amount' && (
                           <Text style={styles.customTipPrefix}>$</Text>
                         )}
                         <TextInput
                           style={[
                             styles.customTipInput,
                             customTipType === 'amount' && styles.customTipInputWithPrefix
                           ]}
                           placeholder={customTipType === 'percentage' ? '15' : '5.00'}
                           placeholderTextColor={Colors.textSecondary}
                           value={customTipValue}
                           keyboardType="numeric"
                           onChangeText={(text) => {
                             setCustomTipValue(text);
                             
                             if (text.trim() === '') {
                               // Remove custom tip if input is cleared
                               removeTip();
                               return;
                             }
                             
                             let tipAmount = 0;
                             const number = parseFloat(text);
                             
                             if (!isNaN(number) && number > 0) {
                               if (customTipType === 'percentage') {
                                 tipAmount = itemsSubtotal * number / 100;
                               } else {
                                 tipAmount = number;
                               }
                                
                               // Remove existing tip and add new one
                               setTipAmount(tipAmount);
                             }
                           }}
                           autoFocus={true}
                         />
                         {customTipType === 'percentage' && (
                           <Text style={styles.customTipSuffix}>%</Text>
                         )}
            </View>
          </View>
                   )}
          </View>

                 {/* Other Fees */}
                 {fees.filter(fee => fee.name !== 'Tip').length > 0 && (
                   <View style={styles.otherFeesSection}>
                     <Text style={styles.otherFeesLabel}>Other Fees</Text>
                     {fees.filter(fee => fee.name !== 'Tip').map((fee, feeIndex) => {
                       const originalIndex = fees.indexOf(fee);
                       return (
                         <View key={fee.id} style={styles.feeRowContainer}>
                           {/* Fee Name */}
                           <TouchableOpacity
                             style={styles.feeNameContainer}
                             onPress={() => startEditingFee(originalIndex, 'name', fee.name || `Fee ${feeIndex + 1}`)}
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
                                 {fee.name || `Fee ${feeIndex + 1}`}
                               </Text>
                             )}
                           </TouchableOpacity>

                           {/* Fee Amount */}
                           <TouchableOpacity
                             style={styles.feeAmountContainer}
                             onPress={() => startEditingFee(originalIndex, 'amount', fee.amount || '0.00')}
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
                 
                 {/* Add Other Fee Button */}
                <TouchableOpacity
                   style={styles.addFeeButtonBelow}
                   onPress={handleAddFee}
                  activeOpacity={0.8}
                >
                   <Ionicons name="add" size={16} color={Colors.accent} />
                   <Text style={styles.addFeeButtonText}>Add Fee</Text>
                </TouchableOpacity>
                 
                 {/* Fees Subtotal */}
                 {fees.length > 0 && (
                   <View style={styles.receiptSubtotal}>
                     <Text style={styles.receiptSubtotalLabel}>Tips & Fees</Text>
                     <Text style={styles.receiptSubtotalAmount}>
                       ${feesSubtotal.toFixed(2)}
                     </Text>
                   </View>
            )}
          </View>

                {/* Total Amount */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Total Amount</Text>
                  <Text style={styles.receiptTotalAmount}>
                    ${calculateTotal().toFixed(2)}
                  </Text>
            </View>
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

      <InviteFriendSheet
        visible={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
        expenseId={expense?.id}
        placeholderName={inviteTarget?.name || ''}
        phoneNumber={inviteTarget?.phone || ''}
      />




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
  // Receipt Breakdown Styles
  receiptBreakdownContainer: {
    marginVertical: Spacing.lg,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
    paddingTop: Spacing.lg, // more space below top zigzag
    paddingBottom: Spacing.lg, // more space above bottom zigzag
    // Receipt paper effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  zigzagTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  zigzagBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  receiptBreakdown: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surfaceLight,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  receiptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  receiptTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  receiptSection: {
    marginBottom: Spacing.md,
  },
  receiptSectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs,
    minHeight: 24,
    paddingHorizontal: Spacing.xs,
  },
  receiptItemLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  receiptItemName: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  receiptItemAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
    minWidth: 60,
  },
  receiptItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  // New inline assignment styles
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
  receiptItemNameInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.accent, // Gold color
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
  // Add Item Button Styles
  addItemButtonBelow: {
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
  addItemButtonText: {
    ...Typography.body,
    color: Colors.accent,
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
  // Tips & Fees Header Styles
  tipsFeesHeader: {
    marginBottom: Spacing.md,
  },
  splitNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  // Tip Section Styles
  tipSection: {
    marginBottom: Spacing.lg,
  },
  tipLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
  tipPercentageRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tipPercentageButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tipPercentageButtonSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tipPercentageText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  tipPercentageTextSelected: {
    color: Colors.white,
  },
  tipAmountText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
    fontSize: 11,
    textAlign: 'center',
  },
  tipAmountTextSelected: {
    color: Colors.white,
    opacity: 0.9,
  },
  // Custom Button Text Styles
  customButtonText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  customButtonTextSelected: {
    color: Colors.white,
  },
  customTipSection: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  customTipLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: '500',
    textAlign: 'center',
    fontSize: 12,
  },
  // Toggle Styles
  customTipToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: 1,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  customTipToggleButton: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  customTipToggleLeft: {
    borderTopLeftRadius: Radius.sm,
    borderBottomLeftRadius: Radius.sm,
  },
  customTipToggleRight: {
    borderTopRightRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  customTipToggleButtonActive: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  customTipToggleText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 12,
  },
  customTipToggleTextActive: {
    color: Colors.white,
  },
  // Input Container Styles
  customTipInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
    minHeight: 32,
    maxWidth: 100,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  customTipPrefix: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    paddingLeft: Spacing.xs,
  },
  customTipSuffix: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    paddingRight: Spacing.xs,
  },
  customTipInput: {
    ...Typography.body,
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
    minWidth: 35,
  },
  customTipInputWithPrefix: {
    paddingLeft: 2,
  },
  // Other Fees Styles
  otherFeesSection: {
    marginBottom: Spacing.lg,
  },
  otherFeesLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
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
  addFeeButtonBelow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  addFeeButtonText: {
    ...Typography.caption,
    color: Colors.accent,
    marginLeft: Spacing.xs,
    fontWeight: '500',
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
  receiptSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  receiptSubtotalLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  receiptSubtotalAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 2,
    borderTopColor: Colors.accent,
  },
  receiptTotalLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  receiptTotalAmount: {
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
