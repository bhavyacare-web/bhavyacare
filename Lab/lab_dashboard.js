const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allOrders = [];
let currentFilteredOrders = []; 
let currentOrder = null;

let labOrderChart = null;
let labRevenueChart = null;
Chart.register(ChartDataLabels);

// ✨ TOAST NOTIFICATION ✨
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
    const labName = localStorage.getItem("bhavya_name");
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId || localStorage.getItem("bhavya_role") !== "lab") {
        alert("Unauthorized Access!"); 
        window.location.href = "../index.html"; 
        return;
    }

    safeSetText("displayLabName", labName + " (" + userId + ")");
    
    if(document.getElementById("endDate") && document.getElementById("startDate")) {
        let today = new Date();
        document.getElementById("endDate").value = today.toISOString().split('T')[0];
        today.setDate(1); 
        document.getElementById("startDate").value = today.toISOString().split('T')[0];
    }

    fetchOrders(userId);

    // Payout Form Listener
    document.getElementById("payoutForm").addEventListener("submit", submitLabCommission);
});

// ==========================================
// ✨ FIXED: SAFE DATA FETCHING ✨
// ==========================================
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
            // 🚀 BADI FIX: Data extract karne ka sabse safe tareeqa
            allOrders = data.data || [];
            if(!Array.isArray(allOrders)) {
                 allOrders = allOrders.data || []; 
            }

            currentFilteredOrders = [...allOrders]; 
            renderOrders();
            calculateLabStatsAndCharts(); 
            if(typeof calculateLedger === 'function') calculateLedger(); 
        } else {
            let grid = document.getElementById("ordersGrid");
            if(grid) grid.innerHTML = `<p style="color:red; padding:20px; grid-column: 1/-1; text-align:center;">Error: ${data.message}</p>`;
        }
    }).catch(err => {
        console.error("Fetch Error:", err);
        let lMsg = document.getElementById("loadingMsg");
        if(lMsg) { lMsg.innerText = "Network Error!"; lMsg.style.color = "red"; }
    });
}

function filterOrders(status, btnElement) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    if (status === 'ALL') { currentFilteredOrders = [...allOrders]; } 
    else if (status === 'CONFIRMED') { currentFilteredOrders = allOrders.filter(o => o.status && (o.status.toUpperCase() === 'ACTIVE' || o.status.toUpperCase() === 'CONFIRMED')); } 
    else { currentFilteredOrders = allOrders.filter(o => o.status && o.status.toUpperCase() === status); }
    
    renderOrders();
}

// 🚀 FIXED: Dynamic Payment Badges
function renderOrders() {
    const grid = document.getElementById("ordersGrid");
    if(!grid) return;
    
    if(currentFilteredOrders.length === 0) {
        grid.innerHTML = `<div style="padding:40px; text-align:center; width:100%; color:#64748b; grid-column: 1/-1;">No orders found.</div>`;
        return;
    }

    grid.innerHTML = "";
    currentFilteredOrders.forEach((order, index) => {
        let statusClass = "badge-pending";
        let statusText = order.status ? order.status.toUpperCase() : "PENDING";
        
        if(statusText === "ACTIVE" || statusText === "CONFIRMED") statusClass = "badge-active";
        else if(statusText === "COMPLETED") statusClass = "badge-completed";
        else if(statusText === "CANCELLED") statusClass = "badge-cancelled";

        let pStat = order.payment_status ? order.payment_status.toString().trim().toLowerCase() : "due";
        let payClass = "badge-due";
        let payText = "DUE";
        
        if(pStat === "completed" || pStat === "paid") { payClass = "badge-paid"; payText = "PAID"; }
        else if(pStat === "verification pending" || pStat === "verifying") { payClass = "badge-verifying"; payText = "VERIFYING"; }

        let dtStr = formatDateTime(order.date);
        let slotStr = formatDateTime(order.slot);

        let card = document.createElement("div");
        card.className = "order-card";
        card.onclick = () => openOrderModal(index);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-id">#${order.order_id || "N/A"}</div>
                <div class="card-date">${dtStr}</div>
            </div>
            <div class="card-patient">${order.patient_name || "Unknown Patient"}</div>
            <div class="card-info"><i class="fas fa-clock"></i> ${slotStr}</div>
            <div class="card-info"><i class="fas fa-home"></i> ${order.fulfillment ? order.fulfillment.toUpperCase() : "N/A"}</div>
            
            <div class="badges-row">
                <span class="badge ${statusClass}">${statusText}</span>
                <span class="badge ${payClass}">Pay: ${payText}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 🚀 FIXED: Smart Dues Calculation
function calculateLabStatsAndCharts() {
    let totalTests = 0, netEarnings = 0, totalDues = 0, verifyingDues = 0;
    let pending = 0, active = 0, completed = 0, cancelled = 0;
    let revByDate = {};

    allOrders.forEach(o => {
        let s = o.status ? o.status.toString().trim().toUpperCase() : "PENDING";
        if(s === "COMPLETED") {
            completed++;
            totalTests += (o.cart_items ? JSON.parse(o.cart_items).length : 1);
            netEarnings += Number(o.lab_earning || 0);

            let payStat = o.payment_status ? o.payment_status.toString().trim().toLowerCase() : "";
            let commission = Number(o.bhavya_commission || 0);

            if(payStat === "due" || payStat === "" || payStat === "pending") {
                totalDues += commission;
            } else if (payStat === "verification pending" || payStat === "verifying") {
                verifyingDues += commission;
            }

            let dObj = new Date(o.date);
            let dStr = `${dObj.getDate()}/${dObj.getMonth()+1}`;
            if(!revByDate[dStr]) revByDate[dStr] = 0;
            revByDate[dStr] += Number(o.lab_earning || 0);

        } else if (s === "ACTIVE" || s === "CONFIRMED") active++;
        else if (s === "CANCELLED") cancelled++;
        else pending++;
    });

    safeSetText("statTests", totalTests);
    safeSetText("statEarnings", "₹" + netEarnings.toFixed(2));

    const btnContainer = document.getElementById("payDuesBtnContainer");
    if(btnContainer) {
        if(totalDues > 0) {
            safeSetText("statDues", "₹" + totalDues.toFixed(2));
            btnContainer.innerHTML = `<button class="btn" style="background:white; color:#0f172a; padding:8px 16px; font-size:12px; font-weight:bold; border-radius:20px; box-shadow:0 4px 10px rgba(0,0,0,0.2);" onclick="openPayoutModal(${totalDues})"><i class="fas fa-qrcode"></i> Pay Now</button>`;
        } 
        else if (verifyingDues > 0) {
            safeSetText("statDues", "₹0.00");
            btnContainer.innerHTML = `<span style="background:#f59e0b; color:white; padding:6px 12px; font-size:11px; border-radius:15px; display:inline-block; margin-top:5px;"><i class="fas fa-hourglass-half"></i> Verifying ₹${verifyingDues.toFixed(2)}</span>`;
        } 
        else {
            safeSetText("statDues", "₹0.00");
            btnContainer.innerHTML = `<span style="color:#10b981; font-size:13px; display:inline-block; margin-top:5px; font-weight:bold;"><i class="fas fa-check-circle"></i> All Cleared</span>`;
        }
    }

    // DRAW CHARTS
    if(document.getElementById('labOrderChart')) {
        if(labOrderChart) labOrderChart.destroy();
        labOrderChart = new Chart(document.getElementById('labOrderChart'), {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'Active', 'Completed', 'Cancelled'],
                datasets: [{ data: [pending, active, completed, cancelled], backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, datalabels: { color: '#fff', font: {weight:'bold'}, formatter: (v) => v>0?v:'' } } }
        });
    }

    if(document.getElementById('labRevenueChart')) {
        let labels = Object.keys(revByDate).reverse();
        let dataVals = Object.values(revByDate).reverse();
        if(labRevenueChart) labRevenueChart.destroy();
        labRevenueChart = new Chart(document.getElementById('labRevenueChart'), {
            type: 'bar',
            data: { labels: labels.length>0?labels:['No Data'], datasets: [{ label: 'Earnings', data: dataVals.length>0?dataVals:[0], backgroundColor: '#10b981', borderRadius:4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { align:'end', anchor:'end', color:'#10b981', font:{weight:'bold'}, formatter:(v)=>v>0?'₹'+v:'' } }, scales: { y: { display: false } } }
        });
    }
}

// ✨ PAYOUT LOGIC ✨
function openPayoutModal(amount) {
    document.getElementById('modalPayAmount').innerText = "₹" + amount.toFixed(2);
    const upiLink = `upi://pay?pa=bhavyacare@upi&pn=BhavyaCare&am=${amount.toFixed(2)}&cu=INR`; 
    const container = document.getElementById("paymentContainer");
    
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        container.innerHTML = `<a href="${upiLink}" class="btn btn-green" style="display:block; text-decoration:none;"><i class="fas fa-mobile-alt"></i> Tap to Pay via UPI App</a>`;
    } else {
        let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
        container.innerHTML = `<img src="${qrUrl}" style="width:160px; height:160px; border-radius:10px; border:2px solid #e2e8f0; padding:5px; background:white;"><p style="font-size:12px; color:#64748b; margin-top:10px;">Scan QR with phone.</p>`;
    }
    
    document.getElementById("payoutScreenshot").value = "";
    document.getElementById('payoutModal').style.display = "flex";
}

// ✨ IMAGE COMPRESSOR ✨
function getBase64(fileId) {
    return new Promise((resolve, reject) => {
        const input = document.getElementById(fileId);
        if (!input || !input.files || input.files.length === 0) { resolve(""); return; }
        const file = input.files[0];
        if (!file.type.startsWith('image/')) {
            if(file.size > 5 * 1024 * 1024) return reject("File size cannot exceed 5MB.");
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = e => reject(e);
            return;
        }
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); let ctx = canvas.getContext('2d');
                let width = img.width, height = img.height; const MAX_DIM = 1000; 
                if (width > height && width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } 
                else if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
                canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL(file.type, 0.7).split(',')[1]); 
            };
        };
        reader.onerror = e => reject(e);
    });
}

// 🚀 FIXED: Delay Reload After Upload
async function submitLabCommission(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitPayout");
    const amountStr = document.getElementById("modalPayAmount").innerText.replace('₹', '');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading Securely...`; btn.disabled = true;
    
    try {
        let base64Img = await getBase64("payoutScreenshot"); 
        let payload = { action: "submitLabPayoutRequest", lab_id: localStorage.getItem("bhavya_user_id"), amount: amountStr, screenshot_base64: base64Img, screenshot_mime: document.getElementById("payoutScreenshot").files[0].type };
        
        let res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        let data = await res.json();
        
        if(data.status === "success") { 
            showToast("Receipt submitted successfully!", "success"); 
            document.getElementById('payoutModal').style.display = 'none'; 
            document.getElementById("payoutForm").reset();
            
            // 1.5s delay to let sheet save completely
            setTimeout(() => { window.location.reload(); }, 1500); 
        } 
        else { showToast(data.message, "error"); }
    } catch(e) { showToast("Error uploading receipt", "error"); }
    finally { btn.innerHTML = `<i class="fas fa-upload"></i> Submit Receipt`; btn.disabled = false; }
}

function openOrderModal(index) {
    currentOrder = currentFilteredOrders[index];
    let o = currentOrder;
    let currentStatus = o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase() : "Pending";

    safeSetText("mOrderId", "Order #" + (o.order_id || "N/A"));
    safeSetText("mName", o.patient_name || "N/A");
    safeSetText("mSlot", formatDateTime(o.slot));
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
        let psText = "DUE"; let psClass = "badge-due";
        let pStat = o.payment_status ? o.payment_status.toString().trim().toLowerCase() : "due";
        
        if(pStat === "completed" || pStat === "paid") { psText = "PAID"; psClass = "badge-paid"; }
        else if(pStat === "verification pending" || pStat === "verifying") { psText = "VERIFYING"; psClass = "badge-verifying"; }
        
        paySpan.innerText = "Payment: " + psText;
        paySpan.className = "badge " + psClass;
    }

    let itemsArr = [];
    let itemsHTML = "";
    try {
        if(o.cart_items) {
            itemsArr = JSON.parse(o.cart_items);
            itemsArr.forEach(item => { itemsHTML += `<div class="cart-item"><div class="item-name">${item.qty}x ${item.service_name}</div><div class="item-price">₹${item.price}</div></div>`; });
        } else { itemsHTML = "<i>No items found</i>"; }
    } catch(e) { itemsHTML = "<i>Error loading items</i>"; }
    safeSetHTML("mItemsList", itemsHTML);

    safeSetText("mSub", "₹" + (o.subtotal || 0));
    safeSetText("mColl", "₹" + (o.collection_charge || 0));
    safeSetText("mDisc", "-₹" + (o.discount || 0));
    safeSetText("mFinal", "₹" + (o.final_payable || 0));
    safeSetText("mFinalPay", "₹" + (o.final_payable || 0));
    
    let commEl = document.getElementById("mComm");
    if (commEl) {
        let bComm = Number(o.bhavya_commission || 0);
        if (bComm >= 0) { commEl.innerText = "-₹" + bComm.toFixed(2); commEl.style.color = "#ef4444"; } 
        else { commEl.innerText = "+₹" + Math.abs(bComm).toFixed(2); commEl.style.color = "#16a34a"; }
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
                        <option value="Online">Online (Upload PDF/Image)</option>
                        <option value="In Hand">In Hand (Physical Copy)</option>
                    </select>
                    <input type="file" id="reportPdfFile" class="input-box" accept=".pdf,image/*" style="display:none; margin-bottom: 15px;">
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
        if(!reason) { showToast("Please type a cancellation reason.", "error"); return; }
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
    if(!rType) { showToast("Please select a Report Type.", "error"); return; }
    
    let payload = { action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: "UploadReport", report_type: rType };

    if(rType === "Online") {
        try {
            let base64 = await getBase64("reportPdfFile"); 
            payload.base64Pdf = base64;
            payload.mimeType = document.getElementById("reportPdfFile").files[0].type;
        } catch(e) { showToast(e, "error"); return; }
    } else if (rType === "In Hand") {
        let checkboxes = document.querySelectorAll(".in-hand-chk:checked");
        if(checkboxes.length === 0) { showToast("Select at least one service.", "error"); return; }
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
        if(data.status === "success") { 
            showToast(data.message, "success"); 
            setTimeout(() => { window.location.reload(); }, 1500);
        } 
        else { showToast("Error: " + data.message, "error"); if(actionArea) actionArea.innerHTML = originalHTML; }
    }).catch(err => { showToast("Network Error occurred!", "error"); if(actionArea) actionArea.innerHTML = originalHTML; })
    .finally(() => { if(modal) { modal.style.opacity = "1"; modal.style.pointerEvents = "auto"; } });
}

function logout() {
    if(confirm("Are you sure you want to logout from BhavyaCare?")) {
        localStorage.clear();
        window.location.href = "../index.html"; 
    }
}

// 🌟 LEDGER AUR PDF LOGIC 🌟
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    let targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    if(btn) btn.classList.add('active');
    if(tabId === 'overviewTab') calculateLabStatsAndCharts();
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

    if (completedOrders.length > 0) {
        html += `
            <tr style="background:#f1f5f9; font-weight:800; border-top:2px solid #cbd5e1; font-size:14px;">
                <td colspan="2" style="padding:12px; text-align:right;">GRAND TOTAL:</td>
                <td style="padding:12px; text-align:right;">₹${tColl.toFixed(2)}</td>
                <td style="padding:12px; text-align:right; color:#ef4444;">₹${tFee.toFixed(2)}</td>
                <td style="padding:12px; text-align:right; font-weight:700; color:#166534;">₹${tNet.toFixed(2)}</td>
            </tr>`;
    }

    safeSetText("totalCollected", "₹" + tColl.toLocaleString('en-IN'));
    safeSetText("totalWebsiteFee", "₹" + tFee.toLocaleString('en-IN'));
    safeSetText("totalLabNet", "₹" + tNet.toLocaleString('en-IN'));
    safeSetHTML("ledgerTableBody", html || "<tr><td colspan='5' style='text-align:center; padding:20px; color:#64748b;'>No completed orders found in this date range.</td></tr>");
}

function downloadPDF() {
    const element = document.getElementById('pdf-content');
    if(!element) { showToast("PDF content area missing!", "error"); return; }
    
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
