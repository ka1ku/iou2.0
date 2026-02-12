
const { Spacing } = require('./design/tokens');

if (!Spacing) {
  process.exit(1);
}

try {
    require('./components/expenses/GroupMembersModal/SkeletonUserItem');
} catch (e) {
    process.exit(1);
}
