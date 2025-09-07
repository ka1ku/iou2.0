import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';

const VenmoTest = () => {
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [capturedAccessToken, setCapturedAccessToken] = useState('');
  const [capturedDeviceId, setCapturedDeviceId] = useState('');
  const [capturedUsername, setCapturedUsername] = useState('');
  const [capturedProfileUrl, setCapturedProfileUrl] = useState('');
  
  // API Testing States
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState('');
  const [apiResultTitle, setApiResultTitle] = useState('');
  
  // Form States
  const [targetUserId, setTargetUserId] = useState('3030945191952384815');
  const [paymentAmount, setPaymentAmount] = useState('1.10');
  const [paymentNote, setPaymentNote] = useState('thanks for the 🍔');
  const [paymentAudience, setPaymentAudience] = useState('public');
  const [fundingSourceId, setFundingSourceId] = useState('');

  const openBrowser = () => {
    setIsBrowserOpen(true);
  };

  const closeBrowser = () => {
    setIsBrowserOpen(false);
  };

  const clearCaptured = () => {
    setCapturedAccessToken('');
    setCapturedDeviceId('');
    setCapturedUsername('');
    setCapturedProfileUrl('');
  };

  const clearApiResult = () => {
    setApiResult('');
    setApiResultTitle('');
  };

  const makeVenmoApiRequest = async (endpoint, method = 'GET', body = null) => {
    if (!capturedAccessToken) {
      Alert.alert('No Access Token', 'Please capture an access token first');
      return;
    }

    setIsApiLoading(true);
    setApiResultTitle(`${method} ${endpoint}`);
    setApiResult('');

    try {
      const url = `https://api.venmo.com/v1${endpoint}`;
      const headers = {
        'Authorization': `Bearer ${capturedAccessToken}`,
        'User-Agent': 'venmo-integration/requests',
        'Content-Type': 'application/json',
      };

      const options = {
        method,
        headers,
        ...(body && { body: JSON.stringify(body) })
      };

      const response = await fetch(url, options);
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { __raw: responseText };
      }
      
      setApiResult(JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data
      }, null, 2));
      
    } catch (error) {
      setApiResult(JSON.stringify({ error: error.message }, null, 2));
    } finally {
      setIsApiLoading(false);
    }
  };

  const makeGraphQLRequest = async (query, variables = {}) => {
    if (!capturedAccessToken) {
      Alert.alert('No Access Token', 'Please capture an access token first');
      return;
    }

    setIsApiLoading(true);
    setApiResultTitle('GraphQL Request');
    setApiResult('');

    try {
      const url = 'https://api.venmo.com/graphql';
      const headers = {
        'Authorization': `Bearer ${capturedAccessToken}`,
        'User-Agent': 'venmo-integration/requests',
        'Content-Type': 'application/json',
      };

      const body = { query, variables };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { __raw: responseText };
      }

      setApiResult(JSON.stringify({
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data 
      }, null, 2));

    } catch (error) {
      setApiResult(JSON.stringify({ error: error.message }, null, 2));
    } finally {
      setIsApiLoading(false);
    }
  };

  const injectedJavaScript = useMemo(() => `
    (function() {
      function post(payload) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (_) {}
      }

      function extractFromText(text) {
        var data = null;
        try { data = JSON.parse(text); } catch (_) {}
        
        var accessToken = (data && (data.access_token || data.accessToken || data.token)) || 
                         (text.match(/"access[_-]?token"\\s*:\\s*"([^"]+)"/i) || [])[1] || '';
        var deviceId = (data && (data.deviceId || data.device_id)) || 
                      (text.match(/"deviceId"\\s*:\\s*"([^"]+)"/i) || [])[1] || 
                      (text.match(/"device[_-]?id"\\s*:\\s*"([^"]+)"/i) || [])[1] || '';
        var username = (data && (data.username || (data.user && data.user.username))) || 
                      (text.match(/"username"\\s*:\\s*"([^"]+)"/i) || [])[1] || '';
        var profileUrl = (data && ((data.user && (data.user.profile_picture_url || (data.user.profilePicture && data.user.profilePicture.url))) || data.profile_picture_url || data.profilePictureUrl)) || 
                        (text.match(/"profile[_-]?picture[_-]?url"\\s*:\\s*"([^"]+)"/i) || [])[1] || 
                        (text.match(/"profilePicture"\\s*:\\s*\\{[^}]*"url"\\s*:\\s*"([^"]+)"/i) || [])[1] || '';
        
        if (accessToken || deviceId || username || profileUrl) {
          post({ type: 'capture', accessToken, deviceId, username, profileUrl });
        }
      }

      function scrapeIdentity() {
        if (/sign-in|login/i.test(location.href)) return;
        
        var username = '';
        var profileUrl = '';
        
        // Try XPaths first
        try {
          var userNode = document.evaluate('/html/body/div[2]/div[3]/div/div/ul/div/div[1]/div/div/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (userNode) username = (userNode.textContent || '').trim();
          
          var pfpNode = document.evaluate('/html/body/div[2]/div[3]/div/div/ul/div/div[1]/button/img', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (pfpNode && pfpNode.src) profileUrl = pfpNode.src;
        } catch (_) {}
        
        // Fallbacks
        if (!username) {
          var btns = document.querySelectorAll('button');
          for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].textContent || '').trim();
            if (t && t.startsWith('@') && t.length < 40) { username = t; break; }
          }
        }
        if (!profileUrl) {
          var imgs = document.querySelectorAll('img');
          for (var j = 0; j < imgs.length; j++) {
            var alt = (imgs[j].alt || '').toLowerCase();
            if (alt.includes('profile') || alt.includes('avatar')) { profileUrl = imgs[j].src || ''; if (profileUrl) break; }
          }
        }
        
        if (username && profileUrl) {
          post({ type: 'identity', username, profileUrl });
        }
      }

      // Hook fetch
      var originalFetch = window.fetch;
      window.fetch = function(input) {
        return originalFetch.apply(this, arguments).then(function(response) {
          var url = (typeof input === 'string') ? input : (input && input.url) || '';
          if (url && /\\/api\\/auth|\\/auth(?:$|[\\/?#])/i.test(url)) {
            response.clone().text().then(extractFromText);
          }
          return response;
        });
      };

      // Hook XMLHttpRequest
      var originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
      };
      var originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
          if (this._url && /\\/api\\/auth|\\/auth(?:$|[\\/?#])/i.test(this._url)) {
            extractFromText(this.responseText || '');
          }
        });
        return originalSend.apply(this, arguments);
      };

      // Scrape DOM periodically
      setInterval(scrapeIdentity, 1200);
    })();
    true;
  `, []);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event?.nativeEvent?.data || '{}');
      if (data?.type === 'capture') {
        if (data.accessToken) setCapturedAccessToken(String(data.accessToken));
        if (data.deviceId) setCapturedDeviceId(String(data.deviceId));
        if (data.username) setCapturedUsername(String(data.username));
        if (data.profileUrl) setCapturedProfileUrl(String(data.profileUrl));
      } else if (data?.type === 'identity') {
        if (data.username) setCapturedUsername(String(data.username));
        if (data.profileUrl) setCapturedProfileUrl(String(data.profileUrl));
        if (data.username && data.profileUrl) {
          setIsBrowserOpen(false);
        }
      }
    } catch (_) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Venmo Sign-In Capture</Text>
        <Text style={styles.subtitle}>Open Venmo, sign in, and this screen will listen for the in-page auth request to capture the access token and device ID.</Text>

        <TouchableOpacity style={styles.button} onPress={openBrowser}>
          <Text style={styles.buttonText}>Open Venmo Sign-In</Text>
            </TouchableOpacity>

        {(capturedAccessToken || capturedDeviceId || capturedUsername || capturedProfileUrl) && (
          <View style={styles.resultBox}>
            <Text selectable style={styles.label}>Access Token</Text>
            <Text selectable style={styles.code}>{capturedAccessToken || '—'}</Text>
            <Text selectable style={[styles.label, { marginTop: 12 }]}>Device ID</Text>
            <Text selectable style={styles.code}>{capturedDeviceId || '—'}</Text>
            <Text selectable style={[styles.label, { marginTop: 12 }]}>Username</Text>
            <Text selectable style={styles.code}>{capturedUsername || '—'}</Text>
            <Text selectable style={[styles.label, { marginTop: 12 }]}>Profile Picture URL</Text>
            <Text selectable style={styles.code}>{capturedProfileUrl || '—'}</Text>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={clearCaptured}>
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {capturedAccessToken && (
          <>
            <Text style={styles.title}>Venmo API Testing</Text>
            
            {/* Account Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Information</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeVenmoApiRequest('/account')} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Get Identity</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeVenmoApiRequest('/me')} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Get Me</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Payment Methods & Balance */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Methods & Balance</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeVenmoApiRequest('/payment-methods')} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Payment Methods</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeGraphQLRequest(`query getUserFundingInstruments {
  profile {
    ... on Profile {
      identity {
        ... on Identity {
          capabilities
          __typename
        }
        __typename
      }
      wallet {
        id
        assets {
          logoThumbnail
          __typename
        }
        instrumentType
        name
        fees {
          feeType
          fixedAmount
          variablePercentage
          __typename
        }
        metadata {
          ...BalanceMetadata
          ... on BankFundingInstrumentMetadata {
            bankName
            isVerified
            lastFourDigits
            uniqueIdentifier
            __typename
          }
          ... on CardFundingInstrumentMetadata {
            issuerName
            lastFourDigits
            networkName
            isVenmoCard
            expirationStatus
            quasiCash
            __typename
          }
          __typename
        }
        roles {
          merchantPayments
          peerPayments
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment BalanceMetadata on BalanceFundingInstrumentMetadata {
  availableBalance {
    value
    transactionType
    displayString
    __typename
  }
  __typename
}`)} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Wallet (GraphQL)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* User Lookup */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Lookup</Text>
              <TextInput
                style={styles.input}
                value={targetUserId}
                onChangeText={setTargetUserId}
                placeholder="User ID (e.g., 3030945191952384815)"
                placeholderTextColor="#666"
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeVenmoApiRequest(`/users/${targetUserId}`)} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Get User</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeVenmoApiRequest(`/users/${targetUserId}/friends?limit=50`)} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Get Friends</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Transactions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transactions</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeVenmoApiRequest(`/stories/target-or-actor/${targetUserId}?limit=20`)} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>User Stories</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.apiButton} onPress={() => makeGraphQLRequest(`query Identity {
  profile {
    ... on Profile {
      availableIdentities {
        ... on BusinessIdentity {
          handle
          type
        }
        ... on Identity {
          handle
          type
        }
      }
    }
  }
}`)} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Get Handle</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Send/Request Money */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Send/Request Money</Text>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="Amount (e.g., 1.10)"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholder="Note (e.g., thanks for the 🍔)"
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.input}
                value={paymentAudience}
                onChangeText={setPaymentAudience}
                placeholder="Audience (public/friends/private)"
                placeholderTextColor="#666"
              />
              <TextInput
                style={styles.input}
                value={fundingSourceId}
                onChangeText={setFundingSourceId}
                placeholder="Funding Source ID (optional)"
                placeholderTextColor="#666"
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.apiButton, styles.dangerButton]} onPress={() => {
                  const body = {
                    user_id: targetUserId,
                    amount: parseFloat(paymentAmount),
                    note: paymentNote,
                    audience: paymentAudience,
                    ...(fundingSourceId && { funding_source_id: fundingSourceId })
                  };
                  makeVenmoApiRequest('/payments', 'POST', body);
                }} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Send Money</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.apiButton, styles.warningButton]} onPress={() => {
                  const body = {
                    user_id: targetUserId,
                    amount: -parseFloat(paymentAmount),
                    note: paymentNote,
                    audience: paymentAudience
                  };
                  makeVenmoApiRequest('/payments', 'POST', body);
                }} disabled={isApiLoading}>
                  <Text style={styles.apiButtonText}>Request Money</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* API Results */}
        {apiResult && (
          <View style={styles.resultBox}>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>API Result</Text>
              <TouchableOpacity style={styles.clearButton} onPress={clearApiResult}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {apiResultTitle && <Text style={styles.resultTitle}>{apiResultTitle}</Text>}
            <View style={styles.resultBox}>
              {isApiLoading ? (
                <ActivityIndicator />
              ) : (
                <Text selectable style={styles.mono}>{apiResult}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={isBrowserOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeBrowser}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Venmo Sign-In</Text>
            <TouchableOpacity onPress={closeBrowser} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: 'https://venmo.com/account/sign-in' }}
            injectedJavaScript={injectedJavaScript}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  scroll: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2563eb',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
  },
  code: {
    fontSize: 12,
    color: '#111827',
    fontFamily: 'Courier',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  close: {
    padding: 8,
  },
  closeText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6b7280',
  },
  section: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  apiButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  apiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  warningButton: {
    backgroundColor: '#d97706',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: '#fff',
  },
  clearButtonText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '500',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#111827',
    lineHeight: 16,
  },
});

export default VenmoTest;


