import axios from "axios";
import admin from "firebase-admin";

const API =
  "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json";

const FIREBASE_URL =
  "https://ansh-f37e0-default-rtdb.firebaseio.com/";

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.database();
  }

  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT secret missing");
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: FIREBASE_URL
  });

  return admin.database();
}

async function collectOnce() {
  const db = initializeFirebase();

  console.log("Fetching WinGo history...");

  const response = await axios.get(API, {
    params: {
      ts: Date.now()
    },
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      "Referer": "https://draw.ar-lottery01.com/",
      "Origin": "https://draw.ar-lottery01.com"
    }
  });

  const records = response.data?.data?.list;

  if (!Array.isArray(records)) {
    throw new Error("Invalid WinGo API response");
  }

  let inserted = 0;
  let alreadyPresent = 0;
  let skipped = 0;

  for (const record of records) {
    const issue = String(record.issueNumber ?? "");

    if (!issue || record.number === undefined) {
      skipped++;
      continue;
    }

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
    `Collection complete: ${records.length} received, ${inserted} inserted, ${alreadyPresent} already present, ${skipped} skipped`
  );
}

collectOnce()
  .then(() => {
    console.log("Collector finished successfully.");
    process.exit(0);
  })
  .catch(error => {
    console.error(
      "Collection failed:",
      error.response?.status || error.message
    );

    if (error.response?.status) {
      console.error("API response:", error.response.data);
    }

    process.exit(1);
  });
