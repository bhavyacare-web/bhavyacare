// 🌟 YAHAN APNA GOOGLE SCRIPT URL DAALO 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8cnaQLCDP6OaZ2vOyl9Oy8HWICc9nigQChCSpMpAeUOwJ4xijq5L1iPX1CJhPAo4W0w/exec";

// ==========================================
// 1. PAGE LOAD HOTE HI DATA FETCH KARNA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    checkLoginAndFetchData();
});

async function checkLoginAndFetchData() {
    const userId = localStorage.getItem("bhavya_user_id");
    
    // Agar user logged in nahi hai toh wapas home page par bhej do
    if (!userId) {
        alert("Please login first to access the dashboard.");
        window.location.href = "../index.html"; 
        return;
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                action: "getPatientProfile", 
                user_id: userId 
            }) 
        });

        const result = await response.json();

        if (result.status === "success") {
            const patient = result.data;
            
            // 🌟 YAHAN IDS FIX KI GAYI HAIN 🌟
            
            // 1. Mobile me naam set karna
            const mobileName = document.getElementById("userNameMobile");
            if (mobileName) mobileName.innerText = patient.patient_name;
            
            // 2. Desktop/Laptop me naam set karna
            const desktopName = document.getElementById("userNameDesktop");
            if (desktopName) desktopName.innerText = patient.patient_name;

            // 3. User ID set karna
            const userIdDisp = document.getElementById("userIdDisplay");
            if (userIdDisp) userIdDisp.innerText = "ID: " + patient.user_id;

            // 4. Wallet Balance set karna
            const walletDisplay = document.getElementById("walletBal");
            if (walletDisplay) walletDisplay.innerText = patient.wallet;

            // 5. Referral Code set karna
            const refDisplay = document.getElementById("refCode");
            if (refDisplay) refDisplay.innerText = patient.referral_code;
            
            // 6. VIP/Plan Status set karna
            const vipDisplay = document.getElementById("vipStatus");
            if (vipDisplay) vipDisplay.innerText = patient.plan.toUpperCase();
            
            // 7. VIP Modal me pehla member (Self) apne aap set karna
            const vipMem1 = document.getElementById("vipMem1");
            if (vipMem1) vipMem1.value = patient.patient_name;

        } else {
            alert("Error: " + result.message);
            if(result.message === "Your account is blocked by Admin.") {
                logoutDashboard();
            }
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Failed to load profile data. Check your internet connection.");
    }
}

// ==========================================
// 2. UI & NAVIGATION LOGIC (TABS & SIDEBAR)
// ==========================================
function switchTab(tabId) {
    // Sabhi tabs ko hide karo
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].classList.remove("active");
    }
    
    // Sabhi links se active class hatao (Bottom Nav aur Sidebar dono ke liye)
    const links = document.querySelectorAll(".nav-item, .nav-links a");
    links.forEach(link => link.classList.remove("active"));
    
    // Jo tab click kiya hai use show karo
    const selectedTab = document.getElementById(tabId);
    if(selectedTab) selectedTab.classList.add("active");
    
    if(event && event.currentTarget) {
        event.currentTarget.classList.add("active");
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    if(sidebar) sidebar.classList.toggle("show");
}

function logoutDashboard() {
    localStorage.clear();
    window.location.href = "../index.html";
}

// ==========================================
// 3. REFERRAL & WALLET LOGIC
// ==========================================
function copyMyReferral() {
    const code = document.getElementById("refCode").innerText;
    if (code && code !== "-----") {
        navigator.clipboard.writeText(code);
        alert("Referral Code '" + code + "' copied! Share it with your friends.");
    }
}

function requestWithdraw() {
    alert("Add Money / Withdraw feature will be integrated soon!");
}

// ==========================================
// 4. VIP MODAL LOGIC
// ==========================================
function openVIPModal() {
    const modal = document.getElementById('vip-upgrade-modal');
    if(modal) modal.style.display = 'block';
}

function togglePaymentSection() {
    const isOnline = document.querySelector('input[name="payMode"][value="Online"]').checked;
    const onlineSection = document.getElementById('onlinePaymentSection');
    
    if (isOnline) {
        onlineSection.style.display = 'block';
    } else {
        onlineSection.style.display = 'none';
    }
}

function applyReferralDiscount() {
    const refInput = document.getElementById('vipRefCode').value.trim();
    const finalAmountSpan = document.getElementById('finalVipAmount');
    const refMsg = document.getElementById('refMsg');
    
    if (refInput.length >= 5) { // Basic validation
        finalAmountSpan.innerText = "2500"; // 500 discount
        refMsg.style.display = "block";
        refMsg.style.color = "green";
        refMsg.innerText = "Discount Applied Successfully!";
    } else {
        refMsg.style.display = "block";
        refMsg.style.color = "red";
        refMsg.innerText = "Invalid Referral Code";
        finalAmountSpan.innerText = "3000"; // Reset
    }
}

function submitVIPForm() {
    const btn = document.getElementById('btn-submit-vip');
    if(!btn) return;
    
    btn.innerText = "Processing...";
    
    setTimeout(() => {
        alert("VIP Request Submitted! Admin will verify your payment and activate the plan.");
        document.getElementById('vip-upgrade-modal').style.display = 'none';
        btn.innerText = "Pay & Upgrade Now";
    }, 1500);
}
