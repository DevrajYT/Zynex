const express = require('express');
const router = express.Router();
const { db, auth } = require('./firebaseAdmin');
const { costPrices } = require('./serviceConfig');

// Note: All routes in this file are automatically protected by the admin middleware
// defined in server.js `app.use('/api/admin', verifyFirebaseToken, checkAdmin, adminRoutes);`

// @route   GET /api/admin/orders
// @desc    Get all orders from all users
// @access  Admin
router.get('/orders', async (req, res) => {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        if (!snapshot.exists()) {
            return res.json([]);
        }

        const users = snapshot.val();
        let allOrders = [];

        Object.keys(users).forEach(userId => {
            const userData = users[userId];
            if (userData.orders) {
                Object.values(userData.orders).forEach(order => {
                    allOrders.push({
                        ...order,
                        userId: userId,
                        username: userData.username || userData.email
                    });
                });
            }
        });

        allOrders.sort((a, b) => b.timestamp - a.timestamp);
        res.json(allOrders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/admin/orders/:userId/:orderId
// @desc    Update an order's status or details
// @access  Admin
router.put('/orders/:userId/:orderId', async (req, res) => {
    const { userId, orderId } = req.params;
    const { status, link, utr, cancelledReason, cancelledStage } = req.body;

    if (!userId || !orderId) {
        return res.status(400).json({ msg: 'User ID and Order ID are required.' });
    }

    try {
        const orderRef = db.ref(`users/${userId}/orders/${orderId}`);
        const snapshot = await orderRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ msg: 'Order not found.' });
        }

        const updates = {};
        if (status) updates.status = status;
        if (link) updates.link = link;
        if (utr) updates.utr = utr;
        if (cancelledReason) updates.cancelledReason = cancelledReason;
        if (cancelledStage !== undefined) updates.cancelledStage = cancelledStage;
        
        // If moving out of cancelled state, clear cancellation reasons
        if (status && status !== 'cancelled') {
            updates.cancelledReason = null;
            updates.cancelledStage = null;
        }

        await orderRef.update(updates);
        res.json({ msg: 'Order updated successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Admin
router.get('/stats', async (req, res) => {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        if (!snapshot.exists()) {
            return res.json({ totalRevenue: 0, totalProfit: 0, totalOrders: 0, pendingCount: 0 });
        }

        const users = snapshot.val();
        let totalRevenue = 0;
        let completedRevenue = 0;
        let completedCost = 0;
        let pendingCount = 0;
        let totalOrders = 0;

        Object.values(users).forEach(user => {
            if (user.orders) {
                Object.values(user.orders).forEach(o => {
                    totalOrders++;
                    if (o.status !== 'cancelled') {
                        totalRevenue += (parseFloat(o.totalPrice) || 0);
                    }
                    if (o.status === 'completed') {
                        completedRevenue += (parseFloat(o.totalPrice) || 0);
                        if (costPrices[o.service] && costPrices[o.service][o.option] && o.amount) {
                            const unitCost = costPrices[o.service][o.option];
                            completedCost += (parseInt(o.amount) * unitCost);
                        }
                    }
                    if (['pending', 'processing', 'inprocess'].includes(o.status)) {
                        pendingCount++;
                    }
                });
            }
        });

        const profit = completedRevenue - completedCost;
        res.json({ totalRevenue, totalProfit: profit, totalOrders, pendingCount });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/admin/set-admin
// @desc    Set custom admin claim for a user by email
// @access  Admin
router.post('/set-admin', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ msg: 'Email is required.' });
    }

    try {
        const user = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(user.uid, { admin: true });
        res.json({ msg: `Success! ${email} has been made an admin.` });
    } catch (err) {
        console.error(err.message);
        if (err.code === 'auth/user-not-found') {
            return res.status(404).json({ msg: 'User not found.' });
        }
        res.status(500).send('Server Error');
    }
});


module.exports = router;