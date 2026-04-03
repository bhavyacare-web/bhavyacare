// ==========================================
// CART & CHECKOUT LOGIC (BHAVYACARE) - SPLIT CART
// ==========================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];

let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let bookingData = { name: "", mobile: "", pincode: "", address: "", isVip: false };
let allActiveLabsList = []; 
let selectedTime = null;

// ==========================================
// INITIALIZE PAGE
// ==========================================
window.onload = () => {
    // 1. Check if cart is empty
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

    // 2. Initial Total Calculation
    let initialTotal = 0;
    cart.forEach(item => {
        let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
        let itemQty = Number(item.qty || 1);
        initialTotal += (itemPrice * itemQty);
    });
    document.getElementById('totalAmt').innerText = initialTotal;

    const userId = localStorage.getItem("bhavya_user_id");
    
    // 3. Fetch profile if logged in
    if (userId) {
        fetchProfile(userId);
    } else {
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
            document.getElementById('uMobile').setAttribute("readonly", true); 
            document.getElementById('uPincode').value = data.pincode;
            document.getElementById('uAddress').value = data.address;

            const nameBox = document.getElementById('nameInputBox');
            if(data.isVip && data.vipMembers && data.vipMembers.length > 0) {
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

    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase();
        if(!item.fulfillment) {
            item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
        }
    });

    lockStep1();
}

function lockStep1() {
    document.getElementById('step1-nav').classList.add('completed');
    document.getElementById('step2-nav').classList.add('active');

    document.getElementById('sumName').innerText = bookingData.name;
    document.getElementById('sumMobile').innerText = "+91 " + bookingData.mobile;
    document.getElementById('sumAddress').innerText = `${bookingData.address} (Pin: ${bookingData.pincode})`;

    document.getElementById('infoForm').style.display = 'none';
    document.getElementById('infoSummary').style.display = 'block';

    const s2 = document.getElementById('step2-card');
    s2.style.display = 'block'; 
    s2.style.opacity = '1'; 
    s2.style.pointerEvents = 'auto';

    fetchLabs(); 
}

function editPatientInfo() {
    document.getElementById('infoForm').style.display = 'block';
    document.getElementById('infoSummary').style.display = 'none';
    
    const s2 = document.getElementById('step2-card');
    s2.style.opacity = '0.5'; 
    s2.style.pointerEvents = 'none';
    
    validateCheckout();
}

// ==========================================
// STEP 2: SPLIT CART & SMART LAB MATCHMAKING
// ==========================================
function fetchLabs() {
    let spinner = document.getElementById('loadingLabsSpinner');
    if (spinner) spinner.style.display = 'block';
    
    document.getElementById('cartItemsContainer').innerHTML = "";

    fetch(GAS_URL, { 
        method: "POST", 
        body: JSON.stringify({ action: "getAllActiveLabs" }) 
    })
    .then(res => res.json())
    .then(res => {
        if (spinner) spinner.style.display = 'none';
        if(res.status === "success") {
            allActiveLabsList = res.data.labs;
            renderCartWithLabs(); 
        } else {
            alert("Error fetching labs. Please try again.");
        }
    }).catch(e => {
        if (spinner) spinner.style.display = 'none';
        console.error(e);
        alert("Network Error while fetching diagnostic centers.");
    });
}

function renderCartWithLabs() {
    let html = ""; 
    let total = 0;
    let allItemsConfigured = true;
    
    cart.forEach((item, index) => {
        let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
        let itemQty = Number(item.qty || 1);
        
        total += (itemPrice * itemQty);
        let type = (item.service_type || "pathology").toLowerCase();
        
        // 1. Find labs that do THIS specific test
        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);

        // 2. Filter further if user wants Home Collection
        let isHome = item.fulfillment === "home";
        let finalLabs = eligibleLabs;

        if (isHome) {
            finalLabs = eligibleLabs.filter(lab => {
                let pStr = bookingData.pincode.toString();
                return lab.available_pincodes.includes(pStr) || lab.pincode === pStr;
            });
        }

        // --- Build Item UI ---
        let toggleHtml = "";
        if(homeServiceCategories.includes(type)) {
            let hAct = isHome ? "active" : "";
            let cAct = !isHome ? "active" : "";
            toggleHtml = `
                <div class="service-toggle-box">
                    <button class="toggle-btn ${hAct}" onclick="changeFulfill(${index}, 'home')"><i class="fas fa-home"></i> Home</button>
                    <button class="toggle-btn ${cAct}" onclick="changeFulfill(${index}, 'center')"><i class="fas fa-hospital"></i> Center</button>
                </div>`;
        } else {
            item.fulfillment = "center";
            toggleHtml = `<div style="font-size:11px; color:var(--danger); font-weight:600; margin-top:8px;"><i class="fas fa-info-circle"></i> Center Visit Required</div>`;
        }

        // Lab Dropdown
        let labSelectHtml = "";
        
        if (finalLabs.length > 0) {
            // Auto-select first lab if none selected or if previously selected lab is no longer valid
            if(!item.selected_lab_id || !finalLabs.find(l => l.lab_id === item.selected_lab_id)) {
                item.selected_lab_id = finalLabs[0].lab_id; 
            }

            let options = finalLabs.map(lab => {
                let badges = (lab.nabl ? " [NABL]" : "") + (lab.nabh ? " [NABH]" : "");
                let sel = lab.lab_id === item.selected_lab_id ? "selected" : "";
                return `<option value="${lab.lab_id}" ${sel}>${lab.lab_name} ${badges}</option>`;
            }).join('');

            labSelectHtml = `
                <div class="item-lab-selector">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">Assign to Lab:</label>
                    <select class="item-lab-select" onchange="assignLabToItem(${index}, this.value)">
                        ${options}
                    </select>
                </div>`;
        } else {
            // ERROR: No labs found for this config
            item.selected_lab_id = null;
            allItemsConfigured = false;
            
            if (isHome && eligibleLabs.length > 0) {
                labSelectHtml = `
                    <div class="item-error-box">
                        <span><i class="fas fa-exclamation-triangle"></i> Home collection not available at Pin ${bookingData.pincode} for this test.</span>
                        <button class="btn-small-outline" onclick="changeFulfill(${index}, 'center')">Switch to Center Visit</button>
                    </div>`;
            } else {
                labSelectHtml = `
                    <div class="item-error-box">
                        <span><i class="fas fa-times-circle"></i> No partner lab found for this service in your area.</span>
                        <button class="btn-small-outline" onclick="removeCartItem(${index})"><i class="fas fa-trash"></i> Remove Item</button>
                    </div>`;
            }
        }

        // Combine HTML
        html += `
            <div style="padding:15px 0; border-bottom:1px dashed var(--border);">
                <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                    <div>
                        <strong style="font-size:14px; color: var(--text-main);">${item.service_name}</strong>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Qty: ${itemQty}</div>
                    </div>
                    <strong style="color:var(--success); font-size: 15px;">₹${itemPrice * itemQty}</strong>
                </div>
                ${toggleHtml}
                ${labSelectHtml}
            </div>`;
    });
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    document.getElementById('totalAmt').innerText = total;

    if (cart.length > 0 && allItemsConfigured) {
        document.getElementById('dateTimeSection').style.display = 'block';
        let today = new Date().toISOString().split('T')[0];
        document.getElementById('bookingDate').setAttribute('min', today);
    } else {
        document.getElementById('dateTimeSection').style.display = 'none';
    }

    validateCheckout();
}

function changeFulfill(index, type) {
    cart[index].fulfillment = type;
    renderCartWithLabs(); 
}

function assignLabToItem(index, labId) {
    cart[index].selected_lab_id = labId;
    validateCheckout();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    if(cart.length === 0) location.reload(); 
    else renderCartWithLabs();
}

// ==========================================
// STEP 3: DATE, TIME & CHECKOUT VALIDATION
// ==========================================
function generateSlots() {
    const dateVal = document.getElementById('bookingDate').value;
    if(!dateVal) return;

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
    
    let allAssigned = cart.every(item => item.selected_lab_id !== null && item.selected_lab_id !== undefined);
    
    if(cart.length > 0 && allAssigned && document.getElementById('bookingDate').value && selectedTime) {
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
        document.getElementById("displayOtpMobile").innerText = "+91 " + bookingData.mobile;
        document.getElementById("otpModal").style.display = "flex";
        
        // ADD YOUR FIREBASE SEND OTP LOGIC HERE
    } else {
        processOrderSubmission(userId);
    }
}

function verifyFirebaseOTP() {
    const otp = document.getElementById('otpCode').value;
    if(otp.length < 6) return alert("Please enter valid 6-digit OTP");

    const btn = document.getElementById('verifyOtpBtn');
    btn.innerText = "Verifying..."; 
    btn.disabled = true;

    // ADD YOUR FIREBASE VERIFY OTP LOGIC HERE
    // Simulating success for now:
    proceedWithRegistration("FB-UID-" + Math.floor(Math.random()*1000));
}

function proceedWithRegistration(firebaseUid) {
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
            localStorage.setItem("bhavya_user_id", newUserId); 
            
            document.getElementById('otpModal').style.display = 'none';
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
        cart_items: cart, // Ab cart item ke andar 'selected_lab_id' field jayega
        total_amount: document.getElementById('totalAmt').innerText,
        slot_date: document.getElementById('bookingDate').value,
        slot_time: selectedTime
    };

    fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            localStorage.removeItem('bhavyaCart');
            alert(`🎉 Booking Successful!\nYour Order ID is: ${res.data.order_id}`);
            window.location.href = "../index.html"; 
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
