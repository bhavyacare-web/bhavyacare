const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let pharmacyRegData = []; 
let allPharmacies = [];   
let allOrders = [];       

// ✨ TOAST NOTIFICATION LOGIC ✨
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-check-circle'; 
    if(type === 'error') icon = 'fa-exclamation-circle'; else if(type === 'info') icon = 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
    refreshAllData();
});

function switchTab(tabId, btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

// ✨ NAYA REFRESH LOGIC (With Toast) ✨
async function refreshAllData() {
    showToast("Refreshing data...", "info");
    
    // Dono functions ko call karna
    fetchRegistrations(); 
    await fetchAllAdminData();  
    
    showToast("Data refreshed successfully!", "success");
}

// ==========================================
// ✨ REGISTRATIONS LOGIC ✨
// ==========================================
function format12HourTime(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return timeStr || "Closed";
    let [hours, minutes] = timeStr.split(':');
    hours = parseInt(hours);
    let ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    let strHours = hours < 10 ? '0' + hours : hours;
    return `${strHours}:${minutes} ${ampm}`;
}

function formatTimingStr(timingStr) {
    if (!timingStr || !timingStr.includes(" to ")) return "Closed";
    let [open, close] = timingStr.split(" to ");
    if (!open || !close || open === "undefined" || close === "undefined") return "<span style='color:#ef4444;'>Closed</span>";
    return `${format12HourTime(open)} to ${format12HourTime(close)}`;
}

function fetchRegistrations() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = `<tr><td colspan="5" id="loader"><i class="fas fa-spinner fa-spin"></i> Loading data...</td></tr>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", body: JSON.stringify({ action: "getAdminPharmacies" })
    })
    .then(res => res.json())
    .then(resData => {
        pharmacyRegData = resData.data.data || [];
        renderRegistrationTable();
    })
    .catch(err => { tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error loading data.</td></tr>`; });
}

function renderRegistrationTable() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (pharmacyRegData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No pharmacies registered yet.</td></tr>`;
        return;
    }

    pharmacyRegData.forEach(pharma => {
        let badgeClass = "bg-pending";
        if (pharma.status === "ACTIVE") badgeClass = "bg-active";
        if (pharma.status === "REJECTED") badgeClass = "bg-rejected";

        tbody.innerHTML += `
        <tr>
            <td><strong>${pharma.pharmacy_id}</strong></td>
            <td>${pharma.pharmacy_name}</td>
            <td>${pharma.city} (${pharma.pincode})</td>
            <td><span class="badge ${badgeClass}">${pharma.status}</span></td>
            <td><button class="btn btn-view" onclick="viewDetails('${pharma.pharmacy_id}')">View Details</button></td>
        </tr>`;
    });
}

function viewDetails(id) {
    const pharma = pharmacyRegData.find(p => p.pharmacy_id === id);
    if (!pharma) return;
    currentSelectedId = id;

    document.getElementById("m_name").innerText = pharma.pharmacy_name;
    document.getElementById("m_id").innerText = "ID: " + pharma.pharmacy_id;
    document.getElementById("m_email").innerText = pharma.email;
    document.getElementById("m_location").innerText = `${pharma.address}, ${pharma.city} - ${pharma.pincode}`;
    document.getElementById("m_cities").innerText = pharma.available_city;
    
    let pincodeArr = [];
    try { pincodeArr = JSON.parse(pharma.available_pincode); } catch(e) { pincodeArr = [pharma.available_pincode]; }
    document.getElementById("m_pincodes").innerText = pincodeArr.join(", ");

    const t = pharma.timings;
    document.getElementById("m_timings").innerHTML = `
        <b>Mon:</b> ${formatTimingStr(t.monday)} &nbsp;|&nbsp; <b>Tue:</b> ${formatTimingStr(t.tuesday)} &nbsp;|&nbsp; <b>Wed:</b> ${formatTimingStr(t.wednesday)} <br>
        <b>Thu:</b> ${formatTimingStr(t.thursday)} &nbsp;|&nbsp; <b>Fri:</b> ${formatTimingStr(t.friday)} &nbsp;|&nbsp; <b>Sat:</b> ${formatTimingStr(t.saturday)} <br>
        <b>Sun:</b> ${formatTimingStr(t.sunday)}
    `;

    let docsHtml = "";
    if (pharma.doc1) docsHtml += `<a href="${pharma.doc1}" target="_blank"><i class="fas fa-file-pdf"></i> Reg Doc 1</a>`;
    if (pharma.doc2) docsHtml += `<a href="${pharma.doc2}" target="_blank"><i class="fas fa-file-pdf"></i> Reg Doc 2</a>`;
    if (pharma.img1) docsHtml += `<a href="${pharma.img1}" target="_blank"><i class="fas fa-image"></i> Store Image 1</a>`;
    if (pharma.img2) docsHtml += `<a href="${pharma.img2}" target="_blank"><i class="fas fa-image"></i> Store Image 2</a>`;
    document.getElementById("m_docs").innerHTML = docsHtml || "No documents uploaded.";

    const btnApprove = document.getElementById("btnApprove");
    const btnReject = document.getElementById("btnReject");
    btnApprove.replaceWith(btnApprove.cloneNode(true));
    btnReject.replaceWith(btnReject.cloneNode(true));
    
    document.getElementById("btnApprove").addEventListener("click", () => changeStatus('ACTIVE'));
    document.getElementById("btnReject").addEventListener("click", () => changeStatus('REJECTED'));

    if(pharma.status === "ACTIVE") {
        document.getElementById("btnApprove").style.display = "none";
        document.getElementById("btnReject").style.display = "block";
    } else if(pharma.status === "REJECTED") {
        document.getElementById("btnApprove").style.display = "block";
        document.getElementById("btnReject").style.display = "none";
    } else {
        document.getElementById("btnApprove").style.display = "block";
        document.getElementById("btnReject").style.display = "block";
    }

    document.getElementById("detailModal").style.display = "flex";
}

function closeModal() { document.getElementById("detailModal").style.display = "none"; }

function changeStatus(newStatus) {
    if (!currentSelectedId) return;
    if (!confirm(`Are you sure you want to mark this pharmacy as ${newStatus}?`)) return;

    const btnAction = document.getElementById("actionButtons");
    const originalBtns = btnAction.innerHTML;
    btnAction.innerHTML = `<p style="color: #2563eb; font-weight: bold;"><i class="fas fa-spinner fa-spin"></i> Updating status & sending email...</p>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", body: JSON.stringify({ action: "updatePharmacyStatus", pharmacy_id: currentSelectedId, new_status: newStatus })
    })
    .then(res => res.json())
    .then(resData => {
        if(resData.status === "success") {
            showToast("Status updated successfully!", "success"); closeModal(); fetchRegistrations(); 
        } else { showToast("Error: " + resData.message, "error"); btnAction.innerHTML = originalBtns; }
    })
    .catch(err => { showToast("Network error occurred.", "error"); btnAction.innerHTML = originalBtns; });
}

// ==========================================
// ✨ ORDERS & LEDGER LOGIC ✨
// ==========================================

async function fetchAllAdminData() {
    try {
        const phRes = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getAllPharmacies" }) });
        const phData = await phRes.json();
        if(phData.status === "success") allPharmacies = phData.data;

        const ordRes = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getAllMedicineOrders" }) });
        const ordData = await ordRes.json();
        if(ordData.status === "success") allOrders = ordData.data;

        populatePharmaDropdowns();
        updateOverviewStats();
        renderAllOrders();
        renderLedger();
    } catch(err) { console.error("Error fetching admin data"); }
}

function populatePharmaDropdowns() {
    const filter1 = document.getElementById("filterOrderPharma");
    const filter2 = document.getElementById("ledgerPharmaFilter");
    let options = `<option value="All">All Pharmacies</option>`;
    
    allPharmacies.forEach(p => { options += `<option value="${p.pharmacy_id}">${p.name} (${p.pharmacy_id})</option>`; });
    filter1.innerHTML = options; filter2.innerHTML = options;
}

function getPharmaName(id) {
    const p = allPharmacies.find(x => x.pharmacy_id === id);
    return p ? p.name : id;
}

function updateOverviewStats() {
    document.getElementById("statPharmacies").innerText = allPharmacies.length;
    document.getElementById("statOrders").innerText = allOrders.length;
    const completed = allOrders.filter(o => o.patient_status === "Completed");
    document.getElementById("statCompleted").innerText = completed.length;
    
    let totalComm = 0;
    completed.forEach(o => { totalComm += (Number(o.bhavya_care_commission) || 0); });
    document.getElementById("statComm").innerText = totalComm.toFixed(2);
}

// ✨ NAYA RENDER ALL ORDERS (With Order Type) ✨
function renderAllOrders() {
    const search = document.getElementById("searchOrderInput").value.toLowerCase().trim();
    const statusVal = document.getElementById("filterOrderStatus").value;
    const pharmaVal = document.getElementById("filterOrderPharma").value;
    const dateVal = document.getElementById("filterOrderDate").value;

    const tbody = document.getElementById("ordersTableBody");
    tbody.innerHTML = "";

    const filtered = allOrders.filter(o => {
        let matchText = (o.order_id || "").toLowerCase().includes(search) || (o.patient_mobile || "").toLowerCase().includes(search);
        let matchStatus = statusVal === "All" ? true : o.patient_status === statusVal;
        let matchPharma = pharmaVal === "All" ? true : o.medicos_id === pharmaVal;
        
        let matchDate = true;
        if(dateVal !== "") {
            const [y, m, d] = dateVal.split('-');
            matchDate = (o.order_date || "").includes(`${y}-${m}-${d}`);
        }
        return matchText && matchStatus && matchPharma && matchDate;
    });

    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No orders found.</td></tr>`; return; }

    filtered.forEach(o => {
        let badgeBg = "#fef3c7", badgeCol = "#d97706";
        if(o.patient_status === "Completed") { badgeBg = "#d1fae5"; badgeCol = "#059669"; }
        else if(o.patient_status === "Cancelled") { badgeBg = "#fee2e2"; badgeCol = "#dc2626"; }
        else if(o.patient_status === "Confirmed") { badgeBg = "#e0e7ff"; badgeCol = "#4f46e5"; }

        let dDate = o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN') : "N/A";
        let mrp = Number(o.total_mrp) || 0;

        let billHtml = o.medicine_bill 
            ? `<br><a href="${o.medicine_bill}" target="_blank" style="font-size:11px; background:#10b981; color:white; padding:4px 8px; border-radius:4px; text-decoration:none; display:inline-block; margin-top:5px; font-weight:bold;"><i class="fas fa-file-invoice"></i> View Bill</a>` 
            : `<br><span style="font-size:11px; color:#94a3b8; display:inline-block; margin-top:5px;">No Bill Yet</span>`;

        let extraInfo = "";
        if(o.patient_status === "Cancelled" && o.cancel_reason) {
            extraInfo += `<div style="color:#dc2626; font-size:11px; margin-top:6px; background:#ffebee; padding:4px; border-radius:4px;"><b>Reason:</b> ${o.cancel_reason}</div>`;
        }
        if(o.pharmacy_rating) {
            extraInfo += `<div style="color:#f59e0b; font-size:11px; margin-top:6px; background:#fff8e1; padding:4px; border-radius:4px;"><b>Rated:</b> ${o.pharmacy_rating}⭐ <br><i>${o.pharmacy_comment || ""}</i></div>`;
        }

        // ✨ ORDER TYPE BADGE ✨
        let typeBadge = (o.order_type === "Collect from Pharmacy" || o.order_type === "Self Pickup") 
            ? `<span style="background:#fef3c7; color:#d97706; font-size:10px; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;"><i class="fas fa-store-alt"></i> Self Pickup</span>` 
            : `<span style="background:#e0e7ff; color:#4f46e5; font-size:10px; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;"><i class="fas fa-motorcycle"></i> Home Delivery</span>`;

        tbody.innerHTML += `
        <tr>
            <td style="font-weight:700;">#${o.order_id}<br>${typeBadge}</td>
            <td>${dDate}</td>
            <td style="font-size:12px;"><b>${getPharmaName(o.medicos_id)}</b><br><span style="color:#64748b;">${o.medicos_id}</span>${extraInfo}</td>
            <td style="font-size:12px;">📞 ${o.patient_mobile}</td>
            <td>₹${mrp.toFixed(2)}${billHtml}</td>
            <td><span class="badge" style="background:${badgeBg}; color:${badgeCol};">${o.patient_status}</span></td>
        </tr>`;
    });
}
function clearLedgerFilters() {
    document.getElementById("ledgerPharmaFilter").value = "All";
    document.getElementById("ledgerStartDate").value = "";
    document.getElementById("ledgerEndDate").value = "";
    renderLedger();
}

function renderLedger() {
    const pharmaVal = document.getElementById("ledgerPharmaFilter").value;
    const startVal = document.getElementById("ledgerStartDate").value;
    const endVal = document.getElementById("ledgerEndDate").value;

    const tbody = document.getElementById("ledgerTableBody");
    const tfoot = document.getElementById("ledgerTableFoot");
    tbody.innerHTML = ""; tfoot.innerHTML = "";

    let completed = allOrders.filter(o => o.patient_status === "Completed");

    const filtered = completed.filter(o => {
        let matchPharma = pharmaVal === "All" ? true : o.medicos_id === pharmaVal;
        let matchDate = true;
        if(startVal || endVal) {
            let oDate = new Date(o.order_date); oDate.setHours(0,0,0,0);
            if(startVal) { let s = new Date(startVal); s.setHours(0,0,0,0); if(oDate < s) matchDate = false; }
            if(endVal) { let e = new Date(endVal); e.setHours(0,0,0,0); if(oDate > e) matchDate = false; }
        }
        return matchPharma && matchDate;
    });

    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No ledger records found.</td></tr>`; return; }

    let sumMrp = 0, sumProfit = 0, sumPhShare = 0, sumBhavya = 0;

    filtered.forEach(o => {
        let dateStr = o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN') : "N/A";
        let mrp = Number(o.total_mrp)||0, profit = Number(o.total_profit)||0;
        let phShare = Number(o.pharma_profit_share)||0, comm = Number(o.bhavya_care_commission)||0;

        sumMrp += mrp; sumProfit += profit; sumPhShare += phShare; sumBhavya += comm;

        let payoutStatus = o.payout_status || "Pending";
        let payoutBadge = payoutStatus === "Paid" ? `<span class="badge" style="background:#d1fae5; color:#059669;">Paid</span>` : `<span class="badge" style="background:#fef3c7; color:#d97706;">Pending</span>`;
        
        let payoutAction = payoutStatus === "Pending" ? 
            `<button class="btn btn-success" style="padding:6px 10px; font-size:11px;" onclick="togglePayout('${o.order_id}', 'Paid')">Mark Paid</button>` : 
            `<button class="btn" style="background:#f1f5f9; color:#64748b; padding:6px 10px; font-size:11px;" onclick="togglePayout('${o.order_id}', 'Pending')">Mark Pending</button>`;

        tbody.innerHTML += `
        <tr>
            <td style="font-weight:700;">#${o.order_id}</td>
            <td>${dateStr}</td>
            <td style="font-size:12px;"><b>${getPharmaName(o.medicos_id)}</b><br><span style="color:#64748b;">${o.medicos_id}</span></td>
            <td>₹${mrp.toFixed(2)}</td>
            <td>₹${profit.toFixed(2)}</td>
            <td style="color:#10b981; font-weight:700;">₹${phShare.toFixed(2)}</td>
            <td style="color:#2563eb; font-weight:700;">₹${comm.toFixed(2)}</td>
            <td style="text-align: center;">${payoutBadge}</td>
            <td>${payoutAction}</td>
        </tr>`;
    });

    tfoot.innerHTML = `
    <tr>
        <td colspan="3" style="text-align:right;">GRAND TOTALS</td>
        <td>₹${sumMrp.toFixed(2)}</td>
        <td>₹${sumProfit.toFixed(2)}</td>
        <td>₹${sumPhShare.toFixed(2)}</td>
        <td style="color:#1d4ed8;">₹${sumBhavya.toFixed(2)}</td>
        <td colspan="2"></td>
    </tr>`;
}

// ✨ NAYA: PAYOUT TOGGLE LOGIC ✨
async function togglePayout(orderId, newStatus) {
    if(!confirm(`Mark payout for ${orderId} as ${newStatus}?`)) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "updatePayoutStatus", order_id: orderId, payout_status: newStatus }) });
        const res = await response.json();
        if(res.status === "success") { 
            showToast(`Payout marked as ${newStatus}`, "success"); 
            fetchAllAdminData(); // Refresh the table
        } else {
            showToast(res.message, "error");
        }
    } catch(e) { showToast("Network error", "error"); }
}

function downloadAdminLedgerPDF() {
    const pharmaVal = document.getElementById("ledgerPharmaFilter").value;
    const startVal = document.getElementById("ledgerStartDate").value;
    const endVal = document.getElementById("ledgerEndDate").value;

    let completed = allOrders.filter(o => o.patient_status === "Completed");

    const filteredOrders = completed.filter(o => {
        let matchPharma = pharmaVal === "All" ? true : o.medicos_id === pharmaVal;
        let matchDate = true;
        if(startVal || endVal) {
            let oDate = new Date(o.order_date); oDate.setHours(0,0,0,0);
            if(startVal) { let s = new Date(startVal); s.setHours(0,0,0,0); if(oDate < s) matchDate = false; }
            if(endVal) { let e = new Date(endVal); e.setHours(0,0,0,0); if(oDate > e) matchDate = false; }
        }
        return matchPharma && matchDate;
    });

    if(filteredOrders.length === 0) { showToast("No records to export for selected filters.", "error"); return; }

    let printWindow = window.open('', '', 'width=1000,height=700');
    
    let reportTitle = "BhavyaCare Admin - Pharmacy Ledger";
    let subTitle = pharmaVal === "All" ? "All Pharmacies" : `Pharmacy: ${getPharmaName(pharmaVal)} (${pharmaVal})`;
    
    if (startVal && endVal) subTitle += ` | Dates: ${startVal} to ${endVal}`;
    else if (startVal) subTitle += ` | From: ${startVal}`;
    else if (endVal) subTitle += ` | Until: ${endVal}`;

    let html = `
    <html><head><title>Admin Ledger</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
        .header { border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px;}
        h1 { color: #4f46e5; margin: 0 0 5px 0; font-size: 26px; }
        .meta { color: #555; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
        th { background-color: #f8fafc; color: #0f172a; font-weight: bold; }
        .totals { font-weight: bold; background-color: #e0e7ff; color: #4f46e5; }
    </style>
    </head><body>
        <div class="header">
            <h1>${reportTitle}</h1>
            <div class="meta"><b>Filters:</b> ${subTitle}</div>
            <div class="meta"><b>Generated on:</b> ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Pharmacy Detail</th>
                    <th>Total MRP (₹)</th>
                    <th>Total Profit (₹)</th>
                    <th>Pharma Share (₹)</th>
                    <th>BhavyaCare Comm (₹)</th>
                    <th>Payout Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let sumMrp = 0, sumProfit = 0, sumPhShare = 0, sumBhavya = 0;

    filteredOrders.forEach(o => {
        let dateStr = o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN') : "N/A";
        let mrp = Number(o.total_mrp)||0, profit = Number(o.total_profit)||0;
        let phShare = Number(o.pharma_profit_share)||0, comm = Number(o.bhavya_care_commission)||0;

        sumMrp += mrp; sumProfit += profit; sumPhShare += phShare; sumBhavya += comm;

        let payoutStatus = o.payout_status || "Pending";

        html += `<tr>
            <td style="font-weight:bold;">#${o.order_id}</td>
            <td>${dateStr}</td>
            <td style="text-align:left;"><b>${getPharmaName(o.medicos_id)}</b><br><small>${o.medicos_id}</small></td>
            <td>${mrp.toFixed(2)}</td>
            <td>${profit.toFixed(2)}</td>
            <td style="color:#10b981;">${phShare.toFixed(2)}</td>
            <td style="color:#2563eb; font-weight:bold;">${comm.toFixed(2)}</td>
            <td style="font-weight:bold; color:${payoutStatus==='Paid'?'#059669':'#d97706'}">${payoutStatus}</td>
        </tr>`;
    });

    html += `
            <tr class="totals">
                <td colspan="3" style="text-align:right; padding-right:15px;">GRAND TOTALS</td>
                <td>₹${sumMrp.toFixed(2)}</td>
                <td>₹${sumProfit.toFixed(2)}</td>
                <td>₹${sumPhShare.toFixed(2)}</td>
                <td>₹${sumBhavya.toFixed(2)}</td>
                <td>-</td>
            </tr>
            </tbody>
        </table>
        <p style="text-align:center; font-size:11px; color:#888; margin-top:30px;">This is a computer-generated administrative report by BhavyaCare.</p>
    </body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print(); 
        setTimeout(() => printWindow.close(), 100);
    };
}
