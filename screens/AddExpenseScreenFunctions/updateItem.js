const updateItem = (index, field, value, items, setItems, fees, setFees) => {
  const updated = [...items];
  updated[index] = { ...updated[index], [field]: value };
  
  // If amount changed, recalculate splits
  if (field === 'amount') {
    const amount = parseFloat(value) || 0;
    const selectedConsumers = updated[index].selectedConsumers || [0];
    if (selectedConsumers.length > 0) {
      if (selectedConsumers.length === 1) {
        // Single consumer gets 100% of the amount
        updated[index].splits = [{
          participantIndex: selectedConsumers[0],
          amount: amount,
          percentage: 100
        }];
      } else {
        // Multiple consumers split evenly
        const splitAmount = amount / selectedConsumers.length;
        updated[index].splits = selectedConsumers.map((consumerIndex, i) => ({
          participantIndex: consumerIndex,
          amount: splitAmount,
          percentage: 100 / selectedConsumers.length
        }));
      }
    }
  }
  
  setItems(updated);
  
  // Recalculate percentage-based fees when items change
  if (field === 'amount') {
    const updatedFees = fees.map(fee => {
      if (fee.type === 'percentage') {
        const itemsTotal = updated.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        return { ...fee, amount: (itemsTotal * fee.percentage) / 100 };
      }
      return fee;
    });
    setFees(updatedFees);
  }
};

export default updateItem;
