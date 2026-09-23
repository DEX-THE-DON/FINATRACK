import { parseSingleBankMessage, parseMultipleBankMessages } from './bankSms';

console.log('🧪 RUNNING KENYAN BANK SMS PARSER TESTS...');

// 1. Equity Bank Credit SMS
const equityCredit = `Dear Customer, your A/C *******1234 has been credited with KES 4,500.00 on 22/09/2026 10:30:15 from BOLT OPERATIONS Ref: BQD7654321. Available Bal: KES 18,200.00.`;
const eq1 = parseSingleBankMessage(equityCredit);
console.assert(eq1 !== null, 'Equity credit should parse successfully');
console.assert(eq1?.type === 'INCOME', `Equity type should be INCOME, got ${eq1?.type}`);
console.assert(eq1?.amount_kes === 4500, `Equity amount should be 4500, got ${eq1?.amount_kes}`);
console.assert(eq1?.code === 'BQD7654321', `Equity code should be BQD7654321, got ${eq1?.code}`);
console.assert(eq1?.date === '2026-09-22', `Equity date should be 2026-09-22, got ${eq1?.date}`);
console.assert(eq1?.suggested_category === 'Rider & Boda Deliveries', `Equity category should be Rider & Boda Deliveries, got ${eq1?.suggested_category}`);
console.log(`✅ 1. Equity Credit SMS: ${eq1?.code} Ksh ${eq1?.amount_kes} -> Category: ${eq1?.suggested_category}`);

// 2. Equity Bank Debit SMS (Fuel / Rubis)
const equityDebit = `Dear Customer, your A/C *******1234 has been debited with KES 1,500.00 on 22/09/2026 14:20:00 paid to RUBIS ENERGY Ref: EQ987654. Available Bal: KES 16,700.00.`;
const eq2 = parseSingleBankMessage(equityDebit);
console.assert(eq2 !== null, 'Equity debit should parse successfully');
console.assert(eq2?.type === 'EXPENSE', `Equity debit should be EXPENSE, got ${eq2?.type}`);
console.assert(eq2?.amount_kes === 1500, `Equity debit should be 1500, got ${eq2?.amount_kes}`);
console.assert(eq2?.suggested_category === 'Fuel & Petrol', `Category should be Fuel & Petrol, got ${eq2?.suggested_category}`);
console.log(`✅ 2. Equity Debit SMS: ${eq2?.code} Ksh ${eq2?.amount_kes} -> Category: ${eq2?.suggested_category}`);

// 3. KCB Bank SMS (Uber Payout)
const kcbCredit = `Confirmed. Ksh 5,000.00 received from UBER B.V on 22/09/2026 at 09:15 AM. Ref: KCB123456. New balance is Ksh 22,000.00.`;
const kcb1 = parseSingleBankMessage(kcbCredit);
console.assert(kcb1 !== null, 'KCB credit should parse successfully');
console.assert(kcb1?.type === 'INCOME', 'KCB should be INCOME');
console.assert(kcb1?.amount_kes === 5000, `KCB amount should be 5000, got ${kcb1?.amount_kes}`);
console.assert(kcb1?.code === 'KCB123456', `KCB code should be KCB123456, got ${kcb1?.code}`);
console.assert(kcb1?.suggested_category === 'Rider & Boda Deliveries', `Category should be Rider & Boda Deliveries, got ${kcb1?.suggested_category}`);
console.log(`✅ 3. KCB Credit SMS: ${kcb1?.code} Ksh ${kcb1?.amount_kes} -> Category: ${kcb1?.suggested_category}`);

// 4. Co-op Bank SMS (MCo-op Cash KPLC Bill)
const coopDebit = `MCo-op Cash: Ksh 850.00 paid to KPLC PREPAID on 22/09/2026 Ref: COOP456. New balance is Ksh 14,150.00.`;
const coop1 = parseSingleBankMessage(coopDebit);
console.assert(coop1 !== null, 'Co-op debit should parse successfully');
console.assert(coop1?.type === 'EXPENSE', 'Co-op should be EXPENSE');
console.assert(coop1?.amount_kes === 850, `Co-op amount should be 850, got ${coop1?.amount_kes}`);
console.assert(coop1?.code === 'COOP456', `Co-op code should be COOP456, got ${coop1?.code}`);
console.assert(coop1?.suggested_category === 'Utilities & Bills', `Category should be Utilities & Bills, got ${coop1?.suggested_category}`);
console.log(`✅ 4. Co-op Debit SMS: ${coop1?.code} Ksh ${coop1?.amount_kes} -> Category: ${coop1?.suggested_category}`);

// 5. Batch Bank Paste
const batchText = `
Dear Customer, your A/C *******1234 has been credited with KES 4,500.00 on 22/09/2026 10:30:15 from BOLT OPERATIONS Ref: BQD7654321. Available Bal: KES 18,200.00.

Confirmed. Ksh 5,000.00 received from UBER B.V on 22/09/2026 at 09:15 AM. Ref: KCB123456. New balance is Ksh 22,000.00.

MCo-op Cash: Ksh 850.00 paid to KPLC PREPAID on 22/09/2026 Ref: COOP456. New balance is Ksh 14,150.00.
`;
const batchParsed = parseMultipleBankMessages(batchText);
console.assert(batchParsed.length === 3, `Batch should extract 3 messages, got ${batchParsed.length}`);
console.log(`✅ 5. Batch Bank Paste: Successfully parsed all ${batchParsed.length} bank SMS messages!`);

console.log('🎉 ALL KENYAN BANK SMS PARSER TESTS PASSED 100%!');

