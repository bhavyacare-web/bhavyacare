// GOOGLE_SCRIPT_URL ab directly app.js se aa jayega, isliye yahan se hata diya hai.
let allDoctors = [];
let selectedDoctor = null;

const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

window.onload = function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("apptDate").setAttribute('min', today);
    fetchDoctors();
};

// 🌟 AAPKA MASTER HELPER: Google Drive Thumbnail API (100% Working)
function fixDriveUrl(rawImg, docName) {
    let imgSrc = "";
    
    if (rawImg && rawImg.trim() !== "") {
        if (rawImg.includes("drive.google.com/file/d/")) {
            let match = rawImg.match(/\/d\/([a-zA-Z0-9_-]+)/);
            imgSrc = match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200` : rawImg;
        } else if (rawImg.includes("drive.google.com/open?id=")) {
            let match = rawImg.match(/id=([a-zA-Z0-9_-]+)/);
            imgSrc = match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200` : rawImg;
        } else if (rawImg.includes("drive.google.com/uc?id=")) {
            let match = rawImg.match(/id=([a-zA-Z0-9_-]+)/);
            imgSrc = match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200` : rawImg;
        } else if (!rawImg.startsWith("http") && !rawImg.startsWith("data:image")) {
            imgSrc = `data:image/jpeg;base64,${rawImg}`;
        } else { 
            imgSrc = rawImg; 
        }
    }
    
    if (imgSrc === "") {
        imgSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(docName)}&background=0056b3&color=fff&size=100`;
    }
    
    return imgSrc;
}

// 🌟 HELPER 2: 24-Hour Time to 12-Hour (AM/PM) Converter
function formatTime12H(time24) {
    if(!time24 || time24.trim() === "") return "";
    let [hours, minutes] = time24.split(":");
    let h = parseInt(hours, 10);
    let ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12; 
    return `${h < 10 ? '0'+h : h}:${minutes} ${ampm}`;
}

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
            applyFilters();
        } else {
            alert("Error: " + resData.message);
        }
    } catch(e) {
        console.error(e);
        document.getElementById("loader").innerText = "Failed to load doctors.";
    }
}

function checkAvailability(doc, day, time) {
    if(day === "Any" || !time) return true; 
    let offIn = doc[`off_${day}_in`], offOut = doc[`off_${day}_out`];
    let onIn = doc[`on_${day}_in`], onOut = doc[`on_${day}_out`];
    let isOffAvail = (offIn && offOut && time >= offIn && time <= offOut);
    let isOnAvail = (onIn && onOut && time >= onIn && time <= onOut);
    return isOffAvail || isOnAvail;
}

function applyFilters() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filterType = document.getElementById("filterType").value;
    let filterDay = document.getElementById("filterDay").value;
    let filterTime = document.getElementById("filterTime").value;

    let isCurrentTimeCheck = false;
    if (filterDay === "Any" && filterTime === "") {
        const now = new Date();
        filterDay = daysMap[now.getDay()];
        filterTime = now.toTimeString().substring(0, 5);
        isCurrentTimeCheck = true;
    }

    const container = document.getElementById("doctorsContainer");
    container.innerHTML = "";

    allDoctors.forEach((doc, index) => {
        if(!doc.doctor_name.toLowerCase().includes(query) && !doc.speciality.toLowerCase().includes(query) && !doc.city.toLowerCase().includes(query)) return;
        
        if(filterType === "Online" && doc.online_available !== "Yes") return;
        
        let isAvail = checkAvailability(doc, filterDay, filterTime);
        
        let availBadge = isCurrentTimeCheck 
            ? (isAvail ? `<span class="badge avail-yes">🟢 Available Now</span>` : `<span class="badge avail-no">🔴 Not Available Now</span>`)
            : (isAvail ? `<span class="badge avail-yes">🟢 Available at Selected Time</span>` : `<span class="badge avail-no">🔴 Not Available at Selected Time</span>`);
            
        let onlineBadge = doc.online_available === "Yes" 
            ? `<span class="badge type-online">💻 Online Video Consult</span>` 
            : `<span class="badge type-offline">🏥 Clinic Visit Only</span>`;

        let safeImg = fixDriveUrl(doc.imgUrl, doc.doctor_name);
        let fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.doctor_name)}&background=0056b3&color=fff&size=100`;
        let onlineText = doc.online_available === "Yes" ? ` | Online: ₹${doc.online_fee}` : ``;

        const card = document.createElement("div");
        card.className = "doc-card";
        
        card.innerHTML = `
            <div class="badges-container">
                ${availBadge} ${onlineBadge}
            </div>
            <div class="img-container">
                <img src="${safeImg}" alt="${doc.doctor_name}" onerror="this.onerror=null; this.src='${fallbackAvatar}';">
            </div>
            <h3>Dr. ${doc.doctor_name}</h3>
            <div class="doc-speciality">${doc.speciality} (${doc.qualification})</div>
            <div class="doc-exp">⭐ ${doc.experience} Years Experience</div>
            <p style="margin:5px 0; color:#555; font-size:14px;">🏥 ${doc.clinic_name}, ${doc.city}</p>
            <div class="fees">Clinic Fee: ₹${doc.offline_fee} ${onlineText}</div>
            
            <div class="action-btns">
                <button class="btn-schedule" onclick="openSchedule(${index})">🕒 View Timings</button>
                <button class="btn-book" onclick="attemptBook(${index})">Book</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function openSchedule(index) {
    const doc = allDoctors[index];
    document.getElementById("scheduleDocName").innerText = "Timings - Dr. " + doc.doctor_name;
    
    let html = `<table class="schedule-table"><tr><th>Day</th><th>Offline (Clinic)</th><th>Online (Video/Call)</th></tr>`;
    const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
    for(let i=0; i<7; i++) {
        let d = days[i];
        
        let offStr = (doc[`off_${d}_in`] && doc[`off_${d}_out`]) 
            ? `${formatTime12H(doc['off_'+d+'_in'])} to ${formatTime12H(doc['off_'+d+'_out'])}` 
            : `<span style="color:#ccc;">Closed</span>`;
            
        let onStr = (doc[`on_${d}_in`] && doc[`on_${d}_out`]) 
            ? `${formatTime12H(doc['on_'+d+'_in'])} to ${formatTime12H(doc['on_'+d+'_out'])}` 
            : `<span style="color:#ccc;">N/A</span>`;
        
        html += `<tr><td><strong>${dayNames[i]}</strong></td><td>${offStr}</td><td>${onStr}</td></tr>`;
    }
    html += `</table>`;
    
    document.getElementById("scheduleContent").innerHTML = html;
    document.getElementById("scheduleModal").style.display = "flex";
}
function closeSchedule() { document.getElementById("scheduleModal").style.display = "none"; }

function attemptBook(index) {
    const uid = localStorage.getItem("bhavya_user_id");
    const role = localStorage.getItem("bhavya_role");
    
    if(!uid || role !== "patient") {
        alert("Please Login or Sign Up as a Patient to book an appointment.");
        localStorage.setItem("stay_on_page", "true"); 
        openPatientLogin(); 
        return;
    }
    
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

        let rawDate = document.getElementById("apptDate").value;
        let formattedDate = rawDate.split('-').reverse().join('-');
        
        let rawTime = document.getElementById("apptTime").value;
        let formattedTime = formatTime12H(rawTime);

        const payload = {
            action: "bookAppointment",
            data: {
                patient_id: localStorage.getItem("bhavya_user_id"),
                doctor_id: selectedDoctor.doctor_id,
                doctor_name: selectedDoctor.doctor_name,
                consult_type: consultType,
                appt_date: formattedDate, 
                appt_time: formattedTime, 
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
