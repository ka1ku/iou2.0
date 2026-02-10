import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import { imageToBase64 } from './imageHandler';


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
  "subtotal": "number",
  "total": "number", 
  "items": [{"name": "item", "amount": "number", "quantity": "number"}],
  "fees": [{"name": "fee", "type": "percentage|fixed", "percentage": "number", "amount": "number"}],
  "participants": [{"name": "You", "paidBy": true}]
}
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

    return {
      title: receiptData.title || 'Receipt',
      date: receiptData.date || new Date().toISOString().split('T')[0],
      subtotal: Number(receiptData.subtotal) || 0,
      total: Number(receiptData.total) || 0,
      items: (receiptData.items || []).map(item => ({
        name: item.name || 'Item',
        amount: Number(item.amount) || 0,
        quantity: Number(item.quantity) || 1
      })),
      fees: (receiptData.fees || []).map(fee => ({
        name: fee.name || 'Fee',
        type: fee.type || 'fixed',
        percentage: Number(fee.percentage) || null,
        amount: Number(fee.amount) || 0
      })),
      participants: receiptData.participants || [{ name: 'You', paidBy: true }]
    };
    
  } catch (error) {
    throw new Error('Failed to scan receipt with Firebase AI: ' + error.message);
  }
};
