const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allDoctorAppointments = []; 
let activeVideoCallApptId = null;
let handledDocTriggers = new Set(); 

let docApptChart = null;
let docRevenueChart = null;
Chart.register(ChartDataLabels);

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) { 
        container = document.createElement('div'); 
        container.id = 'toast-container'; 
        container.style = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(container); 
    }
    const toast = document.createElement('div');
    let bgColor = type === 'error' ? '#ef4444' : (type === 'info' ? '#3b82f6' : '#10b981');
    let icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
    toast.style = `background: ${bgColor}; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-size: 14px; font-weight: bold; display: flex; align-items: center; gap: 10px; animation: fadeInOut 3s forwards;`;
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

window.onload = function() {
    const role = localStorage.getItem("bhavya_role");
    const docName = localStorage.getItem("bhavya_name");
    const docId = localStorage.getItem("bhavya_user_id");

    if (role !== "doctor" || !docId) {
        alert("Unauthorized Access! Please login as Doctor.");
        window.location.href = "../index.html";
        return;
    }

    document.getElementById("displayDocName").innerText = docName;
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
    const formatForInput = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
    document.getElementById("ledgerFrom").value = formatForInput(firstDay);
    document.getElementById("ledgerTo").value = formatForInput(lastDay); 

    verifyDoctorStatus();
    fetchDoctorAppointments(docId);
};

async function verifyDoctorStatus() {
    const docId = localStorage.getItem("bhavya_user_id");
    const banner = document.getElementById("statusWarningBanner");
    if(!banner) return; 

    const localStatus = localStorage.getItem("bhavya_doc_status") || "Pending";
    if (localStatus !== "Active" && localStatus !== "Approved") banner.style.display = "block";
    else banner.style.display = "none";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkDoctorStatus", doctor_id: docId })
        });
        const resData = await response.json();
        
        if (resData.status === "success") {
            const currentStatus = (resData.data.status || "Pending").trim();
            localStorage.setItem("bhavya_doc_status", currentStatus);
            if (currentStatus !== "Active" && currentStatus !== "Approved") {
                banner.style.display = "block";
                if (currentStatus === "Rejected") {
                    banner.style.backgroundColor = "#f8d7da"; banner.style.color = "#721c24"; banner.style.borderLeftColor = "#dc3545";
                    banner.innerHTML = `<i class="fas fa-times-circle"></i> Your profile was rejected. Reason: <strong>${resData.data.reject_reason || "Check with admin"}</strong>. Please update your profile.`;
                }
            } else banner.style.display = "none";
        }
    } catch(e) { console.error("Banner check failed"); }
}

function switchTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu li').forEach(l => l.classList.remove('active'));
    document.getElementById('sec-' + tabId).classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    let titles = { 'appt': 'Manage Appointments', 'ledger': 'Settlement Ledger', 'reviews': 'Patient Reviews', 'profile': 'My Profile' };
    document.getElementById('pageTitle').innerText = titles[tabId];
    if(tabId === 'profile') loadDoctorProfileData();
}

function showOffDay() {
    const selectedDay = document.getElementById("offDaySelect").value;
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    days.forEach(d => document.getElementById(`off_${d}`).style.display = (d === selectedDay) ? "grid" : "none");
}
function showOnDay() {
    const selectedDay = document.getElementById("onDaySelect").value;
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    days.forEach(d => document.getElementById(`on_${d}`).style.display = (d === selectedDay) ? "grid" : "none");
}
function toggleEditOnlineSection() {
    const val = document.getElementById("editOnlineAvailable").value;
    document.getElementById("editOnlineSection").style.display = (val === "Yes") ? "block" : "none";
}

async function loadDoctorProfileData() {
    document.getElementById("editProfileForm").style.display = "none";
    document.getElementById("profileLoadingText").style.display = "block";
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getDoctorProfileSettings", doctor_id: localStorage.getItem("bhavya_user_id") })
        });
        const resData = await response.json();
        if (resData.status === "success" && resData.data) {
            const p = resData.data;
            document.getElementById("editOnlineAvailable").value = p.online_available || "No";
            document.getElementById("editOnlineFee").value = p.online_fee || "";
            const days = ['mon','tue','wed','thu','fri','sat','sun'];
            days.forEach(d => {
                let offIn = document.getElementById(`edit_off_${d}_in`); let offOut = document.getElementById(`edit_off_${d}_out`);
                offIn.value = p[`off_${d}_in`] || ""; offOut.value = p[`off_${d}_out`] || "";
                if(p[`off_${d}_in`]) offIn.type = "time"; if(p[`off_${d}_out`]) offOut.type = "time";
                let onIn = document.getElementById(`edit_on_${d}_in`); let onOut = document.getElementById(`edit_on_${d}_out`);
                onIn.value = p[`on_${d}_in`] || ""; onOut.value = p[`on_${d}_out`] || "";
                if(p[`on_${d}_in`]) onIn.type = "time"; if(p[`on_${d}_out`]) onOut.type = "time";
            });
            toggleEditOnlineSection();
            document.getElementById("offDaySelect").value = "mon"; document.getElementById("onDaySelect").value = "mon";
            showOffDay(); showOnDay();
        }
    } catch(e) { console.log("Error loading profile", e); } 
    finally { document.getElementById("profileLoadingText").style.display = "none"; document.getElementById("editProfileForm").style.display = "block"; }
}

async function saveDoctorProfile() {
    const isOnline = document.getElementById('editOnlineAvailable').value === "Yes";
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    let hasOffline = false;
    for(let d of days) { if(document.getElementById(`edit_off_${d}_in`).value && document.getElementById(`edit_off_${d}_out`).value) { hasOffline = true; break; } }
    if(!hasOffline) { alert("Please select Open and Close time for at least ONE day for Offline Clinic."); return; }
    if(isOnline) {
        if(!document.getElementById('editOnlineFee').value) { alert("Please enter Online Fee."); return; }
        let hasOnline = false;
        for(let d of days) { if(document.getElementById(`edit_on_${d}_in`).value && document.getElementById(`edit_on_${d}_out`).value) { hasOnline = true; break; } }
        if(!hasOnline) { alert("Please select Open and Close time for at least ONE day for Online Consultation."); return; }
    }
    document.getElementById("btnSaveProfile").style.display = "none";
    document.getElementById("profileLoader").style.display = "block";
    const payload = {
        action: "updateDoctorProfileSettings", doctor_id: localStorage.getItem("bhavya_user_id"),
        data: {
            off_mon_in: document.getElementById('edit_off_mon_in').value, off_mon_out: document.getElementById('edit_off_mon_out').value,
            off_tue_in: document.getElementById('edit_off_tue_in').value, off_tue_out: document.getElementById('edit_off_tue_out').value,
            off_wed_in: document.getElementById('edit_off_wed_in').value, off_wed_out: document.getElementById('edit_off_wed_out').value,
            off_thu_in: document.getElementById('edit_off_thu_in').value, off_thu_out: document.getElementById('edit_off_thu_out').value,
            off_fri_in: document.getElementById('edit_off_fri_in').value, off_fri_out: document.getElementById('edit_off_fri_out').value,
            off_sat_in: document.getElementById('edit_off_sat_in').value, off_sat_out: document.getElementById('edit_off_sat_out').value,
            off_sun_in: document.getElementById('edit_off_sun_in').value, off_sun_out: document.getElementById('edit_off_sun_out').value,
            online_available: document.getElementById('editOnlineAvailable').value, online_fee: document.getElementById('editOnlineFee').value || "",
            on_mon_in: document.getElementById('edit_on_mon_in').value, on_mon_out: document.getElementById('edit_on_mon_out').value,
            on_tue_in: document.getElementById('edit_on_tue_in').value, on_tue_out: document.getElementById('edit_on_tue_out').value,
            on_wed_in: document.getElementById('edit_on_wed_in').value, on_wed_out: document.getElementById('edit_on_wed_out').value,
            on_thu_in: document.getElementById('edit_on_thu_in').value, on_thu_out: document.getElementById('edit_on_thu_out').value,
            on_fri_in: document.getElementById('edit_on_fri_in').value, on_fri_out: document.getElementById('edit_on_fri_out').value,
            on_sat_in: document.getElementById('edit_on_sat_in').value, on_sat_out: document.getElementById('edit_on_sat_out').value,
            on_sun_in: document.getElementById('edit_on_sun_in').value, on_sun_out: document.getElementById('edit_on_sun_out').value
        }
    };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Full Schedule updated successfully!"); verifyDoctorStatus(); }
        else alert("Error: " + resData.message);
    } catch(e) { alert("Failed to update."); } 
    finally { document.getElementById("btnSaveProfile").style.display = "block"; document.getElementById("profileLoader").style.display = "none"; }
}

function formatDate(rawDate) {
    if (!rawDate) return "N/A"; let dateStr = String(rawDate).trim();
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) return dateStr;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`; 
    return dateStr;
}

function formatTime(rawTime) {
    if (!rawTime) return "N/A"; let timeStr = String(rawTime).trim();
    if (timeStr.includes("T") || timeStr.includes("Z")) {
        let d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
            let h = d.getHours(); let m = d.getMinutes(); let ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12; return `${h < 10 ? '0'+h : h}:${m < 10 ? '0'+m : m} ${ampm}`;
        }
    }
    return timeStr;
}

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
            allDoctorAppointments = resData.data.map(appt => {
                appt.cleanDate = formatDate(appt.appt_date);
                appt.cleanTime = formatTime(appt.appt_time);
                return appt;
            }).reverse();
            renderAppointments(allDoctorAppointments);
            calculateSettlement(); renderReviews(); 
        } else {
            document.getElementById("apptTableBody").innerHTML = `<tr><td colspan="7" style="text-align:center;">${resData.message}</td></tr>`;
        }
    } catch(e) { document.getElementById("loader").innerText = "Failed to load data. Please refresh."; }
}

function filterAppointments() {
    const term = document.getElementById("searchAppt").value.toLowerCase();
    const status = document.getElementById("filterStatus").value;
    const filtered = allDoctorAppointments.filter(appt => {
        const matchStatus = (status === "All" || appt.appt_status === status);
        const matchSearch = (appt.patient_id.toLowerCase().includes(term) || appt.cleanDate.includes(term));
        return matchStatus && matchSearch;
    });
    renderAppointments(filtered);
}

function renderAppointments(appointments) {
    const tbody = document.getElementById("apptTableBody");
    tbody.innerHTML = "";
    let pendingCount = 0; let approvedCount = 0; let totalEarnings = 0;
    let totalDues = 0; // ✨ NAYA: OUTSTANDING DUES CALCULATION ✨

    if(appointments.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No appointments found.</td></tr>`; return;}

    appointments.forEach(appt => {
        if (appt.appt_status === "Pending") pendingCount++;
        if (appt.appt_status === "Approved") approvedCount++;
        if (appt.appt_status === "Completed") {
            totalEarnings += parseInt(appt.doctor_earning || 0);
            
            // Calculate 10% BhavyaCare Commission for Dues
            if (appt.settlement_status !== "PAID") {
                let mrp = parseInt(appt.total_mrp) || 0;
                let commission = Math.round(mrp * 0.10);
                totalDues += commission;
            }
        }

        let statusBadge = "";
        if(appt.appt_status === "Pending") statusBadge = `<span class="badge bg-warning">Pending</span>`;
        else if(appt.appt_status === "Approved") statusBadge = `<span class="badge bg-info">Approved</span>`;
        else if(appt.appt_status === "Completed") statusBadge = `<span class="badge bg-success">Completed</span>`;
        else statusBadge = `<span class="badge bg-danger">${appt.appt_status}</span>`;

        let typeBadge = appt.consult_type === "Online" ? "💻 Online" : "🏥 Clinic";
        let actionHTML = "";
        
        if (appt.appt_status === "Pending") {
            actionHTML = `<button class="btn btn-approve" style="padding:8px 12px; width:100%;" onclick="openApproveModal('${appt.appt_id}', '${appt.patient_id}', '${appt.cleanDate}', '${appt.cleanTime}', '${appt.consult_type}')">✅ View Details</button>`;
        } else if (appt.appt_status === "Approved") {
            
            if (appt.consult_type === "Online") {
                if (appt.handshake_status === "Patient_Ready") {
                    actionHTML += `<button class="btn btn-join" style="display:block; width:100%; margin-bottom:5px;" onclick="joinVideoCall('${appt.host_meet_link || appt.meet_link}', '${appt.appt_id}')">📹 Join Video Call</button>`;
                } else if (appt.handshake_status === "Doctor_Ready") {
                    actionHTML += `<div style="text-align:center; font-size:11px; color:#856404; background:#fff3cd; padding:5px; border-radius:5px; margin-bottom:5px;">Notified. Waiting for patient...</div>`;
                }
            }

            actionHTML += `
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-complete" style="flex:1;" onclick="handleCompleteAction('${appt.appt_id}', '${appt.consult_type}')">✔️ Done</button>
                    <button class="btn btn-noshow" style="flex:1;" onclick="openDoctorRejectModal('${appt.appt_id}')">❌ Cancel</button>
                </div>
            `;
        } else if (appt.appt_status === "Completed") {
            actionHTML = `<span style="color:#28a745; font-weight:bold;"><i class="fas fa-check-circle"></i> Done</span>`;
            if (appt.prescription_link && appt.prescription_link !== "") {
                actionHTML += `<br><a href="${appt.prescription_link}" target="_blank" style="display:inline-block; margin-top:8px; background:#e8f5e9; color:#2e7d32; padding:6px 12px; border-radius:5px; text-decoration:none; font-size:11px; font-weight:bold; border: 1px solid #c8e6c9;">📄 View Rx</a>`;
            }
        } else {
            actionHTML = `<span style="color:#888; font-size:12px; font-style:italic;">No Action</span>`; 
        }

        let paymentText = appt.consult_type === "Online" ? `<a href="${appt.payment_screenshot}" target="_blank" style="color:#0056b3; font-weight:bold; font-size:12px;">📄 Receipt</a>` : `<span style="font-size:12px;">At Clinic</span>`;

        tbody.innerHTML += `
            <tr>
                <td><strong style="font-size:13px;">${appt.cleanDate}</strong><br><span style="color:#666; font-size:11px;">${appt.cleanTime}</span></td>
                <td style="font-size:12px;">${typeBadge}</td>
                <td style="font-size:13px;">${appt.patient_id}</td>
                <td>${statusBadge}</td>
                <td>${paymentText}</td>
                <td style="color:#28a745; font-weight:bold; font-size:13px;">₹${appt.doctor_earning || 0}</td>
                <td style="text-align: center;">${actionHTML}</td>
            </tr>
        `;
    });

    document.getElementById("statPending").innerText = pendingCount;
    document.getElementById("statApproved").innerText = approvedCount;
    document.getElementById("statEarnings").innerText = totalEarnings;
    
    // ✨ UPDATE DUES IN DASHBOARD ✨
    let statDuesElement = document.getElementById("statDues");
    if(statDuesElement) statDuesElement.innerText = totalDues;
    
    drawDoctorCharts();
}

function renderReviews() {
    const container = document.getElementById("reviewsContainer");
    let html = "";
    allDoctorAppointments.forEach(appt => {
        if (appt.review_json && appt.review_json.trim() !== "") {
            try {
                let rev = JSON.parse(appt.review_json); let starsHtml = "";
                for(let i=1; i<=5; i++) starsHtml += i <= rev.rating ? '<i class="fas fa-star" style="color:#ffc107;"></i> ' : '<i class="fas fa-star" style="color:#e0e0e0;"></i> ';
                html += `
                <div style="background:white; padding:20px; border-radius:12px; border-left:5px solid #ffc107; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div><strong style="color:var(--primary); font-size:14px;">${appt.patient_id}</strong><span style="font-size:11px; color:#888; display:block; margin-top:2px;"><i class="far fa-calendar-alt"></i> ${appt.cleanDate}</span></div>
                        <div style="font-size:14px;">${starsHtml}</div>
                    </div>
                    <p style="margin:0; font-size:13px; color:#555; font-style:italic;">"${rev.comment || "No comment provided."}"</p>
                </div>`;
            } catch(e) { console.log(e); }
        }
    });
    if(html === "") html = "<div style='grid-column: 1/-1; text-align:center; padding:40px; color:#888; font-size:15px;'><i class='fas fa-star-half-alt' style='font-size:40px; color:#ddd; margin-bottom:15px; display:block;'></i> No patient reviews yet.</div>";
    container.innerHTML = html;
}

function handleCompleteAction(apptId, consultType) {
    if (consultType === "Online") {
        document.getElementById("completeApptIdHidden").value = apptId;
        document.getElementById("prescriptionFileInput").value = ""; 
        document.getElementById("rxValidityDays").value = "3"; 
        document.getElementById("prescription-modal").style.display = "block";
    } else {
        updateApptStatus(apptId, 'complete');
    }
}

// ✨ SMART IMAGE COMPRESSOR (Phase 3) ✨
function getBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            if(file.size > 5 * 1024 * 1024) return reject("PDF size cannot exceed 5MB.");
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); 
            reader.onerror = error => reject(error);
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');
                let width = img.width, height = img.height;
                const MAX_DIM = 1000; 
                if (width > height && width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } 
                else if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL(file.type, 0.7).split(',')[1]); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

async function submitPrescriptionAndComplete() {
    const apptId = document.getElementById("completeApptIdHidden").value;
    const fileInput = document.getElementById("prescriptionFileInput");
    const validity = document.getElementById("rxValidityDays").value;
    const btn = document.getElementById("btnUploadPrescription");
    
    if (!fileInput.files || fileInput.files.length === 0) { alert("Please select a prescription file."); return; }
    if(!confirm("Mark as COMPLETED and save prescription?")) return;

    const file = fileInput.files[0];
    btn.innerText = "Uploading & Completing..."; btn.disabled = true;
    
    try {
        const base64Data = await getBase64(file);
        const mimeType = file.type;
        document.getElementById("loader").style.display = "block"; document.getElementById("apptTable").style.display = "none"; document.getElementById("prescription-modal").style.display = "none";
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processAppointmentAction", appt_id: apptId, appt_action: "complete", prescription_base64: base64Data, prescription_mime: mimeType, valid_days: validity })
        });
        const resData = await response.json();
        if(resData.status === "success") { alert("Prescription saved successfully!"); fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); } 
        else { alert("Error: " + resData.message); location.reload(); }
    } catch(e) { alert("Failed to upload."); location.reload(); } 
    finally { btn.innerText = "Upload & Mark Completed"; btn.disabled = false; }
}

async function updateApptStatus(apptId, actionType) {
    if(!confirm("Are you sure you want to mark this as " + actionType.toUpperCase() + "?")) return;
    try {
        document.getElementById("loader").style.display = "block"; document.getElementById("apptTable").style.display = "none";
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processAppointmentAction", appt_id: apptId, appt_action: actionType })
        });
        const resData = await response.json();
        if(resData.status === "success") { fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); } 
        else { alert("Error: " + resData.message); location.reload(); }
    } catch (e) { alert("Failed to update status."); location.reload(); }
}

function parseDateDDMMYYYY(dateStr) {
    if (!dateStr || dateStr === "N/A") return new Date(0);
    const parts = dateStr.split("-"); 
    if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]); return new Date(dateStr);
}

function calculateSettlement() {
    const fromStr = document.getElementById("ledgerFrom").value; const toStr = document.getElementById("ledgerTo").value;
    if(!fromStr || !toStr) return;
    const fromDate = new Date(fromStr); fromDate.setHours(0,0,0,0); const toDate = new Date(toStr); toDate.setHours(23, 59, 59, 999); 
    const tbody = document.getElementById("ledgerTableBody"); tbody.innerHTML = "";
    let sumCollected = 0; let sumFee = 0; let sumRefund = 0; let sumNet = 0; let count = 0;

    allDoctorAppointments.forEach(appt => {
        let isCompleted = appt.appt_status === "Completed"; 
        let isRefunded = appt.refund_status && (appt.refund_status.includes("Refunded") || appt.refund_status.includes("Pending") || appt.refund_status.includes("Action Required"));
        
        if (isCompleted || isRefunded) {
            const apptDateObj = parseDateDDMMYYYY(appt.cleanDate);
            if (apptDateObj >= fromDate && apptDateObj <= toDate) {
                count++;
                let mrp = parseInt(appt.total_mrp) || 0; let earning = parseInt(appt.doctor_earning) || 0; let collected = Math.round(mrp * 0.90); let platformFee = collected - earning;
                if (isCompleted && !isRefunded) {
                    sumCollected += collected; sumFee += platformFee; sumNet += earning;
                    tbody.innerHTML += `<tr><td><span style="font-size:12px;">${appt.cleanDate}</span></td><td><strong style="color:#0056b3; font-size:12px;">${appt.appt_id}</strong></td><td style="font-size:12px;">${appt.consult_type}</td><td style="font-size:13px;">₹${collected}</td><td style="color:#0056b3; font-size:13px;">-₹${platformFee}</td><td style="font-size:13px;">-</td><td style="color:#28a745; font-weight:bold; font-size:13px;">₹${earning}</td></tr>`;
                } else if (isRefunded) {
                    sumRefund += collected; sumNet -= collected; 
                    tbody.innerHTML += `<tr style="background: #fff5f5;"><td><span style="font-size:12px;">${appt.cleanDate}</span></td><td><strong style="color:#dc3545; font-size:12px;">${appt.appt_id}</strong></td><td style="font-size:12px;">${appt.consult_type} <span style="font-size:9px; background:#dc3545; color:white; padding:2px; border-radius:3px;">CANC</span></td><td style="color:#999; font-size:13px;">₹0</td><td style="color:#999; font-size:13px;">₹0</td><td style="color:#dc3545; font-weight:bold; font-size:13px;">-₹${collected}</td><td style="color:#dc3545; font-weight:bold; font-size:13px;">-₹${collected}</td></tr>`;
                }
            }
        }
    });

    if(count === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No data found for selected dates.</td></tr>`; document.getElementById("ledgerTableFoot").style.display = "none"; } 
    else { document.getElementById("ledgerTableFoot").style.display = "table-footer-group"; document.getElementById("footCollected").innerText = sumCollected; document.getElementById("footFee").innerText = sumFee; document.getElementById("footRefund").innerText = sumRefund; document.getElementById("footNet").innerText = sumNet; }
    document.getElementById("ledgTotal").innerText = sumCollected; document.getElementById("ledgFee").innerText = sumFee; document.getElementById("ledgRefund").innerText = sumRefund; document.getElementById("ledgNet").innerText = sumNet;
}

function downloadLedgerPDF() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    const fromStr = document.getElementById("ledgerFrom").value; const toStr = document.getElementById("ledgerTo").value; const docName = document.getElementById("displayDocName").innerText;
    doc.setFontSize(16); doc.setTextColor(0, 86, 179); doc.text("BhavyaCare Settlement Ledger", 14, 15);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text(`Doctor: Dr. ${docName}`, 14, 22); doc.text(`Period: ${fromStr} to ${toStr}`, 14, 27);
    
    const tbody = document.getElementById("ledgerTableBody");
    if (tbody.rows.length === 0 || tbody.innerHTML.includes("No data found")) { alert("No data available to download."); return; }
    
    let bodyData = [];
    tbody.querySelectorAll("tr").forEach(row => { let rowData = []; row.querySelectorAll("td").forEach(c => { let text = c.innerText.replace(/₹/g, '').replace(/CANC/g, '').trim(); if(text.includes("\n")) text = text.split("\n")[0].trim(); rowData.push(text); }); bodyData.push(rowData); });
    let footData = []; let footRow = document.querySelector("#ledgerTableFoot tr");
    if(footRow) { let fData = ["GRAND TOTAL", "", ""]; fData.push(footRow.querySelectorAll("td")[1].innerText.replace(/₹/g, '').trim()); fData.push(footRow.querySelectorAll("td")[2].innerText.replace(/₹/g, '').trim()); fData.push(footRow.querySelectorAll("td")[3].innerText.replace(/₹/g, '').trim()); fData.push(footRow.querySelectorAll("td")[4].innerText.replace(/₹/g, '').trim()); footData.push(fData); }

    doc.autoTable({ head: [['Date', 'Appt ID', 'Type', 'Collected (INR)', 'Platform Fee (INR)', 'Refunded (INR)', 'Net Earning (INR)']], body: bodyData, foot: footData, startY: 32, theme: 'grid', headStyles: { fillColor: [0, 86, 179] }, footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }, styles: { fontSize: 9 } });
    doc.save(`BhavyaCare_Settlement_${fromStr}_to_${toStr}.pdf`);
}

function logoutDoctor() { localStorage.clear(); window.location.href = "../index.html"; }

function openApproveModal(apptId, patientId, date, time, type) {
    document.getElementById("approveApptIdHidden").value = apptId;
    document.getElementById("approveDetailsDiv").innerHTML = `<strong>Patient ID:</strong> ${patientId}<br><strong>Date & Time:</strong> ${date} at ${time}<br><strong>Type:</strong> ${type}`;
    document.getElementById("approve-booking-modal").style.display = "block";
}

function confirmApproveBooking() {
    const apptId = document.getElementById("approveApptIdHidden").value;
    document.getElementById("approve-booking-modal").style.display = "none";
    updateApptStatus(apptId, 'approve');
}

function openDoctorRejectModalFromApprove() {
    const apptId = document.getElementById("approveApptIdHidden").value;
    document.getElementById("approve-booking-modal").style.display = "none";
    
    document.getElementById("rejectApptIdHidden").value = apptId;
    document.getElementById("doctorRejectReason").value = "payment_not_received";
    document.getElementById("doctor-reject-modal").style.display = "block";
}

function openDoctorRejectModal(apptId) {
    document.getElementById("rejectApptIdHidden").value = apptId;
    document.getElementById("doctorRejectReason").value = "doctor_unavailable";
    document.getElementById("doctor-reject-modal").style.display = "block";
}

async function submitRejectBooking() {
    const apptId = document.getElementById("rejectApptIdHidden").value;
    const reason = document.getElementById("doctorRejectReason").value;
    const btn = document.getElementById("btnConfirmReject");
    
    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                action: "processAppointmentAction", 
                appt_id: apptId, 
                appt_action: "reject",
                cancel_reason: reason
            })
        });
        
        const resData = await response.json();
        if(resData.status === "success") { 
            alert("Appointment Cancelled successfully.");
            document.getElementById("doctor-reject-modal").style.display = "none";
            fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); 
        } 
        else { alert("Error: " + resData.message); location.reload(); }
    } catch (e) { alert("Failed to cancel."); location.reload(); }
    finally { btn.innerText = "Confirm Cancel"; btn.disabled = false; }
}

setInterval(silentDoctorPolling, 30000);

async function silentDoctorPolling() {
    const docId = localStorage.getItem("bhavya_user_id");
    if(!docId || document.getElementById("loader").style.display === "block") return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getDoctorAppointments", doctor_id: docId })
        });
        const resData = await response.json();
        if (resData.status === "success") {
            allDoctorAppointments = resData.data.map(appt => { appt.cleanDate = formatDate(appt.appt_date); appt.cleanTime = formatTime(appt.appt_time); return appt; }).reverse();
            renderAppointments(allDoctorAppointments); 
            checkDoctorHandshakeTrigger();
        }
    } catch(e) { console.log("Silent poll failed"); }
}

function checkDoctorHandshakeTrigger() {
    const now = new Date();
    allDoctorAppointments.forEach(appt => {
        if (appt.appt_status === "Approved" && appt.consult_type === "Online") {
            const [day, month, year] = appt.cleanDate.split("-");
            let [timePart, modifier] = appt.cleanTime.split(" ");
            let [hours, minutes] = timePart ? timePart.split(":") : [0,0];
            hours = parseInt(hours, 10);
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            const apptDateTime = new Date(year, month - 1, day, hours, minutes);
            const diffInMinutes = (now - apptDateTime) / (1000 * 60);

            if (diffInMinutes >= -10 && diffInMinutes <= 45) {
                if ((!appt.handshake_status || appt.handshake_status === "") && !handledDocTriggers.has(appt.appt_id)) {
                    if(document.getElementById("doctor-trigger-modal").style.display !== "block") {
                        
                        document.getElementById("doctor-trigger-modal").innerHTML = `
                            <div style="text-align: center; padding: 15px;">
                                <input type="hidden" id="triggerApptIdHidden" value="${appt.appt_id}">
                                <i class="fas fa-bell" style="font-size: 40px; color: #0056b3; margin-bottom:15px;"></i>
                                <h3 style="margin:0; color: #333; font-size: 22px;">Consultation Time!</h3>
                                <p style="color:#555; font-size:14px; margin-top:10px;">Your consult time is here. Send notification to patient?</p>
                                <button style="background:#0056b3; width:100%; color:white; border:none; font-weight:bold; padding:12px; border-radius:8px; cursor:pointer; margin-top:15px;" onclick="doctorStartsConsult()">OK, Notify Patient</button>
                            </div>
                        `;
                        document.getElementById("doctor-trigger-modal").style.display = "block";
                        handledDocTriggers.add(appt.appt_id); 
                    }
                } 
            }
        }
    });
}

async function doctorStartsConsult() {
    const apptId = document.getElementById("triggerApptIdHidden").value;
    document.getElementById("doctor-trigger-modal").style.display = "none";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateHandshakeStatus", appt_id: apptId, handshake_status: "Doctor_Ready" })
        });
        const res = await response.json();
        if(res.status === "success") {
            const appt = allDoctorAppointments.find(a => a.appt_id == apptId);
            if(appt) appt.handshake_status = "Doctor_Ready";
            renderAppointments(allDoctorAppointments); 
        }
    } catch(e) { alert("Failed to notify patient."); } 
}

function joinVideoCall(link, apptId) {
    if (!link || link === "" || link === "N/A") { alert("Video consultation link is not available yet."); return; }
    
    activeVideoCallApptId = apptId; 
    const docName = localStorage.getItem("bhavya_name") || "Doctor";
    const finalLink = link + "?name=" + encodeURIComponent("Dr. " + docName);

    const modal = document.createElement('div');
    modal.id = "video-modal";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; flex-direction:column;";
    modal.innerHTML = `
        <div style="height:60px; background:#0056b3; color:white; display:flex; justify-content:space-between; align-items:center; padding:0 20px;">
            <h3 style="margin:0; font-size:16px;">BhavyaCare Video Consult</h3>
            <button onclick="closeVideoCall()" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">End Call / Close</button>
        </div>
        <iframe src="${finalLink}" allow="camera; microphone; fullscreen; display-capture; autoplay" style="width:100%; flex-grow:1; border:none;"></iframe>
    `;
    document.body.appendChild(modal);
}

function closeVideoCall() {
    const endedApptId = activeVideoCallApptId;
    const modal = document.getElementById('video-modal');
    if (modal) modal.remove();
    activeVideoCallApptId = null; 

    if (endedApptId) {
        document.getElementById("completeApptIdHidden").value = endedApptId;
        document.getElementById("prescriptionFileInput").value = "";
        document.getElementById("rxValidityDays").value = "3";
        document.getElementById("prescription-modal").style.display = "block";
    }
    fetchDoctorAppointments(localStorage.getItem("bhavya_user_id"));
}

function drawDoctorCharts() {
    let pending = 0, approved = 0, completed = 0, cancelled = 0;
    let revenueByDate = {};

    allDoctorAppointments.forEach(appt => {
        if(appt.appt_status === "Pending") pending++;
        else if(appt.appt_status === "Approved") approved++;
        else if(appt.appt_status === "Completed") completed++;
        else cancelled++;

        if(appt.appt_status === "Completed") {
            let dateStr = appt.cleanDate.substring(0, 5);
            let earn = parseInt(appt.doctor_earning) || 0;
            if(!revenueByDate[dateStr]) revenueByDate[dateStr] = 0;
            revenueByDate[dateStr] += earn;
        }
    });

    const ctx1 = document.getElementById('docApptChart').getContext('2d');
    if(docApptChart) docApptChart.destroy();
    docApptChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Approved', 'Completed', 'Cancelled'],
            datasets: [{
                data: [pending, approved, completed, cancelled],
                backgroundColor: ['#ffc107', '#17a2b8', '#28a745', '#dc3545'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: {size: 11} } },
                datalabels: { color: '#fff', font: {weight: 'bold'}, formatter: (v) => v > 0 ? v : '' }
            }
        }
    });

    let labels = Object.keys(revenueByDate).reverse();
    let dataVals = Object.values(revenueByDate).reverse();

    const ctx2 = document.getElementById('docRevenueChart').getContext('2d');
    if(docRevenueChart) docRevenueChart.destroy();
    docRevenueChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{
                label: 'Earnings (₹)',
                data: dataVals.length > 0 ? dataVals : [0],
                backgroundColor: '#28a745',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { align: 'end', anchor: 'end', color: '#28a745', font: {weight: 'bold'}, formatter: (v) => v > 0 ? '₹'+v : '' }
            },
            scales: { y: { display: false } }
        }
    });
}

// ✨ DOCTOR PAYMENT LOGIC ✨
function openDoctorPayModal() {
    const amount = document.getElementById("statDues").innerText;
    if (parseInt(amount) <= 0) { showToast("No outstanding dues!", "info"); return; }

    document.getElementById("payModalAmount").innerText = amount;
    const upi = "bhavyacare@upi"; // 👈 Apni Website ki UPI ID yahan daalein
    const upiLink = `upi://pay?pa=${upi}&pn=BhavyaCare&am=${amount}&cu=INR`;
    
    document.getElementById("doctorUpiDeepLink").href = upiLink;
    document.getElementById("doctorPayQr").src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;
    document.getElementById("doctor-pay-modal").style.display = "block";
}

async function submitDocCommission() {
    const fileInput = document.getElementById("doctorPayScreenshot");
    const amount = document.getElementById("payModalAmount").innerText;
    const btn = document.getElementById("btnSubmitDocPay");

    if (fileInput.files.length === 0) { showToast("Please upload screenshot", "error"); return; }

    btn.style.display = "none";
    document.getElementById("docPayLoader").style.display = "block";

    try {
        const base64 = await getBase64(fileInput.files[0]);
        const payload = {
            action: "submitDoctorSettlement",
            data: {
                doctor_id: localStorage.getItem("bhavya_user_id"),
                amount: amount,
                screenshot_base64: base64,
                screenshot_mime: fileInput.files[0].type
            }
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const res = await response.json();

        if (res.status === "success") {
            showToast("Payment submitted for verification!", "success");
            document.getElementById("doctor-pay-modal").style.display = "none";
            fileInput.value = "";
        } else {
            showToast(res.message, "error");
        }
    } catch (e) { showToast("Error submitting payment", "error"); }
    finally {
        btn.style.display = "block";
        document.getElementById("docPayLoader").style.display = "none";
    }
}
