const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let currentTab = 'patients';

document.addEventListener("DOMContentLoaded", fetchPatientsData);

function switchAdminTab(tabName) {
    currentTab = tabName;
    
    // Reset buttons
    document.getElementById('tab-patients')?.classList.remove('active');
    document.getElementById('tab-vips')?.classList.remove('active');
    document.getElementById('tab-booking')?.classList.remove('active');
    
    // Hide sections
    document.getElementById('patients-section').style.display = 'none';
    document.getElementById('vips-section').style.display = 'none';
    document.getElementById('booking-section').style.display = 'none';

    // Activate selected
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    document.getElementById(`${tabName}-section`).style.display = 'block';

    fetchCurrentTabData();
}

function fetchCurrentTabData() {
    if (currentTab === 'patients') fetchPatientsData();
    else if (currentTab === 'vips') fetchVipData();
    else if (currentTab === 'booking') fetchBookingOrders();
}

function closeModals() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('orderStatusModal').style.display = 'none';
    document.getElementById('orderReportModal').style.display = 'none';
}

// ==========================================
// 1. PATIENTS LIST
// ==========================================
async function fetchPatientsData() {
    const tableBody = document.getElementById("patientsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", body: JSON.stringify({ action: "getPatients" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            result.data.forEach(p => {
                tableBody.innerHTML += `
                    <tr>
                        <td><img src="${p.image}" class="patient-img"></td>
                        <td><strong>${p.user_id}</strong></td>
                        <td>${p.patient_name}</td>
                        <td>${p.mobile_number}<br><small>${p.email}</small></td>
                        <td style="font-size:12px;">${p.address}</td>
                        <td style="color:green; font-weight:bold;">₹${p.wallet}</td>
                        <td>${p.plan.toUpperCase()}</td>
                        <td><span class="badge-btn status-active">${p.status}</span></td>
                    </tr>`;
            });
        }
    } catch (e) { loader.innerText = "Error loading patients."; }
}

// ==========================================
// 2. VIP DATA (SABHI LOGIC SAME RAKHA HAI)
// ==========================================
async function fetchVipData() {
    const tableBody = document.getElementById("vipsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", body: JSON.stringify({ action: "getVipApplications" }) 
        });
        const result = await response.json();
        loader.style.display = "none";
        if (result.status === "success") {
            result.data.forEach(v => {
                tableBody.innerHTML += `
                    <tr>
                        <td>${v.user_id}</td>
                        <td>${v.member1}</td>
                        <td>${v.payment_mode}<br><small>${v.payment_id}</small></td>
                        <td>₹${v.amount}</td>
                        <td><span class="badge-btn status-pending">${v.status}</span></td>
                        <td>${v.start_date} to ${v.end_date}</td>
                        <td><button class="badge-btn status-primary" onclick="alert('Use VIP Tab Action')">Action</button></td>
                    </tr>`;
            });
        }
    } catch (e) { loader.innerText = "Error loading VIPs."; }
}

// ==========================================
// 3. PATIENT BOOKING (ORDERS) LOGIC
// ==========================================
async function fetchBookingOrders() {
    const tableBody = document.getElementById("bookingTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", body: JSON.stringify({ action: "getLabOrders" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success" && result.data.length > 0) {
            result.data.forEach(order => {
                let items = "";
                try { items = JSON.parse(order.cart_items_json).map(i => `• ${i.service_name}`).join("<br>"); } catch(e) { items = "N/A"; }

                let sClass = order.status.toLowerCase() === 'confirmed' ? 'status-active' : (order.status.toLowerCase() === 'cancelled' ? 'status-inactive' : 'status-pending');

                tableBody.innerHTML += `
                    <tr>
                        <td><strong>${order.order_id}</strong><br><small>${order.date.split("T")[0]}</small></td>
                        <td><strong>${order.patient_name}</strong><br><small>UID: ${order.user_id}</small></td>
                        <td><span style="color:#0056b3; font-weight:bold;">${order.lab_id}</span><br><small>${order.slot}</small></td>
                        <td style="font-size:12px;">${items}</td>
                        <td><small>Sub: ₹${order.subtotal}</small><br><strong>Pay: ₹${order.final_payable}</strong></td>
                        <td><span style="color:blue; font-weight:bold;">[${order.fulfillment.toUpperCase()}]</span><br><small>${order.address}</small></td>
                        <td style="text-align:center;">
                            <span class="badge-btn ${sClass}">${order.status}</span><br>
                            <button class="badge-btn status-primary" onclick="openStatusModal('${order.order_id}', '${order.status}')">Change</button>
                        </td>
                        <td style="text-align:center;">
                            <button class="badge-btn status-active" onclick="openReportModal('${order.order_id}', '${order.report_type}', '${order.report_pdf}')">Reports</button>
                            ${order.report_pdf ? `<br><a href="${order.report_pdf}" target="_blank" style="font-size:10px;">View PDF</a>` : ''}
                        </td>
                    </tr>`;
            });
        } else {
            tableBody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>No Bookings Found.</td></tr>";
        }
    } catch (e) { loader.innerText = "Error loading bookings."; }
}

// Modal Handlers
function openStatusModal(id, current) {
    document.getElementById('statusOrderId').innerText = id;
    document.getElementById('newOrderStatus').value = current;
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('orderStatusModal').style.display = 'block';
}

async function submitOrderStatus() {
    const id = document.getElementById('statusOrderId').innerText;
    const st = document.getElementById('newOrderStatus').value;
    if(!confirm("Change status to " + st + "?")) return;
    
    closeModals(); document.getElementById('loader').style.display = 'block';
    const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateLabOrderStatus", order_id: id, new_status: st }) });
    const data = await res.json();
    alert(data.message);
    fetchBookingOrders();
}

function openReportModal(id, type, link) {
    document.getElementById('reportOrderId').innerText = id;
    document.getElementById('reportTypeSelect').value = type || "";
    document.getElementById('reportLinkInput').value = link && link !== 'undefined' ? link : "";
    toggleReportLink();
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('orderReportModal').style.display = 'block';
}

function toggleReportLink() {
    const type = document.getElementById('reportTypeSelect').value;
    document.getElementById('reportLinkDiv').style.display = (type === 'online') ? 'block' : 'none';
}

async function submitOrderReport() {
    const id = document.getElementById('reportOrderId').innerText;
    const type = document.getElementById('reportTypeSelect').value;
    const link = document.getElementById('reportLinkInput').value;
    
    closeModals(); document.getElementById('loader').style.display = 'block';
    const res = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "updateOrderReport", order_id: id, report_type: type, report_pdf: link }) });
    const data = await res.json();
    alert(data.message);
    fetchBookingOrders();
}
