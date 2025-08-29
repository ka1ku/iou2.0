import React from 'react';
import { View } from 'react-native';
import { ItemHeader, PriceInputSection, CombinedConsumersAndSplitSection } from '../AddExpenseScreenItems';

const renderItem = (
  item,
  index,
  participants,
  items,
  setItems,
  updateItem,
  fees,
  setFees,
  styles,
  selectedPayers,
  onPayersChange,
  isReceipt = false
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
        participants={participants}
        selectedPayers={isReceipt ? undefined : selectedPayers}
        onPayersChange={isReceipt ? undefined : onPayersChange}
      />

      <CombinedConsumersAndSplitSection
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
              // Split amount evenly and round to nearest cent for each consumer
              const baseAmount = Math.floor((amount * 100) / consumers.length) / 100;
              const remainder = Math.round((amount - (baseAmount * consumers.length)) * 100) / 100;
              const splitAmounts = new Array(consumers.length).fill(baseAmount);
              console.log(splitAmounts, 'splitAmounts')
              // Distribute the remainder cents to the first few consumers
              const remainderCents = Math.round(remainder * 100);
              for (let i = 0; i < remainderCents; i++) {
                splitAmounts[i] = Math.round((splitAmounts[i] + 0.01) * 100) / 100;
              }
              updated[index].splits = consumers.map((consumerIndex, i) => ({
                participantIndex: consumerIndex,
                amount: splitAmounts[i],
                percentage: 100 / consumers.length
              }));

            }
          } else {
            updated[index].splits = [];
          }
          setItems(updated);
        }}
        total={parseFloat(item.amount) || 0}
        initialSplits={item.splits || []}
        onSplitsChange={(newSplits) => {
          // Update the item's splits
          const updated = [...items];
          updated[index].splits = newSplits;
          setItems(updated);
        }}
        isReceipt={isReceipt}
      />
    </View>
  );
};

export default renderItem;
