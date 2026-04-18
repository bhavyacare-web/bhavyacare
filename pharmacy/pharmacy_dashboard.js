const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let globalPharmacyOrders = [];
let remindedOrders = new Set(); 

document.addEventListener("DOMContentLoaded", () => {
    const role = localStorage.getItem("bhavya_role");
    const userId = localStorage.getItem("bhavya_user_id");
    const name = localStorage.getItem("bhavya_name");

    if (role !== "pharmacy" || !userId) {
        alert("Unauthorized Access! Please login as Pharmacy.");
        window.location.href = "../index.html";
        return;
    }

    document.getElementById("pharmaNameStr").innerText = name;
    fetchOrders();

    document.getElementById("processForm").addEventListener("submit", submitProcessForm);
    document.getElementById("cancelOrderForm").addEventListener("submit", submitCancelOrder);

    // Front-end par har 1 minute me check karna ki kya 30-min bache hain
    setInterval(() => checkDeliveryReminders(globalPharmacyOrders), 60000); 
});

function showSection(section, btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if(section === 'orders') {
        document.getElementById('ordersSection').style.display = 'block';
        document.getElementById('settlementsSection').style.display = 'none';
    } else {
        document.getElementById('ordersSection').style.display = 'none';
        document.getElementById('settlementsSection').style.display = 'block';
        renderSettlements();
    }
}

function fetchOrders() {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = `<div style="text-align: center; padding: 50px; color: #64748b;"><i class="fas fa-spinner fa-spin" style="font-size: 30px; margin-bottom: 10px;"></i><p>Loading your orders...</p></div>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getPharmacyOrders", user_id: localStorage.getItem("bhavya_user_id") })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            globalPharmacyOrders = resData.data.orders;
            renderOrders(globalPharmacyOrders);
            // Agar pehle se us tab me hain toh update kar do
            if(document.getElementById('settlementsSection').style.display === 'block') {
                renderSettlements();
            }
            checkDeliveryReminders(globalPharmacyOrders); 
        } else {
            container.innerHTML = `<p style="text-align:center; color:red;">Error: ${resData.message}</p>`;
        }
    }).catch(err => { container.innerHTML = `<p style="text-align:center; color:red;">Network Error.</p>`; });
}

function checkDeliveryReminders(orders) {
    if(!orders || orders.length === 0) return;
    let now = new Date();

    orders.forEach(order => {
        if (order.patient_status === "Confirmed" && order.delivery_date) {
            try {
                let deliveryStr = String(order.delivery_date);
                let dDate;
                if (deliveryStr.includes('T')) {
                    dDate = new Date(deliveryStr);
                } else {
                    let parts = deliveryStr.split(' ');
                    if (parts.length >= 2) {
                        let [year, month, day] = parts[0].split('-');
                        dDate = new Date(`${year}-${month}-${day}T${parts[1]}`); 
                    }
                }

                if (dDate && !isNaN(dDate)) {
                    let diffMins = (dDate - now) / 1000 / 60;
                    if (diffMins > 0 && diffMins <= 30 && !remindedOrders.has(order.order_id)) {
                        let formattedTime = dDate.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit', hour12: true});
                        document.getElementById("reminderAlertMessage").innerHTML = `Order <b style="color:#0f172a;">#${order.order_id}</b> is pending!<br>Delivery scheduled for <b style="color:#dc2626;">Today at ${formattedTime}</b>.<br>Please deliver and mark it Complete.`;
                        document.getElementById("reminderAlertModal").style.display = "flex";
                        remindedOrders.add(order.order_id); 
                    }
                }
            } catch(e) {}
        }
    });
}

function renderOrders(orders) {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = "";

    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 50px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;"><i class="fas fa-box-open" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i><h3>No Orders Yet</h3></div>`;
        return;
    }

    orders.forEach(order => {
        let badge = ""; let actionBtn = "";
        
        if (order.patient_status === "Pending") {
            badge = `<span class="badge badge-pending">New Request</span>`;
            actionBtn = `<button class="btn btn-process" onclick="openProcessModal('${order.order_id}')" style="flex:1.5;"><i class="fas fa-clipboard-check"></i> Process Order</button>`;
        } 
        else if (order.patient_status === "confirm_for_patient") {
            badge = `<span class="badge" style="background:#e0e7ff; color:#4f46e5;">Sent to Patient</span>`;
            actionBtn = `<button class="btn btn-view" disabled style="flex:1.5; background:#f1f5f9; color:#64748b;"><i class="fas fa-hourglass-half"></i> Awaiting Patient Reply</button>`;
        } 
        else if (order.patient_status === "Confirmed") {
            badge = `<span class="badge" style="background:#10b981; color:white;"><i class="fas fa-exclamation-circle"></i> Action Needed (Confirmed)</span>`;
            actionBtn = `
                <div style="display:flex; gap:10px; flex:1.5;">
                    <button class="btn" style="flex:1; background:#dc2626; color:white;" onclick="openCancelModal('${order.order_id}')"><i class="fas fa-times"></i> Cancel</button>
                    <button class="btn" style="flex:1.5; background:#10b981; color:white;" onclick="markOrderComplete('${order.order_id}')"><i class="fas fa-check-double"></i> Delivered?</button>
                </div>
            `;
        }
        else if (order.patient_status === "Completed") {
            badge = `<span class="badge" style="background:#ecfdf5; color:#065f46;"><i class="fas fa-check-circle"></i> Completed</span>`;
            actionBtn = `<button class="btn" disabled style="flex:1.5; background:#f1f5f9; color:#065f46; font-weight:800;"><i class="fas fa-award"></i> Order Completed</button>`;
        }
        else if (order.patient_status === "Cancelled") {
            badge = `<span class="badge" style="background:#fee2e2; color:#b91c1c;"><i class="fas fa-ban"></i> Cancelled</span>`;
            actionBtn = `<button class="btn" disabled style="flex:1.5; background:#fef2f2; color:#dc2626;"><i class="fas fa-ban"></i> Order Cancelled</button>`;
        }

        let prescHtml = order.prescription ? `<a href="${order.prescription}" target="_blank" style="color: #2563eb; font-size: 14px; font-weight:600;"><i class="fas fa-file-pdf"></i> View Old Prescription</a>` : `<span style="color: #94a3b8; font-size: 13px;">No Old Prescription</span>`;
        let validPrescHtml = order.valid_prescription ? `<div style="margin-top: 15px; background: #fffbeb; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;"><h6 style="margin: 0 0 5px 0; color: #d97706; font-size: 12px;"><i class="fas fa-certificate"></i> Patient Uploaded New Valid Prescription</h6><a href="${order.valid_prescription}" target="_blank" style="color: #059669; font-size: 13px; font-weight: 700; text-decoration: none;"><i class="fas fa-download"></i> View & Download</a></div>` : "";

        let callBtn = order.patient_mobile ? `<div style="display:flex; gap:10px; flex:1;"><a href="tel:${order.patient_mobile}" class="btn btn-call" style="flex:1; padding: 12px 10px; font-size: 14px;"><i class="fas fa-phone-alt"></i> Call</a><button class="btn btn-call" style="flex:1; background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 12px 10px; font-size: 14px;" onclick="this.innerHTML='<i class=\\'fas fa-check\\'></i> ${order.patient_mobile}'; navigator.clipboard.writeText('${order.patient_mobile}');" title="Copy Number"><i class="fas fa-eye"></i> Show</button></div>` : `<button class="btn btn-call" style="opacity:0.5; cursor:not-allowed; flex:1;"><i class="fas fa-phone-slash"></i> No Number</button>`;

        let d = new Date(order.order_date);
        let dateStr = d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
        let timeStr = d.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit', hour12: true});

        let formattedDelivery = order.delivery_date;
        try {
            if (order.delivery_date) {
                let deliveryStr = String(order.delivery_date);
                if (deliveryStr.includes('T')) {
                    let dObj = new Date(deliveryStr); formattedDelivery = `${dObj.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} at ${dObj.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit', hour12: true})}`;
                } else {
                    let parts = deliveryStr.split(' '); if (parts.length >= 2) { let [year, month, day] = parts[0].split('-'); let dObj = new Date(year, month - 1, day); formattedDelivery = `${dObj.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} at ${parts.slice(1).join(' ')}`; }
                }
            }
        } catch(e) {}

        let card = `
        <div class="order-card" ${order.patient_status === "Cancelled" ? 'style="opacity:0.7;"' : ''}>
            <div class="order-header"><span class="order-id">#${order.order_id}</span>${badge}</div>
            <div class="order-body">
                <div>
                    <div class="info-block" style="margin-bottom: 15px;"><h4>Medicine Details</h4><p>${order.medicine_details}</p><div style="margin-top: 5px;">${prescHtml}</div>${validPrescHtml}</div>
                    <div class="info-block"><h4>Patient Address</h4><p style="font-size: 13px;">${order.patient_address}</p>
                        <div style="margin-top: 8px; background: #ecfdf5; border-left: 3px solid #10b981; padding: 8px 12px; border-radius: 4px;">
                            <p style="font-size: 13px; color: #065f46; margin: 0;"><i class="fas fa-truck-fast"></i> <b>Deliver By:</b> ${formattedDelivery}</p>
                        </div>
                    </div>
                </div>
                <div class="info-block" style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <h4>Order Info</h4><p style="font-size: 13px; margin-bottom: 8px;"><i class="fas fa-box"></i> Type: ${order.order_type}</p>
                    <div style="background: #e0f2fe; color: #0284c7; padding: 8px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;"><i class="far fa-calendar-alt"></i> Ordered on:<br>${dateStr} at ${timeStr}</div>
                </div>
            </div>
            <div class="order-actions">${callBtn}${actionBtn}</div>
        </div>`;
        container.innerHTML += card;
    });
}

// ✨ FIX: String backticks properly added for innerHTML ✨
function renderSettlements() {
    const container = document.getElementById("settlementList");
    container.innerHTML = "";
    
    const completed = globalPharmacyOrders.filter(o => o.patient_status === "Completed");
    
    if(completed.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px; background:white; border-radius:12px; color:#64748b;"><i class="fas fa-file-invoice-dollar" style="font-size:30px; margin-bottom:10px; display:block;"></i>No completed orders to show in report.</div>`;
        return;
    }

    completed.forEach(order => {
        let mrp = parseFloat(order.total_mrp) || 0;
        let pRate = parseFloat(order.purchase_rate) || 0;
        let profit = parseFloat(order.total_profit) || 0;
        let myShare = parseFloat(order.pharma_profit_share) || 0;
        let delCharge = parseFloat(order.delivery_charge) || 0;
        let comm = parseFloat(order.bhavya_care_commission) || 0;

        let html = `
        <div class="order-card" style="border-left: 6px solid #10b981; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items: center; border-bottom: 1px dashed #e2e8f0; padding-bottom: 10px;">
                <strong style="color:#0f172a; font-size:16px;">Order #${order.order_id}</strong>
                <span style="color:#059669; font-weight:800; font-size:12px; background:#d1fae5; padding:4px 8px; border-radius:4px;">COMPLETED</span>
            </div>
            <div class="settlement-grid">
                <div class="settlement-box">Total MRP <strong>₹${mrp.toFixed(2)}</strong></div>
                <div class="settlement-box">Purchase Rate <strong style="color:#ef4444;">₹${pRate.toFixed(2)}</strong></div>
                <div class="settlement-box">Total Profit <strong>₹${profit.toFixed(2)}</strong></div>
                <div class="settlement-box" style="background:#f0fdf4; border-color:#10b981;">Your Profit Share <strong style="color:#059669;">₹${myShare.toFixed(2)}</strong></div>
                <div class="settlement-box">Delivery Charge <strong style="color:#059669;">+ ₹${delCharge.toFixed(2)}</strong></div>
                <div class="settlement-box" style="background:#eff6ff; border-color:#3b82f6;">BhavyaCare Comm. <strong style="color:#1d4ed8;">- ₹${comm.toFixed(2)}</strong></div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// ✨ NAYA LOGIC: BEAUTIFUL PDF GENERATOR ✨
function downloadSettlementPDF() {
    const completed = globalPharmacyOrders.filter(o => o.patient_status === "Completed");
    if(completed.length === 0) { alert("No completed orders available to download."); return; }

    // Ek nayi print window open karenge
    let printWindow = window.open('', '', 'width=900,height=700');
    
    // PDF ki styling aur table
    let html = `
    <html><head><title>Pharmacy Settlement Report</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;}
        h1 { color: #2563eb; margin: 0; font-size: 28px; }
        .meta { color: #555; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: center; }
        th { background-color: #f8fafc; color: #0f172a; font-weight: bold; }
        .totals { font-weight: bold; background-color: #e0f2fe; color: #0369a1; }
    </style>
    </head><body>
        <div class="header">
            <div>
                <h1>BhavyaCare Pharmacy Ledger</h1>
                <div class="meta">Pharmacy Settlement Report</div>
            </div>
            <div class="meta">Generated on: ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Total MRP (₹)</th>
                    <th>Purchase Rate (₹)</th>
                    <th>Total Profit (₹)</th>
                    <th>Your Share (₹)</th>
                    <th>Delivery Charge (₹)</th>
                    <th>BhavyaCare Comm. (₹)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Totals calculate karne ke liye variables
    let tMrp=0, tPur=0, tProf=0, tShare=0, tDel=0, tComm=0;

    completed.forEach(o => {
        let dateObj = new Date(o.order_date);
        let dateStr = `${dateObj.getDate()}-${dateObj.getMonth()+1}-${dateObj.getFullYear()}`;
        
        tMrp += Number(o.total_mrp) || 0;
        tPur += Number(o.purchase_rate) || 0;
        tProf += Number(o.total_profit) || 0;
        tShare += Number(o.pharma_profit_share) || 0;
        tDel += Number(o.delivery_charge) || 0;
        tComm += Number(o.bhavya_care_commission) || 0;

        html += `<tr>
            <td style="font-weight:bold;">#${o.order_id}</td>
            <td>${dateStr}</td>
            <td>${(Number(o.total_mrp)||0).toFixed(2)}</td>
            <td style="color:#dc2626;">${(Number(o.purchase_rate)||0).toFixed(2)}</td>
            <td>${(Number(o.total_profit)||0).toFixed(2)}</td>
            <td style="color:#059669; font-weight:bold;">${(Number(o.pharma_profit_share)||0).toFixed(2)}</td>
            <td>${(Number(o.delivery_charge)||0).toFixed(2)}</td>
            <td style="color:#2563eb; font-weight:bold;">${(Number(o.bhavya_care_commission)||0).toFixed(2)}</td>
        </tr>`;
    });

    html += `
            <tr class="totals">
                <td colspan="2" style="text-align:right; padding-right:15px;">GRAND TOTAL</td>
                <td>₹${tMrp.toFixed(2)}</td>
                <td>₹${tPur.toFixed(2)}</td>
                <td>₹${tProf.toFixed(2)}</td>
                <td>₹${tShare.toFixed(2)}</td>
                <td>₹${tDel.toFixed(2)}</td>
                <td>₹${tComm.toFixed(2)}</td>
            </tr>
            </tbody>
        </table>
        <p style="text-align:center; font-size:12px; color:#888; margin-top:30px;">This is a computer-generated report.</p>
    </body></html>`;
    
    // Window me document write karke Print prompt open karna
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print(); // Ye seedha "Save as PDF" ka option dega
        // Print ke baad window close kar do (Optional)
        setTimeout(() => printWindow.close(), 100);
    };
}

function openProcessModal(orderId) { document.getElementById("processOrderId").value = orderId; document.getElementById("modalOrderId").innerText = "#" + orderId; document.getElementById("processModal").style.display = "flex"; }
function closeModal() { document.getElementById("processModal").style.display = "none"; document.getElementById("processForm").reset(); }

async function submitProcessForm(e) {
    e.preventDefault(); const btn = document.getElementById("btnSubmitForm"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`; btn.disabled = true;
    const payload = { 
        action: "confirmPharmacyOrder", 
        user_id: localStorage.getItem("bhavya_user_id"), 
        order_id: document.getElementById("processOrderId").value, 
        available_meds: document.getElementById("availMeds").value, 
        not_available_meds: document.getElementById("notAvailMeds").value, 
        prescription_req: document.getElementById("prescReq").value, 
        total_mrp: document.getElementById("totalMRP").value,
        purchase_rate: document.getElementById("purchaseRate").value
    };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Details sent successfully! Patient has been notified."); closeModal(); fetchOrders(); } else { alert("Error: " + resData.message); }
    } catch (error) { alert("Network error, please try again."); } finally { btn.innerHTML = "Send to Patient"; btn.disabled = false; }
}

function openCancelModal(orderId) { document.getElementById("cancelOrderIdHidden").value = orderId; document.getElementById("cancelModalOrderId").innerText = "#" + orderId; document.getElementById("cancelOrderModal").style.display = "flex"; }
function closeCancelModal() { document.getElementById("cancelOrderModal").style.display = "none"; document.getElementById("cancelOrderForm").reset(); }

async function submitCancelOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitCancel"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Cancelling...`; btn.disabled = true;
    const payload = { action: "cancelPharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: document.getElementById("cancelOrderIdHidden").value, cancel_reason: document.getElementById("cancelReasonText").value };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Order Cancelled. Patient has been notified."); closeCancelModal(); fetchOrders(); } else { alert("Error: " + resData.message); }
    } catch (error) { alert("Network error."); } finally { btn.innerHTML = "Confirm Cancellation"; btn.disabled = false; }
}

async function markOrderComplete(orderId) {
    if(!confirm("Are you sure you have delivered the medicines and received the payment?")) return;
    try {
        const payload = { action: "completePharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: orderId };
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Great! Order marked as Completed."); fetchOrders(); } else { alert("Error: " + resData.message); }
    } catch (error) { alert("Network error, please try again."); }
}

function logout() { localStorage.clear(); window.location.href = "../index.html"; }
