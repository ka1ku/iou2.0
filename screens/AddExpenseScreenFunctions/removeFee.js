const removeFee = (index, fees, setFees) => {
  setFees(fees.filter((_, i) => i !== index));
};

export default removeFee;
