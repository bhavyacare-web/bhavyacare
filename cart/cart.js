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

    cart.forEach((item, index) => {
        // Infer test category for backend match
        let testTypeStr = (item.service_name + " " + (item.service_type || "")).toLowerCase();
        let needsCenterVisitOnly = testTypeStr.includes("mri") || testTypeStr.includes("ct") || testTypeStr.includes("usg");
        
        // Add required categories for Step 2 lab matchmaking
        if (testTypeStr.includes("mri")) requiredTestCategories.add("mri");
        else if (testTypeStr.includes("usg")) requiredTestCategories.add("usg");
        else if (testTypeStr.includes("package")) requiredTestCategories.add("package");
        else requiredTestCategories.add("pathology"); // Defaulting standard tests to pathology

        let itemHtml = `
            <div class="cart-item">
                <strong>${item.service_name}</strong> - ₹${item.price} <br>
                <div style="margin-top: 5px;">
                    ${needsCenterVisitOnly ? 
                        `<span style="color: #0056b3; font-weight:bold; font-size: 0.9em;">[Center Visit Required]</span>` : 
                        `<label style="margin-right: 15px; font-size: 0.9em;"><input type="radio" name="collection_${index}" value="home" checked onchange="validateHomeCollection()"> Home Collection</label>
                         <label style="font-size: 0.9em;"><input type="radio" name="collection_${index}" value="center" onchange="validateHomeCollection()"> Center Visit</label>`
                    }
                </div>
            </div>
        `;
        container.innerHTML += itemHtml;
    });

    validateHomeCollection();
    fetchMatchingLabs(Array.from(requiredTestCategories));
}

function validateHomeCollection() {
    let homeSelected = false;
    document.querySelectorAll('input[type="radio"][value="home"]:checked').forEach(() => homeSelected = true);

    if (homeSelected && !SERVICEABLE_PINCODES.includes(userDetails.pincode)) {
        alert(`Warning: Your area pincode (${userDetails.pincode}) is currently not serviceable for Home Collection. Please switch to Center Visit for all items or update your pincode.`);
        // Force uncheck home, check center
        document.querySelectorAll('input[type="radio"][value="home"]').forEach(el => el.checked = false);
        document.querySelectorAll('input[type="radio"][value="center"]').forEach(el => el.checked = true);
    }
}

async function fetchMatchingLabs(requiredServices) {
    const labsContainer = document.getElementById("labs-container");
    document.getElementById("lab-matchmaking-section").classList.remove("hidden");
    labsContainer.innerHTML = "<em>Finding the best labs for your required tests...</em>";

    try {
        const payload = {
            action: "getLabs",
            pincode: userDetails.pincode,
            services: requiredServices
        };

        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'success' && result.data.length > 0) {
            labsContainer.innerHTML = "";
            result.data.forEach(lab => {
                labsContainer.innerHTML += `
                    <div class="lab-item" style="border: 1px solid #ddd; padding: 10px; margin-top: 10px; border-radius: 5px;">
                        <label style="display: block; cursor: pointer;">
                            <input type="radio" name="selected_lab" value="${lab.lab_id}" onchange="selectLab('${lab.lab_id}')" style="margin-right: 10px;">
                            <strong>${lab.lab_name}</strong><br>
                            <small style="color: #666; margin-left: 25px; display: block;">${lab.lab_address} <br>Timing: ${lab.open_time} - ${lab.close_time}</small>
                        </label>
                    </div>
                `;
            });
        } else {
            labsContainer.innerHTML = "<span class='warning-text' style='color: red;'>Sorry, no active labs found matching all your selected tests in your pincode area.</span>";
        }
    } catch (e) {
        labsContainer.innerHTML = "<span class='warning-text' style='color: red;'>Error fetching labs. Please try again.</span>";
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
