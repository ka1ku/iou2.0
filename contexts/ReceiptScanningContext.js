import React, { createContext, useContext, useState } from 'react';

const ReceiptScanningContext = createContext();

export const useReceiptScanning = () => {
  const context = useContext(ReceiptScanningContext);
  if (!context) {
    throw new Error('useReceiptScanning must be used within a ReceiptScanningProvider');
  }
  return context;
};

export const ReceiptScanningProvider = ({ children }) => {
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [showScanningOverlay, setShowScanningOverlay] = useState(false);

  const startScanningAnimation = () => setShowScanningOverlay(true);
  const stopScanningAnimation = () => setShowScanningOverlay(false);

  const value = {
    isReceiptScanning,
    setIsReceiptScanning,
    showScanningOverlay,
    setShowScanningOverlay,
    startScanningAnimation,
    stopScanningAnimation,
  };

  return (
    <ReceiptScanningContext.Provider value={value}>
      {children}
    </ReceiptScanningContext.Provider>
  );
};

export default ReceiptScanningContext;



