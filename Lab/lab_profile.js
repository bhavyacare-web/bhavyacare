const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

const servicesList = [
    "pathology", "profile", "discount_profile", "usg", "xray", "ct", "mri", 
    "ecg", "echo", "tmt", "eeg", "pft", "holter", "abp", "ncv_emg", "ssep", 
    "evoked_potentiat", "sleep_study", "mammography", "dlco", "endoscopy", "colonoscopy"
];
const daysArr = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

let currentProfile = null;

// 🌟 NAYA: GLOBAL TAG LISTS 🌟
let pincodeList = [];
let cityList = [];

document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId || localStorage.getItem("bhavya_role") !== "lab") {
        alert("Unauthorized Access!"); 
        window.location.href = "../index.html"; 
        return;
    }
    
    document.getElementById("user_id").value = userId;
    fetchProfileData(userId);

    // Enter Key Support for Tags
    document.getElementById("pincodeInput").addEventListener("keypress", function(e) { if (e.key === "Enter") { e.preventDefault(); addTag('pincode'); } });
    document.getElementById("cityInput").addEventListener("keypress", function(e) { if (e.key === "Enter") { e.preventDefault(); addTag('city'); } });
});

// 🌟 NAYA: TAG SYSTEM FUNCTIONS 🌟
function addTag(type) {
    let inputElem = document.getElementById(type + "Input");
    let val = inputElem.value.trim();
    if (!val) return;

    if (type === 'pincode' && !pincodeList.includes(val)) {
        pincodeList.push(val); updateTagsUI('pincode');
    } else if (type === 'city') {
        val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        let lowerCaseCityList = cityList.map(c => c.toLowerCase());
        if (!lowerCaseCityList.includes(val.toLowerCase())) { cityList.push(val); updateTagsUI('city'); }
    }
    inputElem.value = ""; 
}

function removeTag(type, index) {
    if (type === 'pincode') pincodeList.splice(index, 1); else cityList.splice(index, 1);
    updateTagsUI(type);
}

function updateTagsUI(type) {
    // 🌟 FIX: Pincode ke liye sahi HTML ID 'pinTags' use karna hai
    let wrapperId = (type === 'pincode') ? 'pinTags' : 'cityTags';
    let wrapper = document.getElementById(wrapperId);
    let hiddenInput = document.getElementById("available_" + type);
    let list = type === 'pincode' ? pincodeList : cityList;
    
    // Safety check taaki aage kabhi crash na ho
    if (!wrapper) return; 

    wrapper.innerHTML = "";
    list.forEach((item, index) => {
        let tag = document.createElement("div");
        tag.className = "tag";
        tag.innerHTML = `${item} <span onclick="removeTag('${type}', ${index})" title="Remove">×</span>`;
        wrapper.appendChild(tag);
    });
    
    if (hiddenInput) {
        hiddenInput.value = list.join(',');
    }
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
    }).catch(err => {
        console.error("Fetch Error Detail: ", err); 
        alert("Client Error: Data load failed midway. Check Console (F12) for details.");
    });
}

function populateForm() {
    let p = currentProfile;
    document.getElementById("lab_name").value = p.lab_name;
    document.getElementById("lab_email").value = p.email;
    document.getElementById("lab_address").value = p.address;
    document.getElementById("city").value = p.city;
    document.getElementById("pincode").value = p.pincode;
    
    // Load Arrays safely into Tag System
    try { 
        let parsedPins = JSON.parse(p.available_pincode);
        pincodeList = Array.isArray(parsedPins) ? parsedPins : p.available_pincode.split(",").map(s => s.trim());
    } catch(e) { pincodeList = (p.available_pincode || "").split(",").map(s => s.trim()).filter(s => s !== ""); }
    updateTagsUI('pincode');

    if (p.available_city) {
        cityList = p.available_city.split(",").map(s => s.trim()).filter(s => s !== "");
    }
    updateTagsUI('city');

    document.getElementById("nabl").value = p.nabl;
    document.getElementById("nabh").value = p.nabh;
    
    let statSel = document.getElementById("status");
    if(p.status === "Cancel") {
        statSel.innerHTML = `<option value="Cancel">Cancelled by Admin</option>`; 
        statSel.disabled = true;
    } else {
        statSel.value = p.status === "Active" ? "Active" : "Inactive";
    }

    // 🌟 IMAGE PREVIEWS 🌟
    if(p.nabl_url) document.getElementById("preview_nabl").innerHTML = `<div class="image-preview-box"><i class="fas fa-check-circle" style="color:green;"></i> <a href="${p.nabl_url}" target="_blank">View Uploaded Doc</a></div>`;
    if(p.nabh_url) document.getElementById("preview_nabh").innerHTML = `<div class="image-preview-box"><i class="fas fa-check-circle" style="color:green;"></i> <a href="${p.nabh_url}" target="_blank">View Uploaded Doc</a></div>`;
    if(p.img1_url) document.getElementById("preview_img1").innerHTML = `<div class="image-preview-box"><img src="${p.img1_url}"> <a href="${p.img1_url}" target="_blank">View Image</a></div>`;
    if(p.img2_url) document.getElementById("preview_img2").innerHTML = `<div class="image-preview-box"><img src="${p.img2_url}"> <a href="${p.img2_url}" target="_blank">View Image</a></div>`;

    // 🌟 FIX: POPULATE TIMINGS PROPERLY (No Crash Here Now) 🌟
    let timeContainer = document.getElementById("timingsContainer");
    timeContainer.innerHTML = "";
    daysArr.forEach(day => {
        let dName = day.charAt(0).toUpperCase() + day.slice(1);
        
        let openVal = ""; let closeVal = "";
        if (p.timings) {
            let oKey = day + "_open";
            let cKey = day + "_close";
            openVal = (p.timings[oKey] && p.timings[oKey] !== "Closed") ? p.timings[oKey] : "";
            closeVal = (p.timings[cKey] && p.timings[cKey] !== "Closed") ? p.timings[cKey] : "";
        }
        
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
            available_pincode: JSON.stringify(pincodeList), 
            available_city: cityList.join(", "),            
            nabl: document.getElementById("nabl").value,
            nabh: document.getElementById("nabh").value,
            status: document.getElementById("status").value,
            timings: {}
        };

        daysArr.forEach(day => {
            payload.timings[day+"_open"] = document.getElementById(day+"_open").value || "Closed";
            payload.timings[day+"_close"] = document.getElementById(day+"_close").value || "Closed";
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
