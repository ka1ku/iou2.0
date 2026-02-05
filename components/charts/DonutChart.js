import React from 'react';
import { StyleSheet, View, Text as RNText } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import DonutPath from './DonutPath';

// DonutChart renders an animated donut with a center label. All inputs are stable
// and animation is triggered via SharedValues, avoiding React re-renders.
const DonutChart = ({
  n,
  gap,
  segment1Value,
  segment2Value,
  colors,
  totalValue,
  strokeWidth,
  outerStrokeWidth,
  radius,
  centerTitle = 'Total Spent',
  renderCenterValue,
  netBalanceValue,
}) => {
  const array = React.useMemo(() => Array.from({ length: n }), [n]);
  const innerRadius = radius - outerStrokeWidth / 2;

  const path = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(radius, radius, innerRadius);
    return p;
  }, [radius, innerRadius]);

  // Create decimals array from individual segment values
  const decimals = useDerivedValue(() => [segment1Value.value, segment2Value.value], [segment1Value, segment2Value]);

  const targetText = useDerivedValue(() => `$${Math.round(totalValue.value)}`, []);

  // State to track the animated text value
  const [animatedText, setAnimatedText] = React.useState('$0.00');

  // Use animated reaction to update the text when netBalanceValue changes
  useAnimatedReaction(
    () => {
      if (!netBalanceValue) return '$0.00';
      const netBalance = netBalanceValue.value;
      if (Math.abs(netBalance) < 0.01) return '$0.00';
      return `${netBalance >= 0 ? '+' : '-'}$${Math.abs(netBalance).toFixed(2)}`;
    },
    (text) => {
      runOnJS(setAnimatedText)(text);
    },
    [netBalanceValue]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.chartWrapper, { width: radius * 2, height: radius * 2 }]}>
        <Canvas style={styles.canvas}>
          {/* Background circle - subtle grey */}
          <Path
            path={path}
            color="#e5e5e5"
            style="stroke"
            strokeJoin="round"
            strokeWidth={strokeWidth + 2}
            strokeCap="round"
            start={0}
            end={1}
          />
          {/* Animated colored segments */}
          {array.map((_, index) => (
            <DonutPath
              key={index}
              radius={radius}
              strokeWidth={strokeWidth}
              outerStrokeWidth={outerStrokeWidth}
              color={colors[index % colors.length]}
              decimals={decimals}
              index={index}
              gap={gap}
            />
          ))}
        </Canvas>
        <View pointerEvents="none" style={[styles.centerOverlay, { width: radius * 2, height: radius * 2 }]}>
          <View style={styles.centerTextContainer}>
            <RNText style={styles.centerTitle}>{centerTitle}</RNText>
            {netBalanceValue ? (
              <RNText style={styles.centerValue}>{animatedText}</RNText>
            ) : renderCenterValue ? (
              <RNText style={styles.centerValue}>
                {renderCenterValue()}
              </RNText>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

export default DonutChart;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartWrapper: {
    position: 'relative',
  },
  canvas: {
    flex: 1,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  centerTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  centerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
  },
});

 