import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInstantSearch } from 'react-instantsearch-core';
import { Colors } from '../../../design/tokens';
import LoadingSpinner from '../../LoadingSpinner';
import styles from './styles';

const SearchInput = React.memo(({ value, onChangeText, isDebouncing }) => {
  const { status } = useInstantSearch();
  const isAlgoliaSearching = status === 'loading' || status === 'stalled';
  const showLoading = isDebouncing || (isAlgoliaSearching && value.length > 0);
  const hasText = value.length > 0;

  return (
    <View style={styles.searchContainer}>
      <View style={[styles.searchBar, hasText && styles.searchBarFocused]}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people or contacts..."
          placeholderTextColor={Colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />
        {showLoading ? (
            <View style={{ marginRight: 8 }}>
              <LoadingSpinner size={20} color={Colors.primary} />
            </View>
        ) : hasText ? (
          <TouchableOpacity
            style={styles.searchClearButton}
            onPress={() => onChangeText('')}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

export default SearchInput;
