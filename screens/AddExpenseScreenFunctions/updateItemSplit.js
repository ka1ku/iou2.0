const updateItemSplit = (itemIndex, participantIndex, amount, items, setItems) => {
  const updated = [...items];
  const item = updated[itemIndex];
  
  if (!item.splits) {
    item.splits = [];
  }
  
  const existingSplitIndex = item.splits.findIndex(s => s.participantIndex === participantIndex);
  if (existingSplitIndex >= 0) {
    item.splits[existingSplitIndex].amount = amount || 0;
  } else {
    item.splits.push({
      participantIndex,
      amount: amount || 0
    });
  }
  
  setItems(updated);
};

export default updateItemSplit;
