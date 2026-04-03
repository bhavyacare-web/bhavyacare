// ==========================================
// CART & CHECKOUT LOGIC (BHAVYACARE)
// ==========================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

// Active categories eligible for home collection
const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];

// State Management
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let bookingData = { name: "", mobile: "", pincode: "", address: "", isVip: false };
let matchedLabs = [];
let selectedLabId = null;
let selectedTime = null;

// Initialize Page
window.onload = () => {
    // Check if cart is empty
    if(cart.length === 0) {
        document.querySelector('.container').innerHTML = `
            <div style="text-align:center; padding: 50px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 50px; color: var(--border); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text-main);">Your Cart is Empty</h3>
                <a href="../booking/booking.html" style="color: var(--primary); font-weight: bold; text-decoration: none; display: inline-block; margin-top: 10px;">Browse Services</a>
            </div>`;
        document.getElementById('loadingOverlay').style.display = 'none';
        document.querySelector('.bottom-bar').style.display = 'none';
        return;
    }

    const userId = localStorage.getItem("bhavya_user_id");
    
    // If Logged In: Fetch profile and lock mobile number
    if (userId) {
        fetchProfile(userId);
    } else {
        // If Guest/New User: Allow free text entry
        document.getElementById('loadingOverlay').style.display = 'none';
    }
};

// ==========================================
// STEP 1: PATIENT INFO LOGIC
// ==========================================
function fetchProfile(userId) {
    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId }) })
    .then(res => res.json())
    .then(res => {
        document.getElementById('loadingOverlay').style.display = 'none';
        if(res.status === "success") {
            const data = res.data;
            bookingData.mobile = data.mobile;
            
            document.getElementById('uMobile').value = data.mobile;
            document.getElementById('uMobile').setAttribute("readonly", true); // Lock mobile
            document.getElementById('uPincode').value = data.pincode;
            document.getElementById('uAddress').value = data.address;

            const nameBox = document.getElementById('nameInputBox');
            if(data.isVip && data.vipMembers.length > 0) {
                document.getElementById('vipBadge').innerHTML = '<span style="background:var(--warning); color:white; font-size:10px; padding:4px 8px; border-radius:12px; margin-left: 10px;"><i class="fas fa-crown"></i> VIP Active</span>';
                let opts = data.vipMembers.map(m => `<option value="${m}">${m}</option>`).join('');
                nameBox.innerHTML = `<select id="uName" class="form-input">${opts}</select>`;
            } else {
                nameBox.innerHTML = `<input type="text" id="uName" class="form-input" value="${data.name}" placeholder="Patient Name">`;
            }
        }
    }).catch(e => {
        document.getElementById('loadingOverlay').style.display = 'none';
        console.error("Profile Fetch Error", e);
    });
}

function savePatientInfo() {
    const name = document.getElementById('uName').value.trim();
    const mobile = document.getElementById('uMobile').value.trim();
    const pin = document.getElementById('uPincode').value.trim();
    const addr = document.getElementById('uAddress').value.trim();

    if(!name || pin.length < 6 || mobile.length < 10) {
        return alert("Please enter valid Name, 10-digit Mobile, and 6-digit Pincode.");
    }

    bookingData.name = name;
    bookingData.mobile = mobile;
    bookingData.pincode = pin;
    bookingData.address = addr;

    // Set default fulfillment based on service category
    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase();
        if(!item.fulfillment) {
            item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
        }
    });

    lockStep1();
}

function lockStep1() {
    // Update Stepper
    document.getElementById('step1-nav').classList.add('completed');
    document.getElementById('step2-nav').classList.add('active');

    // Update Summary UI
    document.getElementById('sumName').innerText = bookingData.name;
    document.getElementById('sumMobile').innerText = "+91 " + bookingData.mobile;
    document.getElementById('sumAddress').innerText = `${bookingData.address} (Pin: ${bookingData.pincode})`;

    document.getElementById('infoForm').style.display = 'none';
    document.getElementById('infoSummary').style.display = 'block';

    // Unlock Step 2
    const s2 = document.getElementById('step2-card');
    s2.style.display = 'block'; 
    s2.style.opacity = '1'; 
    s2.style.pointerEvents = 'auto';

    renderCart();
    fetchLabs(); // Start Lab Matchmaking based on Pincode
}

function editPatientInfo() {
    document.getElementById('infoForm').style.display = 'block';
    document.getElementById('infoSummary').style.display = 'none';
    
    // Lock Step 2 visually
    const s2 = document.getElementById('step2-card');
    s2.style.opacity = '0.5'; 
    s2.style.pointerEvents = 'none';
    
    validateCheckout();
}

// ==========================================
// STEP 2: CART & LAB MATCHMAKING
// ==========================================
function renderCart() {
    let html = ""; 
    let total = 0;
    
    cart.forEach((item, index) => {
        total += (item.price * item.qty);
        let type = (item.service_type || "pathology").toLowerCase();
        let toggleHtml = "";

        if(homeServiceCategories.includes(type)) {
            let hAct = item.fulfillment === "home" ? "active" : "";
            let cAct = item.fulfillment === "center" ? "active" : "";
            toggleHtml = `
                <div class="service-toggle-box">
                    <button class="toggle-btn ${hAct}" onclick="changeFulfill(${index}, 'home')"><i class="fas fa-home"></i> Home</button>
                    <button class="toggle-btn ${cAct}" onclick="changeFulfill(${index}, 'center')"><i class="fas fa-hospital"></i> Center</button>
                </div>`;
        } else {
            item.fulfillment = "center";
            toggleHtml = `<div style="font-size:11px; color:var(--danger); font-weight:600; margin-top:8px;"><i class="fas fa-info-circle"></i> Center Visit Required</div>`;
        }

        html += `
            <div style="padding:15px 0; border-bottom:1px dashed var(--border);">
                <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                    <div>
                        <strong style="font-size:14px; color: var(--text-main);">${item.service_name}</strong>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Qty: ${item.qty}</div>
                    </div>
                    <strong style="color:var(--success); font-size: 15px;">₹${item.price * item.qty}</strong>
                </div>
                ${toggleHtml}
            </div>`;
    });
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    document.getElementById('totalAmt').innerText = total;
}

function fetchLabs() {
    document.getElementById('labSection').style.display = 'block';
    document.getElementById('labsContainer').innerHTML = "<div style='text-align:center; padding:20px;'><i class='fas fa-circle-notch fa-spin' style='color:var(--primary); font-size:24px;'></i><p style='font-size:13px; color:var(--text-muted); margin-top:10px;'>Finding best labs for you...</p></div>";
    document.getElementById('fallbackMessage').style.display = 'none';

    // Get unique required test types from cart
    let requiredTypes = [...new Set(cart.map(i => i.service_type))];

    fetch(GAS_URL, { 
        method: "POST", 
        body: JSON.stringify({ action: "getMatchedLabs", pincode: bookingData.pincode, required_types: requiredTypes })
    })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success" && res.data.labs.length > 0) {
            matchedLabs = res.data.labs;
            selectedLabId = null;
            
            // Check if backend returned a Fallback Message (Pincode out of reach for home)
            if(res.data.message) {
                document.getElementById('fallbackText').innerText = res.data.message;
                document.getElementById('fallbackMessage').style.display = 'flex';
                // Force switch all items to center visit
                cart.forEach(i => { if(i.fulfillment === 'home') i.fulfillment = 'center'; });
                renderCart();
            }
            
            renderLabs();
        } else {
            document.getElementById('labsContainer').innerHTML = "<p style='color:var(--danger); font-size:13px; text-align:center; padding: 10px; background: #fee2e2; border-radius: 8px;'>No partner labs found offering all the selected services in this area.</p>";
        }
    }).catch(e => {
        document.getElementById('labsContainer').innerHTML = "<p style='color:var(--danger); font-size:13px; text-align:center;'>Network error. Please try again.</p>";
    });
}

function renderLabs() {
    let html = matchedLabs.map(lab => {
        let badges = "";
        if(lab.nabl) badges += `<span class="lab-badge badge-nabl">NABL</span>`;
        if(lab.nabh) badges += `<span class="lab-badge badge-nabh">NABH</span>`;
        
        let imgSrc = lab.lab_image || "https://via.placeholder.com/60?text=LAB";

        // Validate Home Support dynamically
        let isHomeSelected = cart.some(i => i.fulfillment === "home");
        let labSupportsHome = lab.available_pincodes.includes(bookingData.pincode.toString());
        
        let warningUI = "";
        if(isHomeSelected && !labSupportsHome) {
            warningUI = `<div style="font-size:11px; color:var(--danger); font-weight:700; margin-top:6px; background: #fee2e2; padding: 4px 8px; border-radius: 4px; display: inline-block;"><i class="fas fa-exclamation-triangle"></i> Home Collection unavailable. Will switch to Center Visit.</div>`;
        }

        return `
        <div class="lab-card ${selectedLabId === lab.lab_id ? 'selected' : ''}" onclick="selectLab('${lab.lab_id}', ${labSupportsHome})">
            <img src="${imgSrc}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border);">
            <div style="flex-grow: 1;">
                <strong style="font-size:15px; color: var(--text-main); display:flex; align-items:center; gap:5px; margin-bottom: 4px;">${lab.lab_name} ${badges}</strong>
                <span style="font-size:12px; color:var(--text-muted); display:block; line-height: 1.4;"><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i>${lab.lab_address}, ${lab.city}</span>
                ${warningUI}
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('labsContainer').innerHTML = html;
}

function changeFulfill(index, type) {
    if(type === 'home') {
        // If a lab is already selected, verify if it supports home collection at this pincode
        if(selectedLabId) {
            let lab = matchedLabs.find(l => l.lab_id === selectedLabId);
            if(lab && !lab.available_pincodes.includes(bookingData.pincode.toString())) {
                return alert(`Home collection is not available for Pin ${bookingData.pincode} from ${lab.lab_name}. Please choose Center Visit.`);
            }
        }
    }
    cart[index].fulfillment = type;
    renderCart(); 
    validateCheckout();
}

function selectLab(id, labSupportsHome) {
    selectedLabId = id;
    
    // Auto-switch to Center if Home is selected but Lab doesn't support it
    let isHomeSelected = cart.some(i => i.fulfillment === "home");
    if(isHomeSelected && !labSupportsHome) {
        cart.forEach(i => { if(i.fulfillment === 'home') i.fulfillment = 'center'; });
        renderCart();
        alert("Switched to Center Visit as this lab does not provide home collection in your area.");
    }

    renderLabs();
    
    // Show Time Slots
    document.getElementById('dateTimeSection').style.display = 'block';
    let today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').setAttribute('min', today);
    validateCheckout();
}

// ==========================================
// STEP 3: DATE, TIME & CHECKOUT VALIDATION
// ==========================================
function generateSlots() {
    const dateVal = document.getElementById('bookingDate').value;
    if(!dateVal) return;

    // Hardcoded slots for UI, can be dynamic based on lab open_time/close_time
    const slots = ["08:00 AM", "09:30 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM", "07:00 PM"];
    
    let html = slots.map(s => `<button class="slot-btn" onclick="selectTime(this, '${s}')">${s}</button>`).join('');
    document.getElementById('slotContainer').innerHTML = html;
    
    selectedTime = null;
    validateCheckout();
}

function selectTime(btn, time) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTime = time;
    validateCheckout();
}

function validateCheckout() {
    const btn = document.getElementById('confirmBtn');
    if(selectedLabId && document.getElementById('bookingDate').value && selectedTime) {
        btn.disabled = false;
        document.getElementById('step3-nav').classList.add('active');
    } else {
        btn.disabled = true;
        document.getElementById('step3-nav').classList.remove('active');
    }
}

// ==========================================
// FINAL BOOKING & OTP LOGIC
// ==========================================
function finalizeBooking() {
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId) {
        // GUEST USER: Trigger Firebase OTP Flow
        document.getElementById("displayOtpMobile").innerText = "+91 " + bookingData.mobile;
        document.getElementById("otpModal").style.display = "flex";
        
        // ---------------------------------------------------------
        // TODO: ADD YOUR FIREBASE SEND OTP LOGIC HERE
        // Example: 
        // firebase.auth().signInWithPhoneNumber("+91" + bookingData.mobile, appVerifier)
        // .then((confirmationResult) => { window.confirmationResult = confirmationResult; })
        // ---------------------------------------------------------
    } else {
        // EXISTING USER: Directly Submit Order
        processOrderSubmission(userId);
    }
}

function verifyFirebaseOTP() {
    const otp = document.getElementById('otpCode').value;
    if(otp.length < 6) return alert("Please enter valid 6-digit OTP");

    const btn = document.getElementById('verifyOtpBtn');
    btn.innerText = "Verifying..."; 
    btn.disabled = true;

    // ---------------------------------------------------------
    // TODO: ADD YOUR FIREBASE VERIFY OTP LOGIC HERE
    // Example:
    // window.confirmationResult.confirm(otp).then((result) => {
    //     let firebaseUid = result.user.uid;
    //     proceedWithRegistration(firebaseUid);
    // })
    // ---------------------------------------------------------

    // ⚠️ For now, simulating successful OTP verification
    proceedWithRegistration("FB-UID-" + Math.floor(Math.random()*1000));
}

function proceedWithRegistration(firebaseUid) {
    // 1. Register User in Google Sheets
    const newUserPayload = {
        action: "registerNewPatient",
        firebase_uid: firebaseUid,
        name: bookingData.name,
        mobile: bookingData.mobile,
        pincode: bookingData.pincode,
        address: bookingData.address
    };

    fetch(GAS_URL, { method: "POST", body: JSON.stringify(newUserPayload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            const newUserId = res.data.user_id;
            localStorage.setItem("bhavya_user_id", newUserId); // Keep logged in
            
            document.getElementById('otpModal').style.display = 'none';
            
            // 2. Submit Final Order for this new user
            processOrderSubmission(newUserId);
        } else {
            alert("Registration failed: " + res.message);
            resetOtpBtn();
        }
    }).catch(e => { 
        alert("Error saving patient details. Please check network."); 
        resetOtpBtn(); 
    });
}

function resetOtpBtn() {
    const btn = document.getElementById('verifyOtpBtn');
    btn.innerText = "Verify & Confirm Order"; 
    btn.disabled = false;
}

function processOrderSubmission(userId) {
    const btn = document.getElementById('confirmBtn');
    btn.innerText = "Processing Order..."; 
    btn.disabled = true;

    const payload = {
        action: "submitBookingOrder",
        user_id: userId,
        patient_name: bookingData.name,
        pincode: bookingData.pincode,
        address: bookingData.address,
        cart_items: cart,
        total_amount: document.getElementById('totalAmt').innerText,
        lab_id: selectedLabId,
        slot_date: document.getElementById('bookingDate').value,
        slot_time: selectedTime
    };

    fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            // Success! Clear Cart and Redirect
            localStorage.removeItem('bhavyaCart');
            alert(`🎉 Booking Successful!\nYour Order ID is: ${res.data.order_id}`);
            window.location.href = "../index.html"; // Adjust path to Home/Orders page
        } else {
            alert("Booking Error: " + res.message);
            btn.innerText = "Confirm Booking"; 
            btn.disabled = false;
        }
    }).catch(e => { 
        alert("Network Error during checkout. Please try again."); 
        btn.innerText = "Confirm Booking"; 
        btn.disabled = false; 
    });
}
