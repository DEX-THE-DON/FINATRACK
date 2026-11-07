import { isUserPaywalled, getPaystackConfig, verifyPaystackPayment } from './paystack';

async function runPaystackTests() {
  console.log('🧪 RUNNING PAYSTACK SHIFT GATE ISOLATION TESTS...');

  const config = getPaystackConfig();
  console.log('✅ 1. Config loaded successfully:', {
    publicKey: config.publicKey.slice(0, 12) + '...',
    paywallEmail: config.paywallEmail,
    shiftFeeKes: config.shiftFeeKes,
  });

  // Test 1: Dex email is strictly paywalled
  if (!isUserPaywalled('dex@gmail.com', config)) {
    throw new Error('FAIL: dex@gmail.com must be paywalled');
  }
  console.log('✅ 2. dex@gmail.com is strictly paywalled');

  // Test 2: Case insensitivity
  if (!isUserPaywalled('DEX@GMAIL.COM', config) || !isUserPaywalled('Dex@Gmail.Com ', config)) {
    throw new Error('FAIL: dex@gmail.com must be case-insensitive');
  }
  console.log('✅ 3. Case insensitivity verified');

  // Test 3: Username 'dex' alias
  if (!isUserPaywalled('Dex', config) || !isUserPaywalled('dex', config)) {
    throw new Error('FAIL: username "dex" must be paywalled');
  }
  console.log('✅ 4. Username "dex" alias is paywalled');

  // Test 4: Other users are NOT paywalled
  const otherUsers = ['dennis@gmail.com', 'boda_rider@gmail.com', 'test@example.com', 'mama_mboga@gmail.com', ''];
  for (const user of otherUsers) {
    if (isUserPaywalled(user, config)) {
      throw new Error(`FAIL: ${user} must NOT be paywalled`);
    }
  }
  console.log('✅ 5. All other users (free testers) bypass paywall completely');

  // Test 5: Verify Mock Paystack Payment
  const mockRes = await verifyPaystackPayment(config.secretKey, 'FT_TEST_MOCK_12345');
  if (!mockRes.success || mockRes.amountKes !== 100) {
    throw new Error(`FAIL: Mock verification failed: ${JSON.stringify(mockRes)}`);
  }
  console.log('✅ 6. Mock test verification succeeds for KES 100');

  // Test 6: Verify empty reference rejection
  const emptyRes = await verifyPaystackPayment(config.secretKey, '');
  if (emptyRes.success) {
    throw new Error('FAIL: Empty reference should fail verification');
  }
  console.log('✅ 7. Empty payment reference is correctly rejected');

  console.log('🎉 ALL PAYSTACK SHIFT GATE TESTS PASSED 100%!');
}

runPaystackTests().catch((err) => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
