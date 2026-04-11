const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";
let allDoctors = [];
let selectedDoctor = null;

window.onload = function() {
    const uid = localStorage.getItem("bhavya_user_id");
    const role = localStorage.getItem("bhavya_role");
    
    if(!uid || role !== "patient") {
        alert("Please login as Patient to book a doctor.");
        window.location.href = "../index.html";
        return;
    }
    
    // Set min date to today
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
            renderDoctors(allDoctors);
        } else {
            alert("Error: " + resData.message);
        }
    } catch(e) {
        console.error(e);
        document.getElementById("loader").innerText = "Failed to load doctors. Check internet.";
    }
}

function renderDoctors(doctors) {
    const container = document.getElementById("doctorsContainer");
    container.innerHTML = "";
    
    if(doctors.length === 0) {
        container.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#888;'>No active doctors found at the moment.</p>";
        return;
    }

    doctors.forEach((doc, index) => {
        const onlineText = doc.online_available === "Yes" ? `| Online: ₹${doc.online_fee}` : `| Offline Only`;
        
        const card = document.createElement("div");
        card.className = "doc-card";
        card.innerHTML = `
            <img src="${doc.imgUrl}" alt="${doc.doctor_name}">
            <h3>Dr. ${doc.doctor_name}</h3>
            <p style="font-weight:bold; color:#e67e22;">${doc.speciality} (${doc.qualification})</p>
            <p>⭐ ${doc.experience} Years Exp.</p>
            <p>🏥 ${doc.clinic_name}, ${doc.city}</p>
            <div class="fees">Clinic Fee: ₹${doc.offline_fee} ${onlineText}</div>
            <button class="btn-book" onclick="openModal(${index})">Book Appointment</button>
        `;
        container.appendChild(card);
    });
}

function filterDoctors() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allDoctors.filter(doc => 
        doc.doctor_name.toLowerCase().includes(query) ||
        doc.speciality.toLowerCase().includes(query) ||
        doc.city.toLowerCase().includes(query)
    );
    renderDoctors(filtered);
}

function openModal(index) {
    selectedDoctor = allDoctors[index];
    document.getElementById("modalDocName").innerText = "Book Dr. " + selectedDoctor.doctor_name;
    
    const typeSelect = document.getElementById("consultType");
    typeSelect.innerHTML = `<option value="Offline">Clinic Visit (Pay ₹${selectedDoctor.offline_fee} at Clinic)</option>`;
    
    if(selectedDoctor.online_available === "Yes") {
        typeSelect.innerHTML += `<option value="Online">Online Video/Call (Pay ₹${selectedDoctor.online_fee} Now)</option>`;
    }
    
    togglePayment(); // reset UI
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
        
        // Dynamic QR API Google se
        const upiString = `upi://pay?pa=${selectedDoctor.upi_id}&pn=Dr.${selectedDoctor.doctor_name.replace(/ /g, '')}&am=${selectedDoctor.online_fee}&cu=INR`;
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
    const date = document.getElementById("apptDate").value;
    const time = document.getElementById("apptTime").value;
    const ssInput = document.getElementById("paymentScreenshot").files[0];
    
    if(consultType === "Online" && !ssInput) {
        alert("Please upload the payment screenshot for online consultation.");
        return;
    }

    document.getElementById("submitBtn").style.display = "none";
    document.getElementById("btnLoader").style.display = "block";

    try {
        let base64Img = "";
        let mimeType = "";
        
        if (ssInput) {
            base64Img = await getBase64(ssInput);
            mimeType = ssInput.type;
        }

        const payload = {
            action: "bookAppointment",
            data: {
                patient_id: localStorage.getItem("bhavya_user_id"),
                patient_email: localStorage.getItem("bhavya_email") || "", // Optional email if you save it
                doctor_id: selectedDoctor.doctor_id,
                doctor_name: selectedDoctor.doctor_name,
                consult_type: consultType,
                appt_date: date,
                appt_time: time,
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
            // Redirect to patient bookings page or dashboard
            window.location.href = "../patient_dashboard/patient_dashboard.html";
        } else {
            alert("Error: " + resData.message);
        }
    } catch(e) {
        console.error("Booking Error:", e);
        alert("Failed to process booking. Try again.");
    } finally {
        document.getElementById("submitBtn").style.display = "block";
        document.getElementById("btnLoader").style.display = "none";
    }
}
