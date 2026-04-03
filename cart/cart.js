// ==========================================
// CART & BOOKING LOGIC (Idea 2 Flow)
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; // Backend link daalein

// State Variables
let cart = []; 
let currentUser = null; 
let checkoutData = {
    mode: 'Center',
    labData: null,
    date: '',
    time: '',
    patientData: null // Stores VIP status and addresses fetched from DB
};

// --- Dummy Data (Delete this when your app is ready) ---
cart = [
    { id: 1, name: "Complete Blood Count (CBC)", type: "pathology", price: 500 },
];
// --------------------------------------------------------

window.onload = function() {
    renderCart();
    document.getElementById("bookingDate").value = new Date().toISOString().split('T')[0];
};

// --- UI HELPERS ---
function closeAllPopups() {
    document.querySelectorAll('.popup-box').forEach(b => b.style.display = "none");
    document.getElementById("overlay").style.display = "none";
}

function showModal(id) {
    closeAllPopups();
    document.getElementById("overlay").style.display = "block";
    document.getElementById(id).style.display = "flex";
}

function handleLoginClick() {
    showModal("loginModal");
}

function executeLogin() {
    // Replace with your actual Login API call
    let mob = document.getElementById("loginMobile").value;
    if(mob.length === 10) {
        currentUser = { mobile: mob, user_id: "U-" + mob }; // Mock user
        document.getElementById("loginBtnUI").innerText = "👤 Logged In";
        closeAllPopups();
        alert("Login Successful!");
    } else {
        alert("Enter valid mobile number");
    }
}

// --- CART RENDERING ---
function renderCart() {
    let container = document.getElementById("cartItemsContainer");
    let html = "";
    let total = 0;

    if(cart.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999;'>Cart is empty.</p>";
        return;
    }

    cart.forEach(item => {
        total += item.price;
        html += `
            <div class="cart-item">
                <div class="item-details">
                    <h4>${item.name}</h4>
                    <p>Service Type: ${item.type}</p>
                </div>
                <div class="item-price">₹${item.price}</div>
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById("cartTotalDisplay").innerText = "₹" + total;
}


// ==========================================
// STEP 1: INITIALIZE CHECKOUT (Select Lab & Time)
// ==========================================
function startCheckoutFlow() {
    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }
    if (!currentUser) {
        showModal("loginModal");
        return;
    }

    // Determine category based on cart items (Assuming cart has similar items)
    let primaryCategory = cart[0].type; 
    
    // Show/Hide Home Collection based on service type
    if(primaryCategory === 'pathology' || primaryCategory === 'package') {
        document.getElementById("modeGroup").style.display = "flex";
    } else {
        document.getElementById("modeGroup").style.display = "none";
        checkoutData.mode = "Center"; // Force Center for USG/Xray etc.
    }

    showModal("step1Modal");
    fetchLabs(primaryCategory);
}

function selectMode(btn, mode) {
    document.querySelectorAll('#modeGroup .option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    checkoutData.mode = mode;
}

function fetchLabs(category) {
    let labSelect = document.getElementById("labSelect");
    labSelect.innerHTML = "<option>Loading labs...</option>";

    // Backend API Call (Uncomment when API is ready)
    /*
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "getLabsForService", category: category })
    })
    .then(res => res.json())
    .then(res => {
        // Build Options
    });
    */

    // MOCK DATA for Demo
    let mockLabs = [
        { lab_id: "L1", lab_name: "Shree Diagnostic", address: "Main Road, Bahadurgarh" },
        { lab_id: "L2", lab_name: "Wellness Path Lab", address: "Sector 6, Bahadurgarh" }
    ];
    
    let html = "<option value=''>Select Lab...</option>";
    mockLabs.forEach(lab => {
        html += `<option value='${JSON.stringify(lab)}'>${lab.lab_name}</option>`;
    });
    labSelect.innerHTML = html;
}

function generateTimeSlots() {
    let labVal = document.getElementById("labSelect").value;
    let container = document.getElementById("timeSlotsContainer");
    
    if(!labVal) {
        container.innerHTML = "<div style='grid-column: span 3; text-align: center; color: #999; font-size:12px;'>Select Lab & Date first</div>";
        return;
    }

    // Generate Mock Slots between 9 AM and 6 PM
    let html = "";
    for(let i = 9; i <= 18; i++) {
        let ampm = i >= 12 ? "PM" : "AM";
        let hr = i > 12 ? i - 12 : i;
        html += `<div class="time-slot" onclick="selectTime(this, '${hr}:00 ${ampm}')">${hr}:00 ${ampm}</div>`;
    }
    container.innerHTML = html;
}

function selectTime(el, timeVal) {
    document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
    checkoutData.time = timeVal;
}


// ==========================================
// STEP 2: PATIENT DETAILS (VIP vs Basic Check)
// ==========================================
function proceedToStep2() {
    let labVal = document.getElementById("labSelect").value;
    let dateVal = document.getElementById("bookingDate").value;

    if(!labVal || !dateVal || !checkoutData.time) {
        alert("Please select Lab, Date and Time to proceed.");
        return;
    }

    checkoutData.labData = JSON.parse(labVal);
    checkoutData.date = dateVal;

    // Transition to Step 2
    document.getElementById("step1Modal").style.display = "none";
    document.getElementById("step2Modal").style.display = "flex";

    fetchPatientDetails();
}

function fetchPatientDetails() {
    // Show loading state
    document.getElementById("patientNameContainer").innerHTML = "Loading data...";

    // Backend API Call (Uncomment when API is ready)
    /*
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "getCheckoutCheckoutInfo", user_id: currentUser.user_id })
    })
    ...
    */

    // MOCK RESPONSE based on IDEA 2 requirements
    let mockResponse = {
        isVIP: true, // Change to false to test Basic user flow
        members: ["Rajesh Kumar", "Sunita Sharma", "Ravi Kumar"], // VIP dropdown list
        address: "H.No 123, Venus Plaza",
        city: "Bahadurgarh",
        pincode: "124507"
    };

    checkoutData.patientData = mockResponse;

    // 1. Auto-fill Address Info
    document.getElementById("patientAddress").value = mockResponse.address || "";
    document.getElementById("patientCity").value = mockResponse.city || "";
    document.getElementById("patientPincode").value = mockResponse.pincode || "";

    // 2. Setup Name Field based on VIP Status
    let nameContainer = document.getElementById("patientNameContainer");
    
    if (mockResponse.isVIP) {
        document.getElementById("vipNotice").style.display = "block";
        let dropHtml = `<select id="finalPatientName" class="med-input" style="background:#fff8e1; border-color:#ffb300; font-weight:bold;">`;
        dropHtml += `<option value="">Select VIP Member...</option>`;
        mockResponse.members.forEach(name => {
            dropHtml += `<option value="${name}">👑 ${name}</option>`;
        });
        dropHtml += `</select>`;
        nameContainer.innerHTML = dropHtml;
    } else {
        document.getElementById("vipNotice").style.display = "none";
        nameContainer.innerHTML = `<input type="text" id="finalPatientName" class="med-input" placeholder="Enter Patient Name">`;
    }
}


// ==========================================
// FINAL STEP: SUBMIT ORDER
// ==========================================
function submitFinalOrder() {
    let patientName = document.getElementById("finalPatientName").value;
    let addr = document.getElementById("patientAddress").value;
    let city = document.getElementById("patientCity").value;
    let pin = document.getElementById("patientPincode").value;

    if(!patientName) {
        alert("Please provide the Patient Name.");
        return;
    }

    // Prepare final payload
    let finalPayload = {
        action: "submitOrder",
        user_id: currentUser.user_id,
        patient_name: patientName,
        address: `${addr}, ${city} - ${pin}`,
        booking_mode: checkoutData.mode,
        lab_name: checkoutData.labData.lab_name,
        date: checkoutData.date,
        time: checkoutData.time,
        items: cart
    };

    console.log("Submitting to Server: ", finalPayload);
    
    // Simulate API Success
    document.getElementById("step2Modal").innerHTML = `
        <div style="padding:40px; text-align:center;">
            <div style="font-size:50px; color:#2e7d32;">✅</div>
            <h3 style="color:#2e7d32;">Booking Successful!</h3>
            <p style="color:#666;">Your request has been sent to ${checkoutData.labData.lab_name}.</p>
            <button class="primary-btn" onclick="location.reload()" style="margin-top:20px;">Return Home</button>
        </div>
    `;
    
    // Clear Cart
    cart = [];
}
