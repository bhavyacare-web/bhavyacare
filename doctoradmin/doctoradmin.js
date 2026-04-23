const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allDoctors = [];
let allAppointments = [];

// ✨ NAYE CHART VARIABLES ✨
let adminApptChart = null; 
let adminRevenueChart = null; 
Chart.register(ChartDataLabels);

// ✨ TOAST NOTIFICATION LOGIC ✨
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
    
    let keyframes = document.createElement('style');
    keyframes.innerHTML = `@keyframes fadeInOut { 0% { opacity: 0; transform: translateY(20px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }`;
    document.head.appendChild(keyframes);

    setTimeout(() => { toast.remove(); }, 3000);
}

window.onload = function() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
    const formatForInput = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
    
    document.getElementById("ledgerFrom").value = formatForInput(firstDay);
    document.getElementById("ledgerTo").value = formatForInput(lastDay); 

    fetchAdminData();
};

function switchTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu li').forEach(l => l.classList.remove('active'));
    
    document.getElementById('sec-' + tabId).classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    
    let titles = { 'docs': '👨‍⚕️ Manage Doctors', 'appts': '📅 All Consultations', 'ledger': '🧾 Settlement Ledger', 'reviews': '⭐ Patient Reviews' };
    document.getElementById('pageTitle').innerText = titles[tabId];
}

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
    if (imgSrc === "") { 
        imgSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(docName)}&background=0056b3&color=fff&size=100`; 
    }
    return imgSrc;
}

async function fetchAdminData() {
    document.getElementById("loader").style.display = "block";
    try {
        const [docsRes, apptsRes] = await Promise.all([
            fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "getAdminDoctors" }) }),
            fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "getAllDoctorAppointmentsAdmin" }) })
        ]);

        const docsJson = await docsRes.json();
        const apptsJson = await apptsRes.json();

        document.getElementById("loader").style.display = "none";
        document.getElementById("doctorsTable").style.display = "table";

        if (docsJson.status === "success") {
            allDoctors = docsJson.data.map(d => {
                d.imgUrl = fixDriveUrl(d.imgUrl, d.doctor_name);
                return d;
            });
            filterDoctors();
            populateDoctorDropdowns();
        } else { alert("Error loading doctors: " + docsJson.message); }

        if (apptsJson.status === "success") {
            allAppointments = apptsJson.data;
            document.getElementById("adminApptStats").style.display = "grid"; // Show stats grid
            filterAppts(); 
            renderReviews();
            calculateLedger(); 
            drawAdminCharts(); // ✨ CHARTS RENDER CALL ✨
        } else { console.error("Error loading appts: " + apptsJson.message); }

    } catch (error) {
        alert("System error loading data. Please check internet.");
        document.getElementById("loader").innerText = "Failed to load data.";
    }
}

// ===============================================
// 1. MANAGE DOCTORS LOGIC
// ===============================================

function filterDoctors() {
    const term = document.getElementById("filterDocSearch").value.toLowerCase();
    const filtered = allDoctors.filter(d => 
        d.doctor_name.toLowerCase().includes(term) || 
        d.doctor_id.toLowerCase().includes(term) || 
        d.city.toLowerCase().includes(term)
    );
    renderDocsTable(filtered);
}

function renderDocsTable(doctors) {
    const tbody = document.getElementById("doctorsBody");
    tbody.innerHTML = "";

    if (doctors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#888;">No doctors found matching your search.</td></tr>`;
        return;
    }
    
    doctors.forEach(doc => {
        let actionButtons = "";
        if (doc.status !== "Active") {
            actionButtons = `
                <button class="btn btn-approve" onclick="updateStatus('${doc.doctor_id}', 'Active')">✔ Approve</button>
                <button class="btn btn-reject" onclick="updateStatus('${doc.doctor_id}', 'Rejected')">✖ Reject</button>
            `;
        } else {
            actionButtons = `<button class="btn btn-reject" onclick="updateStatus('${doc.doctor_id}', 'Inactive')">Deactivate</button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="doc-clickable" onclick="showDoctorProfile('${doc.doctor_id}')" title="Click to view full profile">
                    <img src="${doc.imgUrl}" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
                </td>
                <td class="doc-clickable" onclick="showDoctorProfile('${doc.doctor_id}')" style="font-weight:bold; color:var(--primary); cursor:pointer;">${doc.doctor_id}</td>
                <td><strong>${doc.doctor_name}</strong><br><span style="font-size:12px; color:#777;">${doc.speciality}</span></td>
                <td>${doc.clinic_name}, ${doc.city}</td>
                <td><a href="${doc.docUrl}" target="_blank" class="btn btn-view">📄 View Doc</a></td>
                <td><span class="status-badge status-${doc.status}">${doc.status}</span></td>
                <td>${actionButtons}</td>
            </tr>
        `;
    });
}

function showDoctorProfile(docId) {
    const doc = allDoctors.find(d => d.doctor_id === docId);
    if(!doc) return;

    const docAppts = allAppointments.filter(a => a.doctor_id === docId);
    const totalAppts = docAppts.length;
    const completedAppts = docAppts.filter(a => a.appt_status === "Completed").length;
    
    let html = `
        <div style="display:flex; gap:20px; align-items:center; border-bottom:1px solid #eee; padding-bottom:20px; margin-bottom:20px;">
            <img src="${doc.imgUrl}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid var(--primary); box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <div>
                <h2 style="margin:0; color:var(--primary);">${doc.doctor_name}</h2>
                <p style="margin:5px 0; color:#555; font-size:15px;"><strong>${doc.doctor_id}</strong> | ${doc.speciality}</p>
                <p style="margin:0; color:#777; font-size:14px;"><i class="fas fa-envelope"></i> ${doc.email}</p>
                <span class="status-badge status-${doc.status}" style="margin-top:10px; font-size:13px; padding:6px 15px;">${doc.status}</span>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:25px;">
            <div style="background:#f8fafc; padding:20px; border-radius:10px; border: 1px solid #e2e8f0;">
                <h4 style="margin:0 0 10px 0; color:#2d3748;"><i class="fas fa-clinic-medical" style="color:var(--primary);"></i> Clinic Details</h4>
                <p style="margin:0; font-size:14px;"><strong>${doc.clinic_name}</strong><br>${doc.city}</p>
                <p style="margin:10px 0 0 0; font-size:14px; font-weight:bold; color:var(--success);">Offline Fee: ₹${doc.offline_fee}</p>
            </div>
            <div style="background:#f8fafc; padding:20px; border-radius:10px; border: 1px solid #e2e8f0;">
                <h4 style="margin:0 0 10px 0; color:#2d3748;"><i class="fas fa-chart-line" style="color:var(--primary);"></i> Performance</h4>
                <p style="margin:0; font-size:14px;">Total Consults: <strong style="font-size:16px;">${totalAppts}</strong></p>
                <p style="margin:10px 0 0 0; font-size:14px;">Completed: <strong style="color:var(--success); font-size:16px;">${completedAppts}</strong></p>
            </div>
        </div>
        
        <h4 style="margin:0 0 10px 0; color:#2d3748;"><i class="fas fa-star" style="color:var(--warning);"></i> Patient Reviews</h4>
        <div style="max-height:250px; overflow-y:auto; background:#f9f9f9; padding:15px; border-radius:10px; border: 1px solid #e2e8f0;">
    `;

    let hasReviews = false;
    docAppts.forEach(a => {
        if(a.review_json && a.review_json.trim() !== "") {
            try {
                let rev = JSON.parse(a.review_json);
                let stars = ""; for(let i=1; i<=5; i++) stars += i <= rev.rating ? '<i class="fas fa-star" style="color:var(--warning);"></i> ' : '<i class="fas fa-star" style="color:#e0e0e0;"></i> ';
                html += `
                <div style="background:white; padding:12px; border-radius:8px; margin-bottom:12px; border-left:4px solid var(--warning); box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px;"><strong>${a.patient_id}</strong> <span style="color:#aaa; font-size:11px;">(${a.appt_date})</span></span>
                        <span style="font-size:12px;">${stars}</span>
                    </div>
                    <p style="margin:8px 0 0 0; font-size:13px; font-style:italic; color:#555;">"${rev.comment || 'No comment provided'}"</p>
                </div>`;
                hasReviews = true;
            } catch(e){}
        }
    });

    if(!hasReviews) html += `<p style="font-size:14px; color:#888; text-align:center; margin:20px 0;">No reviews available yet.</p>`;
    
    html += `</div>`;
    document.getElementById('docProfileContent').innerHTML = html;
    document.getElementById('doctorProfileModal').style.display = 'block';
}

async function updateStatus(docId, newStatus) {
    let reason = "";
    if (newStatus === "Rejected") {
        reason = prompt("Enter reason for rejection (Will be emailed):");
        if (!reason || reason.trim() === "") return alert("Action cancelled. Reason is mandatory!");
    } else {
        if (!confirm(`Are you sure you want to mark ${docId} as ${newStatus}?`)) return;
    }
    
    document.body.style.opacity = "0.6";
    document.getElementById("loader").style.display = "block";

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateAdminDoctorStatus", doctor_id: docId, status: newStatus, reason: reason })
        });
        const resData = await res.json();
        
        if (resData.status === "success") { 
            showToast(`Doctor ${docId} is now ${newStatus}`, "success");
            fetchAdminData(); 
        } 
        else { alert("Error: " + resData.message); }
    } catch (error) { alert("System error updating status."); } 
    finally { document.body.style.opacity = "1"; }
}

function populateDoctorDropdowns() {
    let options = `<option value="ALL">All Doctors</option>`;
    allDoctors.forEach(d => { options += `<option value="${d.doctor_id}">${d.doctor_name} (${d.doctor_id})</option>`; });
    document.getElementById("ledgerDocSelect").innerHTML = options;
    document.getElementById("reviewDocSelect").innerHTML = options;
}

// ===============================================
// 2. ALL CONSULTATIONS LOGIC
// ===============================================
function filterAppts() {
    let search = document.getElementById("filterApptSearch").value.toLowerCase();
    let status = document.getElementById("filterApptStatus").value;
    let refType = document.getElementById("filterRefundType").value;

    let filtered = allAppointments.filter(a => {
        let matchSearch = a.appt_id.toLowerCase().includes(search) || a.doctor_id.toLowerCase().includes(search) || a.patient_id.toLowerCase().includes(search);
        let matchStatus = status === "All" || 
                          (status === "Cancelled" ? a.appt_status.includes("Cancel") || a.appt_status.includes("No-Show") : a.appt_status === status);
        let matchRefund = refType === "All" || a.refund_choice === refType;
        
        return matchSearch && matchStatus && matchRefund;
    });
    renderApptsTable(filtered);
}

function renderApptsTable(appts) {
    const tbody = document.getElementById("apptsBody");
    tbody.innerHTML = "";

    if (appts.length === 0) return tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888; padding:30px;">No appointments found.</td></tr>`;

    appts.forEach(a => {
        let badge = "bg-warning";
        if(a.appt_status === "Approved") badge = "bg-info";
        if(a.appt_status === "Completed") badge = "bg-success";
        if(a.appt_status.includes("Cancel") || a.appt_status.includes("No-Show")) badge = "bg-danger";

        // 👇 Refund aur Cancel Reason dono show karna 👇
        let refInfo = "-";
        
        if (a.refund_status || a.refund_choice) {
            let refText = a.refund_status || a.refund_choice;
            let refColor = "var(--primary)";
            
            if (refText.includes("Action Required")) {
                refColor = "#f57c00"; 
                refText = "Pending Claim from Patient";
            } else if (refText.includes("Bank") || refText.includes("Pending")) {
                refColor = "var(--danger)";
            } else if (refText.includes("No Refund")) {
                refColor = "#888";
            }

            refInfo = `<span style="color:${refColor}; font-weight:bold; font-size:11px;">${refText}</span>`;
            
            if (a.refund_status_qr && a.refund_status_qr !== "") {
                refInfo += `<br><a href="${a.refund_status_qr}" target="_blank" style="color:var(--danger); font-weight:bold; font-size:10px; text-decoration:underline;">View Bank QR</a>`;
            }
            if (a.cancel_reason && a.cancel_reason !== "") {
                refInfo += `<br><span style="font-size:10px; color:#666; font-style:italic;">Reason: ${a.cancel_reason}</span>`;
            }
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${a.appt_id}</strong></td>
                <td><span style="color:var(--primary); font-size:12px; font-weight:bold; cursor:pointer;" onclick="showDoctorProfile('${a.doctor_id}')">${a.doctor_id}</span></td>
                <td>${a.patient_id}</td>
                <td>${a.appt_date}<br><span style="font-size:11px; color:#888;">${a.appt_time}</span></td>
                <td>${a.consult_type}</td>
                <td><span class="status-badge ${badge}">${a.appt_status}</span></td>
                <td>${refInfo}</td>
            </tr>
        `;
    });
}

// ===============================================
// ✨ CHARTS LOGIC (Admin Dashboard) ✨
// ===============================================
function drawAdminCharts() {
    let pending = 0, approved = 0, completed = 0, cancelled = 0;
    let revenueByDate = {};

    allAppointments.forEach(appt => {
        // Status Counting
        if(appt.appt_status === "Pending") pending++;
        else if(appt.appt_status === "Approved") approved++;
        else if(appt.appt_status === "Completed") completed++;
        else cancelled++;

        // Revenue Calculation (BhavyaCare Commission 10%)
        if(appt.appt_status === "Completed") {
            let dateParts = appt.appt_date.split('-');
            let dateStr = appt.appt_date;
            if(dateParts.length === 3) dateStr = dateParts[0] + "-" + dateParts[1]; // DD-MM format

            let totalMrp = parseInt(appt.total_mrp) || 0;
            let earning = parseInt(appt.doctor_earning) || 0;
            let collected = Math.round(totalMrp * 0.90); 
            let platformFee = collected - earning; // 10% commission

            if(!revenueByDate[dateStr]) revenueByDate[dateStr] = 0;
            revenueByDate[dateStr] += platformFee;
        }
    });

    // Update Stats Numbers
    let statP = document.getElementById("adminStatPending");
    let statA = document.getElementById("adminStatApproved");
    let statC = document.getElementById("adminStatCompleted");
    if(statP) statP.innerText = pending;
    if(statA) statA.innerText = approved;
    if(statC) statC.innerText = completed;

    // 1. Doughnut Chart (Admin Overall Appts)
    const ctx1 = document.getElementById('adminApptChart');
    if(ctx1) {
        if(adminApptChart) adminApptChart.destroy();
        adminApptChart = new Chart(ctx1.getContext('2d'), {
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
    }

    // 2. Bar Chart (Platform Commission)
    let labels = Object.keys(revenueByDate).reverse();
    let dataVals = Object.values(revenueByDate).reverse();

    const ctx2 = document.getElementById('adminRevenueChart');
    if(ctx2) {
        if(adminRevenueChart) adminRevenueChart.destroy();
        adminRevenueChart = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [{
                    label: 'Platform Commission (₹)',
                    data: dataVals.length > 0 ? dataVals : [0],
                    backgroundColor: '#0056b3',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { align: 'end', anchor: 'end', color: '#0056b3', font: {weight: 'bold'}, formatter: (v) => v > 0 ? '₹'+v : '' }
                },
                scales: { y: { display: false } }
            }
        });
    }
}

// ===============================================
// 3. SETTLEMENT LEDGER LOGIC (ADMIN VIEW)
// ===============================================
function parseDateDDMMYYYY(dateStr) {
    if (!dateStr || dateStr === "N/A") return new Date(0);
    const parts = dateStr.split("-"); 
    if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(dateStr);
}

function calculateLedger() {
    const docFilter = document.getElementById("ledgerDocSelect").value;
    const fromDate = new Date(document.getElementById("ledgerFrom").value); fromDate.setHours(0,0,0,0);
    const toDate = new Date(document.getElementById("ledgerTo").value); toDate.setHours(23, 59, 59, 999);
    const tbody = document.getElementById("ledgerBody");
    tbody.innerHTML = "";

    let sumColl = 0; let sumFee = 0; let sumRef = 0; let sumNet = 0; let count = 0;

    allAppointments.forEach(a => {
        let isDocMatch = docFilter === "ALL" || a.doctor_id === docFilter;
        let isComplete = a.appt_status === "Completed";
        // Update: Includes "Action Required"
        let isRefunded = a.refund_status && (a.refund_status.includes("Refunded") || a.refund_status.includes("Pending") || a.refund_status.includes("Action Required"));

        if (isDocMatch && (isComplete || isRefunded)) {
            const dtObj = parseDateDDMMYYYY(a.appt_date);
            if (dtObj >= fromDate && dtObj <= toDate) {
                count++;
                let mrp = parseInt(a.total_mrp) || 0;
                let earning = parseInt(a.doctor_earning) || 0;
                let collected = Math.round(mrp * 0.90); 
                let platformFee = collected - earning; 

                if (isComplete && !isRefunded) {
                    sumColl += collected; sumFee += platformFee; sumNet += earning;
                    tbody.innerHTML += `<tr>
                        <td>${a.appt_date}</td><td><strong style="color:var(--primary);">${a.appt_id}</strong></td>
                        <td>${a.doctor_id}</td><td>₹${collected}</td><td style="color:var(--primary);">₹${platformFee}</td>
                        <td>-</td><td style="color:var(--success); font-weight:bold;">₹${earning}</td>
                    </tr>`;
                } else if (isRefunded) {
                    sumRef += collected; sumNet -= collected; 
                    tbody.innerHTML += `<tr style="background:#fff5f5;">
                        <td>${a.appt_date}</td><td><strong style="color:var(--danger);">${a.appt_id}</strong></td>
                        <td>${a.doctor_id} <span style="font-size:10px; background:var(--danger); color:white; padding:2px 5px; border-radius:4px;">CANCELLED</span></td>
                        <td style="color:#999;">₹0</td><td style="color:#999;">₹0</td>
                        <td style="color:var(--danger); font-weight:bold;">-₹${collected}</td>
                        <td style="color:var(--danger); font-weight:bold;">-₹${collected}</td>
                    </tr>`;
                }
            }
        }
    });

    if(count === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888; padding:30px;">No data found for selected filters.</td></tr>`; }
    
    document.getElementById("ledgTotal").innerText = sumColl;
    document.getElementById("ledgFee").innerText = sumFee;
    document.getElementById("ledgRefund").innerText = sumRef;
    document.getElementById("ledgNet").innerText = sumNet;
}

function downloadAdminLedgerPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const docFilter = document.getElementById("ledgerDocSelect").options[document.getElementById("ledgerDocSelect").selectedIndex].text;
    const fromStr = document.getElementById("ledgerFrom").value;
    const toStr = document.getElementById("ledgerTo").value;
    
    doc.setFontSize(16);
    doc.setTextColor(0, 86, 179);
    doc.text("BhavyaCare Settlement Ledger (Admin)", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Filter: ${docFilter}`, 14, 22);
    doc.text(`Period: ${fromStr} to ${toStr}`, 14, 27);
    
    const tbody = document.getElementById("ledgerBody");
    if (tbody.rows.length === 0 || tbody.innerHTML.includes("No data found")) {
        alert("No data available to download."); return;
    }
    
    let bodyData = [];
    tbody.querySelectorAll("tr").forEach(row => {
        let rowData = [];
        row.querySelectorAll("td").forEach(c => {
            let text = c.innerText.replace(/₹/g, '').replace(/CANCELLED/g, '').trim();
            if(text.includes("\n")) text = text.split("\n")[0].trim();
            rowData.push(text);
        });
        bodyData.push(rowData);
    });

    let fData = ["GRAND TOTAL", "", "", 
        document.getElementById("ledgTotal").innerText.replace(/₹/g, '').trim(),
        document.getElementById("ledgFee").innerText.replace(/₹/g, '').trim(),
        document.getElementById("ledgRefund").innerText.replace(/₹/g, '').trim(),
        document.getElementById("ledgNet").innerText.replace(/₹/g, '').trim()
    ];

    doc.autoTable({
        head: [['Date', 'Appt ID', 'Doctor', 'Collected (INR)', 'Comm 10% (INR)', 'Refunded (INR)', 'Doc Payout (INR)']],
        body: bodyData,
        foot: [fData],
        startY: 32,
        theme: 'grid',
        headStyles: { fillColor: [0, 86, 179] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9 }
    });
    
    doc.save(`Admin_Settlement_${fromStr}_to_${toStr}.pdf`);
}

// ===============================================
// 4. PATIENT REVIEWS LOGIC
// ===============================================
function renderReviews() {
    const docFilter = document.getElementById("reviewDocSelect").value;
    const container = document.getElementById("reviewsContainer");
    let html = "";

    allAppointments.forEach(a => {
        let isDocMatch = docFilter === "ALL" || a.doctor_id === docFilter;
        if (isDocMatch && a.review_json && a.review_json.trim() !== "") {
            try {
                let rev = JSON.parse(a.review_json);
                let stars = ""; for(let i=1; i<=5; i++) stars += i <= rev.rating ? '<i class="fas fa-star" style="color:var(--warning);"></i> ' : '<i class="fas fa-star" style="color:#e0e0e0;"></i> ';
                
                html += `
                <div style="background:white; padding:20px; border-radius:12px; border-left:4px solid var(--warning); box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                        <span style="font-size:13px; color:#888;">Doc: <strong style="color:var(--primary); cursor:pointer;" onclick="showDoctorProfile('${a.doctor_id}')">${a.doctor_id}</strong></span>
                        <span style="font-size:13px; color:#888;">Pt: <strong style="color:#333;">${a.patient_id}</strong></span>
                    </div>
                    <div style="font-size:15px; margin-bottom:8px;">${stars}</div>
                    <p style="margin:0; font-size:14px; color:#555; font-style:italic; line-height:1.5;">"${rev.comment || 'No comment provided.'}"</p>
                    <div style="font-size:11px; color:#aaa; margin-top:12px; text-align:right;">${a.appt_date}</div>
                </div>`;
            } catch(e) { console.error("Error parsing review", e); }
        }
    });

    if(html === "") html = "<div style='grid-column: 1 / -1; text-align:center; padding:50px; font-size:16px; color:#888;'><i class='fas fa-star-half-alt' style='font-size:40px; color:#ddd; display:block; margin-bottom:15px;'></i> No reviews found.</div>";
    container.innerHTML = html;
}
