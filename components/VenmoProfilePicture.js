import React, { useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

const VenmoProfilePicture = ({ 
  source, 
  size = 60, 
  username = '', 
  style = {},
  showFallback = true 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}&size=${size * 2}&background=3d95ce&color=fff&bold=true`;

  const imageStyle = [
    styles.image,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    style
  ];

  if (imageError || !source) {
    if (!showFallback) return null;
    
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Image
          source={{ uri: fallbackImage }}
          style={imageStyle}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        {!imageLoaded && (
          <View style={[styles.placeholder, imageStyle]}>
            <Text style={[styles.placeholderText, { fontSize: size * 0.3 }]}>
              {username ? username.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: source }}
        style={imageStyle}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      {!imageLoaded && (
        <View style={[styles.placeholder, imageStyle]}>
          <Text style={[styles.placeholderText, { fontSize: size * 0.3 }]}>
            {username ? username.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: Colors.surface,
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#3d95ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default VenmoProfilePicture;
