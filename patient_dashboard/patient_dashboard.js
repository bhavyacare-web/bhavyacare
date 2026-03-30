const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw2osa0dczU6rUpl2vkEcMaok3WcsuUsqfWlqCdM5bxq_hzLK5LRbeLrCcR0X2qGuL9/exec";

// ==========================================
// 1. DATA FETCH & BINDING
// ==========================================
document.addEventListener("DOMContentLoaded", checkLoginAndFetchData);

async function checkLoginAndFetchData() {
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId) {
        alert("Please login first to access the dashboard.");
        window.location.href = "../index.html"; 
        return;
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientProfile", user_id: userId }) 
        });

        const result = await response.json();

        if (result.status === "success") {
            const patient = result.data;
            
            // Standard UI Update
            safeSetText("userNameMobile", patient.patient_name);
            safeSetText("userNameDesktop", patient.patient_name);
            safeSetText("userIdDisplay", "ID: " + patient.user_id);
            safeSetText("walletBal", patient.wallet || "0");
            safeSetText("refCode", patient.referral_code || "-----");
            
            // Profile Read-Only Fields Update
            safeSetText("infoName", patient.patient_name);
            safeSetText("infoMobile", patient.mobile_number);

            // 🌟 VIP UI & Package Pending Logic (Safely handled) 🌟
            const planName = patient.plan ? patient.plan.toLowerCase() : "basic";
            safeSetText("vipStatus", patient.plan ? patient.plan.toUpperCase() : "BASIC");
            
            const vipBtn = document.getElementById("btn-vip-action");
            const vipSubText = document.getElementById("vipSubText");
            const vipAlert = document.getElementById("vipPackageAlert");

            if (planName === "vip") {
                if (vipBtn) vipBtn.style.display = "none";
                if (vipSubText) vipSubText.innerText = "Enjoying VIP Benefits ✨"; 
                
                if (patient.vip_package_status === "pending") {
                    if (vipAlert) vipAlert.style.display = "block";
                } else {
                    if (vipAlert) vipAlert.style.display = "none";
                }
            } else {
                if (vipBtn) vipBtn.style.display = "block";
                if (vipSubText) vipSubText.innerText = "Upgrade for free home collection";
                if (vipAlert) vipAlert.style.display = "none";
            }
            
            // Extra Details & Banner Logic
            const banner = document.getElementById("profileBanner");
            const profileImages = document.querySelectorAll(".profile-img");
            const editPreview = document.getElementById("editProfilePreview");

            if (patient.extra_details) {
                if (banner) banner.style.display = "none";
                
                // Form Pre-fill
                safeSetValue("infoEmail", patient.extra_details.email);
                safeSetValue("infoAddress", patient.extra_details.address);
                safeSetValue("infoCity", patient.extra_details.city);
                safeSetValue("infoDistrict", patient.extra_details.district);
                safeSetValue("infoState", patient.extra_details.state);
                safeSetValue("infoPincode", patient.extra_details.pincode);
                
                // Load saved image if exists
                if (patient.extra_details.image && patient.extra_details.image.length > 50) {
                    profileImages.forEach(img => img.src = patient.extra_details.image);
                    if(editPreview) editPreview.src = patient.extra_details.image;
                    safeSetValue("infoImageBase64", patient.extra_details.image);
                }
            } else {
                if (banner) banner.style.display = "block"; 
            }

        } else {
            alert("Error: " + result.message);
            if(result.message === "Your account is blocked by Admin.") logoutDashboard();
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Failed to load profile data. Check your internet connection.");
    }
}

function safeSetText(id, text) { const el = document.getElementById(id); if(el) el.innerText = text; }
function safeSetValue(id, val) { const el = document.getElementById(id); if(el && val) el.value = val; }

// ==========================================
// 2. UI TABS & NAVIGATION
// ==========================================
function switchTab(tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
    
    const links = document.querySelectorAll(".nav-item, .nav-links a");
    links.forEach(link => link.classList.remove("active"));
    
    const selectedTab = document.getElementById(tabId);
    if(selectedTab) selectedTab.classList.add("active");
    
    if(typeof event !== 'undefined' && event && event.currentTarget) {
        event.currentTarget.classList.add("active");
    } else {
        const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
        if(activeNav) activeNav.classList.add("active");
    }
}

function logoutDashboard() {
    localStorage.clear();
    window.location.href = "../index.html";
}

function copyMyReferral() {
    const code = document.getElementById("refCode").innerText;
    if (code && code !== "-----") {
        navigator.clipboard.writeText(code);
        alert("Referral Code '" + code + "' copied!");
    }
}

// ==========================================
// 3. IMAGE COMPRESSION & SAVE PROFILE
// ==========================================
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
                const MAX_WIDTH = 200; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
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
    btn.innerText = "Saving Please Wait...";
    btn.disabled = true;
    
    const payload = {
        action: "savePatientDetails",
        user_id: localStorage.getItem("bhavya_user_id"),
        email: document.getElementById("infoEmail").value,
        address: document.getElementById("infoAddress").value,
        city: document.getElementById("infoCity").value,
        district: document.getElementById("infoDistrict").value,
        state: document.getElementById("infoState").value,
        pincode: document.getElementById("infoPincode").value,
        image: document.getElementById("infoImageBase64").value
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === "success") {
            alert("Profile Details Saved Successfully!");
            checkLoginAndFetchData(); 
            switchTab('overview'); 
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Failed to save. Check your connection.");
    } finally {
        btn.innerText = "Save & Update Profile";
        btn.disabled = false;
    }
}
