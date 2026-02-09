
const { Spacing } = require('./design/tokens');

console.log('Spacing:', Spacing);
if (!Spacing) {
  console.error('Spacing is undefined!');
  process.exit(1);
}
console.log('Spacing.lg:', Spacing.lg);

try {
    const SkeletonUserItem = require('./components/expenses/GroupMembersModal/SkeletonUserItem');
    console.log('SkeletonUserItem imported successfully');
} catch (e) {
    console.error('Error importing SkeletonUserItem:', e);
}
