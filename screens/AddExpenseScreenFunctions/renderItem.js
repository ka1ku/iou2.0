import React from 'react';
import { View } from 'react-native';
import { ItemHeader, PriceInputSection, WhoConsumedSection, SmartSplitSection } from '../AddExpenseScreenItems';

const renderItem = (
  item,
  index,
  participants,
  items,
  setItems,
  updateItem,
  fees,
  setFees,
  styles
) => {
  return (
    <View key={item.id} style={styles.itemCard}>
      <ItemHeader
        itemName={item.name}
        onNameChange={(text) => updateItem(index, 'name', text, items, setItems, fees, setFees)}
      />

      <PriceInputSection
        amount={item.amount}
        onAmountChange={(amount) => updateItem(index, 'amount', amount, items, setItems, fees, setFees)}
      />

      <WhoConsumedSection
        participants={participants}
        selectedConsumers={item.selectedConsumers || [0]}
        onConsumersChange={(consumers) => {
          const updated = [...items];
          updated[index].selectedConsumers = consumers;
          // Recalculate splits for new consumers
          const amount = parseFloat(updated[index].amount) || 0;
          if (amount > 0 && consumers.length > 0) {
            if (consumers.length === 1) {
              // Single consumer gets 100% of the amount
              updated[index].splits = [{
                participantIndex: consumers[0],
                amount: amount,
                percentage: 100
              }];
            } else {
              // Multiple consumers split evenly
              const splitAmount = amount / consumers.length;
              updated[index].splits = consumers.map((consumerIndex, i) => ({
                participantIndex: consumerIndex,
                amount: splitAmount,
                percentage: 100 / consumers.length
              }));
            }
          } else {
            updated[index].splits = [];
          }
          setItems(updated);
        }}
      />

      <SmartSplitSection
        participants={participants}
        selectedConsumers={item.selectedConsumers || [0]}
        total={parseFloat(item.amount) || 0}
        initialSplits={item.splits || []}
        onSplitsChange={(newSplits) => {
          // Update the item's splits
          const updated = [...items];
          updated[index].splits = newSplits;
          setItems(updated);
        }}
      />
    </View>
  );
};

// Note: styles should be imported from the main component or defined here
// The styles.itemCard will be passed from the parent component

export default renderItem;
