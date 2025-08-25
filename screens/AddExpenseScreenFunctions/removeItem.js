const removeItem = (index, items, setItems, fees, setFees) => {
  const updatedItems = items.filter((_, i) => i !== index);
  setItems(updatedItems);
  
  // Recalculate percentage-based fees when items are removed
  const updatedFees = fees.map(fee => {
    if (fee.type === 'percentage') {
      const itemsTotal = updatedItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      return { ...fee, amount: (itemsTotal * fee.percentage) / 100 };
    }
    return fee;
  });
  setFees(updatedFees);
};

export default removeItem;
