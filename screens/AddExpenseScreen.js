import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { getUserProfile } from '../services/friendService';

import FriendSelector from '../components/FriendSelector';
import InviteFriendSheet from '../components/InviteFriendSheet';
import DeleteButton from '../components/DeleteButton';
import { 
  ItemHeader, 
  PriceInputSection, 
  SmartSplitSection, 
  SplitTypeSection, 
  WhoConsumedSection, 
  FeeHeader, 
  FeeTypeSection, 
  PercentageSection, 
  FixedAmountSection, 
  TotalFeeSection, 
  CombinedConsumersAndSplitSection, 
  PaidBySection 
} from './AddExpenseScreenItems';
import {
  addItem,
  updateItem,
  updateItemSplit,
  removeItem,
  addFee,
  updateFee,
  removeFee,
  saveExpense,
  saveExpenseWithSettlement,
  renderItem,
  removeParticipant,
  removePlaceholder
} from './AddExpenseScreenFunctions';
import useFormChangeTracker from '../hooks/useFormChangeTracker';
import useNavigationWarning from '../hooks/useNavigationWarning';


const AddExpenseScreen = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan, previousScreen } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState([{ 
    name: 'Me',
    id: 'me-participant',
    userId: getCurrentUser()?.uid || null,
    placeholder: false,
    phoneNumber: null,
    username: null,
    profilePhoto: null
  }]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [joinEnabled, setJoinEnabled] = useState(true);
  const [items, setItems] = useState([{
    id: Date.now().toString(),
    name: '',
    amount: 0,
    selectedConsumers: [0],
    splits: []
  }]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayers, setSelectedPayers] = useState([0]);

  const friendSelectorRef = useRef(null);

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
    'You have unsaved changes. Are you sure you want to leave?',
    loading
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
        const firstItem = scannedReceipt.items[0];
        const formattedItem = {
          id: Date.now().toString(),
          name: firstItem.name || '',
          amount: parseFloat(firstItem.amount) || 0,
          selectedConsumers: [0],
          splits: [{
            participantIndex: 0,
            amount: parseFloat(firstItem.amount) || 0,
            percentage: 100
          }]
        };
        setItems([formattedItem]);
      }
      
      setSelectedPayers([0]);
      
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
      
      Alert.alert(
        'Receipt Scanned Successfully!',
        'The receipt information has been automatically filled in. Please review and make any necessary adjustments.',
        [{ text: 'OK' }]
      );
    }
  }, [scannedReceipt, fromReceiptScan]);

  // Initialize selectedFriends and placeholders when editing an existing expense
  useEffect(() => {
    if (expense && isEditing) {
      const existingFriends = expense.participants
        .filter(p => p.name !== 'Me' && !p.placeholder && p.userId && p.userId !== getCurrentUser()?.uid)
        .map(p => ({
          id: p.userId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto
        }));
      
      const existingPlaceholders = expense.participants
        .filter(p => p.placeholder)
        .map(p => ({
          id: p.id || `ghost-${Date.now()}-${Math.random()}`,
          name: p.name,
          phoneNumber: p.phoneNumber,
          isPlaceholder: true
        }));
      
      setSelectedFriends(existingFriends);
      setPlaceholders(existingPlaceholders);

      const initialParticipants = [
        { 
          name: 'Me',
          id: 'me-participant',
          userId: getCurrentUser()?.uid || null,
          placeholder: false,
          phoneNumber: null,
          username: null,
          profilePhoto: null
        },
        ...existingFriends.map((friend, index) => ({ 
          name: friend.name || '', 
          id: `friend-${friend.id || index}`,
          userId: friend.id || null,
          phoneNumber: friend.phoneNumber || null,
          username: friend.username || null,
          profilePhoto: friend.profilePhoto || null,
          placeholder: false
        })),
        ...existingPlaceholders.map((p, index) => ({ 
          name: p.name || '', 
          placeholder: true, 
          id: p.id || `placeholder-${index}`,
          userId: null,
          phoneNumber: p.phoneNumber || null,
          username: null,
          profilePhoto: null
        }))
      ];
      setParticipants(initialParticipants);
      
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
        setItems(expense.items);
      }
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
          id: 'me-participant',
          userId: getCurrentUser()?.uid || null,
          placeholder: false,
          phoneNumber: null,
          username: null,
          profilePhoto: null
        },
        ...selectedFriends.map((friend, index) => ({ 
          name: friend.name || '', 
          id: `friend-${friend.id || index}`,
          userId: friend.id || null,
          phoneNumber: friend.phoneNumber || null,
          username: friend.username || null,
          profilePhoto: friend.profilePhoto || null,
          placeholder: false
        })),
        ...placeholders.map((p, index) => ({ 
          name: p.name || '', 
          placeholder: true, 
          id: p.id || `placeholder-${index}`,
          userId: null,
          phoneNumber: p.phoneNumber || null,
          username: null,
          profilePhoto: null
        }))
      ];
      
      return allParticipants;
    });
  }, [selectedFriends, placeholders]);
  
  const handleRemoveParticipant = (index) => {
    removeParticipant(index, participants, setParticipants, items, setItems);
  };

  const handleAddPlaceholder = (ghost) => {
    setPlaceholders(prev => [...prev, ghost]);
  };

  const handleInvitePlaceholder = (ghost) => {
    setInviteTarget({ name: ghost.name, phone: ghost.phoneNumber || '' });
  };

  const handleRemovePlaceholder = (ghostId) => {
    removePlaceholder(ghostId, placeholders, setPlaceholders, items, setItems, selectedFriends);
  };

  const handleUpdateItem = (index, field, value) => {
    updateItem(index, field, value, items, setItems, fees, setFees);
  };

  const handleUpdateItemSplit = (itemIndex, participantIndex, amount) => {
    updateItemSplit(itemIndex, participantIndex, amount, items, setItems);
  };

  const handleAddItem = () => {
    addItem(items, setItems, participants);
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

  const handleSettleLater = async () => {
    await saveExpense(
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
      resetChanges,
      null
    );
  };

  const handleSettleNow = async () => {
    // Navigate to SettleUp screen with the expense data
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
      selectedPayers,
      setSelectedPayers
    );
  };

  // Render fee using the existing components
  const renderFee = (fee, index) => {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    return (
      <View key={fee.id} style={styles.feeCard}>
        <FeeHeader
          feeName={fee.name}
          onNameChange={(text) => handleUpdateFee(index, 'name', text)}
          onDelete={() => handleRemoveFee(index)}
        />

        <FeeTypeSection
          feeType={fee.type}
          onTypeChange={(type) => handleUpdateFee(index, 'type', type)}
        />

        {fee.type === 'percentage' ? (
          <PercentageSection
            percentage={fee.percentage}
            onPercentageChange={(percentage) => handleUpdateFee(index, 'percentage', percentage)}
                      itemsTotal={itemsTotal}
          />
        ) : (
          <FixedAmountSection
            amount={fee.amount}
            onAmountChange={(amount) => handleUpdateFee(index, 'amount', amount)}
          />
        )}

        <TotalFeeSection feeAmount={fee.amount} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint="light" style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (previousScreen === 'ProfileMain') {
              navigation.getParent()?.navigate('Profile');
              navigation.getParent()?.getParent()?.reset({
                index: 0,
                routes: [
                  {
                    name: 'Home',
                    state: {
                      routes: [{ name: 'HomeMain' }],
                      index: 0,
                    },
                  },
                  { name: 'Profile' },
                ],
              });
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Expense' : 'Add Expense'}
        </Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </BlurView>
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 100, paddingBottom: 120 }}
        >
          {/* Participants Section */}
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
            <View style={styles.participantsGrid}>
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
              
              {participants.slice(0, 5).map((participant, index) => (
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
                    {participant.placeholder && (
                      <View style={styles.placeholderIndicator}>
                        <Ionicons name="person-outline" size={10} color={Colors.surface} />
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
              ))}
              
              {participants.length > 5 && (
                <TouchableOpacity 
                  style={styles.moreParticipantsButton}
                  onPress={() => setShowAllParticipants(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.moreParticipantsIcon}>
                    <Text style={styles.moreParticipantsCount}>+{participants.length - 5}</Text>
                  </View>
                  <Text style={styles.moreParticipantsText}>More</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Group Management Row */}
            <View style={styles.groupManagementRow}>
              <View style={styles.groupInfo}>
                <Text style={styles.groupInfoText}>
                  {participants.length} {participants.length === 1 ? 'person' : 'people'} in this expense
                </Text>
                {placeholders.length > 0 && (
                  <Text style={styles.pendingInvitesText}>
                    {placeholders.length} pending invite{placeholders.length !== 1 ? 's' : ''}
                  </Text>
                )}
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
              allowPlaceholders={true}
              onAddPlaceholder={handleAddPlaceholder}
              expenseId={expense?.id}
              showAddButton={false}
            />
            
            {/* Render placeholder chips with Invite buttons */}
            {placeholders.length > 0 && (
              <View style={styles.placeholdersContainer}>
                <Text style={styles.placeholdersLabel}>Pending Invites</Text>
                {placeholders.map((p, idx) => (
                  <View key={p.id} style={styles.placeholderCard}>
                    <View style={styles.placeholderContent}>
                      <View style={styles.placeholderAvatar}>
                        <Text style={styles.placeholderInitials}>{p.name?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                      <View style={styles.placeholderInfo}>
                        <Text style={styles.placeholderName}>{p.name}</Text>
                        {p.phoneNumber && (
                          <Text style={styles.placeholderPhone}>{p.phoneNumber}</Text>
                        )}
                        <Text style={styles.placeholderTag}>Placeholder</Text>
                      </View>
                    </View>
                    <View style={styles.placeholderActions}>
                      <TouchableOpacity 
                        style={styles.inviteButton} 
                        onPress={() => handleInvitePlaceholder(p)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="qr-code-outline" size={16} color={Colors.surface} />
                        <Text style={styles.inviteButtonText}>Invite</Text>
                      </TouchableOpacity>
                      <DeleteButton
                        onPress={() => handleRemovePlaceholder(p.id)}
                        size="small"
                        variant="subtle"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Items Section */}
          {items.map((item, index) => handleRenderItem(item, index))}

          {/* Add Item Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={handleAddItem}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
              <Text style={styles.addItemButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Fees Section */}
          {fees.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Fees & Tips</Text>
              </View>
              {fees.map((fee, index) => renderFee(fee, index))}
            </View>
          )}

          {/* Add Fee Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.addFeeButton}
              onPress={handleAddFee}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
              <Text style={styles.addFeeButtonText}>Add Fee</Text>
            </TouchableOpacity>
          </View>

          {/* Total Section */}
          <View style={styles.section}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        <BlurView intensity={30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom}]}>
          <View style={styles.buttonContainer}>
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
              {loading ? 'Saving...' : (isEditing ? 'Settle' : 'Settle Now')}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>

      <InviteFriendSheet
        visible={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
        expenseId={expense?.id}
        placeholderName={inviteTarget?.name || ''}
        phoneNumber={inviteTarget?.phone || ''}
      />



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
                      {participant.placeholder && (
                        <View style={styles.placeholderIndicator}>
                          <Ionicons name="person-outline" size={12} color={Colors.surface} />
                        </View>
                      )}
                    </View>
                    <View style={styles.allParticipantInfo}>
                      <Text style={styles.allParticipantName}>{participant.name}</Text>
                      {participant.username && (
                        <Text style={styles.allParticipantUsername}>@{participant.username}</Text>
                      )}
                      {participant.placeholder && (
                        <Text style={styles.allParticipantTag}>Placeholder</Text>
                      )}
                      {participant.name === 'Me' && (
                        <Text style={styles.allParticipantTag}>You</Text>
                      )}
                    </View>
                  </View>
                  {participant.name !== 'Me' && (
                    <View style={styles.allParticipantActions}>
                      {participant.placeholder ? (
                        <TouchableOpacity 
                          style={styles.inviteButton} 
                          onPress={() => {
                            setShowAllParticipants(false);
                            handleInvitePlaceholder(participant);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="qr-code-outline" size={16} color={Colors.surface} />
                          <Text style={styles.inviteButtonText}>Invite</Text>
                        </TouchableOpacity>
                      ) : (
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
                      )}
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
                allowPlaceholders={true}
                onAddPlaceholder={handleAddPlaceholder}
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
                        {participant.placeholder && (
                          <View style={styles.placeholderIndicator}>
                            <Ionicons name="person-outline" size={12} color={Colors.surface} />
                          </View>
                        )}
                      </View>
                      <View style={styles.currentParticipantInfo}>
                        <Text style={styles.currentParticipantName}>{participant.name}</Text>
                        {participant.username && (
                          <Text style={styles.currentParticipantUsername}>@{participant.username}</Text>
                        )}
                        {participant.placeholder && (
                          <Text style={styles.currentParticipantTag}>Placeholder</Text>
                        )}
                        {participant.name === 'Me' && (
                          <Text style={styles.currentParticipantTag}>You</Text>
                        )}
                      </View>
                    </View>
                    {participant.name !== 'Me' && (
                      <View style={styles.currentParticipantActions}>
                        {participant.placeholder ? (
                          <TouchableOpacity 
                            style={styles.inviteButton} 
                            onPress={() => {
                              setShowGroupMembers(false);
                              handleInvitePlaceholder(participant);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="qr-code-outline" size={16} color={Colors.surface} />
                            <Text style={styles.inviteButtonText}>Invite</Text>
                          </TouchableOpacity>
                        ) : (
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
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSettings(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Expense Settings</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.modalContent}>
            {/* Participants Management Section */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Manage Participants</Text>
              <FriendSelector
                selectedFriends={selectedFriends}
                onFriendsChange={setSelectedFriends}
                placeholder="Add friends to split with..."
                allowPlaceholders={true}
                onAddPlaceholder={handleAddPlaceholder}
                expenseId={expense?.id}
                showAddButton={false}
              />
            </View>
            
            {/* Settings Section */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Expense Settings</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Allow join by room code</Text>
                  <Text style={styles.settingDescription}>
                    Let others join this expense using the room code
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    joinEnabled && styles.toggleButtonActive
                  ]}
                  onPress={() => setJoinEnabled(!joinEnabled)}
                >
                  <View style={[
                    styles.toggleThumb,
                    joinEnabled && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
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
    backgroundColor: Colors.background,
    ...Shadows.card,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
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
  placeholderPhone: { ...Typography.caption, color: Colors.textSecondary, fontSize: 12 },
  placeholderTag: { ...Typography.label, color: Colors.textSecondary, fontSize: 11, fontStyle: 'italic' },
  placeholderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeholderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  settingDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  toggleButton: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleButtonActive: {
    backgroundColor: Colors.accent,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  settleLaterButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.button,
  },
  settleNowButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    ...Shadows.button,
  },
  buttonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  settleLaterButtonText: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  settleNowButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
  lastSection: {
    marginBottom: 0,
  },
  placeholdersContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  placeholdersLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.card,
    elevation: 2,
    minHeight: 72,
  },
  placeholderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  placeholderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  placeholderName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },


  placeholderIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    ...Shadows.button,
    elevation: 2,
  },

  // Essential grid styles
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  participantGridItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: Spacing.md,
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
    width: '30%',
    marginBottom: Spacing.md,
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
  moreParticipantsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '30%',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 100,
  },
  moreParticipantsIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.divider,
  },
  moreParticipantsCount: {
    ...Typography.title,
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 16,
  },
  moreParticipantsText: {
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

  feeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    ...Shadows.card,
    elevation: 2,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    ...Shadows.button,
    elevation: 2,
  },
  addItemButtonText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  addFeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    ...Shadows.button,
    elevation: 2,
  },
  addFeeButtonText: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    ...Shadows.card,
    elevation: 2,
  },
  totalLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  totalAmount: {
    ...Typography.h3,
    color: Colors.accent,
    fontWeight: '700',
  },

});

export default AddExpenseScreen;
