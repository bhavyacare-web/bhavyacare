const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

let cart = JSON.parse(localStorage.getItem("bhavyaCart")) || [];
let userId = localStorage.getItem("bhavya_user_id");
let userDetails = {};
let selectedLab = null;

document.addEventListener("DOMContentLoaded", () => {
    if (cart.length === 0) {
        document.querySelector(".container").innerHTML = "<div class='step-card' style='text-align:center;'><h2>Your Cart is empty!</h2></div>";
        return;
    }
    
    // Set minimum booking date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("booking-date").setAttribute('min', today);
    
    initStep1();
});

// ==========================================
// --- STEP 1: My Info & Login Check ---
// ==========================================
async function initStep1() {
    if (!userId) {
        document.getElementById("auth-warning").classList.remove("hidden");
        
        // Open the app.js login popup directly on this page
        document.getElementById("btn-trigger-login").addEventListener("click", () => {
            if(typeof openPatientLogin === 'function') {
                document.getElementById("login-overlay").style.display = "block";
                openPatientLogin(); // This function is from your app.js
            } else {
                alert("Login system is still loading. Please wait.");
            }
        });
        return;
    }

    // If logged in, fetch profile
    try {
        const payload = { action: "getCartUserProfile", userId: userId };
        const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.status === 'success') {
            userDetails = result.data;
            renderMyInfoForm();
        } else {
            alert("Error fetching profile: " + result.message);
        }
    } catch (e) {
        alert("Network error.");
    }
}

// Function to close modal explicitly from cart page
function closeLoginModal() {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("login-overlay").style.display = "none";
}

function renderMyInfoForm() {
    document.getElementById("my-info-form").classList.remove("hidden");
    
    // Mobile is strict read-only
    document.getElementById("patient-mobile").value = userDetails.mobile || localStorage.getItem("bhavya_mobile") || "";
    
    // Address and Pincode are editable
    document.getElementById("patient-address").value = userDetails.address || "";
    document.getElementById("patient-pincode").value = userDetails.pincode || "";

    const nameContainer = document.getElementById("patient-name-container");
    nameContainer.innerHTML = "<label>Patient Name</label>";

    if (userDetails.is_vip) {
        // VIP Plan: Dropdown
        let selectHtml = `<select id="patient-name" style="background: #e8f5e9; border-color: #4caf50;">
            <option value="${userDetails.name}">${userDetails.name} (Self)</option>`;
        if(userDetails.member_1_name) selectHtml += `<option value="${userDetails.member_1_name}">${userDetails.member_1_name}</option>`;
        if(userDetails.member_2_name) selectHtml += `<option value="${userDetails.member_2_name}">${userDetails.member_2_name}</option>`;
        if(userDetails.member_3_name) selectHtml += `<option value="${userDetails.member_3_name}">${userDetails.member_3_name}</option>`;
        selectHtml += `</select><small style="color: #2e7d32;">👑 VIP Account: Select registered member.</small>`;
        nameContainer.innerHTML += selectHtml;
    } else {
        // Basic Plan: Editable Text Input
        nameContainer.innerHTML += `<input type="text" id="patient-name" value="${userDetails.name || ""}" required>
        <small style="color: #666;">You can edit patient name for this booking.</small>`;
    }

    document.getElementById("btn-save-step-1").addEventListener("click", saveStep1);
}

function saveStep1() {
    userDetails.selectedName = document.getElementById("patient-name").value;
    userDetails.address = document.getElementById("patient-address").value;
    userDetails.pincode = document.getElementById("patient-pincode").value;

    if(!userDetails.selectedName || !userDetails.address || !userDetails.pincode) {
        alert("Please fill all details."); return;
    }

    document.querySelectorAll("#my-info-form input, #my-info-form select").forEach(el => el.disabled = true);
    document.getElementById("btn-save-step-1").innerText = "Info Saved ✅";
    document.getElementById("step-2").classList.remove("hidden");
    
    renderCartItems();
}

// ==========================================
// --- STEP 2: Matchmaking & Labs ---
// ==========================================
function renderCartItems() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";

    cart.forEach((item, index) => {
        let type = (item.service_type || "").toLowerCase();
        let name = (item.service_name || "").toLowerCase();
        let isHomeServiceable = name.includes("pathology") || name.includes("package") || type.includes("pathology") || type.includes("package");

        let itemHtml = `
            <div class="cart-item">
                <strong style="color:#0056b3;">${item.service_name}</strong> - ₹${item.price}
                <div style="margin-top: 10px;">
                    ${!isHomeServiceable ? 
                        `<span style="color: #dc3545; font-weight:bold; background: #ffeeba; padding: 3px 8px; border-radius: 4px; font-size: 0.9em;">📍 Center Visit Required</span>` : 
                        `<label><input type="radio" name="collection_${index}" value="home" checked onchange="updateMatchmaking()"> 🏠 Home Collection</label>
                         <label style="margin-left: 15px;"><input type="radio" name="collection_${index}" value="center" onchange="updateMatchmaking()"> 🏥 Center Visit</label>`
                    }
                </div>
            </div>`;
        container.innerHTML += itemHtml;
    });
    updateMatchmaking();
}

function updateMatchmaking() {
    let isHomeSelected = false;
    document.querySelectorAll('input[type="radio"][value="home"]:checked').forEach(() => isHomeSelected = true);
    
    const categories = Array.from(new Set(cart.map(item => (item.service_type || "pathology").toLowerCase())));
    fetchMatchingLabs(categories, isHomeSelected);
}

async function fetchMatchingLabs(requiredServices, isHomeSelected) {
    const labsContainer = document.getElementById("labs-container");
    labsContainer.innerHTML = "<em>Finding best labs...</em>";

    try {
        const payload = { action: "getLabs", pincode: userDetails.pincode, services: requiredServices, isHomeCollection: isHomeSelected };
        const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();

        if (result.status === 'success' && result.data.labs.length > 0) {
            let html = "";
            
            // Lab Name with Warning Message if Home Collection fails
            if (isHomeSelected && !result.data.hasExactMatch) {
                html += `
                <div class="warning-box">
                    <strong>⚠️ Area Not Serviceable:</strong> Home collection is currently not available at Pincode ${userDetails.pincode}.<br>
                    Please visit any of the labs listed below for your tests.
                </div>`;
            }

            result.data.labs.forEach(lab => {
                html += `
                    <div class="lab-item">
                        <img src="${lab.image || 'https://via.placeholder.com/90'}" class="lab-image">
                        <div style="flex: 1;">
                            <label style="display: block; cursor: pointer;">
                                <input type="radio" name="selected_lab" value="${lab.lab_id}" onchange="selectLab('${lab.lab_id}')" style="margin-right: 10px;">
                                <strong style="font-size: 1.2em;">${lab.lab_name}</strong>
                                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">📍 ${lab.lab_address}</div>
                                <div style="font-size: 0.9em; color: #28a745; margin-top: 5px;">🕒 Timing: ${lab.open_time} - ${lab.close_time}</div>
                            </label>
                        </div>
                    </div>`;
            });
            labsContainer.innerHTML = html;
        } else {
            labsContainer.innerHTML = "<div class='warning-box' style='color: red;'>No active labs found matching your tests.</div>";
            document.getElementById("schedule-section").classList.add("hidden");
        }
    } catch (e) {
        labsContainer.innerHTML = "<div style='color: red;'>Error fetching labs.</div>";
    }
}

function selectLab(labId) {
    selectedLab = labId;
    document.getElementById("schedule-section").classList.remove("hidden");
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
    const btn = document.getElementById("btn-confirm-booking");
    
    if (selectedLab && date && time) {
        document.getElementById("step-3").classList.remove("hidden");
        btn.disabled = false;
        btn.onclick = submitOrder; 
    } else {
        btn.disabled = true;
    }
}

async function submitOrder() {
    const btn = document.getElementById("btn-confirm-booking");
    btn.disabled = true; btn.innerText = "Processing Booking...";

    const orderData = {
        action: "placeOrder",
        userId: userId,
        patientName: userDetails.selectedName,
        mobile: userDetails.mobile,
        address: userDetails.address,
        pincode: userDetails.pincode,
        cart: cart, labId: selectedLab,
        bookingDate: document.getElementById("booking-date").value,
        bookingTime: document.getElementById("booking-time").value
    };

    try {
        const response = await fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(orderData) });
        const result = await response.json();
        if(result.status === 'success') {
            alert("Booking Confirmed Successfully!");
            localStorage.removeItem("bhavyaCart"); 
            window.location.href = "success.html"; 
        } else {
            alert("Error: " + result.message); btn.disabled = false; btn.innerText = "Confirm Booking";
        }
    } catch (e) {
        alert("Network Error."); btn.disabled = false; btn.innerText = "Confirm Booking";
    }
}
