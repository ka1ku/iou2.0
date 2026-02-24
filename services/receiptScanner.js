import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import { imageToBase64 } from './imageHandler';

/** Parse a numeric value from AI output (may be string or number); default if invalid. */
const parseNum = (value, fallback) => {
  if (value == null) return fallback;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

/** Parse quantity: must be > 0; default 1. */
const parseQuantity = (value) => {
  const q = parseNum(value, 1);
  return q > 0 ? q : 1;
};

/** Parse amount (currency); default 0. */
const parseAmount = (value) => Math.max(0, parseNum(value, 0));

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** If the string is all caps, convert to title case (first letter of each word only). */
const fixAllCaps = (str) => {
  if (str == null || typeof str !== 'string') return str;
  const trimmed = str.trim();
  const letters = trimmed.replace(/\W/g, '');
  if (!letters || letters !== letters.toUpperCase()) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const processReceiptImage = async (imageUri, onStart, onStop, onSuccess, onError) => {
  if (onStart) onStart();
  
  try {
    const base64Image = await imageToBase64(imageUri);
    const receiptData = await scanReceiptWithAI(base64Image);
    
    if (onStop) onStop();
    if (onSuccess) onSuccess(receiptData);
    
  } catch (error) {
    if (onStop) onStop();
    
    let errorMessage = 'Failed to process receipt. ';
    if (error.message.includes('base64')) {
      errorMessage += 'There was an issue with the image format. Please try a different image format.';
    } else if (error.message.includes('Firebase AI')) {
      errorMessage += 'There was an issue with the AI service. Please try again.';
    } else if (error.message.includes('Not a receipt')) {
      errorMessage = 'This image does not appear to be a receipt. Please try with a clear receipt image.';
    } else if (error.message.includes('Could not extract')) {
      errorMessage = 'Could not extract any usable information from this image. Please ensure it\'s a clear receipt and try again.';
    } else {
      errorMessage += 'Please try again or enter manually.';
    }
    
    if (onError) onError(errorMessage);
  }
};

export const scanReceiptWithAI = async (base64Image) => {
  try {
    const app = getApp();
    const ai = getAI(app);
    const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite-preview-09-2025' });

    const prompt = `Extract receipt data as JSON:
{
  "title": "Business name",
  "date": "YYYY-MM-DD",
  "subtotal": number,
  "total": number,
  "items": [{"name": "item name", "amount": number, "quantity": number}],
  "fees": [{"name": "fee name (e.g. Tax, Tip, Service Charge)", "amount": number}],
  "participants": [{"name": "You", "paidBy": true}]
}

Rules:
- Line with a price → output as a new item (name, amount, quantity).
- Line with no price AND indented (or subordinate) → do NOT create a new item; append its text to the previous item's name (e.g. "Adult" then indented "Section B" → one item named "Adult - Section B" with the previous line's amount and quantity).
- "name" = product/description only. Do NOT include the price or quantity in the name.
- "amount" = line total (quantity × unit price). "quantity" = number of that item.
- Put tips, taxes, service charges, delivery fees, etc. in "fees" with "name" and "amount".
- Use numeric values (not quoted) for amounts and quantities.
Respond with ONLY valid JSON.`;

    const response = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
    ]);

    const responseText = response.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error('No valid JSON found');

    const receiptData = JSON.parse(jsonMatch[0]);

    if (receiptData.error === 'Not a receipt') {
      throw new Error('This image does not appear to be a receipt. Please try with a clear receipt image.');
    }

    // Convert regular items with robust parsing
    const regularItems = (receiptData.items || []).map((item) => {
      const quantity = parseQuantity(item.quantity);
      const amount = parseAmount(item.amount);
      const unitAmount = quantity > 0 ? Math.round((amount / quantity + Number.EPSILON) * 100) / 100 : amount;
      return {
        name: (item.name != null && String(item.name).trim()) ? String(item.name).trim() : 'Item',
        amount,
        unitAmount,
        quantity,
        isExtraFee: false,
      };
    });

    // Convert fees to items with isExtraFee flag; robust parsing for amount and name
    const feeItems = (receiptData.fees || []).map((fee) => ({
      name: (fee.name != null && String(fee.name).trim()) ? String(fee.name).trim() : 'Fee',
      amount: parseAmount(fee.amount),
      quantity: 1,
      isExtraFee: true,
    }));

    // Combine items and fees into single array (fees at the end)
    const allItems = [...regularItems, ...feeItems];

    const computedSubtotal = roundCurrency(
      regularItems.reduce((sum, item) => sum + item.amount, 0)
    );
    const computedTotal = roundCurrency(
      allItems.reduce((sum, item) => sum + item.amount, 0)
    );
    const statedTotal = parseAmount(receiptData.total);
    const mismatchCents = Math.abs(computedTotal - statedTotal);
    const totalMismatch = mismatchCents > 0.1;

    const rawTitle = (receiptData.title != null && String(receiptData.title).trim()) ? String(receiptData.title).trim() : 'Receipt';
    return {
      title: fixAllCaps(rawTitle) || rawTitle,
      date: receiptData.date || new Date().toISOString().split('T')[0],
      subtotal: computedSubtotal,
      total: computedTotal,
      items: allItems,
      participants: receiptData.participants || [{ name: 'You', paidBy: true }],
      ...(totalMismatch && { totalMismatch: true, statedTotal }),
    };
    
  } catch (error) {
    throw new Error('Failed to scan receipt with Firebase AI: ' + error.message);
  }
};
