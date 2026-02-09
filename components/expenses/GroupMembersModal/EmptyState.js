import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../design/tokens';
import styles from './styles';

const EmptyState = React.memo(({ icon, title, text }) => (
  <View style={styles.emptyStateContainer}>
    <View style={styles.emptyStateIconCircle}>
      <Ionicons name={icon} size={32} color={Colors.textSecondary} />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateText}>{text}</Text>
  </View>
));

export default EmptyState;
