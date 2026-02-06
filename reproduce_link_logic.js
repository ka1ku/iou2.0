
const generateJoinCode = () => 'ABC123XYZ789';
const generateInviteToken = () => 'sometoken123';

const generateExpenseJoinLink = ({ expenseId, token, code, phone, preferUniversal = false }) => {
  const base = preferUniversal ? 'https://kailee.iou20.com/' : 'com.kailee.iou20://';
  const path = `expense/${expenseId}/${token}`;
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (phone) params.set('phone', phone);
  const query = params.toString();
  return query ? `${base}${path}?${query}` : `${base}${path}`;
};

const parseExpenseJoinLink = (url) => {
  try {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const match = url.match(/expense\/([^\/]+)\/([^\/\?]+)/);
    const queryIndex = url.indexOf('?');
    const queryString = queryIndex !== -1 ? url.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(queryString);

    if (match) {
      return {
        expenseId: match[1],
        token: match[2],
        code: params.get('code') || null,
        phone: params.get('phone') || null,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
};

// Test Case 1: Standard Link
const expenseId = 'exp123';
const token = 'tok456';
const code = 'COD789';
const link = generateExpenseJoinLink({ expenseId, token, code });
console.log('Generated Link:', link);

const parsed = parseExpenseJoinLink(link);
console.log('Parsed:', parsed);

if (parsed && parsed.expenseId === expenseId && parsed.token === token && parsed.code === code) {
    console.log('Test 1 Passed');
} else {
    console.log('Test 1 Failed');
}

// Test Case 2: With Phone
const phone = '1234567890';
const linkWithPhone = generateExpenseJoinLink({ expenseId, token, code, phone });
console.log('Generated Link with Phone:', linkWithPhone);

const parsedWithPhone = parseExpenseJoinLink(linkWithPhone);
console.log('Parsed with Phone:', parsedWithPhone);

if (parsedWithPhone && parsedWithPhone.phone === phone) {
    console.log('Test 2 Passed');
} else {
    console.log('Test 2 Failed');
}

// Test Case 3: Universal Link (simulate logic even if domain is down)
const universalLink = "https://kailee.iou20.com/expense/exp123/tok456?code=COD789";
const parsedUniversal = parseExpenseJoinLink(universalLink);
console.log('Parsed Universal:', parsedUniversal);
if (parsedUniversal && parsedUniversal.expenseId === 'exp123') {
    console.log('Test 3 Passed');
} else {
    console.log('Test 3 Failed');
}
