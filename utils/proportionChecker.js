/**
 * Utility to detect when item assignment changes would affect settled fee proportions
 */

/**
 * Calculate proportions for each participant based on their consumption
 * Returns: Map<participantIndex, proportion>
 */
export const calculateProportions = (items, participants) => {
  const participantConsumption = participants.map((_, participantIndex) => {
    let totalConsumed = 0;

    items.forEach(item => {
      const itemAmount = parseFloat(item.amount) || 0;
      const itemConsumers = item.selectedConsumers || [];

      if (itemConsumers.includes(participantIndex)) {
        const amountConsumedByThisPerson = itemConsumers.length > 0
          ? itemAmount / itemConsumers.length
          : 0;
        totalConsumed += amountConsumedByThisPerson;
      }
    });

    return totalConsumed;
  });

  const totalItemAmount = items.reduce((sum, item) =>
    sum + (parseFloat(item.amount) || 0), 0);

  return participantConsumption.map((amount, index) => ({
    index,
    proportion: totalItemAmount > 0 ? amount / totalItemAmount : 0
  }));
};

/**
 * Check if changing item assignments would significantly affect fee proportions
 * Returns: { willChange: boolean, changes: Array, affectsSettled: boolean }
 */
export const checkProportionChange = (
  currentItems,
  newItems,
  participants,
  lockedItemIds,
  fees
) => {
  const currentProps = calculateProportions(currentItems, participants);
  const newProps = calculateProportions(newItems, participants);

  const THRESHOLD = 0.01; // 1% change is significant
  const changes = [];

  currentProps.forEach((current, idx) => {
    const newProp = newProps[idx];
    const delta = Math.abs(newProp.proportion - current.proportion);

    if (delta > THRESHOLD) {
      changes.push({
        participantIndex: idx,
        participantName: participants[idx]?.name,
        oldProportion: current.proportion,
        newProportion: newProp.proportion,
        delta: delta
      });
    }
  });

  // Check if any fees are settled (locked)
  const hasSettledFees = fees.some(fee => lockedItemIds.has(fee.id));

  return {
    willChange: changes.length > 0,
    changes,
    affectsSettled: hasSettledFees && changes.length > 0,
    settledFees: fees.filter(fee => lockedItemIds.has(fee.id))
  };
};

/**
 * Format proportion change for display to user
 */
export const formatProportionChange = (change, fees) => {
  const oldPercent = (change.oldProportion * 100).toFixed(1);
  const newPercent = (change.newProportion * 100).toFixed(1);

  // Calculate what this means in dollar terms for each fee
  const feeImpacts = fees.map(fee => {
    const oldAmount = fee.amount * change.oldProportion;
    const newAmount = fee.amount * change.newProportion;
    const diff = newAmount - oldAmount;

    return {
      feeName: fee.name,
      oldAmount: oldAmount.toFixed(2),
      newAmount: newAmount.toFixed(2),
      difference: diff.toFixed(2)
    };
  });

  return {
    participant: change.participantName,
    proportionChange: `${oldPercent}% → ${newPercent}%`,
    feeImpacts
  };
};
