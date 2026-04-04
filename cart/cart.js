// ==========================================
// CART & CHECKOUT LOGIC (PREMIUM + WALLET + PER-GROUP SLOTS)
// ==========================================

const GAS_URL_CART = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];

let cart = [];
let bookingData = { name: "", mobile: "", pincode: "", address: "", isVip: false };
let allActiveLabsList = []; 
let cartConfirmationResult; 

let appRules = {};
let userWalletBalance = 0;
let finalBill = { subtotal: 0, collectionCharge: 0, walletUsed: 0, refDiscount: 0, totalPayable: 0, refCode: "" };
let groupSlots = {}; // 🌟 NAYA: Stores selected date/time per group { "pathology": {date:"", time:""} }

// ==========================================
// 1. HARD REFRESH & LOAD CART
// ==========================================
window.onload = () => {
    loadCartData();

    if(cart.length === 0) {
        showEmptyCart();
        return;
    }

    calculateFinalBill(); 

    const userId = localStorage.getItem("bhavya_user_id");
    if (userId) { fetchProfile(userId); } 
    else { document.getElementById('loadingOverlay').style.display = 'none'; }
};

function loadCartData() {
    try {
        let stored = localStorage.getItem('bhavyaCart');
        cart = stored ? JSON.parse(stored) : [];
        // Filter out bad data
        cart = cart.filter(item => item && item.service_id);
    } catch(e) { cart = []; }
}

function showEmptyCart() {
    let container = document.querySelector('.container');
    if(container) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 50px; color: var(--border); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text-main);">Your Cart is Empty</h3>
                <p style="font-size:13px; color:var(--text-muted);">Please add tests from the booking page to proceed.</p>
                <a href="../booking/booking.html" class="btn-main" style="display: inline-block; margin-top: 15px; width: auto; text-decoration:none;">Browse Services</a>
            </div>`;
    }
    document.getElementById('loadingOverlay').style.display = 'none';
    let bottomBar = document.querySelector('.bottom-bar');
    if(bottomBar) bottomBar.style.display = 'none';
}

// ==========================================
// 2. PATIENT PROFILE, RULES & WALLET
// ==========================================
function fetchProfile(userId) {
    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId }) })
    .then(res => res.json())
    .then(res => {
        document.getElementById('loadingOverlay').style.display = 'none';
        if(res.status === "success") {
            const data = res.data;
            bookingData.mobile = data.mobile;
            bookingData.isVip = data.isVip; 
            
            document.getElementById('uMobile').value = data.mobile;
            document.getElementById('uMobile').setAttribute("readonly", true); 
            document.getElementById('uPincode').value = data.pincode;
            document.getElementById('uAddress').value = data.address;

            const nameBox = document.getElementById('nameInputBox');
            if(data.isVip && data.vipMembers && data.vipMembers.length > 0) {
                let badge = document.getElementById('vipBadge');
                if(badge) badge.innerHTML = '<span style="background:var(--warning); color:white; font-size:10px; padding:4px 8px; border-radius:12px; margin-left: 10px;"><i class="fas fa-crown"></i> VIP Active</span>';
                let opts = data.vipMembers.map(m => `<option value="${m}">${m}</option>`).join('');
                nameBox.innerHTML = `<select id="uName" class="form-input">${opts}</select>`;
            } else {
                nameBox.innerHTML = `<input type="text" id="uName" class="form-input" value="${data.name}" placeholder="Patient Name">`;
            }
        }
    }).catch(e => { document.getElementById('loadingOverlay').style.display = 'none'; });

    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify({ action: "getCartRulesAndWallet", user_id: userId }) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            appRules = res.data.rules || {};
            userWalletBalance = res.data.wallet_balance || 0;
            let walletTxt = document.getElementById('walletBalTxt');
            if(walletTxt) walletTxt.innerText = userWalletBalance;
            calculateFinalBill(); 
        }
    });
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
// 3. SMART GROUPING, LABS & PER-GROUP SLOTS 🌟
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
            autoAssignGroupLabs(); 
            renderGroupedCart(); 
        } else alert("Error fetching labs.");
    }).catch(e => {
        if (spinner) spinner.style.display = 'none';
        alert("Network Error.");
    });
}

function autoAssignGroupLabs() {
    let assignedLabs = {}; 
    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        
        if (item.fulfillment === "home") {
            eligibleLabs = eligibleLabs.filter(lab => lab.available_pincodes.includes(bookingData.pincode.toString()) || lab.pincode === bookingData.pincode.toString());
        }

        if (eligibleLabs.length > 0) {
            if (!assignedLabs[type]) {
                let existingValidLab = eligibleLabs.find(l => String(l.lab_id) === String(item.selected_lab_id));
                assignedLabs[type] = existingValidLab ? String(existingValidLab.lab_id) : String(eligibleLabs[0].lab_id);
            }
            item.selected_lab_id = assignedLabs[type];
        } else {
            item.selected_lab_id = null; 
        }
    });
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
}

function renderGroupedCart() {
    let html = ""; 
    let groupedCart = {};

    cart.forEach((item, index) => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if(!groupedCart[type]) {
            groupedCart[type] = {
                items: [],
                fulfillment: item.fulfillment || (homeServiceCategories.includes(type) ? "home" : "center"),
                selected_lab_id: item.selected_lab_id
            };
            if(!groupSlots[type]) groupSlots[type] = { date: "", time: "" }; // Initialize slots
        }
        groupedCart[type].items.push({ ...item, originalIndex: index });
    });

    let todayStr = new Date().toISOString().split('T')[0];

    for (const [type, group] of Object.entries(groupedCart)) {
        html += `<div class="group-container">
                    <div class="group-header"><i class="fas fa-notes-medical"></i> ${type} Booking</div>`;

        // Render Items
        group.items.forEach(item => {
            let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
            html += `
                <div class="cart-item-header" style="margin-bottom: 12px;">
                    <div class="item-title-box">
                        <strong style="font-size:14px; color: var(--text-main);">${item.service_name} <span style="color:var(--text-muted); font-size:12px;">(x${item.qty})</span></strong>
                    </div>
                    <div class="price-box" style="display:flex; align-items:center;">
                        <strong style="color:var(--success); font-size: 15px;">₹${itemPrice * item.qty}</strong>
                        <button class="btn-remove-item" onclick="removeCartItem(${item.originalIndex})" title="Remove"><i class="fas fa-times"></i></button>
                    </div>
                </div>`;
        });

        // Render Fulfillment
        let isHomeEligible = homeServiceCategories.includes(type);
        let isHome = group.fulfillment === "home";
        if(isHomeEligible) {
            html += `
                <div class="service-toggle-box" style="margin-bottom:15px;">
                    <button class="toggle-btn ${isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'home')"><i class="fas fa-home"></i> Home Collection</button>
                    <button class="toggle-btn ${!isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'center')"><i class="fas fa-hospital"></i> Center Visit</button>
                </div>`;
        } else {
            html += `<div class="center-only-badge"><i class="fas fa-info-circle"></i> Center Visit Required for Scans</div>`;
        }

        // Render Lab Cards
        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        if (isHome) eligibleLabs = eligibleLabs.filter(lab => lab.available_pincodes.includes(bookingData.pincode.toString()) || lab.pincode === bookingData.pincode.toString());

        if (eligibleLabs.length > 0) {
            html += `<p style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Provider for ${type}:</p>`;
            eligibleLabs.forEach(lab => {
                let isSelected = String(lab.lab_id) === String(group.selected_lab_id) ? "selected" : "";
                let nablBadge = lab.nabl ? `<span class="badge-small">NABL</span>` : "";
                let nabhBadge = lab.nabh ? `<span class="badge-small" style="background:#dcfce7; color:#065f46;">NABH</span>` : "";
                let imgSrc = lab.lab_image || "https://via.placeholder.com/60?text=LAB";

                html += `
                    <div class="lab-card ${isSelected}" onclick="assignLabToGroup('${type}', '${lab.lab_id}')">
                        <img src="${imgSrc}" class="lab-img" onerror="this.src='https://via.placeholder.com/60?text=LAB'">
                        <div class="lab-info">
                            <h4 class="lab-name">${lab.lab_name} ${nablBadge} ${nabhBadge}</h4>
                            <p class="lab-addr"><i class="fas fa-map-marker-alt"></i> ${lab.lab_address}, ${lab.city} - ${lab.pincode}</p>
                        </div>
                        ${isSelected ? '<i class="fas fa-check-circle" style="color:var(--success); font-size:18px;"></i>' : ''}
                    </div>`;
            });

            // 🌟 NAYA: HAR GROUP KE ANDAR TIME SELECTOR 🌟
            if(group.selected_lab_id) {
                let savedDate = groupSlots[type].date || "";
                html += `
                <div class="group-time-sec">
                    <label class="input-label" style="color:var(--primary);"><i class="far fa-calendar-alt"></i> Date & Time for ${type}</label>
                    <input type="date" class="form-input" min="${todayStr}" value="${savedDate}" onchange="updateGroupDate('${type}', this.value, '${group.selected_lab_id}')" style="margin-bottom:10px; background:white;">
                    <div class="slot-grid" id="slots-${type}"></div>
                </div>`;
            }

        } else {
            html += `<div class="item-error-box"><span><i class="fas fa-exclamation-triangle"></i> No provider found in your area for ${type}.</span></div>`;
        }
        
        html += `</div>`; // Close group
    }
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    
    // Automatically generate slots for groups that have dates saved
    for (const [type, data] of Object.entries(groupSlots)) {
        if(data.date) {
            // Find labid
            let labId = cart.find(c => (c.service_type || "pathology").toLowerCase().trim() === type)?.selected_lab_id;
            if(labId) updateGroupDate(type, data.date, labId, true);
        }
    }

    calculateFinalBill(); 
    validateCheckout();
}

function changeGroupFulfill(type, fulfillment) {
    if (fulfillment === "home" && !allActiveLabsList.some(l => l.provided_services[type] && (l.pincode === bookingData.pincode || l.available_pincodes.includes(bookingData.pincode)))) {
        alert("Home collection is not available in your Pincode for this service.");
        return;
    }
    cart.forEach(item => {
        if ((item.service_type || "pathology").toLowerCase().trim() === type) item.fulfillment = fulfillment;
    });
    autoAssignGroupLabs(); 
    renderGroupedCart(); 
}

function assignLabToGroup(type, labId) {
    cart.forEach(item => {
        if ((item.service_type || "pathology").toLowerCase().trim() === type) item.selected_lab_id = String(labId);
    });
    groupSlots[type] = { date: "", time: "" }; // Reset time if lab changes
    localStorage.setItem('bhavyaCart', JSON.stringify(cart)); 
    renderGroupedCart(); 
}

function removeCartItem(originalIndex) {
    if(confirm("Remove this item from your cart?")) {
        cart.splice(originalIndex, 1);
        localStorage.setItem('bhavyaCart', JSON.stringify(cart));
        if(cart.length === 0) showEmptyCart();
        else { autoAssignGroupLabs(); renderGroupedCart(); }
    }
}

// ==========================================
// 4. PER-GROUP TIMING LOGIC 🌟
// ==========================================
function parseTime(t) {
    if(!t) return null;
    let match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if(!match) return null;
    let h = parseInt(match[1]); let m = parseInt(match[2]); let ampm = match[3].toUpperCase();
    if(ampm === "PM" && h < 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    return h * 60 + m; 
}
function formatTime(mins) {
    let h = Math.floor(mins / 60); let m = mins % 60; let ampm = h >= 12 ? "PM" : "AM";
    let h12 = h % 12; if(h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function updateGroupDate(type, dateStr, labId, isRenderCall = false) {
    groupSlots[type].date = dateStr;
    if(!isRenderCall) groupSlots[type].time = ""; // Reset time if user manually changed date

    let container = document.getElementById(`slots-${type}`);
    if(!container || !dateStr) return;

    let dateObj = new Date(dateStr);
    let days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let dayName = days[dateObj.getDay()];

    let lab = allActiveLabsList.find(l => String(l.lab_id) === String(labId));
    let html = "";

    if(lab && lab.timings && lab.timings[dayName]) {
        let o = parseTime(lab.timings[dayName].open) || parseTime("09:00 AM");
        let c = parseTime(lab.timings[dayName].close) || parseTime("08:00 PM");
        
        if (o >= c - 30) {
            html = `<p style="color:var(--danger); font-size:12px;">Provider is closed on this day.</p>`;
        } else {
            for(let t = o; t <= c - 30; t += 30) {
                let slotStr = formatTime(t);
                let sel = groupSlots[type].time === slotStr ? "selected" : "";
                html += `<button class="slot-btn ${sel}" onclick="selectGroupTime('${type}', '${slotStr}')">${slotStr}</button>`;
            }
        }
    }
    container.innerHTML = html;
    validateCheckout();
}

function selectGroupTime(type, timeStr) {
    groupSlots[type].time = timeStr;
    renderGroupedCart(); // Simple re-render to update selected classes and check checkout state
}


// ==========================================
// 5. SMART BILLING & REFERRAL DB VALIDATION 🌟
// ==========================================

function applyReferral() {
    let code = document.getElementById('refCodeInput').value.trim().toUpperCase();
    let msg = document.getElementById('refMessage');
    let btn = document.getElementById('applyRefBtn');
    
    if(!code) { msg.innerText = "Enter code!"; msg.style.color = "var(--danger)"; return; }
    
    let minOrder = appRules.min_order_for_referral || 300;
    if(finalBill.subtotal < minOrder) {
        msg.innerText = `Minimum order ₹${minOrder} required.`; msg.style.color = "var(--danger)"; return;
    }

    const userId = localStorage.getItem("bhavya_user_id");
    if(!userId) { msg.innerText = "Please login first."; return; }

    btn.innerText = "Wait..."; btn.disabled = true;

    // 🌟 SEEDHA BACKEND SE CHECK KAREGA 🌟
    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify({ action: "verifyReferralCode", user_id: userId, referral_code: code }) })
    .then(res => res.json())
    .then(res => {
        btn.innerText = "Apply"; btn.disabled = false;
        if(res.status === "success") {
            finalBill.refCode = code;
            finalBill.refDiscount = appRules.referral_bonus || 50; 
            msg.innerHTML = `<i class="fas fa-check-circle"></i> Code applied! ₹${finalBill.refDiscount} off.`;
            msg.style.color = "var(--success)";
            calculateFinalBill();
        } else {
            finalBill.refCode = ""; finalBill.refDiscount = 0;
            msg.innerHTML = `<i class="fas fa-times-circle"></i> ${res.message}`;
            msg.style.color = "var(--danger)";
            calculateFinalBill();
        }
    }).catch(e => { btn.innerText = "Apply"; btn.disabled = false; });
}

function calculateFinalBill() {
    let subtotal = 0;
    let isHomeCollection = false;
    
    cart.forEach(item => {
        subtotal += (Number(item.price || item.basic_price || item.service_price || 0) * Number(item.qty || 1));
        if (item.fulfillment === "home") isHomeCollection = true;
    });

    let collectionCharge = 0;
    if (isHomeCollection) {
        let freeLimit = bookingData.isVip ? (appRules.free_collection_limit_vip || 100) : (appRules.free_collection_limit_basic || 300);
        if (subtotal < freeLimit) {
            collectionCharge = appRules.home_collection_charge || 50;
        }
    }

    let walletUsed = 0;
    let walletCb = document.getElementById('useWalletCb');
    if (walletCb && walletCb.checked) {
        let maxAllowed = bookingData.isVip ? (appRules.vip_max_wallet_use || 200) : (appRules.basic_max_wallet_use || 50);
        walletUsed = Math.min(userWalletBalance, maxAllowed, subtotal); 
    }

    let totalDiscount = walletUsed + finalBill.refDiscount;
    let totalPayable = subtotal + collectionCharge - totalDiscount;
    if (totalPayable < 0) totalPayable = 0;

    finalBill.subtotal = subtotal;
    finalBill.collectionCharge = collectionCharge;
    finalBill.walletUsed = walletUsed;
    finalBill.totalPayable = totalPayable;

    let tAmt = document.getElementById('totalAmt'); if(tAmt) tAmt.innerText = totalPayable;
    let sumTotal = document.getElementById('summaryTotalAmt'); if(sumTotal) sumTotal.innerText = totalPayable;
    let sumCount = document.getElementById('summaryItemCount'); if(sumCount) sumCount.innerText = cart.length;
    
    let chargeUI = document.getElementById('summaryChargeTxt'); 
    if (chargeUI) {
        if (collectionCharge === 0) chargeUI.innerHTML = `<span style="color:var(--success); background:var(--success-soft); padding:2px 8px; border-radius:6px;">FREE</span>`;
        else { chargeUI.innerText = `₹${collectionCharge}`; chargeUI.style.color = "var(--text-main)"; chargeUI.style.background = "transparent"; }
    }
}

function validateCheckout() {
    const btn = document.getElementById('confirmBtn');
    if (cart.length === 0) { btn.disabled = true; return; }
    
    // Check if every active group has a lab, date, and time
    let isReady = true;
    let activeTypes = [...new Set(cart.map(c => (c.service_type || "pathology").toLowerCase().trim()))];
    
    activeTypes.forEach(t => {
        let labId = cart.find(c => (c.service_type || "pathology").toLowerCase().trim() === t)?.selected_lab_id;
        if(!labId || !groupSlots[t] || !groupSlots[t].date || !groupSlots[t].time) isReady = false;
    });

    const s3 = document.getElementById('step3-card');

    if(isReady) {
        if(s3) { s3.style.display = 'block'; s3.style.opacity = '1'; s3.style.pointerEvents = 'auto'; }
        calculateFinalBill(); 
        btn.disabled = false;
        document.getElementById('step3-nav').classList.add('active');
        if(s3) s3.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
        if(s3) { s3.style.opacity = '0.5'; s3.style.pointerEvents = 'none'; }
        btn.disabled = true;
        document.getElementById('step3-nav').classList.remove('active');
    }
}

// ==========================================
// 6. FINAL BOOKING 
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

        firebase.auth().signInWithPhoneNumber("+91" + bookingData.mobile, window.cartRecaptchaVerifier)
            .then((result) => {
                cartConfirmationResult = result;
                document.getElementById("cart-recaptcha-container").style.display = "none";
                document.getElementById("cartOtpInputSection").style.display = "block";
            }).catch((error) => {
                alert("Error sending OTP.");
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
    btn.innerText = "Verifying..."; btn.disabled = true;

    cartConfirmationResult.confirm(otp).then((result) => {
        proceedWithRegistration(result.user); 
    }).catch((error) => {
        alert("Invalid OTP! Please try again.");
        btn.innerHTML = "Confirm Order <i class='fas fa-check-circle' style='margin-left: 5px;'></i>"; btn.disabled = false;
    });
}

function proceedWithRegistration(user) {
    const payload = { action: "login", uid: user.uid, mobile: user.phoneNumber, role: "patient", name: bookingData.name };

    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            const finalUserId = res.user_id || (res.data ? res.data.user_id : null); 
            localStorage.setItem("bhavya_uid", user.uid); localStorage.setItem("bhavya_mobile", user.phoneNumber); localStorage.setItem("bhavya_role", res.role || "patient"); localStorage.setItem("bhavya_user_id", finalUserId); localStorage.setItem("bhavya_name", bookingData.name);
            document.getElementById('cartOtpModal').style.display = 'none';
            processOrderSubmission(finalUserId); 
        } else { alert("Registration failed."); }
    }).catch(e => { alert("Network Error."); });
}

function processOrderSubmission(userId) {
    const btn = document.getElementById('confirmBtn');
    btn.innerText = "Processing Order..."; btn.disabled = true;

    // Attach group slots to cart items before sending
    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        item.slot_date = groupSlots[type].date;
        item.slot_time = groupSlots[type].time;
    });

    const payload = {
        action: "submitBookingOrder",
        user_id: userId,
        patient_name: bookingData.name,
        mobile: bookingData.mobile, 
        pincode: bookingData.pincode,
        address: bookingData.address,
        cart_items: cart, 
        subtotal: finalBill.subtotal,
        collection_charge: finalBill.collectionCharge,
        wallet_used: finalBill.walletUsed,
        total_discount: (finalBill.walletUsed + finalBill.refDiscount),
        referral_code: finalBill.refCode,
        final_total: finalBill.totalPayable
    };

    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            localStorage.removeItem('bhavyaCart'); 
            alert(`🎉 Booking Successful!\n\nYour Order is confirmed. You can pay directly via Cash or UPI.`);
            window.location.href = "../index.html"; 
        } else {
            alert("Booking Error: " + res.message);
            btn.innerText = "Confirm Booking"; btn.disabled = false;
        }
    }).catch(e => { alert("Error during checkout."); btn.innerText = "Confirm Booking"; btn.disabled = false; });
}
