require('dotenv').config(); // Load your environment variables
const { auth } = require('./firebaseAdmin'); // Load your existing Firebase Admin setup

// Get the UID from the command line arguments
const uid = process.argv[2];

if (!uid) {
    console.error('❌ Please provide a User UID.');
    console.error('Usage: node setAdmin.js <USER_UID>');
    process.exit(1);
}

// Set the custom claim
auth.setCustomUserClaims(uid, { admin: true })
    .then(() => {
        console.log(`✅ Success! The user with UID ${uid} is now an admin.`);
        console.log('Please log out and log back into the website to apply the changes.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error setting admin claim:', error);
        process.exit(1);
    });
