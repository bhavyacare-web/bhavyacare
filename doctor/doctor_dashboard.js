// Apni API link yahan update karna mat bhulna
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

window.onload = function() {
    const role = localStorage.getItem("bhavya_role");
    const docName = localStorage.getItem("bhavya_name");
    const docId = localStorage.getItem("bhavya_user_id");

    // Check if user is legally a doctor
    if (role !== "doctor" || !docId) {
        alert("Unauthorized Access! Please login as Doctor.");
        window.location.href = "../index.html";
        return;
    }

    document.getElementById("displayDocName").innerText = docName;
    fetchDoctorAppointments(docId);
};

async function fetchDoctorAppointments(doctorId) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getDoctorAppointments", doctor_id: doctorId })
        });
        const resData = await response.json();
        
        document.getElementById("loader").style.display = "none";
        document.getElementById("apptTable").style.display = "table";

        if (resData.status === "success") {
            renderAppointments(resData.data);
        } else {
            document.getElementById("apptTableBody").innerHTML = `<tr><td colspan="7" style="text-align:center;">${resData.message}</td></tr>`;
        }
    } catch(e) {
        document.getElementById("loader").innerText = "Failed to load data. Please refresh.";
    }
}

function renderAppointments(appointments) {
    const tbody = document.getElementById("apptTableBody");
    tbody.innerHTML = "";
    
    let pendingCount = 0;
    let approvedCount = 0;
    let totalEarnings = 0;

    // Latest appointment sabse upar dikhegi
    appointments.reverse().forEach(appt => {
        // Statistics Calculate karna
        if (appt.appt_status === "Pending") pendingCount++;
        if (appt.appt_status === "Approved") approvedCount++;
        if (appt.appt_status === "Completed") totalEarnings += parseInt(appt.doctor_earning || 0);

        // Status Badge Styling
        let statusBadge = "";
        if(appt.appt_status === "Pending") statusBadge = `<span class="badge bg-warning">Pending</span>`;
        else if(appt.appt_status === "Approved") statusBadge = `<span class="badge bg-info">Approved</span>`;
        else if(appt.appt_status === "Completed") statusBadge = `<span class="badge bg-success">Completed</span>`;
        else statusBadge = `<span class="badge bg-danger">${appt.appt_status}</span>`;

        let typeBadge = appt.consult_type === "Online" ? "💻 Online Video" : "🏥 Clinic Visit";

        // --- 🌟 ACTION BUTTONS & BUFFER LOGIC 🌟 ---
        let actionHTML = "";
        
        if (appt.appt_status === "Pending") {
            // Nayi booking aayi hai, Approve ka button do
            actionHTML = `<button class="btn btn-approve" onclick="updateApptStatus('${appt.appt_id}', 'approve')">✅ Approve</button>`;
        } 
        else if (appt.appt_status === "Approved") {
            // Buffer Time Logic check
            const now = new Date();
            const [day, month, year] = appt.appt_date.split("-");
            let [time, modifier] = appt.appt_time.split(" ");
            let [hours, minutes] = time.split(":");
            
            hours = parseInt(hours, 10);
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            
            const apptDateTime = new Date(year, month - 1, day, hours, minutes);
            const diffInMinutes = (now - apptDateTime) / (1000 * 60);

            // Jitsi Call Button (15 min pehle se 45 min baad tak dikhega)
            if (appt.consult_type === "Online" && diffInMinutes >= -15 && diffInMinutes <= 45) {
                actionHTML += `<button class="btn btn-join" onclick="joinJitsiCall('${appt.meet_link}')">📹 Join Call</button>`;
            }

            // Complete & No-Show Buttons hamesha rahenge jab tak mark na ho jaye
            actionHTML += `
                <button class="btn btn-complete" onclick="updateApptStatus('${appt.appt_id}', 'complete')">✔️ Complete</button>
                <button class="btn btn-noshow" onclick="updateApptStatus('${appt.appt_id}', 'noshow')">❌ No-Show</button>
            `;
        } 
        else {
            actionHTML = `<span style="color:#888; font-style:italic;">No Actions Required</span>`; 
        }

        let paymentText = appt.consult_type === "Online" ? `<a href="${appt.payment_screenshot}" target="_blank" style="color:#0056b3; font-weight:bold;">📄 View Screenshot</a>` : `Pay at Clinic`;

        const row = `
            <tr>
                <td><strong>${appt.appt_date}</strong><br><span style="color:#666; font-size:12px;">${appt.appt_time}</span></td>
                <td>${typeBadge}</td>
                <td>${appt.patient_id}</td>
                <td>${statusBadge}</td>
                <td>${paymentText}</td>
                <td style="color:#28a745; font-weight:bold;">₹${appt.doctor_earning || 0}</td>
                <td style="text-align: center;">${actionHTML}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    document.getElementById("statPending").innerText = pendingCount;
    document.getElementById("statApproved").innerText = approvedCount;
    document.getElementById("statEarnings").innerText = totalEarnings;
}

// Backend me Status Update bhejta hai
async function updateApptStatus(apptId, actionType) {
    if(!confirm("Are you sure you want to mark this as " + actionType.toUpperCase() + "?")) return;

    try {
        document.getElementById("loader").style.display = "block";
        document.getElementById("apptTable").style.display = "none";

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processAppointmentAction", appt_id: apptId, action: actionType })
        });
        
        const resData = await response.json();
        if(resData.status === "success") {
            // Success hone par list wapas reload karo
            fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); 
        } else {
            alert("Error: " + resData.message);
            location.reload();
        }
    } catch (e) {
        alert("Failed to update status.");
        location.reload();
    }
}

// 🌟 WEBSITE KE ANDAR JITSI VIDEO CALL LOGIC 🌟
function joinJitsiCall(link) {
    const modal = document.createElement('div');
    modal.id = "jitsi-modal";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; flex-direction:column;";
    
    modal.innerHTML = `
        <div style="height:60px; background:#0056b3; color:white; display:flex; justify-content:space-between; align-items:center; padding:0 20px;">
            <h3 style="margin:0; font-size:18px;">BhavyaCare Secure Video Consult</h3>
            <button onclick="document.getElementById('jitsi-modal').remove()" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">End Call / Close</button>
        </div>
        <iframe src="${link}" allow="camera; microphone; fullscreen; display-capture; autoplay" style="width:100%; flex-grow:1; border:none;"></iframe>
    `;
    document.body.appendChild(modal);
}

function logoutDoctor() {
    localStorage.clear();
    window.location.href = "../index.html"; // Root par jayega
}
