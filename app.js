// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyC2nYH22wkYDhh-BWfHvkT-bQvdKLCxask",
    authDomain: "bhavya-care.firebaseapp.com",
    projectId: "bhavya-care",
    storageBucket: "bhavya-care.firebasestorage.app",
    messagingSenderId: "979254809111",
    appId: "1:979254809111:web:0181e0c97277a5d0d9c252",
    measurementId: "G-G82G4VWGGT"
};

try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} catch(e) {
    console.error("Firebase init error:", e);
}

// 🌟 GOOGLE SCRIPT URL 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";
let isPartnerMode = false;

// ==========================================
// 2. AUTH STATE OBSERVER (Login Session Maintain)
// ==========================================
try {
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                if (!localStorage.getItem("bhavya_mobile")) {
                    localStorage.setItem("bhavya_uid", user.uid);
                    localStorage.setItem("bhavya_mobile", user.phoneNumber);
                }
                checkLoginState();
            } else {
                localStorage.clear();
                checkLoginState();
            }
        });
    }
} catch(e) {
    console.error(e);
}

function initApp() {
    const loginBtn = document.getElementById('nav-login-btn');
    if (loginBtn) { checkLoginState(); }
    else setTimeout(initApp, 100); 
}
initApp();

// ==========================================
// 3. UI & NAVIGATION FUNCTIONS
// ==========================================
function toggleMenu() { 
    const dropdown = document.getElementById("myDropdown");
    if(dropdown) dropdown.classList.toggle("show-menu"); 
}

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn') && !event.target.matches('.user-profile-btn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show-menu')) dropdowns[i].classList.remove('show-menu');
        }
    }
}

function checkLoginState() {
    const savedMobile = localStorage.getItem("bhavya_mobile");
    const navLoginBtn = document.getElementById('nav-login-btn');
    const mainMenuBtn = document.getElementById('main-menu-btn'); 
    const userMenuContainer = document.getElementById('user-menu-container'); 
    const menuJoin = document.getElementById('menu-join');
    const menuDash = document.getElementById('menu-dashboard');
    const menuLogout = document.getElementById('menu-logout');

    if (savedMobile) {
        if(navLoginBtn) navLoginBtn.style.display = 'none';
        if(mainMenuBtn) mainMenuBtn.style.display = 'none';
        if(userMenuContainer) userMenuContainer.style.display = 'block';
        if(menuJoin) menuJoin.style.display = 'none';
        if(menuDash) menuDash.style.display = 'block';
        if(menuLogout) menuLogout.style.display = 'block';
    } else {
        if(navLoginBtn) navLoginBtn.style.display = 'inline-block';
        if(mainMenuBtn) mainMenuBtn.style.display = 'inline-block';
        if(userMenuContainer) userMenuContainer.style.display = 'none';
        if(menuJoin) menuJoin.style.display = 'block';
        if(menuDash) menuDash.style.display = 'none';
        if(menuLogout) menuLogout.style.display = 'none';
        if(document.getElementById('recaptcha-container')) setupRecaptcha();
    }
}

function updateNameLabel() {
    const roleElem = document.getElementById('partnerRole');
    const nameLabel = document.getElementById('nameLabel');
    const userNameInput = document.getElementById('userName');

    if (!nameLabel || !userNameInput) return;

    if (isPartnerMode && roleElem) {
        const role = roleElem.value;
        if (role === 'doctor') {
            nameLabel.innerText = "Doctor Name:";
            userNameInput.placeholder = "Enter doctor name";
        } else if (role === 'lab') {
            nameLabel.innerText = "Lab Name:";
            userNameInput.placeholder = "Enter lab name";
        } else if (role === 'pharmacy') {
            nameLabel.innerText = "Pharmacy Name:";
            userNameInput.placeholder = "Enter pharmacy name";
        } else if (role === 'hospital') {
            nameLabel.innerText = "Hospital Name:";
            userNameInput.placeholder = "Enter hospital name";
        } else if (role === 'executive') {
            nameLabel.innerText = "Executive Name:";
            userNameInput.placeholder = "Enter executive name";
        }
    } else {
        nameLabel.innerText = "Full Name:";
        userNameInput.placeholder = "Enter your full name";
    }
}

function openPatientLogin() {
    isPartnerMode = false;
    const partnerRoleContainer = document.getElementById('partner-role-container');
    if(partnerRoleContainer) partnerRoleContainer.style.display = 'none';
    const formTitle = document.getElementById('form-title');
    if(formTitle) formTitle.innerText = "Patient Login / Sign Up";
    
    updateNameLabel(); 
    showLoginPopup();
}

function openPartnerLogin() {
    isPartnerMode = true;
    const partnerRoleContainer = document.getElementById('partner-role-container');
    if(partnerRoleContainer) partnerRoleContainer.style.display = 'block';
    const formTitle = document.getElementById('form-title');
    if(formTitle) formTitle.innerText = "Partner Registration";
    
    updateNameLabel(); 
    toggleMenu(); 
    showLoginPopup();
}

function showLoginPopup() {
    const otpSec = document.getElementById('otp-section');
    const phoneSec = document.getElementById('phone-section');
    const loginSec = document.getElementById('login-section');
    
    if(otpSec) otpSec.style.display = 'none';
    if(phoneSec) phoneSec.style.display = 'block';
    if(loginSec) loginSec.style.display = 'block';
    setupRecaptcha();
}

function closeLoginPopup() { 
    const loginSec = document.getElementById('login-section');
    if(loginSec) loginSec.style.display = 'none'; 
}

// ==========================================
// 4. FIREBASE OTP LOGIC
// ==========================================
function setupRecaptcha() {
    try {
        if (typeof firebase !== 'undefined' && document.getElementById('recaptcha-container') && !window.recaptchaVerifier) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'normal' });
            window.recaptchaVerifier.render();
        }
    } catch(e) { console.error(e); }
}

function sendOTP() {
    if (typeof firebase === 'undefined') { alert("System loading, please wait a moment."); return; }
    
    const userNameInput = document.getElementById('userName');
    if(!userNameInput) return; // safeguard
    const userName = userNameInput.value.trim();
    if(!userName) { alert("Please enter your name!"); return; }

    const userNumberInput = document.getElementById('phoneNumber');
    const userNumber = userNumberInput.value.trim();
    if(userNumber.length !== 10 || isNaN(userNumber)) { alert("Please enter a valid 10-digit mobile number!"); return; }
    
    firebase.auth().signInWithPhoneNumber("+91" + userNumber, window.recaptchaVerifier).then((res) => {
        window.confirmationResult = res;
        document.getElementById('phone-section').style.display = 'none';
        document.getElementById('otp-section').style.display = 'block';
        document.getElementById('form-title').innerText = "Verify OTP";
        alert("OTP sent successfully!");
    }).catch((err) => { alert("Firebase Error: " + err.message); });
}

async function verifyOTP() {
    const code = document.getElementById('otpCode').value.trim();
    const roleElem = document.getElementById('partnerRole');
    const selectedRole = (isPartnerMode && roleElem) ? roleElem.value : 'patient';
    const userName = document.getElementById('userName').value.trim();

    if(code.length !== 6) { alert("Please enter a 6-digit OTP."); return; }

    try {
        const result = await window.confirmationResult.confirm(code);
        const user = result.user;

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify({ action: "login", uid: user.uid, mobile: user.phoneNumber, role: selectedRole, name: userName })
        });
        const resData = await response.json();

        const finalRole = resData.role;
        const finalUserId = resData.user_id;

        localStorage.setItem("bhavya_uid", user.uid);
        localStorage.setItem("bhavya_mobile", user.phoneNumber);
        localStorage.setItem("bhavya_role", finalRole);
        localStorage.setItem("bhavya_user_id", finalUserId);
        localStorage.setItem("bhavya_name", resData.name || userName); 

        closeLoginPopup();
        alert("Login Successful! Welcome " + userName);
        
        checkLoginState();

        // VIP OR DASHBOARD REDIRECT LOGIC
        if (localStorage.getItem("pending_vip_redirect") === "true") {
            window.location.reload(); 
        } else {
            goToDashboard(); // Changed to automatically route to correct dashboard after login
        }

    } catch (error) { 
        console.error("OTP Error Details:", error);
        if(error.code) { 
            alert("Invalid OTP! Please try again."); 
        } else {
            alert("System Error. Please check console logs.");
        }
    }
}

// ==========================================
// 5. LOGOUT & DASHBOARD NAVIGATION (UPDATED)
// ==========================================
function logoutUser() {
    if (typeof firebase !== 'undefined') {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            alert("You have successfully logged out!");
            window.location.reload(); 
        }).catch((err) => { console.error("Logout Error:", err); });
    } else {
        localStorage.clear();
        window.location.reload();
    }
}

function goToDashboard() {
    const role = localStorage.getItem("bhavya_role");
    
    // --- DASHBOARD ROUTING LOGIC ---
    if (role === "patient") {
        window.location.href = "patient_dashboard/patient_dashboard.html"; 
    } 
    // Purana code: 
// else if (role === "lab") { window.location.href = "lab.html"; }

// Naya code:
else if (role === "lab") {
    // Ideal yahi hai ki abhi lab_registration.html par bhejein. 
    // Jab form bhar jaye tab lab.html par redirect ho.
    window.location.href = "lab_registration.html"; 
}
    else if (role === "doctor" || role === "pharmacy" || role === "hospital" || role === "executive") {
        alert("Redirecting to " + role.toUpperCase() + " Dashboard... (Under Construction)");
    } 
    else {
        alert("Role not found. Please log in again.");
    }
}
