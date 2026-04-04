// ==========================================
// cart.js - 100% COMPLETE & FIXED (No Cache + Lab Slots)
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
let labSlots = {}; 

// ==========================================
// 1. REFRESH ON BACK BUTTON / CACHE BYPASS
// ==========================================
window.addEventListener('pageshow', function(event) {
    let isBack = window.performance && window.performance.navigation.type === 2;
    if (event.persisted || isBack) {
        window.location.reload();
        return;
    }
    initCart();
});

function initCart() {
    loadCartData();
    if(cart.length === 0) { 
        showEmptyCart(); 
        return; 
    }
    
    let s2 = document.getElementById('step2-card');
    if(s2 && document.getElementById('step1-nav').classList.contains('completed')) {
        s2.style.display = 'block';
    }

    const userId = localStorage.getItem("bhavya_user_id");
    if (userId) { fetchProfile(userId); }
    else { 
        document.getElementById('loadingOverlay').style.display = 'none'; 
        calculateFinalBill(); 
    }
}

function loadCartData() {
    try {
        let stored = localStorage.getItem('bhavyaCart');
        if (stored) {
            let parsed = JSON.parse(stored);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Double stringify fix
            if (Array.isArray(parsed) && parsed.length > 0) {
                cart = parsed.filter(item => item && item.service_name);
            } else { cart = []; }
        } else { cart = []; }
    } catch(e) { cart = []; }
}

function showEmptyCart() {
    const container = document.querySelector('.container');
    if(container) container.innerHTML = `<div style="text-align:center; padding:50px 20px;"><i class="fas fa-shopping-cart" style="font-size: 50px; color: var(--border); margin-bottom: 20px;"></i><h3 style="color:var(--text-main);">Your Cart is Empty</h3><p style="font-size:13px; color:var(--text-muted);">Please add tests from the booking page to proceed.</p><a href="../booking/booking.html" class="btn-main" style="display: inline-block; margin-top: 15px; width: auto; text-decoration:none;">Browse Services</a></div>`;
    document.getElementById('loadingOverlay').style.display = 'none';
    
    ['step1-card', 'step2-card', 'step3-card', 'dateTimeSection'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    const bar = document.querySelector('.bottom-bar');
    if(bar) bar.style.display = 'none';
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
            bookingData = res.data;
            document.getElementById('uMobile').value = bookingData.mobile;
            document.getElementById('uMobile').setAttribute("readonly", true);
            document.getElementById('uPincode').value = bookingData.pincode;
            document.getElementById('uAddress').value = bookingData.address;
            
            const nameBox = document.getElementById('nameInputBox');
            if(bookingData.isVip && bookingData.vipMembers && bookingData.vipMembers.length > 0) {
                let badge = document.getElementById('vipBadge');
                if(badge) badge.innerHTML = '<span style="background:var(--warning); color:white; font-size:10px; padding:4px 8px; border-radius:12px; margin-left: 10px;"><i class="fas fa-crown"></i> VIP Active</span>';
                let opts = bookingData.vipMembers.map(m => `<option value="${m}">${m}</option>`).join('');
                nameBox.innerHTML = `<select id="uName" class="form-input">${opts}</select>`;
            } else {
                nameBox.innerHTML = `<input type="text" id="uName" class="form-input" value="${bookingData.name}" placeholder="Patient Name">`;
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
    bookingData.name = document.getElementById('uName').value.trim();
    bookingData.pincode = document.getElementById('uPincode').value.trim();
    bookingData.address = document.getElementById('uAddress').value.trim();
    bookingData.mobile = document.getElementById('uMobile').value.trim();
    
    if(!bookingData.name || bookingData.pincode.length < 6 || bookingData.mobile.length < 10) return alert("Please enter valid Name, 10-digit Mobile, and Pincode.");

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
    
    let s2 = document.getElementById('step2-card');
    s2.style.display = 'block'; s2.style.opacity = '1'; s2.style.pointerEvents = 'auto';
    
    fetchLabs();
}

function editPatientInfo() {
    document.getElementById('infoForm').style.display = 'block';
    document.getElementById('infoSummary').style.display = 'none';
    let s2 = document.getElementById('step2-card');
    s2.style.opacity = '0.5'; s2.style.pointerEvents = 'none';
    validateCheckout();
}

// ==========================================
// 3. SMART GROUPING & LAB SELECTION
// ==========================================
function fetchLabs() {
    document.getElementById('loadingLabsSpinner').style.display = 'block';
    fetch(GAS_URL_CART, { method: "POST", body: JSON.stringify({ action: "getAllActiveLabs" }) })
    .then(res => res.json())
    .then(res => {
        document.getElementById('loadingLabsSpinner').style.display = 'none';
        if(res.status === "success") {
            allActiveLabsList = res.data.labs;
            autoAssignGroupLabs(); 
            renderGroupedCart(); 
        }
    }).catch(e => { document.getElementById('loadingLabsSpinner').style.display = 'none'; });
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
                items: [], fulfillment: item.fulfillment || (homeServiceCategories.includes(type) ? "home" : "center"), selected_lab_id: item.selected_lab_id
            };
        }
        groupedCart[type].items.push({ ...item, originalIndex: index });
    });

    for (const [type, group] of Object.entries(groupedCart)) {
        html += `<div class="group-container"><div class="group-header"><i class="fas fa-notes-medical"></i> ${type} Booking</div>`;

        group.items.forEach(item => {
            let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
            let qty = item.qty || 1;
            html += `<div class="cart-item-header" style="margin-bottom: 12px;"><div class="item-title-box"><strong style="font-size:14px; color: var(--text-main);">${item.service_name} <span style="color:var(--text-muted); font-size:12px;">(x${qty})</span></strong></div><div class="price-box" style="display:flex; align-items:center;"><strong style="color:var(--success); font-size: 15px;">₹${itemPrice * qty}</strong><button class="btn-remove-item" onclick="removeCartItem(${item.originalIndex})" title="Remove"><i class="fas fa-times"></i></button></div></div>`;
        });

        let isHomeEligible = homeServiceCategories.includes(type);
        let isHome = group.fulfillment === "home";
        if(isHomeEligible) {
            html += `<div class="service-toggle-box" style="margin-bottom:15px;"><button class="toggle-btn ${isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'home')"><i class="fas fa-home"></i> Home Collection</button><button class="toggle-btn ${!isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'center')"><i class="fas fa-hospital"></i> Center Visit</button></div>`;
        } else {
            html += `<div class="center-only-badge"><i class="fas fa-info-circle"></i> Center Visit Required for Scans</div>`;
        }

        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        if (isHome) eligibleLabs = eligibleLabs.filter(lab => lab.available_pincodes.includes(bookingData.pincode.toString()) || lab.pincode === bookingData.pincode.toString());

        if (eligibleLabs.length > 0) {
            html += `<p style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Provider for ${type}:</p>`;
            eligibleLabs.forEach(lab => {
                let isSelected = String(lab.lab_id) === String(group.selected_lab_id) ? "selected" : "";
                let nablBadge = lab.nabl ? `<span class="badge-small">NABL</span>` : "";
                let nabhBadge = lab.nabh ? `<span class="badge-small" style="background:#dcfce7; color:#065f46;">NABH</span>` : "";
                let imgSrc = lab.lab_image || "https://via.placeholder.com/60?text=LAB";
                html += `<div class="lab-card ${isSelected}" onclick="assignLabToGroup('${type}', '${lab.lab_id}')"><img src="${imgSrc}" class="lab-img" onerror="this.src='https://via.placeholder.com/60?text=LAB'"><div class="lab-info"><h4 class="lab-name">${lab.lab_name} ${nablBadge} ${nabhBadge}</h4><p class="lab-addr"><i class="fas fa-map-marker-alt"></i> ${lab.lab_address}, ${lab.city} - ${lab.pincode}</p></div>${isSelected ? '<i class="fas fa-check-circle" style="color:var(--success); font-size:18px;"></i>' : ''}</div>`;
            });
        } else {
            html += `<div class="item-error-box"><span><i class="fas fa-exclamation-triangle"></i> No provider found in your area for ${type}.</span></div>`;
        }
        html += `</div>`; 
    }
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    renderLabTimeSelectors();
    calculateFinalBill(); 
}

function changeGroupFulfill(type, fulfillment) {
    if (fulfillment === "home" && !allActiveLabsList.some(l => l.provided_services[type] && (l.pincode === bookingData.pincode || l.available_pincodes.includes(bookingData.pincode)))) {
        alert("Home collection is not available in your Pincode for this service."); return;
    }
    cart.forEach(item => { if ((item.service_type || "pathology").toLowerCase().trim() === type) item.fulfillment = fulfillment; });
    autoAssignGroupLabs(); renderGroupedCart(); 
}

function assignLabToGroup(type, labId) {
    cart.forEach(item => { if ((item.service_type || "pathology").toLowerCase().trim() === type) item.selected_lab_id = String(labId); });
    localStorage.setItem('bhavyaCart', JSON.stringify(cart)); renderGroupedCart(); 
}

function removeCartItem(originalIndex) {
    if(confirm("Remove this item from your cart?")) {
        cart.splice(originalIndex, 1);
        localStorage.setItem('bhavyaCart', JSON.stringify(cart));
        if(cart.length === 0) showEmptyCart(); else { autoAssignGroupLabs(); renderGroupedCart(); }
    }
}

// ==========================================
// 4. LAB-WISE TIMING LOGIC
// ==========================================
function parseTime(t) {
    if(!t) return null;
    let match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if(!match) return null;
    let h = parseInt(match[1]); let m = parseInt(match[2]); let ampm = match[3].toUpperCase();
    if(ampm === "PM" && h < 12) h += 12; if(ampm === "AM" && h === 12) h = 0;
    return h * 60 + m; 
}
function formatTime(mins) {
    let h = Math.floor(mins / 60); let m = mins % 60; let ampm = h >= 12 ? "PM" : "AM";
    let h12 = h % 12; if(h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function renderLabTimeSelectors() {
    let container = document.getElementById('labTimesContainer');
    if(!container) return;

    let uniqueLabIds = [...new Set(cart.map(c => c.selected_lab_id).filter(Boolean))];
    if(uniqueLabIds.length === 0) { container.innerHTML = ''; validateCheckout(); return; }

    let todayStr = new Date().toISOString().split('T')[0];
    let html = `<h3 style="font-size:15px; font-weight:800; margin-bottom:15px; color:var(--text-main);">Select Appointment Time</h3>`;

    uniqueLabIds.forEach(labId => {
        let lab = allActiveLabsList.find(l => String(l.lab_id) === String(labId));
        let labName = lab ? lab.lab_name : "Selected Provider";
        let fulfills = cart.filter(c => c.selected_lab_id === labId).map(c => c.fulfillment);
        let fText = fulfills.includes("home") ? "Home Collection" : "Center Visit";

        if(!labSlots[labId]) labSlots[labId] = { date: "", time: "" };
        let savedDate = labSlots[labId].date;

        html += `<div style="background: var(--primary-soft); border: 1px solid #bfdbfe; padding: 15px; border-radius: 12px; margin-bottom: 15px;"><strong style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:12px; color:var(--primary);"><span><i class="far fa-clock"></i> ${labName}</span><span style="font-size:11px; background:#dbeafe; padding:2px 8px; border-radius:6px; color:var(--text-main); font-weight:800;">${fText}</span></strong><input type="date" class="form-input" min="${todayStr}" value="${savedDate}" onchange="updateLabDate('${labId}', this.value)" style="margin-bottom:10px; background:white; padding:10px;"><div class="slot-grid" id="slots-${labId}"></div></div>`;
    });

    container.innerHTML = html;
    uniqueLabIds.forEach(labId => { if(labSlots[labId].date) { updateLabDate(labId, labSlots[labId].date, true); } });
    validateCheckout();
}

function updateLabDate(labId, dateStr, isRenderCall = false) {
    labSlots[labId].date = dateStr;
    if(!isRenderCall) labSlots[labId].time = ""; 

    let container = document.getElementById(`slots-${labId}`);
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
            html = `<p style="color:var(--danger); font-size:12px; font-weight:700;">Provider is closed on this day.</p>`;
        } else {
            for(let t = o; t <= c - 30; t += 30) {
                let slotStr = formatTime(t);
                let sel = labSlots[labId].time === slotStr ? "selected" : "";
                html += `<button class="slot-btn ${sel}" onclick="selectLabTime('${labId}', '${slotStr}')">${slotStr}</button>`;
            }
        }
    }
    container.innerHTML = html;
    validateCheckout();
}

function selectLabTime(labId, timeStr) { labSlots[labId].time = timeStr; updateLabDate(labId, labSlots[labId].date, true); }

// ==========================================
// 5. SMART BILLING & GUEST REFERRAL VALIDATION
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

    const userId = localStorage.getItem("bhavya_user_id") || "GUEST"; 

    btn.innerText = "Wait..."; btn.disabled = true;

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
        if (subtotal < freeLimit) collectionCharge = appRules.home_collection_charge || 50;
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

    finalBill.subtotal = subtotal; finalBill.collectionCharge = collectionCharge; finalBill.walletUsed = walletUsed; finalBill.totalPayable = totalPayable;

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
    
    let uniqueLabIds = [...new Set(cart.map(c => c.selected_lab_id).filter(Boolean))];
    let allLabsAssigned = cart.every(item => item.selected_lab_id);
    let allTimesSelected = uniqueLabIds.every(id => labSlots[id] && labSlots[id].date && labSlots[id].time);

    const s3 = document.getElementById('step3-card');

    if(allLabsAssigned && allTimesSelected) {
        if(s3) { s3.style.display = 'block'; s3.style.opacity = '1'; s3.style.pointerEvents = 'auto'; }
        calculateFinalBill(); 
        btn.disabled = false;
        document.getElementById('step3-nav').classList.add('active');
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

    const payload = {
        action: "submitBookingOrder",
        user_id: userId,
        patient_name: bookingData.name,
        mobile: bookingData.mobile, 
        pincode: bookingData.pincode,
        address: bookingData.address,
        cart_items: cart, 
        lab_slots: labSlots,
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
            window.location.replace("../index.html"); 
        } else {
            alert("Booking Error: " + res.message);
            btn.innerText = "Confirm Booking"; btn.disabled = false;
        }
    }).catch(e => { alert("Error during checkout."); btn.innerText = "Confirm Booking"; btn.disabled = false; });
}
