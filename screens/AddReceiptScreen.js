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

import FriendSelector from '../components/FriendSelector';
import InviteFriendSheet from '../components/InviteFriendSheet';
import PriceInput from '../components/PriceInput';
import DeleteButton from '../components/DeleteButton';
import { ItemHeader, PriceInputSection, PaidBySection, SmartSplitSection, SplitTypeSection, WhoConsumedSection, FeeHeader, FeeTypeSection, PercentageSection, FixedAmountSection, TotalFeeSection } from './AddExpenseScreenItems';
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
  addParticipant,
  updateParticipant,
  removeParticipant,
  removePlaceholder
} from './AddExpenseScreenFunctions';
import { getCurrentUser } from '../services/authService';
import useFormChangeTracker from '../hooks/useFormChangeTracker';
import useNavigationWarning from '../hooks/useNavigationWarning';
import SettlementProposalModal from '../components/SettlementProposalModal';

const AddReceiptScreen = ({ route, navigation }) => {
  const { expense, scannedReceipt, fromReceiptScan, previousScreen } = route.params || {};
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
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [pendingExpenseData, setPendingExpenseData] = useState(null);
  const [pendingSettlement, setPendingSettlement] = useState(null);

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
    loading // Pass loading state as isSaving flag
  );

  // Calculate total from items and fees
  const calculateTotal = () => {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const feesTotal = fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    return itemsTotal + feesTotal;
  };

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Receipt' : 'Add Receipt',
      tabBarStyle: { display: 'none' },
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
      let formattedFees = [];
      if (scannedReceipt.fees && scannedReceipt.fees.length > 0) {
        const subtotalFromReceipt = Number(scannedReceipt.subtotal);
        const fallbackItemsTotal = (scannedReceipt.items || []).reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
        const baseline = Number.isFinite(subtotalFromReceipt) ? subtotalFromReceipt : fallbackItemsTotal;

        formattedFees = scannedReceipt.fees.map((fee, index) => {
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
      }

      // Add default tip card after existing fees
      const defaultTipFee = {
        id: Date.now().toString() + 'tip',
        name: 'Tip',
        amount: 0,
        type: 'percentage',
        percentage: 0,
        splitType: 'proportional',
        splits: []
      };
      
      // Add the default tip card to the end of the fees array
      formattedFees.push(defaultTipFee);
      setFees(formattedFees);
      
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
        console.log('expense', expense.items[2].splits)
      const currentUser = getCurrentUser();
      // Extract friends from existing participants (exclude current user and placeholders)
      const existingFriends = expense.participants
        .filter(p => {
          // Exclude placeholders
          if (p.placeholder) return false;
          // Exclude the current user (either by name 'Me' or by userId matching createdBy)
          if (p.name === 'Me' || (p.userId && expense.createdBy && p.userId === expense.createdBy)) return false;
          // Must have a userId to be considered a friend
          return p.userId;
        })
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
      
      if (expense.fees) {
        setFees(expense.fees);
      }
      
      // Set selected payers if available
      if (expense.selectedPayers) {
        setSelectedPayers(expense.selectedPayers);
      }
      if (expense.items) {
        setItems(expense.items);
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
    
  }, [selectedFriends, placeholders]);
  
  const handleAddParticipant = () => {
    addParticipant(participants, setParticipants);
  };

  const handleUpdateParticipant = (index, name) => {
    updateParticipant(index, name, participants, setParticipants);
  };

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

  const handleShowSettlementProposal = (expenseData, settlement) => {
    setPendingExpenseData(expenseData);
    setPendingSettlement(settlement);
    setShowSettlementModal(true);
  };

  const handleAcceptSettlement = async (settlements, settlementType) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'No user signed in');
      return;
    }

    await saveExpenseWithSettlement(
      pendingExpenseData,
      currentUser,
      settlements,
      settlementType,
      navigation,
      resetChanges
    );
  };

  const handleSkipSettlement = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      Alert.alert('Error', 'No user signed in');
      return;
    }

    // Save expense without settlement data
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
      'receipt',
      resetChanges,
      null // Don't show settlement proposal
    );
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
      resetChanges,
      handleShowSettlementProposal
    );
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
      (newPayers) => setSelectedPayers(newPayers),
      true // isReceipt = true for AddReceiptScreen
    );
  };

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
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (previousScreen === 'ProfileMain') {
              navigation.navigate('Profile');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Receipt' : 'Add Receipt'}
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
            <Text style={styles.sectionTitle}>Expense Detials</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="What's this expense for?"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
            {/* Receipt Breakdown */}
            {(items.length > 0 || fees.length > 0) && (
              <View style={styles.receiptBreakdown}>
                <View style={styles.receiptHeader}>
                  <Ionicons name="receipt-outline" size={20} color={Colors.accent} />
                  <Text style={styles.receiptTitle}>Receipt Breakdown</Text>
                </View>
                
                {/* Items Section */}
                {items.length > 0 && (
                  <>
                    <View style={styles.receiptSection}>
                      <Text style={styles.receiptSectionTitle}>Items</Text>
                      {items.map((item, index) => (
                        <View key={item.id} style={styles.receiptRow}>
                          <Text style={styles.receiptItemName} numberOfLines={2}>
                            {item.name || `Item ${index + 1}`}
                          </Text>
                          <Text style={styles.receiptItemAmount}>
                            ${(parseFloat(item.amount) || 0).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                      <View style={styles.receiptSubtotal}>
                        <Text style={styles.receiptSubtotalLabel}>Items Subtotal</Text>
                        <Text style={styles.receiptSubtotalAmount}>
                          ${items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {/* Fees Section */}
                {fees.length > 0 && (
                  <View style={styles.receiptSection}>
                    <Text style={styles.receiptSectionTitle}>Fees & Tips</Text>
                    {fees.map((fee, index) => (
                      <View key={fee.id} style={styles.receiptRow}>
                        <Text style={styles.receiptItemName} numberOfLines={2}>
                          {fee.name || `Fee ${index + 1}`}
                        </Text>
                        <Text style={styles.receiptItemAmount}>
                          ${(parseFloat(fee.amount) || 0).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.receiptSubtotal}>
                      <Text style={styles.receiptSubtotalLabel}>Fees Subtotal</Text>
                      <Text style={styles.receiptSubtotalAmount}>
                        ${fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Total Amount */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>Total Amount</Text>
                  <Text style={styles.receiptTotalAmount}>
                    ${calculateTotal().toFixed(2)}
                  </Text>
                </View>
              </View>
            )}


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
              expenseId={expense?.id}
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
              <TouchableOpacity onPress={handleAddItem} style={styles.addButton}>
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
                {items.map(handleRenderItem)}
                <TouchableOpacity
                  style={styles.addMoreItemsButton}
                  onPress={handleAddItem}
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
              <TouchableOpacity onPress={handleAddFee} style={styles.addButton}>
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
            onPress={handleSaveExpense}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : (isEditing ? 'Update Receipt' : 'Save Receipt')}
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

      {/* Settlement Proposal Modal */}
      <SettlementProposalModal
        visible={showSettlementModal}
        onClose={() => {
          setShowSettlementModal(false);
          setPendingExpenseData(null);
          setPendingSettlement(null);
        }}
        onAccept={handleAcceptSettlement}
        expense={pendingExpenseData}
        participants={participants}
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
    marginTop: Spacing.sm,
  },
  // Receipt Breakdown Styles
  receiptBreakdown: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
  receiptItemName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.md,
    lineHeight: 20,
  },
  receiptItemAmount: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
    minWidth: 60,
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

export default AddReceiptScreen;
