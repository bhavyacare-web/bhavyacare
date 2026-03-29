// 🌟 YAHAN APNA WAHI GOOGLE SCRIPT URL DAALO JO ABHI USE KAR RAHE HO 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8cnaQLCDP6OaZ2vOyl9Oy8HWICc9nigQChCSpMpAeUOwJ4xijq5L1iPX1CJhPAo4W0w/exec";

document.addEventListener("DOMContentLoaded", checkLoginAndFetchData);

async function checkLoginAndFetchData() {
    // Check karo ki local storage me user ID hai ya nahi
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId) {
        // Agar login nahi hai, toh main page par wapas bhej do
        alert("Please login first to access the dashboard.");
        window.location.href = "../index.html"; 
        return;
    }

    // Backend se data mangwao
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
            
            // HTML me data daalo
            document.getElementById("displayName").innerText = "Welcome, " + patient.patient_name;
            document.getElementById("displayMobile").innerText = patient.mobile_number;
            document.getElementById("displayUserId").innerText = patient.user_id;
            document.getElementById("displayReferral").innerText = patient.referral_code;
            document.getElementById("displayWallet").innerText = "₹" + patient.wallet;
            document.getElementById("displayPlan").innerText = "Plan: " + patient.plan.toUpperCase();

            // Loader chupao aur dashboard dikhao
            document.getElementById("loader").style.display = "none";
            document.getElementById("dashboard-content").style.display = "block";
            
        } else {
            // Agar Admin ne block kar diya hai
            document.getElementById("loader").innerHTML = "❌ " + result.message;
            document.getElementById("loader").style.color = "red";
            if(result.message === "Your account is blocked by Admin.") {
                setTimeout(logoutPatient, 3000); // 3 second baad automatic logout
            }
        }
    } catch (error) {
        document.getElementById("loader").innerHTML = "❌ Network Error! Please try again later.";
        document.getElementById("loader").style.color = "red";
    }
}

// Referral code copy karne ka function
function copyReferral() {
    const code = document.getElementById("displayReferral").innerText;
    if (code !== "---") {
        navigator.clipboard.writeText(code);
        alert("Referral Code '" + code + "' copied to clipboard!");
    }
}

// Logout karne ka function
function logoutPatient() {
    localStorage.clear(); // Saara data delete kar do
    window.location.href = "../index.html"; // Main page par bhej do
}
