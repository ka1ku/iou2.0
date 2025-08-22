import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchVenmoProfile, generateFallbackAvatar } from '../utils/venmoUtils';

/**
 * Hook for managing Venmo profile verification during signup
 */
export const useVenmoProfile = (firstName, lastName) => {
  const [venmoUsername, setVenmoUsername] = useState('');
  const [venmoProfilePic, setVenmoProfilePic] = useState(null);
  const [venmoVerified, setVenmoVerified] = useState(false);
  const [verifyingVenmo, setVerifyingVenmo] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const debounceTimeoutRef = useRef(null);

  /**
   * Automatically verify Venmo profile after typing stops
   */
  const verifyVenmoProfile = useCallback(async (username) => {
    if (!username.trim()) {
      setVenmoVerified(false);
      setVenmoProfilePic(null);
      setVerificationError(null);
      return;
    }
    
    setVerifyingVenmo(true);
    setVerificationError(null);
    
    try {
      console.log('Verifying Venmo profile for:', username);
      
      // Use the real Venmo profile fetching logic
      const profileData = await fetchVenmoProfile(username, firstName, lastName);
      
      console.log('Venmo profile data received:', profileData);
      
      // Always set the username and profile picture
      setVenmoUsername(profileData.username);
      setVenmoProfilePic(profileData.imageUrl);
      
      // Use the userExists field to determine verification status
      if (profileData.userExists === true) {
        // User definitely exists
        setVenmoVerified(true);
        setVerificationError(null);
        
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
      setVenmoProfilePic(generateFallbackAvatar(firstName, lastName, username.trim()));
      setVerificationError('Unable to verify Venmo account. Please check your connection and try again.');
      
      console.log('Unexpected error in verification, using fallback avatar');
    } finally {
      setVerifyingVenmo(false);
    }
  }, [firstName, lastName]);

  /**
   * Handle username input with debounced verification
   */
  const handleUsernameChange = useCallback((username) => {
    setVenmoUsername(username);
    setVerificationError(null);
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout for verification
    debounceTimeoutRef.current = setTimeout(() => {
      verifyVenmoProfile(username);
    }, 1000); // Wait 1 second after typing stops
  }, [verifyVenmoProfile]);

  /**
   * Reset Venmo profile data
   */
  const resetVenmoProfile = useCallback(() => {
    setVenmoUsername('');
    setVenmoProfilePic(null);
    setVenmoVerified(false);
    setVerifyingVenmo(false);
    setVerificationError(null);
    
    // Clear any pending verification
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  /**
   * Get current Venmo data
   */
  const getVenmoData = useCallback(() => ({
    username: venmoUsername,
    profilePic: venmoProfilePic,
    verified: venmoVerified
  }), [venmoUsername, venmoProfilePic, venmoVerified]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    venmoUsername,
    venmoProfilePic,
    venmoVerified,
    verifyingVenmo,
    verificationError,
    handleUsernameChange,
    resetVenmoProfile,
    getVenmoData,
    setVenmoUsername
  };
};
