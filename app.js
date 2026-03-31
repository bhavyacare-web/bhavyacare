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
const GOOGLE_SCRIPT_URL = "// ==========================================
// patient.gs - Patient Dashboard Logic
// ==========================================

function getPatientProfile(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("patients");
  var detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("patient_details");
  var vipSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("vip_member"); 
  
  var targetUserId = data.user_id;
  var lastRow = sheet.getLastRow();
  var patientData = null;

  // Main Data nikalo
  if (lastRow > 1) {
    var sheetData = sheet.getRange(2, 1, lastRow - 1, 11).getDisplayValues();
    for (var i = 0; i < sheetData.length; i++) {
      if (sheetData[i][1] === targetUserId) { 
        patientData = {
          timestamp: sheetData[i][0], user_id: sheetData[i][1],
          patient_name: sheetData[i][3], mobile_number: sheetData[i][4],
          referral_code: sheetData[i][6], wallet: sheetData[i][7],
          withdraw: sheetData[i][8], plan: sheetData[i][9], status: sheetData[i][10],
          extra_details: null,
          vip_package_status: "none",
          vip_details: null
        };
        break;
      }
    }
  }

  // Extra Details nikalo
  if (patientData && detailSheet) {
    var detailLastRow = detailSheet.getLastRow();
    if (detailLastRow > 1) {
      var dData = detailSheet.getRange(2, 1, detailLastRow - 1, 9).getValues();
      for (var j = 0; j < dData.length; j++) {
        if (dData[j][0] === targetUserId) {
          patientData.extra_details = {
            email: dData[j][1], address: dData[j][2], city: dData[j][3],
            district: dData[j][4], state: dData[j][5], pincode: dData[j][6],
            image: dData[j][7]
          };
          break;
        }
      }
    }
  }

  // VIP Package ka status aur VIP HISTORY nikalo
  if (patientData && patientData.plan.toLowerCase() === "vip" && vipSheet) {
    var vipLastRow = vipSheet.getLastRow();
    if (vipLastRow > 1) {
      var vData = vipSheet.getRange(2, 1, vipLastRow - 1, 17).getValues();
      for (var k = vData.length - 1; k >= 0; k--) {
        if (vData[k][0] === targetUserId && vData[k][16] === "active") {
          patientData.vip_package_status = vData[k][15] ? vData[k][15].toLowerCase() : "pending";
          patientData.vip_details = {
            start_date: vData[k][1], end_date: vData[k][2],
            member1_name: vData[k][3], member1_id: vData[k][4],
            member2_name: vData[k][5], member2_id: vData[k][6],
            member3_name: vData[k][7], member3_id: vData[k][8]
          };
          break;
        }
      }
    }
  }

  if (patientData) {
    if (patientData.status.toLowerCase() !== "active") return sendResponse("error", "Your account is blocked by Admin.");
    return sendResponse("success", patientData);
  } else {
    return sendResponse("error", "User not found!");
  }
}

function savePatientDetails(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("patient_details");
  var userId = data.user_id;
  var lastRow = sheet.getLastRow();
  var found = false;
  var rowIndex = -1;
  var existingImage = "";

  if (lastRow > 1) {
    var sheetData = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = 0; i < sheetData.length; i++) {
      if (sheetData[i][0] === userId) {
        found = true; rowIndex = i + 2; existingImage = sheetData[i][7]; break;
      }
    }
  }

  var finalImage = existingImage; 
  if (data.image && data.image.length > 50) finalImage = data.image; 

  if (found) {
    sheet.getRange(rowIndex, 2, 1, 8).setValues([[ data.email, data.address, data.city, data.district, data.state, data.pincode, finalImage, "updated" ]]);
  } else {
    sheet.appendRow([ userId, data.email, data.address, data.city, data.district, data.state, data.pincode, finalImage, "active" ]);
  }

  try {
    if (data.email && data.email.trim() !== "") {
      MailApp.sendEmail(data.email, "Profile Successfully Updated - BhavyaCare", "Dear Patient,\n\nYour profile details have been successfully saved.\n\nTeam BhavyaCare");
    }
  } catch(e) {}

  return sendResponse("success", "Profile saved successfully!");
}

// ==========================================
// Fetch Wallet History (Safe Version)
// ==========================================
function getWalletHistory(data) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("wallet_transactions");
    if (!sheet) return sendResponse("error", "Transactions sheet missing!");
    
    var targetUserId = data.user_id;
    var lastRow = sheet.getLastRow();
    var history = [];
    
    if (lastRow > 1) {
      var sheetData = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      for (var i = sheetData.length - 1; i >= 0; i--) { 
        if (sheetData[i][1] === targetUserId) {
          
          var rawDate = sheetData[i][0];
          var formattedDate = "N/A";
          if (rawDate) {
            try {
              formattedDate = Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a");
            } catch(e) {
              formattedDate = rawDate.toString(); 
            }
          }

          history.push({
            date: formattedDate,
            type: sheetData[i][2] ? sheetData[i][2].toString() : "credit",
            amount: sheetData[i][3] ? sheetData[i][3].toString() : "0",
            description: sheetData[i][4] ? sheetData[i][4].toString() : "-",
            reference: sheetData[i][5] ? sheetData[i][5].toString() : ""
          });
        }
      }
    }
    return sendResponse("success", history);
  } catch (mainErr) {
    return sendResponse("error", "Backend crash: " + mainErr.message);
  }
}";
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
        window.location.href = "patient_dashboard/patient_dashboard.html"; // Make sure this page exists in your repo
    } else if (role) {
        alert("Redirecting to " + role.toUpperCase() + " Dashboard... (Coming Soon)");
    } else {
        alert("Role not found. Please log in again.");
    }
}
