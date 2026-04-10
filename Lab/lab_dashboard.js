// ==========================================
// lab_dashboard.js
// Logic for fetching and managing lab orders
// ==========================================

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allOrders = [];
let currentOrder = null;

// 🌟 CRASH-PROOF HELPERS 🌟
function safeSetText(id, text) {
    let el = document.getElementById(id);
    if (el) el.innerText = text;
}
function safeSetHTML(id, html) {
    let el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
    const labName = localStorage.getItem("bhavya_name");
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId || localStorage.getItem("bhavya_role") !== "lab") {
        alert("Unauthorized Access!"); 
        window.location.href = "../index.html"; 
        return;
    }

    safeSetText("displayLabName", labName + " (" + userId + ")");
    
    // Ledger ke liye default dates set karna (Current Month)
    if(document.getElementById("endDate") && document.getElementById("startDate")) {
        let today = new Date();
        document.getElementById("endDate").value = today.toISOString().split('T')[0];
        today.setDate(1); // Mahine ki pehli tareekh
        document.getElementById("startDate").value = today.toISOString().split('T')[0];
    }

    fetchOrders(userId);
});

function fetchOrders(userId) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "getLabDashboardOrders", user_id: userId })
    })
    .then(res => res.json())
    .then(data => {
        let lMsg = document.getElementById("loadingMsg");
        if(lMsg) lMsg.style.display = "none";

        if(data.status === "success") {
            allOrders = data.data;
            renderOrders();
            // Ledger tab ke liye auto-calculate
            if(typeof calculateLedger === 'function') calculateLedger(); 
        } else {
            let grid = document.getElementById("ordersGrid");
            if(grid) grid.innerHTML = `<p style="color:red; padding:20px;">Error: ${data.message}</p>`;
        }
    }).catch(err => {
        let lMsg = document.getElementById("loadingMsg");
        if(lMsg) {
            lMsg.innerText = "Network Error!";
            lMsg.style.color = "red";
        }
    });
}

function renderOrders() {
    const grid = document.getElementById("ordersGrid");
    if(!grid) return;
    
    if(allOrders.length === 0) {
        grid.innerHTML = `<div style="padding:40px; text-align:center; width:100%; color:#64748b;">No orders found for your lab.</div>`;
        return;
    }

    grid.innerHTML = "";
    allOrders.forEach((order, index) => {
        let statusClass = "badge-pending";
        let statusText = order.status ? order.status.toUpperCase() : "PENDING";
        
        if(statusText === "ACTIVE" || statusText === "CONFIRMED") statusClass = "badge-active";
        else if(statusText === "COMPLETED") statusClass = "badge-completed";
        else if(statusText === "CANCELLED") statusClass = "badge-cancelled";

        let payClass = order.payment_status === "COMPLETED" ? "badge-paid" : "badge-due";
        let dtStr = order.date ? new Date(order.date).toLocaleDateString("en-IN", {day:'numeric', month:'short', year:'numeric'}) : "Date N/A";

        let card = document.createElement("div");
        card.className = "order-card";
        card.onclick = () => openOrderModal(index);
        
        card.innerHTML = `
            <div class="order-card-header">
                <div class="order-id">#${order.order_id || "N/A"}</div>
                <div class="order-date">${dtStr}</div>
            </div>
            <div class="patient-name">${order.patient_name || "Unknown Patient"}</div>
            <div class="order-info"><i class="fas fa-clock"></i> ${order.slot || "N/A"}</div>
            <div class="order-info"><i class="fas fa-home"></i> ${order.fulfillment ? order.fulfillment.toUpperCase() : "N/A"}</div>
            
            <div class="badges-row">
                <span class="badge ${statusClass}">${statusText}</span>
                <span class="badge ${payClass}">Pay: ${order.payment_status}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openOrderModal(index) {
    currentOrder = allOrders[index];
    let o = currentOrder;
    let currentStatus = o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase() : "Pending";

    safeSetText("mOrderId", "Order #" + (o.order_id || "N/A"));
    safeSetText("mName", o.patient_name || "N/A");
    safeSetText("mSlot", o.slot || "N/A");
    safeSetText("mAddress", o.address || "N/A");
    safeSetText("mFulfill", o.fulfillment ? o.fulfillment.toUpperCase() : "N/A");

    let statSpan = document.getElementById("mStatus");
    if(statSpan) {
        statSpan.innerText = currentStatus.toUpperCase();
        statSpan.className = "badge"; 
        if(currentStatus === "Pending") statSpan.classList.add("badge-pending");
        else if(currentStatus === "Active" || currentStatus === "Confirmed") statSpan.classList.add("badge-active");
        else if(currentStatus === "Completed") statSpan.classList.add("badge-completed");
        else statSpan.classList.add("badge-cancelled");
    }

    let paySpan = document.getElementById("mPayStatus");
    if(paySpan) {
        paySpan.innerText = "Payment: " + o.payment_status;
        paySpan.className = "badge";
        paySpan.classList.add(o.payment_status === "COMPLETED" ? "badge-paid" : "badge-due");
    }

    let itemsArr = [];
    let itemsHTML = "";
    try {
        if(o.cart_items) {
            itemsArr = JSON.parse(o.cart_items);
            itemsArr.forEach(item => {
                itemsHTML += `<div class="cart-item"><div class="item-name">${item.qty}x ${item.service_name}</div><div class="item-price">₹${item.price}</div></div>`;
            });
        } else { itemsHTML = "<i>No items found</i>"; }
    } catch(e) { itemsHTML = "<i>Error loading items</i>"; }
    safeSetHTML("mItemsList", itemsHTML);

    // PATIENT BILLING
    safeSetText("mSub", "₹" + (o.subtotal || 0));
    safeSetText("mColl", "₹" + (o.collection_charge || 0));
    safeSetText("mDisc", "-₹" + (o.discount || 0));
    safeSetText("mFinal", "₹" + (o.final_payable || 0));

    // 🌟 LAB EARNING BREAKDOWN 🌟
    safeSetText("mFinalPay", "₹" + (o.final_payable || 0));
    
    let commEl = document.getElementById("mComm");
    if (commEl) {
        let bComm = Number(o.bhavya_commission || 0);
        if (bComm >= 0) {
            commEl.innerText = "-₹" + bComm.toFixed(2);
            commEl.style.color = "#ef4444"; // red
        } else {
            commEl.innerText = "+₹" + Math.abs(bComm).toFixed(2);
            commEl.style.color = "#16a34a"; // green
        }
    }
    
    safeSetText("mLabEarn", "₹" + (o.lab_earning || 0));

    let onlineArr = [];
    if (o.report_pdf) { try { onlineArr = JSON.parse(o.report_pdf); if (!Array.isArray(onlineArr)) onlineArr = [o.report_pdf]; } catch(e) { onlineArr = [o.report_pdf]; } }

    let handArr = [];
    if (o.hand_reports) { try { handArr = JSON.parse(o.hand_reports); if (!Array.isArray(handArr)) handArr = [o.hand_reports]; } catch(e) { handArr = [o.hand_reports]; } }

    let reportsHTML = "";
    if (onlineArr.length > 0 || handArr.length > 0) {
        reportsHTML += `<div style="margin-bottom:10px; font-weight:700; color:#166534;"><i class="fas fa-check-circle"></i> Uploaded / Given Reports:</div>`;
        onlineArr.forEach((url, i) => {
            if(url.trim() !== "") {
                reportsHTML += `<div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #e2e8f0;">
                    <a href="${url}" target="_blank" style="color:#2563eb; font-weight:600; text-decoration:none;"><i class="fas fa-file-pdf"></i> Online Report ${i+1}</a>
                    <button onclick="deleteOnlineReport(${i})" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-trash"></i> Delete</button>
                </div>`;
            }
        });
        handArr.forEach((srv) => {
            if(srv.trim() !== "") {
                reportsHTML += `<div style="display:flex; justify-content:space-between; align-items:center; background:#fefce8; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #fef08a;">
                    <span style="color:#854d0e; font-weight:600;"><i class="fas fa-hand-holding-medical"></i> In Hand: ${srv}</span>
                    <button onclick="deleteInHandReport('${srv}')" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-trash"></i> Delete</button>
                </div>`;
            }
        });
    }

    let checksHTML = `<div id="inHandCheckboxes" style="display:none; background:white; padding:15px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:15px;">`;
    checksHTML += `<div style="font-weight:600; margin-bottom:10px; color:#475569;">Select services given in hand:</div>`;
    let itemsAvailableForHand = false;
    itemsArr.forEach(item => {
        if(!handArr.includes(item.service_name)) {
            itemsAvailableForHand = true;
            checksHTML += `<label style="display:block; margin-bottom:8px; cursor:pointer; font-weight:500;"><input type="checkbox" class="in-hand-chk" value="${item.service_name}" style="margin-right:8px; width:16px; height:16px;"> ${item.service_name}</label>`;
        }
    });
    if(!itemsAvailableForHand) checksHTML += `<div style="color:red; font-size:13px;">All services have already been marked as In-Hand.</div>`;
    checksHTML += `</div>`;

    let actionArea = document.getElementById("mActionArea");
    if(actionArea) {
        actionArea.innerHTML = "";
        if (currentStatus === "Pending") {
            actionArea.innerHTML = `
                <div class="action-box">
                    <div style="font-weight:600; margin-bottom:10px;">Pending Actions:</div>
                    <input type="text" id="cancelReason" class="input-box" placeholder="If cancelling, type reason here..." style="display:none; margin-bottom: 15px;">
                    <div class="btn-group">
                        <button class="btn btn-green" onclick="submitAction('Confirm')"><i class="fas fa-check"></i> Accept Order</button>
                        <button class="btn btn-red" onclick="toggleCancelReason()"><i class="fas fa-times"></i> Cancel</button>
                    </div>
                    <button class="btn btn-red" id="finalCancelBtn" onclick="submitAction('Cancel')" style="display:none; width:100%; margin-top:15px;">Confirm Cancellation</button>
                </div>`;
        } 
        else if (currentStatus === "Active" || currentStatus === "Confirmed" || currentStatus === "Completed") {
            actionArea.innerHTML = `
                <div class="action-box">
                    ${reportsHTML}
                    <div style="font-weight:600; margin-top:20px; margin-bottom:10px;">${(onlineArr.length > 0 || handArr.length > 0) ? 'Add Another Report:' : 'Provide Report & Complete Order:'}</div>
                    <select id="reportType" class="input-box" onchange="toggleReportInput()" style="margin-bottom: 15px;">
                        <option value="">Select Report Type</option>
                        <option value="Online">Online (Upload PDF)</option>
                        <option value="In Hand">In Hand (Physical Copy)</option>
                    </select>
                    <input type="file" id="reportPdfFile" class="input-box" accept=".pdf" style="display:none; margin-bottom: 15px;">
                    ${checksHTML}
                    <button class="btn btn-blue" style="width:100%; margin-top:5px;" onclick="submitReport()"><i class="fas fa-save"></i> Save & Mark Completed</button>
                </div>`;
        }
        else if (currentStatus === "Cancelled") {
            actionArea.innerHTML = `<div class="action-box" style="background:#fee2e2; border-color:#fecaca; color:#991b1b; text-align:center;"><i class="fas fa-times-circle" style="font-size:30px; margin-bottom:10px;"></i><div style="font-weight:bold;">Order Cancelled</div></div>`;
        }
    }

    let modal = document.getElementById("orderModal");
    if(modal) modal.style.display = "flex";
}

function closeModal() { 
    let modal = document.getElementById("orderModal");
    if(modal) modal.style.display = "none"; 
    currentOrder = null; 
}

function toggleCancelReason() {
    const r = document.getElementById("cancelReason");
    const b = document.getElementById("finalCancelBtn");
    if(!r || !b) return;
    if (r.style.display === "none") { r.style.display = "block"; b.style.display = "block"; r.focus(); } else { r.style.display = "none"; b.style.display = "none"; }
}

function toggleReportInput() {
    let typeEl = document.getElementById("reportType");
    let pdfEl = document.getElementById("reportPdfFile");
    let chkEl = document.getElementById("inHandCheckboxes");
    if(!typeEl) return;
    let type = typeEl.value;
    if(pdfEl) pdfEl.style.display = (type === "Online") ? "block" : "none";
    if(chkEl) chkEl.style.display = (type === "In Hand") ? "block" : "none";
}

function submitAction(actionType) {
    let payload = { action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: actionType };
    if(actionType === "Cancel") {
        let reasonEl = document.getElementById("cancelReason");
        if(!reasonEl) return;
        let reason = reasonEl.value.trim();
        if(!reason) return alert("Please type a cancellation reason.");
        payload.cancel_reason = reason;
    }
    callApi(payload);
}

function deleteOnlineReport(index) {
    if(confirm("Are you sure you want to delete this PDF report?")) callApi({ action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: "DeleteReport", delete_type: "Online", file_index: index });
}

function deleteInHandReport(serviceName) {
    if(confirm(`Are you sure you want to remove In-Hand status for "${serviceName}"?`)) callApi({ action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: "DeleteReport", delete_type: "InHand", service_name: serviceName });
}

async function submitReport() {
    let typeEl = document.getElementById("reportType");
    if(!typeEl) return;
    let rType = typeEl.value;
    if(!rType) return alert("Please select a Report Type.");
    let payload = { action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: "UploadReport", report_type: rType };

    if(rType === "Online") {
        let fileInput = document.getElementById("reportPdfFile");
        if(!fileInput || fileInput.files.length === 0) return alert("Please select a PDF file to upload.");
        let file = fileInput.files[0];
        if(file.size > 3 * 1024 * 1024) return alert("File size must be less than 3MB."); 
        try {
            let base64 = await new Promise((res, rej) => {
                let reader = new FileReader(); reader.onload = () => res(reader.result.split(',')[1]); reader.onerror = e => rej(e); reader.readAsDataURL(file);
            });
            payload.base64Pdf = base64;
        } catch(e) { return alert("Error reading file."); }
    } else if (rType === "In Hand") {
        let checkboxes = document.querySelectorAll(".in-hand-chk:checked");
        if(checkboxes.length === 0) return alert("Please select at least one service to mark as In-Hand.");
        let selectedServices = []; checkboxes.forEach(chk => selectedServices.push(chk.value));
        payload.in_hand_services = selectedServices;
    }
    callApi(payload);
}

function callApi(payload) {
    let modal = document.querySelector(".modal") || document.getElementById("orderModal");
    if(modal) { modal.style.opacity = "0.7"; modal.style.pointerEvents = "none"; }
    
    let actionArea = document.getElementById("mActionArea");
    let originalHTML = "";
    if(actionArea) {
        originalHTML = actionArea.innerHTML;
        actionArea.innerHTML = `<div style="text-align:center; padding:15px; font-weight:bold; color:#3b82f6;"><i class="fas fa-spinner fa-spin"></i> Processing...</div>`;
    }

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") { alert(data.message); closeModal(); fetchOrders(localStorage.getItem("bhavya_user_id")); } 
        else { alert("Error: " + data.message); if(actionArea) actionArea.innerHTML = originalHTML; }
    }).catch(err => { alert("Network Error occurred!"); if(actionArea) actionArea.innerHTML = originalHTML; })
    .finally(() => { if(modal) { modal.style.opacity = "1"; modal.style.pointerEvents = "auto"; } });
}

function logout() {
    if(confirm("Are you sure you want to logout from BhavyaCare?")) {
        localStorage.removeItem("bhavya_user_id");
        localStorage.removeItem("bhavya_name");
        localStorage.removeItem("bhavya_role");
        window.location.href = "../index.html"; 
    }
}

// ==========================================
// 🌟 TABS, LEDGER AUR PDF LOGIC 🌟
// ==========================================

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    let targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    if(btn) btn.classList.add('active');
}

function calculateLedger() {
    let startInput = document.getElementById("startDate");
    let endInput = document.getElementById("endDate");
    
    if(!startInput || !endInput) return; 

    let start = new Date(startInput.value);
    let end = new Date(endInput.value);
    end.setHours(23, 59, 59);

    safeSetText("pdfDateRange", `Period: ${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`);
    safeSetText("pdfHeader", localStorage.getItem("bhavya_name") + " - Settlement Report");

    let completedOrders = allOrders.filter(o => {
        let oDate = new Date(o.date);
        return o.status && o.status.toUpperCase() === "COMPLETED" && oDate >= start && oDate <= end;
    });

    let tColl = 0, tFee = 0, tNet = 0;
    let html = "";

    completedOrders.forEach(o => {
        let coll = Number(o.final_payable || 0);
        let fee = Number(o.bhavya_commission || 0);
        let net = Number(o.lab_earning || 0);

        tColl += coll; tFee += fee; tNet += net;

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px;">${new Date(o.date).toLocaleDateString('en-IN')}</td>
                <td style="padding:10px;">${o.order_id}</td>
                <td style="padding:10px; text-align:right;">₹${coll.toFixed(2)}</td>
                <td style="padding:10px; text-align:right; color:#ef4444;">₹${fee.toFixed(2)}</td>
                <td style="padding:10px; text-align:right; font-weight:700;">₹${net.toFixed(2)}</td>
            </tr>`;
    });

    safeSetText("totalCollected", "₹" + tColl.toLocaleString('en-IN'));
    safeSetText("totalWebsiteFee", "₹" + tFee.toLocaleString('en-IN'));
    safeSetText("totalLabNet", "₹" + tNet.toLocaleString('en-IN'));
    safeSetHTML("ledgerTableBody", html || "<tr><td colspan='5' style='text-align:center; padding:20px; color:#64748b;'>No completed orders found in this date range.</td></tr>");
}

function downloadPDF() {
    const element = document.getElementById('pdf-content');
    if(!element) {
        alert("PDF content area missing!");
        return;
    }
    
    const labName = localStorage.getItem("bhavya_name") || "Lab";
    const opt = {
        margin: 10,
        filename: `Settlement_Report_${labName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
}
