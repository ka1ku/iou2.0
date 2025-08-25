const addFee = (fees, setFees) => {
  const newFee = {
    id: Date.now().toString(),
    name: '',
    amount: 0,
    type: 'percentage', // 'percentage' or 'fixed'
    percentage: 15, // default 15% tip
    splitType: 'proportional', // 'equal' or 'proportional'
    splits: []
  };
  setFees([...fees, newFee]);
};

export default addFee;
