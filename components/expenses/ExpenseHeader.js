import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '../../design/tokens';

const ExpenseHeader = ({ 
  title, 
  onBackPress, 
  onSettingsPress, 
  isEditing = false,
  hideSettings = false 
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
      <TouchableOpacity 
        style={styles.iconButton}
        onPress={onBackPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <Ionicons name="arrow-back" size={26} color={Colors.textPrimary} />
      </TouchableOpacity>
      
      <Text
        style={[styles.headerTitle, hideSettings && styles.headerTitleCentered]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title || (isEditing ? 'Edit' : 'Add')}
      </Text>
      
      {!hideSettings ? (
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={onSettingsPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Ionicons name="ellipsis-horizontal" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerTitleCentered: {
    marginRight: 44, // Balance the back button width to truly center the title
  },
});

export default ExpenseHeader;