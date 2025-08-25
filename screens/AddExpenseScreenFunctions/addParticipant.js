const addParticipant = (participants, setParticipants) => {
  setParticipants([...participants, { name: '' }]);
};

export default addParticipant;
