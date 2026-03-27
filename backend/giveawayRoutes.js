const express = require('express');
const router = express.Router();
const { db } = require('./firebaseAdmin');

// @route   GET /api/giveaway/active
// @desc    Get all active giveaways for users
// @access  Authenticated User (or Public if verifyFirebaseToken is not applied)
router.get('/active', async (req, res) => {
    try {
        const snapshot = await db.ref('giveaways').orderByChild('active').equalTo(true).once('value');
        if (!snapshot.exists()) {
            return res.json([]);
        }
        const giveaways = [];
        snapshot.forEach(child => {
            const giveaway = child.val();
            // Only return necessary public info
            giveaways.push({
                id: child.key,
                title: giveaway.title,
                prize: giveaway.prize,
                image: giveaway.image,
                description: giveaway.description,
                rules: giveaway.rules,
                endDate: giveaway.endDate,
                winnersCount: giveaway.winnersCount,
                // Do not expose sensitive admin-only fields like createdAt, updatedAt
            });
        });
        res.json(giveaways);
    } catch (err) {
        console.error('Error fetching active giveaways:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/giveaway/enter
// @desc    User enters a giveaway
// @access  Authenticated User
router.post('/enter', async (req, res) => {
    const { giveawayId, instagramHandle } = req.body;
    const userId = req.user.uid; // From verifyFirebaseToken middleware

    if (!giveawayId || !instagramHandle) {
        return res.status(400).json({ msg: 'Giveaway ID and Instagram handle are required.' });
    }

    try {
        const giveawayRef = db.ref(`giveaways/${giveawayId}`);
        const giveawaySnapshot = await giveawayRef.once('value');

        if (!giveawaySnapshot.exists() || !giveawaySnapshot.val().active) {
            return res.status(404).json({ msg: 'Giveaway not found or not active.' });
        }

        const entryRef = db.ref(`giveawayEntries/${giveawayId}/${userId}`);
        const existingEntry = await entryRef.once('value');

        if (existingEntry.exists()) {
            return res.status(409).json({ msg: 'You have already entered this giveaway.' });
        }

        const userRef = db.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');
        const userData = userSnapshot.val();
        const username = userData.username || userData.email; // Fallback to email if username not set

        await entryRef.set({
            userId: userId,
            username: username,
            instagramHandle: instagramHandle,
            timestamp: Date.now()
        });

        res.json({ msg: 'Successfully entered the giveaway!' });
    } catch (err) {
        console.error('Error entering giveaway:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;