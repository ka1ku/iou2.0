import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { createExpense, updateExpense } from '../services/expenseService';
import FriendSelector from '../components/FriendSelector';
import InviteFriendSheet from '../components/InviteFriendSheet';
import PriceInput from '../components/PriceInput';
import DeleteButton from '../components/DeleteButton';
import { ItemHeader, PriceInputSection, PaidBySection, SmartSplitSection, SplitTypeSection, WhoConsumedSection } from './AddExpenseScreenItems';

const AddExpenseScreen = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState([{ name: 'Me' }]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null); // { name, phone }
  const [showSettings, setShowSettings] = useState(false);
  const [joinEnabled, setJoinEnabled] = useState(true);
  const [items, setItems] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayers, setSelectedPayers] = useState([0]); // Default to "Me"

  // Calculate total from items and fees
  const calculateTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const feesTotal = fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    return itemsTotal + feesTotal;
  };

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Expense' : 'Add Expense',
    });
  }, [isEditing, navigation]);

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
          selectedConsumers: [0], // Default to first participant
          splits: [{
            participantIndex: 0,
            amount: parseFloat(item.amount) || 0,
            percentage: 100
          }]
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

  // Initialize selectedFriends and placeholders when editing an existing expense
  useEffect(() => {
    if (expense && isEditing) {
      // Extract friends from existing participants
      const existingFriends = expense.participants
        .filter(p => p.name !== 'Me' && !p.placeholder && p.userId)
        .map(p => ({
          id: p.userId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto
        }));
      
      // Extract placeholders from existing participants
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
      
      // Set initial participants (this will be updated by the other useEffect)
      const initialParticipants = [
        { name: 'Me' },
        ...existingFriends.map(friend => ({ 
          name: friend.name, 
          userId: friend.id,
          phoneNumber: friend.phoneNumber,
          username: friend.username,
          profilePhoto: friend.profilePhoto
        })),
        ...existingPlaceholders.map(p => ({ 
          name: p.name, 
          placeholder: true, 
          id: p.id
        }))
      ];
      setParticipants(initialParticipants);
      
      // Set title and other fields from existing expense
      if (expense.title) {
        setTitle(expense.title);
      }
      if (expense.join) {
        setJoinEnabled(expense.join.enabled);
      }
      
      // Set items and fees from existing expense
      if (expense.items) {
        // Transform old items to new structure if needed
        const transformedItems = expense.items.map(item => {
          const consumers = item.selectedConsumers || [item.paidBy || 0];
          const amount = parseFloat(item.amount) || 0;
          
          let splits = item.splits || [];
          if (splits.length === 0 && consumers.length > 0 && amount > 0) {
            if (consumers.length === 1) {
              // Single consumer gets 100% of the amount
              splits = [{
                participantIndex: consumers[0],
                amount: amount,
                percentage: 100
              }];
            } else {
              // Multiple consumers split evenly
              const splitAmount = amount / consumers.length;
              splits = consumers.map((consumerIndex, i) => ({
                participantIndex: consumerIndex,
                amount: splitAmount,
                percentage: 100 / consumers.length
              }));
            }
          }
          
          return {
            ...item,
            selectedConsumers: consumers,
            splits: splits,
            // Remove old paidBy field
            paidBy: undefined
          };
        });
        setItems(transformedItems);
      }
      if (expense.fees) {
        setFees(expense.fees);
      }
      
      // Set selected payers if available
      if (expense.selectedPayers) {
        setSelectedPayers(expense.selectedPayers);
      }
    }
  }, [expense, isEditing]);

  const addParticipant = () => {
    setParticipants([...participants, { name: '' }]);
  };

  const updateParticipant = (index, name) => {
    const updated = [...participants];
    updated[index] = { name };
    setParticipants(updated);
  };

  const removeParticipant = (index) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
      // Update item splits and selectedConsumers to remove this participant
      setItems(items.map(item => ({
        ...item,
        selectedConsumers: item.selectedConsumers?.filter(consumerIndex => consumerIndex !== index)
          .map(consumerIndex => consumerIndex > index ? consumerIndex - 1 : consumerIndex) || [],
        splits: item.splits?.filter(split => split.participantIndex !== index)
          .map(split => ({
            ...split,
            participantIndex: split.participantIndex > index ? split.participantIndex - 1 : split.participantIndex
          }))
      })));
    } else {
      Alert.alert('Error', 'No participants');
    }
  };

  // Update participants when friends are selected
  useEffect(() => {
    const allParticipants = [
      { name: 'Me' },
      ...selectedFriends.map(friend => ({ 
        name: friend.name, 
        userId: friend.id,
        phoneNumber: friend.phoneNumber,
        username: friend.username,
        profilePhoto: friend.profilePhoto
      })),
      ...placeholders.map(p => ({ 
        name: p.name, 
        placeholder: true, 
        id: p.id
      }))
    ];
    setParticipants(allParticipants);
    
    // Clean up any invalid selectedConsumers references
    setItems(prevItems => prevItems.map(item => ({
      ...item,
      selectedConsumers: item.selectedConsumers?.filter(index => index < allParticipants.length) || [0]
    })));
  }, [selectedFriends, placeholders]);

  const handleAddPlaceholder = (ghost) => {
    setPlaceholders(prev => [...prev, ghost]);
  };

  const handleInvitePlaceholder = (ghost) => {
    setInviteTarget({ name: ghost.name, phone: ghost.phoneNumber || '' });
  };

  const removePlaceholder = (ghostId) => {
    const indexInPlaceholders = placeholders.findIndex(p => p.id === ghostId);
    if (indexInPlaceholders < 0) return;
    // Compute participant index in the combined participants array
    const removedParticipantIndex = 1 + selectedFriends.length + indexInPlaceholders; // 0 is Me

    // Adjust item splits and selectedConsumers similar to previous removeParticipant logic
    setItems(prevItems => prevItems.map(item => ({
      ...item,
      selectedConsumers: item.selectedConsumers?.filter(consumerIndex => consumerIndex !== removedParticipantIndex)
        .map(consumerIndex => consumerIndex > removedParticipantIndex ? consumerIndex - 1 : consumerIndex) || [],
      splits: item.splits?.filter(split => split.participantIndex !== removedParticipantIndex)
        .map(split => ({
          ...split,
          participantIndex: split.participantIndex > removedParticipantIndex ? split.participantIndex - 1 : split.participantIndex
        })) || []
    })));

    setPlaceholders(prev => prev.filter(p => p.id !== ghostId));
  };

  const addItem = () => {
    const newItem = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      selectedConsumers: participants.length > 0 ? [0] : [], // Default to first participant (usually "Me")
      splits: []
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // If amount changed, recalculate splits
    if (field === 'amount') {
      const amount = parseFloat(value) || 0;
      const selectedConsumers = updated[index].selectedConsumers || [0];
      if (selectedConsumers.length > 0) {
        if (selectedConsumers.length === 1) {
          // Single consumer gets 100% of the amount
          updated[index].splits = [{
            participantIndex: selectedConsumers[0],
            amount: amount,
            percentage: 100
          }];
        } else {
          // Multiple consumers split evenly
          const splitAmount = amount / selectedConsumers.length;
          updated[index].splits = selectedConsumers.map((consumerIndex, i) => ({
            participantIndex: consumerIndex,
            amount: splitAmount,
            percentage: 100 / selectedConsumers.length
          }));
        }
      }
    }
    
    setItems(updated);
    
    // Recalculate percentage-based fees when items change
    if (field === 'amount') {
      const updatedFees = fees.map(fee => {
        if (fee.type === 'percentage') {
          const itemsTotal = updated.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
          return { ...fee, amount: (itemsTotal * fee.percentage) / 100 };
        }
        return fee;
      });
      setFees(updatedFees);
    }
  };

  const updateItemSplit = (itemIndex, participantIndex, amount) => {
    const updated = [...items];
    const item = updated[itemIndex];
    
    if (!item.splits) {
      item.splits = [];
    }
    
    const existingSplitIndex = item.splits.findIndex(s => s.participantIndex === participantIndex);
    if (existingSplitIndex >= 0) {
      item.splits[existingSplitIndex].amount = amount || 0;
    } else {
      item.splits.push({
        participantIndex,
        amount: amount || 0
      });
    }
    
    setItems(updated);
  };

  const removeItem = (index) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    
    // Recalculate percentage-based fees when items are removed
    const updatedFees = fees.map(fee => {
      if (fee.type === 'percentage') {
        const itemsTotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        return { ...fee, amount: (itemsTotal * fee.percentage) / 100 };
      }
      return fee;
    });
    setFees(updatedFees);
  };

  const addFee = () => {
    const newFee = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'percentage', // 'percentage' or 'fixed'
      percentage: 15, // default 15% tip
      splitType: 'proportional', // 'equal' or 'proportional'
      splits: []
    };
    setFees([...fees, newFee]);
  };

  const updateFee = (index, field, value) => {
    const updated = [...fees];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate amount if percentage changed
    if (field === 'percentage' && updated[index].type === 'percentage') {
      const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      updated[index].amount = (itemsTotal * value) / 100;
    }
    
    // Recalculate amount if type changed from fixed to percentage
    if (field === 'type' && value === 'percentage') {
      const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      updated[index].amount = (itemsTotal * (updated[index].percentage || 15)) / 100;
    }
    

    
    setFees(updated);
  };

  const removeFee = (index) => {
    setFees(fees.filter((_, i) => i !== index));
  };

  const saveExpense = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an expense title');
      return;
    }

    if (participants.some(p => !p.name.trim())) {
      Alert.alert('Error', 'Please enter names for all participants');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    if (items.some(item => !item.name.trim() || !item.amount || parseFloat(item.amount) <= 0)) {
      Alert.alert('Error', 'Please fill in all item details with valid amounts');
      return;
    }

    if (fees.some(fee => !fee.name.trim())) {
      Alert.alert('Error', 'Please fill in all fee names');
      return;
    }

    setLoading(true);
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('No user signed in');
      }

      const expenseData = {
        title: title.trim(),
        total: calculateTotal(),
        participants: participants.map(p => ({ 
          name: p.name.trim(),
          userId: p.userId,
          placeholder: p.placeholder,
          phoneNumber: p.phoneNumber,
          username: p.username,
          profilePhoto: p.profilePhoto
        })),
        items: items.map(item => ({
          ...item,
          name: item.name.trim(),
          amount: parseFloat(item.amount)
        })),
        fees: fees.map(fee => ({
          ...fee,
          name: fee.name.trim(),
          amount: parseFloat(fee.amount)
        })),
        selectedPayers: selectedPayers,
        join: {
          enabled: joinEnabled,
        }
      };

      if (isEditing) {
        await updateExpense(expense.id, expenseData, currentUser.uid);
        Alert.alert('Success', 'Expense updated successfully');
      } else {
        await createExpense(expenseData, currentUser.uid);
        Alert.alert('Success', 'Expense created successfully');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = (item, index) => {
    return (
      <View key={item.id} style={styles.itemCard}>
        <ItemHeader
          itemName={item.name}
          onNameChange={(text) => updateItem(index, 'name', text)}
          onDelete={() => removeItem(index)}
        />

        <PriceInputSection
          amount={item.amount}
          onAmountChange={(amount) => updateItem(index, 'amount', amount)}
        />

        <WhoConsumedSection
          participants={participants}
          selectedConsumers={item.selectedConsumers || [0]}
          onConsumersChange={(consumers) => {
            const updated = [...items];
            updated[index].selectedConsumers = consumers;
            // Recalculate splits for new consumers
            const amount = parseFloat(updated[index].amount) || 0;
            if (amount > 0 && consumers.length > 0) {
              if (consumers.length === 1) {
                // Single consumer gets 100% of the amount
                updated[index].splits = [{
                  participantIndex: consumers[0],
                  amount: amount,
                  percentage: 100
                }];
              } else {
                // Multiple consumers split evenly
                const splitAmount = amount / consumers.length;
                updated[index].splits = consumers.map((consumerIndex, i) => ({
                  participantIndex: consumerIndex,
                  amount: splitAmount,
                  percentage: 100 / consumers.length
                }));
              }
            } else {
              updated[index].splits = [];
            }
            setItems(updated);
          }}
        />

        <SmartSplitSection
          participants={participants}
          selectedConsumers={item.selectedConsumers || [0]}
          total={parseFloat(item.amount) || 0}
          initialSplits={item.splits || []}
          onSplitsChange={(newSplits) => {
            // Update the item's splits
            const updated = [...items];
            updated[index].splits = newSplits;
            setItems(updated);
          }}
        />
      </View>
    );
  };

  const renderFee = (fee, index) => {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    return (
      <View key={fee.id} style={styles.feeCard}>
        {/* Fee Header with Name Input and Delete Button */}
        <View style={styles.feeHeader}>
          <View style={styles.feeNameContainer}>
            <Text style={styles.feeNameLabel}>Fee Name</Text>
            <TextInput
              style={styles.feeNameInput}
              placeholder="e.g., Tip, Tax, Service"
              placeholderTextColor={Colors.textSecondary}
              value={fee.name}
              onChangeText={(text) => updateFee(index, 'name', text)}
            />
          </View>
          <DeleteButton
            onPress={() => removeFee(index)}
            size="medium"
            variant="subtle"
          />
        </View>

        {/* Fee Type Section */}
        <View style={styles.feeTypeSection}>
          <Text style={styles.feeTypeLabel}>Fee Type</Text>
          <View style={styles.feeTypeContainer}>
            <TouchableOpacity
              style={[
                styles.feeTypeButton,
                fee.type === 'percentage' && styles.feeTypeButtonActive
              ]}
              onPress={() => updateFee(index, 'type', 'percentage')}
            >
              <Text style={[
                styles.feeTypeText,
                fee.type === 'percentage' && styles.feeTypeTextActive
              ]}>
                Percentage
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.feeTypeButton,
                fee.type === 'fixed' && styles.feeTypeButtonActive
              ]}
              onPress={() => updateFee(index, 'type', 'fixed')}
            >
              <Text style={[
                styles.feeTypeText,
                fee.type === 'fixed' && styles.feeTypeTextActive
              ]}>
                Fixed Amount
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Percentage Section */}
        {fee.type === 'percentage' ? (
          <View style={styles.percentageSection}>
            <Text style={styles.percentageLabel}>Percentage</Text>
            <View style={styles.percentageButtons}>
              {[10, 15, 18, 20, 25].map((percent) => (
                <TouchableOpacity
                  key={percent}
                  style={[
                    styles.percentageButton,
                    fee.percentage === percent && styles.percentageButtonActive
                  ]}
                  onPress={() => updateFee(index, 'percentage', percent)}
                >
                  <Text style={[
                    styles.percentageButtonText,
                    fee.percentage === percent && styles.percentageButtonTextActive
                  ]}>
                    {percent}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customPercentageContainer}>
              <Text style={styles.customPercentageLabel}>Custom:</Text>
              <TextInput
                style={styles.customPercentageInput}
                placeholder="0"
                value={fee.percentage?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseFloat(text);
                  if (!isNaN(num) && num >= 0 && num <= 100) {
                    updateFee(index, 'percentage', num);
                  }
                }}
                keyboardType="numeric"
              />
              <Text style={styles.percentageSymbol}>%</Text>
            </View>
            <Text style={styles.calculatedAmount}>
              Amount: ${((itemsTotal * fee.percentage) / 100).toFixed(2)}
            </Text>
          </View>
        ) : (
          /* Fixed Amount Section */
          <View style={styles.fixedAmountSection}>
            <Text style={styles.fixedAmountLabel}>Amount</Text>
            <PriceInput
              value={fee.amount}
              onChangeText={(amount) => updateFee(index, 'amount', amount)}
              placeholder="0.00"
              style={styles.feeAmountInput}
            />
          </View>
        )}

        <SplitTypeSection
          splitType={fee.splitType}
          onSplitTypeChange={(splitType) => updateFee(index, 'splitType', splitType)}
          feeAmount={fee.amount}
          participantCount={participants.length}
        />

        {/* Total Fee Section */}
        <View style={styles.feeTotalSection}>
          <Text style={styles.feeTotalLabel}>Total Fee</Text>
          <Text style={styles.feeTotalAmount}>${(fee.amount || 0).toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
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
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expense Details</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="What's this expense for?"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalText}>
                ${calculateTotal().toFixed(2)}
              </Text>
            </View>
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
            <FriendSelector
              selectedFriends={selectedFriends}
              onFriendsChange={setSelectedFriends}
              placeholder="Add friends to split with..."
              allowPlaceholders={true}
              onAddPlaceholder={handleAddPlaceholder}
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
                        onPress={() => removePlaceholder(p.id)}
                        size="small"
                        variant="subtle"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.participantsNoteContainer}>
              <Text style={styles.participantsNote}>You'll automatically be included as a participant</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who Paid for This Expense?</Text>
            <PaidBySection
              participants={participants}
              selectedPayers={selectedPayers}
              onPayersChange={setSelectedPayers}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity onPress={addItem} style={styles.addButton}>
                <Ionicons name="add-circle" size={24} color={Colors.accent} />
              </TouchableOpacity>
            </View>
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyStateText}>No items added yet</Text>
                <Text style={styles.emptyStateSubtext}>Tap the + button to add your first item</Text>
              </View>
            ) : (
              <>
                {items.map(renderItem)}
                <TouchableOpacity
                  style={styles.addMoreItemsButton}
                  onPress={addItem}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addMoreItemsButtonText}>Add More Items</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={[styles.section, styles.lastSection]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Fees & Tips</Text>
              <TouchableOpacity onPress={addFee} style={styles.addButton}>
                <Ionicons name="add-circle" size={24} color={Colors.accent} />
              </TouchableOpacity>
            </View>
            {fees.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyStateText}>No fees added yet</Text>
                <Text style={styles.emptyStateSubtext}>Add tips, taxes, or service fees</Text>
              </View>
            ) : (
              fees.map(renderFee)
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={saveExpense}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : (isEditing ? 'Update Expense' : 'Save Expense')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <InviteFriendSheet
        visible={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
        expenseId={expense?.id}
        placeholderName={inviteTarget?.name || ''}
        phoneNumber={inviteTarget?.phone || ''}
      />

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
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
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
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
    ...Typography.title,
    color: Colors.textPrimary,
  },
  addButton: {
    padding: Spacing.sm,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  totalLabel: {
    ...Typography.body,
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.card,
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
  placeholderPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  placeholderTag: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  placeholderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inviteButton: {
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
  inviteButtonText: { 
    ...Typography.label, 
    color: Colors.surface, 
    fontWeight: '600',
    fontSize: 14,
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

});

export default AddExpenseScreen;
