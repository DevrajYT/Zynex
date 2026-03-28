require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Initialize Firebase Admin
require('./firebaseAdmin');

// Middleware
const verifyFirebaseToken = require('./auth');
const checkAdmin = require('./admin');

// Route Imports
const userRoutes = require('./userRoutes');
const orderRoutes = require('./orderRoutes');
const ticketRoutes = require('./ticketRoutes');
const adminRoutes = require('./adminRoutes');
const giveawayRoutes = require('./giveawayRoutes');

const app = express();

// --- Middlewares ---
app.use(helmet()); // Secure HTTP headers

// Rate Limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Restrict to Netlify domain in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json()); // To parse JSON bodies

// --- API Routes ---
app.use('/api', userRoutes);
app.use('/api', orderRoutes);
app.use('/api', ticketRoutes);
app.use('/api/giveaway', giveawayRoutes);

// Admin routes are protected by both auth and admin checks
app.use('/api/admin', verifyFirebaseToken, checkAdmin, adminRoutes);


// --- Health Check Route ---
app.get('/', (req, res) => {
    res.send('Smmzynex Backend is running!');
});

// --- Server Listening ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('--------------------------------------------------');
    console.log('IMPORTANT: To set the first admin user, run the following command in your terminal:');
    console.log('firebase auth:set-custom-claims <uid_of_user> --claims=\'{"admin":true}\'');
    console.log('You can get the UID from the Firebase Authentication console.');
    console.log('You must have the Firebase CLI installed and be logged in (`firebase login`).');
    console.log('--------------------------------------------------');
});