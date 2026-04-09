// ==========================================
// lab_profile.js
// Logic for editing profile and requesting services
// ==========================================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

const servicesList = [
    "pathology", "profile", "discount_profile", "usg", "xray", "ct", "mri", 
    "ecg", "echo", "tmt", "eeg", "pft", "holter", "abp", "ncv_emg", "ssep", 
    "evoked_potentiat", "sleep_study", "mammography", "dlco", "endoscopy", "colonoscopy"
];
const daysArr = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

let currentProfile = null;

document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId || localStorage.getItem("bhavya_role") !== "lab") {
        alert("Unauthorized Access!"); 
        window.location.href = "../index.html"; 
        return;
    }
    
    document.getElementById("user_id").value = userId;
    fetchProfileData(userId);

    // Live Tag Generators
    document.getElementById("available_pincode").addEventListener("input", function() { drawTags("pinTags", this.value); });
    document.getElementById("available_city").addEventListener("input", function() { drawTags("cityTags", this.value); });
});

function drawTags(containerId, valueStr) {
    let arr = valueStr.split(",").map(s => s.trim()).filter(s => s !== "");
    let html = "";
    arr.forEach(item => { html += `<div class="tag">${item}</div>`; });
    document.getElementById(containerId).innerHTML = html;
}

function fetchProfileData(userId) {
    fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "getLabProfileData", user_id: userId }) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            currentProfile = data.data;
            populateForm();
        } else { 
            alert("Error loading profile: " + data.message); 
        }
    }).catch(err => alert("Network Error while fetching profile!"));
}

function populateForm() {
    let p = currentProfile;
    document.getElementById("lab_name").value = p.lab_name;
    document.getElementById("lab_email").value = p.email;
    document.getElementById("lab_address").value = p.address;
    document.getElementById("city").value = p.city;
    document.getElementById("pincode").value = p.pincode;
    
    // Load Arrays safely
    let pinStr = ""; 
    try { pinStr = JSON.parse(p.available_pincode).join(", "); } catch(e) { pinStr = p.available_pincode; }
    document.getElementById("available_pincode").value = pinStr;
    drawTags("pinTags", pinStr);

    document.getElementById("available_city").value = p.available_city || "";
    drawTags("cityTags", p.available_city || "");

    document.getElementById("nabl").value = p.nabl;
    document.getElementById("nabh").value = p.nabh;
    
    let statSel = document.getElementById("status");
    if(p.status === "Cancel") {
        statSel.innerHTML = `<option value="Cancel">Cancelled by Admin</option>`; 
        statSel.disabled = true;
    } else {
        statSel.value = p.status === "Active" ? "Active" : "Inactive";
    }

    // Populate Timings
    let timeContainer = document.getElementById("timingsContainer");
    timeContainer.innerHTML = "";
    daysArr.forEach(day => {
        let dName = day.charAt(0).toUpperCase() + day.slice(1);
        let openVal = p.timings[day+"_open"] || "";
        let closeVal = p.timings[day+"_close"] || "";
        timeContainer.innerHTML += `
            <div class="timing-row">
                <div>${dName}</div>
                <input type="time" id="${day}_open" value="${openVal}">
                <input type="time" id="${day}_close" value="${closeVal}">
            </div>`;
    });

    // Populate Services Checkboxes
    let srvContainer = document.getElementById("servicesGrid");
    srvContainer.innerHTML = "";
    servicesList.forEach(srv => {
        let isChecked = p.services[srv] === "Yes" ? "checked" : "";
        let dName = srv.replace("_", " ").toUpperCase();
        srvContainer.innerHTML += `<label><input type="checkbox" id="srv_${srv}" ${isChecked}> ${dName}</label>`;
    });
}

function getBase64(fileId) {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById(fileId);
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) { resolve(""); return; }
        const file = fileInput.files[0]; 
        const reader = new FileReader();
        reader.readAsDataURL(file); 
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// 1. SAVE BASIC PROFILE
// ==========================================
async function saveBasicProfile() {
    const btn = document.getElementById("btnUpdateProfile");
    btn.innerText = "Saving Profile..."; 
    btn.disabled = true;

    try {
        let payload = {
            action: "updateLabProfileData",
            user_id: document.getElementById("user_id").value,
            lab_name: document.getElementById("lab_name").value,
            lab_email: document.getElementById("lab_email").value,
            lab_address: document.getElementById("lab_address").value,
            city: document.getElementById("city").value,
            pincode: document.getElementById("pincode").value,
            available_pincode: JSON.stringify(document.getElementById("available_pincode").value.split(",").map(s=>s.trim()).filter(s=>s!=="")),
            available_city: document.getElementById("available_city").value,
            nabl: document.getElementById("nabl").value,
            nabh: document.getElementById("nabh").value,
            status: document.getElementById("status").value,
            timings: {}
        };

        daysArr.forEach(day => {
            payload.timings[day+"_open"] = document.getElementById(day+"_open").value;
            payload.timings[day+"_close"] = document.getElementById(day+"_close").value;
        });

        payload.nabl_certificate = await getBase64("nabl_cert");
        payload.nabh_certificate = await getBase64("nabh_cert");
        payload.lab_image1 = await getBase64("lab_img1");
        payload.lab_image2 = await getBase64("lab_img2");
        payload.lab_image3 = ""; 

        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            btn.innerText = "Update Profile Details"; 
            btn.disabled = false;
        }).catch(e => { 
            alert("Error while updating profile!"); 
            btn.disabled = false; 
        });

    } catch(e) { 
        alert("File processing error"); 
        btn.disabled = false; 
    }
}

// ==========================================
// 2. REQUEST STANDARD SERVICE CHANGE
// ==========================================
function requestServiceChange() {
    const btn = document.getElementById("btnRequestService");
    btn.innerText = "Sending Request..."; 
    btn.disabled = true;

    let reqObj = {};
    servicesList.forEach(srv => {
        reqObj[srv] = document.getElementById("srv_" + srv).checked ? "Yes" : "No";
    });

    let payload = {
        action: "requestServiceUpdate",
        user_id: document.getElementById("user_id").value,
        requested_services: reqObj
    };

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        btn.innerText = "Request Services Update"; 
        btn.disabled = false;
    }).catch(e => { 
        alert("Error sending service request!"); 
        btn.disabled = false; 
    });
}

// ==========================================
// 3. SUBMIT NEW CUSTOM SERVICE REQUEST
// ==========================================
function submitCustomRequest() {
    let sName = document.getElementById("custom_service_name").value.trim();
    let sPrice = document.getElementById("custom_expected_price").value.trim();

    if(!sName || !sPrice) return alert("Please enter both Service Name and Expected Price.");

    const btn = document.getElementById("btnCustomReq");
    btn.innerText = "Submitting..."; 
    btn.disabled = true;

    let payload = {
        action: "submitCustomServiceRequest",
        user_id: document.getElementById("user_id").value,
        lab_name: document.getElementById("lab_name").value,
        service_name: sName,
        expected_price: sPrice
    };

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        // Clear input boxes after successful submission
        document.getElementById("custom_service_name").value = "";
        document.getElementById("custom_expected_price").value = "";
        
        btn.innerText = "Submit Custom Request"; 
        btn.disabled = false;
    }).catch(e => { 
        alert("Error sending custom service request!"); 
        btn.disabled = false; 
    });
}
