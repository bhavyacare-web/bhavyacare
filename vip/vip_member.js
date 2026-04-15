const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; // <-- YAHAN APNA URL UPDATE KAREIN

let baseVipPrice = 3000;
let vipDiscount = 500;
let finalAmount = 3000;
let validReferrerId = "";

document.addEventListener("DOMContentLoaded", initVipPage);

async function initVipPage() {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) { window.location.href = "../index.html"; return; }

    try {
        const statusRes = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "checkVipStatus", user_id: userId }) });
        const statusData = await statusRes.json();

        if (statusData.status === "success") {
            const appStatus = statusData.data.status;
            if (appStatus === "inactive" || appStatus === "pending") { document.getElementById("vip-pending-container").style.display = "block"; return; } 
            else if (appStatus === "active") {
                document.getElementById("vip-active-container").style.display = "block";
                document.getElementById("activeStartDate").innerText = statusData.data.start_date || "N/A";
                document.getElementById("activeEndDate").innerText = statusData.data.end_date || "N/A";
                return; 
            } 
            else if (appStatus === "rejected") {
                document.getElementById("vip-rejected-container").style.display = "block";
                document.getElementById("rejectedRemarks").innerText = statusData.data.remarks || "No reason provided.";
            } 
            else { 
                // 🌟 Yahan pehle vip-form-container aata tha, ab hum pehle pincode dikhayenge
                document.getElementById("vip-pincode-container").style.display = "block"; 
            }
        }

        const profileRes = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getPatientProfile", user_id: userId }) });
        const profileData = await profileRes.json();
        if (profileData.status === "success") { document.getElementById("mem1Name").value = profileData.data.patient_name; }

        const ruleRes = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getVipRulesAndReferral" }) });
        const ruleData = await ruleRes.json();
        if (ruleData.status === "success") {
            baseVipPrice = ruleData.data.price; vipDiscount = ruleData.data.discount; finalAmount = baseVipPrice; updatePayableUI();
        }
    } catch (err) { console.error("Error:", err); }
}

function showVipPincodeCheck() {
    document.getElementById("vip-rejected-container").style.display = "none";
    document.getElementById("vip-pincode-container").style.display = "block";
}

// 🌟 Naya Function: Pincode Check karne ke liye 🌟
async function verifyPincodeAndProceed() {
    const pincode = document.getElementById("checkPincodeInput").value.trim();
    if(!pincode || pincode.length !== 6) { 
        alert("Please enter a valid 6-digit pincode."); 
        return; 
    }

    const btn = document.getElementById("btnCheckPincode");
    btn.innerText = "Checking..."; 
    btn.disabled = true;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkVipPincode", pincode: pincode })
        });
        const result = await response.json();

        if(result.status === "success") {
            document.getElementById('vip-pincode-container').style.display = 'none';
            document.getElementById('vip-form-container').style.display = 'block';
        } else {
            alert("Currently, this service is not available in your area. Please try again after some time.");
            document.getElementById('checkPincodeInput').value = '';
        }
    } catch(error) {
        alert("Network error. Please try again.");
    } finally {
        btn.innerText = "Check & Proceed"; 
        btn.disabled = false;
    }
}

function updatePayableUI() { document.getElementById("finalPayable").innerText = finalAmount; }

function togglePaymentMode() {
    const isOnline = document.querySelector('input[name="payMode"]:checked').value === 'online';
    document.getElementById('online-pay-section').style.display = isOnline ? 'block' : 'none';
}

function payViaUPI() {
    const upiId = "8950112467@ptsbi";
    const name = "BhavyaCare";
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${finalAmount}&cu=INR&tn=BhavyaCare VIP Plan`;
    window.location.href = upiUrl;
}

async function verifyReferral() {
    const code = document.getElementById("refCodeInput").value.trim();
    const msg = document.getElementById("refMsg");
    const btn = document.getElementById("btn-apply-ref");

    if (!code) { msg.style.display="block"; msg.style.color="red"; msg.innerText="Enter code first!"; return; }
    btn.innerText = "Checking..."; btn.disabled = true;

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getVipRulesAndReferral", user_id: localStorage.getItem("bhavya_user_id"), referral_code: code }) });
        const data = await res.json();

        if (data.status === "success" && data.data.validReferral) {
            validReferrerId = data.data.referrer_id; finalAmount = baseVipPrice - vipDiscount; updatePayableUI();
            msg.style.display="block"; msg.style.color="green"; msg.innerText=`Valid! ₹${vipDiscount} discount applied.`;
            document.getElementById("refCodeInput").readOnly = true; btn.style.display = "none";
        } else {
            msg.style.display="block"; msg.style.color="red"; msg.innerText=data.message || "Invalid Code.";
            validReferrerId = ""; finalAmount = baseVipPrice; updatePayableUI();
        }
    } catch(err) { msg.style.display="block"; msg.style.color="red"; msg.innerText="Error checking code."; } 
    finally { btn.innerText = "Apply"; btn.disabled = false; }
}

const payScreenshotInput = document.getElementById("payScreenshot");
if (payScreenshotInput) {
    payScreenshotInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image(); img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const scaleSize = 600 / img.width; 
                canvas.width = 600; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                document.getElementById("payScreenshotBase64").value = canvas.toDataURL("image/jpeg", 0.7);
            }
        }
    });
}

async function submitVIP() {
    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    const screenshot = document.getElementById("payScreenshotBase64").value;

    if (payMode === 'online' && !screenshot) { alert("Please upload the payment screenshot first."); return; }

    const btn = document.getElementById("btn-submit");
    btn.innerText = "Processing & Uploading..."; btn.disabled = true;

    const payload = {
        action: "submitVipApplication", user_id: localStorage.getItem("bhavya_user_id"),
        member1_name: document.getElementById("mem1Name").value, member2_name: document.getElementById("mem2Name").value.trim(), member3_name: document.getElementById("mem3Name").value.trim(),
        referrer_user_id: validReferrerId, payment_mode: payMode, payment_id: document.getElementById("payId").value.trim(), payment_screenshot: screenshot, amount_paid: finalAmount
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.status === "success") { alert(result.message); window.location.reload(); } 
        else { alert("Error: " + result.message); }
    } catch (error) { alert("Submission failed. Check connection."); } 
    finally { btn.innerText = "Submit Application"; btn.disabled = false; }
}
