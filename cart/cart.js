const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

// Active Pincodes for Home Collection
const serviceablePincodes = ["124507", "124508", "110043"]; 
const homeServiceCategories = ['pathology', 'profile', 'ecg', 'holter', 'pft'];

let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let matchedLabsList = [];
let selectedLabId = null;
let selectedTimeSlot = null;

let bookingPatient = { name: "", mobile: "", pincode: "", address: "", isVip: false };

window.onload = () => {
    if (cart.length === 0) {
        document.getElementById('loadingOverlay').style.display = "none";
        document.querySelector('.container').innerHTML = "<div style='text-align:center; padding:40px;'><i class='fas fa-shopping-cart' style='font-size:40px; color:#cbd5e1; margin-bottom:15px;'></i><br><h3 style='color:var(--text-main);'>Cart is Empty</h3><a href='../booking/booking.html' style='color:var(--primary); font-weight:bold;'>Go Back to Booking</a></div>";
        return;
    }
    
    // Set default fulfillment based on category
    cart.forEach(item => {
        let type = (item.service_type || "").toLowerCase();
        if(!item.fulfillment) { item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center"; }
    });
    
    calculateTotal();
    
    // Ensure Date picker cannot select past dates
    let today = new Date().toISOString().split('T')[0];
    document.getElementById("bookingDate").setAttribute('min', today);

    // Enforce Login
    const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id");
    if (!userId) {
        alert("Please log in first to access your cart.");
        window.location.href = "../booking/booking.html";
        return;
    }
    fetchPatientProfile(userId);
};

// 🌟 STEP 1: FETCH & AUTO-FILL PROFILE 🌟
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
        } else {
            document.getElementById('nameInputContainer').innerHTML = `<input type="text" id="userNameInput" class="form-input" placeholder="Enter Patient Name">`;
        }
    }).catch(err => {
        document.getElementById('loadingOverlay').style.display = "none";
        document.getElementById('nameInputContainer').innerHTML = `<input type="text" id="userNameInput" class="form-input" placeholder="Enter Patient Name">`;
    });
}

// 🌟 STEP 1 -> STEP 2 TRANSITION (PINCODE LOGIC) 🌟
function savePatientInfo() {
    const name = document.getElementById('userNameInput').value.trim();
    const pincode = document.getElementById('userPincode').value.trim();
    const address = document.getElementById('userAddress').value.trim();

    if(!name) return alert("Patient Name is required.");
    if(pincode.length < 6) return alert("Valid 6-digit Pincode is required.");

    bookingPatient.name = name;
    bookingPatient.pincode = pincode;
    bookingPatient.address = address;

    // Check Pincode for Home Collection
    const needsHome = cart.some(item => item.fulfillment === "home");
    if (needsHome && !serviceablePincodes.includes(pincode)) {
        document.getElementById("alertPincode").innerText = pincode;
        document.getElementById("pincodeWarningModal").classList.add("active");
        return; // Stop here until they resolve the modal
    }

    proceedToStep2();
}

function proceedToStep2() {
    // Update Step 1 UI Summary
    document.getElementById('sumName').innerText = bookingPatient.name;
    document.getElementById('sumMobile').innerText = bookingPatient.mobile;
    document.getElementById('sumAddress').innerText = bookingPatient.address || "Not provided";
    document.getElementById('sumPincode').innerText = bookingPatient.pincode;

    document.getElementById('patientInfoForm').style.display = "none";
    document.getElementById('patientInfoSummary').style.display = "block";
    document.getElementById('editInfoBtn').style.display = "block";

    // Unlock Step 2
    document.getElementById('step2-card').style.display = "block";
    document.getElementById('step2-card').style.opacity = "1";
    document.getElementById('step2-card').style.pointerEvents = "auto";
    
    renderCartItems();
    fetchLabs(bookingPatient.pincode); // Start finding labs
}

function editPatientInfo() {
    document.getElementById('patientInfoForm').style.display = "block";
    document.getElementById('patientInfoSummary').style.display = "none";
    document.getElementById('editInfoBtn').style.display = "none";
    
    // Lock Step 2
    document.getElementById('step2-card').style.opacity = "0.5";
    document.getElementById('step2-card').style.pointerEvents = "none";
    
    // Disable proceed
    checkProceedReady();
}

function closePincodeModal() { document.getElementById("pincodeWarningModal").classList.remove("active"); }

function switchAllToCenter() {
    cart.forEach(item => { if (item.fulfillment === "home") item.fulfillment = "center"; });
    closePincodeModal();
    proceedToStep2(); // Now they can proceed
}

// 🌟 STEP 2: CART CONFIGURATION & LAB MATCHMAKING 🌟
function renderCartItems() {
    const container = document.getElementById("cartItemsContainer");
    let html = "";

    cart.forEach((item, index) => {
        let type = (item.service_type || "").toLowerCase();
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
                    <h4 class="item-name">${item.service_name} <span style="color:var(--text-muted); font-size:12px;">(x${item.qty})</span></h4>
                    <span class="item-price">₹${item.price * item.qty}</span>
                </div>
                ${toggleHtml}
            </div>
        `;
    });
    container.innerHTML = html;
    
    // Re-check pincode rule if they toggle back to home manually
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
    // If anything changes, reset time slot
    selectedTimeSlot = null;
    checkProceedReady();
}

function calculateTotal() {
    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById("cartTotalAmt").innerText = total;
}

// 🌟 FETCH LABS 🌟
function fetchLabs(pincode) {
    document.getElementById("labSelectionSection").style.display = "block";
    document.getElementById("loadingLabs").style.display = "block";
    document.getElementById("labsContainer").innerHTML = "";

    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getMatchedLabs", pincode: pincode }) })
    .then(res => res.json())
    .then(response => {
        document.getElementById("loadingLabs").style.display = "none";
        if (response.status === "success" && response.data.labs.length > 0) {
            matchedLabsList = response.data.labs;
            renderLabs();
        } else {
            document.getElementById("labsContainer").innerHTML = "<p style='color:var(--danger); font-size:13px; text-align:center;'>No partner labs found in your area yet.</p>";
        }
    }).catch(err => { document.getElementById("loadingLabs").innerHTML = "Error fetching labs."; });
}

function renderLabs() {
    const container = document.getElementById("labsContainer");
    let html = "";
    matchedLabsList.forEach(lab => {
        let imgSrc = lab.lab_image || "https://via.placeholder.com/50?text=LAB";
        let isSelected = selectedLabId === lab.lab_id ? "selected" : "";
        html += `
            <div class="lab-card ${isSelected}" onclick="selectLab('${lab.lab_id}', '${lab.open_time}', '${lab.close_time}')">
                <img src="${imgSrc}" class="lab-img" onerror="this.src='https://via.placeholder.com/50?text=LAB'">
                <div class="lab-info">
                    <h4>${lab.lab_name}</h4>
                    <p>${lab.lab_address}, ${lab.lab_pincode}</p>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function selectLab(labId, openTime, closeTime) {
    selectedLabId = labId;
    renderLabs(); 
    
    document.getElementById("dateTimeSection").style.display = "block";
    document.getElementById("timeSlotContainer").setAttribute("data-open", openTime);
    document.getElementById("timeSlotContainer").setAttribute("data-close", closeTime);
    checkProceedReady();
}

// 🌟 TIME SLOTS 🌟
function generateTimeSlots() {
    const dateStr = document.getElementById("bookingDate").value;
    selectedTimeSlot = null; // Reset slot when date changes
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

    // Yahan aayega apka Razorpay ya direct Order submit ka logic
    alert(`🎉 Booking Confirmed!\n\nPatient: ${bookingPatient.name}\nLab ID: ${selectedLabId}\nSlot: ${date} at ${selectedTimeSlot}\nAmount: ₹${finalAmount}`);
    
    // Clear Cart after order
    // localStorage.removeItem('bhavyaCart');
    // window.location.href = "../patient_dashboard/patient_dashboard.html";
}
