import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../../design/tokens';

const ExpenseTabNavigator = ({ activeTab, onTabChange }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { top: insets.top + 74 }]}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'track' && styles.tabActive]}
          onPress={() => onTabChange('track')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'track' && styles.tabTextActive]}>
            Track
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'split' && styles.tabActive]}
          onPress={() => onTabChange('split')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'split' && styles.tabTextActive]}>
            Split
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.surface,
  },
});

export default ExpenseTabNavigator;
