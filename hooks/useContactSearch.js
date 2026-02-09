import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchAndClassifyContacts } from '../services/contactInviteService';

export const useContactSearch = (enabled = true) => {
  const [allContacts, setAllContacts] = useState({ onApp: [], suggestions: [], others: [] });
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAndClassifyContacts();
      setAllContacts(result);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchContacts();
    }
    if (!enabled) {
      fetchedRef.current = false;
    }
  }, [enabled, fetchContacts]);

  const searchContacts = useCallback(
    (queryStr) => {
      const q = (queryStr || '').trim().toLowerCase();
      if (q.length === 0) return [];

      const allFlat = [
        ...allContacts.onApp,
        ...allContacts.suggestions,
        ...allContacts.others,
      ];

      return allFlat.filter((contact) => {
        const name = (
          contact.name ||
          `${contact.firstName || ''} ${contact.lastName || ''}`
        )
          .trim()
          .toLowerCase();
        const phone = (contact.phoneNumbers?.[0]?.number || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
    },
    [allContacts]
  );

  return { allContacts, searchContacts, loading, loadingContacts: loading, refetch: fetchContacts };
};
