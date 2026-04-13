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
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
    
    const formatForInput = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');

    document.getElementById("ledgerFrom").value = formatForInput(firstDay);
    document.getElementById("ledgerTo").value = formatForInput(lastDay); 

    fetchDoctorAppointments(docId);
};

function switchTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu li').forEach(l => l.classList.remove('active'));

    document.getElementById('sec-' + tabId).classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    
    let titles = { 'appt': 'Manage Appointments', 'ledger': 'Settlement Ledger', 'reviews': 'Patient Reviews' };
    document.getElementById('pageTitle').innerText = titles[tabId];
}

function formatDate(rawDate) {
    if (!rawDate) return "N/A";
    let dateStr = String(rawDate).trim();
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) return dateStr;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`; 
    return dateStr;
}

function formatTime(rawTime) {
    if (!rawTime) return "N/A";
    let timeStr = String(rawTime).trim();
    if (timeStr.includes("T") || timeStr.includes("Z")) {
        let d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
            let h = d.getHours(); let m = d.getMinutes(); let ampm = h >= 12 ? 'PM' : 'AM';
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
            renderReviews(); // 🌟 REVIEW FIX CALL 🌟
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

    if(appointments.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No appointments found.</td></tr>`; return;}

    appointments.forEach(appt => {
        if (appt.appt_status === "Pending") pendingCount++;
        if (appt.appt_status === "Approved") approvedCount++;
        if (appt.appt_status === "Completed") totalEarnings += parseInt(appt.doctor_earning || 0);

        let statusBadge = "";
        if(appt.appt_status === "Pending") statusBadge = `<span class="badge bg-warning">Pending</span>`;
        else if(appt.appt_status === "Approved") statusBadge = `<span class="badge bg-info">Approved</span>`;
        else if(appt.appt_status === "Completed") statusBadge = `<span class="badge bg-success">Completed</span>`;
        else statusBadge = `<span class="badge bg-danger">${appt.appt_status}</span>`;

        let typeBadge = appt.consult_type === "Online" ? "💻 Online" : "🏥 Clinic";
        let actionHTML = "";
        
        if (appt.appt_status === "Pending") {
            actionHTML = `<button class="btn btn-approve" onclick="updateApptStatus('${appt.appt_id}', 'approve')">✅ Approve</button>`;
        } else if (appt.appt_status === "Approved") {
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
                actionHTML += `<button class="btn btn-join" style="display:block; width:100%; margin-bottom:5px;" onclick="joinJitsiCall('${appt.meet_link}')">📹 Join Call</button>`;
            }
            actionHTML += `
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-complete" style="flex:1;" onclick="handleCompleteAction('${appt.appt_id}', '${appt.consult_type}')">✔️ Done</button>
                    <button class="btn btn-noshow" style="flex:1;" onclick="updateApptStatus('${appt.appt_id}', 'noshow')">❌ Miss</button>
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
}

// 🌟 NAYA: REVIEWS FIX 🌟
function renderReviews() {
    const container = document.getElementById("reviewsContainer");
    let html = "";

    allDoctorAppointments.forEach(appt => {
        // Fix: Use review_json as mapped in getDoctorAppointments
        if (appt.review_json && appt.review_json.trim() !== "") {
            try {
                let rev = JSON.parse(appt.review_json);
                let starsHtml = "";
                for(let i=1; i<=5; i++) starsHtml += i <= rev.rating ? '<i class="fas fa-star" style="color:#ffc107;"></i> ' : '<i class="fas fa-star" style="color:#e0e0e0;"></i> ';
                
                html += `
                <div style="background:white; padding:20px; border-radius:12px; border-left:5px solid #ffc107; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div>
                            <strong style="color:var(--primary); font-size:14px;">${appt.patient_id}</strong> 
                            <span style="font-size:11px; color:#888; display:block; margin-top:2px;"><i class="far fa-calendar-alt"></i> ${appt.cleanDate}</span>
                        </div>
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

// 🌟 NAYA: VALIDITY ADDED 🌟
function handleCompleteAction(apptId, consultType) {
    if (consultType === "Online") {
        document.getElementById("completeApptIdHidden").value = apptId;
        document.getElementById("prescriptionFileInput").value = ""; 
        document.getElementById("rxValidityDays").value = "3"; // Default 3 Days
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
    const validity = document.getElementById("rxValidityDays").value; // Grab Validity
    const btn = document.getElementById("btnUploadPrescription");
    
    if (!fileInput.files || fileInput.files.length === 0) { alert("Please select a prescription file."); return; }
    if(!confirm("Mark as COMPLETED and save prescription?")) return;

    const file = fileInput.files[0];
    btn.innerText = "Uploading & Completing..."; btn.disabled = true;
    
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
                prescription_mime: mimeType,
                valid_days: validity // Send to Backend
            })
        });
        
        const resData = await response.json();
        if(resData.status === "success") {
            alert("Prescription saved successfully!");
            fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); 
        } else { alert("Error: " + resData.message); location.reload(); }
    } catch(e) { alert("Failed to upload."); location.reload(); } 
    finally { btn.innerText = "Upload & Mark Completed"; btn.disabled = false; }
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
        if(resData.status === "success") { fetchDoctorAppointments(localStorage.getItem("bhavya_user_id")); } 
        else { alert("Error: " + resData.message); location.reload(); }
    } catch (e) { alert("Failed to update status."); location.reload(); }
}

function parseDateDDMMYYYY(dateStr) {
    if (!dateStr || dateStr === "N/A") return new Date(0);
    const parts = dateStr.split("-"); 
    if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(dateStr);
}

function calculateSettlement() {
    const fromStr = document.getElementById("ledgerFrom").value;
    const toStr = document.getElementById("ledgerTo").value;
    if(!fromStr || !toStr) return;
    
    const fromDate = new Date(fromStr); fromDate.setHours(0,0,0,0);
    const toDate = new Date(toStr); toDate.setHours(23, 59, 59, 999); 

    const tbody = document.getElementById("ledgerTableBody");
    tbody.innerHTML = "";
    
    let sumCollected = 0; let sumFee = 0; let sumRefund = 0; let sumNet = 0; let count = 0;

    allDoctorAppointments.forEach(appt => {
        let isCompleted = appt.appt_status === "Completed";
        let isRefunded = appt.refund_status && (appt.refund_status.includes("Refunded") || appt.refund_status.includes("Pending"));

        if (isCompleted || isRefunded) {
            const apptDateObj = parseDateDDMMYYYY(appt.cleanDate);
            
            if (apptDateObj >= fromDate && apptDateObj <= toDate) {
                count++;
                let mrp = parseInt(appt.total_mrp) || 0;
                let earning = parseInt(appt.doctor_earning) || 0;
                let collected = Math.round(mrp * 0.90); 
                let platformFee = collected - earning;

                if (isCompleted && !isRefunded) {
                    sumCollected += collected; sumFee += platformFee; sumNet += earning;

                    tbody.innerHTML += `
                        <tr>
                            <td><span style="font-size:12px;">${appt.cleanDate}</span></td>
                            <td><strong style="color:#0056b3; font-size:12px;">${appt.appt_id}</strong></td>
                            <td style="font-size:12px;">${appt.consult_type}</td>
                            <td style="font-size:13px;">₹${collected}</td>
                            <td style="color:#0056b3; font-size:13px;">-₹${platformFee}</td>
                            <td style="font-size:13px;">-</td>
                            <td style="color:#28a745; font-weight:bold; font-size:13px;">₹${earning}</td>
                        </tr>
                    `;
                } else if (isRefunded) {
                    sumRefund += collected; sumNet -= collected; 

                    tbody.innerHTML += `
                        <tr style="background: #fff5f5;">
                            <td><span style="font-size:12px;">${appt.cleanDate}</span></td>
                            <td><strong style="color:#dc3545; font-size:12px;">${appt.appt_id}</strong></td>
                            <td style="font-size:12px;">${appt.consult_type} <span style="font-size:9px; background:#dc3545; color:white; padding:2px; border-radius:3px;">CANC</span></td>
                            <td style="color:#999; font-size:13px;">₹0</td>
                            <td style="color:#999; font-size:13px;">₹0</td>
                            <td style="color:#dc3545; font-weight:bold; font-size:13px;">-₹${collected}</td>
                            <td style="color:#dc3545; font-weight:bold; font-size:13px;">-₹${collected}</td>
                        </tr>
                    `;
                }
            }
        }
    });

    if(count === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No data found for selected dates.</td></tr>`;
        document.getElementById("ledgerTableFoot").style.display = "none";
    } else {
        document.getElementById("ledgerTableFoot").style.display = "table-footer-group";
        document.getElementById("footCollected").innerText = sumCollected;
        document.getElementById("footFee").innerText = sumFee;
        document.getElementById("footRefund").innerText = sumRefund;
        document.getElementById("footNet").innerText = sumNet;
    }

    document.getElementById("ledgTotal").innerText = sumCollected;
    document.getElementById("ledgFee").innerText = sumFee;
    document.getElementById("ledgRefund").innerText = sumRefund;
    document.getElementById("ledgNet").innerText = sumNet;
}

// 🌟 NAYA: PDF DOWNLOAD LOGIC 🌟
function downloadLedgerPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const fromStr = document.getElementById("ledgerFrom").value;
    const toStr = document.getElementById("ledgerTo").value;
    const docName = document.getElementById("displayDocName").innerText;
    
    doc.setFontSize(16);
    doc.setTextColor(0, 86, 179);
    doc.text("BhavyaCare Settlement Ledger", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Doctor: Dr. ${docName}`, 14, 22);
    doc.text(`Period: ${fromStr} to ${toStr}`, 14, 27);
    
    const tbody = document.getElementById("ledgerTableBody");
    if (tbody.rows.length === 0 || tbody.innerHTML.includes("No data found")) {
        alert("No data available to download."); return;
    }
    
    let bodyData = [];
    tbody.querySelectorAll("tr").forEach(row => {
        let rowData = [];
        row.querySelectorAll("td").forEach(c => {
            let text = c.innerText.replace(/₹/g, '').replace(/CANC/g, '').trim();
            if(text.includes("\n")) text = text.split("\n")[0].trim();
            rowData.push(text);
        });
        bodyData.push(rowData);
    });

    let footData = [];
    let footRow = document.querySelector("#ledgerTableFoot tr");
    if(footRow) {
        let fData = ["GRAND TOTAL", "", ""];
        let fCols = footRow.querySelectorAll("td");
        fData.push(fCols[1].innerText.replace(/₹/g, '').trim());
        fData.push(fCols[2].innerText.replace(/₹/g, '').trim());
        fData.push(fCols[3].innerText.replace(/₹/g, '').trim());
        fData.push(fCols[4].innerText.replace(/₹/g, '').trim());
        footData.push(fData);
    }

    doc.autoTable({
        head: [['Date', 'Appt ID', 'Type', 'Collected (INR)', 'Platform Fee (INR)', 'Refunded (INR)', 'Net Earning (INR)']],
        body: bodyData,
        foot: footData,
        startY: 32,
        theme: 'grid',
        headStyles: { fillColor: [0, 86, 179] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9 }
    });
    
    doc.save(`BhavyaCare_Settlement_${fromStr}_to_${toStr}.pdf`);
}

// 🌟 NAYA: JITSI AUTO CLOSE & REFRESH 🌟
function joinJitsiCall(link) {
    const modal = document.createElement('div');
    modal.id = "jitsi-modal";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; flex-direction:column;";
    
    modal.innerHTML = `
        <div style="height:60px; background:#0056b3; color:white; display:flex; justify-content:space-between; align-items:center; padding:0 20px;">
            <h3 style="margin:0; font-size:16px;">BhavyaCare Video Consult</h3>
            <button onclick="closeJitsiCall()" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">End Call / Close</button>
        </div>
        <iframe src="${link}" allow="camera; microphone; fullscreen; display-capture; autoplay" style="width:100%; flex-grow:1; border:none;"></iframe>
    `;
    document.body.appendChild(modal);
}

function closeJitsiCall() {
    const modal = document.getElementById('jitsi-modal');
    if (modal) modal.remove();
    // Auto refresh data to check if any state changed
    fetchDoctorAppointments(localStorage.getItem("bhavya_user_id"));
}

function logoutDoctor() { localStorage.clear(); window.location.href = "../index.html"; }
