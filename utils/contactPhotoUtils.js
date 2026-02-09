import * as Contacts from 'expo-contacts';

/**
 * Fetches the user's own contact photo from their device
 * @param {string} phoneNumber - The user's phone number to search for their contact
 * @returns {Promise<string|null>} - URI of the contact photo or null if not found
 */
export const getUserContactPhoto = async (phoneNumber) => {
  try {
    // Request permissions if not already granted
    const { status } = await Contacts.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Contacts.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.log('Contact permissions not granted');
        return null;
      }
    }

    // Normalize the phone number for searching
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    // Get all contacts with images
    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Image,
        Contacts.Fields.Name
      ],
    });

    if (!data || data.length === 0) {
      console.log('No contacts found on device');
      return null;
    }

    // Search for a contact matching the user's phone number
    for (const contact of data) {
      if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
        continue;
      }

      // Check if any of this contact's phone numbers match the user's phone
      for (const phoneEntry of contact.phoneNumbers) {
        const contactPhone = phoneEntry.number.replace(/\D/g, '');

        // Match if the last 10 digits are the same (to handle country codes)
        const userLast10 = normalizedPhone.slice(-10);
        const contactLast10 = contactPhone.slice(-10);

        if (userLast10 === contactLast10) {
          // Found matching contact - check if they have an image
          if (contact.image && contact.image.uri) {
            console.log('Found user contact photo:', contact.name);
            return contact.image.uri;
          } else if (contact.imageAvailable) {
            console.log('Contact has image but URI not available:', contact.name);
            // Try to get the full contact with image
            try {
              const fullContact = await Contacts.getContactByIdAsync(contact.id, [
                Contacts.Fields.Image
              ]);
              if (fullContact && fullContact.image && fullContact.image.uri) {
                console.log('Retrieved full contact photo');
                return fullContact.image.uri;
              }
            } catch (err) {
              console.log('Error getting full contact:', err);
            }
          }

          console.log('Contact found but no image available');
          return null;
        }
      }
    }

    console.log('No matching contact found for phone number');
    return null;

  } catch (error) {
    console.error('Error fetching user contact photo:', error);
    return null;
  }
};

/**
 * Gets the user's contact photo and uploads it to use as profile picture
 * This is a non-blocking operation - if it fails, it returns null
 * @param {string} phoneNumber - The user's phone number
 * @returns {Promise<string|null>} - Local URI of contact photo or null
 */
export const getContactPhotoForProfile = async (phoneNumber) => {
  try {
    const photoUri = await getUserContactPhoto(phoneNumber);

    if (photoUri) {
      console.log('Successfully retrieved contact photo for profile');
      return photoUri;
    }

    return null;
  } catch (error) {
    console.error('Error in getContactPhotoForProfile:', error);
    return null;
  }
};
