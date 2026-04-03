const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

// Active Pincodes for Home Collection
const serviceablePincodes = ["124507", "124508", "110043"]; 
// Added missing types to prevent wrong "Center Only" flags
const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'holter', 'pft', 'blood test'];

let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let matchedLabsList = [];
let selectedLabId = null;
let selectedTimeSlot = null;

let bookingPatient = { name: "", mobile: "", pincode: "", address: "", isVip: false };

window.onload = () => {
    checkEmptyCart();
    
    // Ensure Date picker cannot select past dates
    let today = new Date().toISOString().split('T')[0];
    document.getElementById("bookingDate").setAttribute('min', today);

    // 🌟 FIX: TRIGGER BUILT-IN LOGIN POPUP 🌟
    const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id");
    if (!userId) {
        document.getElementById('loadingOverlay').style.display = "none";
        document.getElementById('login-section').style.display = "block";
        if(typeof setupRecaptcha === "function") setupRecaptcha();
        return;
    }
    fetchPatientProfile(userId);
};

function checkEmptyCart() {
    if (cart.length === 0) {
        document.getElementById('loadingOverlay').style.display = "none";
        document.querySelector('.container').innerHTML = "<div style='text-align:center; padding:40px;'><i class='fas fa-shopping-cart' style='font-size:40px; color:#cbd5e1; margin-bottom:15px;'></i><br><h3 style='color:var(--text-main);'>Cart is Empty</h3><a href='../booking/booking.html' style='color:var(--primary); font-weight:bold; text-decoration:none;'>Go Back to Booking</a></div>";
        document.querySelector('.bottom-bar').style.display = "none";
        return true;
    }
    return false;
}

// 🌟 STEP 1: FETCH PROFILE 🌟
function fetchPatientProfile(userId) {
    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId }) })
    .then(res => res.json())
    .then(response => {
        document.getElementById('loadingOverlay').style.display = "none";
        if (response.status === "success") {
            const data = response.data;
            bookingPatient.mobile = data.mobile;
            bookingPatient.isVip = data.isVip;
            
            document.getElementById('userMobile').value = data.mobile;
            document.getElementById('userPincode').value = data.pincode;
            document.getElementById('userAddress').value = data.address;

            const nameContainer = document.getElementById('nameInputContainer');
            if (data.isVip && data.vipMembers.length > 0) {
                document.getElementById('vipTagContainer').innerHTML = '<span class="vip-badge"><i class="fas fa-crown"></i> VIP Active</span>';
                let selectHtml = `<select id="userNameInput" class="form-input">`;
                data.vipMembers.forEach(mem => { selectHtml += `<option value="${mem}">${mem}</option>`; });
                selectHtml += `</select>`;
                nameContainer.innerHTML = selectHtml;
            } else {
                document.getElementById('vipTagContainer').innerHTML = '';
                nameContainer.innerHTML = `<input type="text" id="userNameInput" class="form-input" placeholder="Enter Patient Name" value="${data.name}">`;
            }
        }
    }).catch(err => { document.getElementById('loadingOverlay').style.display = "none"; });
}

function savePatientInfo() {
    const name = document.getElementById('userNameInput').value.trim();
    const pincode = document.getElementById('userPincode').value.trim();
    const address = document.getElementById('userAddress').value.trim();

    if(!name) return alert("Patient Name is required.");
    if(pincode.length < 6) return alert("Valid 6-digit Pincode is required.");

    bookingPatient.name = name;
    bookingPatient.pincode = pincode;
    bookingPatient.address = address;

    // Fix: Force fulfillment logic for items initially
    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if(!item.fulfillment) item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
    });

    const needsHome = cart.some(item => item.fulfillment === "home");
    if (needsHome && !serviceablePincodes.includes(pincode)) {
        document.getElementById("alertPincode").innerText = pincode;
        document.getElementById("pincodeWarningModal").classList.add("active");
        return; 
    }
    proceedToStep2();
}

function proceedToStep2() {
    document.getElementById('sumName').innerText = bookingPatient.name;
    document.getElementById('sumMobile').innerText = bookingPatient.mobile;
    document.getElementById('sumAddress').innerText = bookingPatient.address || "Not provided";
    document.getElementById('sumPincode').innerText = bookingPatient.pincode;

    document.getElementById('patientInfoForm').style.display = "none";
    document.getElementById('patientInfoSummary').style.display = "block";
    document.getElementById('editInfoBtn').style.display = "block";

    document.getElementById('step2-card').style.display = "block";
    document.getElementById('step2-card').style.opacity = "1";
    document.getElementById('step2-card').style.pointerEvents = "auto";
    
    renderCartItems();
    calculateTotal();
    fetchLabs(bookingPatient.pincode); 
}

function editPatientInfo() {
    document.getElementById('patientInfoForm').style.display = "block";
    document.getElementById('patientInfoSummary').style.display = "none";
    document.getElementById('editInfoBtn').style.display = "none";
    
    document.getElementById('step2-card').style.opacity = "0.5";
    document.getElementById('step2-card').style.pointerEvents = "none";
    checkProceedReady();
}

function closePincodeModal() { document.getElementById("pincodeWarningModal").classList.remove("active"); }

function switchAllToCenter() {
    cart.forEach(item => { if (item.fulfillment === "home") item.fulfillment = "center"; });
    closePincodeModal();
    proceedToStep2(); 
}

// 🌟 STEP 2: CART CONFIGURATION 🌟

// 🌟 FIX: REMOVE CART ITEM 🌟
function removeCartItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    if(!checkEmptyCart()) {
        renderCartItems();
        calculateTotal();
        checkProceedReady();
        // Lab types might have changed, refetch labs
        fetchLabs(bookingPatient.pincode);
    }
}

function renderCartItems() {
    const container = document.getElementById("cartItemsContainer");
    let html = "";

    cart.forEach((item, index) => {
        // Fallback type if missing from older cart
        let type = (item.service_type || "pathology").toLowerCase().trim();
        let isHomeEligible = homeServiceCategories.includes(type);
        
        let toggleHtml = "";
        if (isHomeEligible) {
            let homeActive = item.fulfillment === "home" ? "active" : "";
            let centerActive = item.fulfillment === "center" ? "active" : "";
            toggleHtml = `
                <div class="service-toggle-box">
                    <button class="toggle-btn ${homeActive}" onclick="changeFulfillment(${index}, 'home')"><i class="fas fa-home"></i> Home</button>
                    <button class="toggle-btn ${centerActive}" onclick="changeFulfillment(${index}, 'center')"><i class="fas fa-hospital"></i> Center</button>
                </div>
            `;
        } else {
            item.fulfillment = "center"; 
            toggleHtml = `<div class="center-only-badge"><i class="fas fa-info-circle"></i> Center Visit Required</div>`;
        }

        html += `
            <div class="cart-item">
                <div class="item-header">
                    <div class="item-name-box">
                        <button class="btn-delete" onclick="removeCartItem(${index})"><i class="fas fa-times"></i></button>
                        <h4 class="item-name">${item.service_name} <span style="color:var(--text-muted); font-size:12px;">(x${item.qty})</span></h4>
                    </div>
                    <span class="item-price">₹${item.price * item.qty}</span>
                </div>
                ${toggleHtml}
            </div>
        `;
    });
    container.innerHTML = html;
    checkItemToggles();
}

function changeFulfillment(index, type) {
    if (type === "home" && !serviceablePincodes.includes(bookingPatient.pincode)) {
        alert("Home collection is not available in " + bookingPatient.pincode + ". Please edit your pincode or select Center Visit.");
        return;
    }
    cart[index].fulfillment = type;
    renderCartItems();
}

function checkItemToggles() {
    selectedTimeSlot = null;
    generateTimeSlots(); // clear slots visually
    checkProceedReady();
}

function calculateTotal() {
    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById("cartTotalAmt").innerText = total;
}

// 🌟 FETCH LABS WITH TYPES 🌟
function fetchLabs(pincode) {
    document.getElementById("labSelectionSection").style.display = "block";
    document.getElementById("loadingLabs").style.display = "block";
    document.getElementById("labsContainer").innerHTML = "";

    // GATHER ALL UNIQUE REQUIRED TYPES FROM CART
    let requiredTypes = [...new Set(cart.map(item => (item.service_type || "pathology").toLowerCase().trim()))];

    fetch(GAS_URL, { 
        method: "POST", 
        body: JSON.stringify({ action: "getMatchedLabs", pincode: pincode, required_types: requiredTypes }) 
    })
    .then(res => res.json())
    .then(response => {
        document.getElementById("loadingLabs").style.display = "none";
        if (response.status === "success" && response.data.labs.length > 0) {
            matchedLabsList = response.data.labs;
            selectedLabId = null; // reset selection
            renderLabs();
        } else {
            document.getElementById("labsContainer").innerHTML = "<p style='color:var(--danger); font-size:13px; text-align:center;'>No partner labs found that provide all selected services in your area.</p>";
        }
    }).catch(err => { document.getElementById("loadingLabs").innerHTML = "Error fetching labs."; });
}

// 🌟 FIX: HIDE OTHER LABS WHEN SELECTED 🌟
function renderLabs() {
    const container = document.getElementById("labsContainer");
    let html = "";
    
    if (selectedLabId) {
        // Show ONLY the selected lab with a "Change" button
        let lab = matchedLabsList.find(l => l.lab_id === selectedLabId);
        if(!lab) return;
        let imgSrc = lab.lab_image || "https://via.placeholder.com/50?text=LAB";
        html += `
            <div class="lab-card selected" style="cursor:default; display:flex; align-items:center;">
                <img src="${imgSrc}" class="lab-img" onerror="this.src='https://via.placeholder.com/50?text=LAB'">
                <div class="lab-info" style="flex-grow:1;">
                    <h4>${lab.lab_name}</h4>
                    <p>${lab.lab_address}, ${lab.lab_city}</p>
                </div>
                <button onclick="changeLab()" style="background:#fee2e2; color:var(--danger); border:1px solid #fecaca; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:12px;">Change</button>
            </div>
        `;
    } else {
        // Show all matching labs
        matchedLabsList.forEach(lab => {
            let imgSrc = lab.lab_image || "https://via.placeholder.com/50?text=LAB";
            html += `
                <div class="lab-card" onclick="selectLab('${lab.lab_id}', '${lab.open_time}', '${lab.close_time}')">
                    <img src="${imgSrc}" class="lab-img" onerror="this.src='https://via.placeholder.com/50?text=LAB'">
                    <div class="lab-info">
                        <h4>${lab.lab_name}</h4>
                        <p>${lab.lab_address}, ${lab.lab_city}</p>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

function selectLab(labId, openTime, closeTime) {
    selectedLabId = labId;
    renderLabs(); 
    
    document.getElementById("dateTimeSection").style.display = "block";
    document.getElementById("timeSlotContainer").setAttribute("data-open", openTime);
    document.getElementById("timeSlotContainer").setAttribute("data-close", closeTime);
    generateTimeSlots();
    checkProceedReady();
}

function changeLab() {
    selectedLabId = null;
    selectedTimeSlot = null;
    document.getElementById("dateTimeSection").style.display = "none";
    renderLabs();
    checkProceedReady();
}

// 🌟 TIME SLOTS 🌟
function generateTimeSlots() {
    const dateStr = document.getElementById("bookingDate").value;
    selectedTimeSlot = null; 
    checkProceedReady();

    if(!dateStr) return;

    const container = document.getElementById("timeSlotContainer");
    const slots = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "02:00 PM", "04:00 PM"];
    
    let html = "";
    slots.forEach(slot => {
        html += `<button class="slot-btn" onclick="selectTimeSlot(this, '${slot}')">${slot}</button>`;
    });
    container.innerHTML = html;
}

function selectTimeSlot(btnElement, slotTime) {
    document.querySelectorAll('.slot-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
    selectedTimeSlot = slotTime;
    checkProceedReady();
}

// 🌟 FINAL CHECKOUT 🌟
function checkProceedReady() {
    const btn = document.getElementById("mainProceedBtn");
    const date = document.getElementById("bookingDate").value;
    
    if (selectedLabId && date && selectedTimeSlot) {
        btn.disabled = false;
        btn.style.background = "var(--success)";
    } else {
        btn.disabled = true;
        btn.style.background = "#cbd5e1";
    }
}

function finalizeBooking() {
    const date = document.getElementById("bookingDate").value;
    const finalAmount = document.getElementById("cartTotalAmt").innerText;

    alert(`🎉 Booking Confirmed!\n\nPatient: ${bookingPatient.name}\nLab ID: ${selectedLabId}\nSlot: ${date} at ${selectedTimeSlot}\nAmount: ₹${finalAmount}`);
}
