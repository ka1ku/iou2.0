import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { getCurrentUser, onAuthStateChange } from '../services/authService';
import { getUserExpenses } from '../services/expenseService';
import { handleTakePhoto, handlePickImage } from '../services/imageHandler';
import { processReceiptImage } from '../services/receiptScanner';
import { requestReceiptScanningAccess } from '../services/subscriptionService';
import { useReceiptScanning } from '../App';

const HomeScreen = ({ navigation }) => {
  const [expenses, setExpenses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const { setIsReceiptScanning, startScanningAnimation, stopScanningAnimation } = useReceiptScanning();

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        loadExpenses();
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadExpenses();
    }, [])
  );

  const loadExpenses = async () => {
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        const userExpenses = await getUserExpenses(currentUser.uid);
        setExpenses(userExpenses);
        

      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'Failed to load expenses: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  // Calculate how much you owe for a specific expense
  const calculateExpenseBalance = (expense) => {
    const currentUserIndex = 0; // Assuming current user is always first participant
    let youOwe = 0;
    let youPaid = 0;
    
    expense.items?.forEach(item => {
      const paidByIndex = item.paidBy || 0;
      const itemAmount = parseFloat(item.amount) || 0;
      
      if (item.splitType === 'even') {
        const splitAmount = itemAmount / expense.participants.length;
        
        if (paidByIndex === currentUserIndex) {
          // You paid for this item
          youPaid += itemAmount;
          // Others owe you their share
          youOwe -= (expense.participants.length - 1) * splitAmount;
        } else {
          // Someone else paid, you owe your share
          youOwe += splitAmount;
        }
      } else if (item.splitType === 'custom') {
        const yourSplit = item.splits?.find(split => split.participantIndex === currentUserIndex);
        const yourAmount = yourSplit ? parseFloat(yourSplit.amount) || 0 : 0;
        
        if (paidByIndex === currentUserIndex) {
          // You paid for this item
          youPaid += itemAmount;
          // You owe the difference between what you paid and your share
          youOwe -= (itemAmount - yourAmount);
        } else {
          // Someone else paid, you owe your share
          youOwe += yourAmount;
        }
      }
    });
    
    return { youOwe, youPaid };
  };


  const handleReceiptScan = async () => {
    try {
      // Request access to receipt scanning (shows paywall if needed)
      const hasAccess = await requestReceiptScanningAccess();
      
      if (!hasAccess) {
        // User doesn't have access and didn't purchase
        return;
      }

      // User has access, proceed with receipt scanning
      // Show options to user first
      Alert.alert(
        'Scan Receipt',
        'Choose how you want to scan your receipt.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => handleTakePhoto(
            (imageUri) => processReceiptImage(
              imageUri,
              () => {
                setScanningReceipt(true);
                startScanningAnimation();
              },
              () => {
                stopScanningAnimation();
              },
              (receiptData) => {
                navigation.navigate('AddReceipt', { 
                  scannedReceipt: receiptData,
                  fromReceiptScan: true 
                });
              },
              (errorMessage) => {
                Alert.alert('Receipt Scanning Error', errorMessage);
              }
            ),
            (error) => Alert.alert('Error', error),
            setIsReceiptScanning
          ) },
          { text: 'Choose from Gallery', onPress: () => handlePickImage(
            (imageUri) => processReceiptImage(
              imageUri,
              () => {
                setScanningReceipt(true);
                startScanningAnimation();
              },
              () => {
                stopScanningAnimation();
              },
              (receiptData) => {
                navigation.navigate('AddReceipt', { 
                  scannedReceipt: receiptData,
                  fromReceiptScan: true 
                });
              },
              (errorMessage) => {
                Alert.alert('Receipt Scanning Error', errorMessage);
              }
            ),
            (error) => Alert.alert('Error', error),
            setIsReceiptScanning
          ) }
        ]
      );
    } catch (error) {
      console.error('Error starting receipt scan:', error);
      Alert.alert('Error', 'Failed to start receipt scanning');
    }
  };


  const calculateExpenseTotal = (expense) => {
    const itemsTotal = (expense.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const feesTotal = (expense.fees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
    return itemsTotal + feesTotal;
  };

  const renderExpenseItem = ({ item }) => {
    const totalItems = item.items?.length || 0;
    const totalParticipants = item.participants?.length || 0;
    const expenseBalance = calculateExpenseBalance(item);
    
    // Determine if this is a receipt or expense
    const isReceipt = item.expenseType === 'receipt' || 
                     item.fromReceiptScan || 
                     (item.title && item.title.toLowerCase().includes('receipt')) ||
                     (item.items && item.items.length > 1); // Multiple items often indicate a receipt
    const isExpense = item.expenseType === 'expense' || !isReceipt;
    
    // Calculate payment summary for selected payers
    const paymentSummary = {};
    console.log(item);

    // Ensure selectedPayers is an array of indices
    const paidByIndices = Array.isArray(item.selectedPayers)
      ? item.selectedPayers
      : typeof item.selectedPayers === 'number'
        ? [item.selectedPayers]
        : [];

    // Calculate total amount to be paid by selected payers
    const totalAmount = calculateExpenseTotal(item);
    
    // If there are multiple payers, split the total amount equally among them
    const splitAmount = paidByIndices.length > 0 ? totalAmount / paidByIndices.length : 0;

    paidByIndices.forEach(idx => {
      const paidByName = item.participants?.[idx]?.name || 'Unknown';
      paymentSummary[paidByName] = (paymentSummary[paidByName] || 0) + splitAmount;
    });

    // If no payers are specified, assign the whole amount to 'Unknown'
    if (paidByIndices.length === 0) {
      paymentSummary['Unknown'] = (paymentSummary['Unknown'] || 0) + totalAmount;
    }

    const handleItemPress = () => {
      if (isReceipt) {
        navigation.navigate('AddReceipt', { expense: item });
      } else {
        navigation.navigate('AddExpense', { expense: item });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.expenseCard, isReceipt && styles.receiptCard]}
        onPress={handleItemPress}
        activeOpacity={0.8}
      >
        
        <View style={styles.expenseHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.expenseTitle}>{item.title}</Text>
          </View>
          <View style={styles.rightHeaderSection}>
            {/* Type indicator */}
            <View style={[styles.typeBadge, isReceipt ? styles.receiptBadge : styles.expenseBadge]}>
              <Text style={[styles.typeText, isReceipt ? styles.receiptTypeText : styles.expenseTypeText]}>
                {isReceipt ? 'Receipt' : 'Expense'}
              </Text>
            </View>
            <View style={styles.expenseBalance}>
              {expenseBalance.youOwe > 0 ? (
                <View style={styles.oweContainer}>
                  <Ionicons name="arrow-up-circle" size={16} color={Colors.danger} />
                  <Text style={styles.oweText}>You owe ${expenseBalance.youOwe.toFixed(2)}</Text>
                </View>
              ) : expenseBalance.youOwe < 0 ? (
                <View style={styles.owedContainer}>
                  <Ionicons name="arrow-down-circle" size={16} color={Colors.success} />
                  <Text style={styles.owedText}>You're owed ${Math.abs(expenseBalance.youOwe).toFixed(2)}</Text>
                </View>
              ) : (
                <View style={styles.evenContainer}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.evenText}>Settled up</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.expenseDetails}>
          <Text style={styles.expenseTotal}>${calculateExpenseTotal(item).toFixed(2)}</Text>
        </View>

        {/* Payment Summary */}
        {Object.keys(paymentSummary).length > 0 && (
          <View style={styles.paymentSummaryContainer}>
            <Text style={styles.paymentSummaryLabel}>Paid by:</Text>
            <View style={styles.paymentSummaryList}>
              {Object.entries(paymentSummary).map(([name, amount]) => (
                <View key={name} style={styles.paymentSummaryItem}>
                  <Text style={styles.paymentSummaryName}>{name}</Text>
                  <Text style={styles.paymentSummaryAmount}>${(amount || 0).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {item.participants && item.participants.length > 0 && (
          <View style={styles.participantsContainer}>
            <Text style={styles.participantsLabel}>Participants:</Text>
            <Text style={styles.participantsList}>
              {item.participants.map(p => p.name).join(', ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No expenses yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Tap the + button to create your first expense
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Loading expenses...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Expenses</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.receiptButton}
            onPress={handleReceiptScan}
            disabled={scanningReceipt}
            activeOpacity={0.7}
          >
            {scanningReceipt ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="scan-outline" size={26} color="white" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddExpense')}
          >
            <Ionicons name="add" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60, // Account for status bar manually
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  receiptButton: {
    backgroundColor: Colors.blue,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    ...Shadows.card,
  },
  addButton: {
    backgroundColor: Colors.accent,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyStateText: {
    ...Typography.title,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptyStateSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  expenseCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  receiptCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.blue + '20',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginRight: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    minWidth: 70,
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  typeText: {
    ...Typography.label,
    fontWeight: '600',
    fontSize: 12,
  },
  receiptBadge: {
    backgroundColor: Colors.blue + '10',
    borderColor: Colors.blue + '30',
  },
  receiptTypeText: {
    color: Colors.blue,
  },
  expenseBadge: {
    backgroundColor: Colors.accent + '10',
    borderColor: Colors.accent + '30',
  },
  expenseTypeText: {
    color: Colors.accent,
  },
  expenseBalance: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  oweContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  oweText: {
    ...Typography.label,
    color: Colors.danger,
    fontWeight: '600',
    marginLeft: 4,
  },
  owedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  owedText: {
    ...Typography.label,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  evenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  evenText: {
    ...Typography.label,
    color: Colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },
  rightHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  expenseDetails: {
    marginBottom: 12,
  },
  expenseTotal: {
    fontSize: 24,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
    fontWeight: '700',
  },
  expenseInfo: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  participantsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  participantsLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  participantsList: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  paymentSummaryContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  paymentSummaryLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  paymentSummaryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  paymentSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentSummaryName: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginRight: 6,
    fontWeight: '500',
  },
  paymentSummaryAmount: {
    ...Typography.label,
    color: Colors.accent,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.blue + '10',
    borderRadius: Radius.pill,
    padding: Spacing.xxs,
    borderWidth: 1,
    borderColor: Colors.blue + '30',
  },

});

export default HomeScreen;
