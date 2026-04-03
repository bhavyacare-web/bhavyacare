// ==========================================
// Configuration
// ==========================================
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

// ==========================================
// State Management
// ==========================================
let cart = JSON.parse(localStorage.getItem("bhavyaCart")) || [];
let userId = localStorage.getItem("bhavya_user_id");
let userDetails = {};
let selectedLab = null;

// ==========================================
// DOM Elements
// ==========================================
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const step3 = document.getElementById("step-3");
const infoForm = document.getElementById("my-info-form");
const authWarning = document.getElementById("auth-warning");

// Set minimum date for booking to today
document.addEventListener("DOMContentLoaded", () => {
    if (cart.length === 0) {
        document.querySelector(".container").innerHTML = "<div class='step-card' style='text-align:center;'><h2>Your Cart is empty!</h2><p>Please add some tests to continue.</p></div>";
        return;
    }
    
    // Set min date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("booking-date").setAttribute('min', today);
    
    initStep1();
});

// ==========================================
// --- STEP 1: My Info Logic ---
// ==========================================
async function initStep1() {
    if (!userId) {
        authWarning.classList.remove("hidden");
        // Login button event
        document.getElementById("btn-trigger-login").addEventListener("click", () => {
            // Yahan apne login page ka link daalein
            window.location.href = "login.html"; 
        });
        return;
    }

    try {
        const payload = { action: "getCartUserProfile", userId: userId };
        const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.status === 'success') {
            userDetails = result.data;
            renderMyInfoForm();
        } else {
            alert("Error fetching profile details: " + result.message);
        }
    } catch (e) {
        console.error("Failed to fetch user data", e);
        alert("Network error while fetching profile.");
    }
}

function renderMyInfoForm() {
    infoForm.classList.remove("hidden");
    
    document.getElementById("patient-mobile").value = userDetails.mobile || "";
    document.getElementById("patient-address").value = userDetails.address || "";
    document.getElementById("patient-pincode").value = userDetails.pincode || "";

    const nameContainer = document.getElementById("patient-name-container");
    nameContainer.innerHTML = "<label>Patient Name</label>";

    if (userDetails.is_vip) {
        let selectHtml = `<select id="patient-name" style="background: #e8f5e9; border-color: #4caf50;">
            <option value="${userDetails.name}">${userDetails.name} (Self)</option>`;
        
        if(userDetails.member_1_name) selectHtml += `<option value="${userDetails.member_1_name}">${userDetails.member_1_name}</option>`;
        if(userDetails.member_2_name) selectHtml += `<option value="${userDetails.member_2_name}">${userDetails.member_2_name}</option>`;
        if(userDetails.member_3_name) selectHtml += `<option value="${userDetails.member_3_name}">${userDetails.member_3_name}</option>`;
        
        selectHtml += `</select><small style="color: #2e7d32; display: block; margin-top: 5px;">👑 VIP Account: Select registered family member.</small>`;
        nameContainer.innerHTML += selectHtml;
    } else {
        nameContainer.innerHTML += `<input type="text" id="patient-name" value="${userDetails.name || ""}" required>
        <small style="color: #666; display: block; margin-top: 5px;">You can change the patient name for this booking.</small>`;
    }

    document.getElementById("btn-save-step-1").addEventListener("click", saveStep1);
}

function saveStep1() {
    userDetails.selectedName = document.getElementById("patient-name").value;
    userDetails.address = document.getElementById("patient-address").value;
    userDetails.pincode = document.getElementById("patient-pincode").value;

    if(!userDetails.selectedName || !userDetails.address || !userDetails.pincode) {
        alert("Please fill all the details in My Info section.");
        return;
    }

    // Lock Step 1
    document.querySelectorAll("#my-info-form input, #my-info-form select").forEach(el => el.disabled = true);
    let btn = document.getElementById("btn-save-step-1");
    btn.innerText = "Info Saved ✅";
    btn.classList.replace("btn-primary", "btn-success");
    btn.disabled = true;
    
    step2.classList.remove("hidden");
    renderCartItems();
}

// ==========================================
// --- STEP 2: Service Configuration & Matchmaking ---
// ==========================================
function renderCartItems() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";

    cart.forEach((item, index) => {
        let type = (item.service_type || "").toLowerCase();
        let name = (item.service_name || "").toLowerCase();

        // Check if home collection is possible for this specific item
        let isHomeServiceable = name.includes("pathology") || name.includes("package") || type.includes("pathology") || type.includes("package");

        let itemHtml = `
            <div class="cart-item">
                <strong style="font-size: 1.1em; color:#0056b3;">${item.service_name}</strong> <br>
                <span style="font-weight:bold; color:#333;">Price: ₹${item.price}</span>
                <div style="margin-top: 10px;">
                    ${!isHomeServiceable ? 
                        `<span style="color: #dc3545; font-weight:bold; background: #ffeeba; padding: 3px 8px; border-radius: 4px; font-size: 0.9em;">📍 Center Visit Required</span>` : 
                        `<label style="margin-right: 15px; cursor:pointer;"><input type="radio" name="collection_${index}" value="home" checked onchange="updateMatchmaking()"> 🏠 Home Collection</label>
                         <label style="cursor:pointer;"><input type="radio" name="collection_${index}" value="center" onchange="updateMatchmaking()"> 🏥 Center Visit</label>`
                    }
                </div>
            </div>
        `;
        container.innerHTML += itemHtml;
    });

    updateMatchmaking();
}

function updateMatchmaking() {
    let isHomeSelected = false;
    document.querySelectorAll('input[type="radio"][value="home"]:checked').forEach(() => isHomeSelected = true);

    // Collect all unique service types from cart (e.g. ['pathology', 'mri'])
    const categories = Array.from(new Set(cart.map(item => {
        let type = (item.service_type || "").toLowerCase();
        return type || "pathology"; 
    })));

    fetchMatchingLabs(categories, isHomeSelected);
}

async function fetchMatchingLabs(requiredServices, isHomeSelected) {
    const labsContainer = document.getElementById("labs-container");
    document.getElementById("lab-matchmaking-section").classList.remove("hidden");
    labsContainer.innerHTML = "<em>Finding best labs based on your tests...</em>";

    try {
        const payload = {
            action: "getLabs",
            pincode: userDetails.pincode,
            services: requiredServices,
            isHomeCollection: isHomeSelected
        };

        const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();

        if (result.status === 'success' && result.data.labs.length > 0) {
            let html = "";
            
            // Smart Warning Message if pincode doesn't match for Home Collection
            if (isHomeSelected && !result.data.hasExactMatch) {
                html += `
                <div class="warning-box">
                    <strong>⚠️ Service Alert:</strong> Home collection is currently not available for your pincode (${userDetails.pincode}). <br>
                    Don't worry! You can visit any of the excellent labs below to get your tests done.
                </div>`;
            }

            result.data.labs.forEach(lab => {
                let defaultImg = 'https://via.placeholder.com/90?text=Lab+Image';
                html += `
                    <div class="lab-item">
                        <img src="${lab.image || defaultImg}" class="lab-image" alt="${lab.lab_name}">
                        <div style="flex: 1;">
                            <label style="display: block; cursor: pointer; width: 100%;">
                                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                                    <input type="radio" name="selected_lab" value="${lab.lab_id}" onchange="selectLab('${lab.lab_id}')" style="width: auto; margin-right: 10px; transform: scale(1.3);">
                                    <strong style="font-size: 1.1em; color: #333;">${lab.lab_name}</strong>
                                </div>
                                <div style="font-size: 0.9em; color: #666; margin-left: 25px;">📍 ${lab.lab_address}</div>
                                <div style="font-size: 0.9em; color: #28a745; margin-left: 25px; margin-top: 3px; font-weight: bold;">🕒 Today's Timing: ${lab.open_time} to ${lab.close_time}</div>
                            </label>
                        </div>
                    </div>
                `;
            });
            labsContainer.innerHTML = html;
        } else {
            labsContainer.innerHTML = "<div class='warning-box' style='color: #dc3545; background: #f8d7da; border-color: #f5c6cb;'>Sorry, no active labs found matching all your selected tests. Please try changing your tests or contact support.</div>";
            document.getElementById("schedule-section").classList.add("hidden");
        }
    } catch (e) {
        labsContainer.innerHTML = "<div style='color: red;'>Error fetching labs. Please check your internet connection.</div>";
        console.error("Matchmaking error", e);
    }
}

function selectLab(labId) {
    selectedLab = labId;
    const scheduleSection = document.getElementById("schedule-section");
    scheduleSection.classList.remove("hidden");
    
    document.getElementById("booking-date").addEventListener("change", checkCheckoutReady);
    document.getElementById("booking-time").addEventListener("change", checkCheckoutReady);
    
    checkCheckoutReady();
}

// ==========================================
// --- STEP 3: Checkout ---
// ==========================================
function checkCheckoutReady() {
    const date = document.getElementById("booking-date").value;
    const time = document.getElementById("booking-time").value;

    if (selectedLab && date && time) {
        step3.classList.remove("hidden");
        const btn = document.getElementById("btn-confirm-booking");
        btn.disabled = false;
        btn.onclick = submitOrder; 
    } else {
        document.getElementById("btn-confirm-booking").disabled = true;
    }
}

async function submitOrder() {
    const btn = document.getElementById("btn-confirm-booking");
    btn.disabled = true;
    btn.innerText = "Processing Booking...";

    const orderData = {
        action: "placeOrder",
        userId: userId,
        patientName: userDetails.selectedName,
        mobile: userDetails.mobile,
        address: userDetails.address,
        pincode: userDetails.pincode,
        cart: cart,
        labId: selectedLab,
        bookingDate: document.getElementById("booking-date").value,
        bookingTime: document.getElementById("booking-time").value
    };

    try {
        const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(orderData) });
        const result = await response.json();

        if(result.status === 'success') {
            alert("🎉 Booking Confirmed Successfully! Total Amount: ₹" + result.data.orderAmount);
            localStorage.removeItem("bhavyaCart"); 
            window.location.href = "success.html"; // Yahan apne success page ka naam daalein
        } else {
            alert("Error placing order: " + result.message);
            btn.disabled = false;
            btn.innerText = "Confirm Booking";
        }
    } catch (e) {
        alert("Network Error while placing the order.");
        console.error("Order submission error", e);
        btn.disabled = false;
        btn.innerText = "Confirm Booking";
    }
}
