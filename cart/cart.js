const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

// App Configuration
const serviceablePincodes = ["124507", "124508", "110043"]; 
const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];

// State Management
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let bookingData = { name: "", mobile: "", pincode: "", address: "", isVip: false };
let matchedLabs = [];
let selectedLabId = null;
let selectedTime = null;

window.onload = () => {
    if(cart.length === 0) {
        document.querySelector('.container').innerHTML = "<h3 style='text-align:center; margin-top:50px;'>Your Cart is Empty</h3>";
        document.getElementById('loadingOverlay').style.display = 'none';
        document.querySelector('.bottom-bar').style.display = 'none';
        return;
    }

    // Auth Check
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        document.getElementById('loadingOverlay').style.display = 'none';
        document.getElementById('loginModal').style.display = 'flex';
    } else {
        fetchProfile(userId);
    }
};

// Placeholder for Firebase Auth
function triggerFirebaseLogin() {
    alert("Firebase Auth logic runs here. After success, save 'bhavya_user_id' and reload.");
    // localStorage.setItem("bhavya_user_id", "user123"); location.reload();
}

// STEP 1 LOGIC
function fetchProfile(userId) {
    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId }) })
    .then(res => res.json())
    .then(res => {
        document.getElementById('loadingOverlay').style.display = 'none';
        if(res.status === "success") {
            const data = res.data;
            bookingData.mobile = data.mobile;
            document.getElementById('uMobile').value = data.mobile;
            document.getElementById('uPincode').value = data.pincode;
            document.getElementById('uAddress').value = data.address;

            const nameBox = document.getElementById('nameInputBox');
            if(data.isVip && data.vipMembers.length > 0) {
                document.getElementById('vipBadge').innerHTML = '<span style="background:var(--warning); color:white; font-size:10px; padding:4px 8px; border-radius:12px;">VIP Active</span>';
                let opts = data.vipMembers.map(m => `<option value="${m}">${m}</option>`).join('');
                nameBox.innerHTML = `<select id="uName" class="form-input">${opts}</select>`;
            } else {
                nameBox.innerHTML = `<input type="text" id="uName" class="form-input" value="${data.name}" placeholder="Patient Name">`;
            }
        }
    }).catch(e => console.error("Profile Fetch Error", e));
}

function savePatientInfo() {
    const name = document.getElementById('uName').value.trim();
    const pin = document.getElementById('uPincode').value.trim();
    const addr = document.getElementById('uAddress').value.trim();

    if(!name || pin.length < 6) return alert("Valid Name and Pincode required!");

    bookingData.name = name;
    bookingData.pincode = pin;
    bookingData.address = addr;

    // Set default fulfillment for cart items
    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase();
        if(!item.fulfillment) item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
    });

    // Pincode Verification for Home Collection
    const needsHome = cart.some(i => i.fulfillment === "home");
    if(needsHome && !serviceablePincodes.includes(pin)) {
        document.getElementById('alertPin').innerText = pin;
        document.getElementById('pincodeModal').style.display = 'flex';
        return;
    }

    lockStep1();
}

function lockStep1() {
    document.getElementById('step1-nav').classList.add('completed');
    document.getElementById('step2-nav').classList.add('active');

    document.getElementById('sumName').innerText = bookingData.name;
    document.getElementById('sumMobile').innerText = bookingData.mobile;
    document.getElementById('sumAddress').innerText = `${bookingData.address} - ${bookingData.pincode}`;

    document.getElementById('infoForm').style.display = 'none';
    document.getElementById('infoSummary').style.display = 'block';

    const s2 = document.getElementById('step2-card');
    s2.style.display = 'block'; s2.style.opacity = '1'; s2.style.pointerEvents = 'auto';

    renderCart();
    fetchLabs();
}

function editPatientInfo() {
    document.getElementById('infoForm').style.display = 'block';
    document.getElementById('infoSummary').style.display = 'none';
    const s2 = document.getElementById('step2-card');
    s2.style.opacity = '0.5'; s2.style.pointerEvents = 'none';
    validateCheckout();
}

// MODAL HANDLERS
function closePincodeModal() { document.getElementById('pincodeModal').style.display = 'none'; editPatientInfo(); }
function switchAllToCenter() {
    cart.forEach(i => { if(i.fulfillment === 'home') i.fulfillment = 'center'; });
    document.getElementById('pincodeModal').style.display = 'none';
    lockStep1();
}

// STEP 2 LOGIC
function renderCart() {
    let html = ""; let total = 0;
    cart.forEach((item, index) => {
        total += (item.price * item.qty);
        let type = (item.service_type || "pathology").toLowerCase();
        let toggle = "";

        if(homeServiceCategories.includes(type)) {
            let hAct = item.fulfillment === "home" ? "active" : "";
            let cAct = item.fulfillment === "center" ? "active" : "";
            toggle = `<div class="service-toggle-box">
                        <button class="toggle-btn ${hAct}" onclick="changeFulfill(${index}, 'home')">Home</button>
                        <button class="toggle-btn ${cAct}" onclick="changeFulfill(${index}, 'center')">Center</button>
                      </div>`;
        } else {
            item.fulfillment = "center";
            toggle = `<div style="font-size:11px; color:var(--danger); font-weight:600; margin-top:8px;">[ Center Visit Required ]</div>`;
        }

        html += `<div style="padding:12px 0; border-bottom:1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between;">
                        <strong style="font-size:14px;">${item.service_name} x${item.qty}</strong>
                        <strong style="color:var(--success);">₹${item.price * item.qty}</strong>
                    </div>
                    ${toggle}
                 </div>`;
    });
    document.getElementById('cartItemsContainer').innerHTML = html;
    document.getElementById('totalAmt').innerText = total;
}

function changeFulfill(index, type) {
    if(type === 'home' && !serviceablePincodes.includes(bookingData.pincode)) {
        return alert("Area not serviceable for Home Collection.");
    }
    cart[index].fulfillment = type;
    renderCart(); validateCheckout();
}

function fetchLabs() {
    document.getElementById('labSection').style.display = 'block';
    document.getElementById('labsContainer').innerHTML = "<p style='font-size:13px; color:var(--text-muted);'>Finding partner labs...</p>";
    
    let requiredTypes = [...new Set(cart.map(i => i.service_type))];

    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getMatchedLabs", pincode: bookingData.pincode, required_types: requiredTypes })})
    .then(res => res.json())
    .then(res => {
        if(res.status === "success" && res.data.labs.length > 0) {
            matchedLabs = res.data.labs;
            selectedLabId = null;
            renderLabs();
        } else {
            document.getElementById('labsContainer').innerHTML = "<p style='color:var(--danger); font-size:13px;'>No labs found offering all selected services in your area.</p>";
        }
    });
}

function renderLabs() {
    let html = matchedLabs.map(lab => `
        <div class="lab-card ${selectedLabId === lab.lab_id ? 'selected' : ''}" onclick="selectLab('${lab.lab_id}')">
            <strong style="font-size:14px;">${lab.lab_name}</strong>
            <span style="font-size:12px; color:var(--text-muted);">${lab.lab_address}</span>
        </div>
    `).join('');
    document.getElementById('labsContainer').innerHTML = html;
}

function selectLab(id) {
    selectedLabId = id;
    renderLabs();
    document.getElementById('dateTimeSection').style.display = 'block';
    
    // Set min date to today
    let today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').setAttribute('min', today);
    validateCheckout();
}

function generateSlots() {
    if(!document.getElementById('bookingDate').value) return;
    const slots = ["09:00 AM", "10:00 AM", "11:30 AM", "01:00 PM", "03:00 PM", "05:00 PM"];
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

// STEP 3 LOGIC
function validateCheckout() {
    const btn = document.getElementById('confirmBtn');
    const date = document.getElementById('bookingDate').value;
    
    if(selectedLabId && date && selectedTime) {
        btn.disabled = false;
        document.getElementById('step3-nav').classList.add('active');
    } else {
        btn.disabled = true;
        document.getElementById('step3-nav').classList.remove('active');
    }
}

function finalizeBooking() {
    const btn = document.getElementById('confirmBtn');
    btn.innerText = "Processing..."; btn.disabled = true;

    const payload = {
        action: "submitBookingOrder",
        user_id: localStorage.getItem("bhavya_user_id"),
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
            localStorage.removeItem('bhavyaCart');
            alert(`🎉 Booking Successful!\nOrder ID: ${res.data.order_id}`);
            window.location.href = "../index.html"; // Redirect to Home/Orders
        } else {
            alert("Error: " + res.message);
            btn.innerText = "Confirm Booking"; btn.disabled = false;
        }
    }).catch(e => { alert("Network Error"); btn.innerText = "Confirm Booking"; btn.disabled = false; });
}
