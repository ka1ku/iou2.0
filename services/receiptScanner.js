import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import { imageToBase64 } from './imageHandler';

/**
 * Receipt Scanner Service
 * Handles AI-powered receipt scanning and processing
 */

/**
 * Process a receipt image with AI scanning
 * @param {string} imageUri - URI of the receipt image
 * @param {Function} onStart - Callback when scanning starts
 * @param {Function} onStop - Callback when scanning stops
 * @param {Function} onSuccess - Callback when scanning succeeds
 * @param {Function} onError - Callback when scanning fails
 * @returns {Promise<void>}
 */
export const processReceiptImage = async (imageUri, onStart, onStop, onSuccess, onError) => {
  if (onStart) onStart();
  
  try {
    // Convert image to base64
    const base64Image = await imageToBase64(imageUri);
    
    // Use Firebase AI to scan the receipt
    const receiptData = await scanReceiptWithAI(base64Image);
    
    // Stop animation before navigation
    if (onStop) onStop();
    
    // Call success callback with the scanned data
    if (onSuccess) onSuccess(receiptData);
    
  } catch (error) {
    console.error('Error processing receipt:', error);
    
    // Stop animation on error
    if (onStop) onStop();
    
    let errorMessage = 'Failed to process receipt. ';
    if (error.message.includes('base64')) {
      errorMessage += 'There was an issue with the image format. Please try a different image format.';
    } else if (error.message.includes('Firebase AI')) {
      errorMessage += 'There was an issue with the AI service. Please try again.';
    } else if (error.message.includes('AI response')) {
      errorMessage += 'The AI could not properly read the receipt. Please ensure the image is clear and try again.';
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

/**
 * Scan receipt using Firebase AI
 * @param {string} base64Image - Base64 encoded image string
 * @returns {Promise<Object>} Processed receipt data
 */
export const scanReceiptWithAI = async (base64Image) => {
  try {
    const app = getApp();
    if (!app) {
      throw new Error('Firebase app not initialized');
    }
    
    const ai = getAI(app);
    if (!ai) {
      throw new Error('Firebase AI not initialized');
    }
    
    const model = getGenerativeModel(ai, { model: 'gemini-1.5-flash' });
    if (!model) {
      throw new Error('AI model not initialized');
    }

    const prompt = `You are a receipt scanning assistant. Analyze this receipt image and extract the following information in JSON format:

{
  "title": "Receipt title or business name (if not clear, use 'Receipt' or business name)",
  "date": "Date of purchase (YYYY-MM-DD) or today's date if not visible",
  "subtotal": "Items subtotal BEFORE tax/tip/fees as a number, or null if not visible",
  "total": "Grand total as a number, or null if not visible",
  "items": [
    {
      "name": "Item name (use 'Item' if unclear)",
      "amount": "Item price as a number",
      "quantity": "Quantity as a number (default to 1 if not visible)"
    }
  ],
  "fees": [
    {
      "name": "Tax | Tip | Gratuity | Service Fee | Delivery Fee | Convenience Fee | Surcharge",
      "type": "percentage | fixed",
      "percentage": "If percentage-based, the percent number; else null",
      "amount": "Numeric amount of this fee"
    }
  ],
  "participants": [
    {
      "name": "Your name",
      "paidBy": true
    }
  ],
  "notes": "Any additional notes from the receipt"
}

Important guidelines:
- Extract as much information as possible, even if some fields are unclear
- If a field is not visible or unclear, use null or a reasonable default
- For monetary amounts, remove $ signs and commas, convert to numbers
- If subtotal is not visible, it will be computed from items
- If total is not visible, it will be computed from subtotal + fees
- Use today's date if no date is visible
- If item names are unclear, use descriptive names like "Food Item", "Beverage", etc.
- Ensure the JSON is valid and properly formatted
- Respond with ONLY the JSON data, no extra text
- If this is clearly not a receipt (e.g., random photo, document, text message, etc.), respond with {"error": "Not a receipt"}
- If the image is too blurry or unreadable, try your best to extract what you can see
- A receipt should typically contain: business name, items purchased, prices, and/or a total amount
- If you see any of these elements, extract them even if incomplete`;

    // Create the content parts array as per Firebase AI documentation
    const contentParts = [
      { text: prompt },
      { 
        inlineData: { 
          mimeType: 'image/jpeg', 
          data: base64Image 
        } 
      }
    ];

    const response = await model.generateContent(contentParts);

    const responseText = response.response.text();
    console.log('AI Response:', responseText);
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const receiptData = JSON.parse(jsonMatch[0]);

        // Check if AI detected this is not a receipt
        if (receiptData.error === 'Not a receipt') {
          throw new Error('This image does not appear to be a receipt. Please try with a clear receipt image.');
        }

        // Basic validation - be more flexible
        // Only require that we have some basic structure that looks like a receipt
        if (!receiptData || typeof receiptData !== 'object') {
          throw new Error('AI response is not in the expected format');
        }

        // Normalize numeric fields with better fallbacks
        const items = Array.isArray(receiptData.items) ? receiptData.items.map(it => ({
          name: it.name || 'Item',
          amount: Number(it.amount) || 0,
          quantity: Number(it.quantity) || 1,
        })).filter(item => item.amount > 0) : []; // Only include items with valid amounts

        // Compute subtotal if missing or invalid
        const computedSubtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
        const subtotal = Number(receiptData.subtotal);
        const normalizedSubtotal = Number.isFinite(subtotal) && subtotal > 0 ? subtotal : computedSubtotal;

        // Normalize fees
        const rawFees = Array.isArray(receiptData.fees) ? receiptData.fees : [];
        const normalizedFees = rawFees.map(f => {
          const name = (f.name || '').trim() || 'Fee';
          const pct = f.percentage !== undefined && f.percentage !== null ? Number(f.percentage) : NaN;
          const amt = f.amount !== undefined && f.amount !== null ? Number(f.amount) : NaN;
          let type = f.type === 'percentage' || f.type === 'fixed' ? f.type : (Number.isFinite(pct) ? 'percentage' : 'fixed');

          let percentage = Number.isFinite(pct) ? pct : null;
          let amount = Number.isFinite(amt) ? amt : null;

          if (type === 'percentage') {
            if (percentage === null && Number.isFinite(amount) && normalizedSubtotal > 0) {
              percentage = (amount / normalizedSubtotal) * 100;
            }
            if (amount === null && Number.isFinite(percentage)) {
              amount = (normalizedSubtotal * percentage) / 100;
            }
          }

          // Fallbacks
          if (!Number.isFinite(amount)) amount = 0;
          if (!Number.isFinite(percentage)) percentage = null;

          return { name, type, percentage, amount };
        });

        // Calculate total if missing or invalid
        const rawTotal = Number(receiptData.total);
        const calculatedTotal = normalizedSubtotal + normalizedFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const normalizedTotal = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : calculatedTotal;

        // Ensure we have at least some basic data
        if (items.length === 0 && normalizedSubtotal === 0 && normalizedTotal === 0) {
          // If we have no items but have a title, create a minimal receipt
          if (receiptData.title && receiptData.title !== 'Receipt') {
            console.log('Creating minimal receipt from available data');
            const minimalReceipt = {
              title: receiptData.title,
              date: receiptData.date || new Date().toISOString().split('T')[0],
              subtotal: 0,
              total: 0,
              items: [],
              fees: [],
              participants: [{ name: 'You', paidBy: true }],
              notes: 'Minimal receipt data extracted'
            };
            return minimalReceipt;
          }
          throw new Error('Could not extract any usable information from this image. Please ensure it\'s a clear receipt.');
        }

        const finalReceiptData = {
          ...receiptData,
          title: receiptData.title || 'Receipt',
          date: receiptData.date || new Date().toISOString().split('T')[0],
          items,
          subtotal: normalizedSubtotal,
          fees: normalizedFees,
          total: normalizedTotal,
        };

        console.log('Processed receipt data:', finalReceiptData);
        return finalReceiptData;
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        throw new Error('AI response contained invalid JSON format: ' + parseError.message);
      }
    } else {
      console.error('No JSON found in response:', responseText);
      
      // Check if the response contains any useful information that we can parse
      if (responseText.toLowerCase().includes('receipt') || 
          responseText.toLowerCase().includes('total') || 
          responseText.toLowerCase().includes('amount') ||
          responseText.toLowerCase().includes('$')) {
        // Try to create a minimal receipt from the text response
        const fallbackData = {
          title: 'Receipt (AI Response)',
          date: new Date().toISOString().split('T')[0],
          subtotal: 0,
          total: 0,
          items: [],
          fees: [],
          participants: [{ name: 'You', paidBy: true }],
          notes: 'AI response: ' + responseText.substring(0, 200) + '...'
        };
        
        console.log('Using fallback receipt data:', fallbackData);
        return fallbackData;
      }
      
      throw new Error('AI response did not contain valid JSON structure and no useful receipt information was found');
    }
    
  } catch (error) {
    console.error('AI scanning error:', error);
    
    // Handle specific error cases
    if (error.message.includes('AI response')) {
      throw error; // Re-throw our custom errors
    } else if (error.message.includes('Not a receipt')) {
      throw error; // Re-throw receipt validation errors
    } else if (error.message.includes('Could not extract')) {
      throw error; // Re-throw extraction errors
    } else {
      // For other errors, try to provide a helpful message
      console.error('Unexpected AI error:', error);
      throw new Error('Failed to scan receipt with Firebase AI: ' + error.message);
    }
  }
};
