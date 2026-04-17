const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) {
        alert("Please login first!"); window.location.href = "../index.html"; return;
    }
    fetchPatientOrders();
    document.getElementById("confirmForm").addEventListener("submit", submitConfirmForm);
});

function fetchPatientOrders() {
    const container = document.getElementById("ordersContainer");

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getPatientOrders", user_id: localStorage.getItem("bhavya_user_id") })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") renderOrders(resData.data.orders);
        else container.innerHTML = `<p style="text-align:center; color:red;">${resData.message}</p>`;
    })
    .catch(err => container.innerHTML = `<p style="text-align:center; color:red;">Network Error.</p>`);
}

function renderOrders(orders) {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = "";

    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; background:white; border-radius:15px;"><p>No orders found.</p></div>`;
        return;
    }

    orders.forEach(order => {
        let badgeHtml = "";
        let actionHtml = "";
        
        if (order.patient_status === "Pending") {
            badgeHtml = `<span class="badge badge-pending"><i class="fas fa-clock"></i> Waiting for Pharmacy</span>`;
            actionHtml = `<p style="font-size:13px; color:#64748b; margin:0;"><i class="fas fa-info-circle"></i> Pharmacy is reviewing your request.</p>`;
        } 
        else if (order.patient_status === "confirm_for_patient") {
            badgeHtml = `<span class="badge badge-action"><i class="fas fa-exclamation-circle"></i> Action Required</span>`;
            actionHtml = `<button class="btn btn-confirm" onclick="openConfirmModal('${order.order_id}', '${order.presc_req}')">
                            <i class="fas fa-check-double"></i> Review & Confirm Order
                          </button>`;
        }
        else if (order.patient_status === "Confirmed") {
            badgeHtml = `<span class="badge badge-success"><i class="fas fa-check"></i> Order Confirmed</span>`;
            actionHtml = `<p style="font-size:14px; color:#059669; margin:0; font-weight:bold;"><i class="fas fa-box"></i> Order is being prepared.</p>`;
        }

        // Format dates
        let orderDate = new Date(order.order_date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
        
        let formattedDelivery = order.delivery_date;
        try {
            if (order.delivery_date && String(order.delivery_date).includes('T')) {
                let dObj = new Date(order.delivery_date);
                formattedDelivery = `${dObj.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} at ${dObj.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit', hour12: true})}`;
            }
        } catch(e) {}

        let callBtn = order.pharma_mobile ? `<a href="tel:${order.pharma_mobile}" class="btn btn-call" style="margin-top:10px;"><i class="fas fa-phone-alt"></i> Call Pharmacy</a>` : "";

        // Pharmacy Response Section (Only visible if Pharmacy replied)
        let pharmaReplyHtml = "";
        if (order.avail_meds) {
            pharmaReplyHtml = `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #e2e8f0;">
                <h4 style="margin:0 0 10px 0; color:#0f172a;">Pharmacy Update</h4>
                <div class="grid-2">
                    <div class="info-box">
                        <h4>Available Medicines</h4>
                        <p style="color:#059669;">${order.avail_meds}</p>
                    </div>
                    <div class="info-box">
                        <h4>Not Available</h4>
                        <p style="color:#dc2626;">${order.not_avail_meds || "None"}</p>
                    </div>
                </div>
                <div class="bill-box">
                    <p style="margin:0; font-size:14px; text-decoration:line-through; color:#64748b;">Total Bill: ₹${order.total_amt}</p>
                    <p style="margin:5px 0 0 0; font-size:18px; font-weight:800; color:#065f46;">Payable Amount: ₹${order.payable_amt}</p>
                </div>
            </div>`;
        }

        let card = `
        <div class="order-card">
            <div class="order-header">
                <span style="font-weight: 800; color: #2563eb; font-size: 18px;">#${order.order_id}</span>
                ${badgeHtml}
            </div>
            <p style="font-size:13px; color:#64748b; margin-top:0;">Ordered on: ${orderDate} | Delivery: ${formattedDelivery}</p>
            <p style="font-weight:600; margin-bottom:0;">${order.medicine_details}</p>
            
            ${pharmaReplyHtml}

            <div style="margin-top: 20px;">
                ${actionHtml}
                ${callBtn}
            </div>
        </div>`;
        
        container.innerHTML += card;
    });
}

// ✨ Modal Logic ✨
function openConfirmModal(orderId, prescReq) {
    document.getElementById("modalOrderId").value = orderId;
    
    const prescGroup = document.getElementById("prescUploadGroup");
    const prescAlert = document.getElementById("prescAlert");
    const fileInput = document.getElementById("validPrescriptionFile");

    // Agar Pharmacy ne 'Yes' bola hai toh upload mandatory ho jayega
    if (prescReq === "Yes") {
        prescGroup.style.display = "block";
        prescAlert.style.display = "block";
        fileInput.required = true;
    } else {
        prescGroup.style.display = "none";
        prescAlert.style.display = "none";
        fileInput.required = false;
    }

    document.getElementById("confirmModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("confirmModal").style.display = "none";
    document.getElementById("confirmForm").reset();
}

function getBase64(fileId) {
    return new Promise((resolve) => {
        const input = document.getElementById(fileId);
        if (!input || !input.files || input.files.length === 0) { resolve(""); return; }
        const reader = new FileReader(); reader.readAsDataURL(input.files[0]);
        reader.onload = () => resolve(reader.result.split(',')[1]);
    });
}

async function submitConfirmForm(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitConfirm");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Confirming...`; btn.disabled = true;

    try {
        const payload = {
            action: "confirmOrderPatient",
            user_id: localStorage.getItem("bhavya_user_id"),
            order_id: document.getElementById("modalOrderId").value,
            prescription_base64: await getBase64("validPrescriptionFile")
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
            alert("Order Confirmed Successfully!");
            closeModal();
            fetchPatientOrders(); // Refresh Data
        } else {
            alert("Error: " + resData.message);
        }
    } catch (error) {
        alert("Network error, please try again.");
    } finally {
        btn.innerHTML = "Confirm & Place Order"; btn.disabled = false;
    }
}
