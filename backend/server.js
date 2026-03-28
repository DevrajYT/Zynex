require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // Import path module
const fs = require('fs');     // Import fs module
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

// --- Serve Static Frontend Files ---
// This middleware serves files from the 'frontend' directory.
// It will automatically serve 'index.html' for requests to the root '/'.
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Custom Middleware for Extensionless HTML Files ---
// This middleware rewrites requests for paths like '/services' to serve 'services.html'.
// It's placed after static middleware to allow .css, .js files to be served first.
app.use((req, res, next) => {
    // Skip API calls and files that already have an extension.
    if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
    }

    // Normalize the path: remove trailing slash, handle root path.
    let requestedPath = req.path;
    if (requestedPath.length > 1 && requestedPath.endsWith('/')) {
        requestedPath = requestedPath.slice(0, -1);
    }

    // If the request is for the root, map it to /index.
    if (requestedPath === '/') {
        requestedPath = '/index';
    }

    const htmlFilePath = path.join(__dirname, '../frontend', requestedPath + '.html');

    // Check if the corresponding .html file exists.
    fs.access(htmlFilePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File not found, fall through to the next middleware (the 404 handler).
            return next();
        }
        // File found, send it.
        res.sendFile(htmlFilePath);
    });
});

// --- API Routes ---
// Health check route moved here to be part of the API.
app.get('/api/health', (req, res) => {
    res.status(200).send('Zynex Backend is healthy!');
});
app.use('/api', userRoutes);
app.use('/api', orderRoutes);
app.use('/api', ticketRoutes);

// Admin routes are protected by both auth and admin checks
app.use('/api/admin', verifyFirebaseToken, checkAdmin, adminRoutes);


// --- 404 Handler ---
// This will catch any request that hasn't been handled by the routes above.
app.use((req, res, next) => {
    // You can create a frontend/404.html file for a custom page.
    res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'), (err) => {
        // Fallback if 404.html doesn't exist
        if (err) res.status(404).send("404: Page Not Found");
    });
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