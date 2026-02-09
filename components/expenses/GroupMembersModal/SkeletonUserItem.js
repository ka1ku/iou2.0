import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../../design/tokens';

export const SkeletonUserItem = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.skeletonItem}>
      <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
      <View style={styles.skeletonTextContainer}>
        <Animated.View style={[styles.skeletonTextName, { opacity }]} />
        <Animated.View style={[styles.skeletonTextUsername, { opacity }]} />
      </View>
      <Animated.View style={[styles.skeletonButton, { opacity }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.divider,
    marginRight: Spacing.lg,
  },
  skeletonTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonTextName: {
    height: 16,
    width: 120,
    backgroundColor: Colors.divider,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  skeletonTextUsername: {
    height: 14,
    width: 80,
    backgroundColor: Colors.divider,
    borderRadius: 4,
  },
  skeletonButton: {
    width: 70,
    height: 32,
    backgroundColor: Colors.divider,
    borderRadius: 16,
  },
});
