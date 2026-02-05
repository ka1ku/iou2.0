import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../design/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const UnlockTierCard = ({ tier, isUnlocked }) => {
  return (
    <View style={[styles.container, isUnlocked && styles.unlockedContainer]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={tier.icon} 
            size={24} 
            color={isUnlocked ? Colors.accent : Colors.textSecondary} 
          />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, isUnlocked && styles.unlockedText]}>
            {tier.name}
          </Text>
          <Text style={styles.subtitle}>{tier.description}</Text>
        </View>
        <View style={styles.statusIcon}>
          {isUnlocked ? (
             <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          ) : (
             <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} />
          )}
        </View>
      </View>
      
      <View style={styles.features}>
        {tier.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
             <Ionicons 
               name="star" 
               size={12} 
               color={isUnlocked ? Colors.accent : Colors.textTertiary} 
               style={{ marginRight: 8 }}
             />
             <Text style={[styles.featureText, !isUnlocked && styles.lockedFeatureText]}>
               {feature}
             </Text>
          </View>
        ))}
      </View>
      
      {!isUnlocked && (
        <View style={styles.overlay} pointerEvents="none" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    opacity: 0.8,
  },
  unlockedContainer: {
    borderColor: Colors.accent,
    backgroundColor: '#F0F9FF', // Light blue tint
    opacity: 1,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  unlockedText: {
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.tiny,
    color: Colors.textSecondary,
  },
  features: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  lockedFeatureText: {
    color: Colors.textTertiary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.lg,
  }
});

export default UnlockTierCard;
