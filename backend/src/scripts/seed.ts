import { processTransaction } from '../services/transactionProcessor';

// ─── Seed Script ────────────────────────────────────────────
// Generates 100 realistic test transactions

const PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'];
const CURRENCIES = ['INR', 'INR', 'INR', 'INR', 'INR', 'INR', 'INR', 'INR', 'USD', 'EUR'];
const CUSTOMER_NAMES = [
  'Aarav Patel', 'Priya Sharma', 'Rahul Kumar', 'Ananya Singh', 'Vikram Reddy',
  'Neha Gupta', 'Arjun Mehta', 'Kavya Nair', 'Rohit Joshi', 'Divya Iyer',
  'Manish Verma', 'Pooja Desai', 'Suresh Rao', 'Shreya Pillai', 'Karthik Menon',
  'Deepika Shah', 'Aditya Bhat', 'Meera Kapoor', 'Vivek Tiwari', 'Sanjana Das',
];

function randomAmount(): number {
  // Realistic distribution: mostly small, some medium, few large
  const tier = Math.random();
  if (tier < 0.4) return Math.round(Math.random() * 500 + 50);          // ₹50-550
  if (tier < 0.7) return Math.round(Math.random() * 2000 + 500);        // ₹500-2500
  if (tier < 0.85) return Math.round(Math.random() * 10000 + 2000);     // ₹2000-12000
  if (tier < 0.95) return Math.round(Math.random() * 30000 + 10000);    // ₹10000-40000
  return Math.round(Math.random() * 100000 + 40000);                     // ₹40000-140000
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log('🌱 Seeding 100 transactions...\n');
  
  let successful = 0;
  let failed = 0;
  let flagged = 0;
  const startTime = Date.now();

  for (let i = 0; i < 100; i++) {
    try {
      const customer = randomChoice(CUSTOMER_NAMES);
      const result = await processTransaction({
        amount: randomAmount(),
        currency: randomChoice(CURRENCIES),
        paymentMethod: randomChoice(PAYMENT_METHODS),
        customerId: `CUST-${customer.split(' ')[0].toLowerCase()}-${Math.floor(Math.random() * 1000)}`,
        customerEmail: `${customer.split(' ')[0].toLowerCase()}@example.com`,
        metadata: { source: 'seed_script', batch: 1 },
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      });

      if (result.success) successful++;
      else if (result.transaction.status === 'flagged') flagged++;
      else failed++;

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ ${i + 1}/100 processed (${successful} success, ${failed} failed, ${flagged} flagged)`);
      }
    } catch (err: any) {
      failed++;
      console.error(`  ❌ Transaction ${i + 1} error:`, err.message);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n📊 Seed Results:');
  console.log(`   Total:      100`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed:     ${failed}`);
  console.log(`   Flagged:    ${flagged}`);
  console.log(`   Duration:   ${duration}s`);
  console.log(`   Rate:       ${(100 / parseFloat(duration)).toFixed(0)} txn/s`);
  console.log('\n✅ Seeding complete!');
  
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
