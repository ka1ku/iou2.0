
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

export const extractProfileImage = (html) => {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]);
  }

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (twitterMatch?.[1]) {
    return decodeHtmlEntities(twitterMatch[1]);
  }

  const profileMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*(?:profile|avatar|user)[^"']*["']/i);
  if (profileMatch?.[1]) {
    return decodeHtmlEntities(profileMatch[1]);
  }

  const dataSrcMatch = html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
  if (dataSrcMatch?.[1]) {
    return decodeHtmlEntities(dataSrcMatch[1]);
  }

  return null;
};

export const extractDisplayName = (html) => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/[^\w\s]/g, '').trim();
  }
  return null;
};

export const generateFallbackAvatar = (firstName, lastName, fallbackName) => {
  let nameForAvatar;
  if (firstName && lastName) {
    nameForAvatar = `${firstName.charAt(0)} ${lastName.charAt(0)}`;
  } else {
    nameForAvatar = fallbackName;
  }
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForAvatar)}&size=200&background=3d95ce&color=fff&bold=true&font-size=0.4`;
};

export const fetchVenmoProfile = async (username, firstName = '', lastName = '') => {
  if (!username.trim()) {
    throw new Error('Username is required');
  }

  const normalized = username.replace(/^@+/, '');
  const profileUrl = `https://account.venmo.com/u/${encodeURIComponent(normalized)}`;
  
  
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
      throw new Error(`Profile not found (${response.status})`);
    }

    const html = await response.text();

    let imageUrl = extractProfileImage(html);
    const displayName = extractDisplayName(html);

    if (!imageUrl) {
      imageUrl = generateFallbackAvatar(firstName, lastName, normalized);
    } else {
    }

    if (imageUrl && imageUrl.startsWith('/')) {
      imageUrl = `https://account.venmo.com${imageUrl}`;
    }

    return {
      username: normalized,
      imageUrl,
      displayName,
      userExists: true
    };

  } catch (error) {
    
    if (error.message && error.message.includes('Profile not found')) {
      const fallbackImageUrl = generateFallbackAvatar(firstName, lastName, normalized);
      
      return {
        username: normalized,
        imageUrl: fallbackImageUrl,
        displayName: null,
        userExists: false
      };
    }
    
    const fallbackImageUrl = generateFallbackAvatar(firstName, lastName, normalized);
    
    return {
      username: normalized,
      imageUrl: fallbackImageUrl,
      displayName: null,
      userExists: null
    };
  }
};
