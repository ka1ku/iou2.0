const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Reduce file watching to avoid EMFILE errors
config.watchFolders = [];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add 'cjs' to source extensions for better module compatibility
config.resolver.sourceExts.push('cjs');

// Disable experimental package exports for compatibility
config.resolver.unstable_enablePackageExports = false;

// Fix vendor module resolution
config.resolver.alias = {
  ...config.resolver.alias,
  '../vendor/emitter/EventEmitter': path.resolve(
    __dirname,
    'node_modules/react-native/Libraries/vendor/emitter/EventEmitter'
  ),
};

// More aggressive file watching restrictions
config.watcher = {
  additionalExts: ['cjs', 'mjs'],
  watchman: {
    deferStates: ['hg.update'],
  },
};

// Ignore more directories to reduce file watching but keep vendor accessible
config.resolver.blockList = [
  /node_modules\/.*\/node_modules\/react-native\/.*/,
];

module.exports = config;
