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

// 🌟 TUMHARA NAYA GOOGLE SCRIPT URL YAHAN HAI 🌟
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
    document.getElementById("myDropdown").classList.toggle("show-menu"); 
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

function openPatientLogin() {
    isPartnerMode = false;
    document.getElementById('partner-role-container').style.display = 'none';
    document.getElementById('form-title').innerText = "Patient Login / Sign Up";
    showLoginPopup();
}

function openPartnerLogin() {
    isPartnerMode = true;
    document.getElementById('partner-role-container').style.display = 'block';
    document.getElementById('form-title').innerText = "Partner Registration";
    toggleMenu(); 
    showLoginPopup();
}

function showLoginPopup() {
    document.getElementById('otp-section').style.display = 'none';
    document.getElementById('phone-section').style.display = 'block';
    document.getElementById('login-section').style.display = 'block';
    setupRecaptcha();
}

function closeLoginPopup() { 
    document.getElementById('login-section').style.display = 'none'; 
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
    
    // Naam check karne ka logic
    const userName = document.getElementById('userName').value.trim();
    if(!userName) { alert("Please enter your full name!"); return; }

    const userNumber = document.getElementById('phoneNumber').value.trim();
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
    const selectedRole = isPartnerMode ? document.getElementById('partnerRole').value : 'patient';
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
        localStorage.setItem("bhavya_name", userName); 

        closeLoginPopup();
        alert("Login Successful! Welcome " + userName);
        
        checkLoginState();

       // 🌟 NAYA: THE MAGIC VIP REDIRECT LOGIC (Same Page) 🌟
        if (localStorage.getItem("pending_vip_redirect") === "true") {
            // Hum flag delete nahi karenge, booking.js ise khud delete karega
            window.location.reload(); // Bas same page ko refresh kar do
        } else {
            window.location.reload(); 
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
// 5. LOGOUT & DASHBOARD NAVIGATION
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
    if (role === "patient") {
        window.location.href = "patient_dashboard/patient_dashboard.html"; 
    } else if (role) {
        alert("Redirecting to " + role.toUpperCase() + " Dashboard... (Coming Soon)");
    } else {
        alert("Role not found. Please log in again.");
    }
}
