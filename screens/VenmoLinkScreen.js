import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import { sendOTP, updateUserProfile, validateAndOptimizeProfilePicture } from '../services/authService';
import VenmoProfilePicture from '../components/VenmoProfilePicture';

const VenmoLinkScreen = ({ navigation, route }) => {
  const { firstName, lastName, phoneNumber, isSignUp } = route.params;
  const [venmoUsername, setVenmoUsername] = useState('');
  const [venmoProfilePic, setVenmoProfilePic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifyingVenmo, setVerifyingVenmo] = useState(false);
  const [venmoVerified, setVenmoVerified] = useState(false);

  const openVenmoApp = async () => {
    try {
      // If we have a username, try to open a compose screen to that user for visual confirmation
      const normalized = (venmoUsername || '').replace(/^@+/, '');
      const venmoAppUrl = normalized
        ? `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(normalized)}&amount=0&note=Verification`
        : 'venmo://';
      const canOpen = await Linking.canOpenURL(venmoAppUrl);
      
      if (canOpen) {
        await Linking.openURL(venmoAppUrl);
      } else {
        // If Venmo app is not installed, open app store/play store
        const storeUrl = Platform.OS === 'ios' 
          ? 'https://apps.apple.com/us/app/venmo/id351727428'
          : 'https://play.google.com/store/apps/details?id=com.venmo';
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open Venmo app. Please install Venmo from the app store.');
    }
  };

  const fetchVenmoProfile = async (username) => {
    if (!username.trim()) return;
    
    setVerifyingVenmo(true);
    try {
      const normalized = username.replace(/^@+/, '');

      // Best-effort: Try public profile page
      // Primary: account.venmo.com/u/{username}
      const profileUrl = `https://account.venmo.com/u/${encodeURIComponent(normalized)}`;

      const response = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html',
          // Some sites behave differently based on UA; use a common UA to improve success rate
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile IOUApp',
        },
      });

      if (!response.ok) {
        throw new Error('Profile not found');
      }

      const html = await response.text();

      let imageUrl = null;
      let displayName = null;
      
      // Try multiple methods to extract profile picture and name
      
      // Method 1: Look for Open Graph image and title
      const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      
      if (ogImageMatch && ogImageMatch[1]) {
        imageUrl = ogImageMatch[1];
      }
      if (ogTitleMatch && ogTitleMatch[1]) {
        displayName = ogTitleMatch[1];
      }
      
      // Method 2: Look for Twitter card image
      if (!imageUrl) {
        const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (twitterImageMatch && twitterImageMatch[1]) {
          imageUrl = twitterImageMatch[1];
        }
      }
      
      // Method 3: Look for profile avatar images in the HTML
      if (!imageUrl) {
        const avatarMatches = [
          // Look for img tags with profile, avatar, or user in class/src
          html.match(/<img[^>]+class=["'][^"']*profile[^"']*["'][^>]*src=["']([^"']+)["']/i),
          html.match(/<img[^>]+class=["'][^"']*avatar[^"']*["'][^>]*src=["']([^"']+)["']/i),
          html.match(/<img[^>]+class=["'][^"']*user[^"']*["'][^>]*src=["']([^"']+)["']/i),
          // Look for background-image in style attributes
          html.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i),
          // Look for data-src attributes (lazy loaded images)
          html.match(/<img[^>]+data-src=["']([^"']+)["']/i),
          // Look for Venmo-specific patterns
          html.match(/<img[^>]+class=["'][^"']*ProfilePicture[^"']*["'][^>]*src=["']([^"']+)["']/i),
          html.match(/<img[^>]+class=["'][^"']*Avatar[^"']*["'][^>]*src=["']([^"']+)["']/i)
        ];
        
        for (const match of avatarMatches) {
          if (match && match[1] && match[1].startsWith('http')) {
            imageUrl = match[1];
            break;
          }
        }
      }
      
      // Method 4: Look for any Venmo CDN images
      if (!imageUrl) {
        const venmoImageMatches = [
          html.match(/https:\/\/[^"'\s]*venmo[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi),
          html.match(/https:\/\/[^"'\s]*amazonaws[^"'\s]*venmo[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi),
          html.match(/https:\/\/[^"'\s]*cloudfront[^"'\s]*\.(?:jpg|jpeg|png|webp)/gi)
        ];
        
        for (const matchArray of venmoImageMatches) {
          if (matchArray && matchArray[0]) {
            // Filter out generic icons and look for profile-sized images
            const profileImage = matchArray.find(url => 
              !url.includes('icon') && 
              !url.includes('logo') && 
              (url.includes('profile') || url.includes('avatar') || url.includes('user'))
            );
            if (profileImage) {
              imageUrl = profileImage;
              break;
            }
          }
        }
      }
      
      // Method 5: Try to find JSON-LD structured data
      if (!imageUrl) {
        const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i);
        if (jsonLdMatch) {
          try {
            const jsonData = JSON.parse(jsonLdMatch[1]);
            if (jsonData.image) {
              imageUrl = typeof jsonData.image === 'string' ? jsonData.image : jsonData.image.url;
            }
          } catch (e) {
            // Ignore JSON parsing errors
          }
        }
      }
      
      // Fallback to avatar generator if no real image found
      if (!imageUrl || imageUrl.includes('ui-avatars.com')) {
        imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || normalized)}&size=200&background=3d95ce&color=fff&bold=true`;
      }
      
      // Ensure the image URL is absolute
      if (imageUrl && imageUrl.startsWith('/')) {
        imageUrl = `https://account.venmo.com${imageUrl}`;
      }

      // Validate and optimize the profile picture
      const validatedImageUrl = await validateAndOptimizeProfilePicture(imageUrl, displayName || normalized);

      setVenmoProfilePic(validatedImageUrl);
      setVenmoVerified(true);
    } catch (error) {
      Alert.alert(
        'Could not verify automatically',
        'We could not confirm this Venmo username from the public profile. You can still try opening Venmo to visually confirm it is your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Venmo', onPress: openVenmoApp },
        ]
      );
    } finally {
      setVerifyingVenmo(false);
    }
  };

  const handleVenmoUsernameSubmit = () => {
    if (!venmoUsername.trim()) {
      Alert.alert('Required Field', 'Please enter your Venmo username');
      return;
    }
    fetchVenmoProfile(venmoUsername);
  };

  const handleSkipVenmo = () => {
    Alert.alert(
      'Skip Venmo Setup?',
      'You can always link your Venmo account later from your profile settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Skip for Now', onPress: proceedWithSignUp }
      ]
    );
  };

  const proceedWithSignUp = async () => {
    setLoading(true);
    try {
      const result = await sendOTP(phoneNumber);
      
      navigation.navigate('VerifyOTP', { 
        phoneNumber,
        verificationId: result.verificationId,
        isInitialAuth: true,
        isSignUp: true,
        userData: {
          firstName,
          lastName,
          venmoUsername: venmoVerified ? venmoUsername : null,
          venmoProfilePic: venmoVerified ? venmoProfilePic : null,
        }
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderVenmoSetup = () => {
    if (venmoVerified) {
      return (
        <View style={styles.verifiedContainer}>
          <View style={styles.profileContainer}>
            <VenmoProfilePicture
              source={venmoProfilePic}
              size={60}
              username={venmoUsername}
              style={styles.profilePic}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>@{venmoUsername}</Text>
              <Text style={styles.profileStatus}>✓ Verified Venmo Account</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.changeButton}
            onPress={() => {
              setVenmoVerified(false);
              setVenmoProfilePic(null);
              setVenmoUsername('');
            }}
          >
            <Text style={styles.changeButtonText}>Change Account</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.setupContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Venmo Username</Text>
          <View style={styles.venmoInputContainer}>
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              style={styles.venmoInput}
              value={venmoUsername}
              onChangeText={setVenmoUsername}
              placeholder="your-venmo-username"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleVenmoUsernameSubmit}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, verifyingVenmo && styles.verifyButtonDisabled]}
          onPress={handleVenmoUsernameSubmit}
          disabled={verifyingVenmo}
        >
          {verifyingVenmo ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Venmo Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.openVenmoButton} onPress={openVenmoApp}>
          <Ionicons name="open-outline" size={20} color={Colors.accent} />
          <Text style={styles.openVenmoText}>Open Venmo App</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Link Venmo</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.venmoIcon}>
                <Text style={styles.venmoIconText}>V</Text>
              </View>
            </View>

            <Text style={styles.mainTitle}>Connect Your Venmo</Text>
            <Text style={styles.subtitle}>
              Link your Venmo account to make splitting expenses with friends even easier
            </Text>

            {renderVenmoSetup()}

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefit}>
                <Ionicons name="flash-outline" size={24} color={Colors.accent} />
                <Text style={styles.benefitText}>Instant payments</Text>
              </View>
              <View style={styles.benefit}>
                <Ionicons name="people-outline" size={24} color={Colors.accent} />
                <Text style={styles.benefitText}>Split with anyone</Text>
              </View>
              <View style={styles.benefit}>
                <Ionicons name="shield-checkmark-outline" size={24} color={Colors.accent} />
                <Text style={styles.benefitText}>Secure & trusted</Text>
              </View>
            </View>
          </View>

          {/* Bottom Buttons */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[
                styles.continueButton, 
                loading && styles.continueButtonDisabled,
                !venmoVerified && styles.continueButtonSecondary
              ]}
              onPress={proceedWithSignUp}
              disabled={loading}
            >
              <Text style={[
                styles.continueButtonText,
                !venmoVerified && styles.continueButtonTextSecondary
              ]}>
                {loading ? 'Creating Account...' : venmoVerified ? 'Create Account' : 'Continue Without Venmo'}
              </Text>
            </TouchableOpacity>

            {!venmoVerified && (
              <TouchableOpacity style={styles.skipButton} onPress={handleSkipVenmo}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    ...Shadows.card,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  venmoIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.xl,
    backgroundColor: '#3d95ce',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  venmoIconText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  mainTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  setupContainer: {
    width: '100%',
    marginBottom: Spacing.xxl,
  },
  verifiedContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    width: '100%',
    ...Shadows.card,
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  profileStatus: {
    ...Typography.body,
    color: Colors.success,
    fontSize: 14,
  },
  changeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  changeButtonText: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  venmoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  atSymbol: {
    paddingLeft: Spacing.lg,
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  venmoInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  verifyButton: {
    height: 48,
    backgroundColor: '#3d95ce',
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 14,
  },
  openVenmoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  openVenmoText: {
    ...Typography.body,
    color: Colors.accent,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  benefitsContainer: {
    width: '100%',
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  benefitText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  bottomSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    width: '100%',
  },
  continueButton: {
    height: 56,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  continueButtonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    ...Typography.title,
    color: 'white',
    fontSize: 16,
  },
  continueButtonTextSecondary: {
    color: Colors.accent,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});

export default VenmoLinkScreen;
