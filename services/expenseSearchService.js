import { algoliasearch } from 'algoliasearch';
import { getCurrentUser } from './authService';

// Initialize Algolia client (using public search key from GroupMembersModal)
const searchClient = algoliasearch('I0T07P5NB6', 'adfc79b41b2490c5c685b1adebac864c');

/**
 * Search expenses for the current user
 * @param {string} query - Search query string
 * @param {number} hitsPerPage - Number of results to return (default: 3)
 * @returns {Promise<Array>} Array of matching expenses
 */
export const searchExpenses = async (query, hitsPerPage = 3) => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return [];
    }

    // Only search if query is not empty
    if (!query || !query.trim()) {
      return [];
    }

    // Search expenses using Algolia v5 API with filters to only return user's expenses
    // IMPORTANT: participantIds must be in attributesForFaceting for filtering to work
    // Run: node scripts/configureAlgoliaIndex.js to set this up

    const searchRequest = {
      indexName: 'expenses',
      query: query.trim(),
      // Filter by participantIds array containing the user ID
      // For array attributes, Algolia matches if ANY element in the array matches
      filters: `participantIds:"${currentUser.uid}"`,
      hitsPerPage: hitsPerPage,
      attributesToRetrieve: [
        'objectID',
        'title',
        'expenseType',
        'participantIds',
        'participantNames',
        'participantUsernames',
        'itemNames',
        'createdBy',
        'createdAt',
        'updatedAt',
        'settled',
        'total',
      ],
    };

    const searchResponse = await searchClient.search({ requests: [searchRequest] });

    // Extract hits from the response
    // Algolia v5 response structure: { results: [{ hits: [...], processingTimeMS: number, ... }] }
    let hits = [];
    if (searchResponse && searchResponse.results && Array.isArray(searchResponse.results) && searchResponse.results.length > 0) {
      const firstResult = searchResponse.results[0];
      if (firstResult && firstResult.hits && Array.isArray(firstResult.hits)) {
        hits = firstResult.hits;
      }
    }
    
    // Client-side filtering as backup (in case Algolia filter doesn't work)
    // Filter to only include expenses where user is a participant
    const filteredHits = hits.filter(hit => {
      const participantIds = hit.participantIds || [];
      return participantIds.includes(currentUser.uid);
    });
    
    return filteredHits;
  } catch (error) {
    console.error('Error searching expenses:', error);
    return [];
  }
};

/**
 * Get expense details from Firestore by ID
 * This is used to get full expense data after Algolia search returns IDs
 * @param {string} expenseId - Expense document ID
 * @returns {Promise<Object|null>} Full expense document or null
 */
export const getExpenseById = async (expenseId) => {
  try {
    const { getFirestore, doc, getDoc } = await import('@react-native-firebase/firestore');
    const { getApp } = await import('@react-native-firebase/app');
    
    const firestoreInstance = getFirestore(getApp());
    const expenseRef = doc(firestoreInstance, 'expenses', expenseId);
    const expenseSnap = await getDoc(expenseRef);
    
    if (expenseSnap.exists()) {
      return {
        id: expenseSnap.id,
        ...expenseSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Search expenses and fetch full expense data from Firestore
 * @param {string} query - Search query string
 * @param {number} hitsPerPage - Number of results to return (default: 3)
 * @returns {Promise<Array>} Array of full expense documents
 */
export const searchExpensesWithDetails = async (query, hitsPerPage = 3) => {
  try {
    // Search Algolia to get expense IDs
    const searchResults = await searchExpenses(query, hitsPerPage);
    
    if (searchResults.length === 0) {
      return [];
    }

    // Fetch full expense data from Firestore for each result
    const expensePromises = searchResults.map(result => getExpenseById(result.objectID));
    const expenses = await Promise.all(expensePromises);
    
    // Filter out any null results (expenses that were deleted but still in Algolia)
    return expenses.filter(expense => expense !== null);
  } catch (error) {
    console.error('Error searching expenses with details:', error);
    return [];
  }
};

