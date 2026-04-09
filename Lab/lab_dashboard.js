// ==========================================
// lab_dashboard.js
// Logic for fetching and managing lab orders
// ==========================================

// NOTE: Apna Google Script Web App URL yahan daalein
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let allOrders = [];
let currentOrder = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check Auth
    const labName = localStorage.getItem("bhavya_name");
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId || localStorage.getItem("bhavya_role") !== "lab") {
        alert("Unauthorized Access!"); 
        window.location.href = "../index.html"; 
        return;
    }

    // 2. Set Name and Fetch Data
    document.getElementById("displayLabName").innerText = labName + " (" + userId + ")";
    fetchOrders(userId);
});

// FETCH ORDERS FROM BACKEND
function fetchOrders(userId) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "getLabDashboardOrders", user_id: userId })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("loadingMsg").style.display = "none";
        if(data.status === "success") {
            allOrders = data.data;
            renderOrders();
        } else {
            document.getElementById("ordersGrid").innerHTML = `<p style="color:red; padding:20px;">Error: ${data.message}</p>`;
        }
    }).catch(err => {
        document.getElementById("loadingMsg").innerText = "Network Error!";
        console.error(err);
    });
}

// RENDER ALL ORDERS IN CARDS
function renderOrders() {
    const grid = document.getElementById("ordersGrid");
    
    if(allOrders.length === 0) {
        grid.innerHTML = `<div style="padding:40px; text-align:center; width:100%; color:#64748b;">No orders found for your lab.</div>`;
        return;
    }

    grid.innerHTML = "";
    allOrders.forEach((order, index) => {
        let statusClass = "badge-pending";
        // Default text
        let statusText = order.status ? order.status.toUpperCase() : "PENDING";
        
        if(statusText === "ACTIVE") statusClass = "badge-active";
        else if(statusText === "COMPLETED") statusClass = "badge-completed";
        else if(statusText === "CANCELLED") statusClass = "badge-cancelled";

        let payClass = order.payment_status === "COMPLETED" ? "badge-paid" : "badge-due";

        // Format Date safely
        let dtStr = "Date N/A";
        if(order.date) {
             dtStr = new Date(order.date).toLocaleDateString("en-IN", {day:'numeric', month:'short', year:'numeric'});
        }

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

// OPEN MODAL FOR SPECIFIC ORDER
function openOrderModal(index) {
    currentOrder = allOrders[index];
    let o = currentOrder;
    
    // Status normalization
    let currentStatus = o.status ? o.status.charAt(0).toUpperCase() + o.status.slice(1).toLowerCase() : "Pending";

    document.getElementById("mOrderId").innerText = "Order #" + (o.order_id || "N/A");
    document.getElementById("mName").innerText = o.patient_name || "N/A";
    document.getElementById("mSlot").innerText = o.slot || "N/A";
    document.getElementById("mAddress").innerText = o.address || "N/A";
    document.getElementById("mFulfill").innerText = o.fulfillment ? o.fulfillment.toUpperCase() : "N/A";

    // Set Status Badges
    let statSpan = document.getElementById("mStatus");
    statSpan.innerText = currentStatus.toUpperCase();
    statSpan.className = "badge"; // reset classes
    if(currentStatus === "Pending") statSpan.classList.add("badge-pending");
    else if(currentStatus === "Active") statSpan.classList.add("badge-active");
    else if(currentStatus === "Completed") statSpan.classList.add("badge-completed");
    else statSpan.classList.add("badge-cancelled");

    let paySpan = document.getElementById("mPayStatus");
    paySpan.innerText = "Payment: " + o.payment_status;
    paySpan.className = "badge";
    paySpan.classList.add(o.payment_status === "COMPLETED" ? "badge-paid" : "badge-due");

    // Parse Cart Items JSON
    let itemsHTML = "";
    try {
        if(o.cart_items) {
            let items = JSON.parse(o.cart_items);
            items.forEach(item => {
                itemsHTML += `
                <div class="cart-item">
                    <div class="item-name">${item.qty}x ${item.service_name}</div>
                    <div class="item-price">₹${item.price}</div>
                </div>`;
            });
        } else {
             itemsHTML = "<i>No items found</i>";
        }
    } catch(e) { itemsHTML = "<i>Error loading items</i>"; }
    document.getElementById("mItemsList").innerHTML = itemsHTML;

    // Set Billing
    document.getElementById("mSub").innerText = "₹" + (o.subtotal || 0);
    document.getElementById("mColl").innerText = "₹" + (o.collection_charge || 0);
    document.getElementById("mDisc").innerText = "-₹" + (o.discount || 0);
    document.getElementById("mFinal").innerText = "₹" + (o.final_payable || 0);

    // Build Dynamic Action Area based on Order Status
    let actionArea = document.getElementById("mActionArea");
    actionArea.innerHTML = "";

    // IMPORTANT: Checking 'currentStatus' for the flow
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
    else if (currentStatus === "Active") {
        actionArea.innerHTML = `
            <div class="action-box">
                <div style="font-weight:600; margin-bottom:10px;">Provide Report & Complete Order:</div>
                <select id="reportType" class="input-box" onchange="togglePdfUpload()" style="margin-bottom: 15px;">
                    <option value="">Select Report Type</option>
                    <option value="Online">Online (Upload PDF)</option>
                    <option value="In Hand">In Hand (Physical Copy)</option>
                </select>
                <input type="file" id="reportPdfFile" class="input-box" accept=".pdf" style="display:none; margin-bottom: 15px;">
                
                <button class="btn btn-blue" style="width:100%; margin-top:10px;" onclick="submitReport()"><i class="fas fa-check-double"></i> Mark Completed</button>
            </div>`;
    }
    else if (currentStatus === "Completed") {
        actionArea.innerHTML = `
            <div class="action-box" style="background:#dcfce7; border-color:#bbf7d0; color:#166534; text-align:center;">
                <i class="fas fa-check-circle" style="font-size:30px; margin-bottom:10px;"></i>
                <div style="font-weight:bold;">Order is Completed</div>
                <div style="font-size:13px; margin-top:5px;">Report: ${o.report_type || "N/A"} ${o.report_pdf ? `<br><a href="${o.report_pdf}" target="_blank" style="color: #1d4ed8; font-weight: 600; display: inline-block; margin-top: 5px;">View PDF</a>` : ''}</div>
            </div>`;
    }
    else if (currentStatus === "Cancelled") {
        actionArea.innerHTML = `
             <div class="action-box" style="background:#fee2e2; border-color:#fecaca; color:#991b1b; text-align:center;">
                <i class="fas fa-times-circle" style="font-size:30px; margin-bottom:10px;"></i>
                <div style="font-weight:bold;">Order Cancelled</div>
            </div>`;
    }

    // Show Modal
    document.getElementById("orderModal").style.display = "flex";
}

function closeModal() { 
    document.getElementById("orderModal").style.display = "none"; 
    currentOrder = null; 
}

// TOGGLE CANCEL REASON INPUT
// Ye function call hoga jab user "Cancel" button (pehla wala) dabayega
function toggleCancelReason() {
    const reasonInput = document.getElementById("cancelReason");
    const confirmBtn = document.getElementById("finalCancelBtn");
    
    if (reasonInput.style.display === "none") {
        reasonInput.style.display = "block";
        confirmBtn.style.display = "block";
        reasonInput.focus();
    } else {
        reasonInput.style.display = "none";
        confirmBtn.style.display = "none";
    }
}

// TOGGLE PDF UPLOAD INPUT
// Ye function call hoga jab user dropdown se "Online" select karega
function togglePdfUpload() {
    let type = document.getElementById("reportType").value;
    document.getElementById("reportPdfFile").style.display = (type === "Online") ? "block" : "none";
}

// ==========================================
// API CALLS: ACCEPT / CANCEL ORDER
// ==========================================
function submitAction(actionType) {
    let payload = { action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: actionType };
    
    if(actionType === "Cancel") {
        let reason = document.getElementById("cancelReason").value.trim();
        if(!reason) return alert("Please type a cancellation reason.");
        payload.cancel_reason = reason;
    }

    callApi(payload);
}

// ==========================================
// API CALLS: UPLOAD REPORT & COMPLETE
// ==========================================
async function submitReport() {
    let rType = document.getElementById("reportType").value;
    if(!rType) return alert("Please select a Report Type.");

    let payload = { action: "processLabOrderAction", order_id: currentOrder.order_id, action_type: "UploadReport", report_type: rType };

    if(rType === "Online") {
        let fileInput = document.getElementById("reportPdfFile");
        if(fileInput.files.length === 0) return alert("Please select a PDF file to upload.");
        
        let file = fileInput.files[0];
        if(file.size > 3 * 1024 * 1024) return alert("File size must be less than 3MB."); 
        
        try {
            let base64 = await new Promise((res, rej) => {
                let reader = new FileReader();
                reader.onload = () => res(reader.result.split(',')[1]);
                reader.onerror = e => rej(e);
                reader.readAsDataURL(file);
            });
            payload.base64Pdf = base64;
        } catch(e) { return alert("Error reading file."); }
    }

    callApi(payload);
}

// GENERAL API CALLER WITH UI LOCK
function callApi(payload) {
    let modal = document.querySelector(".modal");
    
    // UI Lock
    modal.style.opacity = "0.7";
    modal.style.pointerEvents = "none";

    // Adding Loading Text temporarily to the Action Area
    let actionArea = document.getElementById("mActionArea");
    let originalHTML = actionArea.innerHTML;
    actionArea.innerHTML = `<div style="text-align:center; padding:15px; font-weight:bold; color:#3b82f6;"><i class="fas fa-spinner fa-spin"></i> Processing Request...</div>`;

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            alert(data.message);
            closeModal();
            fetchOrders(localStorage.getItem("bhavya_user_id")); // Refresh the list
        } else { 
            alert("Error: " + data.message); 
            actionArea.innerHTML = originalHTML; // Restore if failed
        }
    })
    .catch(err => {
        alert("Network Error occurred!");
        actionArea.innerHTML = originalHTML;
    })
    .finally(() => {
        // Remove UI Lock
        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";
    });
}
