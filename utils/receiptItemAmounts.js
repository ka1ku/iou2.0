const roundCurrency = (value) => {
  const amount = Number(value) || 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeFeeCalcType = (item) => {
  if (!item?.isExtraFee) return 'fixed';
  return item.feeCalcType === 'percentage' ? 'percentage' : 'fixed';
};

export const normalizeReceiptItem = (item = {}) => {
  const isExtraFee = item.isExtraFee === true;
  const feeCalcType = normalizeFeeCalcType(item);
  const feePercentage = Number(item.feePercentage);
  const hasFeePercentage = Number.isFinite(feePercentage) && feePercentage > 0;
  const quantity = parsePositiveNumber(item.quantity, 1);
  const rawAmount = roundCurrency(item.amount);
  const parsedUnitAmount = Number(item.unitAmount);
  const unitAmount = Number.isFinite(parsedUnitAmount)
    ? roundCurrency(parsedUnitAmount)
    : roundCurrency(rawAmount / quantity);

  return {
    ...item,
    amount: rawAmount,
    unitAmount,
    quantity,
    isExtraFee,
    feeCalcType,
    feePercentage: feeCalcType === 'percentage' && hasFeePercentage ? feePercentage : null,
  };
};

export const materializeReceiptItems = (items = []) => {
  const normalized = items.map(normalizeReceiptItem);
  const normalizedWithQuantityApplied = normalized.map((item) => {
    if (item.isExtraFee && item.feeCalcType === 'percentage') return item;
    return {
      ...item,
      amount: roundCurrency((Number(item.unitAmount) || 0) * (Number(item.quantity) || 1)),
    };
  });
  const subtotal = normalizedWithQuantityApplied
    .filter((item) => !item.isExtraFee)
    .reduce((sum, item) => sum + roundCurrency(item.amount), 0);

  return normalizedWithQuantityApplied.map((item) => {
    if (!item.isExtraFee || item.feeCalcType !== 'percentage') {
      return { ...item, amount: roundCurrency(item.amount) };
    }

    const pct = Math.max(0, Math.min(100, Number(item.feePercentage) || 0));
    const derivedAmount = roundCurrency((subtotal * pct) / 100);
    return { ...item, amount: derivedAmount };
  });
};

export const calculateReceiptTotals = (items = []) => {
  const materializedItems = materializeReceiptItems(items);
  const subtotal = materializedItems
    .filter((item) => !item.isExtraFee)
    .reduce((sum, item) => sum + roundCurrency(item.amount), 0);
  const feesTotal = materializedItems
    .filter((item) => item.isExtraFee)
    .reduce((sum, item) => sum + roundCurrency(item.amount), 0);

  return {
    items: materializedItems,
    subtotal: roundCurrency(subtotal),
    feesTotal: roundCurrency(feesTotal),
    total: roundCurrency(subtotal + feesTotal),
  };
};
