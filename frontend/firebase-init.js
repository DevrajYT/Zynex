import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, get, push, remove, update, onValue, onChildChanged, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";



const firebaseConfig = {
    apiKey: "AIzaSyCsRNY7t-36dIsqk8ZyDr_0vIPdRzKD6fQ",
    authDomain: "zegrow-e1a2c.firebaseapp.com",
    databaseURL: "https://zegrow-e1a2c-default-rtdb.firebaseio.com",
    projectId: "zegrow-e1a2c",
    storageBucket: "zegrow-e1a2c.firebasestorage.app",
    messagingSenderId: "516126874416",
    appId: "1:516126874416:web:8f70f792171441863786f5"
};

// --- CONFIGURATION ---
// window.BACKEND_URL = "http://localhost:10000"; // Local Testing
window.BACKEND_URL = "https://zynex-backend.onrender.com"; // Render Testing

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

window.isUserLoggedIn = () => auth.currentUser;

const provider = new GoogleAuthProvider();


// ================= GOOGLE LOGIN =================
window.googleLogin = function () {
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;

            // Check if user exists to avoid overwriting data (orders/custom username)
            get(ref(database, "users/" + user.uid)).then((snapshot) => {
                if (!snapshot.exists()) {
                    set(ref(database, "users/" + user.uid), {
                        username: user.displayName,
                        email: user.email,
                    });
                }
            });

            showAlert("Signed in with Google!", "Success");
            closeLogin();
            closeRegister();
        })
        .catch((error) => {
            showAlert(error.message, "Login Error");
        });
};

// ================= REGISTER =================
window.registerUser = function () {
    clearInlineErrors();
    const username = document.getElementById("reg-user").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-pass").value;
    const confirmPassword = document.getElementById("reg-pass2").value;

    let hasError = false;
    if(!username) { showInlineError('error-reg-user', 'Username is required'); hasError = true; }
    if(!email) { showInlineError('error-reg-email', 'Email is required'); hasError = true; }
    if(!password) { showInlineError('error-reg-pass', 'Password is required'); hasError = true; }
    if(password !== confirmPassword) { showInlineError('error-reg-pass2', 'Passwords do not match'); hasError = true; }
    else if(password && password.length < 6) { showInlineError('error-reg-pass', 'Password must be at least 6 characters'); hasError = true; }

    if (hasError) {
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            updateProfile(user, { displayName: username }).then(() => {
                set(ref(database, "users/" + user.uid), {
                    username: username,
                    email: email,
                });

                showAlert("Registration successful!", "Welcome");
                closeRegister();
            // No longer need to reload; onAuthStateChanged will handle the UI update.
            });
        })
        .catch((error) => {
            showInlineError('error-reg-general', error.message);
        });
};



// ================= LOGIN =================
window.loginUser = function () {
    clearInlineErrors();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-pass").value;

    if(!email) { showInlineError('error-login-email', 'Email is required'); return; }
    if(!password) { showInlineError('error-login-pass', 'Password is required'); return; }

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            showAlert("Login successful!", "Welcome Back");
            closeLogin();
        })
        .catch((error) => {
            // Generic error for security, or specific error.message
            showInlineError('error-login-general', "Invalid email or password.");
        });
};

// ================= AUTH STATE LISTENER =================
onAuthStateChanged(auth, (user) => {
    const headerAuth = document.getElementById("headerAuthArea");
    const profileSection = document.getElementById("profileSection");
    const notLoggedInProfile = document.querySelector(".not-logged-in");
    const dashboardContent = document.getElementById('dashboard-content');
    const loggedOutContent = document.getElementById('logged-out-content');
    const ordersContent = document.getElementById('orders-content');
    const loggedOutOrders = document.getElementById('logged-out-orders');
    const adminSectionTitle = document.getElementById("admin-section-title");
    const adminNavList = document.getElementById("admin-nav-list");
    const announcementContainer = document.getElementById("announcement-container");

    if (user) {
        // --- Logged-in UI State ---
        if (headerAuth) {
            const username = user.displayName || user.email.split("@")[0];
            headerAuth.innerHTML = `
      <div class="header-user" onclick="window.location.href='account'">
          <ion-icon name="person-outline"></ion-icon>
          <span>${sanitize(username)}</span>
      </div>`;
        }
        if (dashboardContent) dashboardContent.style.display = 'block';
        if (loggedOutContent) loggedOutContent.style.display = 'none';
        if (profileSection) profileSection.style.display = 'block';
        if (notLoggedInProfile) notLoggedInProfile.style.display = 'none';
        if (ordersContent) ordersContent.style.display = 'block';
        if (loggedOutOrders) loggedOutOrders.style.display = 'none';

        // --- Admin Check ---
        // IMPORTANT: Rely on custom claims from the ID token, not a hardcoded list.
        user.getIdTokenResult().then((idTokenResult) => {
            if (idTokenResult.claims.admin) {
                if(adminSectionTitle) adminSectionTitle.style.display = "block";
                if(adminNavList) adminNavList.style.display = "flex";
                setupAdminRealtimeListeners(); // Start listening for red dots

                // --- Load Admin Dashboard if on admin page ---
                if (document.getElementById('admin-orders-body')) {
                    loadAdminDashboard(user);
                }
            } else {
                if(adminSectionTitle) adminSectionTitle.style.display = "none";
                if(adminNavList) adminNavList.style.display = "none";
            }
        });


        // --- Fetch Announcement ---
        get(ref(database, 'system/announcement')).then((snap) => {
            if (snap.exists() && snap.val() && announcementContainer) {
                announcementContainer.innerHTML = `
                    <div class="announcement-bar">
                        <ion-icon name="megaphone-outline" style="font-size:24px"></ion-icon>
                        <span>${sanitize(snap.val())}</span>
                    </div>`;
            }
        });

        // --- Setup User Notifications ---
        setupUserNotifications(user);

        // --- Fetch data from DB and update UI ---
        const userRef = ref(database, "users/" + user.uid);
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const orders = data.orders || {};
                window.userOrders = orders; // Store orders for popup access

                // == New Logic: Review prompt on Orders Page Load ==
                const isOrdersPage = window.location.pathname.includes('/orders');
                if (isOrdersPage) {
                    const promptedOrdersKey = `zynex_review_prompted_orders_${user.uid}`;
                    const promptedOrders = JSON.parse(localStorage.getItem(promptedOrdersKey) || '[]');

                    // Find the most recent completed order that has NOT been prompted for review
                    const unpromptedOrder = Object.values(orders)
                        .filter(o => o.status === 'completed' && !promptedOrders.includes(o.id))
                        .sort((a, b) => b.timestamp - a.timestamp)[0]; // Get the newest one

                    if (unpromptedOrder) {
                        // Add this order to the prompted list so we don't ask again
                        promptedOrders.push(unpromptedOrder.id);
                        localStorage.setItem(promptedOrdersKey, JSON.stringify(promptedOrders));

                        // Open the popup after a short delay for a better user experience
                        setTimeout(() => {
                            if (window.openReviewPopup) window.openReviewPopup();
                        }, 2000);
                    }
                }

                const totalOrders = Object.keys(orders).length;
                // == Update Header with DB username ==
                if (headerAuth && data.username) {
                    const span = headerAuth.querySelector('span');
                    if(span) span.innerText = sanitize(data.username);
                }
                
                let totalSpent = 0;
                Object.values(orders).forEach(order => {
                    if (order.status !== 'cancelled') {
                        totalSpent += (parseFloat(order.totalPrice) || 0);
                    }
                });

                // == Update Dashboard Page ==
                const dashboardUsername = document.getElementById('dashboard-username');
                if (dashboardUsername) dashboardUsername.innerText = sanitize(user.displayName || data.username);
                const dashboardOrdersEl = document.getElementById('dashboard-orders');
                if (dashboardOrdersEl) dashboardOrdersEl.innerText = totalOrders;
                const dashboardSpentEl = document.getElementById('dashboard-spent');
                if (dashboardSpentEl) dashboardSpentEl.innerText = `₹${totalSpent.toFixed(2)}`;

                // == Update Account Page ==
                const imgEl = document.getElementById("profileImage");
                const iconEl = document.getElementById("defaultProfileIcon");
                
                if (user.photoURL) {
                    if (imgEl) { imgEl.src = user.photoURL; imgEl.style.display = "block"; }
                    if (iconEl) iconEl.style.display = "none";
                } else {
                    if (imgEl) { imgEl.style.display = "none"; }
                    if (iconEl) iconEl.style.display = "block";
                }
                const profileNameEl = document.getElementById("profileName");
                if (profileNameEl) profileNameEl.innerText = sanitize(user.displayName || data.username);
                const profileEmailEl = document.getElementById("profileEmail");
                if (profileEmailEl) profileEmailEl.innerText = user.email;
                const profileUIDEl = document.getElementById("profileUID");
                if (profileUIDEl) profileUIDEl.innerText = user.uid;
                const profileTotalOrdersEl = document.getElementById('profileTotalOrders');
                if (profileTotalOrdersEl) profileTotalOrdersEl.innerText = totalOrders;
                const profileTotalSpentEl = document.getElementById('profileTotalSpent');
                if (profileTotalSpentEl) profileTotalSpentEl.innerText = `₹${totalSpent.toFixed(2)}`;
                
                const profileJoinedEl = document.getElementById('profileJoined');
                if (profileJoinedEl && user.metadata.creationTime) profileJoinedEl.innerText = new Date(user.metadata.creationTime).toLocaleDateString();
                const profileLastLoginEl = document.getElementById('profileLastLogin');
                if (profileLastLoginEl && user.metadata.lastSignInTime) profileLastLoginEl.innerText = new Date(user.metadata.lastSignInTime).toLocaleString();

                // == Load User Settings ==
                if (data.settings) {
                    for (const [key, val] of Object.entries(data.settings)) {
                        const el = document.getElementById(key);
                        if (el && el.type === 'checkbox') el.checked = val;
                        // Sync local storage
                        localStorage.setItem('zynex_setting_' + key, val);
                    }
                }

                // == Update Orders Page ==
                const ordersTableBody = document.getElementById('orders-table-body');
                const noOrdersMsg = document.getElementById('no-orders-msg');
                const fullOrdersTable = document.getElementById('full-orders-table');

                if (ordersTableBody) {
                    const orderList = Object.values(orders).sort((a, b) => b.timestamp - a.timestamp);
                    
                    if (orderList.length === 0) {
                        if (fullOrdersTable) fullOrdersTable.style.display = 'none';
                        if (noOrdersMsg) noOrdersMsg.style.display = 'block';
                    } else {
                        if (fullOrdersTable) fullOrdersTable.style.display = 'table';
                        if (noOrdersMsg) noOrdersMsg.style.display = 'none';
                        ordersTableBody.innerHTML = '';
                        
                        orderList.forEach(order => {
                            const date = new Date(order.timestamp).toLocaleDateString();
                            const statusClass = order.status === 'completed' ? 'status-completed' : 'status-pending';
                            const statusText = order.status === 'pending' ? 'In process' : order.status.charAt(0).toUpperCase() + order.status.slice(1);
                            
                            const row = `
                                <tr>
                                    <td style="font-family:monospace; color:#666; font-size:0.85rem">#${order.id ? order.id.slice(-6) : '---'}</td>
                                    <td>
                                        <div style="font-weight:600">${order.service}</div>
                                        <small style="color:#888">${order.option}</small>
                                    </td>
                                    <td>
                                        <div style="position:relative; display:flex; justify-content:center;">
                                            <button class="copy-btn" onclick="copyToClipboard('${order.link}', this)" title="Copy Link"><ion-icon name="copy-outline"></ion-icon></button>
                                            <span style="display:none; position:absolute; top:34px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; z-index:10; pointer-events:none;">Copied!</span>
                                        </div>
                                    </td>
                                    <td>${order.amount}</td>
                                    <td style="font-weight:600">₹${order.totalPrice}</td>
                                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                                    <td style="color:#888; font-size:0.85rem">${date}</td>
                                    <td><button class="view-btn" onclick="openOrderDetails('${order.id}')">View Details</button></td>
                                </tr>
                            `;
                            ordersTableBody.insertAdjacentHTML('beforeend', row);
                        });
                    }
                }

                // == Update Dashboard Recent Orders ==
                const recentOrdersBody = document.getElementById('recent-orders-body');
                if (recentOrdersBody) {
                    const recentOrderList = Object.values(orders).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
                    if (orderList.length > 0) {
                        recentOrdersBody.innerHTML = '';
                        recentOrderList.forEach(order => {
                            const date = new Date(order.timestamp).toLocaleDateString();
                            const statusClass = order.status === 'completed' ? 'status-completed' : 'status-pending';
                            const statusText = order.status === 'pending' ? 'In process' : order.status.charAt(0).toUpperCase() + order.status.slice(1);
                            
                            const row = `
                                <tr>
                                    <td>
                                        <div style="font-weight:600">${order.service}</div>
                                        <small style="color:#888">${order.option}</small>
                                    </td>
                                    <td style="color:#888; font-size:0.9rem">${date}</td>
                                    <td style="font-weight:600">₹${order.totalPrice}</td>
                                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                                </tr>
                            `;
                            recentOrdersBody.insertAdjacentHTML('beforeend', row);
                        });
                    }
                }
            }
        });
    } else {
        // --- Logged-out UI State ---
        if (headerAuth) {
            headerAuth.innerHTML = `
      <button class="get-started-btn" onclick="window.location.href='account?login=true'">
        Login
      </button>`;
        }
        if (dashboardContent) dashboardContent.style.display = 'none';
        if (loggedOutContent) loggedOutContent.style.display = 'block';
        if (profileSection) profileSection.style.display = 'none';
        if (notLoggedInProfile) notLoggedInProfile.style.display = 'block';
        if (ordersContent) ordersContent.style.display = 'none';
        if (loggedOutOrders) loggedOutOrders.style.display = 'block';
        if (adminSectionTitle) adminSectionTitle.style.display = "none";
        if (adminNavList) adminNavList.style.display = "none";

        // Redirect if on admin page and logged out
        if (document.getElementById('admin-orders-body')) {
            window.location.href = 'account';
        }
    }
    
    // Refresh Giveaway Page state dynamically on login/logout
    if (window.location.pathname.includes('/giveaway') && window.loadGiveawayPage) {
        window.loadGiveawayPage();
    }
    
    checkGiveawayWinners(user);
});


// ================= LOGOUT =================
window.logoutUser = function () {
    signOut(auth)
        .then(() => {
            // showAlert("Logged out successfully"); // Optional, reload handles it
            window.location.reload();
        })
        .catch((error) => {
            showAlert(error.message, "Error");
        });
};


// Edit Username
window.editUsername = function () {
    showPrompt("Enter your new username:", (newName) => {
        const user = auth.currentUser;
        if (user) {
            updateProfile(user, { displayName: newName }).then(() => {
                // Also update in Database to ensure consistency
                update(ref(database, "users/" + user.uid), { username: newName })
                    .then(() => location.reload());
            }).catch(err => showAlert(err.message, "Error"));
        }
    });
};

window.handleChangePassword = function() {
    clearInlineErrors();
    const oldPass = document.getElementById('cp-old').value;
    const newPass = document.getElementById('cp-new').value;
    const confirmPass = document.getElementById('cp-confirm').value;

    let hasError = false;
    if(!oldPass) { showInlineError('error-cp-old', 'Old password is required'); hasError = true; }
    if(!newPass) { showInlineError('error-cp-new', 'New password is required'); hasError = true; }
    if(newPass.length < 6) { showInlineError('error-cp-new', 'Password must be at least 6 characters'); hasError = true; }
    if(newPass !== confirmPass) { showInlineError('error-cp-confirm', 'Passwords do not match'); hasError = true; }

    if(hasError) return;

    const user = auth.currentUser;
    if(!user) return;

    const credential = EmailAuthProvider.credential(user.email, oldPass);

    reauthenticateWithCredential(user, credential).then(() => {
        updatePassword(user, newPass).then(() => {
            showAlert("Password updated successfully!", "Success");
            closePopup('.change-password-popup');
        }).catch(err => showInlineError('error-cp-new', err.message));
    }).catch(err => {
        showInlineError('error-cp-old', "Incorrect old password.");
    });
};

window.deleteAccount = function() {
    showConfirm("Are you sure you want to delete your account? This action cannot be undone.", () => {
        const user = auth.currentUser;
        deleteUser(user).then(() => {
            showAlert("Account deleted.", "Goodbye");
            window.location.href = "/";
        }).catch(e => showAlert("Error: " + e.message + "\n(You may need to re-login to perform this action)"));
    });
};

window.toggleTheme = function(isDark) {
    if(isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('zynex_dark_mode', isDark);
};

window.toggleCompact = function(isCompact) {
    if(isCompact) document.body.classList.add('compact-view');
    else document.body.classList.remove('compact-view');
    localStorage.setItem('zynex_compact_view', isCompact);
};

window.saveSetting = function(key, value) {
    localStorage.setItem('zynex_setting_' + key, value);
    
    const user = auth.currentUser;
    if(user) {
        update(ref(database, `users/${user.uid}/settings`), { [key]: value });
    }
};

// Load settings on init
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('zynex_dark_mode') === 'true') document.body.classList.add('dark-mode');
    if(localStorage.getItem('zynex_compact_view') === 'true') document.body.classList.add('compact-view');

    loadPublicReviews();

    // Check for login query param to auto-open login popup
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => { if(window.openLogin) window.openLogin(); }, 300);
    }
});

// ================= ORDER SYSTEM =================
window.submitOrderToDB = async function(orderData, onSuccess, onError) {
    const user = auth.currentUser;
    if (!user) {
        onError("You must be logged in to place an order.");
        return;
    }

    try {
        const token = await user.getIdToken();
        const response = await fetch(`${BACKEND_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || 'Order failed');

        onSuccess(data.order.id);
    } catch (error) {
        console.error(error);
        onError(error.message);
    }
};

// ================= ORDER POPUP FLOW =================

// Global state for the order process
let currentOrder = {
    service: null,
    option: null,
    price: 0,
    min: 0,
    max: 0
};

// Hardcoded Service Config for instant loading
// NOTE: Please adjust these prices/names to match your backend's serviceConfig.js exactly!
const LOCAL_SERVICE_CONFIG = {
    instagram: {
        title: "Instagram",
        options: [
            { name: "Followers", price: 0.4, icon: "people-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.05, icon: "heart-outline", min: 100, max: 100000 },
            { name: "Views", price: 0.01, icon: "eye-outline", min: 100, max: 1000000 },
            { name: "Comments", price: 0.5, icon: "chatbubble-outline", min: 50, max: 50000 },
            { name: "Reel Repost", price: 0.3, icon: "repeat-outline", min: 10, max: 1000 },
            { name: "Reel Save", price: 0.1, icon: "bookmark-outline", min: 10, max: 100000 },
            { name: "Reel Share", price: 0.2, icon: "share-social-outline", min: 10, max: 100000 },
            { name: "Story Views", price: 0.05, icon: "aperture-outline", min: 100, max: 10000 }
        ]
    },
    youtube: {
        title: "YouTube",
        options: [
            { name: "Subscribers", price: 4.0, icon: "person-add-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.2, icon: "thumbs-up-outline", min: 50, max: 10000 },
            { name: "Views", price: 0.7, icon: "play-circle-outline", min: 100, max: 100000 },
            { name: "Comment Likes", price: 0.030, icon: "heart-circle-outline", min: 100, max: 100000 }
        ]
    },
    facebook: {
        title: "Facebook",
        options: [
            { name: "Followers", price: 0.4, icon: "people-outline", min: 10, max: 10000 },
            { name: "Likes", price: 0.1, icon: "thumbs-up-outline", min: 50, max: 100000 },
            { name: "Video Views", price: 0.04, icon: "videocam-outline", min: 100, max: 100000 }
        ]
    },
    telegram: {
        title: "Telegram",
        options: [
            { name: "Members", price: 0.3, icon: "people-outline", min: 10, max: 100000 },
            { name: "Views", price: 0.02, icon: "eye-outline", min: 50, max: 100000 },
            { name: "Post Share", price: 0.02, icon: "share-social-outline", min: 50, max: 100000 },
            { name: "Comments", price: 0.6, icon: "chatbubbles-outline", min: 50, max: 10000 }
        ]
    }
};

async function fetchServiceConfig() {
    // Returns the configuration instantly without a network request
    return LOCAL_SERVICE_CONFIG;
}

window.openServiceOptions = async function(serviceKey) {
    const optionsGrid = document.getElementById('service-options-grid');
    const orderForm = document.getElementById('service-order-form');
    const popupTitle = document.getElementById('service-popup-title');

    // Reset view
    orderForm.style.display = 'none';
    optionsGrid.style.display = 'grid';
    optionsGrid.innerHTML = '<p style="text-align: center; color: #999;">Loading options...</p>';
    openPopup('.service-popup');

    const config = await fetchServiceConfig();
    const normalizedKey = serviceKey.toLowerCase();
    if (!config || !config[normalizedKey]) {
        optionsGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: red;">Could not load options for this service.</p>';
        return;
    }

    const serviceData = config[normalizedKey];
    popupTitle.innerText = `Select a ${serviceData.title} Service`;
    optionsGrid.innerHTML = '';

    let iconBg = 'rgba(92, 108, 255, 0.1)';
    let iconColor = '#5c6cff';
    if (normalizedKey === 'instagram') { iconBg = 'rgba(193, 53, 132, 0.1)'; iconColor = '#C13584'; }
    else if (normalizedKey === 'youtube') { iconBg = 'rgba(255, 0, 0, 0.1)'; iconColor = '#FF0000'; }
    else if (normalizedKey === 'facebook') { iconBg = 'rgba(24, 119, 242, 0.1)'; iconColor = '#1877F2'; }
    else if (normalizedKey === 'telegram') { iconBg = 'rgba(0, 136, 204, 0.1)'; iconColor = '#0088cc'; }

    serviceData.options.forEach(opt => {
        if (opt.disabled) return;
        const btn = document.createElement('button');
        btn.className = 'service-option-button'; // Replaced 'action-card service-opt-card' and inline styles
        btn.onclick = () => selectServiceOption(normalizedKey, opt.name);
        btn.innerHTML = `
            <div class="icon-wrapper" style="background:${iconBg}; color:${iconColor};">
                <ion-icon name="${opt.icon || 'ellipse-outline'}"></ion-icon>
            </div>
            <div class="details">
                <h3>${opt.name}</h3>
                <p>₹${opt.price} / unit • Min: ${opt.min}</p>
            </div>
        `;
        optionsGrid.appendChild(btn);
    });
};

window.selectServiceOption = async function(serviceKey, optionName) {
    const config = await fetchServiceConfig();
    const normalizedKey = serviceKey.toLowerCase();
    const serviceData = config[normalizedKey];
    const optionData = serviceData.options.find(opt => opt.name === optionName);

    if (!optionData) {
        showAlert('Selected option is not available.', 'Error');
        return;
    }

    // Store current order details
    currentOrder = {
        service: serviceData.title,
        option: optionData.name,
        price: optionData.price,
        min: optionData.min,
        max: optionData.max
    };

    // Dynamic Link Label Logic
    let linkLabel = `Enter ${serviceData.title} Link`;
    const optLower = optionData.name.toLowerCase();
    
    if (normalizedKey === 'instagram') {
        if (optLower.includes('follower')) linkLabel = 'Profile Link';
        else if (optLower.includes('story')) linkLabel = 'Story Link';
        else linkLabel = 'Post/Reel Link';
    } else if (normalizedKey === 'youtube') {
        if (optLower.includes('subscriber')) linkLabel = 'Channel Link';
        else linkLabel = 'Video Link';
    } else if (normalizedKey === 'facebook') {
        if (optLower.includes('follower') || optLower.includes('page')) linkLabel = 'Page/Profile Link';
        else linkLabel = 'Post/Video Link';
    } else if (normalizedKey === 'telegram') {
        if (optLower.includes('member')) linkLabel = 'Channel/Group Link';
        else linkLabel = 'Post Link';
    }

    // Show/hide public account note based on service
    const noteEl = document.getElementById('public-account-note');
    if (noteEl) {
        if (normalizedKey === 'youtube' || normalizedKey === 'telegram') {
            noteEl.style.display = 'none';
        } else {
            noteEl.style.display = 'flex';
        }
    }

    // Update UI
    document.getElementById('service-popup-title').innerText = optionData.name;
    document.getElementById('label-link').innerText = linkLabel;
    document.getElementById('order-limits').innerText = `Min: ${optionData.min}, Max: ${optionData.max}`;
    document.getElementById('order-amount').value = '';
    document.getElementById('order-total').innerText = '0';
    document.getElementById('order-link').value = '';
    clearInlineErrors();

    // Switch views
    document.getElementById('service-options-grid').style.display = 'none';
    document.getElementById('service-order-form').style.display = 'block';
};

window.backToOptions = function() {
    document.getElementById('service-order-form').style.display = 'none';
    document.getElementById('service-options-grid').style.display = 'grid';
    document.getElementById('service-popup-title').innerText = `Select a ${currentOrder.service || ''} Service`;
    currentOrder = {}; // Clear current order state
};

window.calculateTotal = function() {
    const amount = parseInt(document.getElementById('order-amount').value, 10);
    const totalEl = document.getElementById('order-total');
    if (isNaN(amount) || amount <= 0) {
        totalEl.innerText = '0';
        return;
    }
    const total = Math.ceil(amount * currentOrder.price);
    totalEl.innerText = total;
};

window.submitOrder = function() {
    if (!window.isUserLoggedIn()) {
        openPopup('.login-required-popup');
        return;
    }

    clearInlineErrors();
    const link = document.getElementById('order-link').value.trim();
    const amount = parseInt(document.getElementById('order-amount').value, 10);

    let hasError = false;
    if (!link || !link.startsWith('http')) {
        showInlineError('error-link', 'A valid link is required (e.g., https://...).');
        hasError = true;
    }
    if (isNaN(amount) || amount < currentOrder.min || amount > currentOrder.max) {
        showInlineError('error-amount', `Amount must be between ${currentOrder.min} and ${currentOrder.max}.`);
        hasError = true;
    }

    if (hasError) return;

    const total = Math.ceil(amount * currentOrder.price);
    currentOrder.link = link;
    currentOrder.amount = amount;
    currentOrder.totalPrice = total;

    // Populate and open payment popup
    document.getElementById('pay-amount').innerText = `₹${total}`;
    document.getElementById('utr-id').value = '';
    
    closePopup('.service-popup');
    openPopup('.payment-popup');
};

window.backToOrder = function() {
    closePopup('.payment-popup');
    openPopup('.service-popup');
    // Ensure we are on the form view, not options grid
    document.getElementById('service-options-grid').style.display = 'none';
    document.getElementById('service-order-form').style.display = 'block';
};

window.processPayment = async function() {
    clearInlineErrors();
    const utr = document.getElementById('utr-id').value.trim();
    const btn = document.getElementById('btn-verify-payment');

    if (!utr || utr.length !== 12 || !/^[a-zA-Z0-9]+$/.test(utr)) {
        showInlineError('error-utr', 'Please enter a valid 12-digit UTR ID.');
        return;
    }

    const orderData = {
        service: currentOrder.service,
        option: currentOrder.option,
        link: currentOrder.link,
        amount: currentOrder.amount,
        utr: utr
    };

    // Disable button and show loading
    btn.disabled = true;
    btn.innerHTML = '<ion-icon name="sync-outline" class="spin" style="margin-right:8px; font-size:1.3rem;"></ion-icon> Verifying...';

    await submitOrderToDB(orderData, 
        (orderId) => { // onSuccess
            showAlert(`Your order #${orderId.slice(-6)} has been placed successfully! We will verify your payment shortly.`, 'Order Placed!');
            closePopup('.payment-popup');
            // Optionally redirect to orders page
            if (window.location.pathname.includes('/orders')) {
                window.location.reload();
            } else {
                window.location.href = 'orders';
            }
        }, 
        (errorMsg) => { // onError
            showInlineError('error-utr', errorMsg);
            btn.disabled = false;
            btn.innerHTML = '<ion-icon name="checkmark-circle-outline" style="margin-right:8px; font-size:1.3rem;"></ion-icon> Verify & Submit Order';
        }
    );
};

// ================= ORDER DETAILS POPUP =================
window.openOrderDetails = function(orderId) {
    const orders = window.userOrders || {};
    // Find order by ID (checking both key and stored id property)
    const order = Object.values(orders).find(o => o.id === orderId);
    
    if (!order) return;

    const container = document.getElementById('order-details-content');
    if (!container) return;

    // Status Logic
    const status = order.status ? order.status.toLowerCase() : 'pending';
    
    // 1: Payment Verification, 2: In Process, 3: Completed
    let progressLevel = 1;
    if (status === 'processing' || status === 'inprocess') progressLevel = 2;
    if (status === 'completed') progressLevel = 3;
    if (status === 'cancelled') progressLevel = 0;

    let html = '';

    if (status === 'cancelled' && order.cancelledStage) {
        // == Cancelled with specific stage failure ==
        html += `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; position:relative; padding:0 10px;">`;
        html += `<div style="position:absolute; top:15px; left:20px; right:20px; height:3px; background:#eee; z-index:0;"></div>`;
        
        const steps = ["Payment Verification", "In Process", "Completed"];
        steps.forEach((label, idx) => {
            const stepNum = idx + 1;
            // If step is before cancelledStage, it passed (Tick). If it IS cancelledStage, it failed (Cross).
            let icon = stepNum;
            let bg = '#eee';
            let fg = '#999';
            let weight = '400';

            if (stepNum < order.cancelledStage) {
                icon = '<ion-icon name="checkmark-outline"></ion-icon>';
                bg = '#5c6cff'; fg = '#fff'; weight = '600';
            } else if (stepNum == order.cancelledStage) {
                icon = '<ion-icon name="close-outline"></ion-icon>';
                bg = '#ff4d4f'; fg = '#fff'; weight = '600';
            }

            html += `
                <div style="position:relative; z-index:1; text-align:center; width:33%;">
                    <div style="width:32px; height:32px; background:${bg}; border-radius:50%; margin:0 auto 8px; display:flex; align-items:center; justify-content:center; color:${fg}; font-weight:bold; box-shadow: 0 0 0 3px #fff;">
                        ${icon}
                    </div>
                    <span style="font-size:0.75rem; color:${stepNum <= order.cancelledStage ? '#333' : '#999'}; font-weight:${weight}">${label}</span>
                </div>
            `;
        });
        html += `</div>`;
        
        if (order.cancelledReason) {
             html += `<div style="text-align:center; margin-bottom:20px;">
                <button onclick="showCancellationReason('${order.id}')" style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2; padding:6px 12px; border-radius:20px; font-size:0.8rem; cursor:pointer; font-weight:500;">See Why?</button>
             </div>`;
        }
    } else if (progressLevel === 0) {
        // == Generic Cancelled ==
        html += `<div style="padding:15px; background:#ffebee; color:#c62828; border-radius:8px; text-align:center; margin-bottom:20px; font-weight:600;">
            Order Cancelled
            ${order.cancelledReason ? `<br><button onclick="showCancellationReason('${order.id}')" style="margin-top:8px; background:#c62828; color:white; border:none; padding:4px 10px; border-radius:4px; font-size:0.75rem; cursor:pointer;">See Why?</button>` : ''}
        </div>`;
    } else {
        // == Active Order Stepper ==
        html += `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; position:relative; padding:0 10px;">`;
        // Background Line
        html += `<div style="position:absolute; top:15px; left:20px; right:20px; height:3px; background:#eee; z-index:0;"></div>`;
        
        const steps = ["Payment Verification", "In Process", "Completed"];
        
        steps.forEach((label, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum <= progressLevel;
            let isChecked = stepNum < progressLevel || status === 'completed';
            const color = isActive ? '#5c6cff' : '#eee';
            const iconColor = isActive ? '#fff' : '#999';
            
            html += `
                <div style="position:relative; z-index:1; text-align:center; width:33%;">
                    <div style="width:32px; height:32px; background:${color}; border-radius:50%; margin:0 auto 8px; display:flex; align-items:center; justify-content:center; color:${iconColor}; font-weight:bold; box-shadow: 0 0 0 3px #fff;">
                        ${isChecked ? '<ion-icon name="checkmark-outline"></ion-icon>' : stepNum}
                    </div>
                    <span style="font-size:0.75rem; color:${isActive ? '#333' : '#999'}; font-weight:${isActive ? '600' : '400'}">${label}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Order Info
    html += `
        <div style="background:#f8f9fa; padding:20px; border-radius:12px; font-size:0.9rem; line-height:1.8;">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:8px;">
                <span style="color:#666">Service</span>
                <span style="font-weight:600">${order.service}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:8px;">
                <span style="color:#666">Option</span>
                <span style="font-weight:600">${order.option}</span>
            </div>
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:8px;">
                <span style="color:#666">Total Cost</span>
                <span style="font-weight:600; color:#5c6cff">₹${order.totalPrice}</span>
            </div>
            <div style="margin-top:10px;">
                <span style="color:#666; display:block; margin-bottom:4px;">Link</span>
                <a href="${order.link}" target="_blank" style="color:#5c6cff; word-break:break-all;">${order.link}</a>
            </div>

            <div style="margin-top:20px; text-align:center; border-top:1px solid #eee; padding-top:15px;">
                <button onclick="showCreateTicket('${order.id}')" style="background:#fff3e0; color:#e65100; border:1px solid #ffe0b2; padding:8px 16px; border-radius:20px; font-size:0.85rem; cursor:pointer; font-weight:500; display:flex; align-items:center; justify-content:center; gap:5px; margin:0 auto;"><ion-icon name="alert-circle-outline"></ion-icon> Report Issue / Create Ticket</button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    openPopup('.order-details-popup');
};

window.showCancellationReason = function(orderId) {
    // Try to find in userOrders (User view)
    let order = null;
    if (window.userOrders) {
        order = Object.values(window.userOrders).find(o => o.id === orderId);
    }
    // Try to find in allAdminOrders (Admin view)
    if (!order && window.allAdminOrders) {
        order = window.allAdminOrders.find(o => o.id === orderId);
    }
    
    if (order && order.cancelledReason) {
        showAlert(order.cancelledReason, "Cancellation Reason");
    }
};

window.copyToClipboard = function(text, btn) {
    navigator.clipboard.writeText(text)
        .then(() => {
            if (btn && btn.nextElementSibling) {
                const msg = btn.nextElementSibling;
                msg.style.display = 'block';
                setTimeout(() => { msg.style.display = 'none'; }, 2000);
            }
        })
        .catch(err => console.error("Failed to copy link.", err));
};

// ================= ADMIN DASHBOARD LOGIC =================
window.loadAdminDashboard = async function(user) {
    // REFACTOR: This function now fetches all data from the secure backend API
    // instead of listening directly to the database. This is more secure and scalable.
    console.log("Loading Admin Dashboard for admin user:", user.email);

    try {
        const token = await user.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch all necessary data concurrently
        const [ordersRes, usersRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/admin/orders`, { headers }),
            fetch(`${BACKEND_URL}/api/admin/users`, { headers })
        ]);

        if (!ordersRes.ok || !usersRes.ok) {
            throw new Error('Failed to fetch admin data.');
        }

        const allOrders = await ordersRes.json();
        const allUsers = await usersRes.json();

        window.allAdminOrders = allOrders; // Store for filtering
        window.allAdminUsers = allUsers; // Store for filtering

        // Render the main tables
        renderAdminTable(allOrders);
        renderAdminUsers(allUsers);

        // Initial load for tickets and giveaways
        loadAdminTickets();
        if (window.loadAdminGiveaways) window.loadAdminGiveaways();

    } catch (error) {
        console.error("Admin load error:", error);
        const tbody = document.getElementById('admin-orders-body');
        if(tbody) tbody.innerHTML = `<tr><td colspan='7' style='text-align:center; padding:20px; color:red'>Error loading data: ${error.message}</td></tr>`;
    }

    // Load current announcement for settings tab
    get(ref(database, 'system/announcement')).then(snap => {
        const input = document.getElementById('admin-announcement-input');
        if(input && snap.exists()) input.value = snap.val();
    });
};

window.renderAdminStats = function(stats) {
    // REFACTOR: This function now receives stats directly from the backend API.
    const { totalRevenue, totalProfit, totalOrders, pendingCount } = stats;

    const revEl = document.getElementById('admin-total-revenue');
    const ordEl = document.getElementById('admin-total-orders');
    const penEl = document.getElementById('admin-pending-orders');
    const profitEl = document.getElementById('admin-total-profit');

    if(revEl) revEl.innerText = "₹" + totalRevenue.toLocaleString('en-IN');
    if(ordEl) ordEl.innerText = totalOrders;
    if(penEl) penEl.innerText = pendingCount;
    if (profitEl) {
        profitEl.innerText = "₹" + totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        profitEl.style.color = totalProfit >= 0 ? '#00c853' : '#ff4d4f';
    }
};

window.resetProfitChange = function() {
    // This feature is disabled because profit is no longer calculated on the client.
    showAlert("This feature has been disabled for security reasons.", "Info");
};

window.renderAdminTable = function(orders) {
    const tbody = document.getElementById('admin-orders-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:20px'>No matching orders found.</td></tr>";
        return;
    }

    // Check for duplicate UTRs to flag potential spam
    const utrCounts = {};
    orders.forEach(o => { if(o.utr) utrCounts[o.utr] = (utrCounts[o.utr] || 0) + 1; });

    orders.forEach(order => {
        const date = new Date(order.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
        const status = order.status || 'pending';
        const statusClass = status === 'completed' ? 'status-completed' : 'status-pending';
        const statusText = status === 'pending' ? 'Pending' : status.charAt(0).toUpperCase() + status.slice(1);
        
        const isDuplicateUTR = order.utr && utrCounts[order.utr] > 1;
        const utrDisplay = isDuplicateUTR 
            ? `<span class="utr-code" style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2" title="Duplicate UTR detected!">${sanitize(order.utr)} <ion-icon name="warning"></ion-icon></span>` 
            : `<div class="utr-code">${sanitize(order.utr || 'N/A')}</div>`;

        // Status Badge (Read Only)
        const statusBadge = `<span class="status-badge ${statusClass}" style="background:${getStatusColor(status)}; color:#fff; padding:4px 8px; border-radius:4px">${statusText}</span>`;

        const row = `
            <tr>
                <td style="font-family:monospace; color:#666">#${order.id ? order.id.slice(-6) : '---'}</td>
                <td>
                    <div style="font-weight:600">${sanitize(order.username)}</div>
                    <small style="color:#888; font-size:0.75rem; font-family:monospace">${order.userId.slice(0,8)}...</small>
                </td>
                <td>
                    <div>${order.service}</div>
                    <small style="color:#888">${order.option}</small>
                    <div style="font-size:0.75rem"><a href="${sanitize(order.link)}" target="_blank" style="color:#5c6cff">Link</a></div>
                </td>
                <td>
                    <div style="font-weight:600">₹${order.totalPrice}</div>
                    <small style="color:#666">Qty: ${order.amount || '-'}</small>
                </td>
                <td>
                    ${utrDisplay}
                </td>
                <td>${statusBadge}</td>
                <td>
                    <button class="view-btn" style="padding:6px 12px; font-size:0.75rem" onclick="openAdminManage('${order.userId}', '${order.id}')"><ion-icon name="create-outline"></ion-icon> Manage</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
};

function getStatusColor(status) {
    if(status === 'completed') return '#00c853';
    if(status === 'pending') return '#ff9800';
    if(status === 'inprocess' || status === 'processing') return '#2196f3';
    if(status === 'cancelled') return '#ff4d4f';
    return '#ddd';
}

// ================= ADMIN USERS TAB =================
window.renderAdminUsers = function(usersList) {
    // REFACTOR: This function now receives a clean user array from the API.
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!usersList || usersList.length === 0) return;

    usersList.forEach(u => {
        const row = `<tr>
            <td style="font-family:monospace; color:#666">${u.uid}</td>
            <td style="font-weight:600">${sanitize(u.username || 'Unknown')}</td>
            <td>${sanitize(u.email || 'N/A')}</td>
            <td style="color:#5c6cff; font-weight:600">₹${u.totalSpent.toLocaleString('en-IN')}</td>
            <td>${u.totalOrders}</td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
};

window.updateOrderStatus = function(userId, orderId, newStatus) {
    set(ref(database, `users/${userId}/orders/${orderId}/status`), newStatus)
        .then(() => {
            // Optional: visual feedback
        })
        .catch(err => showAlert(err.message, "Error updating status"));
};

window.filterAdminOrders = function() {
    const search = document.getElementById('admin-search').value.toLowerCase();
    const statusFilter = document.getElementById('admin-filter-status').value;
    if (!window.allAdminOrders) return;
    const filtered = window.allAdminOrders.filter(order => {
        const matchesSearch = (order.utr && order.utr.toLowerCase().includes(search)) || (order.username && order.username.toLowerCase().includes(search)) || (order.id && order.id.toLowerCase().includes(search));
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter || (statusFilter === 'inprocess' && order.status === 'processing');
        return matchesSearch && matchesStatus;
    });
    renderAdminTable(filtered);
};

window.filterAdminUsers = function() {
    const search = document.getElementById('admin-user-search').value.toLowerCase();
    if (!window.allAdminUsers) return;
    const filtered = window.allAdminUsers.filter(u => {
        return (u.username && u.username.toLowerCase().includes(search)) || 
               (u.email && u.email.toLowerCase().includes(search)) || 
               (u.uid && u.uid.toLowerCase().includes(search));
    });
    // Re-render logic inline for simplicity or extract to function
    const tbody = document.getElementById('admin-users-body');
    tbody.innerHTML = '';
    filtered.forEach(u => {
        const row = `<tr><td style="font-family:monospace; color:#666">${u.uid}</td><td style="font-weight:600">${sanitize(u.username)}</td><td>${sanitize(u.email)}</td><td style="color:#5c6cff; font-weight:600">₹${u.totalSpent.toLocaleString('en-IN')}</td><td>${u.totalOrders}</td></tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
};

// ================= ADMIN MANAGE POPUP =================
let currentAdminOrder = null;

window.openAdminManage = function(userId, orderId) {
    const order = window.allAdminOrders.find(o => o.id === orderId && o.userId === userId);
    if (!order) return;
    currentAdminOrder = order;

    const content = document.getElementById('admin-manage-content');
    content.innerHTML = `
        <div id="admin-order-details-view" style="background:#f9f9f9; padding:15px; border-radius:8px; font-size:0.9rem; margin-bottom:15px;">
            <p><strong>User:</strong> ${sanitize(order.username)}</p>
            <p><strong>Service:</strong> ${order.service} - <span id="view-option">${order.option}</span></p>
            <p><strong>Price:</strong> ₹${order.totalPrice}</p>
            <p><strong>Quantity:</strong> ${order.amount || '-'}</p>
            ${order.status === 'cancelled' && order.cancelledReason ? `<p style="color:#c62828; margin-top:5px; background:#ffebee; padding:8px; border-radius:6px;"><strong>Reason:</strong> ${sanitize(order.cancelledReason)}</p>` : ''}

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:15px;">
                <div style="flex:1; min-width:0;">
                    <strong>Link:</strong> 
                    <a href="${sanitize(order.link)}" target="_blank" style="color:#5c6cff; word-break:break-all;">${sanitize(order.link)}</a>
                </div>
                <div style="position:relative;">
                    <button class="copy-btn" onclick="copyToClipboard('${sanitize(order.link)}', this)" title="Copy Link"><ion-icon name="copy-outline"></ion-icon></button>
                    <span style="display:none; position:absolute; top:34px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; z-index:10; pointer-events:none;">Copied!</span>
                </div>
            </div>
    
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:15px;">
                <div style="flex:1; min-width:0;">
                    <strong>UTR:</strong> 
                    <span class="utr-code">${sanitize(order.utr || 'N/A')}</span>
                </div>
                <div style="position:relative;">
                    <button class="copy-btn" onclick="copyToClipboard('${sanitize(order.utr || '')}', this)" title="Copy UTR"><ion-icon name="copy-outline"></ion-icon></button>
                    <span style="display:none; position:absolute; top:34px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; z-index:10; pointer-events:none;">Copied!</span>
                </div>
            </div>
        </div>

        <!-- Edit Form (Hidden by default) -->
        <div id="admin-order-edit-view" style="display:none; background:#f9f9f9; padding:15px; border-radius:8px; font-size:0.9rem; margin-bottom:15px;">
            <div class="form-group" style="margin-bottom:10px">
                <label style="font-size:0.8rem; color:#666">Link</label>
                <input type="text" id="edit-order-link" class="form-input" value="${sanitize(order.link)}" style="padding:6px;">
                <small id="error-edit-link" class="error-text"></small>
            </div>
            <div class="form-group" style="margin-bottom:10px">
                <label style="font-size:0.8rem; color:#666">UTR</label>
                <input type="text" id="edit-order-utr" class="form-input" value="${sanitize(order.utr || '')}" style="padding:6px;">
                <small id="error-edit-utr" class="error-text"></small>
            </div>
            <button class="cta" style="width:100%; padding:8px" onclick="saveAdminOrderDetails()">Save Changes</button>
        </div>
    `;

    renderAdminActions('update');
    openPopup('.admin-manage-popup');
};

window.renderAdminActions = function(mode) {
    const container = document.getElementById('admin-manage-actions');
    if(!container) return;
    
    let html = '';
    const order = currentAdminOrder;
    const status = order.status || 'pending';

    if (mode === 'update') {
        html += `
            <h4 style="margin-bottom:10px">Verification Steps</h4>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer">
                    <input type="checkbox" id="adm-check-payment" style="width:18px; height:18px; accent-color:#5c6cff">
                    <span>Payment Verified (UTR Match)</span>
                </label>
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer">
                    <input type="checkbox" id="adm-check-process" style="width:18px; height:18px; accent-color:#5c6cff">
                    <span>Order In Process</span>
                </label>
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer">
                    <input type="checkbox" id="adm-check-complete" style="width:18px; height:18px; accent-color:#5c6cff">
                    <span>Order Completed</span>
                </label>
            </div>
            <div style="display:flex; gap:10px">
                <button class="cta" style="flex:2" onclick="saveAdminOrder()">Update Status</button>
                <button style="flex:1; background:#e3f2fd; color:#1565c0; border:none; border-radius:10px; cursor:pointer; font-weight:600" onclick="toggleAdminEditMode()">Edit</button>
            </div>
            <div style="display:flex; gap:10px; margin-top:10px">
                <button style="flex:1; background:#ffebee; color:#c62828; border:none; border-radius:10px; cursor:pointer; font-weight:600; padding:10px" onclick="renderAdminActions('cancel')">Cancel Order</button>
                <button style="flex:1; background:#333; color:#fff; border:none; border-radius:10px; cursor:pointer; font-weight:600; padding:10px" onclick="deleteAdminOrder()">Delete</button>
            </div>
        `;
        container.innerHTML = html;

        // Set Checkboxes based on status
        const cbPayment = document.getElementById('adm-check-payment');
        const cbProcess = document.getElementById('adm-check-process');
        const cbComplete = document.getElementById('adm-check-complete');

        if (status === 'inprocess' || status === 'processing') {
            cbPayment.checked = true;
            cbProcess.checked = true;
        } else if (status === 'completed') {
            cbPayment.checked = true;
            cbProcess.checked = true;
            cbComplete.checked = true;
        }

    } else if (mode === 'cancel') {
        html += `
            <h4 style="margin-bottom:10px; color:#c62828">Cancel Order - Select Failure Stage</h4>
            <p style="font-size:0.85rem; color:#666; margin-bottom:10px">Check the box where the process stopped (failed).</p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer">
                    <input type="radio" name="cancel-stage" value="1" style="width:18px; height:18px; accent-color:#c62828">
                    <span>Payment Verification Failed</span>
                </label>
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer">
                    <input type="radio" name="cancel-stage" value="2" style="width:18px; height:18px; accent-color:#c62828">
                    <span>Processing Failed</span>
                </label>
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-size:0.85rem; color:#666; display:block; margin-bottom:5px;">Reason / Note (Optional)</label>
                <textarea id="cancel-note" class="form-input" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; resize:vertical; min-height:60px; font-family:inherit;" placeholder="Explain why the order is cancelled..."></textarea>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="cta" style="flex:1; background:#c62828" onclick="confirmCancelOrder()">Confirm Cancel</button>
                <button style="flex:1; background:#eee; border:none; border-radius:10px; cursor:pointer; color:#333" onclick="renderAdminActions('update')">Back</button>
            </div>
        `;
        container.innerHTML = html;
    }
};

window.toggleAdminEditMode = function() {
    const viewMode = document.getElementById('admin-order-details-view');
    const editMode = document.getElementById('admin-order-edit-view');
    
    if (editMode.style.display === 'none') {
        editMode.style.display = 'block';
        viewMode.style.display = 'none';
    } else {
        editMode.style.display = 'none';
        viewMode.style.display = 'block';
    }
};

window.saveAdminOrderDetails = function() {
    if (!currentAdminOrder) return;
    clearInlineErrors();
    const newLink = document.getElementById('edit-order-link').value;
    const newUtr = document.getElementById('edit-order-utr').value;

    if(!newLink) { showInlineError('error-edit-link', 'Link is required'); return; }
    if(!newUtr) { showInlineError('error-edit-utr', 'UTR is required'); return; }

    update(ref(database, `users/${currentAdminOrder.userId}/orders/${currentAdminOrder.id}`), {
        link: newLink,
        utr: newUtr
    }).then(() => {
        currentAdminOrder.link = newLink;
        currentAdminOrder.utr = newUtr;
        // Refresh view
        openAdminManage(currentAdminOrder.userId, currentAdminOrder.id);
        // Refresh table
        renderAdminTable(window.allAdminOrders);
        showAlert("Order details updated", "Success");
    }).catch(err => showAlert(err.message, "Error"));
};

window.deleteAdminOrder = function() {
    if (!currentAdminOrder) return;
    showConfirm("Are you sure you want to permanently delete this order?", () => {
        remove(ref(database, `users/${currentAdminOrder.userId}/orders/${currentAdminOrder.id}`))
            .then(() => {
                closePopup('.admin-manage-popup');
                loadAdminDashboard(auth.currentUser); // Reload all
                showAlert("Order deleted permanently.", "Deleted");
            }).catch(err => showAlert(err.message, "Error"));
    });
};

window.saveAdminOrder = function() {
    if (!currentAdminOrder) return;

    const cbPayment = document.getElementById('adm-check-payment').checked;
    const cbProcess = document.getElementById('adm-check-process').checked;
    const cbComplete = document.getElementById('adm-check-complete').checked;

    let newStatus = 'pending';
    if (cbPayment) newStatus = 'inprocess';
    if (cbProcess) newStatus = 'inprocess';
    if (cbComplete) newStatus = 'completed';

    // If user unchecked everything, it goes to pending.
    
    updateOrderStatus(currentAdminOrder.userId, currentAdminOrder.id, newStatus);
    closePopup('.admin-manage-popup');
    
    // Refresh table (update local data first to avoid full reload lag)
    currentAdminOrder.status = newStatus;
    renderAdminTable(window.allAdminOrders);
    showAlert("Order updated to " + newStatus, "Success");
};

window.confirmCancelOrder = function() {
    if (!currentAdminOrder) return;
    
    const radios = document.getElementsByName('cancel-stage');
    let stage = 0;
    for (const r of radios) { if (r.checked) stage = parseInt(r.value); }
    
    const note = document.getElementById('cancel-note').value.trim();

    // Update status to cancelled
    updateOrderStatus(currentAdminOrder.userId, currentAdminOrder.id, 'cancelled');
    
    // Save the stage where it failed and reason
    const updates = { cancelledStage: stage };
    if(note) updates.cancelledReason = note;
    
    update(ref(database, `users/${currentAdminOrder.userId}/orders/${currentAdminOrder.id}`), updates);

    closePopup('.admin-manage-popup');
    currentAdminOrder.status = 'cancelled';
    if(note) currentAdminOrder.cancelledReason = note;
    renderAdminTable(window.allAdminOrders);
    showAlert("Order cancelled.", "Success");
};

// ================= ADMIN UTILITIES =================
window.switchAdminTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.admin-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
    
    // Show selected
    const content = document.getElementById('admin-tab-' + tabName);
    if (content) content.style.display = 'block';
    
    // Highlight button
    const btns = document.querySelectorAll('.admin-tab-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    // Clear notification for this tab (mark as seen)
    if (window.adminCounts && window.adminCounts[tabName] !== undefined) {
        localStorage.setItem(`zynex_admin_seen_${tabName}`, window.adminCounts[tabName]);
        const badge = document.getElementById(`admin-${tabName}-badge`);
        if(badge) badge.style.display = 'none';
        // Refresh sidebar badge to remove count
        updateAdminBadges(tabName, window.adminCounts[tabName]);
    }
};

window.exportOrdersToCSV = function() {
    if (!window.allAdminOrders || window.allAdminOrders.length === 0) {
        showAlert("No orders to export.", "Info");
        return;
    }
    
    const headers = ["Order ID", "User ID", "Username", "Service", "Option", "Link", "Amount", "Total Price", "UTR", "Status", "Date"];
    const rows = window.allAdminOrders.map(o => [
        o.id, o.userId, o.username, o.service, o.option, o.link, o.amount, o.totalPrice, o.utr, o.status, new Date(o.timestamp).toLocaleString()
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.map(i => `"${String(i).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "zynex_orders_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.saveAnnouncement = function() {
    clearInlineErrors();
    const msg = document.getElementById('admin-announcement-input').value.trim();
    if(!msg) { showInlineError('error-announcement', 'Message cannot be empty'); return; }

    set(ref(database, 'system/announcement'), msg)
        .then(() => showAlert("Announcement updated!", "Success"))
        .catch(e => showAlert(e.message, "Error"));
};

window.clearAnnouncement = function() {
    remove(ref(database, 'system/announcement'))
        .then(() => {
            document.getElementById('admin-announcement-input').value = '';
            showAlert("Announcement cleared.", "Success");
        });
};

// Security: Basic HTML Sanitization
window.sanitize = function(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
};

// ================= TICKET SYSTEM =================

// Global listeners to handle real-time updates
let userTicketUnsub = null;
let adminTicketUnsub = null;

// --- User Side ---

window.openSupportCenter = function() {
    if(userTicketUnsub) { userTicketUnsub(); userTicketUnsub = null; }

    const content = document.querySelector('.popup-content.help');
    if(!content) return;
    
    content.innerHTML = `
        <button class="close-icon" aria-label="Close" onclick="closePopup('.help-popup')">&times;</button>
        <div style="text-align:center; margin-bottom:20px;">
            <div style="width:60px; height:60px; background:rgba(92, 108, 255, 0.1); color:#5c6cff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:32px; margin:0 auto 15px;">
                <ion-icon name="headset" style="margin:0"></ion-icon>
            </div>
            <h2 style="margin:0; font-size:1.5rem;">Support Center</h2>
            <p style="color:#888; font-size:0.9rem; margin-top:5px;">How can we help you today?</p>
        </div>
        
        <div style="display:grid; gap:15px; margin-bottom:25px;">
            <button onclick="showCreateTicket()" class="action-card" style="padding:15px; display:flex; align-items:center; gap:15px; text-align:left; margin:0; cursor:pointer; width:100%; border-radius:12px;">
                <div style="background:rgba(46, 125, 50, 0.1); color:#2e7d32; width:45px; height:45px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <ion-icon name="add-circle" style="font-size:24px; margin:0;"></ion-icon>
                </div>
                <div>
                    <h3 style="font-size:1rem; margin-bottom:2px;">Create New Ticket</h3>
                    <p style="font-size:0.8rem; margin:0; line-height:1.3;">Report an issue with your order</p>
                </div>
            </button>
            
            <button onclick="showUserTickets()" class="action-card" style="padding:15px; display:flex; align-items:center; gap:15px; text-align:left; margin:0; cursor:pointer; width:100%; border-radius:12px;">
                <div style="background:rgba(239, 108, 0, 0.1); color:#ef6c00; width:45px; height:45px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <ion-icon name="ticket" style="font-size:24px; margin:0;"></ion-icon>
                </div>
                <div>
                    <h3 style="font-size:1rem; margin-bottom:2px;">View My Tickets</h3>
                    <p style="font-size:0.8rem; margin:0; line-height:1.3;">Check updates on past tickets</p>
                </div>
            </button>
        </div>

        <div class="contact-methods" style="border-top:1px solid #eee; padding-top:20px; text-align:center;">
            <p style="font-size:0.8rem; color:#888; margin-bottom:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Direct Contact</p>
            <div style="display:flex; justify-content:center; gap:10px;">
                <a href="mailto:zynex.official.help@gmail.com" class="contact-pill">
                    <ion-icon name="mail" style="color:#ea4335; margin:0; font-size:16px;"></ion-icon> Email
                </a>
                <a href="https://instagram.com/smmzynex.in" target="_blank" class="contact-pill">
                    <ion-icon name="logo-instagram" style="color:#C13584; margin:0; font-size:16px;"></ion-icon> Instagram
                </a>
            </div>
        </div>
    `;
};

window.showCreateTicket = function(orderId = '') {
    if(userTicketUnsub) { userTicketUnsub(); userTicketUnsub = null; }

    // Close order details if open
    closePopup('.order-details-popup');
    openPopup('.help-popup');

    const content = document.querySelector('.popup-content.help');
    content.innerHTML = `
        <button class="close-icon" onclick="openSupportCenter()"><ion-icon name="arrow-back-outline"></ion-icon></button>
        <h2 style="text-align:center; margin-bottom:20px">New Ticket</h2>
        <div class="form-group">
            <label>Subject</label>
            <input type="text" id="ticket-subject" class="form-input" placeholder="Brief description" value="${orderId ? 'Issue with Order #' + orderId.slice(-6) : ''}">
        </div>
        <div class="form-group">
            <label>Message</label>
            <textarea id="ticket-message" class="form-input" style="height:100px; resize:vertical" placeholder="Describe your issue..."></textarea>
        </div>
        <button class="cta" style="width:100%" onclick="submitTicket('${orderId}')">Submit Ticket</button>
    `;
};

window.submitTicket = function(orderId) {
    const user = auth.currentUser;
    if(!user) return showAlert("Please login first.");

    const subject = document.getElementById('ticket-subject').value.trim();
    const message = document.getElementById('ticket-message').value.trim();

    if(!subject || !message) return showAlert("Please fill all fields.");

    // FIX: Use push() to generate a unique ID for every ticket
    // This prevents overwriting previous tickets from the same user
    const newTicketRef = push(ref(database, 'tickets'));
    const ticketData = {
        id: newTicketRef.key,
        userId: user.uid,
        userEmail: user.email,
        username: user.displayName || 'User',
        subject: subject,
        status: 'open',
        orderId: orderId || null,
        timestamp: Date.now(),
        replies: {
            [Date.now()]: { sender: 'user', message: message, timestamp: Date.now() }
        }
    };

    set(newTicketRef, ticketData).then(() => {
        showAlert("Ticket created successfully!", "Success");
        showUserTickets();
    });
};

window.showUserTickets = function() {
    if(userTicketUnsub) { userTicketUnsub(); userTicketUnsub = null; }

    const user = auth.currentUser;
    if(!user) return;

    const content = document.querySelector('.popup-content.help');
    content.innerHTML = `
        <button class="close-icon" onclick="openSupportCenter()"><ion-icon name="arrow-back-outline"></ion-icon></button>
        <h2 style="text-align:center; margin-bottom:20px">My Tickets</h2>
        <div id="user-ticket-list" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            <p style="text-align:center; color:#999">Loading...</p>
        </div>
    `;

    get(ref(database, 'tickets')).then(snap => {
        const list = document.getElementById('user-ticket-list');
        if(!list) return;
        list.innerHTML = '';

        if(!snap.exists()) {
            list.innerHTML = '<p style="text-align:center; color:#999">No tickets found.</p>';
            return;
        }

        const tickets = [];
        snap.forEach(child => {
            const t = child.val();
            if(t.userId === user.uid) tickets.push(t);
        });

        if(tickets.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#999">No tickets found.</p>';
            return;
        }

        tickets.forEach(t => {
            const statusColor = t.status === 'open' ? '#e3f2fd' : '#f5f5f5';
            const statusText = t.status === 'open' ? 'Open' : 'Closed';
            const textColor = t.status === 'open' ? '#1565c0' : '#666';
            
            list.innerHTML += `
                <div onclick="viewUserTicket('${t.id}')" style="background:#fff; border:1px solid #eee; padding:12px; border-radius:8px; cursor:pointer; text-align:left; box-shadow:0 2px 5px rgba(0,0,0,0.03)">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                        <span style="font-weight:600; font-size:0.95rem">${sanitize(t.subject)}</span>
                        <span style="background:${statusColor}; color:${textColor}; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600">${statusText}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#888">${new Date(t.timestamp).toLocaleDateString()}</div>
                </div>
            `;
        });
    });
};

window.viewUserTicket = function(ticketId) {
    const content = document.querySelector('.popup-content.help');
    
    let currentTicketListener = null;
    // Stop listening to previous ticket if any
    if(currentTicketListener) currentTicketListener();
    if(userTicketUnsub) { userTicketUnsub(); userTicketUnsub = null; }

    // Start real-time listener
    currentTicketListener = onValue(ref(database, `tickets/${ticketId}`), (snap) => {
        if(!snap.exists()) return;
        const t = snap.val();
        
        // Preserve input text if user is typing during an update
        const existingInput = document.getElementById('user-reply-input');
        const draftText = existingInput ? existingInput.value : '';

        let chatHtml = '';
        const replies = t.replies ? Object.values(t.replies).sort((a,b) => (a.timestamp||0) - (b.timestamp||0)) : [];
        
        replies.forEach(r => {
            const type = r.sender === 'admin' ? 'admin' : 'user';
            
            chatHtml += `
                <div class="chat-msg ${type}">
                    ${sanitize(r.message)}
                    <span class="chat-meta">${new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
            `;
        });

        content.innerHTML = `
            <button class="close-icon" onclick="showUserTickets()"><ion-icon name="arrow-back-outline"></ion-icon></button>
            <h3 style="text-align:center; margin-bottom:5px; font-size:1rem">${sanitize(t.subject)}</h3>
            <p style="text-align:center; color:#888; font-size:0.8rem; margin-bottom:15px">Ticket #${t.id.slice(-4)}</p>
            
            <div id="user-chat-box" style="height:250px; overflow-y:auto; border:1px solid #eee; padding:10px; border-radius:8px; display:flex; flex-direction:column; margin-bottom:10px; background:#fafafa">
                ${chatHtml}
            </div>
            
            ${t.status === 'open' ? `
            <div style="display:flex; gap:5px">
                <div style="flex:1">
                    <input type="text" id="user-reply-input" class="form-input" placeholder="Type a reply..." style="width:100%" value="${draftText}">
                    <small id="error-user-reply" class="error-text"></small>
                </div>
                <button class="cta" style="padding:0 15px; height:42px" onclick="replyToTicket('${t.id}', 'user')"><ion-icon name="send"></ion-icon></button>
            </div>` : '<p style="text-align:center; color:#888; background:#eee; padding:8px; border-radius:6px">This ticket is closed.</p>'}
            
            <div style="margin-top:15px; text-align:center">
                <button onclick="deleteUserTicket('${t.id}')" style="background:none; border:none; color:#ff4d4f; font-size:0.8rem; cursor:pointer; text-decoration:underline">Delete Ticket</button>
            </div>
        `;

        // Auto-scroll to bottom
        const chatBox = document.getElementById('user-chat-box');
        if(chatBox) chatBox.scrollTop = chatBox.scrollHeight;

        // Restore focus if typing
        const input = document.getElementById('user-reply-input');
        if(input && draftText) input.focus();
    });
};

window.replyToTicket = function(ticketId, sender) {
    clearInlineErrors();
    const inputId = sender === 'user' ? 'user-reply-input' : 'admin-ticket-reply';
    const errorId = sender === 'user' ? 'error-user-reply' : 'error-ticket-reply';
    const msg = document.getElementById(inputId).value.trim();
    
    if(!msg) {
        showInlineError(errorId, 'Message cannot be empty');
        return;
    }

    const timestamp = Date.now();
    const replyRef = push(ref(database, `tickets/${ticketId}/replies`));
    
    const updates = {};
    // Add the reply
    updates[`tickets/${ticketId}/replies/${replyRef.key}`] = {
        sender: sender,
        message: msg,
        timestamp: timestamp
    };
    // Update main ticket timestamp to bump it to the top (Live Chat behavior)
    updates[`tickets/${ticketId}/timestamp`] = timestamp;

    update(ref(database), updates).then(() => {
        document.getElementById(inputId).value = '';
        // No manual refresh needed, onValue handles it
    });
};

window.deleteUserTicket = function(ticketId) {
    showConfirm("Are you sure you want to delete this ticket?", () => {
        remove(ref(database, `tickets/${ticketId}`))
            .then(() => {
                showAlert("Ticket deleted.", "Success");
                showUserTickets();
            })
            .catch(e => showAlert(e.message, "Error"));
    });
};

// --- Admin Side ---

window.loadAdminTickets = function() {
    if (window.adminTicketsUnsub) window.adminTicketsUnsub();

    window.adminTicketsUnsub = onValue(ref(database, 'tickets'), (snap) => {
        const tbody = document.getElementById('admin-tickets-body');
        if(!tbody) return;
        tbody.innerHTML = '';
        
        if(!snap.exists()) {
            window.allAdminTickets = [];
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px">No tickets found.</td></tr>';
            return;
        }

        const tickets = [];
        snap.forEach(c => {
            const val = c.val();
            // Robustness: If ID is missing (from old bad data), use the key
            if (val && typeof val === 'object') {
                if (!val.id) val.id = c.key;
                tickets.push(val);
            }
        });
        tickets.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
        window.allAdminTickets = tickets;
        renderAdminTicketsTable(tickets);
    });
};

window.renderAdminTicketsTable = function(tickets) {
    const tbody = document.getElementById('admin-tickets-body');
    tbody.innerHTML = '';
    
    tickets.forEach(t => {
        if(!t) return;
        const tId = t.id ? t.id.toString() : 'UNKNOWN';

        const statusBadge = t.status === 'open' 
            ? '<span class="ticket-status-open">Open</span>' 
            : '<span class="ticket-status-closed">Closed</span>';
            
        const row = `
            <tr>
                <td style="font-family:monospace; color:#666">#${tId.length > 6 ? tId.slice(-6) : tId}</td>
                <td>
                    <div style="font-weight:600">${sanitize(t.username)}</div>
                    <small style="color:#888">${sanitize(t.userEmail)}</small>
                </td>
                <td>${sanitize(t.subject)}</td>
                <td style="font-size:0.85rem; color:#666">${new Date(t.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="view-btn" style="padding:6px 12px; font-size:0.75rem" onclick="openAdminTicketManage('${t.id}')">View</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
};

let currentAdminTicketId = null;

window.openAdminTicketManage = function(ticketId) {
    currentAdminTicketId = ticketId;
    
    let currentAdminTicketListener = null;
    if(currentAdminTicketListener) currentAdminTicketListener();

    currentAdminTicketListener = onValue(ref(database, `tickets/${ticketId}`), (snap) => {
        if(!snap.exists()) return;
        const t = snap.val();

    document.getElementById('admin-ticket-header').innerHTML = `
        <strong>${sanitize(t.subject)}</strong> <span style="color:#888">by ${sanitize(t.username)}</span>
        ${t.orderId ? `<br><small>Ref: Order #${t.orderId.slice(-6)}</small>` : ''}
    `;

    const chatContainer = document.getElementById('admin-ticket-chat');
    chatContainer.innerHTML = '';
    
    const replies = t.replies ? Object.values(t.replies).sort((a,b) => (a.timestamp||0) - (b.timestamp||0)) : [];
    replies.forEach(r => {
        const type = r.sender === 'admin' ? 'admin' : 'user';
        chatContainer.innerHTML += `
            <div class="chat-msg ${type}">
                ${sanitize(r.message)}
                <span class="chat-meta">${new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
        `;
    });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    const closeBtn = document.getElementById('admin-close-ticket-btn');
    closeBtn.innerText = t.status === 'open' ? 'Close Ticket' : 'Re-open Ticket';
    
    openPopup('.admin-ticket-popup');
    });
};

window.sendAdminTicketReply = function() {
    if(currentAdminTicketId) replyToTicket(currentAdminTicketId, 'admin');
};

window.toggleTicketStatus = function() {
    if(!currentAdminTicketId) return;
    const t = window.allAdminTickets.find(x => x.id === currentAdminTicketId);
    const newStatus = t.status === 'open' ? 'closed' : 'open';
    
    update(ref(database, `tickets/${currentAdminTicketId}`), { status: newStatus }).then(() => {
        t.status = newStatus;
        loadAdminTickets(); // Refresh table
        showAlert(`Ticket ${newStatus}.`, "Success");
    });
};

window.deleteAdminTicket = function() {
    if(!currentAdminTicketId) return;
    showConfirm("Permanently delete this ticket?", () => {
        remove(ref(database, `tickets/${currentAdminTicketId}`))
            .then(() => {
                closePopup('.admin-ticket-popup');
                showAlert("Ticket deleted.", "Deleted");
            })
            .catch(e => showAlert(e.message, "Error"));
    });
};

window.setupAdminRealtimeListeners = async function() {
    // REFACTOR: This system now polls a single, secure API endpoint for stats
    // instead of using expensive real-time listeners on the entire database.
    // This is vastly more performant and secure.

    if (window.adminStatsInterval) clearInterval(window.adminStatsInterval);

    // Request Browser Notification Permission for Admins
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    let lastPendingCount = -1;

    const fetchAdminStats = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const token = await user.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;

            const stats = await res.json();
            
            // Update dashboard stat cards
            renderAdminStats(stats);

            // Update notification badges
            updateAdminBadges('tickets', stats.openTicketsCount);
            updateAdminBadges('orders', stats.pendingCount);

            // Trigger browser notification if new pending orders arrived
            if (lastPendingCount !== -1 && stats.pendingCount > lastPendingCount) {
                showAlert("New Order Received!", "Admin Alert");
                if (Notification.permission === "granted") {
                    new Notification("New Order Received!", {
                        body: `You have ${stats.pendingCount} pending orders waiting for verification.`,
                        icon: "logo.png"
                    });
                }
            }
            lastPendingCount = stats.pendingCount;

        } catch (error) {
            console.error("Failed to fetch admin stats:", error);
        }
    };

    // Fetch immediately on load, then poll every 30 seconds
    fetchAdminStats();
    window.adminStatsInterval = setInterval(fetchAdminStats, 30000); // 30 seconds
};
window.updateAdminBadges = function(type, count) {
    const sidebarBadge = document.getElementById('admin-sidebar-badge');
    const tabBadge = document.getElementById(`admin-${type}-badge`);
    
    // Update Tab Badge (Red Dot)
    // Store global count
    if (!window.adminCounts) window.adminCounts = { orders: 0, tickets: 0 };
    window.adminCounts[type] = count;
    
    // Check if tab is currently active
    const tabContent = document.getElementById(`admin-tab-${type}`);
    const isTabActive = tabContent && tabContent.style.display !== 'none';

    // Get last seen count
    let lastSeen = parseInt(localStorage.getItem(`zynex_admin_seen_${type}`) || '0');

    // If viewing tab, or if count decreased (items processed), update seen count
    if (isTabActive || count < lastSeen) {
        lastSeen = count;
        localStorage.setItem(`zynex_admin_seen_${type}`, count);
    }
    
    // Update Tab Badge (Red Dot) - Show only if new items exist
    if(tabBadge) {
        tabBadge.style.display = (count > lastSeen) ? 'inline-block' : 'none';
    }

    // Update Sidebar Badge (Total Unseen Count)
    let totalUnseen = 0;
    ['orders', 'tickets'].forEach(t => {
        const c = window.adminCounts[t] || 0;
        const s = parseInt(localStorage.getItem(`zynex_admin_seen_${t}`) || '0');
        if (c > s) totalUnseen += (c - s);
    });

    if(sidebarBadge) {
        sidebarBadge.innerText = totalUnseen > 99 ? '99+' : totalUnseen;
        sidebarBadge.style.display = totalUnseen > 0 ? 'inline-block' : 'none';
    }
};

window.filterAdminTickets = function() {
    const search = document.getElementById('admin-ticket-search').value.toLowerCase();
    const filter = document.getElementById('admin-ticket-filter').value;
    
    if(!window.allAdminTickets) return;
    
    const filtered = window.allAdminTickets.filter(t => {
        const matchesSearch = t.subject.toLowerCase().includes(search) || t.username.toLowerCase().includes(search) || t.id.includes(search);
        const matchesFilter = filter === 'all' || t.status === filter;
        return matchesSearch && matchesFilter;
    });
    
    renderAdminTicketsTable(filtered);
};

// ================= NOTIFICATIONS SYSTEM =================

window.setupUserNotifications = function(user) {
    // 2. Ticket Updates
    const ticketsRef = ref(database, 'tickets');
    onChildChanged(ticketsRef, (snapshot) => {
        const ticket = snapshot.val();
        if (ticket.userId === user.uid) {
            // Check if it was a status change or reply
            // Simple check: if status changed to closed
            if (ticket.status === 'closed') {
                showAlert(`Ticket #${ticket.id.slice(-4)} has been closed.`, "Support");
            } else {
                // Assume it's a reply if it's still open and changed
                // To be precise we'd check replies count, but this is a decent proxy for "activity"
                showAlert(`New update on Ticket #${ticket.id.slice(-4)}`, "Support");
            }
        }
    });
};

// ================= GIVEAWAY SYSTEM =================
// --- ADMIN SIDE ---
window.loadAdminGiveaways = function() {
    if(window.adminGiveawaysUnsub) window.adminGiveawaysUnsub();

    window.adminGiveawaysUnsub = onValue(ref(database, 'giveaways'), (snap) => {
        const listContainer = document.getElementById('admin-giveaways-list');
        if(!listContainer) return;
        
        listContainer.innerHTML = '';
        if(!snap.exists()) {
            listContainer.innerHTML = '<p style="grid-column:1/-1; color:#999; text-align:center;">No giveaways created yet.</p>';
            window.allGiveaways = [];
            return;
        }

        const giveaways = [];
        snap.forEach(c => { giveaways.push({id: c.key, ...c.val()}); });
        giveaways.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
        window.allGiveaways = giveaways;

        // Fetch entries count for all to display on cards
        get(ref(database, 'giveaway_entries')).then(entriesSnap => {
            const allEntries = entriesSnap.exists() ? entriesSnap.val() : {};
            let html = '';

            giveaways.forEach(g => {
                const statusColor = g.isActive ? '#00c853' : '#999';
                const statusText = g.isActive ? 'Active' : 'Ended';
                const entriesCount = allEntries[g.id] ? Object.keys(allEntries[g.id]).length : 0;
                const imgBg = g.imageUrl ? `background-image: url('${sanitize(g.imageUrl)}');` : `background: linear-gradient(135deg, #5c6cff, #8c52ff);`;
                
                html += `
                    <div class="admin-ga-card">
                        <div class="admin-ga-thumb" style="${imgBg}">
                            <div style="position:absolute; top:10px; right:10px; display:flex; align-items:center; gap:5px; font-size:0.75rem; color:#fff; font-weight:600; background:rgba(0,0,0,0.6); padding:4px 10px; border-radius:12px;">
                                <div style="width:8px; height:8px; border-radius:50%; background:${statusColor};"></div> ${statusText}
                            </div>
                        </div>
                        <div class="admin-ga-content">
                            <h4 style="margin-bottom:5px; font-size:1.1rem;">${sanitize(g.title)}</h4>
                            <p style="color:#666; font-size:0.9rem; margin-bottom:5px;">Prize: <strong>${sanitize(g.prize)}</strong></p>
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <span style="color:#888; font-size:0.85rem;">Ends: ${g.endDate ? new Date(g.endDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'No limit'}</span>
                                <span style="color:#5c6cff; font-size:0.85rem; font-weight:600;">${entriesCount} Entries</span>
                            </div>
                            <div style="font-size:0.8rem; color:#888;">Winners Configured: <strong>${g.winnersCount || 1}</strong></div>
                            <div class="admin-ga-actions">
                                <button class="btn-outline" onclick="openManageGiveaway('${g.id}')">Manage</button>
                                <button class="btn-outline" style="flex:0 0 40px" onclick="toggleGiveawayActive('${g.id}', ${g.isActive})" title="${g.isActive ? 'Pause' : 'Activate'}"><ion-icon name="${g.isActive ? 'pause' : 'play'}"></ion-icon></button>
                                <button class="btn-outline" style="flex:0 0 40px" onclick="duplicateGiveaway('${g.id}')" title="Duplicate"><ion-icon name="copy"></ion-icon></button>
                            </div>
                        </div>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
        });
    });
};

window.toggleGiveawayActive = function(id, currentState) {
    update(ref(database, `giveaways/${id}`), { isActive: !currentState })
        .then(() => showAlert(`Giveaway successfully ${!currentState ? 'activated' : 'paused'}.`, "Success"));
};

window.duplicateGiveaway = function(id) {
    const g = window.allGiveaways.find(x => x.id === id);
    if(!g) return;
    showConfirm(`Are you sure you want to duplicate "${g.title}"?`, () => {
        const copy = { ...g, title: g.title + " (Copy)", isActive: false, winner: null, declined_winners: null, timestamp: Date.now() };
        delete copy.id;
        push(ref(database, 'giveaways'), copy).then(() => showAlert("Giveaway duplicated successfully.", "Success"));
    });
};

window.openCreateGiveawayPopup = function() {
    document.getElementById('cg-id').value = '';
    document.getElementById('cg-title').value = '';
    document.getElementById('cg-prize').value = '';
    document.getElementById('cg-image').value = '';
    document.getElementById('cg-desc').value = '';
    document.getElementById('cg-rules').value = '';
    document.getElementById('cg-end').value = '';
    document.getElementById('cg-winners-count').value = '1';
    document.getElementById('cg-active').checked = true;
    document.getElementById('cg-modal-title').innerText = 'Create Giveaway';
    openPopup('.create-giveaway-popup');
};

window.openEditGiveaway = function(id) {
    const g = window.allGiveaways.find(x => x.id === id);
    if(!g) return;
    
    document.getElementById('cg-id').value = g.id;
    document.getElementById('cg-title').value = g.title || '';
    document.getElementById('cg-prize').value = g.prize || '';
    document.getElementById('cg-image').value = g.imageUrl || '';
    document.getElementById('cg-desc').value = g.description || '';
    document.getElementById('cg-rules').value = g.rules || '';
    document.getElementById('cg-end').value = g.endDate || '';
    document.getElementById('cg-winners-count').value = g.winnersCount || 1;
    document.getElementById('cg-active').checked = g.isActive;
    document.getElementById('cg-modal-title').innerText = 'Edit Giveaway';
    
    closePopup('.manage-giveaway-popup');
    openPopup('.create-giveaway-popup');
};

window.saveGiveaway = function() {
    const id = document.getElementById('cg-id').value;
    const title = document.getElementById('cg-title').value.trim();
    const prize = document.getElementById('cg-prize').value.trim();
    
    if(!title || !prize) return showAlert("Title and Prize are required.");
    
    const data = {
        title, prize,
        imageUrl: document.getElementById('cg-image').value.trim(),
        description: document.getElementById('cg-desc').value.trim(),
        rules: document.getElementById('cg-rules').value.trim(),
        endDate: document.getElementById('cg-end').value,
        winnersCount: parseInt(document.getElementById('cg-winners-count').value) || 1,
        isActive: document.getElementById('cg-active').checked
    };
    
    if(id) {
        update(ref(database, `giveaways/${id}`), data).then(() => {
            showAlert("Giveaway updated.");
            closePopup('.create-giveaway-popup');
        });
    } else {
        data.timestamp = Date.now();
        push(ref(database, 'giveaways'), data).then(() => {
            showAlert("Giveaway created.");
            closePopup('.create-giveaway-popup');
        });
    }
};

window.deleteGiveaway = function(id) {
    showConfirm("Are you sure you want to delete this giveaway and all its entries?", () => {
        remove(ref(database, `giveaways/${id}`));
        remove(ref(database, `giveaway_entries/${id}`));
        closePopup('.manage-giveaway-popup');
        showAlert("Giveaway deleted.");
    });
};

window.currentMgId = null;

window.openManageGiveaway = function(id) {
    window.currentMgId = id;
    switchMgTab('details');
    
    const g = window.allGiveaways.find(x => x.id === id);
    document.getElementById('mg-title').innerText = sanitize(g.title);
    
    get(ref(database, `giveaway_entries/${id}`)).then(snap => {
        const tbody = document.getElementById('mg-entries-body');
        const countEl = document.getElementById('mg-entries-count');
        tbody.innerHTML = '';
        if(!snap.exists()) {
            countEl.innerText = '0';
            window.currentGiveawayEntries = [];
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No entries</td></tr>';
            return;
        }
        
        const entries = [];
        snap.forEach(c => { entries.push(c.val()); });
        entries.sort((a,b) => b.timestamp - a.timestamp);
        window.currentGiveawayEntries = entries;
        countEl.innerText = entries.length;
        
        entries.forEach(e => {
            tbody.innerHTML += `<tr>
                <td>${sanitize(e.username)}<br><small>${sanitize(e.email)}</small></td>
                <td>@${sanitize(e.igHandle)}</td>
                <td>${new Date(e.timestamp).toLocaleDateString()}</td>
            </tr>`;
        });
        
        renderWinnerTab(g);
    });
    
    openPopup('.manage-giveaway-popup');
};

window.switchMgTab = function(tab) {
    ['details', 'entries', 'winner'].forEach(t => {
        document.getElementById(`mg-tab-${t}`).style.display = (t === tab) ? 'block' : 'none';
        document.getElementById(`btn-mg-${t}`).classList.remove('active');
    });
    document.getElementById(`btn-mg-${tab}`).classList.add('active');
};

window.renderWinnerTab = function(g) {
    const content = document.getElementById('mg-winner-content');
    let html = '';
    
    const winnersList = g.winners || (g.winner ? [g.winner] : []);
    
    if(winnersList.length > 0) {
        html += `<h4 style="color:#2e7d32; margin-bottom:10px;">Current Winner(s)</h4>`;
        winnersList.forEach(w => {
            html += `
                <div style="background:#e8f5e9; padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #c8e6c9; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <p style="margin:0;"><strong>${sanitize(w.username)}</strong> (@${sanitize(w.igHandle)})</p>
                        <p style="font-size:0.8rem; color:#666; margin:5px 0 0 0;">Picked: ${new Date(w.timestamp).toLocaleDateString()}</p>
                    </div>
                    <button class="btn-outline" style="color:#e65100; border-color:#ffe0b2; padding:6px 12px; font-size:0.8rem;" onclick="rerollGiveaway('${g.id}', '${w.userId}')">Reroll</button>
                </div>
            `;
        });
        
        if (winnersList.length < (g.winnersCount || 1)) {
            html += `<button class="cta" style="width:100%; margin-bottom:15px;" onclick="pickWinner('${g.id}')">Pick ${ (g.winnersCount || 1) - winnersList.length } More Winner(s)</button>`;
        }
    } else {
        html += `
            <p style="color:#666; margin-bottom:15px;">No winners picked yet (Target: ${g.winnersCount || 1}).</p>
            <button class="cta" style="width:100%; margin-bottom:15px;" onclick="pickWinner('${g.id}')">Pick Winner(s)</button>
        `;
    }
    
    if(g.declined_winners && Object.keys(g.declined_winners).length > 0) {
        html += `<h4 style="margin-top:20px; margin-bottom:10px;">Reroll History</h4><ul style="font-size:0.85rem; color:#666; padding-left:20px;">`;
        Object.values(g.declined_winners).forEach(dw => {
            html += `<li style="margin-bottom:5px;"><strong>@${sanitize(dw.igHandle)}</strong> - ${sanitize(dw.reason || 'Simple Reroll')} <br><small>${new Date(dw.timestamp).toLocaleDateString()}</small></li>`;
        });
        html += `</ul>`;
    }
    
    content.innerHTML = html;
};

window.pickWinner = function(id) {
    const entries = window.currentGiveawayEntries || [];
    const g = window.allGiveaways.find(x => x.id === id);
    
    const declinedIds = g.declined_winners ? Object.keys(g.declined_winners) : [];
    const existingWinnerIds = g.winners ? g.winners.map(w => w.userId) : (g.winner ? [g.winner.userId] : []);
    
    let validEntries = entries.filter(e => !declinedIds.includes(e.userId) && !existingWinnerIds.includes(e.userId));
    
    const countNeeded = (g.winnersCount || 1) - existingWinnerIds.length;
    
    if(countNeeded <= 0) return showAlert("All required winners have already been picked.");
    if(validEntries.length === 0) return showAlert("Not enough valid entries left to pick.");
    
    let newWinners = [];
    for(let i=0; i < countNeeded && validEntries.length > 0; i++) {
        const idx = Math.floor(Math.random() * validEntries.length);
        newWinners.push(validEntries[idx]);
        validEntries.splice(idx, 1); // remove picked to avoid duplicates
    }
    
    const updatedWinners = [...(g.winners || (g.winner ? [g.winner] : [])), ...newWinners.map(w => ({
        userId: w.userId, username: w.username, igHandle: w.igHandle, timestamp: Date.now()
    }))];
    
    update(ref(database, `giveaways/${id}`), {
        winners: updatedWinners,
        winner: null, // Legacy wipe
        isActive: false
    }).then(() => {
        g.winners = updatedWinners;
        g.isActive = false;
        renderWinnerTab(g);
        showAlert(`${newWinners.length} winner(s) picked!`);
    });
};

window.rerollGiveaway = function(id, winnerUserId) {
    const g = window.allGiveaways.find(x => x.id === id);
    const winnersList = g.winners || (g.winner ? [g.winner] : []);
    const targetWinner = winnersList.find(w => w.userId === winnerUserId);
    
    if(!g || !targetWinner) return;
    
    showPrompt("Reason for declining previous winner (Leave blank for simple reroll):", (reason) => {
        const remainingWinners = winnersList.filter(w => w.userId !== winnerUserId);
        const updates = {};
        updates[`giveaways/${id}/declined_winners/${targetWinner.userId}`] = {
            ...targetWinner,
            reason: reason || 'Simple Reroll',
            timestamp: Date.now()
        };
        updates[`giveaways/${id}/winners`] = remainingWinners;
        updates[`giveaways/${id}/winner`] = null;
        updates[`giveaways/${id}/isActive`] = true;
        
        update(ref(database), updates).then(() => {
            g.declined_winners = g.declined_winners || {};
            g.declined_winners[targetWinner.userId] = { ...targetWinner, reason: reason || 'Simple Reroll', timestamp: Date.now() };
            g.winners = remainingWinners;
            g.isActive = true;
            renderWinnerTab(g);
            showAlert(`@${targetWinner.igHandle} declined. You can pick a replacement.`);
        });
    });
};

// --- PUBLIC SIDE ---
window.submitGiveawayEntry = function() {
    clearInlineErrors();
    const user = auth.currentUser;
    if (!user) return showAlert("Please login to enter the giveaway.", "Login Required");

    const gaId = document.getElementById('entry-ga-id').value;
    const igHandle = document.getElementById('entry-ig-handle').value.trim();
    if (!igHandle) return showInlineError('error-entry-handle', 'Please enter your Instagram username.');

    const entryRef = ref(database, `giveaway_entries/${gaId}/${user.uid}`);
    
    get(entryRef).then((snapshot) => {
        if (snapshot.exists()) {
            showAlert("You have already entered this giveaway!", "Already Entered");
            closePopup('.giveaway-entry-popup');
        } else {
            const updates = {};
            updates[`giveaway_entries/${gaId}/${user.uid}`] = {
                userId: user.uid,
                email: user.email,
                username: user.displayName || 'User',
                igHandle: igHandle,
                timestamp: Date.now()
            };
            updates[`giveaway_user_entries/${user.uid}/${gaId}`] = igHandle;
            
            update(ref(database), updates).then(() => {
                showAlert("You've successfully entered the giveaway! Good luck!", "Success");
                closePopup('.giveaway-entry-popup');
                document.getElementById('entry-ig-handle').value = '';
            }).catch(err => showAlert(err.message, "Error"));
        }
    });
};

window.loadGiveawayPage = function() {
    const container = document.getElementById('giveaway-page-content');
    const loadingState = document.getElementById('giveaway-loading-state'); // This will be hidden once content is loaded
    const loggedOutMessage = document.getElementById('giveaway-logged-out-message'); // This will be hidden

    if(!container || !loadingState || !loggedOutMessage) { // Ensure all elements exist
        console.warn("Giveaway page elements not found.");
        return; // Exit if elements are missing
    }

    // Always start by showing loading and hiding others, then show container
    loadingState.style.display = 'block';
    loggedOutMessage.style.display = 'none';
    container.style.display = 'block'; // Always show the main content container

    const user = auth.currentUser; // Get current user from Firebase Auth

    if(window.gaPageUnsub) {
        window.gaPageUnsub(); // Unsubscribe from previous listener if any
        window.gaPageUnsub = null;
    }

    if (!user) {
        // If user is logged out, we still want to load and display giveaways.
        // The buttons will reflect the logged-out state.
        // No need to return here, proceed to fetch giveaways.
    }

    // User is logged in, proceed to load giveaways
    window.gaPageUnsub = onValue(ref(database, 'giveaways'), snap => {
        loadingState.style.display = 'none'; // Hide loading once data starts coming
        loggedOutMessage.style.display = 'none'; // Hide logged out message

        if(!snap.exists()) {
            container.innerHTML = `<div class="stat-card" style="text-align:center; padding: 60px 20px;">
                <ion-icon name="sad-outline" style="font-size: 64px; color: #ccc; margin-bottom: 15px;"></ion-icon>
                <h2>No Giveaways</h2>
                <p style="color: #666; margin-top: 10px;">There are no giveaways currently. Keep an eye out for future updates!</p>
            </div>`;
            return;
        }

        const giveaways = [];
        snap.forEach(c => { giveaways.push({id: c.key, ...c.val()}); });
        giveaways.sort((a,b) => (b.isActive === a.isActive) ? (b.timestamp - a.timestamp) : (b.isActive ? -1 : 1));

        if(user) {
            get(ref(database, `giveaway_user_entries/${user.uid}`)).then(entrySnap => {
                const userEntries = entrySnap.exists() ? entrySnap.val() : {};
                renderGiveawaysList(giveaways, userEntries, user, container);
            }).catch(err => {
                console.error("Error fetching user entries:", err);
                renderGiveawaysList(giveaways, {}, user, container);
            });
        } else {
            renderGiveawaysList(giveaways, {}, null, container);
            // If user is null, renderGiveawaysList will handle the buttons
        }
    });
};

function renderGiveawaysList(giveaways, userEntries, user, container) {
    let html = '';
    
    giveaways.forEach(g => {
        const hasEntered = !!userEntries[g.id];
        const userIgHandle = userEntries[g.id] || '';
        
        let rulesHtml = '';
        if(g.rules) {
            g.rules.split('\n').forEach(r => {
                if(r.trim()) rulesHtml += `<li><ion-icon name="checkmark-circle"></ion-icon> <span>${sanitize(r)}</span></li>`;
            });
        } else {
            rulesHtml = `<li><ion-icon name="checkmark-circle"></ion-icon> <span>Follow our Instagram</span></li>`;
        }
        
        const isEnded = !g.isActive;
        const winnersList = g.winners || (g.winner ? [g.winner] : []);
        const imgBg = g.imageUrl ? `background-image: url('${sanitize(g.imageUrl)}');` : `background: linear-gradient(135deg, #ff416c, #ff4b2b);`;
        
        let actionHtml = '';
        if (isEnded) {
            if(winnersList.length > 0) {
                const handlesHtml = winnersList.map(w => `<div class="winner-handle" style="font-size:1rem; padding:8px 20px; margin:5px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">@${sanitize(w.igHandle)}</div>`).join('');
                actionHtml = `
                    <div class="ga-modern-action" style="background: linear-gradient(135deg, #FFD700 0%, #FFA000 100%); padding:20px; border-radius:12px; text-align:center; color:#fff;">
                        <ion-icon name="trophy" style="font-size: 40px; margin-bottom: 10px;"></ion-icon>
                        <h3 style="margin-bottom:15px; font-size:1.3rem;">Giveaway Ended!</h3>
                        <p style="font-size:0.9rem; margin-bottom:10px; opacity:0.9;">Congratulations to our winner(s):</p>
                        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:5px;">${handlesHtml}</div>
                    </div>
                `;
            } else {
                actionHtml = `<div class="ga-modern-action" style="text-align:center; padding:20px; color:#999; background:#f9f9f9; border-radius:12px;">Giveaway Ended</div>`;
            }
        } else {
            if (hasEntered) { // User is logged in AND has entered
                actionHtml = `
                    <div class="ga-modern-action entered-badge" style="margin:0; padding:15px; flex-direction:row; justify-content:center;">
                        <ion-icon name="checkmark-circle" style="font-size:32px;"></ion-icon>
                        <div>
                            <h4 style="margin:0; font-size:1.1rem;">You're In!</h4>
                            <p style="margin:0; font-size:0.85rem;">Registered as @${sanitize(userIgHandle)}</p>
                        </div>
                    </div>
                `;
            } else { // User is logged in OR logged out, but has NOT entered
                actionHtml = `
                    <div class="ga-modern-action">
                        <button class="cta" onclick="openGiveawayPopup('${g.id}')" style="width: 100%; padding:15px; font-size:1.1rem; background: linear-gradient(135deg, #ff416c, #ff4b2b); box-shadow: 0 5px 15px rgba(255, 65, 108, 0.3);">
                            <ion-icon name="gift-outline"></ion-icon> Enter Giveaway Now
                        </button>
                    </div>
                `;
            }
        }

        const opacity = isEnded ? '0.7' : '1';

        html += `
            <div class="giveaway-card-modern" style="opacity:${opacity};" id="ga-container-${g.id}">
                <div class="ga-modern-banner" style="${imgBg}">
                    ${isEnded ? `<div class="ga-modern-badge ended">Ended</div>` : `<div class="ga-modern-badge">Active</div>`}
                    <div class="ga-modern-title-area">
                        <h2>${sanitize(g.title || 'Giveaway')}</h2>
                        <p>${sanitize(g.description || '')}</p>
                    </div>
                </div>
                
                <div class="ga-modern-body">
                    <div class="ga-modern-info">
                        <div class="ga-modern-prize"><ion-icon name="gift"></ion-icon> ${sanitize(g.prize || 'Surprise')}</div>
                        ${g.endDate && !isEnded ? `<div class="ga-modern-ends"><ion-icon name="time-outline"></ion-icon> Ends: ${new Date(g.endDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>` : ''}
                    </div>
                    
                    <div class="ga-modern-rules">
                        <h4><ion-icon name="list-outline" style="color:#5c6cff;"></ion-icon> How to Enter</h4>
                        <ul>${rulesHtml}</ul>
                    </div>
                    
                    ${actionHtml}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

window.showWinnerPopup = function(g, isWinner) {
    const existing = document.getElementById('winner-anim-container');
    if(existing) existing.remove();
    const container = document.createElement('div');
    container.id = 'winner-anim-container';
    container.className = 'popup winner-anim-popup';
    container.setAttribute('aria-hidden', 'false');
    let contentHtml = '';
    if (isWinner) {
        contentHtml = `
            <div class="winner-anim-card">
                <button class="close-icon" onclick="document.getElementById('winner-anim-container').remove()" style="position:absolute; top:15px; right:15px; background:none; border:none; color:white; font-size:2rem; cursor:pointer; z-index:10;">&times;</button>
                <ion-icon name="trophy" class="trophy-icon"></ion-icon>
                <h2>YOU WON!</h2>
                <p>Congratulations! You are a winner of <strong>${sanitize(g.title)}</strong>!</p>
                <div style="background:rgba(255,255,255,0.2); padding:15px; border-radius:12px; display:inline-block;">Prize: <strong>${sanitize(g.prize)}</strong></div>
                <p style="margin-top:20px; font-size:0.9rem;">We will contact you shortly to claim your prize!</p>
            </div>
        `;
    } else {
        let handlesStr = '';
        const winnersList = g.winners || (g.winner ? [g.winner] : []);
        if(winnersList.length > 0) {
            handlesStr = winnersList.map(w => `@${sanitize(w.igHandle)}`).join(', ');
        }
        
        contentHtml = `
            <div class="loser-anim-card">
                <button class="close-icon" onclick="document.getElementById('winner-anim-container').remove()" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#888; font-size:2rem; cursor:pointer; z-index:10;">&times;</button>
                <ion-icon name="gift-outline" class="sad-icon"></ion-icon>
                <h2>Giveaway Ended</h2>
                <p>The winner for <strong>${sanitize(g.title)}</strong> has been announced!</p>
                <div style="background:#fff; padding:15px; border-radius:12px; display:inline-block; border:1px solid #eee; margin-bottom:15px; max-width:100%; overflow:hidden;">Winner(s): <strong>${handlesStr}</strong></div>
                <p style="font-size:0.9rem; font-weight:600; color:#5c6cff;">Better luck next time! Stay tuned for more giveaways.</p>
            </div>
        `;
    }
    container.innerHTML = `<div class="popup-content">${contentHtml}</div>`;
    document.body.appendChild(container);
};

window.checkGiveawayWinners = function(user) {
    if(!user) return;
    get(ref(database, `giveaway_user_entries/${user.uid}`)).then(snap => {
        if(!snap.exists()) return;
        const enteredGiveaways = snap.val();
        onValue(ref(database, 'giveaways'), gSnap => {
             if(!gSnap.exists()) return;
             const seen = JSON.parse(localStorage.getItem(`zynex_seen_winners_${user.uid}`) || '{}');
             gSnap.forEach(child => {
                 const g = child.val();
                 const gid = child.key;
                 const winnersList = g.winners || (g.winner ? [g.winner] : []);
                 
                 if(!g.isActive && winnersList.length > 0 && enteredGiveaways[gid] && !seen[gid]) {
                     const isWinner = winnersList.some(w => w.userId === user.uid);
                     setTimeout(() => showWinnerPopup(g, isWinner), 1000);
                     seen[gid] = true;
                     localStorage.setItem(`zynex_seen_winners_${user.uid}`, JSON.stringify(seen));
                 }
             });
        });
    });
};

// ================= REVIEW SYSTEM =================

window.openReviewPopup = function() {
    const user = auth.currentUser;
    if (!user) {
        showAlert("Please login to write a review.", "Login Required");
        return;
    }
    // Reset form
    document.getElementById('review-rating-value').value = '0';
    document.getElementById('review-text').value = '';
    document.querySelectorAll('.star-rating-input ion-icon').forEach(i => {
        i.classList.remove('active');
        i.setAttribute('name', 'star-outline');
    });
    openPopup('.review-popup');
};

window.setRating = function(rating) {
    document.getElementById('review-rating-value').value = rating;
    const stars = document.querySelectorAll('.star-rating-input ion-icon');
    stars.forEach(star => {
        const val = parseInt(star.getAttribute('data-value'));
        if (val <= rating) {
            star.classList.add('active');
            star.setAttribute('name', 'star');
        } else {
            star.classList.remove('active');
            star.setAttribute('name', 'star-outline');
        }
    });
};

window.submitReview = function() {
    const user = auth.currentUser;
    if (!user) return;

    const rating = document.getElementById('review-rating-value').value;
    const text = document.getElementById('review-text').value.trim();

    if (rating == '0') { showAlert("Please select a star rating."); return; }
    if (!text) { showAlert("Please write a short review."); return; }

    const reviewData = {
        userId: user.uid,
        username: user.displayName || 'User',
        rating: parseInt(rating),
        text: text,
        timestamp: Date.now()
    };

    push(ref(database, 'reviews'), reviewData)
        .then(() => {
            showAlert("Thank you for your feedback!", "Review Submitted");
            closePopup('.review-popup');
                if (document.getElementById('public-reviews-grid')) loadPublicReviews();
                if (document.getElementById('all-reviews-grid')) loadAllReviews();
        })
        .catch(err => showAlert(err.message, "Error"));
};

window.loadAllReviews = function() {
    const container = document.getElementById('all-reviews-grid');
    if (!container) return;

    // Fetch all reviews for the dedicated page
    get(ref(database, 'reviews')).then((snapshot) => {
        if (snapshot.exists()) {
            container.innerHTML = '';
            const reviews = [];
            let totalRating = 0;
            
            snapshot.forEach(child => {
                const r = child.val();
                reviews.push(r);
                totalRating += (Number(r.rating) || 0);
            });

            const avgRating = (totalRating / reviews.length).toFixed(1);
            
            const avgNumEl = document.getElementById('avg-rating-number');
            const avgStarsEl = document.getElementById('avg-rating-stars');
            const totalCountEl = document.getElementById('total-reviews-count');

            if (avgNumEl) avgNumEl.innerText = avgRating;
            if (totalCountEl) totalCountEl.innerText = `Based on ${reviews.length} review${reviews.length > 1 ? 's' : ''}`;
            if (avgStarsEl) {
                const fullStars = Math.floor(avgRating);
                const hasHalfStar = (avgRating - fullStars) >= 0.5;
                avgStarsEl.innerHTML = Array(5).fill(0).map((_, i) => `<ion-icon name="${i < fullStars ? 'star' : (i === fullStars && hasHalfStar ? 'star-half-outline' : 'star-outline')}"></ion-icon>`).join('');
            }

            // Show newest first
            reviews.reverse().forEach(r => {
                const starsHtml = Array(5).fill(0).map((_, i) => 
                    `<ion-icon name="${i < r.rating ? 'star' : 'star-outline'}"></ion-icon>`
                ).join('');
                
                const initial = r.username ? r.username.charAt(0).toUpperCase() : 'U';

                const html = `
                    <div class="review-card">
                        <div class="review-header">
                            <div class="review-avatar">${initial}</div>
                            <div class="review-info">
                                <h4>${sanitize(r.username)}</h4>
                                <span>Verified User</span>
                            </div>
                        </div>
                        <div class="review-stars">${starsHtml}</div>
                        <div class="review-text">"${sanitize(r.text)}"</div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999;">No reviews yet. Be the first to rate us!</p>';
            const totalCountEl = document.getElementById('total-reviews-count');
            const avgNumEl = document.getElementById('avg-rating-number');
            if (totalCountEl) totalCountEl.innerText = 'No reviews yet';
            if (avgNumEl) avgNumEl.innerText = '0.0';
        }
    });
};

window.loadPublicReviews = function() {
    const container = document.getElementById('public-reviews-grid');
    if (!container) return;

    // Get last 6 reviews
    const reviewsQuery = query(ref(database, 'reviews'), limitToLast(6));
    
    get(reviewsQuery).then((snapshot) => {
        if (snapshot.exists()) {
            container.innerHTML = '';
            const reviews = [];
            let totalRating = 0;
            
            snapshot.forEach(child => {
                const r = child.val();
                reviews.push(r);
                totalRating += (Number(r.rating) || 0);
            });

            const avgRating = (totalRating / reviews.length).toFixed(1);
            
            // Update Summary Card
            const avgNumEl = document.getElementById('avg-rating-number');
            const avgStarsEl = document.getElementById('avg-rating-stars');
            const totalCountEl = document.getElementById('total-reviews-count');

            if (avgNumEl) avgNumEl.innerText = avgRating;
            if (totalCountEl) totalCountEl.innerText = `Based on ${reviews.length} review${reviews.length > 1 ? 's' : ''}`;
            if (avgStarsEl) {
                const fullStars = Math.floor(avgRating);
                const hasHalfStar = (avgRating - fullStars) >= 0.5;
                avgStarsEl.innerHTML = Array(5).fill(0).map((_, i) => `<ion-icon name="${i < fullStars ? 'star' : (i === fullStars && hasHalfStar ? 'star-half-outline' : 'star-outline')}"></ion-icon>`).join('');
            }

            // Show newest first
            reviews.reverse().forEach(r => {
                const starsHtml = Array(5).fill(0).map((_, i) => 
                    `<ion-icon name="${i < r.rating ? 'star' : 'star-outline'}"></ion-icon>`
                ).join('');
                
                const initial = r.username ? r.username.charAt(0).toUpperCase() : 'U';

                const html = `
                    <div class="review-card">
                        <div class="review-header">
                            <div class="review-avatar">${initial}</div>
                            <div class="review-info">
                                <h4>${sanitize(r.username)}</h4>
                                <span>Verified User</span>
                            </div>
                        </div>
                        <div class="review-stars">${starsHtml}</div>
                        <div class="review-text">"${sanitize(r.text)}"</div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999;">No reviews yet. Be the first to rate us!</p>';
            const totalCountEl = document.getElementById('total-reviews-count');
            const avgNumEl = document.getElementById('avg-rating-number');
            if (totalCountEl) totalCountEl.innerText = 'No reviews yet';
            if (avgNumEl) avgNumEl.innerText = '0.0';
        }
    });
};