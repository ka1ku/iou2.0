const updateFee = (index, field, value, fees, setFees, items) => {
  const updated = [...fees];
  updated[index] = { ...updated[index], [field]: value };
  
  // Recalculate amount if percentage changed
  if (field === 'percentage' && updated[index].type === 'percentage') {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    updated[index].amount = (itemsTotal * value) / 100;
  }
  
  // Recalculate amount if type changed from fixed to percentage
  if (field === 'type' && value === 'percentage') {
    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    updated[index].amount = (itemsTotal * (updated[index].percentage || 15)) / 100;
  }
  
  setFees(updated);
};

export default updateFee;
