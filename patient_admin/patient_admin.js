const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let currentTab = 'patients';
let allPatientsData = []; 
let allSupportData = [];
let allRxData = [];

document.addEventListener("DOMContentLoaded", fetchPatientsData);

function switchAdminTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    
    // Hide all sections
    document.getElementById('patients-section').style.display = 'none';
    document.getElementById('vips-section').style.display = 'none';
    document.getElementById('support-section').style.display = 'none';
    document.getElementById('prescriptions-section').style.display = 'none';

    // Show active section
    document.getElementById(`${tabName}-section`).style.display = 'block';
    fetchCurrentTabData();
}

function fetchCurrentTabData() {
    if (currentTab === 'patients') fetchPatientsData();
    else if (currentTab === 'vips') fetchVipData();
    else if (currentTab === 'support') fetchSupportData();
    else if (currentTab === 'prescriptions') fetchRxData();
}

function closeModals() {
    document.getElementById('modalOverlay').style.display = 'none';
    if(document.getElementById('vipActionModal')) document.getElementById('vipActionModal').style.display = 'none';
    if(document.getElementById('patientProfileModal')) document.getElementById('patientProfileModal').style.display = 'none';
}

// ==========================================
// 1. PATIENTS MASTER LIST LOGIC
// ==========================================
async function fetchPatientsData() {
    const tableBody = document.getElementById("patientsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatients" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            allPatientsData = result.data;
            renderPatientsTable(allPatientsData);
        }
    } catch (error) { loader.innerHTML = "❌ Network Error!"; }
}

function filterPatients() {
    const query = document.getElementById("patientSearch").value.toLowerCase();
    const filteredData = allPatientsData.filter(p => 
        p.patient_name.toLowerCase().includes(query) || 
        p.user_id.toLowerCase().includes(query) || 
        p.mobile_number.includes(query)
    );
    renderPatientsTable(filteredData);
}

function renderPatientsTable(data) {
    const tableBody = document.getElementById("patientsTableBody");
    tableBody.innerHTML = "";
    if (data.length === 0) { tableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>No patients found.</td></tr>"; return; }
    
    data.forEach((p, index) => {
        // Status Formatting
        const sVal = p.status ? p.status.trim().toLowerCase() : 'inactive';
        const sClass = sVal === 'active' ? 'status-active' : 'status-inactive';
        
        // WITHDRAW/WALLET SAFE FORMATTING
        const wVal = p.withdraw ? p.withdraw.trim().toLowerCase() : 'inactive';
        const wClass = wVal === 'active' ? 'status-active' : 'status-inactive';
        const withdrawText = wVal.toUpperCase();
        
        tableBody.innerHTML += `
            <tr>
                <td style="text-align: center;"><img src="${p.image}" class="patient-img" alt="Pic"></td>
                <td><strong>${p.user_id}</strong><br><span style="font-size: 11px; color: #888;">Joined: ${p.timestamp.split(" ")[0]}</span></td>
                <td style="font-weight: bold;">${p.patient_name}</td>
                <td><strong>📞 ${p.mobile_number}</strong><br><span style="font-size: 11px; color: #555;">📧 ${p.email}</span></td>
                <td style="color:#28a745; font-weight:bold; font-size:16px;">₹${p.wallet}</td>
                <td style="text-transform:capitalize; font-weight:bold;">${p.plan}</td>
                
                <td><button class="badge-btn ${wClass}" onclick="toggleStatus('${p.user_id}', 'withdraw', '${wVal}')">${withdrawText}</button></td>
                
                <td><button class="badge-btn ${sClass}" onclick="toggleStatus('${p.user_id}', 'status', '${sVal}')">${sVal.toUpperCase()}</button></td>
                
                <td><button class="badge-btn status-primary" onclick="openPatientProfile('${p.user_id}')"><i class="fas fa-eye"></i> View Profile</button></td>
            </tr>`;
    });
}

async function toggleStatus(userId, field, currentStatus) {
    const newValue = currentStatus.toLowerCase() === "active" ? "inactive" : "active";
    const fieldName = field === 'withdraw' ? 'WALLET / WITHDRAW' : 'ACCOUNT STATUS';
    
    if (!confirm(`Mark ${fieldName} as '${newValue.toUpperCase()}' for ${userId}?`)) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updatePatient", target_user_id: userId, field: field, value: newValue }) 
        });
        const result = await response.json();
        if (result.status === "success") {
            window.location.reload(); 
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) { alert("Failed to update."); }
}

// ==========================================
// SUPER PATIENT 360 PROFILE LOGIC
// ==========================================
function openPatientProfile(userId) {
    const p = allPatientsData.find(user => user.user_id === userId);
    if(!p) return;

    document.getElementById("spImage").src = p.image;
    document.getElementById("spName").innerText = p.patient_name;
    document.getElementById("spId").innerText = p.user_id;
    document.getElementById("spPlan").innerText = p.plan;
    
    document.getElementById("spContact").innerHTML = `📞 ${p.mobile_number}<br>📧 ${p.email}`;
    document.getElementById("spAddress").innerHTML = p.address;
    document.getElementById("spReferral").innerHTML = `My Code: <b>${p.referral_code}</b>`;
    document.getElementById("spWallet").innerText = `₹${p.wallet}`;

    document.getElementById("walletAdjustAmt").value = "";
    document.getElementById("walletAdjustReason").value = "";

    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('patientProfileModal').style.display = 'block';

    fetchPatientOrderHistory(userId);
}

async function fetchPatientOrderHistory(userId) {
    const historyDiv = document.getElementById("spOrderHistory");
    historyDiv.innerHTML = `<div style="text-align:center; padding:20px; color:#666;"><i class="fas fa-spinner fa-spin"></i> Fetching order history...</div>`;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getAdminPatientOrderHistory", target_user_id: userId }) 
        });
        const result = await response.json();

        if (result.status === "success") {
            if (result.data.length === 0) {
                historyDiv.innerHTML = `<div style="text-align:center; padding:20px; color:#666;">No orders found for this patient.</div>`;
                return;
            }

            let html = "";
            result.data.forEach(o => {
                let badgeColor = o.status.toLowerCase() === 'completed' ? '#28a745' : (o.status.toLowerCase() === 'cancelled' ? '#dc3545' : '#0056b3');
                
                let reportLink = "";
                if(o.report_pdf) {
                    try {
                        let urls = JSON.parse(o.report_pdf);
                        if(Array.isArray(urls) && urls.length > 0) {
                            reportLink = `<a href="${urls[0]}" target="_blank" style="color:#0056b3; font-size:12px; font-weight:bold; text-decoration:none;"><i class="fas fa-file-pdf"></i> View Report</a>`;
                        }
                    } catch(e) {
                        reportLink = `<a href="${o.report_pdf}" target="_blank" style="color:#0056b3; font-size:12px; font-weight:bold; text-decoration:none;"><i class="fas fa-file-pdf"></i> View Report</a>`;
                    }
                }

                html += `
                    <div class="history-card">
                        <div class="history-card-left">
                            <strong>#${o.order_id}</strong> | <span style="color:#888;">${new Date(o.date).toLocaleDateString('en-IN')}</span><br>
                            Lab: ${o.lab_id.split('(')[0].trim()}<br>
                            Bill: ₹${o.final_payable}
                        </div>
                        <div style="text-align:right;">
                            <span style="background:${badgeColor}; color:white; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold; display:inline-block; margin-bottom:5px;">${o.status.toUpperCase()}</span><br>
                            ${reportLink}
                        </div>
                    </div>`;
            });
            historyDiv.innerHTML = html;
        }
    } catch (error) { historyDiv.innerHTML = `<div style="text-align:center; color:red;">Failed to load history.</div>`; }
}

async function adjustPatientWallet() {
    const userId = document.getElementById("spId").innerText;
    const amt = document.getElementById("walletAdjustAmt").value;
    const reason = document.getElementById("walletAdjustReason").value.trim();

    if(!amt || amt <= 0) return alert("Please enter a valid amount.");
    if(!reason) return alert("Please provide a reason for adding funds.");
    if(!confirm(`Add ₹${amt} to ${userId}'s wallet?`)) return;

    const btn = event.currentTarget;
    btn.innerText = "Adding..."; btn.disabled = true;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "adminAddWalletFunds", target_user_id: userId, amount: amt, reason: reason }) 
        });
        const result = await response.json();
        
        btn.innerText = "Add Funds"; btn.disabled = false;
        if (result.status === "success") { 
            alert("Funds added successfully!"); 
            window.location.reload();
        }
        else alert("Error: " + result.message);
    } catch (error) { alert("Failed to add funds."); btn.innerText = "Add Funds"; btn.disabled = false; }
}

// ==========================================
// 2. VIP APPLICATIONS LOGIC 
// ==========================================
async function fetchVipData() {
    const tableBody = document.getElementById("vipsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipApplications" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            if (result.data.length === 0) { tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No VIP applications found.</td></tr>"; return; }
            result.data.forEach(vip => {
                let statusBadge = ''; let actionBtn = '';
                if (vip.status === 'inactive' || vip.status === '') {
                    statusBadge = `<span class="badge-btn status-pending">Pending</span>`;
                    actionBtn = `<button class="badge-btn status-primary" onclick="openVipModal('${vip.row_index}', '${vip.user_id}')">Take Action</button>`;
                } else if (vip.status === 'active') {
                    statusBadge = `<span class="badge-btn status-active">Active</span>`;
                    actionBtn = `<span style="font-size:12px; color:green; font-weight:bold;">Approved</span>`;
                } else {
                    statusBadge = `<span class="badge-btn status-inactive">Rejected</span>`;
                    actionBtn = `<span style="font-size:12px; color:red; font-weight:bold;">Rejected</span>`;
                }

                let pkgBadge = '';
                if (vip.vip_package && vip.vip_package.toLowerCase() === 'pending') {
                    pkgBadge = `<br><span style="font-size:10px; background:#ffeeba; padding:3px 6px; border-radius:4px;">🎁 Pkg Pending</span>`;
                } else if (vip.vip_package) {
                    pkgBadge = `<br><span style="font-size:10px; background:#d4edda; padding:3px 6px; border-radius:4px;">🎁 Pkg Done</span>`;
                }

                let ssLink = vip.payment_screenshot ? `<a href="${vip.payment_screenshot}" target="_blank" style="color:#0056b3; font-size:12px;">View SS</a>` : 'N/A';
                let dates = vip.start_date !== 'Not Started' ? `${vip.start_date} <br>to<br> ${vip.end_date}` : 'Not Started';

                tableBody.innerHTML += `
                    <tr>
                        <td><strong>${vip.user_id}</strong></td>
                        <td>${vip.member1}</td>
                        <td>${vip.referrer || 'None'}</td>
                        <td style="text-transform: capitalize;">${vip.payment_mode}</td>
                        <td>ID: ${vip.payment_id || 'N/A'}<br>${ssLink}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${vip.amount}</td>
                        <td style="text-align: center;">${statusBadge} ${pkgBadge}</td>
                        <td style="font-size: 11px; color:#555;">${dates}</td>
                        <td style="font-size: 12px; color:#777;">${vip.remarks || '-'}</td>
                        <td>${actionBtn}</td>
                    </tr>`;
            });
        }
    } catch (error) { loader.innerHTML = "❌ Error fetching VIP data."; }
}

function openVipModal(rowIndex, userId) {
    document.getElementById('modalRowIndex').value = rowIndex;
    document.getElementById('modalUserId').innerText = userId;
    document.getElementById('modalRemarks').value = '';
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('vipActionModal').style.display = 'block';
}

async function submitVipAction(statusValue) {
    const rowIndex = document.getElementById('modalRowIndex').value;
    const userId = document.getElementById('modalUserId').innerText;
    const remarks = document.getElementById('modalRemarks').value.trim();

    if (!confirm(`Confirm mark as ${statusValue.toUpperCase()}?`)) return;
    closeModals(); document.getElementById("loader").style.display = "block";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processVipAction", row_index: rowIndex, user_id: userId, vip_status: statusValue, remarks: remarks }) 
        });
        const result = await response.json();
        if (result.status === "success") { 
            alert(result.message); 
            window.location.reload(); 
        } 
        else { alert("Error: " + result.message); document.getElementById("loader").style.display = "none"; }
    } catch (error) { alert("Action failed."); document.getElementById("loader").style.display = "none"; }
}

// ==========================================
// 3. SUPPORT QUERIES LOGIC
// ==========================================
async function fetchSupportData() {
    const tableBody = document.getElementById("supportTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getSupportQueries" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            allSupportData = result.data;
            renderSupportTable(allSupportData);
        } else {
            tableBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No queries found.</td></tr>";
        }
    } catch (error) { loader.innerHTML = "❌ Network Error!"; }
}

function filterSupport() {
    const query = document.getElementById("supportSearch").value.toLowerCase();
    const filteredData = allSupportData.filter(q => 
        (q.Ticket_ID && q.Ticket_ID.toLowerCase().includes(query)) || 
        (q.Name && q.Name.toLowerCase().includes(query)) || 
        (q.Mobile && q.Mobile.includes(query))
    );
    renderSupportTable(filteredData);
}

function renderSupportTable(data) {
    const tableBody = document.getElementById("supportTableBody");
    tableBody.innerHTML = "";
    if (data.length === 0) { tableBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No records found.</td></tr>"; return; }
    
    data.forEach((q) => {
        let statusColor = q.Status === "Open" ? "status-pending" : "status-active";
        tableBody.innerHTML += `
            <tr>
                <td><strong>${q.Ticket_ID}</strong><br><span style="font-size:11px; color:#888;">${q.Date}</span></td>
                <td><strong>${q.Name}</strong><br><span style="font-size:11px; color:#555;">📞 ${q.Mobile}</span><br><span class="badge-btn status-primary" style="padding:2px 6px;font-size:10px; margin-top:5px;">${q.User_Type}</span></td>
                <td style="font-weight:bold; color:#0056b3;">${q.Issue_Type}</td>
                <td>${q.Order_ID || "-"}</td>
                <td style="max-width:250px; word-wrap:break-word; font-size:13px; line-height:1.4;">${q.Message}</td>
                <td><span class="badge-btn ${statusColor}">${q.Status}</span></td>
                <td><button class="action-btn" style="background:#28a745; width:auto; font-size:12px; padding:6px 10px;" onclick="resolveSupport('${q.Ticket_ID}')">Mark Resolved</button></td>
            </tr>`;
    });
}

async function resolveSupport(ticketId) {
    if(!confirm(`Mark Ticket ${ticketId} as Resolved?`)) return;
    alert("Functionality to update sheet status for Ticket: " + ticketId + " can be integrated here.");
}

// ==========================================
// 4. PRESCRIPTIONS LOGIC
// ==========================================
async function fetchRxData() {
    const tableBody = document.getElementById("rxTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPrescriptions" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            allRxData = result.data;
            renderRxTable(allRxData);
        } else {
            tableBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No prescriptions found.</td></tr>";
        }
    } catch (error) { loader.innerHTML = "❌ Network Error!"; }
}

function filterRx() {
    const query = document.getElementById("rxSearch").value.toLowerCase();
    const filteredData = allRxData.filter(r => 
        (r.Prescription_ID && r.Prescription_ID.toLowerCase().includes(query)) || 
        (r.user_id && r.user_id.toLowerCase().includes(query)) || 
        (r.Mobile_Number && r.Mobile_Number.includes(query))
    );
    renderRxTable(filteredData);
}

function renderRxTable(data) {
    const tableBody = document.getElementById("rxTableBody");
    tableBody.innerHTML = "";
    if (data.length === 0) { tableBody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No records found.</td></tr>"; return; }
    
    data.forEach((r) => {
        let statusColor = r.Status === "Pending" ? "status-pending" : "status-active";
        let fileLink = r.Prescription_URL ? `<a href="${r.Prescription_URL}" target="_blank" style="color:#0056b3; font-weight:bold; text-decoration:none;"><i class="fas fa-file-pdf"></i> View File</a>` : "N/A";
        
        tableBody.innerHTML += `
            <tr>
                <td><strong>${r.Prescription_ID}</strong><br><span style="font-size:11px; color:#888;">${r.Upload_Date}</span></td>
                <td><strong>User ID:</strong> ${r.user_id}<br><strong>📞 Mobile:</strong> ${r.Mobile_Number}</td>
                <td>${fileLink}</td>
                <td style="max-width:200px; word-wrap:break-word; font-size:13px; line-height:1.4;">${r.Patient_Notes || "-"}</td>
                <td>${r.Linked_Order_ID || "-"}</td>
                <td><span class="badge-btn ${statusColor}">${r.Status}</span></td>
                <td><button class="action-btn" style="background:#0056b3; width:auto; font-size:12px; padding:6px 10px;" onclick="processRx('${r.Prescription_ID}')">Process Order</button></td>
            </tr>`;
    });
}

async function processRx(rxId) {
     alert("Admin will create an order for Rx ID: " + rxId + " (Booking API integration pending).");
}
