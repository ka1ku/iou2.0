const updateParticipant = (index, name, participants, setParticipants) => {
  const updated = [...participants];
  updated[index] = { name };
  setParticipants(updated);
};

export default updateParticipant;
