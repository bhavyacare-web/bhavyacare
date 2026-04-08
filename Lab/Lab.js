// ==========================================
// vip.js - VIP Membership Frontend Logic
// ==========================================

// Aapka Google Apps Script API URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

document.addEventListener("DOMContentLoaded", function() {
    // Page load hote hi check karein ki user logged in hai ya nahi
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId) {
        // Agar login nahi hai, toh flag set karein aur login page par bhej de
        localStorage.setItem("pending_vip_redirect", "true");
        alert("Please login to view VIP Membership details.");
        window.location.href = "index.html"; // Aapke login page ka path
        return;
    }

    // Agar login hai, toh VIP status fetch karein
    checkCurrentVipStatus(userId);
});

// ==========================================
// 1. CHECK VIP STATUS
// ==========================================
async function checkCurrentVipStatus(userId) {
    try {
        // Loading state show kar sakte hain yahan
        console.log("Checking VIP Status...");

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkVipStatus", user_id: userId })
        });
        
        const res = await response.json();
        
        if (res.status === "success") {
            updateVipUI(res.data); // Status ke hisaab se screen update karein
        } else {
            console.error("Failed to fetch VIP status:", res.message);
        }
    } catch (error) {
        console.error("System Error checking VIP:", error);
    }
}

// UI Update Function - Status ke aadhar par HTML elements dikhaye ya chupaye
function updateVipUI(vipData) {
    // Note: Ye HTML IDs aapko apne vip.html me match karne honge
    const applySection = document.getElementById("vip-apply-section");
    const activeSection = document.getElementById("vip-active-section");
    const pendingSection = document.getElementById("vip-pending-section");

    // Reset all
    if(applySection) applySection.style.display = "none";
    if(activeSection) activeSection.style.display = "none";
    if(pendingSection) pendingSection.style.display = "none";

    if (vipData && vipData.is_vip === true) {
        // VIP ACTIVE HAI
        if(activeSection) activeSection.style.display = "block";
        const expiryElem = document.getElementById("vip-expiry-date");
        if(expiryElem) expiryElem.innerText = "Valid till: " + new Date(vipData.expiry_date).toLocaleDateString();
    } 
    else if (vipData && vipData.status === "pending") {
        // VIP APPLICATION PENDING HAI (Admin approval baaki hai)
        if(pendingSection) pendingSection.style.display = "block";
    } 
    else {
        // VIP NAHI HAI - Apply form dikhayein
        if(applySection) applySection.style.display = "block";
    }
}

// ==========================================
// 2. CHECK PINCODE AVAILABILITY
// ==========================================
async function checkServicePincode() {
    const pincodeInput = document.getElementById("vipPincode").value.trim();
    const pincodeMsg = document.getElementById("pincodeMessage");

    if (pincodeInput.length !== 6) {
        pincodeMsg.innerText = "Please enter a valid 6-digit Pincode.";
        pincodeMsg.style.color = "red";
        return;
    }

    pincodeMsg.innerText = "Checking availability...";
    pincodeMsg.style.color = "blue";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkVipPincode", pincode: pincodeInput })
        });
        
        const res = await response.json();
        
        if (res.status === "success" && res.data.available) {
            pincodeMsg.innerText = "✅ Service available in your area!";
            pincodeMsg.style.color = "green";
            // Proceed to show payment/apply button
            document.getElementById("applyVipBtn").disabled = false;
        } else {
            pincodeMsg.innerText = "❌ Sorry, VIP service is not yet available in this pincode.";
            pincodeMsg.style.color = "red";
            document.getElementById("applyVipBtn").disabled = true;
        }
    } catch (error) {
        pincodeMsg.innerText = "System error checking pincode.";
        pincodeMsg.style.color = "red";
    }
}

// ==========================================
// 3. SUBMIT VIP APPLICATION
// ==========================================
async function submitVipApplication() {
    const userId = localStorage.getItem("bhavya_user_id");
    const name = localStorage.getItem("bhavya_name");
    const mobile = localStorage.getItem("bhavya_mobile");
    const pincode = document.getElementById("vipPincode").value.trim();
    const address = document.getElementById("vipAddress").value.trim(); // Agar address field hai

    if (!pincode || !address) {
        alert("Please fill in all details (Pincode & Address).");
        return;
    }

    // Button loading state
    const btn = document.getElementById("applyVipBtn");
    btn.innerText = "Submitting...";
    btn.disabled = true;

    const requestData = {
        action: "submitVipApplication",
        user_id: userId,
        name: name,
        mobile: mobile,
        pincode: pincode,
        address: address,
        payment_status: "Paid", // Demo ke liye. Asli payment gateway integrate karna hoga future me
        transaction_id: "TXN" + Math.floor(Math.random() * 1000000)
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(requestData)
        });
        
        const res = await response.json();
        
        if (res.status === "success") {
            alert("VIP Application Submitted Successfully! Waiting for Admin Approval.");
            // UI refresh karein taaki "Pending" state dikhe
            checkCurrentVipStatus(userId);
        } else {
            alert("Error: " + res.message);
            btn.innerText = "Apply for VIP";
            btn.disabled = false;
        }
    } catch (error) {
        alert("Network Error! Please try again.");
        btn.innerText = "Apply for VIP";
        btn.disabled = false;
    }
}
