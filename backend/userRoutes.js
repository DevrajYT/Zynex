const express = require('express');
const router = express.Router();
const { db, auth } = require('./firebaseAdmin');
const verifyFirebaseToken = require('./auth');

// @route   GET /api/system/announcement
// @desc    Get global announcement
// @access  Public
router.get('/system/announcement', async (req, res) => {
    try {
        const snap = await db.ref('system/announcement').once('value');
        res.json({ message: snap.val() || '' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// All routes below are protected
router.use(verifyFirebaseToken);

// @route   GET /api/users/me
// @desc    Get current user's profile from DB
// @access  Private
router.get('/users/me', async (req, res) => {
    try {
        const userRef = db.ref(`users/${req.user.uid}`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ msg: 'User profile not found.' });
        }

        const profileData = snapshot.val();
        profileData.isAdmin = !!req.user.admin; // Add admin status from token claim
        res.json(profileData);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/users/me
// @desc    Update current user's profile (username, photoURL, settings)
// @access  Private
router.put('/users/me', async (req, res) => {
    const { username, photoURL, settings } = req.body;
    const { uid } = req.user;

    try {
        const updates = {};
        const authUpdates = {};

        if (username) {
            updates.username = username;
            authUpdates.displayName = username;
        }
        if (photoURL) {
            updates.photoURL = photoURL;
            authUpdates.photoURL = photoURL;
        }
        if (settings) updates.settings = settings;

        await db.ref(`users/${uid}`).update(updates);
        if (Object.keys(authUpdates).length > 0) await auth.updateUser(uid, authUpdates);

        res.json({ msg: 'Profile updated successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;