import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const nowSec = Math.floor(Date.now() / 1000);
const RAW_CUTOFF   = nowSec - 90  * 24 * 3600; // 3 months
const AGG30_CUTOFF = nowSec - 365 * 24 * 3600; // 12 months

function floorTo(ts, seconds) {
  return Math.floor(ts / seconds) * seconds;
}

async function rollupTier({ srcCol, dstCol, cutoff, windowSec, label }) {
  const snap = await db.collection(srcCol).where('timestamp', '<', cutoff).get();
  if (snap.empty) return { rolled: 0, deleted: 0 };

  const windows = new Map();
  for (const doc of snap.docs) {
    const d = doc.data();
    const key = floorTo(d.timestamp, windowSec);
    if (!windows.has(key)) windows.set(key, { docs: [], fields: { temperature: 0, humidity: 0, light: 0, sound: 0, dust: 0 } });
    const w = windows.get(key);
    w.docs.push(doc.ref);
    for (const f of ['temperature', 'humidity', 'light', 'sound', 'dust']) {
      w.fields[f] += d[f];
    }
  }

  // Writes first (crash-safe)
  let writeBatch = db.batch();
  let writeCount = 0;
  for (const [windowStart, w] of windows) {
    const n = w.docs.length;
    const avg = {};
    for (const f of ['temperature', 'humidity', 'light', 'sound', 'dust']) {
      avg[f] = w.fields[f] / n;
    }
    writeBatch.set(db.collection(dstCol).doc(String(windowStart)), {
      timestamp: windowStart,
      ...avg,
      count: n,
    }, { merge: true });
    writeCount++;
    if (writeCount % 499 === 0) {
      await writeBatch.commit();
      writeBatch = db.batch();
    }
  }
  await writeBatch.commit();

  // Deletes in batches of 500
  const allRefs = snap.docs.map(d => d.ref);
  for (let i = 0; i < allRefs.length; i += 500) {
    const batch = db.batch();
    allRefs.slice(i, i + 500).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  return { rolled: windows.size, deleted: allRefs.length };
}

try {
  const r1 = await rollupTier({ srcCol: 'raw', dstCol: 'agg_30m', cutoff: RAW_CUTOFF,   windowSec: 1800, label: 'raw→agg_30m' });
  const r2 = await rollupTier({ srcCol: 'agg_30m', dstCol: 'agg_1h', cutoff: AGG30_CUTOFF, windowSec: 3600, label: 'agg_30m→agg_1h' });
  console.log(`rolled up ${r1.deleted} raw → ${r1.rolled} agg_30m, ${r2.deleted} agg_30m → ${r2.rolled} agg_1h`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
