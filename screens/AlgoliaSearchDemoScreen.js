import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import AlgoliaSearchDemo from '../components/AlgoliaSearchDemo';

const AlgoliaSearchDemoScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <AlgoliaSearchDemo />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});

export default AlgoliaSearchDemoScreen;
