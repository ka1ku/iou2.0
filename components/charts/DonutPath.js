import React from 'react';
import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

// DonutPath renders a single animated arc segment of the donut chart.
const DonutPath = ({
  radius,
  gap,
  strokeWidth,
  outerStrokeWidth,
  color,
  decimals,
  index,
}) => {
  const innerRadius = radius - strokeWidth / 2;

  const path = Skia.Path.Make();
  path.addCircle(radius, radius, innerRadius);

  const start = useDerivedValue(() => {
    if (!Array.isArray(decimals.value) || decimals.value.length === 0) return 0;
    if (index === 0) {
      return gap;
    }
    const decimal = decimals.value.slice(0, index);
    const sum = decimal.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    return Math.max(sum + gap, 0);
  }, [decimals, index, gap]);

  const end = useDerivedValue(() => {
    if (!Array.isArray(decimals.value) || decimals.value.length === 0) return 0;

    const decimal = decimals.value.slice(0, index + 1);
    const sum = decimal.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    return Math.max(Math.min(sum, 1), 0); // Clamp between 0 and 1
  }, [decimals, index]);

  return (
    <Path
      path={path}
      color={color}
      style="stroke"
      strokeJoin="round"
      strokeWidth={strokeWidth}
      strokeCap="round"
      start={start}
      end={end}
    />
  );
};

export default DonutPath;

 