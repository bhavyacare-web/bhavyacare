const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let assignedMedicosId = "";
let pharmacyTimings = {};

document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        alert("Please login first!"); window.location.href = "../index.html"; return;
    }

    // Set minimum date to Today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("orderDate").setAttribute('min', today);

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

// === POSTAL API FOR CITIES ===
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
            } else { citySelect.innerHTML = `<option value="">Invalid Pincode</option>`; }
        }).catch(() => { citySelect.innerHTML = `<option value="">Error fetching areas</option>`; });
    } else {
        citySelect.innerHTML = `<option value="">Please enter a valid 6-digit pincode...</option>`;
    }
}

// === CHECK PHARMACY AVAILABILITY ===
function checkAvailability() {
    const pin = document.getElementById("pincode").value.trim();
    const city = document.getElementById("citySelect").value;
    const btn = document.getElementById("btnCheck");
    const errBox = document.getElementById("errorBox");

    if (pin.length !== 6 || !city) { alert("Please enter Pincode and select a City."); return; }

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Checking...`;
    btn.disabled = true; errBox.style.display = "none";

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "checkPharmacyAvailability", pincode: pin, city: city })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            assignedMedicosId = data.data.medicos_id;
            pharmacyTimings = data.data.timings; // Save timings for validation
            
            document.getElementById("locationSection").style.display = "none";
            document.getElementById("bookingSection").style.display = "block";
            
            // Allow user to edit address freely
            document.getElementById("patientAddress").value = `House No/Area: \nCity: ${city}\nPincode: ${pin}`;
        } else {
            errBox.innerText = data.message;
            errBox.style.display = "block";
            btn.innerHTML = "Check Service Availability"; btn.disabled = false;
        }
    }).catch(e => {
        errBox.innerText = "Network Error! Please try again."; errBox.style.display = "block";
        btn.innerHTML = "Check Service Availability"; btn.disabled = false;
    });
}

function formatAMPM(timeStr) {
    let [h, m] = timeStr.split(':');
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

// === UPLOAD & SUBMIT ORDER ===
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
    
    // ✨ TIMING VALIDATION ✨
    const oDate = document.getElementById("orderDate").value;
    const oTime = document.getElementById("orderTime").value;
    
    const selectedDay = new Date(oDate).getDay(); // 0 (Sun) to 6 (Sat)
    const dayTiming = pharmacyTimings[selectedDay];

    if (!dayTiming || !dayTiming.open || !dayTiming.close) {
        alert("Pharmacy is closed on this selected day. Please choose another date or Cancel Order.");
        return;
    }
    if (oTime < dayTiming.open || oTime > dayTiming.close) {
        alert(`Pharmacy is closed at this time.\nWorking hours for selected day: ${formatAMPM(dayTiming.open)} to ${formatAMPM(dayTiming.close)}.\nPlease change the time or Cancel Order.`);
        return;
    }

    const btn = document.getElementById("btnSubmit");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Request...`; btn.disabled = true;

    try {
        const orderType = document.querySelector('input[name="orderType"]:checked').value;
        const payload = {
            action: "submitMedicineOrder",
            user_id: localStorage.getItem("bhavya_user_id"),
            medicos_id: assignedMedicosId,
            order_type: orderType,
            delivery_date: `${oDate} ${formatAMPM(oTime)}`,
            patient_address: document.getElementById("patientAddress").value,
            medicine_details: document.getElementById("medicineDetails").value,
            prescription_base64: await getBase64("prescriptionFile")
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" }, // ✨ FIX NETWORK ERROR
            body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
            alert("Aapki request submit ho gai hai, kripya confirm hone ka wait kare.");
            window.location.href = "../patient_dashboard/patient_dashboard.html"; 
        } else {
            alert("Error: " + resData.message);
            btn.innerHTML = "Submit Order Request"; btn.disabled = false;
        }
    } catch (error) {
        alert("Network error, please try again.");
        btn.innerHTML = "Submit Order Request"; btn.disabled = false;
    }
}

function cancelOrder() {
    if(confirm("Are you sure you want to cancel this order?")) {
        window.location.href = "../patient_dashboard/patient_dashboard.html";
    }
}
