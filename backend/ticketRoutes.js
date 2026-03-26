const express = require('express');
const router = express.Router();
const { db } = require('./firebaseAdmin');
const verifyFirebaseToken = require('./auth');
const { v4: uuidv4 } = require('uuid');

// All routes in this file are protected
router.use(verifyFirebaseToken);

// @route   GET /api/tickets
// @desc    Get all tickets for the current user
// @access  Private
router.get('/tickets', async (req, res) => {
    try {
        const ticketsRef = db.ref('tickets');
        const snapshot = await ticketsRef.orderByChild('userId').equalTo(req.user.uid).once('value');
        
        if (!snapshot.exists()) {
            return res.json([]);
        }
        
        const tickets = [];
        snapshot.forEach(child => {
            tickets.push(child.val());
        });

        res.json(tickets.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/tickets
// @desc    Create a new ticket
// @access  Private
router.post('/tickets', async (req, res) => {
    const { subject, message, orderId } = req.body;
    const { uid, email, name } = req.user;

    if (!subject || !message) {
        return res.status(400).json({ msg: 'Subject and message are required.' });
    }

    const timestamp = Date.now();
    const newTicketRef = db.ref('tickets').push();
    const repliesRef = db.ref(`tickets/${newTicketRef.key}/replies`);
    const newReplyRef = repliesRef.push();

    const ticketData = {
        id: newTicketRef.key,
        userId: uid,
        userEmail: email,
        username: name || email.split('@')[0],
        subject,
        status: 'open',
        orderId: orderId || null,
        timestamp: timestamp,
        replies: {
            [newReplyRef.key]: { sender: 'user', message, timestamp: timestamp }
        }
    };

    try {
        await newTicketRef.set(ticketData);
        res.status(201).json(ticketData);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/tickets/:id/replies
// @desc    Add a reply to a ticket
// @access  Private
router.post('/tickets/:id/replies', async (req, res) => {
    const { message } = req.body;
    const { id } = req.params;
    const { uid } = req.user;

    if (!message) {
        return res.status(400).json({ msg: 'Message is required.' });
    }

    try {
        const ticketRef = db.ref(`tickets/${id}`);
        const snapshot = await ticketRef.once('value');
        if (!snapshot.exists() || snapshot.val().userId !== uid) {
            return res.status(404).json({ msg: 'Ticket not found or access denied.' });
        }

        const replyRef = ticketRef.child('replies').push();
        await replyRef.set({ sender: 'user', message, timestamp: Date.now() });
        await ticketRef.update({ timestamp: Date.now() }); // Bump ticket to top

        res.status(201).json({ msg: 'Reply added.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/tickets/:id
// @desc    Delete a ticket
// @access  Private
router.delete('/tickets/:id', async (req, res) => {
    try {
        const ticketRef = db.ref(`tickets/${req.params.id}`);
        const snapshot = await ticketRef.once('value');
        if (!snapshot.exists() || snapshot.val().userId !== req.user.uid) {
            return res.status(404).json({ msg: 'Ticket not found or access denied.' });
        }
        await ticketRef.remove();
        res.json({ msg: 'Ticket deleted.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;