const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let assignedMedicosId = "";

document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        alert("Please login first!");
        window.location.href = "../index.html";
        return;
    }

    // Auto-fill pincode from patient_details sheet on load
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getPatientLocation", user_id: userId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success" && data.data.pincode) {
            document.getElementById("pincode").value = data.data.pincode;
            fetchCities(); // Trigger postal API
        }
    }).catch(e => console.log("Auto-fill skipped:", e));

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
                let uniqueCities = new Set();
                
                data[0].PostOffice.forEach(po => {
                    uniqueCities.add(po.Name);
                });
                
                uniqueCities.forEach(city => {
                    citySelect.innerHTML += `<option value="${city}">${city}</option>`;
                });
            } else {
                citySelect.innerHTML = `<option value="">Invalid Pincode</option>`;
            }
        }).catch(() => {
            citySelect.innerHTML = `<option value="">Error fetching areas</option>`;
        });
    } else {
        citySelect.innerHTML = `<option value="">Please enter a valid 6-digit pincode first...</option>`;
    }
}

// === CHECK PHARMACY AVAILABILITY ===
function checkAvailability() {
    const pin = document.getElementById("pincode").value.trim();
    const city = document.getElementById("citySelect").value;
    const btn = document.getElementById("btnCheck");
    const errBox = document.getElementById("errorBox");

    if (pin.length !== 6 || !city) {
        alert("Please enter Pincode and select a City.");
        return;
    }

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Checking...`;
    btn.disabled = true;
    errBox.style.display = "none";

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "checkPharmacyAvailability",
            pincode: pin,
            city: city
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            // Pharmacy matched!
            assignedMedicosId = data.data.medicos_id;
            
            // UI Change
            document.getElementById("locationSection").style.display = "none";
            document.getElementById("bookingSection").style.display = "block";
            
            // Append pincode & city to address textarea automatically
            document.getElementById("patientAddress").value = `\n\nCity: ${city}, Pincode: ${pin}`;
            
        } else {
            // Not Available
            errBox.innerText = data.message; // "This service is not available..."
            errBox.style.display = "block";
            btn.innerHTML = "Check Service Availability";
            btn.disabled = false;
        }
    })
    .catch(e => {
        errBox.innerText = "Network Error! Please try again.";
        errBox.style.display = "block";
        btn.innerHTML = "Check Service Availability";
        btn.disabled = false;
    });
}

// === UPLOAD & SUBMIT ORDER ===
function getBase64(fileId) {
    return new Promise((resolve) => {
        const input = document.getElementById(fileId);
        if (!input || !input.files || input.files.length === 0) { resolve(""); return; }
        const reader = new FileReader(); 
        reader.readAsDataURL(input.files[0]);
        reader.onload = () => resolve(reader.result.split(',')[1]);
    });
}

async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmit");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Request...`;
    btn.disabled = true;

    try {
        const orderType = document.querySelector('input[name="orderType"]:checked').value;
        const address = document.getElementById("patientAddress").value;
        const medicineDetails = document.getElementById("medicineDetails").value;
        const fileBase64 = await getBase64("prescriptionFile");

        const payload = {
            action: "submitMedicineOrder",
            user_id: localStorage.getItem("bhavya_user_id"),
            medicos_id: assignedMedicosId,
            order_type: orderType,
            patient_address: address,
            medicine_details: medicineDetails,
            prescription_base64: fileBase64
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
            alert(`Order Placed Successfully!\nYour Order ID: ${resData.data.order_id}`);
            window.location.href = "patient_dashboard/patient_dashboard.html"; // Redirect to dashboard
        } else {
            alert("Error: " + resData.message);
            btn.innerHTML = "Submit Order Request";
            btn.disabled = false;
        }
    } catch (error) {
        alert("Network error, please try again.");
        btn.innerHTML = "Submit Order Request";
        btn.disabled = false;
    }
}
