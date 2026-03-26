const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('./firebaseAdmin');
const verifyFirebaseToken = require('./auth');
const { serviceConfig } = require('./serviceConfig');

// @route   GET /api/services
// @desc    Get available services and prices
// @access  Public
router.get('/services', (req, res) => {
    // Return the service configuration to the frontend
    res.json(serviceConfig);
});

// @route   GET /api/orders
// @desc    Get all orders for the authenticated user
// @access  Private
router.get('/orders', verifyFirebaseToken, async (req, res) => {
    try {
        const ordersRef = db.ref(`users/${req.user.uid}/orders`);
        const snapshot = await ordersRef.once('value');
        const orders = snapshot.val() || {};
        res.json(Object.values(orders).sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/orders', verifyFirebaseToken, async (req, res) => {
    const { service, option, link, amount, utr } = req.body;
    const { uid } = req.user;

    // --- Validation ---
    if (!service || !option || !link || !amount || !utr) {
        return res.status(400).json({ msg: 'Please provide all required fields: service, option, link, amount, utr.' });
    }
    if (utr.length !== 12 || !/^[a-zA-Z0-9]+$/.test(utr)) {
        return res.status(400).json({ msg: 'Invalid UTR ID. It must be exactly 12 alphanumeric characters.' });
    }

    // --- Price Calculation (Backend) ---
    const serviceData = serviceConfig[service.toLowerCase()];
    if (!serviceData) {
        return res.status(400).json({ msg: 'Invalid service selected.' });
    }

    const optionData = serviceData.options.find(opt => opt.name === option);
    if (!optionData || optionData.disabled) {
        return res.status(400).json({ msg: 'Invalid option selected.' });
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0 || !Number.isInteger(numAmount)) {
        return res.status(400).json({ msg: 'Invalid amount. Must be a positive integer.' });
    }

    if ((optionData.min && numAmount < optionData.min) || (optionData.max && numAmount > optionData.max)) {
        return res.status(400).json({ msg: `Amount must be between ${optionData.min} and ${optionData.max}.` });
    }

    // --- UTR Uniqueness Check ---
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    let utrExists = false;
    if (snapshot.exists()) {
        snapshot.forEach(userSnapshot => {
            const orders = userSnapshot.child('orders').val();
            if (orders) {
                for (const orderId in orders) {
                    // Check if UTR matches and the order wasn't cancelled (cancelled orders can have their UTR reused)
                    if (orders[orderId].utr === utr && orders[orderId].status !== 'cancelled') {
                        utrExists = true;
                        return true; // break from forEach
                    }
                }
            }
            if (utrExists) return true; // break from outer forEach
        });
    }

    if (utrExists) {
        return res.status(400).json({ msg: 'This UTR ID has already been used for a valid order.' });
    }

    const totalPrice = Math.ceil(numAmount * optionData.price);

    // --- Create Order Object ---
    const orderId = uuidv4();
    const newOrder = {
        id: orderId,
        service: serviceData.title,
        option: optionData.name,
        link,
        amount: numAmount,
        totalPrice,
        utr,
        status: 'pending', // Initial status
        timestamp: Date.now(),
        userId: uid, // Keep a reference to the user ID
    };

    try {
        // Save to Realtime Database
        const orderRef = db.ref(`users/${uid}/orders/${orderId}`);
        await orderRef.set(newOrder);

        res.status(201).json({ msg: 'Order placed successfully! We will verify your payment shortly.', order: newOrder });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;