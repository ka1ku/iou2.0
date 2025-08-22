/**
 * Shared utilities for Venmo profile operations
 * Centralizes logic for fetching and processing Venmo profiles
 */

/**
 * Decodes HTML entities in text (e.g., &amp; -> &)
 */
export const decodeHtmlEntities = (text) => {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

/**
 * Extracts profile image URL from HTML using multiple fallback methods
 * Priority: Open Graph > Twitter Card > Class-based > Data-src
 */
export const extractProfileImage = (html) => {
  // Method 1: Open Graph image (most reliable)
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]);
  }

  // Method 2: Twitter card image
  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (twitterMatch?.[1]) {
    return decodeHtmlEntities(twitterMatch[1]);
  }

  // Method 3: Profile image with specific classes
  const profileMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*(?:profile|avatar|user)[^"']*["']/i);
  if (profileMatch?.[1]) {
    return decodeHtmlEntities(profileMatch[1]);
  }

  // Method 4: Data-src (lazy loaded images)
  const dataSrcMatch = html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
  if (dataSrcMatch?.[1]) {
    return decodeHtmlEntities(dataSrcMatch[1]);
  }

  return null;
};

/**
 * Extracts display name from HTML page title
 */
export const extractDisplayName = (html) => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/[^\w\s]/g, '').trim();
  }
  return null;
};

/**
 * Generates a fallback avatar URL using user's first and last name initials
 */
export const generateFallbackAvatar = (firstName, lastName, fallbackName) => {
  let nameForAvatar;
  if (firstName && lastName) {
    // Format as "F L" to show both initials
    nameForAvatar = `${firstName.charAt(0)} ${lastName.charAt(0)}`;
  } else {
    nameForAvatar = fallbackName;
  }
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&size=200&background=3d95ce&color=fff&bold=true&font-size=0.4`;
};

/**
 * Fetches and processes Venmo profile information
 * @param {string} username - Venmo username to fetch
 * @param {string} firstName - User's first name for fallback avatar
 * @param {string} lastName - User's last name for fallback avatar
 * @returns {Promise<{username: string, imageUrl: string, displayName: string|null, userExists: boolean}>}
 */
export const fetchVenmoProfile = async (username, firstName = '', lastName = '') => {
  if (!username.trim()) {
    throw new Error('Username is required');
  }

  const normalized = username.replace(/^@+/, '');
  const profileUrl = `https://account.venmo.com/u/${encodeURIComponent(normalized)}`;
  
  console.log('Fetching Venmo profile for:', normalized);
  
  try {
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xml,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000
    });

    if (!response.ok) {
      // User definitely doesn't exist
      throw new Error(`Profile not found (${response.status})`);
    }

    const html = await response.text();
    console.log('HTML received, length:', html.length);

    // Extract profile image and display name
    let imageUrl = extractProfileImage(html);
    const displayName = extractDisplayName(html);

    // User exists, but check if they have a profile picture
    if (!imageUrl) {
      // User exists but no profile picture - use fallback avatar
      imageUrl = generateFallbackAvatar(firstName, lastName, normalized);
      console.log('User exists but no profile picture, using fallback avatar');
    } else {
      console.log('User exists and has profile picture');
    }

    // Ensure the image URL is absolute
    if (imageUrl && imageUrl.startsWith('/')) {
      imageUrl = `https://account.venmo.com${imageUrl}`;
    }

    return {
      username: normalized,
      imageUrl,
      displayName,
      userExists: true // User definitely exists since we got a 200 response
    };

  } catch (error) {
    console.error('Error fetching Venmo profile:', error);
    
    // Check if this is a "Profile not found" error (user doesn't exist)
    if (error.message && error.message.includes('Profile not found')) {
      // User doesn't exist - return fallback avatar but mark userExists as false
      const fallbackImageUrl = generateFallbackAvatar(firstName, lastName, normalized);
      console.log('User does not exist, returning fallback avatar');
      
      return {
        username: normalized,
        imageUrl: fallbackImageUrl,
        displayName: null,
        userExists: false
      };
    }
    
    // Other errors (network, timeout, etc.) - we can't determine if user exists
    const fallbackImageUrl = generateFallbackAvatar(firstName, lastName, normalized);
    console.log('Network or other error, cannot determine if user exists');
    
    return {
      username: normalized,
      imageUrl: fallbackImageUrl,
      displayName: null,
      userExists: null // Unknown - could be network error
    };
  }
};
