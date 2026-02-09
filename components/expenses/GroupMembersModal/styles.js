import { StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../../../design/tokens';

export default StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  modalHeader: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: Spacing.xs,
  },
  headerTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  doneButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Selected members strip
  membersContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  membersList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
  },
  emptyMembersPlaceholder: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyMembersText: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptyMembersSubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },

  // SelectedMemberChip
  memberItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
    width: 80,
    flexShrink: 0,
  },
  memberAvatarContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  memberAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  memberAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitials: {
    color: Colors.white,
    fontSize: 20,
    fontFamily: Typography.familySemiBold,
  },
  removeButton: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: {
    ...Typography.body2,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  memberUsername: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Search input
  searchContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    height: 52,
  },
  searchBarFocused: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  searchIcon: {
    marginRight: Spacing.md,
  },
  searchClearButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body1,
    color: Colors.textPrimary,
  },

  // Results area
  resultsContainer: {
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.xxl,
  },
  searchContent: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    letterSpacing: 0.5,
  },

  // List items (shared)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  listItemBody: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: Spacing.lg,
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.white,
    fontSize: 18,
    fontFamily: Typography.familySemiBold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...Typography.body1,
    fontFamily: Typography.familyMedium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  userHandle: {
    ...Typography.body,
    color: Colors.blue,
  },
  userPhone: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addButtonSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  inviteButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    minWidth: 60,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  inviteButtonText: {
    ...Typography.body2,
    fontFamily: Typography.familySemiBold,
    color: Colors.accent,
  },

  // Scroll
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Empty states
  emptyStateContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyStateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },

  // Badge styles
  contactBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.blue,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
