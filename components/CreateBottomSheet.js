import React, { forwardRef, useImperativeHandle, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { handleTakePhoto as takePhoto, handlePickImage as pickImage } from '../services/imageHandler';
import { processReceiptImage } from '../services/receiptScanner';
import { requestReceiptScanningAccess } from '../services/subscriptionService';
import { useReceiptScanning } from '../contexts/ReceiptScanningContext';
import deepLinkService from '../services/deepLinkService';
import { parseExpenseJoinLink } from '../services/expenseService';

const CreateBottomSheet = forwardRef(({ navigation, getLastActiveTab }, ref) => {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const [index, setIndex] = useState(-1);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const { setIsReceiptScanning, startScanningAnimation, stopScanningAnimation } = useReceiptScanning();

  // Get the target tab - prefer last active tab, fallback to checking navigation state
  const getTargetTab = useCallback(() => {
    // First, try to use the last active tab if provided
    if (getLastActiveTab) {
      const lastTab = getLastActiveTab();
      if (lastTab && lastTab !== 'Create') {
        return lastTab;
      }
    }
    
    // Fallback: Check navigation state to see which stack has nested routes
    try {
      const navState = navigation.getState();
      if (!navState) return 'Home';
      
      // Check which stack has nested screens (more than just the main screen)
      const homeRoute = navState.routes.find(r => r.name === 'Home');
      const profileRoute = navState.routes.find(r => r.name === 'Profile');
      
      // If Profile stack has nested routes, user was navigating in Profile
      if (profileRoute?.state?.routes) {
        const profileStackState = profileRoute.state;
        if (profileStackState.routes.length > 1) {
          const currentRoute = profileStackState.routes[profileStackState.index || 0];
          if (currentRoute?.name && currentRoute.name !== 'ProfileMain') {
            return 'Profile';
          }
        }
      }
      
      // If Home stack has nested routes, user was navigating in Home
      if (homeRoute?.state?.routes) {
        const homeStackState = homeRoute.state;
        if (homeStackState.routes.length > 1) {
          const currentRoute = homeStackState.routes[homeStackState.index || 0];
          if (currentRoute?.name && currentRoute.name !== 'HomeMain') {
            return 'Home';
          }
        }
      }
      
      // Default to Home
      return 'Home';
    } catch (error) {
      console.warn('Error determining target tab:', error);
      return 'Home';
    }
  }, [navigation, getLastActiveTab]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      setShowScanOptions(false);
      setShowJoinOptions(false);
      setJoinInput('');
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      setShowScanOptions(false);
      setShowJoinOptions(false);
      Keyboard.dismiss();
      bottomSheetRef.current?.close();
    },
    snapToIndex: (idx) => {
      setShowScanOptions(false);
      setShowJoinOptions(false);
      bottomSheetRef.current?.snapToIndex(idx);
    },
  }));

  const handleSheetChanges = useCallback((idx) => {
    setIndex(idx);
  }, []);

  const handleAddExpense = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.close();
    setTimeout(() => {
      // Navigate to SetupExpense directly as it's in the RootStack
      navigation.navigate('SetupExpense', { expenseType: 'expense' });
    }, 300);
  }, [navigation]);

  const handleScanReceipt = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowScanOptions(true);
  }, []);

  const handleTakePhoto = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Check access first
    const hasAccess = await requestReceiptScanningAccess();
    if (!hasAccess) {
      return;
    }

    bottomSheetRef.current?.close();
    setTimeout(() => {
      takePhoto(
        (imageUri) => processReceiptImage(
          imageUri,
          () => {
            setScanningReceipt(true);
            startScanningAnimation();
          },
          () => {
            setScanningReceipt(false);
            stopScanningAnimation();
          },
          (receiptData) => {
            // Navigate to SetupExpense directly as it's in the RootStack
            navigation.navigate('SetupExpense', { 
              expenseType: 'receipt',
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
      );
    }, 300);
  }, [navigation, startScanningAnimation, stopScanningAnimation, setIsReceiptScanning]);

  const handleJoinExpense = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowJoinOptions(true);
  }, []);

  const handleProcessJoin = useCallback(() => {
    const input = joinInput.trim();
    if (!input) {
      Alert.alert('Error', 'Please enter an invite link or code');
      return;
    }

    Keyboard.dismiss();
    bottomSheetRef.current?.close();

    // Check if it's a link or just a code
    // Try to parse as link first
    const parsed = parseExpenseJoinLink(input);
    
    if (parsed) {
      // It's a valid link
      deepLinkService.notifyListeners('expenseJoin', parsed);
    } else {
      // Treat as code
      deepLinkService.notifyListeners('expenseJoin', { code: input });
    }
    
    // Reset state after slight delay
    setTimeout(() => {
      setShowJoinOptions(false);
      setJoinInput('');
    }, 500);

  }, [joinInput]);

  const handlePickFromGallery = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Check access first
    const hasAccess = await requestReceiptScanningAccess();
    if (!hasAccess) {
      return;
    }

    bottomSheetRef.current?.close();
    setTimeout(() => {
      pickImage(
        (imageUri) => processReceiptImage(
          imageUri,
          () => {
            setScanningReceipt(true);
            startScanningAnimation();
          },
          () => {
            setScanningReceipt(false);
            stopScanningAnimation();
          },
          (receiptData) => {
            // Navigate to SetupExpense directly as it's in the RootStack
            navigation.navigate('SetupExpense', { 
              expenseType: 'receipt',
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
      );
    }, 300);
  }, [navigation, startScanningAnimation, stopScanningAnimation, setIsReceiptScanning]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={index}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={[styles.contentContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {showScanOptions ? (
          <>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => setShowScanOptions(false)}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.title}>Scan Receipt</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>
            
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.option}
                onPress={handleTakePhoto}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: Colors.blue + '20' }]}>
                  <Ionicons name="camera" size={28} color={Colors.blue} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Take Photo</Text>
                  <Text style={styles.optionSubtitle}>Capture a new receipt photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, { marginTop: Spacing.md }]}
                onPress={handlePickFromGallery}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: Colors.blue + '20' }]}>
                  <Ionicons name="images-outline" size={28} color={Colors.blue} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Choose from Gallery</Text>
                  <Text style={styles.optionSubtitle}>Select an existing photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        ) : showJoinOptions ? (
          <>
             <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => { setShowJoinOptions(false); Keyboard.dismiss(); }}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.title}>Join Expense</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Enter Invite Link or Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Paste link or code here..."
                value={joinInput}
                onChangeText={setJoinInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={Colors.textSecondary}
              />
              
              <TouchableOpacity
                style={[styles.actionButton, !joinInput.trim() && styles.disabledButton]}
                onPress={handleProcessJoin}
                disabled={!joinInput.trim()}
              >
                <Text style={styles.actionButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Create New</Text>
            </View>
            
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.option}
                onPress={handleAddExpense}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: Colors.brandLight }]}>
                  <Ionicons name="receipt-outline" size={28} color={Colors.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Add Expense</Text>
                  <Text style={styles.optionSubtitle}>Manually add an expense</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, { marginTop: Spacing.md }]}
                onPress={handleScanReceipt}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: Colors.blue + '10' }]}>
                  <Ionicons name="camera-outline" size={28} color={Colors.blue} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Scan Receipt</Text>
                  <Text style={styles.optionSubtitle}>Scan a receipt to extract items</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.option, { marginTop: Spacing.md }]}
                onPress={handleJoinExpense}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: Colors.accent + '10' }]}>
                  <Ionicons name="enter-outline" size={28} color={Colors.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Join Expense</Text>
                  <Text style={styles.optionSubtitle}>Use a link or code to join</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
});

CreateBottomSheet.displayName = 'CreateBottomSheet';

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    ...Shadows.card,
  },
  handleIndicator: {
    backgroundColor: Colors.divider,
    width: 40,
    height: 4,
  },
  contentContainer: {
    flex: 1,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  optionsContainer: {},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  optionSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  inputContainer: {
    paddingHorizontal: Spacing.sm,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
    opacity: 0.7,
  },
  actionButtonText: {
    ...Typography.title,
    color: Colors.surface,
    fontWeight: '600',
  },
});

export default CreateBottomSheet;
