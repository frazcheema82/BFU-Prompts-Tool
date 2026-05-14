import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const users = await getDocs(collection(db, 'users'));
  console.log('users count:', users.size);
  const keys = await getDocs(collection(db, 'api_keys'));
  console.log('api_keys count:', keys.size);
  const allowed = await getDocs(collection(db, 'allowed_users'));
  console.log('allowed_users count:', allowed.size);
  process.exit(0);
}
run();
