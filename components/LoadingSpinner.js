import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../design/tokens';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = Colors.accent,
  style 
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    // Continuous rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Pulsing scale and opacity for a modern feel
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.5, {
          duration: 800,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      false
    );
  }, []);

  const sizeMap = {
    small: 16,
    medium: 24,
    large: 48,
  };

  const spinnerSize = sizeMap[size] || sizeMap.medium;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const dotSize = spinnerSize / 4;
  const containerSize = spinnerSize;

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }, style]}>
      <Animated.View style={[styles.spinner, animatedStyle, { width: containerSize, height: containerSize }]}>
        {/* Create 3 dots in a circle */}
        {[0, 1, 2].map((index) => {
          const angle = (index * 120) * (Math.PI / 180);
          const radius = containerSize * 0.35;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: color,
                  left: containerSize / 2 + x - dotSize / 2,
                  top: containerSize / 2 + y - dotSize / 2,
                },
              ]}
            />
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
  },
});

export default LoadingSpinner;


