const addItem = (items, setItems, participants) => {
  const newItem = {
    id: Date.now().toString(),
    name: '',
    amount: 0,
    selectedConsumers: participants.length > 0 ? [0] : [], // Default to first participant (usually "Me")
    splits: []
  };
  setItems([...items, newItem]);
};

export default addItem;
