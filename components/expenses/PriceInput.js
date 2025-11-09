import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../design/tokens';

const PriceInput = ({
  value,
  onChangeText,
  placeholder = '0.00',
  style,
  disabled = false,
  showCurrency = true,
  maxDecimals = 2,
  selected = false, // New prop to control selection styling
  error = false, // New prop to control error styling
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value with internal display value (only when not focused)
  useEffect(() => {
    // Don't sync external value while user is actively typing
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

    // Handle empty input - allow it to be empty while typing
    if (clean === '') {
      onChangeText && onChangeText(0);
      return;
    }
    
    // Handle partial decimal input
    if (clean === '.' || clean === '0.') {
      onChangeText && onChangeText(0);
      return;
    }
    
    const n = Number(clean);
    onChangeText && onChangeText(Number.isFinite(n) ? n : 0);
  };

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    
    // If empty or just a decimal point, format as 0.00
    if (!displayValue || displayValue === '.' || displayValue === '0.') {
      const formatted = (0).toFixed(maxDecimals);
      setDisplayValue(formatted);
      onChangeText && onChangeText(0);
      return;
    }

    const n = Number(displayValue);
    if (Number.isFinite(n)) {
      const padded = n.toFixed(maxDecimals);
      setDisplayValue(padded);
      onChangeText && onChangeText(n);
    } else {
      setDisplayValue((0).toFixed(maxDecimals));
      onChangeText && onChangeText(0);
    }
  };

  const getPlaceholderText = () => (isFocused && !displayValue ? '0' : placeholder);

  return (
    <View style={[
      styles.container, 
      style, 
      selected && !error && styles.containerSelected,
      isFocused && !error && styles.containerFocused,
      error && styles.containerError
    ]}>
      {showCurrency && (
        <Text style={[
          styles.currencySymbol, 
          selected && !error && styles.currencySymbolSelected,
          isFocused && !error && styles.currencySymbolFocused,
          error && styles.currencySymbolError
        ]}>
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    minHeight: 32,
  },
  currencySymbol: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
    fontWeight: '500',
    fontSize: '15'
  },
  currencySymbolSelected: { color: Colors.accent },
  currencySymbolFocused: { color: Colors.accent },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    fontSize: '15'
  },
  containerSelected: { borderColor: Colors.accent },
  containerFocused: { borderColor: Colors.accent },
  containerError: { 
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  currencySymbolError: {
    color: Colors.danger,
  },
  inputDisabled: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
  },
});

export default PriceInput;
