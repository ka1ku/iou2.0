import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../design/tokens';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

const SquadProgress = ({ inviteCount, maxInvites = 5 }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(new Animated.Value(1)).current;

  const getTier = (count) => {
    if (count >= 5) return { name: 'Full Squad', color: Colors.accent };
    if (count >= 3) return { name: 'Squad Started', color: '#FFD700' };
    return { name: 'Solo Mode', color: Colors.textSecondary };
  };

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(inviteCount / maxInvites, 1),
      duration: 1000,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic)
    }).start();

    // Pulse animation on update
    Animated.sequence([
      Animated.timing(scaleRef, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleRef, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

  }, [inviteCount]);

  const currentTier = getTier(inviteCount);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>YOUR SQUAD</Text>
          <Text style={[styles.tierName, { color: currentTier.color }]}>
            {currentTier.name}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{inviteCount}/{maxInvites}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <Animated.View 
          style={[
            styles.fill, 
            { 
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              }) 
            }
          ]} 
        />
        
        {/* Milestones */}
        <View style={[styles.milestone, { left: '60%' }]}> 
          <View style={[styles.dot, inviteCount >= 3 && styles.activeDot]} />
          <Text style={styles.milestoneText}>3</Text>
        </View>
        
        <View style={[styles.milestone, { right: 0 }]}>
          <View style={[styles.dot, inviteCount >= 5 && styles.activeDot]} />
          <Text style={styles.milestoneText}>5</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        {inviteCount < 3 
          ? `${3 - inviteCount} more for Smart Suggestions` 
          : inviteCount < 5 
            ? `${5 - inviteCount} more for Premium` 
            : "Features Unlocked! 🎉"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  tierName: {
    ...Typography.h3,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  countText: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
  },
  track: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    position: 'relative',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },
  milestone: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -4 }], // Center dot
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
    marginBottom: 4,
  },
  activeDot: {
    backgroundColor: Colors.accent,
    transform: [{ scale: 1.5 }],
  },
  milestoneText: {
    ...Typography.tiny,
    color: Colors.textSecondary,
    position: 'absolute',
    top: 12,
    width: 20,
    textAlign: 'center',
    left: -6,
  },
  hint: {
    ...Typography.caption,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  }
});

export default SquadProgress;
