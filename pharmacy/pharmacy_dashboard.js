const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let globalPharmacyOrders = [];
let remindedOrders = new Set(); // Taaki ek order ka popup baar-baar na aaye

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

    // Frontend par har 1 minute me check karna ki kya 30-min bache hain
    setInterval(() => checkDeliveryReminders(globalPharmacyOrders), 60000); 
});

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
            checkDeliveryReminders(globalPharmacyOrders); // Load hote hi check karo
        } else {
            container.innerHTML = `<p style="text-align:center; color:red;">Error: ${resData.message}</p>`;
        }
    }).catch(err => { container.innerHTML = `<p style="text-align:center; color:red;">Network Error.</p>`; });
}

// ✨ NAYA LOGIC: 30-Min On-Screen Alert Popup ✨
function checkDeliveryReminders(orders) {
    if(!orders || orders.length === 0) return;
    let now = new Date();

    orders.forEach(order => {
        if (order.patient_status === "Confirmed" && order.delivery_date) {
            try {
                let dDate = new Date(order.delivery_date);
                if (!isNaN(dDate)) {
                    let diffMins = (dDate - now) / 1000 / 60;
                    
                    // Agar 30 min se kam time bacha hai (0 to 30) aur popup nahi dikha
                    if (diffMins > 0 && diffMins <= 30 && !remindedOrders.has(order.order_id)) {
                        document.getElementById("reminderAlertMessage").innerHTML = `Order <b>#${order.order_id}</b> is pending!<br>Delivery scheduled for <b>${order.delivery_date}</b>. Please deliver and complete the order.`;
                        document.getElementById("reminderAlertModal").style.display = "flex";
                        remindedOrders.add(order.order_id); // Set me daal diya taaki dubara na aaye
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
        
        // ✨ NAYA LOGIC: Buttons Update ✨
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
            // Cancel and Complete Buttons
            actionBtn = `
                <div style="display:flex; gap:10px; flex:1.5;">
                    <button class="btn" style="flex:1; background:#dc2626; color:white;" onclick="openCancelModal('${order.order_id}')"><i class="fas fa-times"></i> Cancel</button>
                    <button class="btn" style="flex:1.5; background:#10b981; color:white; animation: pulse 2s infinite;" onclick="markOrderComplete('${order.order_id}')"><i class="fas fa-check-double"></i> Delivered?</button>
                </div>
            `;
        }
        else if (order.patient_status === "Completed") {
            badge = `<span class="badge" style="background:#ecfdf5; color:#065f46;"><i class="fas fa-check-circle"></i> Completed</span>`;
            actionBtn = `<button class="btn" disabled style="flex:1.5; background:#f1f5f9; color:#065f46; font-weight:800;"><i class="fas fa-award"></i> Order Completed Successfully</button>`;
        }
        else if (order.patient_status === "Cancelled") {
            badge = `<span class="badge" style="background:#fee2e2; color:#b91c1c;"><i class="fas fa-ban"></i> Cancelled</span>`;
            actionBtn = `<button class="btn" disabled style="flex:1.5; background:#fef2f2; color:#dc2626;"><i class="fas fa-ban"></i> Order Cancelled</button>`;
        }

        let prescHtml = order.prescription ? `<a href="${order.prescription}" target="_blank" style="color: #2563eb; font-size: 14px; font-weight:600;"><i class="fas fa-file-pdf"></i> View Old Prescription</a>` : `<span style="color: #94a3b8; font-size: 13px;">No Old Prescription</span>`;
        let validPrescHtml = order.valid_prescription ? `<div style="margin-top: 15px; background: #fffbeb; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;"><h6 style="margin: 0 0 5px 0; color: #d97706; font-size: 12px;"><i class="fas fa-certificate"></i> Patient Uploaded New Valid Prescription</h6><a href="${order.valid_prescription}" target="_blank" style="color: #059669; font-size: 13px; font-weight: 700; text-decoration: none;"><i class="fas fa-download"></i> View & Download</a></div>` : "";

        let callBtn = order.patient_mobile ? `<div style="display:flex; gap:10px; flex:1;"><a href="tel:${order.patient_mobile}" class="btn btn-call" style="flex:1; padding: 12px 10px; font-size: 14px;"><i class="fas fa-phone-alt"></i> Call</a><button class="btn btn-call" style="flex:1; background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 12px 10px; font-size: 14px;" onclick="this.innerHTML='<i class=\\'fas fa-check\\'></i> ${order.patient_mobile}'; navigator.clipboard.writeText('${order.patient_mobile}');"><i class="fas fa-eye"></i> Show</button></div>` : `<button class="btn btn-call" style="opacity:0.5; cursor:not-allowed; flex:1;"><i class="fas fa-phone-slash"></i> No Number</button>`;

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

// ✨ PROCESS MODAL (Old Logic) ✨
function openProcessModal(orderId) { document.getElementById("processOrderId").value = orderId; document.getElementById("modalOrderId").innerText = "#" + orderId; document.getElementById("processModal").style.display = "flex"; }
function closeModal() { document.getElementById("processModal").style.display = "none"; document.getElementById("processForm").reset(); }
async function submitProcessForm(e) {
    e.preventDefault(); const btn = document.getElementById("btnSubmitForm"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`; btn.disabled = true;
    const payload = { action: "confirmPharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: document.getElementById("processOrderId").value, available_meds: document.getElementById("availMeds").value, not_available_meds: document.getElementById("notAvailMeds").value, prescription_req: document.getElementById("prescReq").value, amount: document.getElementById("totalAmt").value, discount_amount: document.getElementById("discountAmt").value };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Details sent successfully! Patient has been notified."); closeModal(); fetchOrders(); } else { alert("Error: " + resData.message); }
    } catch (error) { alert("Network error, please try again."); } finally { btn.innerHTML = "Send Details to Patient"; btn.disabled = false; }
}

// ✨ NAYA LOGIC: CANCEL ORDER ✨
function openCancelModal(orderId) {
    document.getElementById("cancelOrderIdHidden").value = orderId;
    document.getElementById("cancelModalOrderId").innerText = "#" + orderId;
    document.getElementById("cancelOrderModal").style.display = "flex";
}
function closeCancelModal() {
    document.getElementById("cancelOrderModal").style.display = "none";
    document.getElementById("cancelOrderForm").reset();
}
async function submitCancelOrder(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitCancel"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Cancelling...`; btn.disabled = true;
    const payload = {
        action: "cancelPharmacyOrder",
        user_id: localStorage.getItem("bhavya_user_id"),
        order_id: document.getElementById("cancelOrderIdHidden").value,
        cancel_reason: document.getElementById("cancelReasonText").value
    };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Order Cancelled. Patient has been notified."); closeCancelModal(); fetchOrders(); } else { alert("Error: " + resData.message); }
    } catch (error) { alert("Network error, please try again."); } finally { btn.innerHTML = "Confirm Cancellation"; btn.disabled = false; }
}

// ✨ NAYA LOGIC: COMPLETE ORDER ✨
async function markOrderComplete(orderId) {
    if(!confirm("Are you sure this order is delivered and complete?")) return;
    
    try {
        const payload = { action: "completePharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: orderId };
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { alert("Great! Order marked as Completed."); fetchOrders(); } else { alert("Error: " + resData.message); }
    } catch (error) { alert("Network error, please try again."); }
}

function logout() { localStorage.clear(); window.location.href = "../index.html"; }
