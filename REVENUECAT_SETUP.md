# RevenueCat Paywall Setup for IOU 2.0

## Overview
This app now includes a RevenueCat paywall that appears when users try to access the receipt scanning feature. The paywall is triggered when pressing the scan receipt button in the HomeScreen.

## What's Implemented

### 1. RevenueCat Initialization
- RevenueCat is initialized in `App.js` when the app starts
- User ID is automatically updated when users log in/out
- Uses the `react-native-purchases` and `react-native-purchases-ui` packages

### 2. Paywall Integration
- Paywall appears before receipt scanning if user doesn't have premium access
- Checks user entitlements before showing paywall
- Supports both automatic and custom paywall presentation
- Handles purchase success, cancellation, and restoration

### 3. Entitlement Checking
- Automatically checks if user has access to premium features
- Only shows paywall when necessary
- Seamless experience for premium users

## Configuration Required

### 1. RevenueCat API Key
Replace `'YOUR_REVENUECAT_API_KEY'` in `App.js` with your actual RevenueCat API key:

```javascript
Purchases.configure({
  apiKey: 'YOUR_ACTUAL_API_KEY_HERE',
  appUserID: null,
});
```

### 2. Entitlement Identifier
Replace `'pro'` in the following files with your actual entitlement identifier:

- `App.js` - in the `checkUserEntitlements` function
- `screens/HomeScreen.js` - in the `checkUserEntitlements` function

### 3. Paywall Configuration
The paywall will use your RevenueCat dashboard configuration. Make sure to set up:

- **Offerings**: Define your subscription products
- **Entitlements**: Create the entitlement that grants access to receipt scanning
- **Paywall Design**: Customize the appearance in RevenueCat dashboard

## Files Modified

1. **`App.js`**
   - Added RevenueCat import and initialization
   - Added user ID management

2. **`screens/HomeScreen.js`**
   - Added RevenueCat imports
   - Added entitlement checking function
   - Modified `handleReceiptScan` to show paywall
   - Added custom paywall presentation function

## How It Works

1. User taps the scan receipt button
2. App checks if user has premium access
3. If no access, paywall is displayed
4. User can purchase, restore, or dismiss
5. If purchase successful, receipt scanning proceeds
6. If dismissed/cancelled, scanning is blocked

## Testing

### Development
- Use RevenueCat's sandbox environment
- Test with test accounts
- Verify paywall appears for non-premium users

### Production
- Ensure proper API keys are set
- Test purchase flow end-to-end
- Verify entitlements are properly granted

## RevenueCat Dashboard Setup

1. **Create App**: Set up your app in RevenueCat dashboard
2. **Configure Products**: Add your subscription products
3. **Create Entitlement**: Define what premium access includes
4. **Design Paywall**: Customize the paywall appearance
5. **Set Up Offerings**: Group products into offerings

## Troubleshooting

### Common Issues
- **Paywall not showing**: Check API key and entitlement identifier
- **Purchases not working**: Verify sandbox/production environment
- **Entitlements not granted**: Check RevenueCat dashboard configuration

### Debug Logs
The implementation includes console logs for debugging:
- Entitlement checking results
- Paywall presentation status
- Purchase flow events

## Next Steps

1. Replace placeholder values with your actual RevenueCat configuration
2. Test the paywall flow in development
3. Customize paywall design in RevenueCat dashboard
4. Deploy and test in production environment

## Support

For RevenueCat-specific issues, refer to:
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [React Native SDK](https://docs.revenuecat.com/docs/react-native)
- [RevenueCat Support](https://www.revenuecat.com/support/)
