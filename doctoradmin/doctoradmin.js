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
    try {
        // Fetch Both Doctors List and Appointments List parallelly
        const [docsRes, apptsRes] = await Promise.all([
            fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "getAdminDoctors" }) }),
            fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "getAllDoctorAppointmentsAdmin" }) }) // NEW API
        ]);

        const docsJson = await docsRes.json();
        const apptsJson = await apptsRes.json();

        document.getElementById("loader").style.display = "none";
        document.getElementById("doctorsTable").style.display = "table";

        if (docsJson.status === "success") {
            allDoctors = docsJson.data;
            renderDocsTable(allDoctors);
            populateDoctorDropdowns();
        } else { alert("Error loading doctors: " + docsJson.message); }

        if (apptsJson.status === "success") {
            allAppointments = apptsJson.data;
            renderApptsTable(allAppointments);
            renderReviews();
            calculateLedger(); // Initial Calculation
        } else { console.error("Error loading appts: " + apptsJson.message); }

    } catch (error) {
        alert("System error loading data. Please check internet.");
        document.getElementById("loader").innerText = "Failed to load data.";
    }
}

// ===============================================
// 1. MANAGE DOCTORS LOGIC
// ===============================================
function renderDocsTable(doctors) {
    const tbody = document.getElementById("doctorsBody");
    tbody.innerHTML = "";
    
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
                <td><img src="${doc.imgUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #ccc;"></td>
                <td style="font-weight:bold; color:var(--primary);">${doc.doctor_id}</td>
                <td><strong>${doc.doctor_name}</strong><br><span style="font-size:12px; color:#777;">${doc.speciality}</span></td>
                <td>${doc.clinic_name}, ${doc.city}</td>
                <td><a href="${doc.docUrl}" target="_blank" class="btn btn-view">📄 View Doc</a></td>
                <td><span class="status-badge status-${doc.status}">${doc.status}</span></td>
                <td>${actionButtons}</td>
            </tr>
        `;
    });
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
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateAdminDoctorStatus", doctor_id: docId, status: newStatus, reason: reason })
        });
        const resData = await res.json();
        if (resData.status === "success") { alert("Success! " + resData.message); fetchAdminData(); } 
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

    if (appts.length === 0) return tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No appointments found.</td></tr>`;

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
                <td><span style="color:var(--primary); font-size:12px; font-weight:bold;">${a.doctor_id}</span></td>
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

    if(count === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No data found for selected filters.</td></tr>`; }
    
    document.getElementById("ledgTotal").innerText = sumColl;
    document.getElementById("ledgFee").innerText = sumFee;
    document.getElementById("ledgRefund").innerText = sumRef;
    document.getElementById("ledgNet").innerText = sumNet;
}

function downloadAdminLedger() {
    const tbody = document.getElementById("ledgerBody");
    if (tbody.rows.length === 0 || tbody.innerHTML.includes("No data found")) return alert("No data to download.");
    
    let csv = "Date,Appointment ID,Doctor ID,Collected,BhavyaCare Margin,Refunded,Net Doc Payout\n";
    tbody.querySelectorAll("tr").forEach(row => {
        let cols = [];
        row.querySelectorAll("td").forEach(c => cols.push(c.innerText.replace(/₹/g, '').replace(/CANCELLED/g, '').trim()));
        csv += cols.join(",") + "\n";
    });
    csv += `GRAND TOTAL,,,${document.getElementById("ledgTotal").innerText},${document.getElementById("ledgFee").innerText},${document.getElementById("ledgRefund").innerText},${document.getElementById("ledgNet").innerText}\n`;
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
    link.setAttribute("download", `Admin_Settlement_Ledger.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
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
        // Check karein ki review data sach me hai ya nahi
        if (isDocMatch && a.review_json && a.review_json.trim() !== "") {
            try {
                let rev = JSON.parse(a.review_json);
                
                // Star rendering logic
                let stars = ""; 
                for(let i=1; i<=5; i++) {
                    stars += i <= rev.rating ? '<i class="fas fa-star" style="color:var(--warning);"></i> ' : '<i class="fas fa-star" style="color:#e0e0e0;"></i> ';
                }
                
                html += `
                <div style="background:white; padding:15px; border-radius:10px; border-left:4px solid var(--warning); box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="font-size:12px; color:#888;">Doc: <strong style="color:var(--primary);">${a.doctor_id}</strong></span>
                        <span style="font-size:12px; color:#888;">Pt: <strong>${a.patient_id}</strong></span>
                    </div>
                    <div style="font-size:14px; margin-bottom:5px;">${stars}</div>
                    <p style="margin:0; font-size:13px; color:#555; font-style:italic;">"${rev.comment || 'No comment provided'}"</p>
                    <div style="font-size:10px; color:#aaa; margin-top:8px; text-align:right;">${a.appt_date}</div>
                </div>`;
            } catch(e) {
                console.error("JSON Parse Error in Review", e);
            }
        }
    });

    if(html === "") html = "<div style='grid-column: 1 / -1; text-align:center; padding:40px; color:#888;'>No reviews found.</div>";
    container.innerHTML = html;
}
