import React, { forwardRef, useImperativeHandle, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Colors, Spacing, Radius, Shadows, Typography } from '../design/tokens';
import { handleTakePhoto, handlePickImage } from '../services/imageHandler';
import { processReceiptImage } from '../services/receiptScanner';
import { requestReceiptScanningAccess } from '../services/subscriptionService';
import { useReceiptScanning } from '../contexts/ReceiptScanningContext';

const CreateBottomSheet = forwardRef(({ navigation }, ref) => {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const [index, setIndex] = useState(-1);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const { setIsReceiptScanning, startScanningAnimation, stopScanningAnimation } = useReceiptScanning();

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
    snapToIndex: (idx) => {
      bottomSheetRef.current?.snapToIndex(idx);
    },
  }));

  const handleSheetChanges = useCallback((idx) => {
    setIndex(idx);
  }, []);

  const handleAddExpense = useCallback(() => {
    bottomSheetRef.current?.close();
    setTimeout(() => {
      navigation.navigate('Home', {
        screen: 'SetupExpense',
        params: { expenseType: 'expense' },
      });
    }, 300);
  }, [navigation]);

  const handleScanReceipt = useCallback(async () => {
    bottomSheetRef.current?.close();
    
    try {
      const hasAccess = await requestReceiptScanningAccess();
      
      if (!hasAccess) {
        return;
      }
      
      setTimeout(() => {
        Alert.alert(
          'Scan Receipt',
          'Choose how you want to scan your receipt.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Take Photo', 
              onPress: () => handleTakePhoto(
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
                    navigation.navigate('Home', {
                      screen: 'SetupExpense',
                      params: { 
                        expenseType: 'receipt',
                        scannedReceipt: receiptData,
                        fromReceiptScan: true 
                      }
                    });
                  },
                  (errorMessage) => {
                    Alert.alert('Receipt Scanning Error', errorMessage);
                  }
                ),
                (error) => Alert.alert('Error', error),
                setIsReceiptScanning
              ) 
            },
            { 
              text: 'Choose from Gallery', 
              onPress: () => handlePickImage(
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
                    navigation.navigate('Home', {
                      screen: 'SetupExpense',
                      params: { 
                        expenseType: 'receipt',
                        scannedReceipt: receiptData,
                        fromReceiptScan: true 
                      }
                    });
                  },
                  (errorMessage) => {
                    Alert.alert('Receipt Scanning Error', errorMessage);
                  }
                ),
                (error) => Alert.alert('Error', error),
                setIsReceiptScanning
              ) 
            }
          ]
        );
      }, 300);
    } catch (error) {
      Alert.alert('Error', 'Failed to start receipt scanning');
    }
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
        
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.option}
            onPress={handleAddExpense}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.accent + '20' }]}>
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
            <View style={[styles.optionIcon, { backgroundColor: Colors.blue + '20' }]}>
              <Ionicons name="camera-outline" size={28} color={Colors.blue} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Scan Receipt</Text>
              <Text style={styles.optionSubtitle}>Scan a receipt to extract items</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
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
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  optionsContainer: {},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceLight,
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
});

export default CreateBottomSheet;
