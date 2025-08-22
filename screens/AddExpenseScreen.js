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
import SmartSplitInput from '../components/SmartSplitInput';
import DeleteButton from '../components/DeleteButton';

const AddExpenseScreen = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(expense?.title || '');
  const [participants, setParticipants] = useState(expense?.participants || [{ name: 'Me' }]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null); // { name, phone }
  const [showSettings, setShowSettings] = useState(false);
  const [joinEnabled, setJoinEnabled] = useState(true);
  const [items, setItems] = useState(expense?.items || []);
  const [fees, setFees] = useState(expense?.fees || []);
  const [loading, setLoading] = useState(false);

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
          paidBy: 0, // Default to first participant
          splitType: 'even',
          splits: []
        }));
        setItems(formattedItems);
      }
      
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
      // Update item splits to remove this participant
      setItems(items.map(item => ({
        ...item,
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
      ...selectedFriends.map(friend => ({ name: friend.name, userId: friend.id })),
      ...placeholders.map(p => ({ name: p.name, placeholder: true, phoneNumber: p.phoneNumber }))
    ];
    setParticipants(allParticipants);
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

    // Adjust item splits similar to previous removeParticipant logic
    setItems(prevItems => prevItems.map(item => ({
      ...item,
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
      paidBy: 0, // Default to first participant (usually "Me")
      splitType: 'even',
      splits: []
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // If amount changed and split type is even, recalculate splits
    if (field === 'amount' && updated[index].splitType === 'even') {
      const amount = parseFloat(value) || 0;
      const splitAmount = amount / participants.length;
      updated[index].splits = participants.map((_, i) => ({
        participantIndex: i,
        amount: splitAmount,
        percentage: 100 / participants.length
      }));
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

  const updateItemSplitType = (index, splitType) => {
    const updated = [...items];
    updated[index].splitType = splitType;
    
    if (splitType === 'even') {
      const amount = parseFloat(updated[index].amount) || 0;
      const splitAmount = amount / participants.length;
      updated[index].splits = participants.map((_, i) => ({
        participantIndex: i,
        amount: splitAmount,
      }));
    } else if (splitType === 'custom') {
      // Initialize custom splits evenly for smart split
      const amount = parseFloat(updated[index].amount) || 0;
      const splitAmount = amount / participants.length;
      updated[index].splits = participants.map((_, i) => ({
        participantIndex: i,
        amount: splitAmount,
      }));
    } else {
      // Clear splits for other modes
      updated[index].splits = [];
    }
    
    setItems(updated);
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
        participants: participants.map(p => ({ name: p.name.trim() })),
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
        <View style={styles.itemHeader}>
          <TextInput
            style={styles.itemNameInput}
            placeholder="Item name"
            value={item.name}
            onChangeText={(text) => updateItem(index, 'name', text)}
          />
          <DeleteButton
            onPress={() => removeItem(index)}
            size="medium"
            variant="subtle"
          />
        </View>

        <PriceInput
          value={item.amount}
          onChangeText={(amount) => updateItem(index, 'amount', amount)}
          placeholder="0.00"
          style={styles.amountInput}
        />

        <View style={styles.paidByContainer}>
          <Text style={styles.paidByLabel}>Paid by:</Text>
          <View style={styles.paidByButtons}>
            {participants.map((participant, pIndex) => (
              <TouchableOpacity
                key={pIndex}
                style={[
                  styles.paidByButton,
                  (item.paidBy || 0) === pIndex && styles.paidByButtonActive
                ]}
                onPress={() => updateItem(index, 'paidBy', pIndex)}
              >
                <Text style={[
                  styles.paidByText,
                  (item.paidBy || 0) === pIndex && styles.paidByTextActive
                ]}>
                  {participant.name || `Person ${pIndex + 1}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.splitTypeContainer}>
          <TouchableOpacity
            style={[
              styles.splitTypeButton,
              item.splitType === 'even' && styles.splitTypeButtonActive
            ]}
            onPress={() => updateItemSplitType(index, 'even')}
          >
            <Text style={[
              styles.splitTypeText,
              item.splitType === 'even' && styles.splitTypeTextActive
            ]}>
              Split Even
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.splitTypeButton,
              item.splitType === 'custom' && styles.splitTypeButtonActive
            ]}
            onPress={() => updateItemSplitType(index, 'custom')}
          >
            <Text style={[
              styles.splitTypeText,
              item.splitType === 'custom' && styles.splitTypeTextActive
            ]}>
              Custom Split
            </Text>
          </TouchableOpacity>
        </View>

        {item.splitType === 'custom' && (
          <View style={styles.customSplitsContainer}>
            <SmartSplitInput
              participants={participants}
              total={parseFloat(item.amount) || 0}
              initialSplits={item.splits || []}
              onSplitsChange={(newSplits) => {
                // Update the item's splits
                const updated = [...items];
                updated[index].splits = newSplits;
                setItems(updated);
              }}
              style={styles.smartSplitContainer}
            />
          </View>
        )}

        {item.splitType === 'even' && (
          <Text style={styles.evenSplitText}>
            ${((parseFloat(item.amount) || 0) / participants.length).toFixed(2)} per person
          </Text>
        )}
      </View>
    );
  };

  const renderFee = (fee, index) => {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    return (
      <View key={fee.id} style={styles.feeCard}>
        <View style={styles.feeHeader}>
          <TextInput
            style={styles.feeNameInput}
            placeholder="Fee name (e.g., Tip, Tax, Service)"
            value={fee.name}
            onChangeText={(text) => updateFee(index, 'name', text)}
          />
          <DeleteButton
            onPress={() => removeFee(index)}
            size="medium"
            variant="subtle"
          />
        </View>

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

        {fee.type === 'percentage' ? (
          <View style={styles.percentageContainer}>
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
          <View style={styles.fixedAmountContainer}>
            <PriceInput
              value={fee.amount}
              onChangeText={(amount) => updateFee(index, 'amount', amount)}
              placeholder="0.00"
              style={styles.feeAmountInput}
            />
          </View>
        )}

        <View style={styles.feeSplitContainer}>
          <Text style={styles.feeSplitLabel}>Split:</Text>
          <TouchableOpacity
            style={[
              styles.feeSplitButton,
              fee.splitType === 'equal' && styles.feeSplitButtonActive
            ]}
            onPress={() => updateFee(index, 'splitType', 'equal')}
          >
            <Text style={[
              styles.feeSplitText,
              fee.splitType === 'equal' && styles.feeSplitTextActive
            ]}>
              Split Even
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.feeSplitButton,
              fee.splitType === 'proportional' && styles.feeSplitButtonActive
            ]}
            onPress={() => updateFee(index, 'splitType', 'proportional')}
          >
            <Text style={[
              styles.feeSplitText,
              fee.splitType === 'proportional' && styles.feeSplitTextActive
            ]}>
              Proportional
            </Text>
          </TouchableOpacity>

        </View>

        {fee.splitType === 'equal' && (
          <Text style={styles.feeSplitInfo}>
            ${((fee.amount || 0) / participants.length).toFixed(2)} per person
          </Text>
        )}
        {fee.splitType === 'proportional' && (
          <Text style={styles.feeSplitInfo}>
            Split proportionally based on who paid what
          </Text>
        )}

        
        {/* Show total fee amount */}
        <View style={styles.feeTotalContainer}>
          <Text style={styles.feeTotalLabel}>Total Fee:</Text>
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
            <Text style={styles.sectionTitle}>Participants</Text>
            <FriendSelector
              selectedFriends={selectedFriends}
              onFriendsChange={setSelectedFriends}
              maxFriends={9}
              placeholder="Add friends to split with..."
              allowPlaceholders={true}
              onAddPlaceholder={handleAddPlaceholder}
            />
            {/* Render placeholder chips with Invite buttons */}
            {placeholders.length > 0 && (
              <View style={{ marginTop: Spacing.sm }}>
                {placeholders.map((p, idx) => (
                  <View key={p.id} style={styles.placeholderRow}>
                    <View style={styles.placeholderAvatar}>
                      <Text style={styles.placeholderInitials}>{p.name?.[0] || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.placeholderName}>{p.name}</Text>
                      <Text style={styles.placeholderMeta}>{p.phoneNumber ? `Phone: ${p.phoneNumber}` : 'No phone added'}</Text>
                    </View>
                    <TouchableOpacity style={styles.inviteButton} onPress={() => handleInvitePlaceholder(p)}>
                      <Ionicons name="qr-code" size={16} color={Colors.surface} />
                      <Text style={styles.inviteButtonText}>Invite</Text>
                    </TouchableOpacity>
                    <DeleteButton
                      onPress={() => removePlaceholder(p.id)}
                      size="small"
                      variant="subtle"
                    />
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.participantsNote}>You'll automatically be included as a participant</Text>
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
              items.map(renderItem)
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
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
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
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemNameInput: {
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

  amountInput: {
    marginBottom: Spacing.sm,
  },
  formattedAmount: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  splitTypeContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  splitTypeButton: {
    flex: 1,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  splitTypeButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  splitTypeText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  splitTypeTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  customSplitsContainer: {
    marginTop: Spacing.sm,
  },
  customSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  participantName: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  customSplitInput: {
    width: 80,
  },
  smartSplitContainer: {
    marginTop: Spacing.sm,
  },

  evenSplitText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  paidByContainer: {
    marginBottom: Spacing.md,
  },
  paidByLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  paidByButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  paidByButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  paidByButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  paidByText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  paidByTextActive: {
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
    marginTop: Spacing.sm,
    fontStyle: 'italic',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  placeholderInitials: { ...Typography.title, color: Colors.textSecondary, fontWeight: '600' },
  placeholderName: { ...Typography.title, color: Colors.textPrimary },
  placeholderMeta: { ...Typography.body, color: Colors.textSecondary },
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
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  feeNameInput: {
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

  feeTypeContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
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
  },
  feeTypeButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
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
  percentageContainer: {
    marginBottom: Spacing.md,
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
  },
  percentageButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
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
  fixedAmountContainer: {
    marginBottom: Spacing.md,
  },
  feeAmountInput: {
    marginBottom: 0,
  },
  feeSplitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  feeSplitLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  feeSplitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  feeSplitButtonActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  feeSplitText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  feeSplitTextActive: {
    color: Colors.surface,
    fontWeight: '600',
  },
  feeSplitInfo: {
    ...Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  feeTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
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
});

export default AddExpenseScreen;
