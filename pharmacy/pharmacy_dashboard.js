const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

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
});

function fetchOrders() {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #64748b;">
            <i class="fas fa-spinner fa-spin" style="font-size: 30px; margin-bottom: 10px;"></i>
            <p>Loading your orders...</p>
        </div>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
            action: "getPharmacyOrders", 
            user_id: localStorage.getItem("bhavya_user_id") 
        })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            renderOrders(resData.data.orders);
        } else {
            container.innerHTML = `<p style="text-align:center; color:red;">Error: ${resData.message}</p>`;
        }
    })
    .catch(err => {
        container.innerHTML = `<p style="text-align:center; color:red;">Network Error.</p>`;
    });
}

function renderOrders(orders) {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = "";

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;">
                <i class="fas fa-box-open" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i>
                <h3>No Orders Yet</h3>
                <p style="color: #64748b;">New orders from patients will appear here.</p>
            </div>`;
        return;
    }

    orders.forEach(order => {
        let isPending = order.patient_status !== "confirm_for_patient";
        let badge = isPending ? `<span class="badge badge-pending">New Request</span>` : `<span class="badge badge-processed">Sent to Patient</span>`;
        
        let prescHtml = order.prescription 
            ? `<a href="${order.prescription}" target="_blank" style="color: #2563eb; font-size: 14px; font-weight:600;"><i class="fas fa-file-pdf"></i> View Prescription</a>` 
            : `<span style="color: #94a3b8; font-size: 13px;">No Prescription Uploaded</span>`;

        // Direct Call Link Setup
        let callBtn = order.patient_mobile 
            ? `<a href="tel:${order.patient_mobile}" class="btn btn-call"><i class="fas fa-phone-alt"></i> Call Patient</a>`
            : `<button class="btn btn-call" style="opacity:0.5; cursor:not-allowed;" title="Number not available"><i class="fas fa-phone-slash"></i> No Number</button>`;

        let actionBtn = isPending 
            ? `<button class="btn btn-process" onclick="openProcessModal('${order.order_id}')"><i class="fas fa-clipboard-check"></i> Process Order</button>`
            : `<button class="btn btn-view" disabled><i class="fas fa-check-double"></i> Awaiting Patient Reply</button>`;

        let dateStr = new Date(order.order_date).toLocaleString();

        let card = `
        <div class="order-card">
            <div class="order-header">
                <span class="order-id">#${order.order_id}</span>
                ${badge}
            </div>
            
            <div class="order-body">
                <div>
                    <div class="info-block" style="margin-bottom: 15px;">
                        <h4>Medicine Details</h4>
                        <p>${order.medicine_details}</p>
                        <div style="margin-top: 5px;">${prescHtml}</div>
                    </div>
                    <div class="info-block">
                        <h4>Patient Address & Delivery</h4>
                        <p style="font-size: 13px;">${order.patient_address}</p>
                        <p style="font-size: 13px; color: #059669; margin-top: 3px;"><i class="fas fa-clock"></i> Requested Time: ${order.delivery_date}</p>
                    </div>
                </div>
                
                <div class="info-block" style="background: #f8fafc; padding: 15px; border-radius: 10px;">
                    <h4>Order Info</h4>
                    <p style="font-size: 13px;">Type: ${order.order_type}</p>
                    <p style="font-size: 13px;">Date: ${dateStr}</p>
                </div>
            </div>

            <div class="order-actions">
                ${callBtn}
                ${actionBtn}
            </div>
        </div>`;
        
        container.innerHTML += card;
    });
}

function openProcessModal(orderId) {
    document.getElementById("processOrderId").value = orderId;
    document.getElementById("modalOrderId").innerText = "#" + orderId;
    document.getElementById("processModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("processModal").style.display = "none";
    document.getElementById("processForm").reset();
}

async function submitProcessForm(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitForm");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`;
    btn.disabled = true;

    const payload = {
        action: "confirmPharmacyOrder",
        user_id: localStorage.getItem("bhavya_user_id"),
        order_id: document.getElementById("processOrderId").value,
        available_meds: document.getElementById("availMeds").value,
        not_available_meds: document.getElementById("notAvailMeds").value,
        prescription_req: document.getElementById("prescReq").value,
        amount: document.getElementById("totalAmt").value,
        discount_amount: document.getElementById("discountAmt").value
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
            alert("Details sent successfully! Status updated.");
            closeModal();
            fetchOrders(); // Refresh table
        } else {
            alert("Error: " + resData.message);
        }
    } catch (error) {
        alert("Network error, please try again.");
    } finally {
        btn.innerHTML = "Send Details to Patient";
        btn.disabled = false;
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "../index.html";
}
