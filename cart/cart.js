// Configuration
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 
const SERVICEABLE_PINCODES = ["110001", "110002", "132103"]; // Replace with dynamic backend list if needed

// State Management
let cart = JSON.parse(localStorage.getItem("bhavyaCart")) || [];
let userId = localStorage.getItem("bhavya_user_id");
let userDetails = {};
let selectedLab = null;

// DOM Elements
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const step3 = document.getElementById("step-3");
const infoForm = document.getElementById("my-info-form");
const authWarning = document.getElementById("auth-warning");

// On Load
document.addEventListener("DOMContentLoaded", () => {
    if (cart.length === 0) {
        document.querySelector(".container").innerHTML = "<h2>Cart is empty!</h2>";
        return;
    }
    initStep1();
});

// --- STEP 1 LOGIC ---
async function initStep1() {
    if (!userId) {
        authWarning.classList.remove("hidden");
        // TODO: Trigger Firebase Phone Auth Popup here
        return;
    }

    try {
        // Fetch User Profile from GAS
        const response = await fetch(`${GAS_WEB_APP_URL}?action=getUserProfile&userId=${userId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            userDetails = data.data;
            renderMyInfoForm();
        } else {
            alert("Error fetching profile details.");
        }
    } catch (e) {
        console.error("Failed to fetch user data", e);
    }
}

function renderMyInfoForm() {
    infoForm.classList.remove("hidden");
    document.getElementById("patient-mobile").value = userDetails.mobile || "";
    document.getElementById("patient-address").value = userDetails.address || "";
    document.getElementById("patient-pincode").value = userDetails.pincode || "";

    const nameContainer = document.getElementById("patient-name-container");
    nameContainer.innerHTML = "<label>Patient Name</label>";

    if (userDetails.vip_status === "active") {
        let selectHtml = `<select id="patient-name">
            <option value="${userDetails.name}">${userDetails.name} (Self)</option>`;
        if(userDetails.vip_member_1) selectHtml += `<option value="${userDetails.vip_member_1}">${userDetails.vip_member_1}</option>`;
        if(userDetails.vip_member_2) selectHtml += `<option value="${userDetails.vip_member_2}">${userDetails.vip_member_2}</option>`;
        selectHtml += `</select>`;
        nameContainer.innerHTML += selectHtml;
    } else {
        nameContainer.innerHTML += `<input type="text" id="patient-name" value="${userDetails.name || ""}" required>`;
    }

    document.getElementById("btn-save-step-1").addEventListener("click", saveStep1);
}

function saveStep1() {
    userDetails.selectedName = document.getElementById("patient-name").value;
    userDetails.address = document.getElementById("patient-address").value;
    userDetails.pincode = document.getElementById("patient-pincode").value;

    if(!userDetails.selectedName || !userDetails.address || !userDetails.pincode) {
        alert("Please fill all details.");
        return;
    }

    // Lock Step 1 & Open Step 2
    document.querySelectorAll("#my-info-form input, #my-info-form select, #btn-save-step-1").forEach(el => el.disabled = true);
    step2.classList.remove("hidden");
    renderCartItems();
}

// --- STEP 2 LOGIC ---
function renderCartItems() {
    const container = document.getElementById("cart-items-container");
    container.innerHTML = "";
    
    let requiredTestCategories = new Set(); // To store types like 'pathology', 'mri' for lab matchmaking

    cart.forEach((item, index) => {
        // Infer test category for backend match (assuming service_name or type contains these words)
        let testTypeStr = (item.service_name + " " + (item.service_type || "")).toLowerCase();
        let needsCenterVisitOnly = testTypeStr.includes("mri") || testTypeStr.includes("ct") || testTypeStr.includes("usg");
        
        // Add to required categories for Step 2 lab match
        if (testTypeStr.includes("mri")) requiredTestCategories.add("mri");
        else if (testTypeStr.includes("usg")) requiredTestCategories.add("usg");
        else requiredTestCategories.add("pathology"); // Defaulting others to pathology for example

        let itemHtml = `
            <div class="cart-item">
                <strong>${item.service_name}</strong> - ₹${item.price} <br>
                ${needsCenterVisitOnly ? 
                    `<span style="color: blue; font-weight:bold;">[Center Visit Required]</span>` : 
                    `<label><input type="radio" name="collection_${index}" value="home" checked onchange="validateHomeCollection()"> Home Collection</label>
                     <label><input type="radio" name="collection_${index}" value="center" onchange="validateHomeCollection()"> Center Visit</label>`
                }
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
        alert("Warning: Your area (" + userDetails.pincode + ") is not serviceable for Home Collection. Please switch to Center Visit for all items or update your pincode.");
        // Uncheck home, check center
        document.querySelectorAll('input[type="radio"][value="home"]').forEach(el => el.checked = false);
        document.querySelectorAll('input[type="radio"][value="center"]').forEach(el => el.checked = true);
    }
}

async function fetchMatchingLabs(requiredServices) {
    const labsContainer = document.getElementById("labs-container");
    const scheduleSection = document.getElementById("schedule-section");
    document.getElementById("lab-matchmaking-section").classList.remove("hidden");
    labsContainer.innerHTML = "Finding the best labs for your required tests...";

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
                    <div class="lab-item">
                        <label>
                            <input type="radio" name="selected_lab" value="${lab.lab_id}" onchange="selectLab('${lab.lab_id}', '${lab.open_time}', '${lab.close_time}')">
                            <strong>${lab.lab_name}</strong><br>
                            <small>${lab.lab_address} (Timing: ${lab.open_time} - ${lab.close_time})</small>
                        </label>
                    </div>
                `;
            });
        } else {
            labsContainer.innerHTML = "<span class='warning-text'>No active labs found matching your tests in your pincode.</span>";
        }
    } catch (e) {
        labsContainer.innerHTML = "Error fetching labs.";
        console.error(e);
    }
}

function selectLab(labId, openTime, closeTime) {
    selectedLab = labId;
    const scheduleSection = document.getElementById("schedule-section");
    scheduleSection.classList.remove("hidden");
    
    // Simple logic to show step 3 when date/time changes
    document.getElementById("booking-date").addEventListener("change", checkCheckoutReady);
    document.getElementById("booking-time").addEventListener("change", checkCheckoutReady);
}

// --- STEP 3 LOGIC ---
function checkCheckoutReady() {
    const date = document.getElementById("booking-date").value;
    const time = document.getElementById("booking-time").value;

    if (selectedLab && date && time) {
        step3.classList.remove("hidden");
        const btn = document.getElementById("btn-confirm-booking");
        btn.disabled = false;
        
        // Single listener attachment to avoid duplicate orders
        btn.onclick = submitOrder; 
    }
}

async function submitOrder() {
    document.getElementById("btn-confirm-booking").disabled = true;
    document.getElementById("btn-confirm-booking").innerText = "Processing...";

    const orderData = {
        action: "placeOrder",
        userId: userId,
        patientName: userDetails.selectedName,
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
            alert("Booking Confirmed Successfully!");
            localStorage.removeItem("bhavyaCart");
            window.location.href = "success.html"; // Redirect to success page
        } else {
            alert("Error placing order.");
            document.getElementById("btn-confirm-booking").disabled = false;
        }
    } catch (e) {
        alert("Network Error.");
        document.getElementById("btn-confirm-booking").disabled = false;
    }
}
