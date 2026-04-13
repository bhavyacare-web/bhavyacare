let allDoctors = [];
let selectedDoctor = null;

const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

window.onload = function() {
    const today = new Date().toISOString().split('T')[0];
    fetchDoctors();
};

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
        } else { imgSrc = rawImg; }
    }
    if (imgSrc === "") { imgSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(docName)}&background=0056b3&color=fff&size=100`; }
    return imgSrc;
}

function convertTo24Hour(timeData) {
    if(!timeData) return "";
    let timeString = String(timeData).trim();
    if(timeString === "") return "";

    if (timeString.includes("T") || timeString.includes("GMT") || timeString.includes("-")) {
        let d = new Date(timeString);
        if (!isNaN(d.getTime())) {
            let h = d.getHours();
            let m = d.getMinutes();
            return `${h < 10 ? '0'+h : h}:${m < 10 ? '0'+m : m}`;
        }
    }

    let parts = timeString.split(":");
    if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        return `${h < 10 ? '0'+h : h}:${m < 10 ? '0'+m : m}`;
    }
    return timeString;
}

function formatTime12H(time24) {
    if(!time24 || time24.trim() === "") return "";
    let [hours, minutes] = time24.split(":");
    let h = parseInt(hours, 10);
    let ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12; 
    return `${h < 10 ? '0'+h : h}:${minutes} ${ampm}`;
}

function getDiscountedFee(fee) {
    let original = parseInt(fee);
    if(isNaN(original)) return 0;
    return Math.round(original * 0.90); 
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
            allDoctors = resData.data.map(doc => {
                const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
                days.forEach(d => {
                    doc[`off_${d}_in`] = convertTo24Hour(doc[`off_${d}_in`]);
                    doc[`off_${d}_out`] = convertTo24Hour(doc[`off_${d}_out`]);
                    doc[`on_${d}_in`] = convertTo24Hour(doc[`on_${d}_in`]);
                    doc[`on_${d}_out`] = convertTo24Hour(doc[`on_${d}_out`]);
                });
                return doc;
            });
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
    const searchName = document.getElementById("searchName").value.toLowerCase();
    const searchCity = document.getElementById("searchCity").value.toLowerCase();
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
        let matchName = doc.doctor_name.toLowerCase().includes(searchName) || doc.speciality.toLowerCase().includes(searchName);
        let matchCity = doc.city.toLowerCase().includes(searchCity);
        
        if(!matchName || !matchCity) return;
        if(filterType === "Online" && doc.online_available !== "Yes") return;
        
        let isAvail = checkAvailability(doc, filterDay, filterTime);
        
        let availBadge = isCurrentTimeCheck 
            ? (isAvail ? `<span class="badge avail-yes">🟢 Available Now</span>` : `<span class="badge avail-no">🔴 Not Available Now</span>`)
            : (isAvail ? `<span class="badge avail-yes">🟢 Available at Selected Time</span>` : `<span class="badge avail-no">🔴 Not Available at Selected Time</span>`);
            
        let onlineBadge = doc.online_available === "Yes" 
            ? `<span class="badge type-online">💻 Online Consult</span>` 
            : `<span class="badge type-offline">🏥 Clinic Visit Only</span>`;

        let safeImg = fixDriveUrl(doc.imgUrl, doc.doctor_name);
        let fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.doctor_name)}&background=0056b3&color=fff&size=100`;
        
        let offDiscount = getDiscountedFee(doc.offline_fee);
        let onDiscount = getDiscountedFee(doc.online_fee);
        
        let offlineText = `
            <div class="fee-box">
                <span class="title">Clinic</span>
                <div><del>₹${doc.offline_fee}</del> <span class="discount-price">₹${offDiscount}</span></div>
            </div>`;
        let onlineText = doc.online_available === "Yes" ? `
            <div class="fee-box">
                <span class="title">Online</span>
                <div><del>₹${doc.online_fee}</del> <span class="discount-price">₹${onDiscount}</span></div>
            </div>` : ``;

        const card = document.createElement("div");
        card.className = "doc-card";
        card.innerHTML = `
            <div class="doc-exp-corner">⭐ ${doc.experience} Yrs</div>
            
            <div class="doc-card-top">
                <div class="img-container">
                    <img src="${safeImg}" alt="${doc.doctor_name}" onerror="this.onerror=null; this.src='${fallbackAvatar}';">
                </div>
                <div class="doc-info">
                    <h3>Dr. ${doc.doctor_name}</h3>
                    <div class="doc-speciality">${doc.speciality}</div>
                    <div class="doc-qual">${doc.qualification}</div>
                </div>
            </div>
            
            <div class="doc-location">
                <span style="font-size:16px;">🏥</span> ${doc.clinic_name}, ${doc.city}
            </div>
            
            <div class="badges-container">
                ${availBadge} ${onlineBadge}
            </div>
            
            <div class="fees">${offlineText} ${onlineText}</div>
            
            <div class="action-btns">
                <button class="btn-schedule" onclick="openSchedule(${index})"><i class="far fa-clock"></i> Timings</button>
                <button class="btn-book" onclick="attemptBook(${index})">Book Now</button>
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
            ? `${formatTime12H(doc['off_'+d+'_in'])} - ${formatTime12H(doc['off_'+d+'_out'])}` : `<span style="color:#ccc;">Closed</span>`;
        
        let onStr = (doc[`on_${d}_in`] && doc[`on_${d}_out`]) 
            ? `${formatTime12H(doc['on_'+d+'_in'])} - ${formatTime12H(doc['on_'+d+'_out'])}` : `<span style="color:#ccc;">N/A</span>`;
        
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
        document.getElementById("login-section").style.display = "block"; 
        return;
    }
    
    selectedDoctor = allDoctors[index];
    document.getElementById("modalDocName").innerText = "Book Dr. " + selectedDoctor.doctor_name;
    
    let offDiscount = getDiscountedFee(selectedDoctor.offline_fee);
    let onDiscount = getDiscountedFee(selectedDoctor.online_fee);

    const typeGroup = document.getElementById("consultTypeGroup");
    typeGroup.innerHTML = `
        <input type="radio" name="cType" id="typeClinic" value="Offline" onchange="selectConsultType('Offline')" checked>
        <label for="typeClinic">🏥 Clinic Visit<br><span style="font-size:12px; color:#666;">Pay ₹${offDiscount} at Clinic</span></label>
    `;
    if(selectedDoctor.online_available === "Yes") {
        typeGroup.innerHTML += `
            <input type="radio" name="cType" id="typeOnline" value="Online" onchange="selectConsultType('Online')">
            <label for="typeOnline">💻 Online Consult<br><span style="font-size:12px; color:#0056b3;">Pay ₹${onDiscount} Now</span></label>
        `;
    }
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("apptDate").type = "text"; 
    document.getElementById("apptDate").value = "";
    document.getElementById("apptDate").setAttribute('min', today);

    document.getElementById("apptTime").type = "text";
    document.getElementById("apptTime").value = "";
    document.getElementById("apptTime").disabled = true;
    
    document.getElementById("availabilityMsg").style.display = "none";
    
    selectConsultType("Offline"); 
    
    document.getElementById("bookingModal").style.display = "flex";
}

function selectConsultType(type) {
    document.getElementById("consultType").value = type;
    handleTypeChange();
}

function handleTypeChange() {
    const type = document.getElementById("consultType").value;
    const paymentDiv = document.getElementById("paymentSection");
    const ssInput = document.getElementById("paymentScreenshot");
    
    if(document.getElementById("apptDate").value) { checkSchedule(); }
    
    if(type === "Online") {
        paymentDiv.style.display = "block";
        document.getElementById("payUpiId").innerText = selectedDoctor.upi_id;
        
        let onDiscount = getDiscountedFee(selectedDoctor.online_fee);
        document.getElementById("payAmount").innerText = onDiscount;
        
        // 🌟 NAYA: UPI INTENT LINK GENERATION 🌟
        // Mobile mein ye link click karne par seedha GPay/PhonePe waghera open ho jayenge
        const upiString = `upi://pay?pa=${selectedDoctor.upi_id}&pn=BhavyaCare&am=${onDiscount}&cu=INR`;
        document.getElementById("payUpiBtn").href = upiString;

        ssInput.setAttribute("required", "true");
    } else {
        paymentDiv.style.display = "none";
        ssInput.removeAttribute("required");
    }
}

function checkSchedule() {
    const dateVal = document.getElementById("apptDate").value;
    const typeVal = document.getElementById("consultType").value;
    const msgDiv = document.getElementById("availabilityMsg");
    const timeInput = document.getElementById("apptTime");
    
    if(!dateVal || !typeVal) {
        timeInput.disabled = true;
        timeInput.type = "text";
        timeInput.value = "";
        msgDiv.style.display = "none";
        return;
    }
    
    const dateObj = new Date(dateVal);
    const dayKey = daysMap[dateObj.getDay()];
    
    let inTime = typeVal === "Offline" ? selectedDoctor[`off_${dayKey}_in`] : selectedDoctor[`on_${dayKey}_in`];
    let outTime = typeVal === "Offline" ? selectedDoctor[`off_${dayKey}_out`] : selectedDoctor[`on_${dayKey}_out`];

    if (inTime && outTime) {
        msgDiv.innerHTML = `<i class="fas fa-check-circle"></i> Available from ${formatTime12H(inTime)} to ${formatTime12H(outTime)}`;
        msgDiv.style.color = "#155724";
        msgDiv.style.background = "#d4edda";
        msgDiv.style.borderLeftColor = "#28a745";
        msgDiv.style.display = "block";
        
        timeInput.disabled = false;
        timeInput.type = "time"; 
        timeInput.setAttribute("min", inTime);
        timeInput.setAttribute("max", outTime);
        timeInput.value = ""; 
    } else {
        msgDiv.innerHTML = `<i class="fas fa-times-circle"></i> Not available for ${typeVal} consultation on this day.`;
        msgDiv.style.color = "#721c24";
        msgDiv.style.background = "#f8d7da";
        msgDiv.style.borderLeftColor = "#dc3545";
        msgDiv.style.display = "block";
        timeInput.disabled = true;
        timeInput.type = "text";
        timeInput.value = "";
    }
}

function closeModal() {
    document.getElementById("bookingModal").style.display = "none";
    document.getElementById("bookingForm").reset();
    document.getElementById("paymentSection").style.display = "none";
    document.getElementById("availabilityMsg").style.display = "none";
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
    
    const timeInput = document.getElementById("apptTime");
    if(timeInput.disabled || timeInput.type === "text") {
        alert("Please select a valid date where the doctor is available."); return;
    }
    if (timeInput.value < timeInput.min || timeInput.value > timeInput.max) {
        alert(`Please select a time between ${formatTime12H(timeInput.min)} and ${formatTime12H(timeInput.max)}.`);
        return;
    }

    const consultType = document.getElementById("consultType").value;
    const rawDate = document.getElementById("apptDate").value;
    const rawTime = timeInput.value;
    const ssInput = document.getElementById("paymentScreenshot").files[0];
    
    if(consultType === "Online" && !ssInput) {
        alert("Please upload the payment screenshot for online consultation."); return;
    }

    document.getElementById("submitBtn").style.display = "none";
    document.getElementById("btnLoader").style.display = "block";

    try {
        let base64Img = ""; let mimeType = "";
        if (ssInput) { base64Img = await getBase64(ssInput); mimeType = ssInput.type; }

        let formattedDate = rawDate.split('-').reverse().join('-');
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
            alert("Booking Confirmed! You will be redirected to your dashboard.");
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
