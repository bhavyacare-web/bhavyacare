const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allDoctors = [];
let allAppointments = [];

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
            allDoctors = docsJson.data;
            // Always apply the current search filter after refreshing data
            filterDoctors();
            populateDoctorDropdowns();
        } else { alert("Error loading doctors: " + docsJson.message); }

        if (apptsJson.status === "success") {
            allAppointments = apptsJson.data;
            filterAppts(); // Keep current appt filters active
            renderReviews();
            calculateLedger(); 
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

// 🌟 NAYA: DOCTOR PROFILE MODAL 🌟
function showDoctorProfile(docId) {
    const doc = allDoctors.find(d => d.doctor_id === docId);
    if(!doc) return;

    // Calculate performance stats
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
            // 🌟 NAYA: AUTO REFRESH HAPPENS HERE WITHOUT RELOADING PAGE 🌟
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

        let refInfo = "-";
        if (a.refund_choice === "Wallet") refInfo = `<span style="color:var(--primary); font-weight:bold; font-size:11px;">Wallet Refunded</span>`;
        if (a.refund_choice === "Bank") refInfo = `<a href="${a.refund_status_qr}" target="_blank" style="color:var(--danger); font-weight:bold; font-size:11px;">View Bank QR</a><br><span style="font-size:10px; color:#888;">Due on 1st</span>`;

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
        let isRefunded = a.refund_status && (a.refund_status.includes("Refunded") || a.refund_status.includes("Pending"));

        if (isDocMatch && (isComplete || isRefunded)) {
            const dtObj = parseDateDDMMYYYY(a.appt_date);
            if (dtObj >= fromDate && dtObj <= toDate) {
                count++;
                let mrp = parseInt(a.total_mrp) || 0;
                let earning = parseInt(a.doctor_earning) || 0;
                let collected = Math.round(mrp * 0.90); // Exact collected amount
                let platformFee = collected - earning; // Admin Margin (10%)

                if (isComplete && !isRefunded) {
                    sumColl += collected; sumFee += platformFee; sumNet += earning;
                    tbody.innerHTML += `<tr>
                        <td>${a.appt_date}</td><td><strong style="color:var(--primary);">${a.appt_id}</strong></td>
                        <td>${a.doctor_id}</td><td>₹${collected}</td><td style="color:var(--primary);">₹${platformFee}</td>
                        <td>-</td><td style="color:var(--success); font-weight:bold;">₹${earning}</td>
                    </tr>`;
                } else if (isRefunded) {
                    sumRef += collected; sumNet -= collected; // Recovery from Doc
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

// 🌟 NAYA: PDF DOWNLOAD LOGIC FOR ADMIN LEDGER 🌟
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
