const admin = require('firebase-admin');

try {
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error("FIREBASE_PRIVATE_KEY is missing. Please check your .env file.");
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace newlines characters from the environment variable
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://zegrow-e1a2c-default-rtdb.firebaseio.com` // From your firebase-init.js
  });

  console.log("Firebase Admin SDK initialized successfully.");

} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}

const db = admin.database();
const auth = admin.auth();

module.exports = { admin, db, auth };