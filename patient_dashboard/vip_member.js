// 🌟 APNA SCRIPT URL DAALO 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8cnaQLCDP6OaZ2vOyl9Oy8HWICc9nigQChCSpMpAeUOwJ4xijq5L1iPX1CJhPAo4W0w/exec";

let basePrice = 3000;
let finalPrice = 3000;
let appliedReferrerId = "";

document.addEventListener("DOMContentLoaded", async () => {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        window.location.href = "../index.html";
        return;
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkVipEligibility", user_id: userId })
        });
        
        const result = await response.json();
        
        // 🌟 NAYA REDIRECT LOGIC 🌟
        if (result.status === "error" && result.message === "Profile Incomplete") {
            alert("Please complete your personal details first to activate the VIP Plan.");
            window.location.href = "patient_dashboard.html?tab=profile"; // Seedha Profile tab pe bhejega
        } else if (result.status === "success") {
            document.getElementById("mem1Name").value = result.data.patient_name;
            basePrice = result.data.price;
            finalPrice = basePrice;
            document.getElementById("finalAmt").innerText = finalPrice;
            document.getElementById("loader").style.display = "none";
        }
    } catch (e) {
        alert("Network Error. Redirecting to dashboard.");
        window.location.href = "patient_dashboard.html";
    }
});

// Image Compression for Screenshot
document.getElementById("txnScreenshot").addEventListener("change", function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const scaleSize = 400 / img.width;
            canvas.width = 400;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            document.getElementById("screenshotBase64").value = canvas.toDataURL("image/jpeg", 0.7);
        }
    }
});

function togglePayMode() {
    const isOnline = document.querySelector('input[name="payMode"][value="Online"]').checked;
    document.getElementById("onlinePaySection").style.display = isOnline ? "block" : "none";
}

async function applyRefCode() {
    const refCode = document.getElementById("refCodeInput").value.trim();
    const msg = document.getElementById("refMsg");
    if (!refCode) return;

    msg.style.display = "block";
    msg.style.color = "#0056b3";
    msg.innerText = "Checking...";

    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "validateReferral", user_id: localStorage.getItem("bhavya_user_id"), ref_code: refCode })
    });
    
    const result = await response.json();
    if (result.status === "success") {
        msg.style.color = "green";
        msg.innerText = "Code Applied! ₹" + result.data.discount + " Off.";
        finalPrice = basePrice - result.data.discount;
        appliedReferrerId = result.data.referrer_id;
        document.getElementById("finalAmt").innerText = finalPrice;
    } else {
        msg.style.color = "red";
        msg.innerText = result.message;
        finalPrice = basePrice;
        appliedReferrerId = "";
        document.getElementById("finalAmt").innerText = finalPrice;
    }
}

async function submitApplication() {
    const isOnline = document.querySelector('input[name="payMode"][value="Online"]').checked;
    const txnId = document.getElementById("txnId").value.trim();
    const screenshot = document.getElementById("screenshotBase64").value;
    
    // Validation Rule
    if (isOnline && !txnId && !screenshot) {
        alert("Please enter Transaction ID or upload a screenshot for online payment.");
        return;
    }

    const btn = document.getElementById("submitBtn");
    btn.innerText = "Submitting...";
    btn.disabled = true;

    const payload = {
        action: "submitVipApplication",
        user_id: localStorage.getItem("bhavya_user_id"),
        m1_name: document.getElementById("mem1Name").value,
        m2_name: document.getElementById("mem2Name").value,
        m3_name: document.getElementById("mem3Name").value,
        referrer_id: appliedReferrerId,
        payment_mode: isOnline ? "Online" : "Cash",
        payment_id: txnId,
        payment_screenshot: screenshot,
        amount_paid: finalPrice
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.status === "success") {
            alert("VIP Application Submitted! Admin will activate your plan after verification.");
            window.location.href = "patient_dashboard.html";
        } else {
            alert(result.message);
            btn.innerText = "Submit Application";
            btn.disabled = false;
        }
    } catch (e) {
        alert("Failed to submit. Check connection.");
        btn.innerText = "Submit Application";
        btn.disabled = false;
    }
}
