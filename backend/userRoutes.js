const express = require('express');
const router = express.Router();
const { db } = require('./firebaseAdmin');
const verifyFirebaseToken = require('./auth');

// @route   GET /api/users/me
// @desc    Get current user's profile from DB
// @access  Private
router.get('/users/me', verifyFirebaseToken, async (req, res) => {
    try {
        const userRef = db.ref(`users/${req.user.uid}`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ msg: 'User profile not found.' });
        }

        res.json(snapshot.val());
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;