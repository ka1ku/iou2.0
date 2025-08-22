import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { useFocusEffect } from '@react-navigation/native';
import { getCurrentUser, onAuthStateChange } from '../services/authService';
import { getUserExpenses } from '../services/expenseService';
import * as ImagePicker from 'expo-image-picker';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import { useReceiptScanning } from '../App';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [expenses, setExpenses] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanningReceipt, setScanningReceipt] = useState(false);

  
  // Get the global receipt scanning context
  const { setIsReceiptScanning, setShowScanningOverlay, startScanningAnimation, stopScanningAnimation } = useReceiptScanning();

  useEffect(() => {
    // Listen for auth state changes and load expenses when user is available
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        loadExpenses();
      } else {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Refresh expenses when screen comes into focus (e.g., returning from AddExpense)
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
      // Check permissions first
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permissions Needed', 
          'Camera and photo library permissions are required to scan receipts. Please grant these permissions in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => ImagePicker.openSettingsAsync() }
          ]
        );
        return;
      }

      // Show options to user
      Alert.alert(
        'Scan Receipt',
        'Choose how you want to scan your receipt',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => takePhoto() },
          { text: 'Choose from Gallery', onPress: () => pickImage() }
        ]
      );
    } catch (error) {
      console.error('Error starting receipt scan:', error);
      Alert.alert('Error', 'Failed to start receipt scanning');
    }
  };



  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImage = async () => {
    try {
      // Set global scanning state to true
      setIsReceiptScanning(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await processReceiptImage(result.assets[0].uri);
      }
      
      // Reset scanning state
      setIsReceiptScanning(false);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      // Reset scanning state on error
      setIsReceiptScanning(false);
    }
  };

  const processReceiptImage = async (imageUri) => {
    setScanningReceipt(true);
    startScanningAnimation(); // Start the scanning animation
    
    try {
      // Convert image to base64
      const base64Image = await imageToBase64(imageUri);
      
      // Use Firebase AI to scan the receipt
      const receiptData = await scanReceiptWithAI(base64Image);
      
      // Stop animation before navigation
      stopScanningAnimation();
      
      // Navigate to AddExpense with the scanned data
      navigation.navigate('AddExpense', { 
        scannedReceipt: receiptData,
        fromReceiptScan: true 
      });
      
    } catch (error) {
      console.error('Error processing receipt:', error);
      
      // Stop animation on error
      stopScanningAnimation();
      
      let errorMessage = 'Failed to process receipt. ';
      if (error.message.includes('base64')) {
        errorMessage += 'There was an issue with the image format. Please try a different image format.';
      } else if (error.message.includes('Firebase AI')) {
        errorMessage += 'There was an issue with the AI service. Please try again.';
      } else if (error.message.includes('AI response')) {
        errorMessage += 'The AI could not properly read the receipt. Please ensure the image is clear and try again.';
      } else {
        errorMessage += 'Please try again or enter manually.';
      }
      
      Alert.alert('Receipt Scanning Error', errorMessage);
    } finally {
      setScanningReceipt(false);
    }
  };

  const imageToBase64 = async (uri) => {
    try {
      // For React Native, let's try a simpler approach
      // First, try to use expo-file-system with proper import
      const FileSystem = await import('expo-file-system');
      
      // Convert the URI to a file path if it's a file:// URI
      let filePath = uri;
      if (uri.startsWith('file://')) {
        filePath = uri.replace('file://', '');
      }
      
      // Read the file as base64 using expo-file-system
      const base64 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64
      });
      return base64;
      
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to convert image to base64. Please try a different image format or restart the app.');
    }
  };



  const scanReceiptWithAI = async (base64Image) => {
    try {
      const app = getApp();
      if (!app) {
        throw new Error('Firebase app not initialized');
      }
      
      const ai = getAI(app);
      if (!ai) {
        throw new Error('Firebase AI not initialized');
      }
      
      const model = getGenerativeModel(ai, { model: 'gemini-1.5-flash' });
      if (!model) {
        throw new Error('AI model not initialized');
      }

      const prompt = `You are a receipt scanning assistant. Analyze this receipt image and extract the following information in JSON format:

{
  "title": "Receipt title or business name",
  "date": "Date of purchase (YYYY-MM-DD)",
  "subtotal": "Items subtotal BEFORE tax/tip/fees as a number",
  "total": "Grand total as a number",
  "items": [
    {
      "name": "Item name",
      "amount": "Item price as a number",
      "quantity": "Quantity as a number"
    }
  ],
  "fees": [
    {
      "name": "Tax | Tip | Gratuity | Service Fee | Delivery Fee | Convenience Fee | Surcharge",
      "type": "percentage | fixed",
      "percentage": "If percentage-based, the percent number; else null",
      "amount": "Numeric amount of this fee"
    }
  ],
  "participants": [
    {
      "name": "Your name",
      "paidBy": true
    }
  ],
  "notes": "Any additional notes from the receipt"
}

Important guidelines:
- Identify and include common charges under fees: Tax (Sales Tax), Tip/Gratuity, Service Fee, Delivery Fee, Convenience Fee, Surcharge
- Convert all monetary amounts to numbers (remove $ signs and commas)
- Provide BOTH amount and percentage when possible; if one is missing but can be derived from subtotal, compute it
- If subtotal is not printed, compute it by summing item amounts
- Ensure total ≈ subtotal + sum(fees)
- If a date is not clearly visible, use today's date
- Ensure the JSON is valid and properly formatted
- Respond with ONLY the JSON data, no extra text.`;

      // Create the content parts array as per Firebase AI documentation
      const contentParts = [
        { text: prompt },
        { 
          inlineData: { 
            mimeType: 'image/jpeg', 
            data: base64Image 
          } 
        }
      ];

      const response = await model.generateContent(contentParts);

      const responseText = response.response.text();
      
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const receiptData = JSON.parse(jsonMatch[0]);

          // Basic validation
          if (!receiptData.title || receiptData.total === undefined || receiptData.total === null) {
            throw new Error('AI response missing required fields (title or total)');
          }

          // Normalize numeric fields
          const items = Array.isArray(receiptData.items) ? receiptData.items.map(it => ({
            name: it.name || '',
            amount: Number(it.amount) || 0,
            quantity: Number(it.quantity) || 1,
          })) : [];

          // Compute subtotal if missing
          const computedSubtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
          const subtotal = Number(receiptData.subtotal);
          const normalizedSubtotal = Number.isFinite(subtotal) ? subtotal : computedSubtotal;

          // Normalize fees
          const rawFees = Array.isArray(receiptData.fees) ? receiptData.fees : [];
          const normalizedFees = rawFees.map(f => {
            const name = (f.name || '').trim() || 'Fee';
            const pct = f.percentage !== undefined && f.percentage !== null ? Number(f.percentage) : NaN;
            const amt = f.amount !== undefined && f.amount !== null ? Number(f.amount) : NaN;
            let type = f.type === 'percentage' || f.type === 'fixed' ? f.type : (Number.isFinite(pct) ? 'percentage' : 'fixed');

            let percentage = Number.isFinite(pct) ? pct : null;
            let amount = Number.isFinite(amt) ? amt : null;

            if (type === 'percentage') {
              if (percentage === null && Number.isFinite(amount) && normalizedSubtotal > 0) {
                percentage = (amount / normalizedSubtotal) * 100;
              }
              if (amount === null && Number.isFinite(percentage)) {
                amount = (normalizedSubtotal * percentage) / 100;
              }
            }

            // Fallbacks
            if (!Number.isFinite(amount)) amount = 0;
            if (!Number.isFinite(percentage)) percentage = null;

            return { name, type, percentage, amount };
          });

          return {
            ...receiptData,
            items,
            subtotal: normalizedSubtotal,
            fees: normalizedFees,
            total: Number(receiptData.total) || 0,
          };
        } catch (parseError) {
          console.error('JSON parsing error:', parseError);
          throw new Error('AI response contained invalid JSON format: ' + parseError.message);
        }
      } else {
        console.error('No JSON found in response:', responseText);
        throw new Error('AI response did not contain valid JSON structure');
      }
      
    } catch (error) {
      console.error('AI scanning error:', error);
      if (error.message.includes('AI response')) {
        throw error; // Re-throw our custom errors
      } else {
        throw new Error('Failed to scan receipt with Firebase AI: ' + error.message);
      }
    }
  };

  const renderExpenseItem = ({ item }) => {
    const totalItems = item.items?.length || 0;
    const totalParticipants = item.participants?.length || 0;
    const expenseBalance = calculateExpenseBalance(item);
    
    // Calculate payment summary
    const paymentSummary = {};
    item.items?.forEach(expenseItem => {
      const paidByIndex = expenseItem.paidBy || 0;
      const paidByName = item.participants?.[paidByIndex]?.name || 'Unknown';
      const itemAmount = parseFloat(expenseItem.amount) || 0;
      paymentSummary[paidByName] = (paymentSummary[paidByName] || 0) + itemAmount;
    });

    return (
      <TouchableOpacity
        style={styles.expenseCard}
        onPress={() => navigation.navigate('AddExpense', { expense: item })}
        activeOpacity={0.8}
      >
        <View style={styles.expenseHeader}>
          <Text style={styles.expenseTitle}>{item.title}</Text>
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
        
        <View style={styles.expenseDetails}>
          <Text style={styles.expenseTotal}>${item.total?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.expenseInfo}>
            {totalItems} items • {totalParticipants} participants
          </Text>
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
        <Text style={styles.headerTitle}>My Expenses</Text>
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
              <Ionicons name="receipt-outline" size={26} color="white" />
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
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
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
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  expenseTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  expenseBalance: {
    alignItems: 'flex-end',
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

});

export default HomeScreen;
