import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track form changes and provide navigation warning functionality
 * @param {Object} initialData - The initial form data to compare against
 * @param {boolean} isEditing - Whether the form is in edit mode
 * @returns {Object} - Object containing hasChanges and resetChanges functions
 */
const useFormChangeTracker = (initialData, isEditing = false) => {
  const [hasChanges, setHasChanges] = useState(false);
  const initialDataRef = useRef(null);

  // Initialize the initial data reference only once when editing starts
  useEffect(() => {
    if (isEditing && initialData) {
      initialDataRef.current = JSON.stringify(initialData);
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
    if (!isEditing || !initialDataRef.current) {
      console.log('No editing or no initial data');
      return false;
    }
    
    // Normalize both current and initial data for fair comparison
    const normalizedCurrent = normalizeData(currentData);
    const normalizedInitial = normalizeData(JSON.parse(initialDataRef.current));
    
    const currentDataString = JSON.stringify(normalizedCurrent);
    const initialDataString = JSON.stringify(normalizedInitial);
    
    const hasChanged = currentDataString !== initialDataString;
    console.log('Checking changes:', hasChanged);
    console.log('Current (normalized):', currentDataString);
    console.log('Initial (normalized):', initialDataString);
    return hasChanged;
  };

  // Update the hasChanges state
  const updateChangeStatus = (currentData) => {
    const changed = checkForChanges(currentData);
    console.log('changed', changed);
    setHasChanges(changed);
  };

  // Reset the change tracker (useful after successful save)
  const resetChanges = () => {
    if (isEditing && initialData) {
      initialDataRef.current = JSON.stringify(initialData);
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
