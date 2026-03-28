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
        // OPTIMIZED: Read from the denormalized /all_orders path instead of iterating all users.
        const ordersRef = db.ref('all_orders');
        const snapshot = await ordersRef.once('value');
        if (!snapshot.exists()) {
            return res.json([]);
        }

        const allOrders = Object.values(snapshot.val());

        // To enrich orders with usernames, we fetch all users once.
        const usersRef = db.ref('users');
        const usersSnapshot = await usersRef.once('value');
        const users = usersSnapshot.val() || {};

        const ordersWithUsername = allOrders.map(order => {
            const userData = users[order.userId] || {};
            return {
                ...order,
                username: userData.username || userData.email || 'Unknown User'
            };
        });

        ordersWithUsername.sort((a, b) => b.timestamp - a.timestamp);
        res.json(ordersWithUsername);
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

        const originalOrder = snapshot.val();
        const updates = {};
        if (status !== undefined) updates.status = status;
        if (link !== undefined) updates.link = link;
        if (utr !== undefined) updates.utr = utr;
        if (cancelledReason !== undefined) updates.cancelledReason = cancelledReason;
        if (cancelledStage !== undefined) updates.cancelledStage = cancelledStage;
        
        // If moving out of cancelled state, clear cancellation reasons
        if (status && status !== 'cancelled') {
            updates.cancelledReason = null;
            updates.cancelledStage = null;
        }

        const updatedOrder = { ...originalOrder, ...updates };

        // Use a multi-path update for atomicity
        const multiPathUpdates = {};
        multiPathUpdates[`users/${userId}/orders/${orderId}`] = updatedOrder;
        multiPathUpdates[`all_orders/${orderId}`] = updatedOrder;

        await db.ref().update(multiPathUpdates);

        res.json({ msg: 'Order updated successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/admin/orders/:userId/:orderId
// @desc    Delete an order
// @access  Admin
router.delete('/orders/:userId/:orderId', async (req, res) => {
    const { userId, orderId } = req.params;
    try {
        // Use a multi-path update to remove from both locations atomically
        const multiPathUpdates = {};
        multiPathUpdates[`users/${userId}/orders/${orderId}`] = null;
        multiPathUpdates[`all_orders/${orderId}`] = null;

        await db.ref().update(multiPathUpdates);
        res.json({ msg: 'Order deleted successfully.' });
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
            return res.json({ totalRevenue: 0, totalProfit: 0, totalOrders: 0, pendingCount: 0, profitAdjustment: 0, openTicketsCount: 0 });
        }

        const users = snapshot.val();
        let totalRevenue = 0;
        let completedRevenue = 0;
        let completedCost = 0;
        let pendingCount = 0;
        let totalOrders = 0;

        const ticketsSnapshot = await db.ref('tickets').once('value');
        let openTicketsCount = 0;
        if (ticketsSnapshot.exists()) {
            ticketsSnapshot.forEach(child => {
                if (child.val().status === 'open') {
                    openTicketsCount++;
                }
            });
        }

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

        // Fetch reset point and manual adjustment
        const metaSnapshot = await db.ref('system/profit_meta').once('value');
        const adjustmentSnapshot = await db.ref('system/profit_adjustment').once('value');

        const { revenueAtReset = 0, costAtReset = 0 } = metaSnapshot.val() || {};
        const profitAdjustment = adjustmentSnapshot.val() || 0;

        const profitForPeriod = (completedRevenue - revenueAtReset) - (completedCost - costAtReset);
        const finalProfit = profitForPeriod + profitAdjustment;

        res.json({ 
            totalRevenue, 
            totalProfit: finalProfit, 
            totalOrders, 
            pendingCount, 
            openTicketsCount,
            profitAdjustment // send manual adjustment value
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/admin/profit/reset
// @desc    Resets the profit calculation point
// @access  Admin
router.post('/profit/reset', async (req, res) => {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        
        let completedRevenue = 0;
        let completedCost = 0;

        if (snapshot.exists()) {
            const users = snapshot.val();
            Object.values(users).forEach(user => {
                if (user.orders) {
                    Object.values(user.orders).forEach(o => {
                        if (o.status === 'completed') {
                            completedRevenue += (parseFloat(o.totalPrice) || 0);
                            if (costPrices[o.service] && costPrices[o.service][o.option] && o.amount) {
                                const unitCost = costPrices[o.service][o.option];
                                completedCost += (parseInt(o.amount) * unitCost);
                            }
                        }
                    });
                }
            });
        }

        const updates = {};
        updates['system/profit_meta'] = { revenueAtReset: completedRevenue, costAtReset: completedCost };
        updates['system/profit_adjustment'] = 0; // Also reset manual adjustments

        await db.ref().update(updates);

        res.json({ msg: 'Profit tracking has been reset.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/admin/users
// @desc    Get all users with aggregated stats
// @access  Admin
router.get('/users', async (req, res) => {
    try {
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        if (!snapshot.exists()) {
            return res.json([]);
        }

        const users = snapshot.val();
        const usersList = Object.keys(users).map(uid => {
            const u = users[uid];
            let spent = 0;
            let count = 0;
            if(u.orders) {
                Object.values(u.orders).forEach(o => {
                    if(o.status !== 'cancelled') spent += (parseFloat(o.totalPrice)||0);
                    count++;
                });
            }
            return { uid, username: u.username, email: u.email, totalSpent: spent, totalOrders: count };
        }).sort((a,b) => b.totalSpent - a.totalSpent);

        res.json(usersList);
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

// --- ADMIN TICKET MANAGEMENT ---

// @route   GET /api/admin/tickets
// @desc    Get all tickets
// @access  Admin
router.get('/tickets', async (req, res) => {
    try {
        const snapshot = await db.ref('tickets').orderByChild('timestamp').once('value');
        if (!snapshot.exists()) return res.json([]);
        
        const tickets = [];
        snapshot.forEach(child => {
            tickets.push({ id: child.key, ...child.val() });
        });

        res.json(tickets.reverse()); // Newest first
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/admin/tickets/:id/replies
// @desc    Reply to a ticket as admin
// @access  Admin
router.post('/tickets/:id/replies', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ msg: 'Message is required.' });

    try {
        const ticketRef = db.ref(`tickets/${req.params.id}`);
        const replyRef = ticketRef.child('replies').push();
        await replyRef.set({ sender: 'admin', message, timestamp: Date.now() });
        await ticketRef.update({ timestamp: Date.now(), status: 'open' }); // Re-open on reply

        res.status(201).json({ msg: 'Reply sent.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/admin/tickets/:id/status
// @desc    Change a ticket's status
// @access  Admin
router.put('/tickets/:id/status', async (req, res) => {
    const { status } = req.body;
    if (status !== 'open' && status !== 'closed') {
        return res.status(400).json({ msg: 'Invalid status.' });
    }
    try {
        await db.ref(`tickets/${req.params.id}`).update({ status });
        res.json({ msg: `Ticket status set to ${status}.` });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/admin/tickets/:id
// @desc    Delete a ticket
// @access  Admin
router.delete('/tickets/:id', async (req, res) => {
    try {
        await db.ref(`tickets/${req.params.id}`).remove();
        res.json({ msg: 'Ticket deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;