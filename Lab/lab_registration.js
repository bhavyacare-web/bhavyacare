// ==========================================
// lab_registration.js - Handle Form Data
// ==========================================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

// Services List (As per your requirement)
const services = [
    "pathology", "profile", "discount_profile", "usg", "xray", "ct", "mri", 
    "ecg", "echo", "tmt", "eeg", "pft", "holter", "abp", "ncv_emg", "ssep", 
    "evoked_potentiat", "sleep_study", "mammography", "dlco", "endoscopy", "colonoscopy"
];

// Days List for Timings
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check Access & Auto Fill Name
    const labName = localStorage.getItem("bhavya_name");
    const userId = localStorage.getItem("bhavya_user_id");
    
    // UPDATE: Agar login nahi hai, toh bahar wale main folder ke index.html par bhejein
    if (!userId || localStorage.getItem("bhavya_role") !== "lab") {
        alert("Unauthorized Access! Please login first."); 
        window.location.href = "../index.html"; 
        return;
    }
    document.getElementById("lab_name").value = labName;

    // 2. Generate Service Checkboxes Dynamically
    const servDiv = document.getElementById("servicesContainer");
    services.forEach(srv => {
        // Formatting name to look clean (e.g., "discount_profile" -> "DISCOUNT PROFILE")
        let displayName = srv.replace("_", " ").toUpperCase();
        servDiv.innerHTML += `<label><input type="checkbox" id="srv_${srv}"> ${displayName}</label>`;
    });

    // 3. Generate Timings Dynamically
    const timeDiv = document.getElementById("timingsContainer");
    days.forEach(day => {
        timeDiv.innerHTML += `
        <div class="grid-2" style="margin-bottom:10px;">
            <div><label>${day.toUpperCase()} Open</label><input type="time" id="${day}_open" required></div>
            <div><label>${day.toUpperCase()} Close</label><input type="time" id="${day}_close" required></div>
        </div>`;
    });

    // 4. Form Submit Listener
    document.getElementById("labRegForm").addEventListener("submit", handleFormSubmit);
});

// Toggle NABL/NABH file input based on Yes/No selection
function toggleCert(type) {
    const val = document.getElementById(type).value;
    const fileInput = document.getElementById(type + "_cert");
    if (val === "Yes") { 
        fileInput.style.display = "block"; 
        fileInput.required = true; 
    } else { 
        fileInput.style.display = "none"; 
        fileInput.required = false; 
    }
}

// Convert File to Base64 String (for sending to Google Script)
function getBase64(fileId) {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById(fileId);
        // Agar file input exist nahi karta ya file select nahi ki gayi
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) { 
            resolve(""); 
            return; 
        }
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Extract only base64 data
        reader.onerror = error => reject(error);
    });
}

// Handle Form Submission
async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    btn.innerText = "Uploading Documents & Saving... Please wait (Do not close)";
    btn.disabled = true;

    try {
        // --- 1. Process Array & String fields ---
        // Pincode formatting: Input "124507, 124508" -> JSON String '["124507", "124508"]'
        let pinRaw = document.getElementById("available_pincode").value.split(',');
        let pinArray = pinRaw.map(p => p.trim()).filter(p => p !== "");
        let available_pincodes_json = JSON.stringify(pinArray);

        // City formatting: Input "Bahadurgarh, Jhajjar" -> "Bahadurgarh, Jhajjar"
        let cityRaw = document.getElementById("available_city").value.split(',');
        let available_cities_str = cityRaw.map(c => c.trim()).join(', ');

        // --- 2. Convert Files to Base64 ---
        let base64RegDoc = await getBase64("reg_doc");
        let base64Nabl = await getBase64("nabl_cert");
        let base64Nabh = await getBase64("nabh_cert");
        let base64Img1 = await getBase64("lab_img1");
        let base64Img2 = await getBase64("lab_img2");
        let base64Img3 = await getBase64("lab_img3");

        // --- 3. Build JSON Payload ---
        let payload = {
            action: "submitLabProfile",
            user_id: localStorage.getItem("bhavya_user_id"),
            lab_name: document.getElementById("lab_name").value,
            lab_registration_docoment: base64RegDoc,
            lab_email: document.getElementById("lab_email").value,
            lab_address: document.getElementById("lab_address").value,
            city: document.getElementById("city").value,
            pincode: document.getElementById("pincode").value,
            available_pincode: available_pincodes_json,
            nabl: document.getElementById("nabl").value,
            nabl_certificate: base64Nabl,
            nabh: document.getElementById("nabh").value,
            nabh_certificate: base64Nabh,
            lab_image1: base64Img1,
            lab_image2: base64Img2,
            lab_image3: base64Img3,
            available_city: available_cities_str
        };

        // Add Services (Yes/No)
        services.forEach(srv => {
            let checkbox = document.getElementById("srv_" + srv);
            payload[srv] = (checkbox && checkbox.checked) ? "Yes" : "No";
        });

        // Add Timings
        days.forEach(day => {
            payload[day + "_opening_time"] = document.getElementById(day + "_open").value;
            payload[day + "_closing_time"] = document.getElementById(day + "_close").value;
        });

        // --- 4. Send to Google Apps Script ---
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();

        if (resData.status === "success") {
            alert("Success! Profile submitted successfully. Our admin will review and activate your account.");
            
            // UPDATE: Dono files same 'lab' folder me hain, toh path change nahi hoga.
            window.location.href = "lab.html"; 
        } else {
            alert("Error: " + resData.message);
            btn.innerText = "Submit Profile for Verification";
            btn.disabled = false;
        }

    } catch (error) {
        console.error("Submission Error:", error);
        alert("An error occurred while submitting. Please ensure file sizes are small and try again.");
        btn.innerText = "Submit Profile for Verification";
        btn.disabled = false;
    }
}
