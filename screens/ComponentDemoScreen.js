import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../design/tokens';
import DeleteButton from '../components/DeleteButton';
import SmartSplitInput from '../components/SmartSplitInput';
import PriceInput from '../components/PriceInput';
import FriendSelector from '../components/FriendSelector';

const ComponentDemoScreen = ({ navigation }) => {
  const [demoTotal, setDemoTotal] = useState(100);
  const [demoSplits, setDemoSplits] = useState([]);
  const [demoPrice, setDemoPrice] = useState(null);
  const [demoFriends, setDemoFriends] = useState([]);

  const handleSplitsChange = (newSplits) => {
    setDemoSplits(newSplits);
  };

  const handlePriceChange = (newPrice) => {
    setDemoPrice(newPrice);
  };

  const handleFriendsChange = (newFriends) => {
    setDemoFriends(newFriends);
  };

  const demoParticipants = [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Charlie' },
    { name: 'Diana' },
  ];

  const changeTotal = (newTotal) => {
    setDemoTotal(newTotal);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Component Demo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* DeleteButton Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DeleteButton Component</Text>
          <Text style={styles.sectionDescription}>
            Consistent delete/remove buttons throughout the app
          </Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Sizes</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Small</Text>
                <DeleteButton
                  onPress={() => console.log('Small delete')}
                  size="small"
                  variant="default"
                />
              </View>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Medium</Text>
                <DeleteButton
                  onPress={() => console.log('Medium delete')}
                  size="medium"
                  variant="default"
                />
              </View>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Large</Text>
                <DeleteButton
                  onPress={() => console.log('Large delete')}
                  size="large"
                  variant="default"
                />
              </View>
            </View>
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Variants</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Default</Text>
                <DeleteButton
                  onPress={() => console.log('Default delete')}
                  size="medium"
                  variant="default"
                />
              </View>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Subtle</Text>
                <DeleteButton
                  onPress={() => console.log('Subtle delete')}
                  size="medium"
                  variant="subtle"
                />
              </View>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Filled</Text>
                <DeleteButton
                  onPress={() => console.log('Filled delete')}
                  size="medium"
                  variant="filled"
                />
              </View>
            </View>
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>States</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Normal</Text>
                <DeleteButton
                  onPress={() => console.log('Normal delete')}
                  size="medium"
                  variant="subtle"
                />
              </View>
              <View style={styles.buttonExample}>
                <Text style={styles.buttonLabel}>Disabled</Text>
                <DeleteButton
                  onPress={() => console.log('Disabled delete')}
                  size="medium"
                  variant="subtle"
                  disabled={true}
                />
              </View>
            </View>
          </View>
        </View>

        {/* SmartSplitInput Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SmartSplitInput Component</Text>
          <Text style={styles.sectionDescription}>
            Intelligent bill splitting with automatic distribution
          </Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Total Controls</Text>
            <View style={styles.totalControls}>
              <TouchableOpacity
                style={styles.totalButton}
                onPress={() => changeTotal(25)}
              >
                <Text style={styles.totalButtonText}>$25.00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.totalButton}
                onPress={() => changeTotal(50)}
              >
                <Text style={styles.totalButtonText}>$50.00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.totalButton}
                onPress={() => changeTotal(100)}
              >
                <Text style={styles.totalButtonText}>$100.00</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.totalButton}
                onPress={() => changeTotal(157.89)}
              >
                <Text style={styles.totalButtonText}>$157.89</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Smart Split Demo</Text>
            <SmartSplitInput
              participants={demoParticipants}
              total={demoTotal}
              onSplitsChange={handleSplitsChange}
            />
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Current Splits</Text>
            {demoSplits.map((split, index) => (
              <View key={index} style={styles.splitRow}>
                <Text style={styles.participantName}>
                  {demoParticipants[split.participantIndex]?.name || `Person ${split.participantIndex + 1}`}
                </Text>
                <Text style={styles.splitAmount}>
                  ${(split.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))}
            {demoSplits.length > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total:</Text>
                <Text style={styles.summaryAmount}>
                  ${demoSplits.reduce((sum, split) => sum + (split.amount || 0), 0).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* PriceInput Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PriceInput Component</Text>
          <Text style={styles.sectionDescription}>
            Currency input with automatic formatting and validation
          </Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Price Input Demo</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.priceLabel}>Enter Amount:</Text>
              <PriceInput
                value={demoPrice}
                onChangeText={handlePriceChange}
                placeholder="0.00"
                style={styles.demoPriceInput}
              />
            </View>
            <Text style={styles.priceValue}>
              Current Value: {demoPrice !== null ? `$${demoPrice}` : 'None'}
            </Text>
          </View>
        </View>

        {/* FriendSelector Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FriendSelector Component</Text>
          <Text style={styles.sectionDescription}>
            Friend selection with placeholder support
          </Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Friend Selection Demo</Text>
            <FriendSelector
              selectedFriends={demoFriends}
              onFriendsChange={handleFriendsChange}
              maxFriends={5}
              placeholder="Select demo friends..."
              allowPlaceholders={true}
              onAddPlaceholder={(placeholder) => {
                console.log('Added placeholder:', placeholder);
                setDemoFriends([...demoFriends, placeholder]);
              }}
            />
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Selected Friends</Text>
            {demoFriends.length === 0 ? (
              <Text style={styles.noFriendsText}>No friends selected</Text>
            ) : (
              demoFriends.map((friend, index) => (
                <View key={index} style={styles.friendItem}>
                  <Text style={styles.friendName}>
                    {friend.name} {friend.isPlaceholder ? '(Placeholder)' : ''}
                  </Text>
                  <DeleteButton
                    onPress={() => {
                      const updated = demoFriends.filter((_, i) => i !== index);
                      setDemoFriends(updated);
                    }}
                    size="small"
                    variant="subtle"
                  />
                </View>
              ))
            )}
          </View>
        </View>

        {/* Design Tokens Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Design Tokens</Text>
          <Text style={styles.sectionDescription}>
            Consistent colors, spacing, and typography
          </Text>
          
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Colors</Text>
            <View style={styles.colorGrid}>
              <View style={[styles.colorSwatch, { backgroundColor: Colors.background }]}>
                <Text style={styles.colorLabel}>Background</Text>
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: Colors.surface }]}>
                <Text style={styles.colorLabel}>Surface</Text>
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: Colors.accent }]}>
                <Text style={styles.colorLabel}>Accent</Text>
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: Colors.danger }]}>
                <Text style={styles.colorLabel}>Danger</Text>
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: Colors.success }]}>
                <Text style={styles.colorLabel}>Success</Text>
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: Colors.warning }]}>
                <Text style={styles.colorLabel}>Warning</Text>
              </View>
            </View>
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Typography</Text>
            <Text style={styles.typographyExample}>H1 - Main Title</Text>
            <Text style={[styles.typographyExample, { ...Typography.h2 }]}>H2 - Section Title</Text>
            <Text style={[styles.typographyExample, { ...Typography.h3 }]}>H3 - Subsection Title</Text>
            <Text style={[styles.typographyExample, { ...Typography.title }]}>Title - Card Title</Text>
            <Text style={[styles.typographyExample, { ...Typography.body }]}>Body - Regular text</Text>
            <Text style={[styles.typographyExample, { ...Typography.label }]}>Label - Small text</Text>
            <Text style={[styles.typographyExample, { ...Typography.caption }]}>Caption - Tiny text</Text>
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Spacing</Text>
            <View style={styles.spacingExamples}>
              <View style={[styles.spacingBox, { margin: Spacing.xs }]}>
                <Text style={styles.spacingLabel}>XS: {Spacing.xs}px</Text>
              </View>
              <View style={[styles.spacingBox, { margin: Spacing.sm }]}>
                <Text style={styles.spacingLabel}>SM: {Spacing.sm}px</Text>
              </View>
              <View style={[styles.spacingBox, { margin: Spacing.md }]}>
                <Text style={styles.spacingLabel}>MD: {Spacing.md}px</Text>
              </View>
              <View style={[styles.spacingBox, { margin: Spacing.lg }]}>
                <Text style={styles.spacingLabel}>LG: {Spacing.lg}px</Text>
              </View>
              <View style={[styles.spacingBox, { margin: Spacing.xl }]}>
                <Text style={styles.spacingLabel}>XL: {Spacing.xl}px</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Usage Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Use</Text>
          <Text style={styles.instructionText}>
            • <Text style={styles.bold}>DeleteButton</Text>: Use for all delete/remove actions{'\n'}
            • <Text style={styles.bold}>SmartSplitInput</Text>: For custom expense splitting{'\n'}
            • <Text style={styles.bold}>PriceInput</Text>: For currency amounts{'\n'}
            • <Text style={styles.bold}>FriendSelector</Text>: For friend selection{'\n'}
            • <Text style={styles.bold}>Design Tokens</Text>: For consistent styling
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    ...Shadows.card,
  },
  sectionTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  subsection: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  subsectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  buttonExample: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  buttonLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  totalControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  totalButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  totalButtonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: '600',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  participantName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  splitAmount: {
    ...Typography.body,
    color: Colors.accent,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  summaryLabel: {
    ...Typography.title,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  summaryAmount: {
    ...Typography.title,
    color: Colors.accent,
    fontWeight: '600',
  },
  priceInputContainer: {
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  demoPriceInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  priceValue: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  noFriendsText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  friendName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 80,
    height: 60,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  colorLabel: {
    ...Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
  },
  typographyExample: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  spacingExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  spacingBox: {
    backgroundColor: Colors.accent + '20',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  spacingLabel: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },
  instructionText: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

export default ComponentDemoScreen;
