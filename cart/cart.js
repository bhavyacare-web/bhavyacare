// ==========================================
// Configuration
// ==========================================
// Aapka live Google Apps Script Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 
const SERVICEABLE_PINCODES = ["110001", "110002", "132103"]; // Replace with your actual dynamic list if needed

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

// ==========================================
// On Load Initialization
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (cart.length === 0) {
        document.querySelector(".container").innerHTML = "<h2>Your Cart is empty!</h2><p>Please add some tests to continue.</p>";
        return;
    }
    initStep1();
});

// ==========================================
// --- STEP 1: My Info Logic ---
// ==========================================
async function initStep1() {
    if (!userId) {
        authWarning.classList.remove("hidden");
        // TODO: Trigger your Firebase Phone Auth Popup logic here
        return;
    }

    try {
        const payload = {
            action: "getCartUserProfile",
            userId: userId
        };

        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
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
    
    // Auto-fill Mobile, Address & Pincode (Editable if patient wants)
    document.getElementById("patient-mobile").value = userDetails.mobile || "";
    document.getElementById("patient-address").value = userDetails.address || "";
    document.getElementById("patient-pincode").value = userDetails.pincode || "";

    const nameContainer = document.getElementById("patient-name-container");
    nameContainer.innerHTML = "<label>Patient Name</label>";

    // Smart Auto-Fill Logic (VIP vs Basic) based on backend is_vip flag
    if (userDetails.is_vip) {
        // VIP Member: Dropdown limit to registered members
        let selectHtml = `<select id="patient-name" style="background: #e8f5e9; border: 1px solid #4caf50; width: 100%; padding: 8px; border-radius: 4px;">
            <option value="${userDetails.name}">${userDetails.name} (Self)</option>`;
        
        if(userDetails.member_1_name) selectHtml += `<option value="${userDetails.member_1_name}">${userDetails.member_1_name}</option>`;
        if(userDetails.member_2_name) selectHtml += `<option value="${userDetails.member_2_name}">${userDetails.member_2_name}</option>`;
        if(userDetails.member_3_name) selectHtml += `<option value="${userDetails.member_3_name}">${userDetails.member_3_name}</option>`;
        
        selectHtml += `</select>
        <small style="color: #2e7d32; display: block; margin-top: 5px;">👑 VIP Account: Select registered family member.</small>`;
        nameContainer.innerHTML += selectHtml;
    } else {
        // Basic Member: Free Text Input
        nameContainer.innerHTML += `
        <input type="text" id="patient-name" value="${userDetails.name || ""}" required style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
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

    // Lock Step 1 (My Info)
    document.querySelectorAll("#my-info-form input, #my-info-form select").forEach(el => el.disabled = true);
    
    let btn = document.getElementById("btn-save-step-1");
    btn.innerText = "Info Saved ✅";
    btn.style.background = "#28a745";
    btn.disabled = true;
    
    // Open Step 2
    step2.classList.remove("hidden");
    renderCartItems();
}

// ==========================================
// --- STEP 2: Service Configuration & Matchmaking ---
// ==========================================
function renderCartItems() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";
    let requiredTestCategories = new Set(); 
    let canDoHomeCollection = true;

    cart.forEach((item, index) => {
        let type = (item.service_type || "").toLowerCase();
        let name = (item.service_name || "").toLowerCase();

        // Nayi List ke hisaab se sirf pathology aur package hi home collection denge
        let isHomeServiceable = name.includes("pathology") || name.includes("package") || type.includes("pathology") || type.includes("package");
        
        // Agar ek bhi test aisa hai jo pathology/package nahi hai, toh home collection disable ho jayega
        if (!isHomeServiceable) canDoHomeCollection = false;

        // Add to required categories for matching
        requiredTestCategories.add(type || "pathology");

        let itemHtml = `
            <div class="cart-item">
                <strong>${item.service_name}</strong> - ₹${item.price} <br>
                <div style="margin-top: 5px;">
                    ${!isHomeServiceable ? 
                        `<span style="color: #d32f2f; font-weight:bold;">[Center Visit Required]</span>` : 
                        `<label><input type="radio" name="collection_${index}" value="home" checked onchange="updateMatchmaking()"> Home Collection</label>
                         <label style="margin-left:10px;"><input type="radio" name="collection_${index}" value="center" onchange="updateMatchmaking()"> Center Visit</label>`
                    }
                </div>
            </div>
        `;
        container.innerHTML += itemHtml;
    });

    updateMatchmaking();
}

async function updateMatchmaking() {
    let isHomeSelected = false;
    document.querySelectorAll('input[type="radio"][value="home"]:checked').forEach(() => isHomeSelected = true);

    const categories = Array.from(new Set(cart.map(item => (item.service_type || "pathology").toLowerCase())));
    fetchMatchingLabs(categories, isHomeSelected);
}

async function fetchMatchingLabs(requiredServices, isHomeSelected) {
    const labsContainer = document.getElementById("labs-container");
    labsContainer.innerHTML = "<em>Finding labs...</em>";

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
            
            // Naya Warning Message Logic
            if (isHomeSelected && !result.data.hasExactMatch) {
                html += `<div style="background:#fff3cd; color:#856404; padding:10px; border-radius:5px; margin-bottom:15px; border:1px solid #ffeeba;">
                    <strong>Service Alert:</strong> Home collection is not available in your area. 
                    Please visit any of the labs below for your tests.
                </div>`;
            }

            result.data.labs.forEach(lab => {
                html += `
                    <div class="lab-item" style="display: flex; align-items: center; border: 1px solid #ddd; padding: 10px; margin-top: 10px; border-radius: 8px;">
                        <img src="${lab.image || 'https://via.placeholder.com/80'}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 5px; margin-right: 15px;">
                        <div style="flex: 1;">
                            <label style="display: block; cursor: pointer;">
                                <input type="radio" name="selected_lab" value="${lab.lab_id}" onchange="selectLab('${lab.lab_id}')">
                                <strong>${lab.lab_name}</strong>
                                <div style="font-size: 0.85em; color: #555;">${lab.lab_address}</div>
                                <div style="font-size: 0.85em; color: #2e7d32;">Today: ${lab.open_time} - ${lab.close_time}</div>
                            </label>
                        </div>
                    </div>
                `;
            });
            labsContainer.innerHTML = html;
        } else {
            labsContainer.innerHTML = "<div class='warning-text'>No labs found for the selected tests.</div>";
        }
    } catch (e) {
        labsContainer.innerHTML = "Error loading labs.";
    }
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
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        const result = await response.json();

        if(result.status === 'success') {
            alert("Booking Confirmed Successfully! Total Amount: ₹" + result.data.orderAmount);
            localStorage.removeItem("bhavyaCart"); // Clear cart
            window.location.href = "success.html"; // Redirect
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
