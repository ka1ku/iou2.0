import React from 'react';
import { View, Text } from 'react-native';
import SmartSplitInput from './SmartSplitInput';

// Simple test component to verify SmartSplitInput works
const SmartSplitTest = () => {
  const testParticipants = [
    { name: 'Test User 1' },
    { name: 'Test User 2' },
    { name: 'Test User 3' }
  ];

  const handleTestChange = (splits) => {
    console.log('Test splits changed:', splits);
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Smart Split Test</Text>
      <SmartSplitInput
        participants={testParticipants}
        total={50.00}
        onSplitsChange={handleTestChange}
      />
    </View>
  );
};

export default SmartSplitTest;
