import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius, Typography } from '../design/tokens';

// Generate a color adjacent to the brand's primary gold (#F4C645)
// We avoid using the exact brand color so cards don't look like primary calls to action
export const getAvatarColor = (name) => {
    if (!name) return '#A1A1AA'; // Zinc 400

    // Curated palette centered around warm, earthy, and muted fintech tones 
    // that complement amber/gold without directly using it.
    const adjacentColors = [
        '#E07A5F', // Muted Terracotta (Warm)
        '#81B29A', // Sage Green (Cool Contrast)
        '#F2CC8F', // Very Soft Muted Gold (Adjacent)
        '#D4A373', // Faded Ochre/Tan (Warm)
        '#A09DBA', // Muted Lavender/Slate (Cool Contrast)
        '#B08976', // Dusty Brown (Neutral/Warm)
        '#8EA7B5', // Desaturated Steel Blue (Cool Contrast)
        '#E7A8A3', // Soft Coral/Peach (Warm)
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % adjacentColors.length;
    return adjacentColors[index];
};

const UserCard = ({ user, variant = 'default', designVariant = 'v1', onPress }) => {
    const isDeleted = variant === 'deleted' || user?.isDeleted;

    let displayName = 'Unknown User';
    let handle = '';

    if (isDeleted) {
        displayName = 'Deleted User';
    } else if (user) {
        displayName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Unknown User';
        handle = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '';
    }

    const getInitials = (nameStr) => {
        if (!nameStr || isDeleted) return '';
        const nameParts = nameStr.trim().split(/\s+/);
        if (nameParts.length === 0) return 'U';
        if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
        return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    };

    const initials = getInitials(displayName);
    const avatarColor = getAvatarColor(displayName);

    // Create a faded background color (10% opacity) for V1
    const backgroundColorWithAlpha = `${avatarColor}1A`;

    const hasValidProfilePhoto = user?.profilePhoto && !user.profilePhoto.includes('ui-avatars.com') && !isDeleted;

    // Render logic based on the requested design variant
    // Currently defaults to V1 (Soft Tint)

    let containerStyle = styles.cardContainerV1;
    let pressedStyle = styles.cardPressedV1;
    let dynamicContainerStyle = {};

    if (designVariant === 'v2') {
        containerStyle = styles.cardContainerV2;
        pressedStyle = styles.cardPressedV2;
        if (!isDeleted) {
            dynamicContainerStyle = { borderColor: avatarColor };
        }
    } else if (designVariant === 'v3') {
        containerStyle = styles.cardContainerV3;
        pressedStyle = styles.cardPressedV3;
    } else {
        // V1 styles
        if (!isDeleted) {
            dynamicContainerStyle = { backgroundColor: backgroundColorWithAlpha, borderColor: avatarColor };
        }
    }

    return (
        <Pressable
            style={({ pressed }) => [
                containerStyle,
                dynamicContainerStyle,
                pressed && !isDeleted && pressedStyle,
                isDeleted && styles.cardContainerDeleted
            ]}
            onPress={!isDeleted ? onPress : undefined}
            disabled={isDeleted || !onPress}
        >
            <View style={styles.contentRow}>
                {designVariant === 'v3' && !isDeleted && (
                    <View style={[styles.v3AccentBar, { backgroundColor: avatarColor }]} />
                )}
                {designVariant === 'v3' && isDeleted && (
                    <View style={[styles.v3AccentBar, { backgroundColor: '#E5E7EB' }]} />
                )}

                <View style={[
                    styles.avatarContainer,
                    designVariant === 'v3' && { marginLeft: Spacing.md }
                ]}>
                    {hasValidProfilePhoto ? (
                        <Image
                            source={{ uri: user.profilePhoto }}
                            style={[
                                styles.avatar,
                                isDeleted && styles.avatarDeleted,
                                designVariant === 'v2' && { borderColor: avatarColor, borderWidth: 2 }
                            ]}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <View style={[
                            styles.avatarPlaceholder,
                            isDeleted ? styles.avatarDeletedBg : { backgroundColor: designVariant === 'v2' ? '#FFF' : avatarColor },
                            designVariant === 'v2' && !isDeleted ? { borderColor: avatarColor, borderWidth: 2 } : {}
                        ]}>
                            {isDeleted ? (
                                <View style={styles.deletedStrikethrough} />
                            ) : (
                                <Text style={[
                                    styles.avatarInitials,
                                    designVariant === 'v2' && { color: avatarColor }
                                ]}>{initials}</Text>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.userInfo}>
                    <Text
                        style={[
                            styles.userName,
                            isDeleted && styles.textDeleted
                        ]}
                        numberOfLines={1}
                    >
                        {displayName}
                    </Text>
                    {!isDeleted && handle ? (
                        <Text style={styles.userHandle} numberOfLines={1}>{handle}</Text>
                    ) : null}
                    {isDeleted && (
                        <Text style={styles.deletedUserSubtext}>Account no longer active</Text>
                    )}
                </View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    // V1 Default Styles (Soft Tinted Background + Border)
    cardContainerV1: {
        borderRadius: Radius.md,
        padding: Spacing.md,
        borderWidth: 1,
        marginBottom: Spacing.sm,
    },
    cardPressedV1: {
        opacity: 0.7,
    },

    // V2 Brutalist Tech Styles (Crisp White + Sharp Thick Border)
    cardContainerV2: {
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.sm,
        padding: Spacing.md,
        borderWidth: 1.5,
        marginBottom: Spacing.sm,
        borderColor: '#E8E4DC', // Default fallback, overridden dynamic
    },
    cardPressedV2: {
        backgroundColor: '#FAF9F7',
    },

    // V3 Corporate Minimal Styles (White + Accent Bar)
    cardContainerV3: {
        backgroundColor: '#FFFFFF',
        borderRadius: Radius.md,
        paddingVertical: Spacing.md,
        paddingRight: Spacing.md,
        borderWidth: 1,
        marginBottom: Spacing.sm,
        borderColor: '#E8E4DC',
        overflow: 'hidden',
    },
    cardPressedV3: {
        backgroundColor: '#FAF9F7',
    },
    v3AccentBar: {
        position: 'absolute',
        left: 0,
        top: -Spacing.md, // Accounting for parent padding
        bottom: -Spacing.md,
        width: 4,
    },

    // Deleted Standard Style
    cardContainerDeleted: {
        backgroundColor: '#F9FAFB', // Very subtle off-white  
        borderColor: '#F3F4F6',
        borderWidth: 1,
    },

    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    avatarContainer: {
        marginRight: Spacing.md,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E8E4DC',
    },
    avatarDeleted: {
        opacity: 0.4,
        tintColor: 'gray',
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarDeletedBg: {
        backgroundColor: '#E5E7EB', // Gray 200
    },
    deletedStrikethrough: {
        width: 20,
        height: 2,
        backgroundColor: '#9CA3AF', // Gray 400
        transform: [{ rotate: '-45deg' }],
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Typography.familySemiBold,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        ...Typography.body1,
        color: '#1A1A1A', // Dark charcoal
        fontFamily: Typography.familySemiBold,
        fontWeight: '600',
        marginBottom: 2,
    },
    textDeleted: {
        color: '#9CA3AF', // Gray 400
        textDecorationLine: 'line-through',
    },
    userHandle: {
        ...Typography.body2,
        color: '#718096', // Cool gray
        fontFamily: Typography.familyRegular,
    },
    deletedUserSubtext: {
        ...Typography.caption,
        color: '#A1A1AA', // Zinc 400
        fontStyle: 'italic',
    }
});

export default UserCard;
