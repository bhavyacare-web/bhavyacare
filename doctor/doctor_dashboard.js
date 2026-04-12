const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allDoctorAppointments = []; 

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
    
    // 🌟 TIMEZONE BUG FIX & AUTO-MONTH SETTER 🌟
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Mahine ka aakhri din (e.g. 30 April)
    
    // Exact YYYY-MM-DD format banane ka function taaki timezone gadbad na kare
    const formatForInput = (d) => {
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
    };

    document.getElementById("ledgerFrom").value = formatForInput(firstDay);
    document.getElementById("ledgerTo").value = formatForInput(lastDay); // Ab ye 30-Apr-2026 set hoga

    fetchDoctorAppointments(docId);
};

function switchTab(tabId) {
    document.getElementById('sec-appt').classList.remove('active');
    document.getElementById('sec-ledger').classList.remove('active');
    document.getElementById('tab-appt').classList.remove('active');
    document.getElementById('tab-ledger').classList.remove('active');

    document.getElementById('sec-' + tabId).classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    
    document.getElementById('pageTitle').innerText = tabId === 'appt' ? 'Manage Appointments' : 'Settlement Ledger';
}

function formatDate(rawDate) {
    if (!rawDate) return "N/A";
    let dateStr = String(rawDate).trim();
    
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
        return dateStr;
    }
    
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        let day = d.getDate().toString().padStart(2, '0');
        let month = (d.getMonth() + 1).toString().padStart(2, '0');
        let year = d.getFullYear();
        return `${day}-${month}-${year}`; 
    }
    return dateStr;
}

function formatTime(rawTime) {
    if (!rawTime) return "N/A";
    let timeStr = String(rawTime).trim();
    if (timeStr.includes("T") || timeStr.includes("Z")) {
        let d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
            let h = d.getHours();
            let m = d.getMinutes();
            let ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h < 10 ? '0'+h : h}:${m < 10 ? '0'+m : m} ${ampm}`;
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
            calculateSettlement(); 
        } else {
            document.getElementById("apptTableBody").innerHTML = `<tr><td colspan="7" style="text-align:center;">${resData.message}</td></tr>`;
        }
    } catch(e) {
        document.getElementById("loader").innerText = "Failed to load data. Please refresh.";
    }
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
    
    let pendingCount = 0;
    let approvedCount = 0;
    let totalEarnings = 0;

    if(appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No appointments found.</td></tr>`;
    }

    appointments.forEach(appt => {
        if (appt.appt_status === "Pending") pendingCount++;
        if (appt.appt_status === "Approved") approvedCount++;
        if (appt.appt_status === "Completed") totalEarnings += parseInt(appt.doctor_earning || 0);

        let statusBadge = "";
        if(appt.appt_status === "Pending") statusBadge = `<span class="badge bg-warning">Pending</span>`;
        else if(appt.appt_status === "Approved") statusBadge = `<span class="badge bg-info">Approved</span>`;
        else if(appt.appt_status === "Completed") statusBadge = `<span class="badge bg-success">Completed</span>`;
        else statusBadge = `<span class="badge bg-danger">${appt.appt_status}</span>`;

        let typeBadge = appt.consult_type === "Online" ? "💻 Online Video" : "🏥 Clinic Visit";

        let actionHTML = "";
        
        if (appt.appt_status === "Pending") {
            actionHTML = `<button class="btn btn-approve" onclick="updateApptStatus('${appt.appt_id}', 'approve')">✅ Approve</button>`;
        } 
        else if (appt.appt_status === "Approved") {
            const now = new Date();
            const [day, month, year] = appt.cleanDate.split("-");
            let [timePart, modifier] = appt.cleanTime.split(" ");
            let [hours, minutes] = timePart ? timePart.split(":") : [0,0];
            
            hours = parseInt(hours, 10);
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            
            const apptDateTime = new Date(year, month - 1, day, hours, minutes);
            const diffInMinutes = (now - apptDateTime) / (1000 * 60);

            if (appt.consult_type === "Online" && diffInMinutes >= -15 && diffInMinutes <= 45) {
                actionHTML += `<button class="btn btn-join" onclick="joinJitsiCall('${appt.meet_link}')">📹 Join Call</button>`;
            }

            actionHTML += `
                <button class="btn btn-complete" onclick="handleCompleteAction('${appt.appt_id}', '${appt.consult_type}')">✔️ Complete</button>
                <button class="btn btn-noshow" onclick="updateApptStatus('${appt.appt_id}', 'noshow')">❌ No-Show</button>
            `;
        } 
        else if (appt.appt_status === "Completed") {
            actionHTML = `<span style="color:#28a745; font-weight:bold;"><i class="fas fa-check-circle"></i> Done</span>`;
            
            if (appt.prescription_link && appt.prescription_link !== "") {
                actionHTML += `<br><a href="${appt.prescription_link}" target="_blank" style="display:inline-block; margin-top:8px; background:#e8f5e9; color:#2e7d32; padding:6px 12px; border-radius:5px; text-decoration:none; font-size:12px; font-weight:bold; border: 1px solid #c8e6c9;">📄 View Rx</a>`;
            }
        }
        else if (appt.appt_status === "Patient No-Show") {
            actionHTML = `<span style="color:#dc3545; font-weight:bold;"><i class="fas fa-times-circle"></i> No-Show</span>`;
        }
        else {
            actionHTML = `<span style="color:#888; font-style:italic;">No Actions Required</span>`; 
        }

        let paymentText = appt.consult_type === "Online" ? `<a href="${appt.payment_screenshot}" target="_blank" style="color:#0056b3; font-weight:bold;">📄 View Screenshot</a>` : `Pay at Clinic`;

        const row = `
            <tr>
                <td><strong>${appt.cleanDate}</strong><br><span style="color:#666; font-size:12px;">${appt.cleanTime}</span></td>
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

function handleCompleteAction(apptId, consultType) {
    if (consultType === "Online") {
        document.getElementById("completeApptIdHidden").value = apptId;
        document.getElementById("prescriptionFileInput").value = ""; 
        document.getElementById("prescription-modal").style.display = "block";
    } else {
        updateApptStatus(apptId, 'complete');
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

async function submitPrescriptionAndComplete() {
    const apptId = document.getElementById("completeApptIdHidden").value;
    const fileInput = document.getElementById("prescriptionFileInput");
    const btn = document.getElementById("btnUploadPrescription");
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please select a prescription file to complete the online consultation.");
        return;
    }
    
    if(!confirm("Are you sure you want to mark this as COMPLETED?")) return;

    const file = fileInput.files[0];
    btn.innerText = "Uploading & Completing...";
    btn.disabled = true;
    
    try {
        const base64Data = await getBase64(file);
        const mimeType = file.type;
        
        document.getElementById("loader").style.display = "block";
        document.getElementById("apptTable").style.display = "none";
        document.getElementById("prescription-modal").style.display = "none";

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                action: "processAppointmentAction", 
                appt_id: apptId, 
                appt_action: "complete",
                prescription_base64: base64Data,
                prescription_mime: mimeType
            })
        });
        
        const resData = await response.json();
        if(resData.status === "success") {
            alert("Prescription uploaded and appointment completed!");
            fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); 
        } else {
            alert("Error: " + resData.message);
            location.reload();
        }
    } catch(e) {
        alert("Failed to upload prescription. Check network.");
        location.reload();
    } finally {
        btn.innerText = "Upload & Mark Completed";
        btn.disabled = false;
    }
}

async function updateApptStatus(apptId, actionType) {
    if(!confirm("Are you sure you want to mark this as " + actionType.toUpperCase() + "?")) return;

    try {
        document.getElementById("loader").style.display = "block";
        document.getElementById("apptTable").style.display = "none";

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processAppointmentAction", appt_id: apptId, appt_action: actionType })
        });
        
        const resData = await response.json();
        if(resData.status === "success") {
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

function parseDateDDMMYYYY(dateStr) {
    if (!dateStr || dateStr === "N/A") return new Date(0);
    const parts = dateStr.split("-"); 
    if(parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
}

function calculateSettlement() {
    const fromStr = document.getElementById("ledgerFrom").value;
    const toStr = document.getElementById("ledgerTo").value;
    
    if(!fromStr || !toStr) return;
    
    const fromDate = new Date(fromStr);
    fromDate.setHours(0,0,0,0);
    
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999); 

    const tbody = document.getElementById("ledgerTableBody");
    tbody.innerHTML = "";
    
    let sumCollected = 0;
    let sumFee = 0;
    let sumNet = 0;
    let count = 0;

    allDoctorAppointments.forEach(appt => {
        if (appt.appt_status === "Completed") {
            const apptDateObj = parseDateDDMMYYYY(appt.cleanDate);
            
            if (apptDateObj >= fromDate && apptDateObj <= toDate) {
                count++;
                let mrp = parseInt(appt.total_mrp) || 0;
                let earning = parseInt(appt.doctor_earning) || 0;
                let platformDeduction = mrp - earning; 

                sumCollected += mrp;
                sumFee += platformDeduction;
                sumNet += earning;

                tbody.innerHTML += `
                    <tr>
                        <td>${appt.cleanDate}</td>
                        <td><strong style="color:#0056b3;">${appt.appt_id}</strong></td>
                        <td>${appt.consult_type}</td>
                        <td>₹${mrp}</td>
                        <td style="color:#dc3545;">-₹${platformDeduction}</td>
                        <td style="color:#28a745; font-weight:bold;">₹${earning}</td>
                    </tr>
                `;
            }
        }
    });

    if(count === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">No completed appointments found for selected dates.</td></tr>`;
        document.getElementById("ledgerTableFoot").style.display = "none";
    } else {
        document.getElementById("ledgerTableFoot").style.display = "table-footer-group";
        document.getElementById("footCollected").innerText = sumCollected;
        document.getElementById("footFee").innerText = sumFee;
        document.getElementById("footNet").innerText = sumNet;
    }

    document.getElementById("ledgTotal").innerText = sumCollected;
    document.getElementById("ledgFee").innerText = sumFee;
    document.getElementById("ledgNet").innerText = sumNet;
}

function downloadLedgerCSV() {
    const fromStr = document.getElementById("ledgerFrom").value;
    const toStr = document.getElementById("ledgerTo").value;
    const tbody = document.getElementById("ledgerTableBody");
    
    if (tbody.rows.length === 0 || tbody.innerHTML.includes("No completed appointments")) {
        alert("No data available to download.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Appointment ID,Consult Type,Collected (MRP),BhavyaCare Fee,Doctor Earning\n";

    const rows = tbody.querySelectorAll("tr");
    rows.forEach(row => {
        let cols = row.querySelectorAll("td");
        let rowData = [];
        cols.forEach(col => {
            let text = col.innerText.replace(/₹/g, '').replace(/-/g, '').trim();
            rowData.push(text);
        });
        csvContent += rowData.join(",") + "\n";
    });
    
    csvContent += `GRAND TOTAL,,,${document.getElementById("footCollected").innerText},${document.getElementById("footFee").innerText},${document.getElementById("footNet").innerText}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Settlement_Report_${fromStr}_to_${toStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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
    window.location.href = "../index.html"; 
}
