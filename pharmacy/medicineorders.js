const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";
let selectedPharmaId = "";

// 1. LIVE LOCATION LOGIC
function getLiveLocation() {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    
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
                fetchCities(pin, city);
                btn.innerHTML = `<i class="fas fa-check"></i> Location Detected`;
            }
        });
    }, () => { alert("Location access denied."); btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Detect My Live Location`; });
}

// 2. SEARCH PHARMACIES
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
            body: JSON.stringify({ action: "checkPharmacyAvailability", pincode: pin, city: city, date: date, time: time })
        });
        const data = await res.json();

        resultsDiv.innerHTML = "";
        
        if (data.data.openOnes.length > 0) {
            // CASE: Available Pharmacies Found
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
            // CASE: Area has pharmacies but they are closed at this time
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
    } catch(e) { alert("Network Error"); }
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
    
    // Auto fill address base
    const city = document.getElementById("citySelect").value;
    document.getElementById("patientAddress").value = `City: ${city}, Pincode: ${document.getElementById("pincode").value}\nAddress: `;
}

// Standard helper for 12hr format
function formatAMPM(t) {
    if(!t) return "Closed";
    let [h, m] = t.split(":");
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// --- Rest of logic (SubmitOrder, fetchCities, toggleManualCity) same as previous code ---
