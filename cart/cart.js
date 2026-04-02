const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

const serviceablePincodes = ["124507", "124508", "110043"]; 
const homeServiceCategories = ['pathology', 'profile', 'ecg', 'holter', 'pft'];

let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let matchedLabsList = [];
let selectedLabId = null;
let selectedTimeSlot = null;

window.onload = () => {
    if (cart.length === 0) {
        document.getElementById('cartItemsContainer').innerHTML = "<p style='text-align:center; color:var(--text-muted); font-weight:600;'>Your cart is empty!</p>";
        return;
    }
    cart.forEach(item => {
        let type = (item.service_type || "").toLowerCase();
        if(!item.fulfillment) {
            item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
        }
    });
    renderCartItems();
    calculateTotal();
    
    let today = new Date().toISOString().split('T')[0];
    document.getElementById("bookingDate").setAttribute('min', today);
};

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
                    <button class="toggle-btn ${homeActive}" onclick="changeFulfillment(${index}, 'home')"><i class="fas fa-home"></i> Home Collection</button>
                    <button class="toggle-btn ${centerActive}" onclick="changeFulfillment(${index}, 'center')"><i class="fas fa-hospital"></i> Center Visit</button>
                </div>
            `;
        } else {
            item.fulfillment = "center"; 
            toggleHtml = `<div class="center-only-badge"><i class="fas fa-info-circle"></i> Center Visit Required for Scans</div>`;
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

function verifyLocation() {
    const pincode = document.getElementById("userPincode").value.trim();
    if (pincode.length < 6) {
        alert("Please enter a valid 6-digit Pincode.");
        return;
    }

    const needsHomeCollection = cart.some(item => item.fulfillment === "home");

    if (needsHomeCollection && !serviceablePincodes.includes(pincode)) {
        document.getElementById("alertPincode").innerText = pincode;
        document.getElementById("pincodeWarningModal").classList.add("active");
    } else {
        fetchLabs(pincode);
    }
}

function closePincodeModal() {
    document.getElementById("pincodeWarningModal").classList.remove("active");
}

function switchAllToCenter() {
    cart.forEach(item => {
        if (item.fulfillment === "home") item.fulfillment = "center";
    });
    renderCartItems();
    closePincodeModal();
    const pincode = document.getElementById("userPincode").value.trim();
    fetchLabs(pincode);
}

function fetchLabs(pincode) {
    document.getElementById("labSelectionSection").style.display = "block";
    document.getElementById("loadingLabs").style.display = "block";
    document.getElementById("labsContainer").innerHTML = "";

    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getMatchedLabs", pincode: pincode })
    })
    .then(res => res.json())
    .then(response => {
        document.getElementById("loadingLabs").style.display = "none";
        if (response.status === "success" && response.data.labs.length > 0) {
            matchedLabsList = response.data.labs;
            renderLabs();
        } else {
            document.getElementById("labsContainer").innerHTML = "<p style='color:var(--danger); font-size:13px;'>No partner labs found near your area. Try a different pincode.</p>";
        }
    }).catch(err => {
        document.getElementById("loadingLabs").innerHTML = "Error fetching labs.";
    });
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
                    <p>${lab.lab_address}, ${lab.lab_city} - ${lab.lab_pincode}</p>
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
}

function generateTimeSlots() {
    const dateStr = document.getElementById("bookingDate").value;
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
}

function proceedToPayment() {
    const pincode = document.getElementById("userPincode").value.trim();
    const date = document.getElementById("bookingDate").value;

    if (!pincode) return alert("Please enter Pincode.");
    if (!selectedLabId) return alert("Please select a Lab Center.");
    if (!date) return alert("Please select a Date.");
    if (!selectedTimeSlot) return alert("Please select a Time Slot.");

    alert("Connecting to Payment Gateway (Razorpay/UPI)...\n\nSelected Lab: " + selectedLabId + "\nSlot: " + date + " " + selectedTimeSlot);
}
