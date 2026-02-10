import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../design/tokens';
import { useTranslation } from '../../contexts/LanguageContext';

const ExpenseHeader = ({
  title,
  onBackPress,
  onSettingsPress,
  onPeoplePress,
  participantCount = 0,
  isEditing = false,
  hideSettings = false,
  activeTab,
  onTabChange,
  onSavePress,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.topRow}>
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
          {title || (isEditing ? t('components.expenses.header.edit') : t('components.expenses.header.add'))}
        </Text>

        {onPeoplePress && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPeoplePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <View>
              <Ionicons name="people-outline" size={24} color={Colors.textPrimary} />
              {participantCount > 0 && (
                <View style={styles.peopleBadge}>
                  <Text style={styles.peopleBadgeText}>{participantCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {onSavePress && (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={onSavePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Ionicons name="checkmark" size={28} color={Colors.accent} />
          </TouchableOpacity>
        )}

        {!hideSettings && !onSavePress ? (
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={onSettingsPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : !onSavePress ? (
          <View style={styles.iconButton} />
        ) : null}
      </View>
      
      {activeTab && onTabChange && (
        <View style={styles.tabContainer}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'track' && styles.tabActive]}
              onPress={() => onTabChange('track')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'track' && styles.tabTextActive]}>
                {t('components.expenses.header.track')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'split' && styles.tabActive]}
              onPress={() => onTabChange('split')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'split' && styles.tabTextActive]}>
                {t('components.expenses.header.split')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  peopleBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  peopleBadgeText: {
    color: Colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  tabContainer: {
    paddingTop: Spacing.md,
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

export default ExpenseHeader;