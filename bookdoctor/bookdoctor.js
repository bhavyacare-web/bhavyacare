const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";
let allDoctors = [];
let selectedDoctor = null;

// Aaj ka din nikalne ke liye (e.g. "mon", "tue")
const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

window.onload = function() {
    // Set min date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("apptDate").setAttribute('min', today);
    fetchDoctors();
};

async function fetchDoctors() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getActiveDoctors" })
        });
        const resData = await response.json();
        document.getElementById("loader").style.display = "none";
        
        if(resData.status === "success") {
            allDoctors = resData.data;
            applyFilters(); // Pehli baar load hone par current time se filter karega
        } else {
            alert("Error: " + resData.message);
        }
    } catch(e) {
        console.error(e);
        document.getElementById("loader").innerText = "Failed to load doctors.";
    }
}

// Check if doctor is available on a specific day and time
function checkAvailability(doc, day, time) {
    if(day === "Any" || !time) return true; // Agar filter select nahi hai toh sab dikhao
    
    let offIn = doc[`off_${day}_in`], offOut = doc[`off_${day}_out`];
    let onIn = doc[`on_${day}_in`], onOut = doc[`on_${day}_out`];

    // Helper: Compare 24hr string times ("14:30" >= "10:00")
    let isOffAvail = (offIn && offOut && time >= offIn && time <= offOut);
    let isOnAvail = (onIn && onOut && time >= onIn && time <= onOut);

    return isOffAvail || isOnAvail;
}

function applyFilters() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    let filterDay = document.getElementById("filterDay").value;
    let filterTime = document.getElementById("filterTime").value;

    // Agar user ne day/time select nahi kiya, toh Current Time nikal lo
    let isCurrentTimeCheck = false;
    if (filterDay === "Any" && filterTime === "") {
        const now = new Date();
        filterDay = daysMap[now.getDay()];
        filterTime = now.toTimeString().substring(0, 5); // Gets "HH:MM"
        isCurrentTimeCheck = true;
    }

    const container = document.getElementById("doctorsContainer");
    container.innerHTML = "";

    allDoctors.forEach((doc, index) => {
        // Name Search filter
        if(!doc.doctor_name.toLowerCase().includes(query) && !doc.speciality.toLowerCase().includes(query) && !doc.city.toLowerCase().includes(query)) return;

        // Availability Check
        let isAvail = checkAvailability(doc, filterDay, filterTime);
        
        // UI Text
        let availBadge = "";
        if (isCurrentTimeCheck) {
            availBadge = isAvail ? `<span class="avail-badge avail-yes">🟢 Available Now</span>` : `<span class="avail-badge avail-no">🔴 Currently Not Available</span>`;
        } else {
            availBadge = isAvail ? `<span class="avail-badge avail-yes">🟢 Available at Selected Time</span>` : `<span class="avail-badge avail-no">🔴 Not Available at Selected Time</span>`;
        }

        const onlineText = doc.online_available === "Yes" ? `| Online: ₹${doc.online_fee}` : `| Offline Only`;
        
        const card = document.createElement("div");
        card.className = "doc-card";
        card.innerHTML = `
            ${availBadge}
            <br>
            <img src="${doc.imgUrl}" alt="${doc.doctor_name}">
            <h3>Dr. ${doc.doctor_name}</h3>
            <p style="font-weight:bold; color:#e67e22;">${doc.speciality} (${doc.qualification})</p>
            <p>🏥 ${doc.clinic_name}, ${doc.city}</p>
            <div class="fees">Clinic Fee: ₹${doc.offline_fee} ${onlineText}</div>
            
            <div class="action-btns">
                <button class="btn-schedule" onclick="openSchedule(${index})">🕒 View Timings</button>
                <button class="btn-book" onclick="attemptBook(${index})">Book</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ---- SCHEDULE VIEWER ----
function openSchedule(index) {
    const doc = allDoctors[index];
    document.getElementById("scheduleDocName").innerText = "Timings - Dr. " + doc.doctor_name;
    
    let html = `<table class="schedule-table"><tr><th>Day</th><th>Offline (Clinic)</th><th>Online (Video/Call)</th></tr>`;
    
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
    for(let i=0; i<7; i++) {
        let d = days[i];
        let offStr = (doc[`off_${d}_in`] && doc[`off_${d}_out`]) ? `${doc['off_'+d+'_in']} - ${doc['off_'+d+'_out']}` : `<span style="color:#ccc;">Closed</span>`;
        let onStr = (doc[`on_${d}_in`] && doc[`on_${d}_out`]) ? `${doc['on_'+d+'_in']} - ${doc['on_'+d+'_out']}` : `<span style="color:#ccc;">N/A</span>`;
        
        html += `<tr><td><strong>${dayNames[i]}</strong></td><td>${offStr}</td><td>${onStr}</td></tr>`;
    }
    html += `</table>`;
    
    document.getElementById("scheduleContent").innerHTML = html;
    document.getElementById("scheduleModal").style.display = "flex";
}
function closeSchedule() { document.getElementById("scheduleModal").style.display = "none"; }

// ---- BOOKING LOGIC ----
function attemptBook(index) {
    // Login Validation sirf Book click karne par!
    const uid = localStorage.getItem("bhavya_user_id");
    const role = localStorage.getItem("bhavya_role");
    
    if(!uid || role !== "patient") {
        alert("Please Login or Sign Up as a Patient to book an appointment.");
        // Redirect to main page for login
        window.location.href = "../index.html";
        return;
    }
    
    // Agar logged in hai toh Booking Modal kholo
    selectedDoctor = allDoctors[index];
    document.getElementById("modalDocName").innerText = "Book Dr. " + selectedDoctor.doctor_name;
    
    const typeSelect = document.getElementById("consultType");
    typeSelect.innerHTML = `<option value="Offline">Clinic Visit (Pay ₹${selectedDoctor.offline_fee} at Clinic)</option>`;
    if(selectedDoctor.online_available === "Yes") {
        typeSelect.innerHTML += `<option value="Online">Online Video/Call (Pay ₹${selectedDoctor.online_fee} Now)</option>`;
    }
    
    togglePayment(); 
    document.getElementById("bookingModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("bookingModal").style.display = "none";
    document.getElementById("bookingForm").reset();
    document.getElementById("paymentSection").style.display = "none";
}

function togglePayment() {
    const type = document.getElementById("consultType").value;
    const paymentDiv = document.getElementById("paymentSection");
    const ssInput = document.getElementById("paymentScreenshot");
    
    if(type === "Online") {
        paymentDiv.style.display = "block";
        document.getElementById("payUpiId").innerText = selectedDoctor.upi_id;
        document.getElementById("payAmount").innerText = selectedDoctor.online_fee;
        const upiString = `upi://pay?pa=${selectedDoctor.upi_id}&pn=BhavyaCare&am=${selectedDoctor.online_fee}&cu=INR`;
        document.getElementById("qrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;
        ssInput.setAttribute("required", "true");
    } else {
        paymentDiv.style.display = "none";
        ssInput.removeAttribute("required");
    }
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error);
    });
}

async function submitBooking() {
    const form = document.getElementById("bookingForm");
    if(!form.checkValidity()) { form.reportValidity(); return; }
    
    const consultType = document.getElementById("consultType").value;
    const ssInput = document.getElementById("paymentScreenshot").files[0];
    
    if(consultType === "Online" && !ssInput) {
        alert("Please upload the payment screenshot for online consultation."); return;
    }

    document.getElementById("submitBtn").style.display = "none";
    document.getElementById("btnLoader").style.display = "block";

    try {
        let base64Img = ""; let mimeType = "";
        if (ssInput) { base64Img = await getBase64(ssInput); mimeType = ssInput.type; }

        const payload = {
            action: "bookAppointment",
            data: {
                patient_id: localStorage.getItem("bhavya_user_id"),
                doctor_id: selectedDoctor.doctor_id,
                doctor_name: selectedDoctor.doctor_name,
                consult_type: consultType,
                appt_date: document.getElementById("apptDate").value,
                appt_time: document.getElementById("apptTime").value,
                screenshot_base64: base64Img,
                screenshot_mime: mimeType
            }
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        if (resData.status === "success") {
            alert(resData.message);
            closeModal();
            window.location.href = "../patient_dashboard/patient_dashboard.html";
        } else {
            alert("Error: " + resData.message);
        }
    } catch(e) {
        alert("Failed to process booking.");
    } finally {
        document.getElementById("submitBtn").style.display = "block";
        document.getElementById("btnLoader").style.display = "none";
    }
}
