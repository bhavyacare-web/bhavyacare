// ==========================================
// CART & CHECKOUT LOGIC (PREMIUM AGGREGATOR)
// ==========================================

const GAS_URL_CART = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];

let cart = [];
let bookingData = { name: "", mobile: "", pincode: "", address: "", isVip: false };
let allActiveLabsList = []; 
let selectedTime = null;
let cartConfirmationResult; 

// ==========================================
// 1. INITIALIZATION & SAFE LOCAL STORAGE
// ==========================================
window.onload = () => {
    try {
        cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
    } catch(e) {
        console.error("Local Storage Error:", e);
        cart = [];
    }

    if(cart.length === 0) {
        showEmptyCart();
        return;
    }

    let initialTotal = 0;
    cart.forEach(item => {
        let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
        let itemQty = Number(item.qty || 1);
        initialTotal += (itemPrice * itemQty);
    });
    document.getElementById('totalAmt').innerText = initialTotal;

    const userId = localStorage.getItem("bhavya_user_id");
    if (userId) { fetchProfile(userId); } 
    else { document.getElementById('loadingOverlay').style.display = 'none'; }

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
                <p style="font-size:13px; color:var(--text-muted);">Please add tests from the booking page to proceed.</p>
                <a href="../booking/booking.html" class="btn-main" style="display: inline-block; margin-top: 15px; width: auto; text-decoration:none;">Browse Services</a>
            </div>`;
    }
    document.getElementById('loadingOverlay').style.display = 'none';
    let bottomBar = document.querySelector('.bottom-bar');
    if(bottomBar) bottomBar.style.display = 'none';
}

// ... (fetchProfile, savePatientInfo, lockStep1, editPatientInfo SAME RAHENGE JO PICHLI BAAR THE) ...
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
// 3. SMART GROUPING & LAB CARDS
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
            // Group logic: assign same lab to same service type
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
    let total = 0;
    let allItemsConfigured = true;

    // 🌟 GROUPING LOGIC 🌟
    let groupedCart = {};
    cart.forEach((item, index) => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if(!groupedCart[type]) {
            groupedCart[type] = {
                items: [],
                fulfillment: item.fulfillment || (homeServiceCategories.includes(type) ? "home" : "center"),
                selected_lab_id: item.selected_lab_id
            };
        }
        groupedCart[type].items.push({ ...item, originalIndex: index });
        total += Number(item.price || item.service_price || item.basic_price || 0) * Number(item.qty || 1);
    });

    // 🌟 RENDER GROUPS 🌟
    for (const [type, group] of Object.entries(groupedCart)) {
        html += `<div class="group-container">
                    <div class="group-header"><i class="fas fa-notes-medical"></i> ${type} Services</div>`;

        // Render Items inside Group
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

        // Render Home/Center Toggle for Group
        let isHomeEligible = homeServiceCategories.includes(type);
        let isHome = group.fulfillment === "home";
        if(isHomeEligible) {
            html += `
                <div class="service-toggle-box" style="margin-bottom:15px;">
                    <button class="toggle-btn ${isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'home')"><i class="fas fa-home"></i> Home Collection</button>
                    <button class="toggle-btn ${!isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'center')"><i class="fas fa-hospital"></i> Center Visit</button>
                </div>`;
        } else {
            html += `<div class="center-only-badge" style="margin-bottom:15px;"><i class="fas fa-info-circle"></i> Center Visit Required for Scans</div>`;
        }

        // Render Lab Selection CARDS for Group
        let eligibleLabs = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        if (isHome) eligibleLabs = eligibleLabs.filter(lab => lab.available_pincodes.includes(bookingData.pincode.toString()) || lab.pincode === bookingData.pincode.toString());

        if (eligibleLabs.length > 0) {
            html += `<p style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Select Provider for ${type}:</p>`;
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
        } else {
            allItemsConfigured = false;
            html += `<div class="item-error-box" style="margin-top:10px;">
                        <span><i class="fas fa-exclamation-triangle"></i> No provider found in your area for ${type}.</span>
                     </div>`;
        }
        
        html += `</div>`; // Close group-container
    }
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    document.getElementById('totalAmt').innerText = total;

    if (cart.length > 0 && allItemsConfigured) {
        document.getElementById('dateTimeSection').style.display = 'block';
        if(!document.getElementById('bookingDate').value) {
            let today = new Date().toISOString().split('T')[0];
            document.getElementById('bookingDate').setAttribute('min', today);
        }
        generateSlots(); // Generate slots immediately based on selected labs
    } else {
        document.getElementById('dateTimeSection').style.display = 'none';
    }

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
// 4. DYNAMIC 30-MIN TIME SLOTS
// ==========================================
function parseTime(t) {
    if(!t) return null;
    let match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if(!match) return null;
    let h = parseInt(match[1]);
    let m = parseInt(match[2]);
    let ampm = match[3].toUpperCase();
    if(ampm === "PM" && h < 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    return h * 60 + m; // returns minutes from midnight
}

function formatTime(mins) {
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    let ampm = h >= 12 ? "PM" : "AM";
    let h12 = h % 12;
    if(h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function generateSlots() {
    const dateVal = document.getElementById('bookingDate').value;
    if(!dateVal) return;

    const dateObj = new Date(dateVal);
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = days[dateObj.getDay()];

    // Find the strictest overlapping open/close time for all selected labs
    let maxOpen = 0;
    let minClose = 24 * 60;
    
    let selectedLabIds = [...new Set(cart.map(i => i.selected_lab_id).filter(id => id))];
    
    selectedLabIds.forEach(id => {
        let lab = allActiveLabsList.find(l => String(l.lab_id) === String(id));
        if(lab && lab.timings && lab.timings[dayName]) {
            let o = parseTime(lab.timings[dayName].open) || parseTime("09:00 AM");
            let c = parseTime(lab.timings[dayName].close) || parseTime("08:00 PM");
            if(o > maxOpen) maxOpen = o;
            if(c < minClose) minClose = c;
        }
    });

    let html = "";
    if (maxOpen >= minClose - 30) {
        html = `<p style="grid-column: span 3; color: var(--danger); font-size:12px; font-weight:600;">Selected providers are closed or do not have overlapping timings on this day.</p>`;
    } else {
        for(let t = maxOpen; t <= minClose - 30; t += 30) {
            let slotStr = formatTime(t);
            html += `<button class="slot-btn" onclick="selectTime(this, '${slotStr}')">${slotStr}</button>`;
        }
    }
    
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
