const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";
let selectedPharmaId = "";

document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        alert("Please login first!"); window.location.href = "../index.html"; return;
    }

    // Set Date min to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("orderDate").setAttribute('min', today);

    // Auto Fetch patient's saved pincode
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getPatientLocation", user_id: userId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success" && data.data.pincode) {
            document.getElementById("pincode").value = data.data.pincode;
            fetchCities(); 
        }
    }).catch(e => console.log("Auto-fill error:", e));

    document.getElementById("orderForm").addEventListener("submit", submitOrder);
});

// 1. LIVE LOCATION LOGIC
function getLiveLocation() {
    if (!navigator.geolocation) { alert("Geolocation not supported by your browser"); return; }
    
    const btn = document.querySelector(".btn-location");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Finding you...`;

    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
                const components = results[0].address_components;
                let pin = "", city = "";
                components.forEach(c => {
                    if (c.types.includes("postal_code")) pin = c.long_name;
                    if (c.types.includes("locality")) city = c.long_name;
                });
                document.getElementById("pincode").value = pin;
                fetchCities(); 
                btn.innerHTML = `<i class="fas fa-check"></i> Location Detected`;
            }
        });
    }, () => { 
        alert("Location access denied."); 
        btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Detect My Live Location`; 
    });
}

// 2. POSTAL API FOR CITIES
function fetchCities() {
    const pin = document.getElementById("pincode").value.trim();
    const citySelect = document.getElementById("citySelect");
    
    if (pin.length === 6) {
        citySelect.innerHTML = `<option value="">Fetching areas...</option>`;
        fetch(`https://api.postalpincode.in/pincode/${pin}`)
        .then(res => res.json())
        .then(data => {
            if (data[0] && data[0].Status === "Success") {
                citySelect.innerHTML = "";
                data[0].PostOffice.forEach(po => {
                    citySelect.innerHTML += `<option value="${po.Name}">${po.Name}</option>`;
                });
                // ADD "OTHER" OPTION
                citySelect.innerHTML += `<option value="other">Other (Type Manually)</option>`;
            } else { 
                citySelect.innerHTML = `<option value="">Invalid Pincode</option>`; 
            }
        }).catch(() => { citySelect.innerHTML = `<option value="">Error fetching areas</option>`; });
    } else {
        citySelect.innerHTML = `<option value="">Please enter a valid 6-digit pincode...</option>`;
    }
}

// SHOW/HIDE MANUAL CITY INPUT
function toggleManualCity() {
    const citySelect = document.getElementById("citySelect").value;
    const manualInput = document.getElementById("manualCity");
    if (citySelect === "other") {
        manualInput.style.display = "block";
        manualInput.required = true;
    } else {
        manualInput.style.display = "none";
        manualInput.required = false;
        manualInput.value = "";
    }
}

// 3. SEARCH PHARMACIES 
async function searchPharmacies() {
    const pin = document.getElementById("pincode").value;
    let city = document.getElementById("citySelect").value;
    if(city === "other") city = document.getElementById("manualCity").value;
    const date = document.getElementById("orderDate").value;
    const time = document.getElementById("orderTime").value;

    if(!pin || !city || !date || !time) { alert("Please fill all details!"); return; }

    const resultsDiv = document.getElementById("pharmaResults");
    resultsDiv.innerHTML = `<p style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Searching best pharmacies for you...</p>`;

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkPharmacyAvailability", pincode: pin, city: city, date: date, time: time })
        });
        const data = await res.json();

        resultsDiv.innerHTML = "";
        
        if (data.status === "success") {
            if (data.data.openOnes.length > 0) {
                // Available Pharmacies Found
                resultsDiv.innerHTML = `<p style="font-weight:700; color:#059669; margin-bottom:10px;">Available Pharmacies (Choose One):</p>`;
                data.data.openOnes.forEach(p => {
                    resultsDiv.innerHTML += `
                        <div class="pharma-option" onclick="selectPharma(this, '${p.id}')">
                            <span class="pharma-name">${p.name}</span>
                            <span class="pharma-time">Open Now: ${formatAMPM(p.timings.open)} to ${formatAMPM(p.timings.close)}</span>
                            <p style="font-size:12px; color:#64748b; margin:5px 0 0 0;">${p.address}</p>
                        </div>`;
                });
                resultsDiv.innerHTML += `<button class="btn btn-primary" style="margin-top:10px; background:#10b981;" onclick="goToForm()">Continue with Selection</button>`;
            } 
            else if (data.data.closedOnes.length > 0) {
                // Pharmacies are there but closed
                resultsDiv.innerHTML = `<p style="font-weight:700; color:#dc2626; margin-bottom:10px;">Sorry, no pharmacy is open at your selected time. Here are the timings:</p>`;
                data.data.closedOnes.forEach(p => {
                    let sched = Object.entries(p.fullSchedule).map(([d, t]) => `<b>${d}:</b> ${t}`).join(" | ");
                    resultsDiv.innerHTML += `
                        <div class="pharma-option" style="cursor:default; background:#fff1f2;">
                            <span class="pharma-name">${p.name} (CLOSED)</span>
                            <p style="font-size:11px; line-height:1.4;">${sched}</p>
                        </div>`;
                });
                resultsDiv.innerHTML += `<p style="font-size:13px; text-align:center;">Kripya timing ke anusaar apna time change karein ya order cancel karein.</p>`;
            } 
            else {
                resultsDiv.innerHTML = `<div class="error-msg" style="display:block;">This service is not available in your area yet.</div>`;
            }
        } else {
            resultsDiv.innerHTML = `<div class="error-msg" style="display:block;">${data.message}</div>`;
        }
    } catch(e) { alert("Network Error"); resultsDiv.innerHTML = ""; }
}

function selectPharma(elem, id) {
    document.querySelectorAll(".pharma-option").forEach(el => el.classList.remove("selected"));
    elem.classList.add("selected");
    selectedPharmaId = id;
}

function goToForm() {
    if(!selectedPharmaId) { alert("Please select a pharmacy first!"); return; }
    document.getElementById("step1-check").style.display = "none";
    document.getElementById("step2-form").style.display = "block";
    
    // Auto fill address
    let city = document.getElementById("citySelect").value;
    if(city === "other") city = document.getElementById("manualCity").value;
    
    document.getElementById("patientAddress").value = `City: ${city}, Pincode: ${document.getElementById("pincode").value}\nAddress: `;
}

function formatAMPM(t) {
    if(!t || t === "undefined") return "Closed";
    let [h, m] = t.split(":");
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// 4. UPLOAD & SUBMIT ORDER 
function getBase64(fileId) {
    return new Promise((resolve) => {
        const input = document.getElementById(fileId);
        if (!input || !input.files || input.files.length === 0) { resolve(""); return; }
        const reader = new FileReader(); reader.readAsDataURL(input.files[0]);
        reader.onload = () => resolve(reader.result.split(',')[1]);
    });
}

async function submitOrder(e) {
    e.preventDefault();
    
    const btn = document.getElementById("btnSubmit");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Request...`; btn.disabled = true;

    try {
        const orderType = document.querySelector('input[name="orderType"]:checked').value;
        const oDate = document.getElementById("orderDate").value;
        const oTime = document.getElementById("orderTime").value;

        const payload = {
            action: "submitMedicineOrder",
            user_id: localStorage.getItem("bhavya_user_id"),
            medicos_id: selectedPharmaId,
            order_type: orderType,
            delivery_date: `${oDate} ${formatAMPM(oTime)}`,
            patient_address: document.getElementById("patientAddress").value,
            medicine_details: document.getElementById("medicineDetails").value,
            prescription_base64: await getBase64("prescriptionFile")
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
            alert("Aapki request submit ho gai hai, kripya confirm hone ka wait kare.");
            window.location.href = "../patient_dashboard/patient_dashboard.html"; 
        } else {
            alert("Error: " + resData.message);
            btn.innerHTML = "Place Order"; btn.disabled = false;
        }
    } catch (error) {
        alert("Network error, please try again.");
        btn.innerHTML = "Place Order"; btn.disabled = false;
    }
}

function cancelOrder() {
    if(confirm("Are you sure you want to cancel this order?")) {
        window.location.href = "../patient_dashboard/patient_dashboard.html";
    }
}
