import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../design/tokens';

const PriceInput = ({
  value,
  onChangeText,
  placeholder = '0.00',
  style,
  disabled = false,
  showCurrency = true,
  maxDecimals = 2,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value only when not focused (prevents cursor jumps/lock)
  useEffect(() => {
    if (isFocused) return;
    if (value === null || value === undefined || value === '') {
      setDisplayValue('');
      return;
    }
    const n = Number(value);
    if (Number.isFinite(n)) {
      setDisplayValue(String(n));
    } else {
      setDisplayValue('');
    }
  }, [value, isFocused]);

  const clampDecimals = useCallback(
    (text) => {
      // keep digits and one dot
      let clean = text.replace(/[^0-9.]/g, '');

      const firstDot = clean.indexOf('.');
      if (firstDot !== -1) {
        const before = clean.slice(0, firstDot + 1);
        const after = clean.slice(firstDot + 1).replace(/\./g, '');
        clean = before + after;
      }

      // limit decimal places while typing
      if (firstDot !== -1) {
        const [intPart, decPart = ''] = clean.split('.');
        if (decPart.length > maxDecimals) {
          clean = intPart + '.' + decPart.slice(0, maxDecimals);
        }
      }

      // allow leading '.' -> '0.'
      if (clean === '.') clean = '0.';

      // trim leading zeros like '0005' -> '5' (but keep '0' and '0.')
      if (/^0[0-9]+$/.test(clean)) {
        clean = String(Number(clean));
      }

      return clean;
    },
    [maxDecimals]
  );

  const handleTextChange = (text) => {
    const clean = clampDecimals(text);
    setDisplayValue(clean);

    if (clean === '' || clean === '.') {
      onChangeText && onChangeText(null);
      return;
    }
    const n = Number(clean);
    onChangeText && onChangeText(Number.isFinite(n) ? n : null);
  };

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    if (!displayValue) return;

    const n = Number(displayValue);
    if (Number.isFinite(n)) {
      const padded = n.toFixed(maxDecimals);
      setDisplayValue(padded);
      onChangeText && onChangeText(n);
    } else {
      setDisplayValue('');
      onChangeText && onChangeText(null);
    }
  };

  const getPlaceholderText = () => (isFocused && !displayValue ? '0' : placeholder);

  return (
    <View style={[styles.container, style, isFocused && styles.containerFocused]}>
      {showCurrency && (
        <Text style={[styles.currencySymbol, isFocused && styles.currencySymbolFocused]}>
          $
        </Text>
      )}
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={displayValue}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={getPlaceholderText()}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
        editable={!disabled}
        selectTextOnFocus
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  currencySymbol: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
    fontWeight: '500',
  },
  currencySymbolFocused: { color: Colors.accent },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    minHeight: 20,
  },
  containerFocused: { borderColor: Colors.accent },
  inputDisabled: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
  },
});

export default PriceInput;
