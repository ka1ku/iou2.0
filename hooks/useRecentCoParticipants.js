import { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from '@react-native-firebase/firestore';
import { getApp } from '@react-native-firebase/app';
import { getCurrentUser } from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_PREFIX = 'recent_coparticipants_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useRecentCoParticipants = (enabled = true) => {
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchRecent = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const cacheKey = `${CACHE_KEY_PREFIX}${currentUser.uid}`;

    // Check cache first
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          setRecentUsers(data);
          return;
        }
      }
    } catch {}

    setLoading(true);
    try {
      const firestore = getFirestore(getApp());
      const expensesRef = collection(firestore, 'expenses');
      const q = query(
        expensesRef,
        where('participantIds', 'array-contains', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(15)
      );

      const snapshot = await getDocs(q);
      const frequencyMap = new Map(); // userId -> { count, profile, lastSeen }

      snapshot.forEach((docSnap) => {
        const expense = docSnap.data();
        const participants = expense.participants || [];
        const createdAt = expense.createdAt?.toMillis?.() || 0;

        participants.forEach((p) => {
          if (!p.userId || p.userId === currentUser.uid) return;

          const existing = frequencyMap.get(p.userId);
          if (existing) {
            existing.count += 1;
            if (createdAt > existing.lastSeen) {
              existing.lastSeen = createdAt;
              // Update profile to most recent data
              existing.profile = {
                id: p.userId,
                objectID: p.userId,
                fullName: p.name || '',
                username: p.username || '',
                profilePhoto: p.profilePhoto || null,
              };
            }
          } else {
            frequencyMap.set(p.userId, {
              count: 1,
              lastSeen: createdAt,
              profile: {
                id: p.userId,
                objectID: p.userId,
                fullName: p.name || '',
                username: p.username || '',
                profilePhoto: p.profilePhoto || null,
              },
            });
          }
        });
      });

      // Sort by frequency desc, then recency desc
      const sorted = [...frequencyMap.values()]
        .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
        .slice(0, 10)
        .map((entry) => entry.profile);

      setRecentUsers(sorted);

      // Cache
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: sorted, timestamp: Date.now() })
      ).catch(() => {});
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchRecent();
    }
    if (!enabled) {
      fetchedRef.current = false;
    }
  }, [enabled, fetchRecent]);

  return { recentUsers, loading, loadingRecent: loading, refetch: fetchRecent };
};
