const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let globalPharmacyOrders = [];
let remindedOrders = new Set(); 
let myOrderStatusChart = null; 
let myRevenueChart = null; // ✨ NAYA REVENUE CHART VARIABLE ✨

// Register Chart DataLabels Plugin for numbers
Chart.register(ChartDataLabels);

// Profile Variables
let profPincodeList = [];
let profCityList = [];
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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
    const role = localStorage.getItem("bhavya_role");
    const userId = localStorage.getItem("bhavya_user_id");
    const name = localStorage.getItem("bhavya_name");

    if (role !== "pharmacy" || !userId) {
        showToast("Unauthorized Access! Please login as Pharmacy.", "error");
        window.location.href = "../index.html";
        return;
    }

    document.getElementById("pharmaNameStr").innerText = name;
    
    setupProfileTimings();
    fetchOrders();

    document.getElementById("processForm").addEventListener("submit", submitProcessForm);
    document.getElementById("cancelOrderForm").addEventListener("submit", submitCancelOrder);
    document.getElementById("profileUpdateForm").addEventListener("submit", submitProfileUpdate);
    document.getElementById("completeOrderForm").addEventListener("submit", submitCompleteOrder); 

    // Auto Refresh Check
    setInterval(() => checkDeliveryReminders(globalPharmacyOrders), 60000); 
});

function showSection(sectionId, btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(sectionId).classList.add('active');
    
    if(sectionId === 'overviewSection') renderOverviewDashboard();
    if(sectionId === 'settlementsSection') renderSettlements();
    if(sectionId === 'profileSection') fetchPharmacyProfile();
}

// ==========================================
// ✨ PROFILE EDIT LOGIC ✨
// ==========================================
function setupProfileTimings() {
    const container = document.getElementById("profTimingsContainer");
    container.innerHTML = "";
    days.forEach(day => {
        let dayName = day.charAt(0).toUpperCase() + day.slice(1);
        container.innerHTML += `
        <div style="background: #fff; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <div style="font-weight:800; color:#0f172a; font-size:15px; margin-bottom:10px; border-bottom:1px dashed #cbd5e1; padding-bottom:8px;">
                <i class="far fa-calendar-check" style="color:var(--primary);"></i> ${dayName}
            </div>
            <div style="display:flex; gap:15px;">
                <div style="flex:1;">
                    <label style="font-size:12px; color:#64748b; font-weight:700; margin-bottom:5px; display:block;">Opening Time</label>
                    <input type="time" id="prof_${day}_open" class="filter-input" style="padding:12px; background:#f8fafc; font-weight:bold;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:12px; color:#64748b; font-weight:700; margin-bottom:5px; display:block;">Closing Time</label>
                    <input type="time" id="prof_${day}_close" class="filter-input" style="padding:12px; background:#f8fafc; font-weight:bold;">
                </div>
            </div>
        </div>`;
    });
}

function fetchPharmacyProfile() {
    const btn = document.getElementById("btnUpdateProfile");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading Profile...`;
    
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", 
        body: JSON.stringify({ action: "getPharmacyProfile", user_id: localStorage.getItem("bhavya_user_id") })
    })
    .then(res => res.json())
    .then(resData => {
        btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
        if (resData.status === "success") {
            const p = resData.data;
            
            // Pincodes aur Cities fill karna
            try { profPincodeList = JSON.parse(p.available_pincode); } catch(e) { profPincodeList = p.available_pincode ? p.available_pincode.split(',').map(x=>x.trim()) : []; }
            try { profCityList = p.available_city.split(',').map(x=>x.trim()); } catch(e) { profCityList = []; }
            
            updateProfTagsUI('pincode');
            updateProfTagsUI('city');

            // ✨ FIXED: Timings Pre-fill Logic ✨
            days.forEach(day => {
                if(p.timings && p.timings[day]) {
                    // Timing format 'HH:mm' hona chahiye input[type="time"] ke liye
                    let openVal = p.timings[day].open || "";
                    let closeVal = p.timings[day].close || "";
                    
                    document.getElementById("prof_" + day + "_open").value = openVal;
                    document.getElementById("prof_" + day + "_close").value = closeVal;
                }
            });

            document.getElementById("currImg1").innerHTML = p.img1 ? `<a href="${p.img1}" target="_blank" style="text-decoration:none;"><i class="fas fa-image"></i> View Image 1</a>` : "No image";
            document.getElementById("currImg2").innerHTML = p.img2 ? `<a href="${p.img2}" target="_blank" style="text-decoration:none;"><i class="fas fa-image"></i> View Image 2</a>` : "No image";
        }
    })
    .catch(err => {
        console.error("Profile Fetch Error:", err);
        btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
    });
}

function addProfTag(type) {
    let inputElem = document.getElementById(type === 'pincode' ? 'profPincode' : 'profCity');
    let val = inputElem.value.trim();
    if (!val) return;
    if (type === 'pincode' && !profPincodeList.includes(val)) { profPincodeList.push(val); updateProfTagsUI('pincode'); } 
    else if (type === 'city') {
        val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
        if (!profCityList.includes(val)) { profCityList.push(val); updateProfTagsUI('city'); }
    }
    inputElem.value = ""; 
}

function removeProfTag(type, index) { 
    type === 'pincode' ? profPincodeList.splice(index, 1) : profCityList.splice(index, 1); updateProfTagsUI(type); 
}

function updateProfTagsUI(type) {
    let wrapper = document.getElementById(type === 'pincode' ? 'profPincodeTags' : 'profCityTags'); 
    let list = type === 'pincode' ? profPincodeList : profCityList; 
    wrapper.innerHTML = "";
    list.forEach((item, index) => { wrapper.innerHTML += `<div class="tag">${item} <span onclick="removeProfTag('${type}', ${index})">×</span></div>`; });
}

function getBase64(fileId) {
    return new Promise((resolve) => {
        const input = document.getElementById(fileId);
        if (!input || !input.files || input.files.length === 0) { resolve(""); return; }
        const reader = new FileReader(); reader.readAsDataURL(input.files[0]);
        reader.onload = () => resolve(reader.result.split(',')[1]);
    });
}

async function submitProfileUpdate(e) {
    e.preventDefault();
    
    if(profPincodeList.length === 0 || profCityList.length === 0) { 
        showToast("At least 1 Delivery Pincode and City is required.", "error"); 
        return; 
    }

    // ✨ NAYA CHECK: Kya timings fill hain? ✨
    let timingsMissing = false;
    days.forEach(day => {
        let open = document.getElementById("prof_"+day+"_open").value;
        let close = document.getElementById("prof_"+day+"_close").value;
        if(!open || !close) timingsMissing = true;
    });

    if(timingsMissing) {
        showToast("Please fill all Working Timings before saving.", "error");
        return;
    }

    const btn = document.getElementById("btnUpdateProfile"); 
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`; btn.disabled = true;

    try {
        let payload = {
            action: "updatePharmacyProfile",
            user_id: localStorage.getItem("bhavya_user_id"),
            available_city: profCityList.join(', '),
            available_pincode: JSON.stringify(profPincodeList),
            img1: await getBase64("profImg1"),
            img2: await getBase64("profImg2")
        };

        // Days ki values add karna
        days.forEach(day => {
            payload[day + "_opening_time"] = document.getElementById("prof_"+day+"_open").value;
            payload[day + "_closing_time"] = document.getElementById("prof_"+day+"_close").value;
        });

        const response = await fetch(GOOGLE_SCRIPT_URL, { 
            method: "POST", 
            headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify(payload) 
        });
        
        const resData = await response.json();

        if (resData.status === "success") {
            showToast("Profile updated successfully!", "success");
            // Wapas fetch karein taaki UI confirm ho jaye
            setTimeout(fetchPharmacyProfile, 500); 
        } else {
            showToast("Error: " + resData.message, "error"); 
        }
    } catch (error) { 
        showToast("Network error while updating profile.", "error"); 
    } finally { 
        btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`; 
        btn.disabled = false; 
    }
}

// ✨ ADVANCED FETCH ORDERS ✨
function fetchOrders() {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = `<div style="text-align: center; padding: 50px; color: #64748b;"><i class="fas fa-spinner fa-spin" style="font-size: 30px; margin-bottom: 10px;"></i><p>Loading your orders...</p></div>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getPharmacyOrders", user_id: localStorage.getItem("bhavya_user_id") })
    })
    .then(async res => {
        if (!res.ok) throw new Error(`Server returned status: ${res.status}`);
        const text = await res.text();
        try {
            return JSON.parse(text); 
        } catch (e) {
            console.error("Backend sent HTML instead of JSON! Backend Error/Crash:", text);
            throw new Error("JSON Parse Failed - Backend Deployment Issue");
        }
    })
    .then(resData => {
        if (resData.status === "success") {
            globalPharmacyOrders = resData.data.orders;
            renderOrders(globalPharmacyOrders);
            
            renderOverviewDashboard(); // Chart Render
            
            if(document.getElementById('settlementsSection').classList.contains('active')) renderSettlements();
        } else {
            container.innerHTML = `<p style="text-align:center; color:red;">Error: ${resData.message}</p>`;
        }
    }).catch(err => { 
        console.error("Fetch Error Trace:", err);
        container.innerHTML = `<p style="text-align:center; color:red; font-weight:bold;">Network Error: Check console.</p>`; 
    });
}
function filterLiveOrders() {
    const search = document.getElementById("searchOrderInput").value.toLowerCase().trim();
    const statusVal = document.getElementById("statusFilter").value;
    const dateVal = document.getElementById("dateFilter").value;

    const filtered = globalPharmacyOrders.filter(order => {
        let matchText = true;
        if (search !== "") { 
            matchText = String(order.order_id || "").toLowerCase().includes(search) || 
                        String(order.patient_mobile || "").toLowerCase().includes(search); 
        }
        let matchStatus = true;
        if (statusVal !== "All") { matchStatus = order.patient_status === statusVal; }
        let matchDate = true;
        if (dateVal !== "") {
            const [year, month, day] = dateVal.split('-');
            const orderDateStr = order.order_date || "";
            matchDate = orderDateStr.includes(`${year}-${month}-${day}`);
        }
        return matchText && matchStatus && matchDate;
    });
    renderOrders(filtered);
}

function clearOrderFilters() {
    document.getElementById("searchOrderInput").value = "";
    document.getElementById("statusFilter").value = "All";
    document.getElementById("dateFilter").value = "";
    renderOrders(globalPharmacyOrders);
}

function renderOrders(orders) {
    const container = document.getElementById("ordersContainer"); container.innerHTML = "";
    if (!orders || orders.length === 0) { container.innerHTML = `<div style="text-align: center; padding: 50px; background: white; border-radius: 16px; border: 1px dashed #cbd5e1;"><i class="fas fa-box-open" style="font-size: 40px; color: #94a3b8; margin-bottom: 15px;"></i><h3>No Orders Found</h3><p style="color:#64748b;">Try changing your search filters.</p></div>`; return; }

    orders.forEach(order => {
        let badge = ""; let actionBtn = "";
        
        if (order.patient_status === "Pending") {
            badge = `<span class="badge badge-pending">New Request</span>`;
            actionBtn = `
                <div style="display:flex; gap:10px; width:100%;">
                    <button class="btn" style="flex:1; background:#fee2e2; color:#dc2626;" onclick="openCancelModal('${order.order_id}')"><i class="fas fa-times"></i> Cancel</button>
                    <button class="btn btn-process" onclick="openProcessModal('${order.order_id}')" style="flex:2;"><i class="fas fa-clipboard-check"></i> Process Order</button>
                </div>`;
        } 
        else if (order.patient_status === "confirm_for_patient") {
            badge = `<span class="badge" style="background:#e0e7ff; color:#4f46e5;">Sent to Patient</span>`;
            actionBtn = `<button class="btn" disabled style="width:100%; background:#f1f5f9; color:#64748b;"><i class="fas fa-hourglass-half"></i> Awaiting Patient Reply</button>`;
        } 
        else if (order.patient_status === "Confirmed") {
            badge = `<span class="badge" style="background:#10b981; color:white;"><i class="fas fa-exclamation-circle"></i> Action Needed</span>`;
            actionBtn = `
                <div style="display:flex; gap:10px; width:100%;">
                    <button class="btn" style="flex:1; background:#fee2e2; color:#dc2626;" onclick="openCancelModal('${order.order_id}')"><i class="fas fa-times"></i> Cancel</button>
                    <button class="btn" style="flex:1.5; background:#10b981; color:white; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);" onclick="openCompleteModal('${order.order_id}')"><i class="fas fa-check-double"></i> Delivered?</button>
                </div>`;
        }
        else if (order.patient_status === "Completed") {
            badge = `<span class="badge" style="background:#ecfdf5; color:#065f46;"><i class="fas fa-check-circle"></i> Completed</span>`;
            actionBtn = `<button class="btn" disabled style="width:100%; background:#f1f5f9; color:#065f46; font-weight:800;"><i class="fas fa-award"></i> Order Completed</button>`;
        }
        else if (order.patient_status === "Cancelled") {
            badge = `<span class="badge" style="background:#fee2e2; color:#b91c1c;"><i class="fas fa-ban"></i> Cancelled</span>`;
            actionBtn = `<button class="btn" disabled style="width:100%; background:#fef2f2; color:#dc2626;"><i class="fas fa-ban"></i> Order Cancelled</button>`;
        }

        let cancelReasonHtml = "";
        if (order.patient_status === "Cancelled" && order.cancel_reason) {
            cancelReasonHtml = `<div class="info-block" style="background:#fff1f2; border-color:#fecdd3; margin-top:10px;"><h4 style="color:#e11d48;">Cancel Reason</h4><p style="color:#be123c;">${order.cancel_reason}</p></div>`;
        }

        let ratingHtml = "";
        if (order.pharmacy_rating && order.pharmacy_rating !== "") {
            let stars = parseInt(order.pharmacy_rating); let starIcons = "";
            for (let i = 1; i <= 5; i++) { starIcons += `<i class="fas fa-star" style="color: ${i <= stars ? '#f59e0b' : '#cbd5e1'};"></i>`; }
            ratingHtml = `
            <div class="info-block" style="background:#fffbeb; border-color:#fde68a; margin-top:10px;">
                <h4 style="color:#d97706;">Patient Rating</h4>
                <div style="font-size: 16px;">${starIcons}</div>
                ${order.pharmacy_comment ? `<p style="margin: 5px 0 0 0; font-size: 13px; color: #92400e; font-style: italic;">"${order.pharmacy_comment}"</p>` : ''}
            </div>`;
        }

        let prescHtml = order.prescription ? `<a href="${order.prescription}" target="_blank" style="color: #2563eb; font-size: 14px; font-weight:600;"><i class="fas fa-file-pdf"></i> View Old Prescription</a>` : `<span style="color: #94a3b8; font-size: 13px;">No Old Prescription</span>`;
        let validPrescHtml = order.valid_prescription ? `<div style="margin-top: 15px; background: #fffbeb; padding: 12px; border-radius: 8px; border: 1px solid #fde68a;"><h6 style="margin: 0 0 5px 0; color: #d97706; font-size: 12px;"><i class="fas fa-certificate"></i> Patient Uploaded New Valid Prescription</h6><a href="${order.valid_prescription}" target="_blank" style="color: #059669; font-size: 13px; font-weight: 700; text-decoration: none;"><i class="fas fa-download"></i> View & Download</a></div>` : "";
        let callBtn = order.patient_mobile && !String(order.patient_mobile).includes("Hidden") ? `<a href="tel:${order.patient_mobile}" class="btn btn-call" style="width:100%; margin-bottom:10px;"><i class="fas fa-phone-alt"></i> Call Patient</a>` : ``;

        let d = new Date(order.order_date); let dateStr = d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}); let timeStr = d.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit', hour12: true});
        let formattedDelivery = order.delivery_date || "Not set";

        let isPickup = (order.order_type === "Collect from Pharmacy" || order.order_type === "Self Pickup");
        let orderTypeDisplay = isPickup 
            ? `<span style="color: #d97706; font-weight: 800; font-size: 12px; background: #fef3c7; padding: 4px 8px; border-radius: 6px;"><i class="fas fa-store-alt"></i> Self Pickup</span>`
            : `<span style="color: var(--primary); font-weight: 800; font-size: 12px; background: #eff6ff; padding: 4px 8px; border-radius: 6px;"><i class="fas fa-motorcycle"></i> Home Delivery</span>`;

        let deliveryIconText = isPickup ? `<i class="fas fa-walking"></i> <b>Pickup By:</b>` : `<i class="fas fa-truck-fast"></i> <b>Deliver By:</b>`;
        let addressLabel = isPickup ? "Pharmacy Address" : "Delivery Address";

        let payStatusBadge = "";
        if(order.patient_status !== "Pending" && order.patient_status !== "Cancelled" && order.patient_status !== "confirm_for_patient") {
             payStatusBadge = (order.payment_status === "Completed" || order.payment_status === "Paid") 
                ? `<span style="background:#d1fae5; color:#059669; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:8px;">PAID</span>` 
                : `<span style="background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:8px;">DUE</span>`;
        }

        let addressHtml = `
        <div class="info-block">
            <h4>${addressLabel}</h4>
            <p style="font-size: 13px;">${order.patient_address}</p>
            <div style="margin-top: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; color: #065f46;">
                <p style="font-size: 13px; margin: 0;">${deliveryIconText} ${formattedDelivery}</p>
            </div>
        </div>`;

        let card = `
        <div class="order-card" ${order.patient_status === "Cancelled" ? 'style="opacity:0.8; border-top-color:#ef4444;"' : ''}>
            <div class="order-header">
                <div><div style="font-size:11px; color:var(--text-muted); font-weight:700;">ORDER ID</div><span class="order-id">#${order.order_id}</span></div>
                <div style="text-align:right;">${badge}<div style="margin-top:6px;">${orderTypeDisplay}</div></div>
            </div>
            
            <div class="info-block">
                <h4>Medicine List & Details</h4>
                <p style="font-size: 14px; line-height:1.6;">${order.medicine_details}</p>
                ${order.prescription ? `<a href="${order.prescription}" target="_blank" style="display:inline-block; margin-top:10px; font-size:12px; background:#eff6ff; color:var(--primary); padding:6px 12px; border-radius:6px; text-decoration:none; font-weight:700;"><i class="fas fa-file-pdf"></i> View Prescription</a>` : ''}
            </div>

            ${addressHtml}
            ${cancelReasonHtml}
            ${ratingHtml}

            <div class="info-block" style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4>Order Info</h4>
                    <div style="color: #0284c7; font-size: 12px; font-weight: 600;"><i class="far fa-calendar-alt"></i> ${dateStr} at ${timeStr}</div>
                </div>
                ${order.final_payable ? `<div style="text-align:right;"><div style="font-size:10px; color:var(--text-muted); font-weight:700; margin-bottom:2px;">FINAL PAYABLE</div><div style="font-size:18px; font-weight:800; color:#0f172a;">₹${order.final_payable}</div>${payStatusBadge}</div>` : ''}
            </div>

            <div class="order-actions">
                ${order.patient_status !== "Completed" && order.patient_status !== "Cancelled" ? callBtn : ''}
                ${actionBtn}
            </div>
        </div>`;
        container.innerHTML += card;
    });
}

function filterSettlements() {
    const search = document.getElementById("searchSettlementInput").value.toLowerCase().trim();
    const startDateVal = document.getElementById("settlementStartDate").value;
    const endDateVal = document.getElementById("settlementEndDate").value;
    const completed = globalPharmacyOrders.filter(o => o.patient_status === "Completed");

    const filtered = completed.filter(order => {
        let matchText = true;
        if (search !== "") { matchText = String(order.order_id || "").toLowerCase().includes(search); }
        let matchDate = true;
        if (startDateVal !== "" || endDateVal !== "") {
            const orderDate = new Date(order.order_date); orderDate.setHours(0, 0, 0, 0); 
            if (startDateVal !== "") { const sDate = new Date(startDateVal); sDate.setHours(0, 0, 0, 0); if (orderDate < sDate) matchDate = false; }
            if (endDateVal !== "") { const eDate = new Date(endDateVal); eDate.setHours(0, 0, 0, 0); if (orderDate > eDate) matchDate = false; }
        }
        return matchText && matchDate;
    });
    renderSettlementsList(filtered); 
}

function clearSettlementFilters() {
    document.getElementById("searchSettlementInput").value = "";
    document.getElementById("settlementStartDate").value = "";
    document.getElementById("settlementEndDate").value = "";
    renderSettlementsList(globalPharmacyOrders.filter(o => o.patient_status === "Completed"));
}

function renderSettlements() { renderSettlementsList(globalPharmacyOrders.filter(o => o.patient_status === "Completed")); }

// ✨ UPDATED: RENDER SETTLEMENTS (With Total Dues & Payment Button) ✨
function renderSettlementsList(ordersToRender) {
    const container = document.getElementById("settlementList"); container.innerHTML = "";
    drawRevenueChart(ordersToRender);

    let totalDueAmount = 0;
    let hasVerificationPending = false;

    // Due amount calculate karna
    ordersToRender.forEach(o => {
        if (o.payment_status === "Due") totalDueAmount += parseFloat(o.bhavya_care_commission) || 0;
        if (o.payment_status === "Verification Pending") hasVerificationPending = true;
    });

    // Top Dues Card Banner
    let duesCardHtml = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 25px; border-radius: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        <div>
            <h4 style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Outstanding Comm. Dues</h4>
            <h2 style="margin: 0; font-size: 32px; font-weight: 800;">₹${totalDueAmount.toFixed(2)}</h2>
        </div>
        <div>
            ${hasVerificationPending 
                ? `<span style="background: #f59e0b; color: white; padding: 10px 15px; border-radius: 8px; font-size: 13px; font-weight: bold;"><i class="fas fa-hourglass-half"></i> Verification Pending</span>` 
                : (totalDueAmount > 0 
                    ? `<button class="btn" style="background: #10b981; color: white; font-size: 15px; box-shadow: 0 4px 15px rgba(16,185,129,0.3);" onclick="openPayoutModal(${totalDueAmount})"><i class="fas fa-qrcode"></i> Pay Now</button>` 
                    : `<span style="color: #10b981; font-weight: bold;"><i class="fas fa-check-circle"></i> All Clear</span>`
                  )
            }
        </div>
    </div>`;
    container.innerHTML += duesCardHtml;

    if(ordersToRender.length === 0) { container.innerHTML += `<div style="text-align:center; padding:50px; background:white; border-radius:12px; color:#64748b;">No completed orders to show.</div>`; return; }

    ordersToRender.forEach(order => {
        let mrp = parseFloat(order.total_mrp) || 0; let profit = parseFloat(order.total_profit) || 0; let myShare = parseFloat(order.pharma_profit_share) || 0; let delCharge = parseFloat(order.delivery_charge) || 0; let comm = parseFloat(order.bhavya_care_commission) || 0;
        
        let payStatusBadge = (order.payment_status === "Completed" || order.payment_status === "Paid") ? `<span class="badge" style="background:#d1fae5; color:#059669; font-size: 11px;">PAID</span>` 
            : (order.payment_status === "Verification Pending" ? `<span class="badge" style="background:#fef3c7; color:#d97706; font-size: 11px;">VERIFYING</span>` : `<span class="badge" style="background:#fee2e2; color:#dc2626; font-size: 11px;">DUE</span>`);

        let html = `
        <div class="order-card" style="border-left: 4px solid #10b981; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items: center; border-bottom: 1px dashed #e2e8f0; padding-bottom: 10px;">
                <strong style="color:#0f172a; font-size:16px;">#${order.order_id}</strong>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:11px; color:#64748b; font-weight:700;">Status: ${payStatusBadge}</span>
                </div>
            </div>
            <div class="settlement-grid">
                <div class="settlement-box">Total MRP <strong>₹${mrp.toFixed(2)}</strong></div>
                <div class="settlement-box">Total Profit <strong>₹${profit.toFixed(2)}</strong></div>
                <div class="settlement-box" style="background:#f0fdf4; border-color:#10b981;">Your Share <strong style="color:#059669;">₹${myShare.toFixed(2)}</strong></div>
                <div class="settlement-box" style="background:#eff6ff; border-color:#3b82f6;">BhavyaCare Comm. <strong style="color:#2563eb;">₹${comm.toFixed(2)}</strong></div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// ✨ NAYA: MODAL OPEN & SMART QR/LINK LOGIC ✨
function openPayoutModal(amount) {
    document.getElementById('modalPayAmount').innerText = "₹" + amount.toFixed(2);
    
    // Aapki exact UPI ID
    const upiLink = `upi://pay?pa=8950112467@ptsbi&pn=BhavyaCare&am=${amount.toFixed(2)}&cu=INR`;
    const container = document.getElementById("paymentContainer");
    
    // Check if user is on Mobile or PC
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        container.innerHTML = `<a href="${upiLink}" class="btn" style="background:#10b981; color:white; display:block; text-decoration:none;"><i class="fas fa-mobile-alt"></i> Tap to Pay via UPI App</a>
        <p style="font-size:12px; color:#64748b; margin-top:10px;">Opens GPay, PhonePe, Paytm etc. directly.</p>`;
    } else {
        let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
        container.innerHTML = `<img src="${qrUrl}" style="width:160px; height:160px; border-radius:10px; border:2px solid #e2e8f0; padding:5px; background:white;">
        <p style="font-size:12px; color:#64748b; margin-top:10px;">Scan this QR code with your phone's UPI app.</p>`;
    }
    
    document.getElementById("payoutScreenshot").value = "";
    document.getElementById('payoutModal').style.display = "flex";
}

// ✨ NAYA: SCREENSHOT SUBMIT HANDLER ✨
document.getElementById("payoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitPayout");
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading Securely...`; btn.disabled = true;
    
    try {
        let base64Img = await getBase64("payoutScreenshot");
        let payload = { action: "submitPayoutRequest", pharmacy_id: localStorage.getItem("bhavya_user_id"), screenshot_base64: base64Img };
        let res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
        let data = await res.json();
        
        if(data.status === "success") {
            showToast("Screenshot submitted for verification!", "success");
            document.getElementById('payoutModal').style.display = 'none';
            fetchOrders(); // Refresh table to show "Verification Pending"
        } else {
            showToast(data.message, "error");
        }
    } catch(e) { showToast("Error uploading screenshot", "error"); }
    finally { btn.innerHTML = `<i class="fas fa-upload"></i> Submit for Verification`; btn.disabled = false; }
});
// ✨ NAYA LOGIC: BAR CHART FOR LEDGER ✨
function drawRevenueChart(orders) {
    const ctx = document.getElementById('revenueBarChart').getContext('2d');
    if (myRevenueChart) myRevenueChart.destroy();

    // Grouping revenue by Date
    let revenueByDate = {};
    orders.forEach(o => {
        let d = new Date(o.order_date);
        let dateStr = `${d.getDate()}/${d.getMonth()+1}`; // format: DD/MM
        let share = parseFloat(o.pharma_profit_share) || 0;
        
        if(!revenueByDate[dateStr]) revenueByDate[dateStr] = 0;
        revenueByDate[dateStr] += share;
    });

    let labels = Object.keys(revenueByDate).reverse(); // Reverse to show oldest to newest
    let dataValues = Object.values(revenueByDate).reverse();

    myRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['No Data'],
            datasets: [{
                label: 'Earnings (₹)',
                data: dataValues.length > 0 ? dataValues : [0],
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                datalabels: { // Numbers on top of the bars
                    align: 'end',
                    anchor: 'end',
                    color: '#2563eb',
                    font: { weight: 'bold' },
                    formatter: (value) => { return value > 0 ? '₹' + value.toFixed(0) : ''; }
                }
            },
            scales: {
                y: { beginAtZero: true, display: false } // Hide Y axis numbers to make it cleaner
            }
        }
    });
}

function downloadSettlementPDF() {
    const searchText = document.getElementById("searchSettlementInput").value.toLowerCase().trim(); const startDateVal = document.getElementById("settlementStartDate").value; const endDateVal = document.getElementById("settlementEndDate").value;
    const completed = globalPharmacyOrders.filter(o => o.patient_status === "Completed");
    const filteredOrders = completed.filter(order => {
        let matchText = true; if (searchText !== "") { matchText = String(order.order_id || "").toLowerCase().includes(searchText); }
        let matchDate = true; if (startDateVal !== "" || endDateVal !== "") {
            const orderDate = new Date(order.order_date); orderDate.setHours(0, 0, 0, 0); 
            if (startDateVal !== "") { const sDate = new Date(startDateVal); sDate.setHours(0, 0, 0, 0); if (orderDate < sDate) matchDate = false; }
            if (endDateVal !== "") { const eDate = new Date(endDateVal); eDate.setHours(0, 0, 0, 0); if (orderDate > eDate) matchDate = false; }
        }
        return matchText && matchDate;
    });
    if(filteredOrders.length === 0) { showToast("No orders found for the selected date range.", "error"); return; }

    let printWindow = window.open('', '', 'width=900,height=700');
    let reportTitle = "Pharmacy Settlement Report";
    if (startDateVal && endDateVal) reportTitle += ` (${startDateVal} to ${endDateVal})`; else if (startDateVal) reportTitle += ` (From ${startDateVal})`; else if (endDateVal) reportTitle += ` (Until ${endDateVal})`;

    let html = `<html><head><title>${reportTitle}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;}.header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2563eb;padding-bottom:15px;margin-bottom:20px;}h1{color:#2563eb;margin:0;font-size:28px;}.meta{color:#555;font-size:14px;margin-top:5px;}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}th,td{border:1px solid #cbd5e1;padding:12px;text-align:center;}th{background-color:#f8fafc;color:#0f172a;font-weight:bold;}.totals{font-weight:bold;background-color:#e0f2fe;color:#0369a1;}</style></head><body><div class="header"><div><h1>BhavyaCare Pharmacy Ledger</h1><div class="meta">${reportTitle}</div></div><div class="meta">Generated on: ${new Date().toLocaleString('en-IN')}</div></div><table><thead><tr><th>Order ID</th><th>Date</th><th>Total MRP (₹)</th><th>Total Profit (₹)</th><th>Your Share (₹)</th><th>Del. Charge (₹)</th><th>BhavyaCare Comm. (₹)</th></tr></thead><tbody>`;
    
    let tMrp=0, tProf=0, tShare=0, tDel=0, tComm=0;
    filteredOrders.forEach(o => {
        let dateObj = new Date(o.order_date); let dateStr = `${dateObj.getDate()}-${dateObj.getMonth()+1}-${dateObj.getFullYear()}`;
        tMrp += Number(o.total_mrp) || 0; tProf += Number(o.total_profit) || 0; tShare += Number(o.pharma_profit_share) || 0; tDel += Number(o.delivery_charge) || 0; tComm += Number(o.bhavya_care_commission) || 0;
        html += `<tr><td style="font-weight:bold;">#${o.order_id}</td><td>${dateStr}</td><td>${(Number(o.total_mrp)||0).toFixed(2)}</td><td>${(Number(o.total_profit)||0).toFixed(2)}</td><td style="color:#059669; font-weight:bold;">${(Number(o.pharma_profit_share)||0).toFixed(2)}</td><td>${(Number(o.delivery_charge)||0).toFixed(2)}</td><td style="color:#2563eb; font-weight:bold;">${(Number(o.bhavya_care_commission)||0).toFixed(2)}</td></tr>`;
    });
    html += `<tr class="totals"><td colspan="2" style="text-align:right; padding-right:15px;">GRAND TOTAL</td><td>₹${tMrp.toFixed(2)}</td><td>₹${tProf.toFixed(2)}</td><td>₹${tShare.toFixed(2)}</td><td>₹${tDel.toFixed(2)}</td><td>₹${tComm.toFixed(2)}</td></tr></tbody></table><p style="text-align:center; font-size:12px; color:#888; margin-top:30px;">This is a computer-generated report.</p></body></html>`;
    
    printWindow.document.write(html); printWindow.document.close();
    printWindow.onload = function() { printWindow.focus(); printWindow.print(); setTimeout(() => printWindow.close(), 100); };
}

// ==========================================
// ✨ MODALS & API CALLS ✨
// ==========================================

function openProcessModal(orderId) { document.getElementById("processOrderId").value = orderId; document.getElementById("modalOrderId").innerText = "#" + orderId; document.getElementById("processModal").style.display = "flex"; }
function closeModal() { document.getElementById("processModal").style.display = "none"; document.getElementById("processForm").reset(); }

async function submitProcessForm(e) {
    e.preventDefault(); const btn = document.getElementById("btnSubmitForm"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`; btn.disabled = true;
    const payload = { action: "confirmPharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: document.getElementById("processOrderId").value, available_meds: document.getElementById("availMeds").value, not_available_meds: document.getElementById("notAvailMeds").value, prescription_req: document.getElementById("prescReq").value, total_mrp: document.getElementById("totalMRP").value, purchase_rate: document.getElementById("purchaseRate").value };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { showToast("Details sent successfully! Patient has been notified.", "success"); closeModal(); fetchOrders(); } else { showToast("Error: " + resData.message, "error"); }
    } catch (error) { showToast("Network error, please try again.", "error"); } finally { btn.innerHTML = "Send to Patient"; btn.disabled = false; }
}

function openCancelModal(orderId) { document.getElementById("cancelOrderIdHidden").value = orderId; document.getElementById("cancelModalOrderId").innerText = "#" + orderId; document.getElementById("cancelOrderModal").style.display = "flex"; }
function closeCancelModal() { document.getElementById("cancelOrderModal").style.display = "none"; document.getElementById("cancelOrderForm").reset(); }

async function submitCancelOrder(e) {
    e.preventDefault(); const btn = document.getElementById("btnSubmitCancel"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Cancelling...`; btn.disabled = true;
    const payload = { action: "cancelPharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: document.getElementById("cancelOrderIdHidden").value, cancel_reason: document.getElementById("cancelReasonText").value };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { showToast("Order Cancelled. Patient has been notified.", "success"); closeCancelModal(); fetchOrders(); } else { showToast("Error: " + resData.message, "error"); }
    } catch (error) { showToast("Network error.", "error"); } finally { btn.innerHTML = "Confirm Cancellation"; btn.disabled = false; }
}

function openCompleteModal(orderId) {
    let modal = document.getElementById("completeOrderModal");
    if(!modal) { showToast("Please update HTML with Complete Order Modal first.", "error"); return; }
    document.getElementById("completeOrderIdHidden").value = orderId;
    document.getElementById("completeModalOrderId").innerText = "#" + orderId;
    document.getElementById("medicineBillFile").value = ""; 
    modal.style.display = "flex";
}

function closeCompleteModal() {
    document.getElementById("completeOrderModal").style.display = "none";
    document.getElementById("completeOrderForm").reset();
}

async function submitCompleteOrder(e) {
    e.preventDefault();
    const orderId = document.getElementById("completeOrderIdHidden").value;
    const fileInput = document.getElementById("medicineBillFile");
    const btn = document.getElementById("btnSubmitComplete");
    
    if (!fileInput.files || fileInput.files.length === 0) { showToast("Please upload the medicine bill.", "error"); return; }

    const fileSizeMB = fileInput.files[0].size / (1024 * 1024);
    if (fileSizeMB > 3) {
        showToast("File is too large! Please upload a file smaller than 3MB.", "error");
        return;
    }

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading securely (Takes 10-15s)...`; 
    btn.disabled = true;

    try {
        let base64Bill = await getBase64("medicineBillFile");
        const payload = { action: "completePharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: orderId, bill_base64: base64Bill };
        
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        
        if (resData.status === "success") { 
            showToast("Bill uploaded and Order Complete!", "success"); 
            closeCompleteModal(); fetchOrders(); 
        } else { showToast("Error: " + resData.message, "error"); }
    } catch (error) { 
        showToast("Network error, please try again.", "error"); 
    } finally { 
        btn.innerHTML = `<i class="fas fa-check-double"></i> Upload Bill & Mark Delivered`; 
        btn.disabled = false; 
    }
}

function checkDeliveryReminders(orders) {
    if(!orders || orders.length === 0) return;
    let now = new Date();
    orders.forEach(order => {
        if (order.patient_status === "Confirmed" && order.delivery_date) {
            try {
                let deliveryStr = String(order.delivery_date); let dDate;
                if (deliveryStr.includes('T')) { dDate = new Date(deliveryStr); } 
                else { let parts = deliveryStr.split(' '); if (parts.length >= 2) { let [year, month, day] = parts[0].split('-'); dDate = new Date(`${year}-${month}-${day}T${parts[1]}`); } }
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

// ==========================================
// ✨ CHART.JS OVERVIEW & DATALABELS ✨
// ==========================================
function renderOverviewDashboard() {
    if (!globalPharmacyOrders) return;

    let total = globalPharmacyOrders.length;
    let completed = 0;
    let cancelled = 0;
    let pending = 0; 
    let earnings = 0;

    globalPharmacyOrders.forEach(o => {
        if (o.patient_status === "Completed") {
            completed++;
            earnings += Number(o.pharma_profit_share) || 0;
        } 
        else if (o.patient_status === "Cancelled") {
            cancelled++;
        } 
        else {
            pending++; 
        }
    });

    document.getElementById("statTotalOrders").innerText = total;
    document.getElementById("statCompletedOrders").innerText = completed;
    document.getElementById("statTotalEarnings").innerText = "₹" + earnings.toFixed(2);

    const ctx = document.getElementById('orderStatusChart').getContext('2d');
    if (myOrderStatusChart) { myOrderStatusChart.destroy(); }

    myOrderStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active/Pending', 'Completed', 'Cancelled'],
            datasets: [{
                data: [pending, completed, cancelled],
                backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 16 },
                    formatter: (value) => { return value > 0 ? value : ''; } // Sirf tab dikhao agar value 0 se jyada ho
                }
            },
            cutout: '60%' 
        }
    });
}

function logout() { localStorage.clear(); window.location.href = "../index.html"; }
