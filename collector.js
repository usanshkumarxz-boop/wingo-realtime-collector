
import axios from "axios";
import admin from "firebase-admin";

const API =
  "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json";

const FIREBASE_URL =
  "https://ansh-f37e0-default-rtdb.firebaseio.com/";

function initializeFirebase() {
  if (admin.apps.length) return admin.database();

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: FIREBASE_URL
  });

  return admin.database();
}

async function collectOnce() {
  const db = initializeFirebase();

  const response = await axios.get(API, {
    params: { ts: Date.now() },
    timeout: 20000
  });

  const records = response.data?.data?.list;

  if (!Array.isArray(records)) {
    throw new Error("Invalid WinGo API response");
  }

  let inserted = 0;
  let alreadyPresent = 0;

  for (const record of records) {
    const issue = String(record.issueNumber ?? "");

    if (!issue || record.number === undefined) continue;

    const ref = db.ref(`wingo_db/history/${issue}`);

    const result = await ref.transaction(
      current => current === null ? record : undefined
    );

    if (result.committed) {
      inserted++;
    } else {
      alreadyPresent++;
    }
  }

  console.log(
    `Collection complete: ${records.length} received, ${inserted} inserted, ${alreadyPresent} already present`
  );
}

collectOnce()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Collection failed:", error.message);
    process.exit(1);
  });
