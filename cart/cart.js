// ==========================================
// CART & CHECKOUT LOGIC (BHAVYACARE)
// ==========================================

const GAS_URL_CART = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];

let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let bookingData = { name: "", mobile: "", pincode: "", address: "", isVip: false };
let allActiveLabsList = []; 
let selectedTime = null;
let cartConfirmationResult; 

// ==========================================
// 1. INITIALIZATION
// ==========================================
window.onload = () => {
    // 🌟 FIX: Better Empty Cart Check 🌟
    if(cart.length === 0) {
        showEmptyCart();
        return; // Yahan se aage ka code nahi chalega agar cart khali hai
    }

    // Agar cart khali NAHI hai, tabhi Total calculate karo
    let initialTotal = 0;
    cart.forEach(item => {
        let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
        let itemQty = Number(item.qty || 1);
        initialTotal += (itemPrice * itemQty);
    });
    document.getElementById('totalAmt').innerText = initialTotal;

    const userId = localStorage.getItem("bhavya_user_id");
    if (userId) { 
        fetchProfile(userId); 
    } else { 
        document.getElementById('loadingOverlay').style.display = 'none'; 
    }

    // Ensure Date picker cannot select past dates
    let today = new Date().toISOString().split('T')[0];
    let dateInput = document.getElementById('bookingDate');
    if(dateInput) dateInput.setAttribute('min', today);
};

function showEmptyCart() {
    let container = document.querySelector('.container');
    if(container) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 50px; color: var(--border); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text-main);">Your Cart is Empty</h3>
                <a href="../booking/booking.html" style="color: var(--primary); font-weight: bold; text-decoration: none; display: inline-block; margin-top: 10px;">Browse Services</a>
            </div>`;
    }
    
    let loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.style.display = 'none';
    
    let bottomBar = document.querySelector('.bottom-bar');
    if(bottomBar) bottomBar.style.display = 'none';
}

// ==========================================
// 2. PATIENT PROFILE LOGIC
// ==========================================
function fetchProfile(userId) {
    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId }) })
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
    }).catch(e => { document.getElementById('loadingOverlay').style.display = 'none'; });
}

function savePatientInfo() {
    const name = document.getElementById('uName').value.trim();
    const mobile = document.getElementById('uMobile').value.trim();
    const pin = document.getElementById('uPincode').value.trim();
    const addr = document.getElementById('uAddress').value.trim();

    if(!name || pin.length < 6 || mobile.length < 10) return alert("Please enter valid Name, 10-digit Mobile, and 6-digit Pincode.");

    bookingData.name = name;
    bookingData.mobile = mobile;
    bookingData.pincode = pin;
    bookingData.address = addr;

    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if(!item.fulfillment) item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
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
    s2.style.display = 'block'; s2.style.opacity = '1'; s2.style.pointerEvents = 'auto';

    fetchLabs(); 
}

function editPatientInfo() {
    document.getElementById('infoForm').style.display = 'block';
    document.getElementById('infoSummary').style.display = 'none';
    const s2 = document.getElementById('step2-card');
    s2.style.opacity = '0.5'; s2.style.pointerEvents = 'none';
    validateCheckout();
}

// ==========================================
// 3. SMART LAB MATCHMAKING
// ==========================================
function fetchLabs() {
    let spinner = document.getElementById('loadingLabsSpinner');
    if (spinner) spinner.style.display = 'block';
    document.getElementById('cartItemsContainer').innerHTML = "";

    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify({ action: "getAllActiveLabs" }) })
    .then(res => res.json())
    .then(res => {
        if (spinner) spinner.style.display = 'none';
        if(res.status === "success") {
            allActiveLabsList = res.data.labs;
            autoAssignLabsByCategory(); 
            renderCartWithLabs(); 
        } else alert("Error fetching labs.");
    }).catch(e => {
        if (spinner) spinner.style.display = 'none';
        alert("Network Error.");
    });
}

function autoAssignLabsByCategory() {
    let assignedLabs = {}; 
    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        
        if (item.fulfillment === "home") {
            eligibleLabs = eligibleLabs.filter(lab => lab.available_pincodes.includes(bookingData.pincode.toString()) || lab.pincode === bookingData.pincode.toString());
        }

        if (eligibleLabs.length > 0) {
            let currentValid = item.selected_lab_id && eligibleLabs.some(l => String(l.lab_id).trim() === String(item.selected_lab_id).trim());
            
            if (assignedLabs[type]) {
                if (eligibleLabs.some(l => String(l.lab_id).trim() === String(assignedLabs[type]).trim())) {
                    item.selected_lab_id = String(assignedLabs[type]).trim();
                } else if (currentValid) {
                    assignedLabs[type] = String(item.selected_lab_id).trim();
                } else {
                    item.selected_lab_id = String(eligibleLabs[0].lab_id).trim(); 
                    assignedLabs[type] = item.selected_lab_id;
                }
            } else {
                if (currentValid) {
                    assignedLabs[type] = String(item.selected_lab_id).trim();
                } else {
                    item.selected_lab_id = String(eligibleLabs[0].lab_id).trim();
                    assignedLabs[type] = item.selected_lab_id;
                }
            }
        } else {
            item.selected_lab_id = null; 
        }
    });
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
}

function renderCartWithLabs() {
    let html = ""; 
    let total = 0;
    let allItemsConfigured = true;
    
    cart.forEach((item, index) => {
        let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
        let itemQty = Number(item.qty || 1);
        total += (itemPrice * itemQty);
        let type = (item.service_type || "pathology").toLowerCase().trim();
        
        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        let isHomeEligible = homeServiceCategories.includes(type);
        let isHome = item.fulfillment === "home";
        let finalLabs = eligibleLabs;

        if (isHome) {
            finalLabs = eligibleLabs.filter(lab => lab.available_pincodes.includes(bookingData.pincode.toString()) || lab.pincode === bookingData.pincode.toString());
        }

        let toggleHtml = "";
        if(isHomeEligible) {
            let hAct = isHome ? "active" : "";
            let cAct = !isHome ? "active" : "";
            toggleHtml = `
                <div class="service-toggle-box">
                    <button class="toggle-btn ${hAct}" onclick="changeFulfill(${index}, 'home')"><i class="fas fa-home"></i> Home</button>
                    <button class="toggle-btn ${cAct}" onclick="changeFulfill(${index}, 'center')"><i class="fas fa-hospital"></i> Center</button>
                </div>`;
        } else {
            item.fulfillment = "center";
            toggleHtml = `<div class="center-only-badge"><i class="fas fa-info-circle"></i> Center Visit Required</div>`;
        }

        let labSelectHtml = "";
        if (finalLabs.length > 0) {
            let currentValid = item.selected_lab_id && finalLabs.some(l => String(l.lab_id).trim() === String(item.selected_lab_id).trim());
            if (!currentValid) item.selected_lab_id = String(finalLabs[0].lab_id).trim();

            let options = finalLabs.map(lab => {
                let badges = (lab.nabl ? " [NABL]" : "") + (lab.nabh ? " [NABH]" : "");
                let sel = String(lab.lab_id).trim() === String(item.selected_lab_id).trim() ? "selected" : "";
                return `<option value="${String(lab.lab_id).trim()}" ${sel}>${lab.lab_name} ${badges}</option>`;
            }).join('');

            labSelectHtml = `
                <div class="item-lab-selector">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">Assign to Lab:</label>
                    <select class="item-lab-select" onchange="assignLabToItem(${index}, this.value)">
                        ${options}
                    </select>
                </div>`;
        } else {
            item.selected_lab_id = null;
            allItemsConfigured = false;
            if (isHome && eligibleLabs.length > 0) {
                labSelectHtml = `<div class="item-error-box"><span><i class="fas fa-exclamation-triangle"></i> Home collection not available at Pin ${bookingData.pincode}.</span><button class="btn-small-outline" onclick="changeFulfill(${index}, 'center')">Switch to Center Visit</button></div>`;
            } else {
                labSelectHtml = `<div class="item-error-box"><span><i class="fas fa-times-circle"></i> No partner lab found in your area.</span></div>`;
            }
        }

        html += `
            <div style="padding:15px 0; border-bottom:1px dashed var(--border);">
                <div class="cart-item-header">
                    <div class="item-title-box">
                        <strong style="font-size:14px; color: var(--text-main);">${item.service_name}</strong>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Type: <span style="text-transform:capitalize;">${type}</span> | Qty: ${itemQty}</div>
                    </div>
                    <div class="price-box" style="display:flex; align-items:center;">
                        <strong style="color:var(--success); font-size: 15px;">₹${itemPrice * itemQty}</strong>
                        <button class="btn-remove-item" onclick="removeCartItem(${index})" title="Remove Item"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                ${toggleHtml}
                ${labSelectHtml}
            </div>`;
    });
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    document.getElementById('totalAmt').innerText = total;

    if (cart.length > 0 && allItemsConfigured) {
        document.getElementById('dateTimeSection').style.display = 'block';
        if(!document.getElementById('bookingDate').value) {
            let today = new Date().toISOString().split('T')[0];
            document.getElementById('bookingDate').setAttribute('min', today);
        }
    } else document.getElementById('dateTimeSection').style.display = 'none';

    validateCheckout();
}

function changeFulfill(index, type) {
    cart[index].fulfillment = type;
    autoAssignLabsByCategory(); 
    renderCartWithLabs(); 
}

function assignLabToItem(index, labId) {
    let cleanLabId = String(labId).trim();
    cart[index].selected_lab_id = cleanLabId;
    
    localStorage.setItem('bhavyaCart', JSON.stringify(cart)); 
    renderCartWithLabs(); 
    validateCheckout();
}

function removeCartItem(index) {
    if(confirm("Remove this item from your cart?")) {
        cart.splice(index, 1);
        localStorage.setItem('bhavyaCart', JSON.stringify(cart));
        if(cart.length === 0) showEmptyCart();
        else { autoAssignLabsByCategory(); renderCartWithLabs(); }
    }
}

// ==========================================
// 4. DATE, TIME & CHECKOUT VALIDATION
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
    if (cart.length === 0) { btn.disabled = true; return; }
    
    let allAssigned = cart.every(item => item.selected_lab_id !== null && item.selected_lab_id !== undefined);
    
    if(allAssigned && document.getElementById('bookingDate').value && selectedTime) {
        btn.disabled = false;
        document.getElementById('step3-nav').classList.add('active');
    } else {
        btn.disabled = true;
        document.getElementById('step3-nav').classList.remove('active');
    }
}

// ==========================================
// 5. FINAL BOOKING & SYNC LOGIN LOGIC
// ==========================================
function finalizeBooking() {
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId) {
        document.getElementById("displayOtpMobile").innerText = "+91 " + bookingData.mobile;
        document.getElementById("cartOtpModal").style.display = "flex";
        
        if (!window.cartRecaptchaVerifier) {
            window.cartRecaptchaVerifier = new firebase.auth.RecaptchaVerifier('cart-recaptcha-container', { 'size': 'normal' });
            window.cartRecaptchaVerifier.render();
        }

        let phoneNumber = "+91" + bookingData.mobile;
        
        firebase.auth().signInWithPhoneNumber(phoneNumber, window.cartRecaptchaVerifier)
            .then((result) => {
                cartConfirmationResult = result;
                document.getElementById("cart-recaptcha-container").style.display = "none";
                document.getElementById("cartOtpInputSection").style.display = "block";
                alert("OTP has been sent to your mobile number.");
            }).catch((error) => {
                console.error(error);
                alert("Error sending OTP. Please try again.");
                document.getElementById("cartOtpModal").style.display = "none";
            });
    } else {
        processOrderSubmission(userId);
    }
}

function verifyCartOTP() {
    const otp = document.getElementById('cartOtpCode').value;
    if(otp.length !== 6) return alert("Please enter valid 6-digit OTP");

    const btn = document.getElementById('cartVerifyOtpBtn');
    btn.innerText = "Verifying..."; 
    btn.disabled = true;

    cartConfirmationResult.confirm(otp).then((result) => {
        const user = result.user;
        proceedWithRegistration(user); 
    }).catch((error) => {
        alert("Invalid OTP! Please try again.");
        resetCartOtpBtn();
    });
}

function proceedWithRegistration(user) {
    const loginPayload = {
        action: "login",
        uid: user.uid,
        mobile: user.phoneNumber, 
        role: "patient",
        name: bookingData.name
    };

    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify(loginPayload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            const finalUserId = res.user_id || (res.data ? res.data.user_id : null); 
            const finalRole = res.role || "patient";

            localStorage.setItem("bhavya_uid", user.uid);
            localStorage.setItem("bhavya_mobile", user.phoneNumber);
            localStorage.setItem("bhavya_role", finalRole);
            localStorage.setItem("bhavya_user_id", finalUserId);
            localStorage.setItem("bhavya_name", bookingData.name);

            document.getElementById('cartOtpModal').style.display = 'none';
            processOrderSubmission(finalUserId); 
        } else {
            alert("Registration failed: " + res.message);
            resetCartOtpBtn();
        }
    }).catch(e => { 
        alert("Network Error: " + e.message); 
        resetCartOtpBtn(); 
    });
}

function resetCartOtpBtn() {
    const btn = document.getElementById('cartVerifyOtpBtn');
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
        slot_date: document.getElementById('bookingDate').value,
        slot_time: selectedTime
    };

    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify(payload) })
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
        alert("Network Error during checkout."); 
        btn.innerText = "Confirm Booking"; 
        btn.disabled = false; 
    });
}
