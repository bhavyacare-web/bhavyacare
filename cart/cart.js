const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 
const homeServiceCategories = ['pathology', 'profile', 'ecg', 'holter', 'pft'];
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];

// Patient Booking Data State
let bookingPatient = {
    name: "", mobile: "", pincode: "", address: "", isVip: false
};

window.onload = () => {
    // Basic Cart Check
    if (cart.length === 0) {
        document.getElementById('loadingOverlay').style.display = "none";
        document.querySelector('.container').innerHTML = "<div style='text-align:center; padding:40px;'><i class='fas fa-shopping-cart' style='font-size:40px; color:#cbd5e1; margin-bottom:15px;'></i><br><h3 style='color:var(--text-main);'>Cart is Empty</h3><a href='../booking/booking.html' style='color:var(--primary); font-weight:bold;'>Go Back to Booking</a></div>";
        return;
    }
    calculateTotal();

    // Enforce Login Check
    const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id");
    if (!userId) {
        document.getElementById('loadingOverlay').style.display = "none";
        document.getElementById('login-section').style.display = "block";
        if (document.getElementById('recaptcha-container')) setupRecaptcha();
        return;
    }

    // If Logged in, Fetch Smart Profile
    fetchPatientProfile(userId);
};

function fetchPatientProfile(userId) {
    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId })
    })
    .then(res => res.json())
    .then(response => {
        document.getElementById('loadingOverlay').style.display = "none";
        if (response.status === "success") {
            const data = response.data;
            bookingPatient.mobile = data.mobile;
            bookingPatient.isVip = data.isVip;
            
            // Populate fields
            document.getElementById('userMobile').value = data.mobile;
            document.getElementById('userPincode').value = data.pincode;
            document.getElementById('userAddress').value = data.address;

            // Handle Name Input vs Dropdown (VIP Logic)
            const nameContainer = document.getElementById('nameInputContainer');
            if (data.isVip && data.vipMembers.length > 0) {
                document.getElementById('vipTagContainer').innerHTML = '<span class="vip-badge"><i class="fas fa-crown"></i> VIP Active</span>';
                let selectHtml = `<select id="userNameInput" class="form-input">`;
                data.vipMembers.forEach(mem => {
                    selectHtml += `<option value="${mem}">${mem}</option>`;
                });
                selectHtml += `</select>`;
                nameContainer.innerHTML = selectHtml;
            } else {
                document.getElementById('vipTagContainer').innerHTML = '';
                nameContainer.innerHTML = `<input type="text" id="userNameInput" class="form-input" placeholder="Enter Patient Name" value="${data.name}">`;
            }

        } else {
            alert("Error fetching profile. You can fill details manually.");
            document.getElementById('nameInputContainer').innerHTML = `<input type="text" id="userNameInput" class="form-input" placeholder="Enter Patient Name">`;
        }
    }).catch(err => {
        document.getElementById('loadingOverlay').style.display = "none";
        document.getElementById('nameInputContainer').innerHTML = `<input type="text" id="userNameInput" class="form-input" placeholder="Enter Patient Name">`;
    });
}

// 🌟 STEP 1 TO STEP 2 TRANSITION 🌟
function savePatientInfo() {
    const name = document.getElementById('userNameInput').value.trim();
    const pincode = document.getElementById('userPincode').value.trim();
    const address = document.getElementById('userAddress').value.trim();

    if(!name) return alert("Patient Name is required.");
    if(pincode.length < 6) return alert("Valid 6-digit Pincode is required.");

    // Lock Data
    bookingPatient.name = name;
    bookingPatient.pincode = pincode;
    bookingPatient.address = address;

    // Update Summary UI
    document.getElementById('sumName').innerText = name;
    document.getElementById('sumMobile').innerText = bookingPatient.mobile;
    document.getElementById('sumAddress').innerText = address || "Not provided";
    document.getElementById('sumPincode').innerText = pincode;

    // Toggle UI States
    document.getElementById('patientInfoForm').style.display = "none";
    document.getElementById('patientInfoSummary').style.display = "block";
    document.getElementById('editInfoBtn').style.display = "block";

    // Unlock Step 2
    document.getElementById('step2-card').style.display = "block";
    document.getElementById('step2-card').style.opacity = "1";
    document.getElementById('step2-card').style.pointerEvents = "auto";
    
    // Render Items for Step 2
    renderCartItems();
}

function editPatientInfo() {
    document.getElementById('patientInfoForm').style.display = "block";
    document.getElementById('patientInfoSummary').style.display = "none";
    document.getElementById('editInfoBtn').style.display = "none";
    
    // Dim Step 2 until re-saved
    document.getElementById('step2-card').style.opacity = "0.5";
    document.getElementById('step2-card').style.pointerEvents = "none";
}

// ==========================================
// STEP 2: CART CONFIGURATION LOGIC
// ==========================================
function renderCartItems() {
    const container = document.getElementById("cartItemsContainer");
    let html = "";

    cart.forEach((item, index) => {
        let type = (item.service_type || "").toLowerCase();
        let isHomeEligible = homeServiceCategories.includes(type);
        
        if(!item.fulfillment) item.fulfillment = isHomeEligible ? "home" : "center";
        
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
}

function changeFulfillment(index, type) {
    cart[index].fulfillment = type;
    renderCartItems();
}

function calculateTotal() {
    let total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    document.getElementById("cartTotalAmt").innerText = total;
}
