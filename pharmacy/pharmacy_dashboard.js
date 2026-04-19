const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let globalPharmacyOrders = [];
let remindedOrders = new Set(); 

let profPincodeList = [];
let profCityList = [];
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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

// ✨ NAYA: Robust Date Formatter (Outputs: DD-MM-YYYY 02:30 PM) ✨
function formatCustomDate(isoString) {
    if (!isoString || isoString === "undefined") return "Not set";
    try {
        // Agar date already format me hai ya simple string hai
        if (isoString.includes('-') && isoString.split('-')[0].length === 2) return isoString;

        let d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString; 

        let day = String(d.getDate()).padStart(2, '0');
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let year = d.getFullYear();
        
        let hours = d.getHours();
        let minutes = String(d.getMinutes()).padStart(2, '0');
        let ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; 
        let strHours = String(hours).padStart(2, '0');
        
        return `${day}-${month}-${year} ${strHours}:${minutes} ${ampm}`;
    } catch(e) {
        return isoString;
    }
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
});

function showSection(sectionId, btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(sectionId).classList.add('active');
    
    if(sectionId === 'settlementsSection') renderSettlements();
    if(sectionId === 'profileSection') fetchPharmacyProfile();
}

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
        method: "POST", body: JSON.stringify({ action: "getPharmacyProfile", user_id: localStorage.getItem("bhavya_user_id") })
    })
    .then(res => res.json())
    .then(resData => {
        btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
        if (resData.status === "success") {
            const p = resData.data;
            try { profPincodeList = JSON.parse(p.available_pincode); } catch(e) { profPincodeList = p.available_pincode ? p.available_pincode.split(',').map(x=>x.trim()) : []; }
            try { profCityList = p.available_city.split(',').map(x=>x.trim()); } catch(e) { profCityList = []; }
            
            updateProfTagsUI('pincode'); updateProfTagsUI('city');
            days.forEach(day => {
                if(p.timings[day]) {
                    document.getElementById("prof_"+day+"_open").value = p.timings[day].open || "";
                    document.getElementById("prof_"+day+"_close").value = p.timings[day].close || "";
                }
            });
            document.getElementById("currImg1").innerHTML = p.img1 ? `<a href="${p.img1}" target="_blank" style="text-decoration:none;"><i class="fas fa-image"></i> View Uploaded Image 1</a>` : "No image uploaded";
            document.getElementById("currImg2").innerHTML = p.img2 ? `<a href="${p.img2}" target="_blank" style="text-decoration:none;"><i class="fas fa-image"></i> View Uploaded Image 2</a>` : "No image uploaded";
        }
    });
}

function addProfTag(type) {
    let inputElem = document.getElementById(type === 'pincode' ? 'profPincode' : 'profCity'); let val = inputElem.value.trim(); if (!val) return;
    if (type === 'pincode' && !profPincodeList.includes(val)) { profPincodeList.push(val); updateProfTagsUI('pincode'); } 
    else if (type === 'city') { val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(); if (!profCityList.includes(val)) { profCityList.push(val); updateProfTagsUI('city'); } }
    inputElem.value = ""; 
}
function removeProfTag(type, index) { type === 'pincode' ? profPincodeList.splice(index, 1) : profCityList.splice(index, 1); updateProfTagsUI(type); }
function updateProfTagsUI(type) {
    let wrapper = document.getElementById(type === 'pincode' ? 'profPincodeTags' : 'profCityTags'); let list = type === 'pincode' ? profPincodeList : profCityList; 
    wrapper.innerHTML = ""; list.forEach((item, index) => { wrapper.innerHTML += `<div class="tag">${item} <span onclick="removeProfTag('${type}', ${index})">×</span></div>`; });
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
    if(profPincodeList.length === 0 || profCityList.length === 0) { showToast("At least 1 Delivery Pincode and City is required.", "error"); return; }
    const btn = document.getElementById("btnUpdateProfile"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`; btn.disabled = true;

    try {
        let payload = { action: "updatePharmacyProfile", user_id: localStorage.getItem("bhavya_user_id"), available_city: profCityList.join(', '), available_pincode: JSON.stringify(profPincodeList), img1: await getBase64("profImg1"), img2: await getBase64("profImg2") };
        days.forEach(day => { payload[day + "_opening_time"] = document.getElementById("prof_"+day+"_open").value; payload[day + "_closing_time"] = document.getElementById("prof_"+day+"_close").value; });
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { showToast("Profile updated successfully!", "success"); fetchPharmacyProfile(); } else { showToast("Error: " + resData.message, "error"); }
    } catch (error) { showToast("Network error while updating profile.", "error"); } 
    finally { btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`; btn.disabled = false; }
}

function fetchOrders() {
    const container = document.getElementById("ordersContainer");
    container.innerHTML = `<div style="text-align: center; padding: 50px; color: #64748b;"><i class="fas fa-spinner fa-spin" style="font-size: 30px; margin-bottom: 10px;"></i><p>Loading your orders...</p></div>`;

    fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getPharmacyOrders", user_id: localStorage.getItem("bhavya_user_id") }) })
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            globalPharmacyOrders = resData.data.orders;
            renderOrders(globalPharmacyOrders);
            if(document.getElementById('settlementsSection').classList.contains('active')) renderSettlements();
        } else { container.innerHTML = `<p style="text-align:center; color:red;">Error: ${resData.message}</p>`; }
    }).catch(err => { container.innerHTML = `<p style="text-align:center; color:red;">Network Error.</p>`; });
}

function filterLiveOrders() {
    const searchText = document.getElementById("searchOrderInput").value.toLowerCase().trim();
    const statusVal = document.getElementById("statusFilter").value;
    const dateVal = document.getElementById("dateFilter").value;

    const filtered = globalPharmacyOrders.filter(order => {
        let matchText = true; if (searchText !== "") { matchText = (order.order_id || "").toLowerCase().includes(searchText) || (order.patient_mobile || "").toLowerCase().includes(searchText); }
        let matchStatus = true; if (statusVal !== "All") { matchStatus = order.patient_status === statusVal; }
        let matchDate = true; if (dateVal !== "") {
            const [year, month, day] = dateVal.split('-'); const orderDateStr = order.order_date || ""; matchDate = orderDateStr.includes(`${year}-${month}-${day}`);
        }
        return matchText && matchStatus && matchDate;
    });
    renderOrders(filtered);
}

function clearOrderFilters() {
    document.getElementById("searchOrderInput").value = ""; document.getElementById("statusFilter").value = "All"; document.getElementById("dateFilter").value = "";
    renderOrders(globalPharmacyOrders);
}

function filterSettlements() {
    const searchText = document.getElementById("searchSettlementInput").value.toLowerCase().trim();
    const startDateVal = document.getElementById("settlementStartDate").value;
    const endDateVal = document.getElementById("settlementEndDate").value;
    const completed = globalPharmacyOrders.filter(o => o.patient_status === "Completed");

    const filtered = completed.filter(order => {
        let matchText = true; if (searchText !== "") { matchText = (order.order_id || "").toLowerCase().includes(searchText); }
        let matchDate = true; if (startDateVal !== "" || endDateVal !== "") {
            const orderDate = new Date(order.order_date); orderDate.setHours(0, 0, 0, 0); 
            if (startDateVal !== "") { const sDate = new Date(startDateVal); sDate.setHours(0, 0, 0, 0); if (orderDate < sDate) matchDate = false; }
            if (endDateVal !== "") { const eDate = new Date(endDateVal); eDate.setHours(0, 0, 0, 0); if (orderDate > eDate) matchDate = false; }
        }
        return matchText && matchDate;
    });
    renderSettlementsList(filtered); 
}

function clearSettlementFilters() {
    document.getElementById("searchSettlementInput").value = ""; document.getElementById("settlementStartDate").value = ""; document.getElementById("settlementEndDate").value = "";
    renderSettlementsList(globalPharmacyOrders.filter(o => o.patient_status === "Completed"));
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
        let callBtn = order.patient_mobile ? `<div style="display:flex; gap:10px; flex:1;"><a href="tel:${order.patient_mobile}" class="btn btn-call" style="flex:1; padding: 12px 10px; font-size: 14px;"><i class="fas fa-phone-alt"></i> Call</a><button class="btn btn-call" style="flex:1; background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 12px 10px; font-size: 14px;" onclick="this.innerHTML='<i class=\\'fas fa-check\\'></i> ${order.patient_mobile}'; navigator.clipboard.writeText('${order.patient_mobile}');"><i class="fas fa-eye"></i> Show</button></div>` : `<button class="btn btn-call" style="opacity:0.5; cursor:not-allowed; flex:1;"><i class="fas fa-phone-slash"></i> No Number</button>`;

        // ✨ FIX: Format date using new formatter ✨
        let displayOrderDate = formatCustomDate(order.order_date);
        let displayDeliveryDate = formatCustomDate(order.delivery_date);

        let orderTypeDisplay = (order.order_type === "Collect from Pharmacy" || order.order_type === "Self Pickup") 
            ? `<span style="color: #d97706; font-weight: 800; font-size: 12px; background: #fef3c7; padding: 4px 8px; border-radius: 6px;"><i class="fas fa-store-alt"></i> Self Pickup</span>`
            : `<span style="color: var(--primary); font-weight: 800; font-size: 12px; background: #eff6ff; padding: 4px 8px; border-radius: 6px;"><i class="fas fa-motorcycle"></i> Home Delivery</span>`;

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

            <div class="info-block">
                <h4>${(order.order_type === "Collect from Pharmacy" || order.order_type === "Self Pickup") ? 'Pharmacy Address' : 'Delivery Address'}</h4>
                <p style="font-size: 13px;">${order.patient_address}</p>
                <div style="margin-top: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-truck-fast" style="color: #10b981; font-size:16px;"></i> 
                    <span style="font-size: 13px; color: #065f46; font-weight:700;">Deliver By: ${displayDeliveryDate}</span>
                </div>
            </div>

            ${cancelReasonHtml}
            ${ratingHtml}

            <div class="info-block" style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 10px;">
                <h4>Order Timeline</h4>
                <div style="background: #e0f2fe; color: #0284c7; padding: 8px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;"><i class="far fa-calendar-alt"></i> Ordered on: ${displayOrderDate}</div>
            </div>

            <div class="order-actions">
                ${order.patient_status !== "Completed" && order.patient_status !== "Cancelled" ? callBtn : ''}
                ${actionBtn}
            </div>
        </div>`;
        container.innerHTML += card;
    });
}

function renderSettlements() { renderSettlementsList(globalPharmacyOrders.filter(o => o.patient_status === "Completed")); }

function renderSettlementsList(ordersToRender) {
    const container = document.getElementById("settlementList"); container.innerHTML = "";
    if(ordersToRender.length === 0) { container.innerHTML = `<div style="text-align:center; padding:50px; background:white; border-radius:12px; color:#64748b;"><i class="fas fa-file-invoice-dollar" style="font-size:30px; margin-bottom:10px; display:block;"></i>No completed orders to show. Try changing dates.</div>`; return; }

    ordersToRender.forEach(order => {
        let mrp = parseFloat(order.total_mrp) || 0; let pRate = parseFloat(order.purchase_rate) || 0; let profit = parseFloat(order.total_profit) || 0; let myShare = parseFloat(order.pharma_profit_share) || 0; let delCharge = parseFloat(order.delivery_charge) || 0; let comm = parseFloat(order.bhavya_care_commission) || 0;
        
        let payoutStatus = order.payout_status || "Pending";
        let payoutBadge = payoutStatus === "Paid" ? `<span class="badge" style="background:#d1fae5; color:#059669; font-size: 11px;">PAID</span>` : `<span class="badge" style="background:#fef3c7; color:#d97706; font-size: 11px;">PENDING</span>`;

        let html = `
        <div class="order-card" style="border-left: 4px solid #10b981; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items: center; border-bottom: 1px dashed #e2e8f0; padding-bottom: 10px;">
                <strong style="color:#0f172a; font-size:16px;">#${order.order_id}</strong>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:11px; color:#64748b; font-weight:700;">Payout: ${payoutBadge}</span>
                </div>
            </div>
            <div class="settlement-grid">
                <div class="settlement-box">Total MRP <strong>₹${mrp.toFixed(2)}</strong></div>
                <div class="settlement-box">Total Profit <strong>₹${profit.toFixed(2)}</strong></div>
                <div class="settlement-box" style="background:#f0fdf4; border-color:#10b981;">Your Share <strong style="color:#059669;">₹${myShare.toFixed(2)}</strong></div>
                <div class="settlement-box">Del. Charge <strong style="color:#059669;">+ ₹${delCharge.toFixed(2)}</strong></div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}

// ✨ NAYA LOGIC: DIRECT PDF DOWNLOAD ✨
function downloadSettlementPDF() {
    const searchText = document.getElementById("searchSettlementInput").value.toLowerCase().trim(); 
    const startDateVal = document.getElementById("settlementStartDate").value; 
    const endDateVal = document.getElementById("settlementEndDate").value;
    
    const completed = globalPharmacyOrders.filter(o => o.patient_status === "Completed");
    const filteredOrders = completed.filter(order => {
        let matchText = true; if (searchText !== "") { matchText = (order.order_id || "").toLowerCase().includes(searchText); }
        let matchDate = true; if (startDateVal !== "" || endDateVal !== "") {
            const orderDate = new Date(order.order_date); orderDate.setHours(0, 0, 0, 0); 
            if (startDateVal !== "") { const sDate = new Date(startDateVal); sDate.setHours(0, 0, 0, 0); if (orderDate < sDate) matchDate = false; }
            if (endDateVal !== "") { const eDate = new Date(endDateVal); eDate.setHours(0, 0, 0, 0); if (orderDate > eDate) matchDate = false; }
        }
        return matchText && matchDate;
    });
    
    if(filteredOrders.length === 0) { showToast("No orders found for the selected date range.", "error"); return; }

    let reportTitle = "Pharmacy Settlement Report";
    if (startDateVal && endDateVal) reportTitle += ` (${startDateVal} to ${endDateVal})`; else if (startDateVal) reportTitle += ` (From ${startDateVal})`; else if (endDateVal) reportTitle += ` (Until ${endDateVal})`;

    let htmlStr = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background: #fff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">BhavyaCare Pharmacy Ledger</h1>
            <div style="color: #555; font-size: 12px; margin-top: 5px;">${reportTitle} | Generated: ${new Date().toLocaleString('en-IN')}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
                <tr style="background-color: #f8fafc; color: #0f172a;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Order ID</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Date</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Total MRP</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Profit</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Your Share</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Del. Charge</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Comm.</th>
                </tr>
            </thead>
            <tbody>`;
    
    let tMrp=0, tProf=0, tShare=0, tDel=0, tComm=0;
    filteredOrders.forEach(o => {
        let dateObj = new Date(o.order_date); let dateStr = `${dateObj.getDate()}-${dateObj.getMonth()+1}-${dateObj.getFullYear()}`;
        tMrp += Number(o.total_mrp) || 0; tProf += Number(o.total_profit) || 0; tShare += Number(o.pharma_profit_share) || 0; tDel += Number(o.delivery_charge) || 0; tComm += Number(o.bhavya_care_commission) || 0;
        htmlStr += `<tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight:bold;">#${o.order_id}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${dateStr}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${(Number(o.total_mrp)||0).toFixed(2)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${(Number(o.total_profit)||0).toFixed(2)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color:#059669; font-weight:bold;">${(Number(o.pharma_profit_share)||0).toFixed(2)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${(Number(o.delivery_charge)||0).toFixed(2)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color:#2563eb; font-weight:bold;">${(Number(o.bhavya_care_commission)||0).toFixed(2)}</td>
        </tr>`;
    });
    htmlStr += `
            <tr style="background-color: #e0f2fe; color: #0369a1; font-weight: bold;">
                <td colspan="2" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">GRAND TOTAL</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">₹${tMrp.toFixed(2)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">₹${tProf.toFixed(2)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">₹${tShare.toFixed(2)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">₹${tDel.toFixed(2)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">₹${tComm.toFixed(2)}</td>
            </tr>
        </tbody></table>
        <p style="text-align:center; font-size:10px; color:#888; margin-top:20px;">This is a computer-generated report.</p>
    </div>`;
    
    // Create a temporary hidden div to hold the HTML
    let wrapper = document.createElement('div');
    wrapper.innerHTML = htmlStr;
    
    let opt = {
      margin:       10,
      filename:     'Pharmacy_Settlement_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    showToast("Generating PDF, please wait...", "info");
    html2pdf().set(opt).from(wrapper).save().then(() => {
        showToast("PDF Downloaded successfully!", "success");
    });
}

function openProcessModal(orderId) { document.getElementById("processOrderId").value = orderId; document.getElementById("modalOrderId").innerText = "#" + orderId; document.getElementById("processModal").style.display = "flex"; }
function closeModal() { document.getElementById("processModal").style.display = "none"; document.getElementById("processForm").reset(); }

async function submitProcessForm(e) {
    e.preventDefault(); const btn = document.getElementById("btnSubmitForm"); btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`; btn.disabled = true;
    const payload = { action: "confirmPharmacyOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: document.getElementById("processOrderId").value, available_meds: document.getElementById("availMeds").value, not_available_meds: document.getElementById("notAvailMeds").value, prescription_req: document.getElementById("prescReq").value, total_mrp: document.getElementById("totalMRP").value, purchase_rate: document.getElementById("purchaseRate").value };
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const resData = await response.json();
        if (resData.status === "success") { showToast("Details sent successfully! Patient has been notified.", "success"); closeModal(); fetchOrders(); } else { showToast("Error: " + resData.message, "error"); }
    } catch (error) { showToast("Network error, please try again.", "error"); } 
    finally { btn.innerHTML = `<i class="fas fa-check-double"></i> Upload Bill & Mark Delivered`; btn.disabled = false; }
}

function logout() { localStorage.clear(); window.location.href = "../index.html"; }
