// ==========================================
// Lab.js - Lab Dashboard Authentication & Logic
// ==========================================

document.addEventListener("DOMContentLoaded", function() {
    checkLabAuth();
    loadLabProfile();
});

// 1. Verify if the logged-in user is actually a Lab
function checkLabAuth() {
    const role = localStorage.getItem("bhavya_role");
    const uid = localStorage.getItem("bhavya_uid");

    if (!uid || role !== "lab") {
        alert("Unauthorized Access! Please login as a Lab Partner.");
        // Agar aapke main page ka naam index.html hai toh waha redirect karein
        window.location.href = "../index.html"; 
    }
}

// 2. Load Lab Data onto the Dashboard
function loadLabProfile() {
    const labName = localStorage.getItem("bhavya_name") || "Lab Partner";
    const labId = localStorage.getItem("bhavya_user_id") || "N/A"; // Example: APO1234 (Apollo Lab)

    // Update the UI
    document.getElementById("displayLabName").innerText = labName;
    document.getElementById("displayLabId").innerText = "Lab ID: " + labId;
}

// 3. Logout Logic
function labLogout() {
    if (confirm("Are you sure you want to logout?")) {
        // Clear local storage
        localStorage.clear();
        
        // Agar firebase initialize hai toh usse bhi signout karo (optional but recommended)
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().signOut().then(() => {
                    window.location.href = "../index.html";
                });
            } else {
                window.location.href = "../index.html";
            }
        } catch (e) {
            window.location.href = "../index.html";
        }
    }
}
