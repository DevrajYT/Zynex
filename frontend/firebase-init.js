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
window.BACKEND_URL = "https://zynex-backend.onrender.com"; // Made global for services.html

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
                // Reload to ensure displayName is propagated
                setTimeout(() => window.location.reload(), 1000);
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
      <div class="header-user" onclick="window.location.href='account.html'">
          <ion-icon name="person-outline"></ion-icon>
          <span>${username}</span>
      </div>`;
        }
        if (dashboardContent) dashboardContent.style.display = 'block';
        if (loggedOutContent) loggedOutContent.style.display = 'none';
        if (profileSection) profileSection.style.display = 'block';
        if (notLoggedInProfile) notLoggedInProfile.style.display = 'none';
        if (ordersContent) ordersContent.style.display = 'block';
        if (loggedOutOrders) loggedOutOrders.style.display = 'none';

        // --- Admin Check ---
        const admins = ["devraj85271@gmail.com", "kansh8042@gmail.com"];
        if (admins.includes(user.email)) {
            if(adminSectionTitle) adminSectionTitle.style.display = "block";
            if(adminNavList) adminNavList.style.display = "flex";
            setupAdminRealtimeListeners(); // Start listening for red dots
        } else {
            if(adminSectionTitle) adminSectionTitle.style.display = "none";
            if(adminNavList) adminNavList.style.display = "none";
        }

        // --- Notification Badge Check on Load ---
        const updateCount = parseInt(localStorage.getItem(`zynex_order_update_count_${user.uid}`) || '0');
        const onOrdersPage = window.location.href.includes('orders.html');
        const badge = document.getElementById('orders-nav-badge');

        if (onOrdersPage) {
            // On orders page, clear the flag and hide the badge
            localStorage.setItem(`zynex_order_update_count_${user.uid}`, '0');
            if (badge) badge.style.display = 'none';
        } else if (updateCount > 0 && badge) {
            // Not on orders page, but there is a new update
            badge.style.display = 'inline-block';
            badge.innerText = updateCount > 99 ? '99+' : updateCount;
        } else if (badge) {
            badge.style.display = 'none';
        }

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

        // --- Load Admin Dashboard if on admin page ---
        if (document.getElementById('admin-orders-body')) {
            loadAdminDashboard(user);
        }

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
                if (onOrdersPage) {
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
                if (data.photoURL) {
                    const imgEl = document.getElementById("profileImage");
                    const iconEl = document.getElementById("defaultProfileIcon");
                    if (imgEl) { imgEl.src = data.photoURL; imgEl.style.display = "block"; }
                    if (iconEl) iconEl.style.display = "none";
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
      <button class="get-started-btn" onclick="window.location.href='account.html?login=true'">
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
            window.location.href = 'account.html';
        }
    }
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

// ================= SYNC BADGE ACROSS TABS =================
window.addEventListener('storage', (e) => {
    const user = auth.currentUser;
    if (!user) return;
    
    if (e.key === `zynex_order_update_count_${user.uid}`) {
        const count = parseInt(e.newValue || '0');
        const badge = document.getElementById('orders-nav-badge');
        const onOrdersPage = window.location.href.includes('orders.html');

        if (badge) {
            if (count > 0 && !onOrdersPage) {
                badge.style.display = 'inline-block';
                badge.innerText = count > 99 ? '99+' : count;
            } else {
                badge.style.display = 'none';
            }
        }
    }
});


// Change Profile Image (Preview Only)
document.getElementById("imageUpload")?.addEventListener("change", function (evt) {
    const file = evt.target.files[0];
    if (file) uploadProfileImage(file);
});

window.uploadProfileImage = async function (file) {
    // Cloudinary Config
    // Cloud Name: zynexcloud
    // Preset: zynex (Must be 'Unsigned' in Cloudinary Settings)
    const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/zynexcloud/image/upload";
    const CLOUDINARY_UPLOAD_PRESET = "zynex";

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
        const res = await fetch(CLOUDINARY_URL, {
            method: "POST",
            body: form,
        });

        const data = await res.json();

        if (res.ok && data.secure_url) {
            const imgEl = document.getElementById("profileImage");
            const iconEl = document.getElementById("defaultProfileIcon");
            if(imgEl) { imgEl.src = data.secure_url; imgEl.style.display = "block"; }
            if(iconEl) iconEl.style.display = "none";

            const user = auth.currentUser;
            if (user) {
                // Update both Firebase Auth profile and Realtime Database
                await updateProfile(user, { photoURL: data.secure_url });
                await set(ref(database, "users/" + user.uid + "/photoURL"), data.secure_url);
            }

            showAlert("Profile picture updated!", "Success");
        } else throw "Upload failed";

    } catch (err) {
        console.error(err);
        showAlert("Upload failed. Please try again.", "Error");
    }
};

// ================= SETTINGS LOGIC =================

window.resetPassword = function() {
    const user = auth.currentUser;
    if(user && user.email) {
        showConfirm("Send password reset email to " + user.email + "?", () => {
            sendPasswordResetEmail(auth, user.email)
                .then(() => showAlert("Password reset email sent! Check your inbox.", "Sent"))
                .catch(e => showAlert("Error: " + e.message));
        });
    } else {
        showAlert("No email associated with this account.");
    }
};

window.handleChangePassword = function() {
    clearInlineErrors();
    const oldPass = document.getElementById('cp-old').value;
    const newPass = document.getElementById('cp-new').value;
    const confirmPass = document.getElementById('cp-confirm').value;

    let hasError = false;
    if (!oldPass) { showInlineError('error-cp-old', 'Current password is required'); hasError = true; }
    if (!newPass) { showInlineError('error-cp-new', 'New password is required'); hasError = true; }
    if (!confirmPass) { showInlineError('error-cp-confirm', 'Confirm password is required'); hasError = true; }
    
    if (newPass !== confirmPass) {
        showInlineError('error-cp-confirm', "New passwords do not match.");
        hasError = true;
    } else if (newPass && newPass.length < 6) {
        showInlineError('error-cp-new', "Password should be at least 6 characters.");
        hasError = true;
    }

    if(hasError) return;

    const user = auth.currentUser;
    if (!user) return;

    const credential = EmailAuthProvider.credential(user.email, oldPass);

    reauthenticateWithCredential(user, credential).then(() => {
        updatePassword(user, newPass).then(() => {
            showAlert("Password updated successfully!", "Success");
            closePopup('.change-password-popup');
            document.getElementById('cp-old').value = '';
            document.getElementById('cp-new').value = '';
            document.getElementById('cp-confirm').value = '';
        }).catch(err => showAlert(err.message, "Update Error"));
    }).catch(err => {
        showInlineError('error-cp-old', "Incorrect old password.");
    });
};

window.deleteAccount = function() {
    showConfirm("Are you sure you want to delete your account? This action cannot be undone.", () => {
        const user = auth.currentUser;
        deleteUser(user).then(() => {
            showAlert("Account deleted.", "Goodbye");
            window.location.href = "index.html";
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

window.toggleOrderStatusNotifs = function(isChecked) {
    saveSetting('orderStatusNotifs', isChecked);
    if (isChecked && "Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
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
window.loadAdminDashboard = function(user) {
    console.log("Loading Admin Dashboard for:", user.email);
    const admins = ["devraj85271@gmail.com", "kansh8042@gmail.com"];

    if (!user || !admins.includes(user.email)) {
        document.querySelector('.content').innerHTML = "<h2 style='text-align:center; margin-top:50px; color:#ff4d4f'>Access Denied</h2><p style='text-align:center'>You do not have permission to view this page.</p>";
        return;
    }

    if (window.adminDashboardUnsub) window.adminDashboardUnsub();

    // Use onValue for real-time updates in Admin Dashboard
    window.adminDashboardUnsub = onValue(ref(database, 'users'), (snapshot) => {
        if (snapshot.exists()) {
            const users = snapshot.val();
            let allOrders = [];

            // Flatten orders from all users
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

            // Sort by timestamp desc (newest first)
            allOrders.sort((a, b) => b.timestamp - a.timestamp);
            window.allAdminOrders = allOrders; // Store for filtering
            renderAdminStats(allOrders);
            renderAdminTable(allOrders);
            renderAdminUsers(users); // New: Render Users Tab
        } else {
        }
    }, (error) => {
        console.error("Admin load error:", error);
        const tbody = document.getElementById('admin-orders-body');
        if(tbody) tbody.innerHTML = `<tr><td colspan='7' style='text-align:center; padding:20px; color:red'>Error loading data: ${error.message}<br><small>Check Database Rules if "Permission denied"</small></td></tr>`;
    });

    // Load current announcement for settings tab
    get(ref(database, 'system/announcement')).then(snap => {
        const input = document.getElementById('admin-announcement-input');
        if(input && snap.exists()) input.value = snap.val();
    });

    // Load tickets (already using onValue inside loadAdminTickets if we switch it)
    loadAdminTickets();
};

window.renderAdminStats = function(orders) {
    let totalRevenue = 0; // All non-cancelled orders
    let completedRevenue = 0; // Only completed orders
    let completedCost = 0; // Only completed orders
    let pendingCount = 0;

    // Cost prices provided by user
    const costPrices = {
        'Instagram': {
            'Followers': 0.13,
            'Likes': 0.02,
            'Views': 0.004,
            'Comments': 0.2,
            'Reel Repost': 0.07,
            'Reel Share': 0.003,
            'Story Views': 0.02
        },
        'YouTube': {
            'Subscribers': 2.8,
            'Likes': 0.06,
            'Views': 0.33,
            'Comment Likes': 0.0165
        }
    };

    orders.forEach(o => {
        if (o.status !== 'cancelled') {
            totalRevenue += (parseFloat(o.totalPrice) || 0);
        }
        if (o.status === 'completed') {
            completedRevenue += (parseFloat(o.totalPrice) || 0);
            // Calculate cost for completed orders
            if (costPrices[o.service] && costPrices[o.service][o.option] && o.amount) {
                const unitCost = costPrices[o.service][o.option];
                completedCost += (parseInt(o.amount) * unitCost);
            }
        }
        if (o.status === 'pending' || o.status === 'processing' || o.status === 'inprocess') {
            pendingCount++;
        }
    });

    const profit = completedRevenue - completedCost;

    window.currentAdminProfit = profit;

    const revEl = document.getElementById('admin-total-revenue');
    const ordEl = document.getElementById('admin-total-orders');
    const penEl = document.getElementById('admin-pending-orders');
    const profitEl = document.getElementById('admin-total-profit');

    if(revEl) revEl.innerText = "₹" + totalRevenue.toLocaleString('en-IN');
    if(ordEl) ordEl.innerText = orders.length;
    if(penEl) penEl.innerText = pendingCount;
    if(profitEl) {
        profitEl.innerText = "₹" + profit.toFixed(2);
        profitEl.style.color = profit >= 0 ? '#00c853' : '#ff4d4f';
    }

    // --- Profit Change Display ---
    const storedRef = localStorage.getItem('zynex_admin_ref_profit');
    const refProfit = storedRef ? parseFloat(storedRef) : 0;
    const change = profit - refProfit;

    let changeEl = document.getElementById('admin-profit-change');
    if (!changeEl && profitEl) {
        const card = profitEl.closest('.stat-card');
        if (card && card.parentNode) {
            const newCard = document.createElement('div');
            newCard.className = 'stat-card';
            newCard.innerHTML = `<h4>Profit Change</h4><p class="stat-value" id="admin-profit-change">₹0.00</p><button onclick="resetProfitChange()" style="background:#eee;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.8rem;margin-top:5px;color:#333">Reset</button>`;
            card.parentNode.insertBefore(newCard, card.nextSibling);
            changeEl = newCard.querySelector('#admin-profit-change');
        }
    }
    if (changeEl) {
        changeEl.innerText = (change >= 0 ? "+" : "") + "₹" + change.toFixed(2);
        changeEl.style.color = change >= 0 ? '#00c853' : '#ff4d4f';
    }
};

window.resetProfitChange = function() {
    if (typeof window.currentAdminProfit !== 'undefined') {
        localStorage.setItem('zynex_admin_ref_profit', window.currentAdminProfit);
        if (window.allAdminOrders) renderAdminStats(window.allAdminOrders);
        showAlert("Profit tracker reset.", "Success");
    }
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
        const date = new Date(order.timestamp).toLocaleDateString();
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
                    <button class="view-btn" style="padding:6px 12px; font-size:0.75rem" onclick="openAdminManage('${order.userId}', '${order.id}')">Manage</button>
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
window.renderAdminUsers = function(usersObj) {
    const tbody = document.getElementById('admin-users-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const usersList = Object.keys(usersObj).map(uid => {
        const u = usersObj[uid];
        let spent = 0;
        let count = 0;
        if(u.orders) {
            Object.values(u.orders).forEach(o => {
                if(o.status !== 'cancelled') spent += (parseFloat(o.totalPrice)||0);
                count++;
            });
        }
        return { uid, ...u, totalSpent: spent, totalOrders: count };
    }).sort((a,b) => b.totalSpent - a.totalSpent); // Sort by highest spender

    window.allAdminUsers = usersList; // Store for filtering

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
    document.getElementById('admin-tab-' + tabName).style.display = 'block';
    // Highlight button
    const btns = document.querySelectorAll('.admin-tab-btn');
    if(tabName === 'orders' && btns[0]) btns[0].classList.add('active');
    if(tabName === 'tickets' && btns[1]) btns[1].classList.add('active');
    if(tabName === 'users' && btns[2]) btns[2].classList.add('active');
    if(tabName === 'settings' && btns[3]) btns[3].classList.add('active');

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
        <h2 style="text-align:center; margin-bottom:20px">Support Center</h2>
        <div style="display:grid; gap:15px;">
            <button onclick="showCreateTicket()" class="service-opt-btn" style="justify-content:center;">
                <ion-icon name="add-circle-outline"></ion-icon> Create New Ticket
            </button>
            <button onclick="showUserTickets()" class="service-opt-btn" style="justify-content:center;">
                <ion-icon name="list-outline"></ion-icon> View My Tickets
            </button>
            <div style="text-align:center; margin-top:10px; font-size:0.9rem; color:#666">
                <p>Or email us at <a href="mailto:zynex.official.help@gmail.com" style="color:#5c6cff">zynex.official.help@gmail.com</a></p>
                <p style="margin-top:5px"><ion-icon name="logo-instagram"></ion-icon> <a href="#" style="color:#5c6cff">@Glitchfx_edits</a></p>
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
    
    // Stop listening to previous ticket if any
    if(userTicketUnsub) userTicketUnsub();

    // Start real-time listener
    userTicketUnsub = onValue(ref(database, `tickets/${ticketId}`), (snap) => {
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
                <td style="font-size:0.85rem; color:#666">${new Date(t.timestamp).toLocaleDateString()}</td>
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
    
    if(adminTicketUnsub) adminTicketUnsub();

    adminTicketUnsub = onValue(ref(database, `tickets/${ticketId}`), (snap) => {
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

window.setupAdminRealtimeListeners = function() {
    if (window.adminBadgeUnsubTickets) window.adminBadgeUnsubTickets();
    if (window.adminBadgeUnsubOrders) window.adminBadgeUnsubOrders();

    // Request Browser Notification Permission for Admins
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // Listen to all tickets for Open status
    window.adminBadgeUnsubTickets = onValue(ref(database, 'tickets'), (snap) => {
        let openCount = 0;
        snap.forEach(c => { if(c.val().status === 'open') openCount++; });
        
        updateAdminBadges('tickets', openCount);
    });

    let lastPendingCount = -1; // Track previous count to detect new orders

    // Listen to all users for Pending orders
    window.adminBadgeUnsubOrders = onValue(ref(database, 'users'), (snap) => {
        let pendingCount = 0;
        snap.forEach(userSnap => {
            const orders = userSnap.val().orders;
            if(orders) {
                Object.values(orders).forEach(o => {
                    if(o.status === 'pending') pendingCount++;
                });
            }
        });

        // If not first load (-1) and count increased, trigger notification
        if (lastPendingCount !== -1 && pendingCount > lastPendingCount) {
            // 1. Browser Notification
            if (Notification.permission === "granted") {
                new Notification("New Order Received!", {
                    body: `You have ${pendingCount} pending orders waiting for verification.`,
                    icon: "logo.png"
                });
            }
            // 2. In-App Alert
            showAlert("New Order Received!", "Admin Alert");
        }
        lastPendingCount = pendingCount;

        updateAdminBadges('orders', pendingCount);
    });
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
    // 1. Order Status Updates
    const ordersRef = ref(database, `users/${user.uid}/orders`);
    onChildChanged(ordersRef, (snapshot) => {
        // Check setting (default to true if null)
        const settingEnabled = localStorage.getItem('zynex_setting_orderStatusNotifs') !== 'false';
        if (!settingEnabled) return;

        const order = snapshot.val();

        const onOrdersPage = window.location.href.includes('orders.html');

        if (!onOrdersPage) {
            // Increment update count only if user is NOT on the orders page
            let count = parseInt(localStorage.getItem(`zynex_order_update_count_${user.uid}`) || '0');
            count++;
            localStorage.setItem(`zynex_order_update_count_${user.uid}`, count);

            // Show red number on nav item
            const badge = document.getElementById('orders-nav-badge');
            if (badge) {
                badge.style.display = 'inline-block';
                badge.innerText = count > 99 ? '99+' : count;
            }
        }
        // If the page is hidden (user is on another tab/window), send a browser notification
        if (document.hidden) {
            // Check both push notification master switch and permission
            if ("Notification" in window && Notification.permission === "granted" && localStorage.getItem('zynex_setting_pushNotifs') !== 'false') {
                let title = "Zynex Order Update";
                let body = `There's an update on your order #${order.id.slice(-6)}.`;
                if (order.status === 'completed') body = `Your order for ${order.service} is now Completed!`;
                if (order.status === 'cancelled') body = `Your order #${order.id.slice(-6)} was Cancelled.`;
                
                new Notification(title, { body: body, icon: "logo.png" });
            }
        } else { // Otherwise, show an in-app alert
            if (order.status === 'completed') {
                showAlert(`Order #${order.id.slice(-6)} for ${order.service} is now Completed!`, "Order Update");
                
                // Real-time Review Prompt
                const promptedOrdersKey = `zynex_review_prompted_orders_${user.uid}`;
                const promptedOrders = JSON.parse(localStorage.getItem(promptedOrdersKey) || '[]');

                if (!promptedOrders.includes(order.id)) {
                    promptedOrders.push(order.id);
                    localStorage.setItem(promptedOrdersKey, JSON.stringify(promptedOrders));

                    setTimeout(() => {
                        if(window.openReviewPopup) window.openReviewPopup();
                    }, 3000);
                }
            }
            if (order.status === 'cancelled') showAlert(`Order #${order.id.slice(-6)} was Cancelled. Check details for reason.`, "Order Update");
        }
    });

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
            loadPublicReviews(); // Refresh list
        })
        .catch(err => showAlert(err.message, "Error"));
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
            snapshot.forEach(child => reviews.push(child.val()));
            
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
        }
    });
};