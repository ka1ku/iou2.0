const addItem = (items, setItems, participants) => {
  // Get payers from the last item if it exists, otherwise default to "Me"
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const payersToUse = lastItem && lastItem.selectedPayers ? lastItem.selectedPayers : [0];
  
  const newItem = {
    id: Date.now().toString(),
    name: '',
    amount: 0,
    selectedConsumers: [], // No one selected by default
    splits: [],
    selectedPayers: payersToUse // Use the same payers as the previous item
  };
  setItems([...items, newItem]);
};

export default addItem;
