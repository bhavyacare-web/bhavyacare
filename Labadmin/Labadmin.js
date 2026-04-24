const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allLabsData = [];
let pendingStdRequests = [];
let allAdminOrders = [];
let filteredAdminOrders = [];
let allLabSettlements = []; // ✨ NEW SETTLEMENTS DATA ✨
let currentAdminOrder = null;
let currentOrderStatusFilter = 'ALL';
let currentEditUid = null;

// TOAST NOTIFICATIONS
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

function safeSetText(id, text) { let el = document.getElementById(id); if (el) el.innerText = text; }
function safeSetHTML(id, html) { let el = document.getElementById(id); if (el) el.innerHTML = html; }
function formatDateTime(val) {
    if (!val || val === "N/A" || val.toString().trim() === "") return "N/A";
    try {
        let d = new Date(val); if (isNaN(d.getTime())) return val; 
        let day = ("0" + d.getDate()).slice(-2); let month = ("0" + (d.getMonth() + 1)).slice(-2); let year = d.getFullYear();
        let timeStr = val.toString();
        if (timeStr.indexOf('T') === -1 && timeStr.indexOf(':') === -1) return `${day}-${month}-${year}`;
        let hours = d.getHours(); let minutes = ("0" + d.getMinutes()).slice(-2); let ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12; hours = hours ? hours : 12; 
        return `${day}-${month}-${year} ${("0" + hours).slice(-2)}:${minutes} ${ampm}`;
    } catch(e) { return val; }
}

document.addEventListener("DOMContentLoaded", () => {
    if(document.getElementById("ledgerEndDate") && document.getElementById("ledgerStartDate")) {
        let today = new Date();
        document.getElementById("ledgerEndDate").value = today.toISOString().split('T')[0];
        today.setDate(1); 
        document.getElementById("ledgerStartDate").value = today.toISOString().split('T')[0];
    }
    refreshAllData(true);
});

// ==========================================
// ✨ FIXED: FAST & SAFE REFRESH LOGIC ✨
// ==========================================
async function refreshAllData(silent = false) {
    if(!silent) showToast("Refreshing data...", "info");
    
    try {
        // Parallel Fetching
        const [labsRes, reqsRes, ordRes, setlRes] = await Promise.all([
            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getAdminLabs" }) }),
            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getPendingServiceRequests" }) }),
            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getAllLabOrdersAdmin" }) }),
            fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getLabSettlementsAdmin" }) })
        ]);

        const labsData = await labsRes.json();
        const reqsData = await reqsRes.json();
        const ordData = await ordRes.json();
        const setlData = await setlRes.json();

        // 1. Labs (Safe Parse)
        if(labsData.status === "success") { 
            allLabsData = labsData.data?.data || labsData.data || []; 
            renderLabsTable(); 
        } else {
            document.getElementById("labsTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">No labs data found.</td></tr>`;
        }

        // 2. Requests (Safe Parse)
        if(reqsData.status === "success") { 
            pendingStdRequests = reqsData.data?.standard || reqsData.data || []; 
            const badge = document.getElementById("reqBadge");
            if(badge) badge.style.display = pendingStdRequests.length > 0 ? "inline-block" : "none";
            renderStdRequests(); 
        }

        // 3. Orders
        if(ordData.status === "success") { 
            allAdminOrders = ordData.data || []; 
            filteredAdminOrders = [...allAdminOrders];
            populateLabDropdowns();
            renderAdminOrders(); 
            calculateAdminLedger();
        }

        // 4. Settlements
        if(setlData.status === "success") {
            allLabSettlements = setlData.data || [];
            renderVerifications();
        }

    } catch (err) {
        console.error("Fetch Crash Report:", err); // Ab console me error dikhega
        if(!silent) showToast("Network Error!", "error");
    } finally {
        // 🚀 BADI FIX: Har haal me Loader hide hoga!
        let oMsg = document.getElementById("loadingOrdersMsg");
        if(oMsg) oMsg.style.display = "none";
        
        let lMsg = document.getElementById("loadingLabsMsg");
        if(lMsg) lMsg.style.display = "none";
        
        if(!silent) showToast("Data refreshed!", "success");
    }
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(btnElement) btnElement.classList.add('active');
}

// ==========================================
// 🌟 1. MASTER ORDERS & FILTERS LOGIC 🌟
// ==========================================
function populateLabDropdowns() {
    let orderSel = document.getElementById("orderLabFilter");
    let ledgerSel = document.getElementById("ledgerLabFilter");
    let prevOrderSel = orderSel ? orderSel.value : "ALL";
    let prevLedgerSel = ledgerSel ? ledgerSel.value : "ALL";
    
    let uniqueLabs = {};
    allAdminOrders.forEach(o => {
        if(o.lab_info && o.lab_info.trim() !== "") {
            let match = o.lab_info.match(/\((.*?)\)/);
            let cleanName = match ? match[1] : o.lab_info;
            uniqueLabs[o.lab_info] = cleanName; 
        }
    });

    let optionsHTML = `<option value="ALL">All Registered Labs</option>`;
    for(let key in uniqueLabs) { optionsHTML += `<option value="${key}">${uniqueLabs[key]}</option>`; }

    if(orderSel) { orderSel.innerHTML = optionsHTML; orderSel.value = prevOrderSel; }
    if(ledgerSel) { 
        ledgerSel.innerHTML = `<option value="ALL">All Registered Labs (Total Platform Earning)</option>` + optionsHTML.replace(`<option value="ALL">All Registered Labs</option>`, "");
        ledgerSel.value = prevLedgerSel;
    }
}

function setStatusFilter(status, btnElement) {
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    currentOrderStatusFilter = status;
    filterAdminOrders();
}

function filterAdminOrders() {
    let searchText = document.getElementById("orderSearchBox").value.toLowerCase().trim();
    let selectedLab = document.getElementById("orderLabFilter").value;

    filteredAdminOrders = allAdminOrders.filter(o => {
        let matchSearch = true;
        if(searchText !== "") {
            matchSearch = (o.order_id && o.order_id.toLowerCase().includes(searchText)) ||
                          (o.patient_name && o.patient_name.toLowerCase().includes(searchText)) ||
                          (o.lab_info && o.lab_info.toLowerCase().includes(searchText));
        }
        let matchLab = true;
        if(selectedLab !== "ALL") { matchLab = (o.lab_info === selectedLab); }
        let matchStatus = true;
        let sText = o.status ? o.status.toUpperCase() : "PENDING";
        if(currentOrderStatusFilter !== "ALL") {
            if(currentOrderStatusFilter === "ACTIVE") matchStatus = (sText === "ACTIVE" || sText === "CONFIRMED");
            else matchStatus = (sText === currentOrderStatusFilter);
        }
        return matchSearch && matchLab && matchStatus;
    });
    renderAdminOrders();
}

function renderAdminOrders() {
    const grid = document.getElementById("masterOrdersGrid");
    if(!grid) return;
    
    if(filteredAdminOrders.length === 0) {
        grid.innerHTML = `<div style="padding:40px; text-align:center; width:100%; color:#64748b; grid-column: 1/-1;">No orders found matching criteria.</div>`;
        return;
    }

    grid.innerHTML = "";
    filteredAdminOrders.forEach((order, index) => {
        let statusClass = "status-inactive";
        let statusText = order.status ? order.status.toUpperCase() : "PENDING";
        
        if(statusText === "ACTIVE" || statusText === "CONFIRMED") statusClass = "status-active";
        else if(statusText === "COMPLETED") statusClass = "status-active";
        else if(statusText === "CANCELLED") statusClass = "status-cancel";

        let dtStr = formatDateTime(order.date);

        let card = document.createElement("div");
        card.className = "order-card";
        card.onclick = () => openAdminOrderModal(index);
        
        card.innerHTML = `
            <div class="card-header">
                <div style="font-weight: 800; color: #3b82f6;">#${order.order_id || "N/A"}</div>
                <div style="font-size: 12px; color: #64748b; font-weight: 600;">${dtStr}</div>
            </div>
            <div class="lab-tag"><i class="fas fa-hospital-alt"></i> ${order.lab_info || "Unknown Lab"}</div>
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">${order.patient_name || "Unknown Patient"}</div>
            <div style="font-size: 13px; color: #475569; margin-bottom: 12px;"><i class="fas fa-home"></i> ${order.fulfillment ? order.fulfillment.toUpperCase() : "N/A"}</div>
            
            <div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openAdminOrderModal(index) {
    currentAdminOrder = filteredAdminOrders[index];
    let o = currentAdminOrder;
    let currentStatus = o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase() : "Pending";

    safeSetText("mOrderId", "Order #" + (o.order_id || "N/A"));
    safeSetText("mLabName", o.lab_info || "Unknown Lab");
    safeSetText("mName", o.patient_name || "N/A");
    safeSetText("mSlot", formatDateTime(o.slot));
    safeSetText("mAddress", o.address || "N/A");

    let statSpan = document.getElementById("mStatus");
    if(statSpan) {
        statSpan.innerText = currentStatus.toUpperCase();
        statSpan.className = "status-badge"; 
        if(currentStatus === "Pending") statSpan.classList.add("status-inactive");
        else if(currentStatus === "Active" || currentStatus === "Confirmed" || currentStatus === "Completed") statSpan.classList.add("status-active");
        else statSpan.classList.add("status-cancel");
    }

    let itemsArr = []; let itemsHTML = "";
    try {
        if(o.cart_items) {
            itemsArr = JSON.parse(o.cart_items);
            itemsArr.forEach(item => { itemsHTML += `<div style="display:flex; justify-content:space-between; padding:10px; background:white; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px;"><div style="font-weight:600;">${item.qty}x ${item.service_name}</div><div style="font-weight:800;">₹${item.price}</div></div>`; });
        } else { itemsHTML = "<i>No items found</i>"; }
    } catch(e) { itemsHTML = "<i>Error loading items</i>"; }
    safeSetHTML("mItemsList", itemsHTML);

    safeSetText("mFinalPay", "₹" + (o.final_payable || 0));
    
    let bComm = Number(o.bhavya_commission || 0);
    safeSetText("mComm", (bComm >= 0 ? "+" : "-") + "₹" + Math.abs(bComm).toFixed(2));
    document.getElementById("mComm").style.color = bComm >= 0 ? "#16a34a" : "#ef4444"; 
    
    safeSetText("mLabEarn", "₹" + (o.lab_earning || 0));

    let actionArea = document.getElementById("mActionArea");
    if(actionArea) {
        actionArea.innerHTML = "";
        let reportsHTML = getReportsHTML(o); 

        let handArr = [];
        if (o.hand_reports) { try { handArr = JSON.parse(o.hand_reports); if (!Array.isArray(handArr)) handArr = [o.hand_reports]; } catch(e) { handArr = [o.hand_reports]; } }

        let checksHTML = `<div id="adminInHandCheckboxes" style="display:none; background:white; padding:15px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:15px;">`;
        checksHTML += `<div style="font-weight:600; margin-bottom:10px; color:#475569;">Select services given in hand:</div>`;
        let itemsAvailableForHand = false;
        itemsArr.forEach(item => {
            if(!handArr.includes(item.service_name)) {
                itemsAvailableForHand = true;
                checksHTML += `<label style="display:block; margin-bottom:8px; cursor:pointer; font-weight:500;"><input type="checkbox" class="admin-in-hand-chk" value="${item.service_name}" style="margin-right:8px; width:16px; height:16px;"> ${item.service_name}</label>`;
            }
        });
        if(!itemsAvailableForHand) checksHTML += `<div style="color:red; font-size:13px;">All services have already been marked as In-Hand.</div>`;
        checksHTML += `</div>`;

        if (currentStatus === "Pending") {
            actionArea.innerHTML = `
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 12px; margin-top: 25px;">
                    <div style="font-weight:700; margin-bottom:10px; color:#1e293b;">Admin Force Actions:</div>
                    <input type="text" id="adminCancelReason" class="search-box" placeholder="Reason for cancellation..." style="width:100%; margin-bottom:10px;">
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-green" style="flex:1;" onclick="adminSubmitAction('Confirm')">Force Confirm</button>
                        <button class="btn btn-red" style="flex:1;" onclick="adminSubmitAction('Cancel')">Force Cancel</button>
                    </div>
                </div>`;
        } 
        else if (currentStatus === "Active" || currentStatus === "Confirmed" || currentStatus === "Completed") {
            actionArea.innerHTML = `
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 12px; margin-top: 25px;">
                    ${reportsHTML}
                    <div style="font-weight:700; margin-top:20px; margin-bottom:10px; color:#1e293b;">Force Upload Report (On behalf of Lab):</div>
                    <select id="adminReportType" class="search-box" style="width:100%; margin-bottom: 10px;" onchange="toggleAdminReportInput()">
                        <option value="">Select Report Type</option>
                        <option value="Online">Online (Upload PDF)</option>
                        <option value="In Hand">In Hand (Physical Copy)</option>
                    </select>
                    <input type="file" id="adminReportPdfFile" class="search-box" accept=".pdf,image/*" style="display:none; width:100%; margin-bottom: 10px; background:white;">
                    ${checksHTML}
                    <button class="btn btn-blue" style="width:100%; padding:12px;" onclick="adminSubmitReport()"><i class="fas fa-upload"></i> Save & Mark Completed</button>
                </div>`;
        }
    }

    document.getElementById("adminOrderModal").style.display = "flex";
}

function getReportsHTML(o) {
    let onlineArr = [];
    if (o.report_pdf) { try { onlineArr = JSON.parse(o.report_pdf); if (!Array.isArray(onlineArr)) onlineArr = [o.report_pdf]; } catch(e) { onlineArr = [o.report_pdf]; } }
    
    let handArr = [];
    if (o.hand_reports) { try { handArr = JSON.parse(o.hand_reports); if (!Array.isArray(handArr)) handArr = [o.hand_reports]; } catch(e) { handArr = [o.hand_reports]; } }

    let html = "";
    if (onlineArr.length > 0 || handArr.length > 0) {
        html += `<div style="margin-bottom:10px; font-weight:700; color:#166534;"><i class="fas fa-check-circle"></i> Uploaded / Given Reports:</div>`;
        onlineArr.forEach((url, i) => {
            if(url.trim() !== "") {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #cbd5e1;">
                    <a href="${url}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:none;"><i class="fas fa-file-pdf"></i> Online Report ${i+1}</a>
                    <button onclick="adminDeleteReport(${i})" class="btn btn-red" style="padding:4px 8px; font-size:11px;"><i class="fas fa-trash"></i></button>
                </div>`;
            }
        });
        handArr.forEach((srv) => {
            if(srv.trim() !== "") {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#fefce8; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #fef08a;">
                    <span style="color:#854d0e; font-weight:600;"><i class="fas fa-hand-holding-medical"></i> In Hand: ${srv}</span>
                    <button onclick="adminDeleteInHandReport('${srv}')" class="btn btn-red" style="padding:4px 8px; font-size:11px;"><i class="fas fa-trash"></i></button>
                </div>`;
            }
        });
    }
    return html;
}

function toggleAdminReportInput() {
    let type = document.getElementById("adminReportType").value;
    document.getElementById("adminReportPdfFile").style.display = (type === "Online") ? "block" : "none";
    document.getElementById("adminInHandCheckboxes").style.display = (type === "In Hand") ? "block" : "none";
}

function closeAdminOrderModal() { document.getElementById("adminOrderModal").style.display = "none"; currentAdminOrder = null; }

function adminSubmitAction(actionType) {
    let payload = { action: "processLabOrderAction", order_id: currentAdminOrder.order_id, action_type: actionType };
    if(actionType === "Cancel") {
        let reason = document.getElementById("adminCancelReason").value.trim();
        if(!reason) { showToast("Please type a cancellation reason.", "error"); return; }
        payload.cancel_reason = "Admin Force Cancel: " + reason;
    }
    adminCallOrderApi(payload);
}

function adminDeleteReport(index) {
    if(confirm("Admin: Are you sure you want to force delete this online report?")) {
        adminCallOrderApi({ action: "processLabOrderAction", order_id: currentAdminOrder.order_id, action_type: "DeleteReport", delete_type: "Online", file_index: index });
    }
}

function adminDeleteInHandReport(serviceName) {
    if(confirm(`Admin: Are you sure you want to remove In-Hand status for "${serviceName}"?`)) {
        adminCallOrderApi({ action: "processLabOrderAction", order_id: currentAdminOrder.order_id, action_type: "DeleteReport", delete_type: "InHand", service_name: serviceName });
    }
}

async function adminSubmitReport() {
    let rType = document.getElementById("adminReportType").value;
    if(!rType) { showToast("Please select a Report Type.", "error"); return; }
    
    if (rType === "Online") {
        let fileInput = document.getElementById("adminReportPdfFile");
        if(!fileInput || fileInput.files.length === 0) { showToast("Please select a file.", "error"); return; }
        let file = fileInput.files[0];
        if(file.size > 3 * 1024 * 1024) { showToast("File size must be less than 3MB.", "error"); return; }
        
        try {
            let base64 = await new Promise((res, rej) => {
                let reader = new FileReader(); reader.onload = () => res(reader.result.split(',')[1]); reader.onerror = e => rej(e); reader.readAsDataURL(file);
            });
            adminCallOrderApi({ action: "processLabOrderAction", order_id: currentAdminOrder.order_id, action_type: "UploadReport", report_type: "Online", base64Pdf: base64, mimeType: file.type });
        } catch(e) { showToast("Error reading file.", "error"); }
    } 
    else if (rType === "In Hand") {
        let checkboxes = document.querySelectorAll(".admin-in-hand-chk:checked");
        if(checkboxes.length === 0) { showToast("Select at least one service.", "error"); return; }
        let selectedServices = []; checkboxes.forEach(chk => selectedServices.push(chk.value));
        adminCallOrderApi({ action: "processLabOrderAction", order_id: currentAdminOrder.order_id, action_type: "UploadReport", report_type: "In Hand", in_hand_services: selectedServices });
    }
}

function adminCallOrderApi(payload) {
    let modal = document.getElementById("adminOrderModal");
    if(modal) { modal.style.opacity = "0.7"; modal.style.pointerEvents = "none"; }
    
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") { 
            showToast("Admin Action Successful!", "success"); 
            setTimeout(()=> { window.location.reload(); }, 1500);
        } else { showToast("Error: " + data.message, "error"); }
    }).catch(err => { showToast("Network Error occurred!", "error"); })
    .finally(() => { if(modal) { modal.style.opacity = "1"; modal.style.pointerEvents = "auto"; } });
}


// ==========================================
// 🌟 3. MASTER SETTLEMENT LEDGER & PDF 🌟
// ==========================================
function calculateAdminLedger() {
    let startInput = document.getElementById("ledgerStartDate");
    let endInput = document.getElementById("ledgerEndDate");
    let labSelect = document.getElementById("ledgerLabFilter");
    
    if(!startInput || !endInput || !labSelect) return; 

    let start = new Date(startInput.value);
    let end = new Date(endInput.value);
    end.setHours(23, 59, 59);

    let selectedLab = labSelect.value;
    let labDisplayName = labSelect.options[labSelect.selectedIndex].text;

    safeSetText("pdfLedgerDate", `Period: ${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')} | Entity: ${labDisplayName}`);

    let completedOrders = allAdminOrders.filter(o => {
        let oDate = new Date(o.date);
        let matchLab = selectedLab === "ALL" ? true : (o.lab_info === selectedLab);
        return o.status && o.status.toUpperCase() === "COMPLETED" && oDate >= start && oDate <= end && matchLab;
    });

    let tColl = 0, tRev = 0, tNet = 0;
    let html = "";

    completedOrders.forEach(o => {
        let coll = Number(o.final_payable || 0);
        let rev = Number(o.bhavya_commission || 0);
        let net = Number(o.lab_earning || 0);

        tColl += coll; tRev += rev; tNet += net;

        let cleanLabName = o.lab_info ? o.lab_info.split("(")[0].trim() : "N/A";
        
        let payoutStatus = o.payment_status || "Due";
        let payoutBadge = payoutStatus === "Paid" ? `<span class="status-badge" style="background:#d1fae5; color:#059669;">Paid</span>` : `<span class="status-badge" style="background:#fef3c7; color:#d97706;">${payoutStatus}</span>`;
        let payoutAction = payoutStatus !== "Paid" 
            ? `<button class="btn btn-green" style="padding:6px 10px; font-size:11px;" onclick="toggleLabPayoutStatus('${o.order_id}', 'Paid')">Mark Paid</button>` 
            : `<button class="btn" style="background:#f1f5f9; color:#64748b; padding:6px 10px; font-size:11px;" onclick="toggleLabPayoutStatus('${o.order_id}', 'Due')">Mark Due</button>`;

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px;">${new Date(o.date).toLocaleDateString('en-IN')}</td>
                <td style="padding:10px; font-weight:600; color:#3b82f6;">${o.order_id}</td>
                <td style="padding:10px; font-size:12px;">${cleanLabName}</td>
                <td style="padding:10px; text-align:right;">₹${coll.toFixed(2)}</td>
                <td style="padding:10px; text-align:right; color:#e11d48; font-weight:600;">₹${rev.toFixed(2)}</td>
                <td style="padding:10px; text-align:right; font-weight:700; color:#15803d;">₹${net.toFixed(2)}</td>
                <td style="padding:10px; text-align:center;">${payoutBadge}</td>
                <td style="padding:10px; text-align:center;">${payoutAction}</td>
            </tr>`;
    });

    if (completedOrders.length > 0) {
        html += `
            <tr style="background:#f1f5f9; font-weight:800; border-top:2px solid #cbd5e1; font-size:14px;">
                <td colspan="3" style="padding:12px; text-align:right;">GRAND TOTAL:</td>
                <td style="padding:12px; text-align:right;">₹${tColl.toFixed(2)}</td>
                <td style="padding:12px; text-align:right; color:#e11d48;">₹${tRev.toFixed(2)}</td>
                <td style="padding:12px; text-align:right; color:#15803d;">₹${tNet.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>`;
    }

    safeSetText("adminTotalColl", "₹" + tColl.toLocaleString('en-IN'));
    safeSetText("adminTotalRev", "₹" + tRev.toLocaleString('en-IN'));
    safeSetText("adminLabNet", "₹" + tNet.toLocaleString('en-IN'));
    safeSetHTML("adminLedgerTableBody", html || "<tr><td colspan='8' style='text-align:center; padding:20px; color:#64748b;'>No completed orders found for this criteria.</td></tr>");
}

async function toggleLabPayoutStatus(orderId, newStatus) {
    if(!confirm(`Update payout status to ${newStatus} for ${orderId}?`)) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { 
            method: "POST", 
            headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify({ action: "updateLabPayoutStatus", order_id: orderId, payout_status: newStatus }) 
        });
        const res = await response.json();
        if(res.status === "success") { showToast(`Status updated to ${newStatus}`, "success"); refreshAllData(true); } 
        else { showToast(res.message, "error"); }
    } catch(e) { showToast("Network error", "error"); }
}

function downloadAdminPDF() {
    const element = document.getElementById('admin-pdf-content');
    if(!element) return;
    
    let labSelect = document.getElementById("ledgerLabFilter");
    let name = labSelect.value === "ALL" ? "Platform_Master" : labSelect.options[labSelect.selectedIndex].text.replace(/[^a-zA-Z0-9]/g, '_');

    const opt = {
        margin: 10,
        filename: `Settlement_${name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

// ==========================================
// ✨ FIXED: LAB VERIFICATIONS (With Smart Search & Date) ✨
// ==========================================
function renderVerifications() {
    const container = document.getElementById("verificationContainer");
    if(!container) return; 
    container.innerHTML = "";
    
    // Filters ki values read karna
    const statusFilter = document.getElementById("verifyStatusFilter") ? document.getElementById("verifyStatusFilter").value : "Pending";
    const searchText = document.getElementById("verifySearchBox") ? document.getElementById("verifySearchBox").value.toLowerCase().trim() : "";
    const startDateVal = document.getElementById("verifyStartDate") ? document.getElementById("verifyStartDate").value : "";
    const endDateVal = document.getElementById("verifyEndDate") ? document.getElementById("verifyEndDate").value : "";

    let start = startDateVal ? new Date(startDateVal) : null;
    let end = endDateVal ? new Date(endDateVal) : null;
    if(end) end.setHours(23, 59, 59);

    // Date Parser helper (Kyunki Sheet se DD/MM/YYYY text format me aata hai)
    function parseSheetDate(dateStr) {
        if(!dateStr || dateStr === "N/A" || dateStr === "") return null;
        let parts = dateStr.split(' ')[0].split('/'); 
        if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]); 
        return new Date(dateStr); 
    }

    // Data ko filter karna
    const filteredSetl = allLabSettlements.filter(s => {
        // 1. Status Check
        let matchStatus = (s.status === statusFilter);
        
        // 2. Search Check (Settlement ID ya Lab ID)
        let matchText = true;
        if(searchText) {
            let lId = s.lab_id ? s.lab_id.toLowerCase() : "";
            let sId = s.settlement_id ? s.settlement_id.toLowerCase() : "";
            matchText = lId.includes(searchText) || sId.includes(searchText);
        }

        // 3. Date Check (Agar Pending hai toh Payment Date, warna Verified Date dekhega)
        let matchDate = true;
        let recordDate = statusFilter === "Pending" ? parseSheetDate(s.payment_date) : parseSheetDate(s.verified_date || s.payment_date);
        
        if (start && recordDate && recordDate < start) matchDate = false;
        if (end && recordDate && recordDate > end) matchDate = false;

        return matchStatus && matchText && matchDate;
    });

    if(filteredSetl.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:40px; background:white; border-radius:12px; color:#64748b;">No ${statusFilter.toLowerCase()} verifications found for this search.</div>`;
        return;
    }

    filteredSetl.forEach(data => {
        let imgHtml = (data.screenshot_url && data.screenshot_url !== "N/A") 
            ? `<a href="${data.screenshot_url}" target="_blank" style="display:block; margin-top:15px; background:#eff6ff; color:#2563eb; padding:10px; border-radius:8px; text-align:center; font-weight:bold; text-decoration:none;"><i class="fas fa-image"></i> View Uploaded Receipt</a>` 
            : `<p style="color:#dc2626; font-size:12px; margin-top:15px; text-align:center;">No screenshot uploaded</p>`;

        let badgeHtml = "";
        if (statusFilter === "Verified") badgeHtml = `<span class="status-badge" style="background:#d1fae5; color:#059669;">✔ Verified</span>`;
        else if (statusFilter === "Rejected") badgeHtml = `<span class="status-badge" style="background:#fee2e2; color:#dc2626;">✖ Rejected</span>`;
        else badgeHtml = `<span class="status-badge" style="background:#fef3c7; color:#d97706;">Pending</span>`;

        let actionHtml = "";
        if (statusFilter === "Pending") {
            actionHtml = `
            <div style="display:flex; gap:10px; margin-top: 15px;">
                <button class="btn btn-green" style="flex:1; padding: 12px; font-size: 14px;" onclick="actionLabPayout('${data.settlement_id}', '${data.lab_id}', 'Verify')"><i class="fas fa-check-circle"></i> Verify</button>
                <button class="btn btn-red" style="flex:1; padding: 12px; font-size: 14px;" onclick="actionLabPayout('${data.settlement_id}', '${data.lab_id}', 'Reject')"><i class="fas fa-times-circle"></i> Reject</button>
            </div>`;
        } else {
            let remarksText = data.admin_remarks ? `<br><span style="color:#ef4444; font-size:11px; display:block; margin-top:5px;">Reason: ${data.admin_remarks}</span>` : "";
            let colorClass = statusFilter === "Verified" ? "#059669" : "#dc2626";
            let bgClass = statusFilter === "Verified" ? "#ecfdf5" : "#fef2f2";
            let iconClass = statusFilter === "Verified" ? "fa-check-double" : "fa-ban";
            
            let vDate = data.verified_date ? data.verified_date : "Recently";

            actionHtml = `<div style="margin-top:15px; padding:12px; background:${bgClass}; border:1px dashed ${colorClass}; border-radius:8px; text-align:center; color:${colorClass}; font-weight:bold; font-size:13px;">
                <i class="fas ${iconClass}"></i> ${statusFilter} on ${vDate}
                ${remarksText}
            </div>`;
        }

        let pDate = data.payment_date ? data.payment_date : "Recently";

        let card = `
        <div style="background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <h3 style="margin: 0; color: #0f172a; font-size:18px;">Lab ID: ${data.lab_id}</h3>
                ${badgeHtml}
            </div>
            <p style="margin: 0 0 15px 0; color: #64748b; font-size: 12px;">SETL: ${data.settlement_id}</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Amount Paid</p>
                <h2 style="margin: 5px 0 0 0; color: #10b981; font-size: 32px;">₹${data.amount}</h2>
                <p style="font-size:11px; margin-top:5px; color:#888;">Paid on: ${pDate}</p>
            </div>
            ${imgHtml}
            ${actionHtml}
        </div>`;
        container.innerHTML += card;
    });
}
// ✨ UNIFIED ACTION HANDLER (VERIFY & REJECT) ✨
async function actionLabPayout(settlementId, labId, actionType) {
    let remarks = "";
    if (actionType === "Reject") {
        remarks = prompt("Enter reason for rejecting this payment:");
        if (!remarks) { showToast("Rejection cancelled.", "info"); return; }
    } else {
        if(!confirm(`Verify payment ${settlementId} for Lab ${labId}? This clears their dues.`)) return;
    }
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { 
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                action: "processLabPayoutAction", 
                settlement_id: settlementId, 
                lab_id: labId,
                action_type: actionType,
                remarks: remarks
            }) 
        });
        const res = await response.json();
        if(res.status === "success") { showToast(res.message, "success"); refreshAllData(); } 
        else { showToast(res.message, "error"); }
    } catch(e) { showToast("Network error", "error"); }
}

async function approveLabPayout(settlementId, labId) {
    if(!confirm(`Verify payment ${settlementId} for Lab ${labId}? This clears their dues.`)) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { 
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "approveLabPayoutRequest", settlement_id: settlementId, lab_id: labId }) 
        });
        const res = await response.json();
        if(res.status === "success") { showToast("Payment Verified Successfully!", "success"); refreshAllData(); } 
        else { showToast(res.message, "error"); }
    } catch(e) { showToast("Network error", "error"); }
}

// ==========================================
// 4. MANAGE LABS & REQS
// ==========================================
function renderLabsTable() {
    const tbody = document.getElementById("labsTableBody");
    tbody.innerHTML = "";
    allLabsData.forEach((lab, index) => {
        let badgeClass = "status-inactive"; let statusText = lab.status.toUpperCase();
        if(statusText === "ACTIVE") badgeClass = "status-active";
        else if(statusText === "CANCEL") badgeClass = "status-cancel";

        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:600;">${lab.lab_name}</td>
            <td>${lab.email}</td>
            <td>${lab.city} - ${lab.pincode}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            <td><button class="btn btn-blue" onclick="openLabModal(${index})"><i class="fas fa-search"></i> Review</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function openLabModal(index) {
    const lab = allLabsData[index];
    currentEditUid = lab.user_id;

    safeSetText("modalLabName", lab.lab_name);
    safeSetText("modalUid", lab.user_id);
    safeSetText("modalEmail", lab.email);
    safeSetText("modalAddress", lab.address || "N/A");
    safeSetText("modalCityPin", lab.city + " - " + lab.pincode);

    const docsDiv = document.getElementById("modalDocs");
    docsDiv.innerHTML = "";
    if(lab.reg_doc_url) docsDiv.innerHTML += `<a href="${lab.reg_doc_url}" target="_blank" class="doc-link"><i class="fas fa-file-pdf"></i> Reg Doc</a>`;
    if(lab.nabl_url) docsDiv.innerHTML += `<a href="${lab.nabl_url}" target="_blank" class="doc-link"><i class="fas fa-check-circle"></i> NABL</a>`;
    if(lab.nabh_url) docsDiv.innerHTML += `<a href="${lab.nabh_url}" target="_blank" class="doc-link"><i class="fas fa-check-circle"></i> NABH</a>`;
    if(lab.img1_url) docsDiv.innerHTML += `<a href="${lab.img1_url}" target="_blank" class="doc-link"><i class="fas fa-image"></i> Img 1</a>`;
    if(lab.img2_url) docsDiv.innerHTML += `<a href="${lab.img2_url}" target="_blank" class="doc-link"><i class="fas fa-image"></i> Img 2</a>`;
    if(lab.img3_url) docsDiv.innerHTML += `<a href="${lab.img3_url}" target="_blank" class="doc-link"><i class="fas fa-image"></i> Img 3</a>`;
    if(docsDiv.innerHTML === "") docsDiv.innerHTML = "<span style='color:#94a3b8; font-size:13px; padding:10px;'>No documents uploaded by lab.</span>";

    let sel = document.getElementById("modalStatusSelect");
    const statusVal = lab.status.charAt(0).toUpperCase() + lab.status.slice(1).toLowerCase();
    sel.value = "Inactive"; 
    for(let i=0; i<sel.options.length; i++){ if(sel.options[i].value.toLowerCase() === statusVal.toLowerCase()){ sel.selectedIndex = i; break; } }
    document.getElementById("editLabModal").style.display = "flex";
}

function closeLabModal() { document.getElementById("editLabModal").style.display = "none"; }

function saveLabDetails() {
    if(!currentEditUid) return;
    const btn = document.getElementById("saveBtn");
    btn.innerText = "Updating..."; btn.disabled = true;
    const payload = { action: "updateAdminLab", user_id: currentEditUid, status: document.getElementById("modalStatusSelect").value, services: {} };

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        btn.innerText = "Update & Notify Lab"; btn.disabled = false;
        if(data.status === "success") { showToast("Lab updated!", "success"); refreshAllData(true); closeLabModal(); } 
    });
}

function renderStdRequests() {
    const tbody = document.getElementById("stdReqTableBody");
    tbody.innerHTML = "";
    if(pendingStdRequests.length === 0) { tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>No requests.</td></tr>"; return; }

    pendingStdRequests.forEach((req) => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td><b>${req.lab_name}</b><br><small>${req.user_id}</small></td>
            <td><textarea id="req_json_${req.user_id}" style="width:100%; height:60px;">${req.requested_services}</textarea></td>
            <td>
                <button class="btn btn-green" onclick="handleStdReq('${req.user_id}', 'Approve')">Approve</button>
                <button class="btn btn-red" onclick="handleStdReq('${req.user_id}', 'Reject')">Reject</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleStdReq(userId, actionType) {
    let modifiedJson = "";
    if (actionType === 'Approve') {
        modifiedJson = document.getElementById(`req_json_${userId}`).value;
        try { JSON.parse(modifiedJson); } catch (e) { return showToast("Invalid JSON format!", "error"); }
    }
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST', body: JSON.stringify({ action: "processStandardServiceRequest", user_id: userId, request_action: actionType, modified_json: modifiedJson })
    }).then(res => res.json()).then(data => { 
        showToast(data.message, "info"); 
        refreshAllData(true); 
    });
}
