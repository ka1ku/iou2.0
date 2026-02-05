import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Modal, Platform } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../design/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import ConfettiCannon from 'react-native-confetti-cannon';

import SquadProgress from '../../components/onboarding/SquadProgress';
import ContactList from '../../components/onboarding/ContactList';
import UnlockTierCard from '../../components/onboarding/UnlockTierCard';
import { fetchAndClassifyContacts, requestContactPermissions } from '../../services/contactInviteService';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { getApp } from '@react-native-firebase/app';

const ContactInviteScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState({ onApp: [], suggestions: [], others: [] });
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [inviteCount, setInviteCount] = useState(0); // This should sync with backend in real app if persisting
  
  const confettiRef = useRef(null);
  
  // Tiers definition
  const tiers = [
    {
      name: "Solo Mode",
      invitesNeeded: 0,
      icon: "person",
      description: "Basic features",
      features: ["Manual expense entry", "Simple split ratios"]
    },
    {
      name: "Squad Started",
      invitesNeeded: 3,
      icon: "people",
      description: "Smart features unlocked",
      features: ["Smart contact suggestions", "See friends on app", "Expense templates"]
    },
    {
      name: "Full Squad",
      invitesNeeded: 5,
      icon: "rocket",
      description: "Premium Status",
      features: ["1 Month Premium Free", "Custom categories", "Priority support"]
    }
  ];

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    const results = await fetchAndClassifyContacts();
    setContacts(results);
    
    // Check if we got any contacts (implies permission granted)
    const hasContacts = results.onApp.length + results.suggestions.length + results.others.length > 0;
    if (hasContacts) {
      setPermissionsGranted(true);
    }
    
    setLoading(false);
  };

  const handleRequestPermission = async () => {
    const granted = await requestContactPermissions();
    if (granted) {
      loadContacts();
    } else {
      Alert.alert(
        "Contacts Required",
        "To find your friends, we need access to your contacts. Please enable it in settings.",
        [{ text: "OK" }]
      );
    }
  };

  const handleInviteSuccess = (premiumUnlocked) => {
    const newCount = inviteCount + 1;
    setInviteCount(newCount);
    
    // Check for milestones
    if (newCount === 3 || newCount === 5) {
      confettiRef.current?.start();
      Alert.alert(
        newCount === 5 ? "Premium Unlocked! 🌟" : "New Features Unlocked! 🚀",
        newCount === 5 
          ? "You've unlocked 1 month of Premium automatically!" 
          : "You've unlocked Smart Suggestions and Templates!"
      );
    }
  };

  const handleContinue = async () => {
    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        const firestore = getFirestore(getApp());
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
          onboardingCompleted: true
        });
      }
      
      // Navigation will be handled by App.js state change,/
      // but as a fallback/immediate feedback:
      // navigation.reset... might not be needed if App.js switches stacks
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPermissionGate = () => (
    <View style={styles.gateContainer}>
      <Image
        source={require('../../assets/transparent_logo.png')}
        style={styles.lottie}
        contentFit="contain"
      />
      <Text style={styles.gateTitle}>Build Your Squad</Text>
      <Text style={styles.gateSubtitle}>
        IOU is better with friends. Connect your contacts to find people you know and unlock features.
      </Text>
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleRequestPermission}>
        <Text style={styles.primaryButtonText}>Find Friends</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={handleContinue}>
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ConfettiCannon 
        count={200} 
        origin={{x: -10, y: 0}} 
        autoStart={false} 
        ref={confettiRef} 
        fadeOut={true}
      />
      
      {!permissionsGranted ? (
        renderPermissionGate()
      ) : (
        <View style={styles.content}>
           <View style={styles.header}>
              <TouchableOpacity onPress={handleContinue} style={styles.skipLink}>
                <Text style={styles.skipLinkText}>
                   {inviteCount >= 5 ? "Done" : "Skip"}
                </Text>
              </TouchableOpacity>
           </View>

           <SquadProgress inviteCount={inviteCount} />
           
           <View style={styles.listContainer}>
             <ContactList 
               contacts={contacts} 
               onInviteSuccess={handleInviteSuccess} 
             />
           </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.sm,
  },
  skipLink: {
    padding: Spacing.sm,
  },
  skipLinkText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  listContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  gateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  lottie: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  gateTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  gateSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  primaryButtonText: {
    ...Typography.bodyBold,
    color: 'white',
  },
  skipButton: {
    padding: Spacing.md,
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  }
});

export default ContactInviteScreen;
