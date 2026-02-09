/**
 * Configure Algolia index settings for expenses and users search
 * Run this script once to set up the indexes properly
 *
 * Usage: node scripts/configureAlgoliaIndex.js
 */

// Algolia v5 uses named export
const { algoliasearch } = require('algoliasearch');

// Initialize Algolia client with ADMIN API KEY (not search key!)
// Replace with your admin API key from Algolia dashboard
const ALGOLIA_APP_ID = 'I0T07P5NB6';
const ALGOLIA_ADMIN_KEY = 'fb4e3327d2030d4c281cdc6fa64f7984'; // Admin key from functions/index.js

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);

async function configureExpensesIndex() {
  try {
    console.log('Configuring expenses index...');

    // Algolia v5 API - set index settings
    const settings = {
      // Searchable attributes - what fields to search in
      searchableAttributes: [
        'title',                // Expense title
        'participantNames',     // Participant names
        'participantUsernames', // Participant usernames
        'itemNames',            // Item names
      ],

      // Attributes for faceting - required for filtering
      attributesForFaceting: [
        'filterOnly(participantIds)',  // filterOnly means it won't be used for faceting UI, only for filters
        'settled',
        'expenseType',
        'createdBy',
      ],

      // Custom ranking - how to rank results
      customRanking: [
        'desc(updatedAt)',  // Most recently updated first
        'desc(createdAt)',  // Then most recently created
      ],

      // Attributes to retrieve in search results
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

    // In Algolia v5, use setSettings directly on the client
    await client.setSettings({
      indexName: 'expenses',
      indexSettings: settings,
    });

    console.log('✅ Successfully configured expenses index!');
    console.log('Settings applied:', JSON.stringify(settings, null, 2));

  } catch (error) {
    console.error('❌ Error configuring index:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

async function configureUsersIndex() {
  try {
    console.log('\nConfiguring users index...');

    // Algolia v5 API - set index settings for users
    const settings = {
      // Searchable attributes - what fields to search in
      searchableAttributes: [
        'firstName',
        'lastName',
        'fullName',
        'username',
        'venmoUsername',
        'searchableText',
      ],

      // Custom ranking - how to rank results
      customRanking: [
        'desc(objectID)',  // Newer users first (if objectID is timestamp-based)
      ],

      // Attributes to retrieve in search results
      attributesToRetrieve: [
        'objectID',
        'firstName',
        'lastName',
        'fullName',
        'username',
        'venmoUsername',
        'profilePhoto',
      ],
    };

    // In Algolia v5, use setSettings directly on the client
    await client.setSettings({
      indexName: 'users',
      indexSettings: settings,
    });

    console.log('✅ Successfully configured users index!');
    console.log('Settings applied:', JSON.stringify(settings, null, 2));

  } catch (error) {
    console.error('❌ Error configuring users index:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the configuration
async function configureAllIndexes() {
  await configureExpensesIndex();
  await configureUsersIndex();
}

configureAllIndexes()
  .then(() => {
    console.log('\n✅ All indexes configured successfully!');
    console.log('- Expenses: search by title, participant names/usernames, item names');
    console.log('- Users: search by name, username, venmo username');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
