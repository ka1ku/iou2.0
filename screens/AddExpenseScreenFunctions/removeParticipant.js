import { Alert } from 'react-native';

const removeParticipant = (index, participants, setParticipants, items, setItems) => {
  if (participants.length > 1) {
    setParticipants(participants.filter((_, i) => i !== index));
    // Update item splits and selectedConsumers to remove this participant
    setItems(items.map(item => ({
      ...item,
      selectedConsumers: item.selectedConsumers?.filter(consumerIndex => consumerIndex !== index)
        .map(consumerIndex => consumerIndex > index ? consumerIndex - 1 : consumerIndex) || [],
      splits: item.splits?.filter(split => split.participantIndex !== index)
        .map(split => ({
          ...split,
          participantIndex: split.participantIndex > index ? split.participantIndex - 1 : split.participantIndex
        }))
    })));
  } else {
    Alert.alert('Error', 'No participants');
  }
};

export default removeParticipant;
