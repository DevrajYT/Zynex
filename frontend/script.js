function togglePanel(){
    const panel = document.querySelector('.sidebar');
    if(!panel) return;
    panel.classList.toggle('active');
}

function openPopup(selector){
    const p = document.querySelector(selector); if(!p) return;
    p.setAttribute('aria-hidden','false');
    p.querySelector('button, a, [role="button"]')?.focus();
}

function closePopup(selector){
    const p = document.querySelector(selector); if(!p) return;
    p.setAttribute('aria-hidden','true');
}

function closePanel(){
    const panel = document.querySelector('.sidebar');
    if(panel && panel.classList.contains('active')) panel.classList.remove('active');
}

function openLogin(){
    const overlay = document.querySelector('.login-overlay');
    if(!overlay) return;
    closeRegister(); // ensure register panel hidden
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden','false');
    overlay.querySelector('input')?.focus();
}
function closeLogin(){
    const overlay = document.querySelector('.login-overlay');
    if(!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden','true');
}

function openRegister(){
    const overlay = document.querySelector('.register-overlay');
    if(!overlay) return;
    closeLogin();
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden','false');
    overlay.querySelector('input')?.focus();
}
function closeRegister(){
    const overlay = document.querySelector('.register-overlay');
    if(!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden','true');
}

// close on backdrop click or Escape
document.addEventListener('click', e=>{
    const t = e.target;
    if(t && t.classList && t.classList.contains('popup')) t.setAttribute('aria-hidden','true');
    if(t && t.closest && (t.closest('.login-overlay') || t.closest('.register-overlay'))) {
        // click on overlay (outside panel) should close it
        if(t.classList.contains('login-overlay')) closeLogin();
        if(t.classList.contains('register-overlay')) closeRegister();
    }
    // close panel when clicking outside it (but allow hamburger clicks)
    if(!t.closest?.('.sidebar') && !t.closest?.('.hamburger')) closePanel();
});
document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
        document.querySelectorAll('.popup[aria-hidden="false"]').forEach(p=>p.setAttribute('aria-hidden','true'));
        closePanel();
        closeLogin();
        closeRegister();
    }
});


// ===== AUTO SIDEBAR ACTIVE LINK =====
document.addEventListener("DOMContentLoaded", function () {

  const links = document.querySelectorAll(".nav-list a");
  const currentPage = window.location.pathname.split("/").pop();

  links.forEach(link => {
    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });

});

// ================= GLOBAL ERROR HELPERS =================
window.showInlineError = function(id, msg) {
    const el = document.getElementById(id);
    if(el) {
        el.innerText = msg;
        el.style.display = 'block';
    }
};
window.clearInlineErrors = function() {
    document.querySelectorAll('.error-text').forEach(el => el.style.display = 'none');
};

window.openGiveawayPopup = function(giveawayId) {
    if (window.isUserLoggedIn && !window.isUserLoggedIn()) {
        window.showAlert('Please log in or register to enter the giveaway!', 'Login Required');
        return;
    }
    const idField = document.getElementById('entry-ga-id');
    if(idField) idField.value = giveawayId;
    openPopup('.giveaway-entry-popup');
}

// ================= CUSTOM POPUP SYSTEM =================
// Injects generic popup HTML into every page automatically
document.addEventListener('DOMContentLoaded', () => {
    const popupHTML = `
    <div id="custom-alert" class="popup custom-popup" aria-hidden="true" style="z-index:3000">
        <div class="popup-content" style="max-width:320px">
            <h3 id="alert-title" style="margin-bottom:10px">Notification</h3>
            <p id="alert-msg" style="color:#666; margin-bottom:20px"></p>
            <button onclick="closeCustomPopup('custom-alert')" style="width:100%; padding:10px; background:#5c6cff; color:white; border:none; border-radius:8px; cursor:pointer">OK</button>
        </div>
    </div>

    <div id="custom-confirm" class="popup custom-popup" aria-hidden="true" style="z-index:3000">
        <div class="popup-content" style="max-width:320px">
            <h3 style="margin-bottom:10px">Confirmation</h3>
            <p id="confirm-msg" style="color:#666; margin-bottom:20px"></p>
            <div style="display:flex; gap:10px;">
                <button id="confirm-yes-btn" style="flex:1; padding:10px; background:#5c6cff; color:white; border:none; border-radius:8px; cursor:pointer">Yes</button>
                <button onclick="closeCustomPopup('custom-confirm')" style="flex:1; padding:10px; background:#eee; color:#333; border:none; border-radius:8px; cursor:pointer">Cancel</button>
            </div>
        </div>
    </div>

    <div id="custom-prompt" class="popup custom-popup" aria-hidden="true" style="z-index:3000">
        <div class="popup-content" style="max-width:320px">
            <h3 id="prompt-title" style="margin-bottom:10px">Input Required</h3>
            <p id="prompt-msg" style="color:#666; margin-bottom:15px"></p>
            <input type="text" id="prompt-input" class="form-input" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:5px; outline:none">
            <small id="prompt-error" class="error-text" style="margin-bottom:15px"></small>
            <div style="display:flex; gap:10px;">
                <button id="prompt-submit-btn" style="flex:1; padding:10px; background:#5c6cff; color:white; border:none; border-radius:8px; cursor:pointer">Submit</button>
                <button onclick="closeCustomPopup('custom-prompt')" style="flex:1; padding:10px; background:#eee; color:#333; border:none; border-radius:8px; cursor:pointer">Cancel</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', popupHTML);
});

window.closeCustomPopup = function(id) {
    document.getElementById(id).setAttribute('aria-hidden', 'true');
};

window.showAlert = function(msg, title="Notification") {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-msg').innerText = msg;
    document.getElementById('custom-alert').setAttribute('aria-hidden', 'false');
};

window.showConfirm = function(msg, onYes) {
    document.getElementById('confirm-msg').innerText = msg;
    const btn = document.getElementById('confirm-yes-btn');
    const newBtn = btn.cloneNode(true); // remove old listeners
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = function() { onYes(); closeCustomPopup('custom-confirm'); };
    document.getElementById('custom-confirm').setAttribute('aria-hidden', 'false');
};

window.showPrompt = function(msg, onSubmit) {
    document.getElementById('prompt-msg').innerText = msg;
    const input = document.getElementById('prompt-input');
    const errorEl = document.getElementById('prompt-error');
    input.value = '';
    if(errorEl) errorEl.style.display = 'none';
    
    const btn = document.getElementById('prompt-submit-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = function() { 
        if(!input.value.trim()) { window.showInlineError('prompt-error', 'Please enter a value.'); return; }
        onSubmit(input.value); 
        closeCustomPopup('custom-prompt'); 
    };
    document.getElementById('custom-prompt').setAttribute('aria-hidden', 'false');
};
