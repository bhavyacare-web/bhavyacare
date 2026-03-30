const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFX5MRGW1XRhVVO1ABuKS8wi2lcN7PCcyNddHfzv407eZ6TyeWOesIf-FIbbTKu882vg/exec";

let baseVipPrice = 3000;
let vipDiscount = 500;
let finalAmount = 3000;
let validReferrerId = "";

document.addEventListener("DOMContentLoaded", initVipPage);

async function initVipPage() {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        window.location.href = "../index.html";
        return;
    }

    try {
        // 1. Fetch Patient Profile (Sirf naam pre-fill karne ke liye)
        const profileRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientProfile", user_id: userId })
        });
        const profileData = await profileRes.json();

        if (profileData.status === "success") {
            // Patient ka naam prefill kar do
            document.getElementById("mem1Name").value = profileData.data.patient_name;
        }

        // 2. Fetch Pricing Rules (Ye hamesha chalega ab)
        const ruleRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipRulesAndReferral" })
        });
        const ruleData = await ruleRes.json();
        
        if (ruleData.status === "success") {
            baseVipPrice = ruleData.data.price;
            vipDiscount = ruleData.data.discount;
            finalAmount = baseVipPrice;
            updatePayableUI();
        }
    } catch (err) {
        console.error("Failed to load page data:", err);
    }
}

function updatePayableUI() {
    document.getElementById("finalPayable").innerText = finalAmount;
}

// 3. Toggle Online/Cash
function togglePaymentMode() {
    const isOnline = document.querySelector('input[name="payMode"]:checked').value === 'online';
    document.getElementById('online-pay-section').style.display = isOnline ? 'block' : 'none';
}

// 4. Validate Referral
async function verifyReferral() {
    const code = document.getElementById("refCodeInput").value.trim();
    const msg = document.getElementById("refMsg");
    const btn = document.getElementById("btn-apply-ref");

    if (!code) { msg.style.display="block"; msg.style.color="red"; msg.innerText="Enter code first!"; return; }

    btn.innerText = "Checking...";
    btn.disabled = true;

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipRulesAndReferral", user_id: localStorage.getItem("bhavya_user_id"), referral_code: code })
        });
        const data = await res.json();

        if (data.status === "success" && data.data.validReferral) {
            validReferrerId = data.data.referrer_id;
            finalAmount = baseVipPrice - vipDiscount;
            updatePayableUI();
            
            msg.style.display="block"; msg.style.color="green"; msg.innerText=`Valid! ₹${vipDiscount} discount applied.`;
            document.getElementById("refCodeInput").readOnly = true;
            btn.style.display = "none";
        } else {
            msg.style.display="block"; msg.style.color="red"; msg.innerText=data.message || "Invalid Code.";
            validReferrerId = "";
            finalAmount = baseVipPrice;
            updatePayableUI();
        }
    } catch(err) {
        msg.style.display="block"; msg.style.color="red"; msg.innerText="Error checking code.";
    } finally {
        btn.innerText = "Apply";
        btn.disabled = false;
    }
}

// 5. Image Compression
const payScreenshotInput = document.getElementById("payScreenshot");
if (payScreenshotInput) {
    payScreenshotInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const scaleSize = 600 / img.width; // Compress width to 600px
                canvas.width = 600; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                document.getElementById("payScreenshotBase64").value = canvas.toDataURL("image/jpeg", 0.7);
            }
        }
    });
}

// 6. Submit Application
async function submitVIP() {
    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    const payId = document.getElementById("payId").value.trim();
    const screenshot = document.getElementById("payScreenshotBase64").value;

    // Validation Rules
    if (payMode === 'online' && !payId && !screenshot) {
        alert("For Online Payment, please provide either a Transaction ID or upload a Screenshot.");
        return;
    }

    const btn = document.getElementById("btn-submit");
    btn.innerText = "Submitting Please Wait...";
    btn.disabled = true;

    const payload = {
        action: "submitVipApplication",
        user_id: localStorage.getItem("bhavya_user_id"),
        member1_name: document.getElementById("mem1Name").value,
        member2_name: document.getElementById("mem2Name").value.trim(),
        member3_name: document.getElementById("mem3Name").value.trim(),
        referrer_user_id: validReferrerId,
        payment_mode: payMode,
        payment_id: payId,
        payment_screenshot: screenshot,
        amount_paid: finalAmount
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === "success") {
            alert(result.message);
            window.location.href = "../patient_dashboard/patient_dashboard.html"; // Go back to dashboard on success
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Submission failed. Check your internet connection.");
    } finally {
        btn.innerText = "Submit Application";
        btn.disabled = false;
    }
}
