import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchVenmoProfile, generateFallbackAvatar } from '../utils/venmoUtils';

/**
 * Hook for managing Venmo profile verification during signup
 * Consolidated and improved to handle all Venmo functionality in one place
 */
export const useVenmoProfile = (firstName, lastName) => {
  const [username, setUsername] = useState('');
  const [venmoProfilePic, setVenmoProfilePic] = useState('');
  const [venmoVerified, setVenmoVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState(null);
  const [lastVerifiedUsername, setLastVerifiedUsername] = useState('');

  /**
   * Automatically verify Venmo profile after typing stops
   */
  const verifyVenmoProfile = useCallback(async (usernameToVerify) => {
    if (!usernameToVerify.trim()) {
      setVenmoVerified(false);
      setVenmoProfilePic(null);
      setVerificationError(null);
      return;
    }

    // Don't re-verify if we already verified this exact username
    if (lastVerifiedUsername === usernameToVerify.trim()) {
      return;
    }
    
    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      console.log('Verifying Venmo profile for:', usernameToVerify);
      
      // Use the real Venmo profile fetching logic
      const profileData = await fetchVenmoProfile(usernameToVerify, firstName, lastName);
      
      console.log('Venmo profile data received:', profileData);
      
      // Always set the username and profile picture
      setUsername(profileData.username);
      setVenmoProfilePic(profileData.imageUrl);
      
      // Use the userExists field to determine verification status
      if (profileData.userExists === true) {
        // User definitely exists
        setVenmoVerified(true);
        setVerificationError(null);
        setLastVerifiedUsername(profileData.username);
        
        // Check if they have a real profile picture
        const hasRealProfilePic = !profileData.imageUrl.includes('ui-avatars.com');
        
        console.log('Venmo verification completed successfully:', {
          username: profileData.username,
          userExists: true,
          hasRealProfilePic,
          profilePic: profileData.imageUrl,
          displayName: profileData.displayName
        });
      } else if (profileData.userExists === false) {
        // User definitely doesn't exist
        setVenmoVerified(false);
        setVerificationError('Venmo user does not exist. Please check the username and try again.');
        
        console.log('Venmo user does not exist, showing error');
      } else {
        // userExists is null - network or other error, can't determine
        setVenmoVerified(false);
        setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
        
        console.log('Network or other error, cannot determine if user exists');
      }
      
    } catch (error) {
      console.error('Venmo verification failed:', error);
      
      // This should rarely happen now since fetchVenmoProfile handles most errors
      setVenmoVerified(false);
      setVenmoProfilePic(generateFallbackAvatar(firstName, lastName, usernameToVerify.trim()));
      setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
      
      console.log('Unexpected error in verification, using fallback avatar');
    } finally {
      setIsVerifying(false);
    }
  }, [firstName, lastName, lastVerifiedUsername]);

  /**
   * Handle username input with debounced verification
   */
  const handleUsernameChange = useCallback((newUsername) => {
    // Clear any existing verification state when username changes
    setVerificationError(null);
    
    // Clear existing timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    // Update username immediately for responsive UI
    setUsername(newUsername);
    
    // Show loading immediately if there's a username
    if (newUsername.trim()) {
      setIsVerifying(true);
      setVenmoVerified(false); // Reset verification until we confirm
    } else {
      setIsVerifying(false);
      setVenmoVerified(false);
      setVenmoProfilePic(null);
      setLastVerifiedUsername('');
    }
    
    // Set new timeout for verification
    setDebounceTimeout(setTimeout(() => {
      if (newUsername.trim()) {
        verifyVenmoProfile(newUsername);
      }
    }, 1000)); // Wait 1 second after typing stops
  }, [verifyVenmoProfile]);

  /**
   * Reset Venmo profile data
   */
  const resetVenmoProfile = useCallback(() => {
    setUsername('');
    setVenmoProfilePic(null);
    setVenmoVerified(false);
    setIsVerifying(false);
    setVerificationError(null);
    setLastVerifiedUsername('');
    
    // Clear any pending verification
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  }, []);

  /**
   * Get current Venmo data
   */
  const getVenmoData = useCallback(() => ({
    username: username,
    profilePic: venmoProfilePic,
    verified: venmoVerified
  }), [username, venmoProfilePic, venmoVerified]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  return {
    // State variables
    username,
    venmoProfilePic,
    venmoVerified,
    isVerifying,
    verificationError,
    
    // Actions
    handleUsernameChange,
    resetVenmoProfile,
    getVenmoData,
    setUsername,
    
    // Aliases for backward compatibility
    venmoUsername: username,
    venmoProfilePic: venmoProfilePic,
    venmoVerified: venmoVerified,
    verifyingVenmo: isVerifying,
    verifyVenmoProfile: () => verifyVenmoProfile(username),
    setVenmoUsername: setUsername
  };
};
