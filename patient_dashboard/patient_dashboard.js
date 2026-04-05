const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 
let isUserVip = false;

document.addEventListener("DOMContentLoaded", checkLoginAndFetchData);

async function checkLoginAndFetchData() {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) { alert("Please login first to access the dashboard."); window.location.href = "../index.html"; return; }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientProfile", user_id: userId }) 
        });

        const result = await response.json();

        if (result.status === "success") {
            const patient = result.data;
            
            safeSetText("userNameMobile", patient.patient_name);
            safeSetText("userNameDesktop", patient.patient_name);
            safeSetText("userIdDisplay", "ID: " + patient.user_id);
            safeSetText("walletBal", patient.wallet || "0");
            safeSetText("refCode", patient.referral_code || "-----");
            safeSetText("infoName", patient.patient_name);
            safeSetText("infoMobile", patient.mobile_number);

            // Withdraw Button Visibility
            if (patient.withdraw && patient.withdraw.toLowerCase() === 'active') {
                document.getElementById('btn-withdraw').style.display = 'block';
            } else {
                document.getElementById('btn-withdraw').style.display = 'none';
            }

            const planName = patient.plan ? patient.plan.toLowerCase() : "basic";
            isUserVip = (planName === "vip"); 
            safeSetText("vipStatus", patient.plan ? patient.plan.toUpperCase() : "BASIC");
            
            const vipBtn = document.getElementById("btn-vip-action");
            const vipSubText = document.getElementById("vipSubText");
            const vipAlert = document.getElementById("vipPackageAlert");

            if (isUserVip) {
                if (vipBtn) vipBtn.style.display = "none";
                if (vipSubText) vipSubText.innerHTML = "Enjoying VIP Benefits ✨ <br><small style='color:#0056b3;'>Click card to view details</small>"; 
                
                if (patient.vip_package_status === "pending") {
                    if (vipAlert) vipAlert.style.display = "block";
                } else {
                    if (vipAlert) vipAlert.style.display = "none";
                }

                if (patient.vip_details) {
                    safeSetText("vd-start", patient.vip_details.start_date || "N/A");
                    safeSetText("vd-end", patient.vip_details.end_date || "N/A");
                    document.getElementById("vd-mem1").innerHTML = `<span><strong>${patient.vip_details.member1_name || 'N/A'}</strong> <br><small style="color:#888;">(Self)</small></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member1_id || '-'}</span>`;
                    
                    if (patient.vip_details.member2_name) {
                        document.getElementById("vd-mem2").innerHTML = `<span><strong>${patient.vip_details.member2_name}</strong></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member2_id || '-'}</span>`;
                        document.getElementById("vd-mem2").style.display = "flex";
                    } else { document.getElementById("vd-mem2").style.display = "none"; }

                    if (patient.vip_details.member3_name) {
                        document.getElementById("vd-mem3").innerHTML = `<span><strong>${patient.vip_details.member3_name}</strong></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member3_id || '-'}</span>`;
                        document.getElementById("vd-mem3").style.display = "flex";
                    } else { document.getElementById("vd-mem3").style.display = "none"; }
                }
            } else {
                if (vipBtn) vipBtn.style.display = "block";
                if (vipSubText) vipSubText.innerText = "Upgrade for free home collection";
                if (vipAlert) vipAlert.style.display = "none";
            }
            
            const banner = document.getElementById("profileBanner");
            const profileImages = document.querySelectorAll(".profile-img");
            const editPreview = document.getElementById("editProfilePreview");
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.patient_name)}&background=e6f0fa&color=0056b3&bold=true`;

            if (patient.extra_details) {
                if (banner) banner.style.display = "none";
                safeSetValue("infoEmail", patient.extra_details.email);
                safeSetValue("infoAddress", patient.extra_details.address);
                safeSetValue("infoCity", patient.extra_details.city);
                safeSetValue("infoDistrict", patient.extra_details.district);
                safeSetValue("infoState", patient.extra_details.state);
                safeSetValue("infoPincode", patient.extra_details.pincode);
                
                if (patient.extra_details.image && patient.extra_details.image.startsWith("data:image")) {
                    profileImages.forEach(img => img.src = patient.extra_details.image);
                    if(editPreview) editPreview.src = patient.extra_details.image;
                } else {
                    profileImages.forEach(img => img.src = fallbackUrl);
                    if(editPreview) editPreview.src = fallbackUrl;
                }
            } else {
                if (banner) banner.style.display = "block"; 
                profileImages.forEach(img => img.src = fallbackUrl);
                if(editPreview) editPreview.src = fallbackUrl;
            }

            fetchWalletHistory(userId);

        } else {
            alert("Error: " + result.message);
            if(result.message === "Your account is blocked by Admin.") logoutDashboard();
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

// 🌟 Updated Function for VIP Click 🌟
function handleVipCardClick() {
    if (isUserVip) { 
        document.getElementById('vip-details-modal').style.display = 'block'; 
    } else { 
        document.getElementById('pincode-modal').style.display = 'block'; 
    }
}

// 🌟 New Function to Verify Pincode 🌟
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
            window.location.href = '../vip/vip_member.html';
        } else {
            alert("Currently, this service is not available in your area. Please try again after some time.");
            document.getElementById('pincode-modal').style.display = 'none';
            document.getElementById('checkPincodeInput').value = '';
        }
    } catch(error) {
        alert("Network error. Please try again.");
    } finally {
        btn.innerText = "Check & Proceed"; 
        btn.disabled = false;
    }
}

function safeSetText(id, text) { const el = document.getElementById(id); if(el) el.innerText = text; }
function safeSetValue(id, val) { const el = document.getElementById(id); if(el && val) el.value = val; }

function switchTab(tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
    const links = document.querySelectorAll(".nav-item, .nav-links a");
    links.forEach(link => link.classList.remove("active"));
    const selectedTab = document.getElementById(tabId);
    if(selectedTab) selectedTab.classList.add("active");
    if(typeof event !== 'undefined' && event && event.currentTarget) { event.currentTarget.classList.add("active"); } 
    else { const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`); if(activeNav) activeNav.classList.add("active"); }
}

function logoutDashboard() { localStorage.clear(); window.location.href = "../index.html"; }

function copyMyReferral() {
    const code = document.getElementById("refCode").innerText;
    if (code && code !== "-----") { navigator.clipboard.writeText(code); alert("Referral Code '" + code + "' copied!"); }
}

const fileInput = document.getElementById("profileImageInput");
if(fileInput) {
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const scaleSize = 200 / img.width;
                canvas.width = 200; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6); 
                document.getElementById("editProfilePreview").src = compressedBase64;
                document.getElementById("infoImageBase64").value = compressedBase64;
            }
        }
    });
}

async function savePatientProfile() {
    const btn = document.getElementById("btnSaveProfile");
    btn.innerText = "Saving Please Wait..."; btn.disabled = true;
    
    const payload = {
        action: "savePatientDetails", user_id: localStorage.getItem("bhavya_user_id"),
        email: document.getElementById("infoEmail").value, address: document.getElementById("infoAddress").value,
        city: document.getElementById("infoCity").value, district: document.getElementById("infoDistrict").value,
        state: document.getElementById("infoState").value, pincode: document.getElementById("infoPincode").value,
        image: document.getElementById("infoImageBase64").value
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.status === "success") { alert("Profile Details Saved Successfully!"); checkLoginAndFetchData(); switchTab('overview'); } 
        else { alert("Error: " + result.message); }
    } catch (error) { alert("Failed to save. Check your connection."); } 
    finally { btn.innerText = "Save & Update Profile"; btn.disabled = false; }
}

async function fetchWalletHistory(userId) {
    const container = document.getElementById("walletHistoryContainer");
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getWalletHistory", user_id: userId })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            const history = result.data;
            if (history.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-receipt" style="font-size: 40px; margin-bottom: 15px;"></i><p>No recent transactions.</p></div>`;
                return;
            }
            let html = "";
            history.forEach(txn => {
                const isCredit = txn.type.toLowerCase() === 'credit';
                const color = isCredit ? '#2e7d32' : '#d32f2f';
                const sign = isCredit ? '+' : '-';
                html += `
                <div class="list-item" style="align-items: flex-start;">
                    <div class="list-info">
                        <h5 style="margin-bottom: 3px;">${txn.description}</h5>
                        <p><i class="far fa-clock"></i> ${txn.date}</p>
                    </div>
                    <div style="font-weight: 800; color: ${color}; font-size: 16px; margin-top: 2px;">
                        ${sign}₹${txn.amount}
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="color:red; text-align:center;">Failed: ${result.message}</p>`;
        }
    } catch(e) {
        console.error("Wallet Fetch Error:", e);
        container.innerHTML = `<p style="color:red; text-align:center;">Network error.</p>`;
    }
}
