const removePlaceholder = (ghostId, placeholders, setPlaceholders, items, setItems, selectedFriends) => {
  const indexInPlaceholders = placeholders.findIndex(p => p.id === ghostId);
  if (indexInPlaceholders < 0) return;
  
  // Compute participant index in the combined participants array
  const removedParticipantIndex = 1 + selectedFriends.length + indexInPlaceholders; // 0 is Me

  // Adjust item splits and selectedConsumers similar to previous removeParticipant logic
  setItems(prevItems => prevItems.map(item => ({
    ...item,
    selectedConsumers: item.selectedConsumers?.filter(consumerIndex => consumerIndex !== removedParticipantIndex)
      .map(consumerIndex => consumerIndex > removedParticipantIndex ? consumerIndex - 1 : consumerIndex) || [],
    splits: item.splits?.filter(split => split.participantIndex !== removedParticipantIndex)
      .map(split => ({
        ...split,
        participantIndex: split.participantIndex > removedParticipantIndex ? split.participantIndex - 1 : split.participantIndex
      })) || []
  })));

  setPlaceholders(prev => prev.filter(p => p.id !== ghostId));
};

export default removePlaceholder;
