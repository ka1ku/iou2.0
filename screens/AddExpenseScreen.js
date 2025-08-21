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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { getCurrentUser } from '../services/authService';
import { createExpense, updateExpense } from '../services/expenseService';
import FriendSelector from '../components/FriendSelector';
import InviteFriendSheet from '../components/InviteFriendSheet';

const AddExpenseScreen = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan } = route.params || {};
  const isEditing = !!expense;
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(expense?.title || '');
  const [participants, setParticipants] = useState(expense?.participants || [{ name: 'Me' }]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null); // { name, phone }
  const [items, setItems] = useState(expense?.items || []);
  const [loading, setLoading] = useState(false);

  // Calculate total from items
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
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
        percentage: 100 / participants.length
      }));
    } else {
      // Clear splits for custom mode
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
      item.splits[existingSplitIndex].amount = parseFloat(amount) || 0;
    } else {
      item.splits.push({
        participantIndex,
        amount: parseFloat(amount) || 0
      });
    }
    
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
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
        }))
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
          <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeItemButton}>
            <Ionicons name="close-circle" size={24} color={Colors.danger} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.amountInput}
          placeholder="Amount"
          value={item.amount?.toString() || ''}
          onChangeText={(text) => {
            // Remove any non-numeric characters except decimal point
            const cleanText = text.replace(/[^0-9.]/g, '');
            // Ensure only one decimal point
            const parts = cleanText.split('.');
            if (parts.length <= 2) {
              updateItem(index, 'amount', cleanText);
            }
          }}
          keyboardType="numeric"
        />
        
        {/* Display formatted amount below input */}
        {item.amount && parseFloat(item.amount) > 0 && (
          <Text style={styles.formattedAmount}>
            ${parseFloat(item.amount).toFixed(2)}
          </Text>
        )}

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
            {participants.map((participant, pIndex) => {
              const split = item.splits?.find(s => s.participantIndex === pIndex);
              return (
                <View key={pIndex} style={styles.customSplitRow}>
                  <Text style={styles.participantName}>{participant.name}:</Text>
                  <TextInput
                    style={styles.customSplitInput}
                    placeholder="0.00"
                    value={split?.amount?.toString() || ''}
                    onChangeText={(text) => {
                      // Remove any non-numeric characters except decimal point
                      const cleanText = text.replace(/[^0-9.]/g, '');
                      // Ensure only one decimal point
                      const parts = cleanText.split('.');
                      if (parts.length <= 2) {
                        updateItemSplit(index, pIndex, cleanText);
                      }
                    }}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
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
        <View style={styles.headerSpacer} />
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
                    <TouchableOpacity style={styles.removeButton} onPress={() => removePlaceholder(p.id)}>
                      <Ionicons name="trash" size={18} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.participantsNote}>You'll automatically be included as a participant</Text>
          </View>

          <View style={[styles.section, styles.lastSection]}>
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
  removeItemButton: {
    padding: Spacing.sm,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    ...Typography.body,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
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
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    ...Typography.body,
    textAlign: 'center',
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
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
  removeButton: { marginLeft: Spacing.sm },
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
});

export default AddExpenseScreen;
