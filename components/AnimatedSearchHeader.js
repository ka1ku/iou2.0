import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SEARCH_BUTTON_SIZE = 40;
const HEADER_PADDING = Spacing.lg * 2;
// When expanded, search covers the entire header width
const EXPANDED_WIDTH = SCREEN_WIDTH - HEADER_PADDING;

const AnimatedSearchHeader = forwardRef(({ searchQuery, onSearchChange, onSearchClose }, ref) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const shouldCloseOnBlurRef = useRef(true);
  
  // Animation values
  const searchWidth = useSharedValue(SEARCH_BUTTON_SIZE);
  const inputOpacity = useSharedValue(0);
  const leftSectionOpacity = useSharedValue(1);

  // Expose close method to parent via ref
  useImperativeHandle(ref, () => ({
    close: () => {
      if (isExpanded) {
        setIsExpanded(false);
      }
    },
  }));

  useEffect(() => {
    if (isExpanded) {
      // Reset blur flag when opening search
      shouldCloseOnBlurRef.current = true;
      
      // Fade out left section (title) immediately
      leftSectionOpacity.value = withTiming(0, { duration: 150 });
      
      // Expand search to cover entire header with synchronized timing
      searchWidth.value = withSpring(EXPANDED_WIDTH, {
        damping: 20,
        stiffness: 120,
      });
      
      // Fade in input synchronized with width expansion
      inputOpacity.value = withTiming(1, { duration: 250 });
      
      // Focus input after animation completes
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    } else {
      // Fade out input immediately
      inputOpacity.value = withTiming(0, { duration: 150 });
      
      // Blur input
      inputRef.current?.blur();
      
      // Collapse width with synchronized timing
      searchWidth.value = withSpring(SEARCH_BUTTON_SIZE, {
        damping: 20,
        stiffness: 120,
      });
      
      // Fade in left section (title) after collapse starts
      leftSectionOpacity.value = withTiming(1, { duration: 200, delay: 50 });
      
      // Clear search
      onSearchChange('');
      onSearchClose?.();
    }
  }, [isExpanded]);

  const handleSearchButtonPress = () => {
    setIsExpanded(true);
  };

  const handleCloseSearch = () => {
    setIsExpanded(false);
  };


  // Animated styles
  const searchContainerStyle = useAnimatedStyle(() => {
    return {
      width: searchWidth.value,
    };
  });

  const inputStyle = useAnimatedStyle(() => {
    const inputWidth = interpolate(
      searchWidth.value,
      [SEARCH_BUTTON_SIZE, EXPANDED_WIDTH],
      [0, EXPANDED_WIDTH - SEARCH_BUTTON_SIZE], // Subtract button width only
      Extrapolate.CLAMP
    );
    
    return {
      opacity: inputOpacity.value,
      width: inputWidth,
    };
  });

  const leftSectionStyle = useAnimatedStyle(() => {
    return {
      opacity: leftSectionOpacity.value,
    };
  });

  return (
    <>
      {/* Header Container */}
      <View
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + Spacing.sm },
          { zIndex: 1000 },
        ]}
      >
        <View style={styles.headerContent}>
          {/* Left Section - Title */}
          <Animated.View style={[styles.leftSection, leftSectionStyle]}>
            <Text style={styles.headerTitle}>Expenses</Text>
          </Animated.View>

          {/* Search Container - Expands to cover entire header */}
          <Animated.View 
            style={[
              styles.searchContainer, 
              searchContainerStyle,
              isExpanded && styles.searchContainerExpanded
            ]}
          >
            {/* Search Button / Icon */}
            <TouchableOpacity
              onPress={handleSearchButtonPress}
              style={styles.searchButton}
              activeOpacity={0.7}
              disabled={isExpanded}
            >
              <Ionicons
                name="search"
                size={18}
                color={isExpanded ? Colors.textPrimary : Colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Search Input */}
            <Animated.View 
              style={[styles.inputContainer, inputStyle]}
              pointerEvents={isExpanded ? 'auto' : 'none'}
            >
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Search expenses or members..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={onSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onBlur={() => {
                  // Close search when input loses focus (user taps outside)
                  // Small delay to allow clear button presses to register
                  setTimeout(() => {
                    if (isExpanded && shouldCloseOnBlurRef.current) {
                      handleCloseSearch();
                    }
                    // Reset the flag
                    shouldCloseOnBlurRef.current = true;
                  }, 150);
                }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    // Prevent closing on blur when clearing text
                    shouldCloseOnBlurRef.current = false;
                    onSearchChange('');
                    // Keep focus on input after clearing
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 50);
                  }}
                  style={styles.clearTextButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    position: 'relative',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    minHeight: 48,
    position: 'relative',
  },
  leftSection: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
    fontSize: 26,
    color: Colors.textPrimary,
    fontWeight: '700',
    lineHeight: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    height: SEARCH_BUTTON_SIZE,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    position: 'absolute',
    right: Spacing.lg,
    top: '50%',
    transform: [{ translateY: -SEARCH_BUTTON_SIZE / 2 }],
  },
  searchContainerExpanded: {
    zIndex: 10,
  },
  searchButton: {
    width: SEARCH_BUTTON_SIZE,
    height: SEARCH_BUTTON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  inputContainer: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: Spacing.xs,
    paddingRight: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    flex: 1,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
    paddingRight: Spacing.xs,
    includeFontPadding: false,
  },
  clearTextButton: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
});

AnimatedSearchHeader.displayName = 'AnimatedSearchHeader';

export default AnimatedSearchHeader;
