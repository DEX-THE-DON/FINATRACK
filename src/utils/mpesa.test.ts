import { parseSingleMpesaMessage, parseMultipleMpesaMessages, categorizeMpesaParty } from './mpesa';

console.log('🧪 RUNNING M-PESA BATCH SMS PARSER TESTS...');

// Test 1: Received SMS
const smsReceived = 'QA12345678 Confirmed. Ksh1,500.00 received from JOHN DOE 0712345678 on 12/9/26 at 11:30 AM. New M-PESA balance is Ksh5,400.00. Transaction cost, Ksh0.00.';
const parsed1 = parseSingleMpesaMessage(smsReceived);
if (!parsed1 || parsed1.code !== 'QA12345678' || parsed1.amount_kes !== 1500 || parsed1.type !== 'INCOME' || parsed1.date !== '2026-09-12') {
  console.error('❌ Failed Test 1: Received SMS', parsed1);
  process.exit(1);
}
console.log('✅ 1. Single Received SMS:', parsed1.code, parsed1.amount_kes, 'KES', parsed1.date);

// Test 2: Paid to Total Energies (Fuel)
const smsPaid = 'QB87654321 Confirmed. Ksh630.00 paid to TOTAL ENERGIES. on 12/9/26 at 8:15 PM. New M-PESA balance is Ksh4,770.00.';
const parsed2 = parseSingleMpesaMessage(smsPaid);
if (!parsed2 || parsed2.code !== 'QB87654321' || parsed2.amount_kes !== 630 || parsed2.type !== 'EXPENSE' || parsed2.suggested_category !== 'Fuel & Petrol') {
  console.error('❌ Failed Test 2: Paid Fuel SMS', parsed2);
  process.exit(1);
}
console.log('✅ 2. Paid Fuel SMS:', parsed2.code, parsed2.amount_kes, 'KES -> Category:', parsed2.suggested_category);

// Test 3: Multiple Batch SMS Paste
const batchSms = `
QA11111111 Confirmed. Ksh2,400.00 received from BOLT DELIVERIES on 12/9/26 at 6:00 PM. New M-PESA balance is Ksh7,170.00.
QB22222222 Confirmed. Ksh450.00 paid to KPLC PREPAID on 12/9/26 at 7:30 PM. New M-PESA balance is Ksh6,720.00.
QC33333333 Confirmed. Ksh1,000.00 sent to JANE WAMBUI 0722000000 on 12/9/26 at 9:00 PM. New M-PESA balance is Ksh5,720.00.
`;

const parsedBatch = parseMultipleMpesaMessages(batchSms);
if (parsedBatch.length !== 3) {
  console.error('❌ Failed Test 3: Batch SMS Count Mismatch, got:', parsedBatch.length);
  process.exit(1);
}
console.log(`✅ 3. Batch Extraction: Successfully parsed all ${parsedBatch.length} SMS messages!`);
parsedBatch.forEach((t, i) => {
  console.log(`   [${i+1}] ${t.code}: ${t.type} Ksh ${t.amount_kes} (${t.party}) -> Category: ${t.suggested_category}`);
});

// Test 4: EV Battery Swap Station (Spiro / Roam / Ampersand)
const evSms = 'QD44444444 Confirmed. Ksh400.00 paid to SPIRO BATTERY SWAP on 12/9/26 at 4:30 PM. New M-PESA balance is Ksh5,320.00.';
const parsedEV = parseSingleMpesaMessage(evSms);
if (!parsedEV || parsedEV.code !== 'QD44444444' || parsedEV.amount_kes !== 400 || parsedEV.suggested_category !== 'EV Battery Swap & Charging') {
  console.error('❌ Failed Test 4: EV Battery Swap SMS', parsedEV);
  process.exit(1);
}
console.log('✅ 4. EV Battery Swap SMS:', parsedEV.code, parsedEV.amount_kes, 'KES -> Category:', parsedEV.suggested_category);

// Test 5: Rubis Fuel Station with period in party name and PM.New balance
const rubisSms = 'UIC8Z65ZQV Confirmed. Ksh500.00 paid to Rubis Dagoretti 1. on 12/9/26 at 5:42 PM.New M-PESA balance is Ksh0.00. Transaction cost, Ksh0.00. Amount you can transact within the day is 499,047.00. See all your balances now https://saf.cx/kWQpy';
const parsedRubis = parseSingleMpesaMessage(rubisSms);
if (!parsedRubis || parsedRubis.code !== 'UIC8Z65ZQV' || parsedRubis.amount_kes !== 500 || parsedRubis.party !== 'Rubis Dagoretti 1' || parsedRubis.suggested_category !== 'Fuel & Petrol' || parsedRubis.time !== '5:42 PM') {
  console.error('❌ Failed Test 5: Rubis Fuel SMS', parsedRubis);
  process.exit(1);
}
console.log('✅ 5. Rubis Fuel SMS:', parsedRubis.code, parsedRubis.amount_kes, 'KES -> Party:', parsedRubis.party, '-> Cat:', parsedRubis.suggested_category, 'Time:', parsedRubis.time);

console.log('🎉 ALL M-PESA REGEX & BATCH SMS TESTS PASSED 100%!');

