import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track form changes and provide navigation warning functionality
 * @param {Object} initialData - The initial form data to compare against (can be null for new forms)
 * @param {boolean} isEditing - Whether the form is in edit mode
 * @returns {Object} - Object containing hasChanges and resetChanges functions
 */
const useFormChangeTracker = (initialData, isEditing = false) => {
  const [hasChanges, setHasChanges] = useState(false);
  const initialDataRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Initialize the initial data reference when the form first loads
  useEffect(() => {
    // For editing: use the provided initial data
    // For creating: initialize with empty/default form state
    if (!isInitializedRef.current) {
      if (isEditing && initialData) {
        // Editing existing expense/receipt
        initialDataRef.current = JSON.stringify(initialData);
        console.log('Initial data captured (editing):', initialDataRef.current);
      } else {
        // Creating new expense/receipt - initialize with empty state
        const emptyFormData = {
          title: '',
          participants: [{ name: 'Me', userId: null, placeholder: false }],
          items: [{ name: '', amount: 0, selectedConsumers: [0] }],
          fees: [],
          selectedPayers: [0],
          joinEnabled: true
        };
        initialDataRef.current = JSON.stringify(emptyFormData);
        console.log('Initial data captured (creating):', initialDataRef.current);
      }
      isInitializedRef.current = true;
    }
  }, [isEditing, initialData]);

  // Normalize data to only include relevant fields for comparison
  const normalizeData = (data) => {
    if (!data) return null;
    
    return {
      title: data.title || '',
      participants: (data.participants || []).slice(1).map(p => ({
        name: p.name || '',
        userId: p.userId || null,
        placeholder: p.placeholder || false
      })),
      items: (data.items || []).map(item => ({
        name: item.name || '',
        amount: item.amount || 0,
        selectedConsumers: item.selectedConsumers || []
      })),
      fees: (data.fees || []).map(fee => ({
        name: fee.name || '',
        amount: fee.amount || 0,
        type: fee.type || 'fixed',
        percentage: fee.percentage || null
      })),
      selectedPayers: data.selectedPayers || [],
      joinEnabled: data.joinEnabled !== undefined ? data.joinEnabled : true
    };
  };

  // Check if current data differs from initial data
  const checkForChanges = (currentData) => {
    if (!initialDataRef.current) {
      console.log('No initial data available');
      return false;
    }
    
    // Normalize both current and initial data for fair comparison
    const normalizedCurrent = normalizeData(currentData);
    const normalizedInitial = normalizeData(JSON.parse(initialDataRef.current));
    
    const currentDataString = JSON.stringify(normalizedCurrent);
    const initialDataString = JSON.stringify(normalizedInitial);
    
    const hasChanged = currentDataString !== initialDataString;
    return hasChanged;
  };

  // Update the hasChanges state
  const updateChangeStatus = (currentData) => {
    const changed = checkForChanges(currentData);
    setHasChanges(changed);
  };

  // Reset the change tracker (useful after successful save)
  const resetChanges = () => {
    // Reset to current form state after successful save
    if (initialDataRef.current) {
      // For editing: reset to the original data
      // For creating: reset to current form state (since it's now "saved")
      if (isEditing && initialData) {
        initialDataRef.current = JSON.stringify(initialData);
      } else {
        // For new forms, update the initial data to current state
        // This prevents showing "unsaved changes" after saving
        const currentFormData = {
          title: '',
          participants: [{ name: 'Me', userId: null, placeholder: false }],
          items: [{ name: '', amount: 0, selectedConsumers: [0] }],
          fees: [],
          selectedPayers: [0],
          joinEnabled: true
        };
        initialDataRef.current = JSON.stringify(currentFormData);
      }
    }
    setHasChanges(false);
  };

  return {
    hasChanges,
    updateChangeStatus,
    resetChanges,
    checkForChanges
  };
};

export default useFormChangeTracker;
