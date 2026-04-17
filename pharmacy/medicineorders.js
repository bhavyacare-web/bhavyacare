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

    // ✨ GENERATE 30-MIN TIME SLOTS IN DROPDOWN ✨
    generateTimeSlots();

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

// ✨ FUNCTION: GENERATE 30-MIN SLOTS ✨
function generateTimeSlots() {
    const timeSelect = document.getElementById("orderTime");
    for (let h = 0; h < 24; h++) {
        for (let m of ['00', '30']) {
            let hourStr = h.toString().padStart(2, '0');
            let timeVal = `${hourStr}:${m}`; // For backend value (HH:mm)
            
            let ampm = h >= 12 ? 'PM' : 'AM';
            let displayH = h % 12 || 12;
            let displayTime = `${displayH}:${m} ${ampm}`; // For user UI
            
            timeSelect.innerHTML += `<option value="${timeVal}">${displayTime}</option>`;
        }
    }
}

// POSTAL API FOR CITIES
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
                citySelect.innerHTML += `<option value="other">Other (Type Manually)</option>`;
            } else { citySelect.innerHTML = `<option value="">Invalid Pincode</option>`; }
        }).catch(() => { citySelect.innerHTML = `<option value="">Error fetching areas</option>`; });
    } else {
        citySelect.innerHTML = `<option value="">Please enter a valid 6-digit pincode...</option>`;
    }
}

function toggleManualCity() {
    const citySelect = document.getElementById("citySelect").value;
    const manualInput = document.getElementById("manualCity");
    if (citySelect === "other") {
        manualInput.style.display = "block"; manualInput.required = true;
    } else {
        manualInput.style.display = "none"; manualInput.required = false; manualInput.value = "";
    }
}

// NEXT DATE CALCULATOR HELPER
function getNextDateForDay(dayAbbr, openTime) {
    const dayMap = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
    const targetDay = dayMap[dayAbbr];
    let d = new Date(); 
    
    for(let i=0; i<=7; i++) {
        let tempDate = new Date();
        tempDate.setDate(d.getDate() + i);
        if(tempDate.getDay() === targetDay) {
            if(i === 0) {
                let nowHour = d.getHours();
                let nowMin = d.getMinutes();
                let [openH, openM] = openTime.split(':').map(Number);
                if(nowHour > openH || (nowHour === openH && nowMin >= openM)) {
                    continue; 
                }
            }
            let month = '' + (tempDate.getMonth() + 1), day = '' + tempDate.getDate(), year = tempDate.getFullYear();
            if (month.length < 2) month = '0' + month;
            if (day.length < 2) day = '0' + day;
            return [year, month, day].join('-');
        }
    }
}

// ✨ UPDATED: AUTO-FILL WITH DROPDOWN CHECK ✨
function autoFillDateTime(dateStr, timeStr) {
    document.getElementById('orderDate').value = dateStr;
    
    // Check if the time slot exists in dropdown, if not, add it dynamically
    let timeSelect = document.getElementById('orderTime');
    let optionExists = Array.from(timeSelect.options).some(opt => opt.value === timeStr);
    
    if (!optionExists) {
        let [h, m] = timeStr.split(':');
        let ampm = h >= 12 ? 'PM' : 'AM';
        let displayH = h % 12 || 12;
        let newOption = new Option(`${displayH}:${m} ${ampm} (Opening)`, timeStr);
        timeSelect.add(newOption);
    }
    
    timeSelect.value = timeStr;
    
    const btnSearch = document.getElementById('btnSearch');
    btnSearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btnSearch.click();
}

// SEARCH PHARMACIES 
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
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkPharmacyAvailability", pincode: pin, city: city, date: date, time: time })
        });
        const data = await res.json();

        resultsDiv.innerHTML = "";
        
        if (data.status === "success") {
            if (data.data.openOnes.length > 0) {
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
                resultsDiv.innerHTML = `<p style="font-weight:700; color:#dc2626; margin-bottom:10px;">Sorry, no pharmacy is open at your selected time. Select any available slot below to auto-book:</p>`;
                
                data.data.closedOnes.forEach(p => {
                    let schedHtml = `<div style="margin-top:8px;">`;
                    Object.entries(p.fullSchedule).forEach(([day, times]) => {
                        if(times.open && times.close && times.open !== "" && times.open !== "undefined") {
                            let nextDate = getNextDateForDay(day, times.open);
                            if (nextDate) {
                                schedHtml += `<span class="time-badge" onclick="autoFillDateTime('${nextDate}', '${times.open}')" title="Click to auto-select and search">
                                    <i class="far fa-calendar-check"></i> ${day} at ${formatAMPM(times.open)}
                                </span>`;
                            }
                        }
                    });
                    schedHtml += `</div>`;

                    resultsDiv.innerHTML += `
                        <div class="pharma-option" style="cursor:default; background:#fff1f2;">
                            <span class="pharma-name">${p.name} (Currently Closed)</span>
                            <p style="font-size:12px; color:#475569; margin:5px 0;">Click below to change your Date & Time automatically:</p>
                            ${schedHtml}
                        </div>`;
                });
                resultsDiv.innerHTML += `<p style="font-size:13px; text-align:center; color:#64748b; margin-top:10px;">If you do not want to change time, you can Cancel the order.</p>`;
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

// UPLOAD & SUBMIT ORDER 
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
        const orderType = document.getElementById("orderType").value;
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
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
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
