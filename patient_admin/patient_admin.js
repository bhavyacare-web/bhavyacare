const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let currentTab = 'patients';

document.addEventListener("DOMContentLoaded", fetchPatientsData);

function switchAdminTab(tabName) {
    currentTab = tabName;
    
    // Reset buttons safely
    document.getElementById('tab-patients')?.classList.remove('active');
    document.getElementById('tab-vips')?.classList.remove('active');
    document.getElementById('tab-booking')?.classList.remove('active');
    
    // Hide sections safely
    document.getElementById('patients-section')?.style.setProperty('display', 'none');
    document.getElementById('vips-section')?.style.setProperty('display', 'none');
    document.getElementById('booking-section')?.style.setProperty('display', 'none');

    // Activate selected
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    document.getElementById(`${tabName}-section`)?.style.setProperty('display', 'block');

    fetchCurrentTabData();
}

function fetchCurrentTabData() {
    if (currentTab === 'patients') fetchPatientsData();
    else if (currentTab === 'vips') fetchVipData();
    else if (currentTab === 'booking') fetchBookingOrders();
}

function closeModals() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('vipActionModal').style.display = 'none';
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
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatients" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            if (result.data.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No patients found.</td></tr>";
                return;
            }
            result.data.forEach(p => {
                const wClass = p.withdraw.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const sClass = p.status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                tableBody.innerHTML += `
                    <tr>
                        <td style="text-align: center;"><img src="${p.image}" class="patient-img"></td>
                        <td><span style="font-size: 12px; color: #555;">${p.timestamp.split(" ")[0]}</span></td>
                        <td><strong>${p.user_id}</strong><br><span style="font-size: 11px; color: #888;">Ref: ${p.referral_code}</span></td>
                        <td style="font-weight: bold;">${p.patient_name}</td>
                        <td><strong>📞 ${p.mobile_number}</strong><br><span style="font-size: 11px; color: #555;">📧 ${p.email}</span></td>
                        <td style="font-size:12px;">${p.address}</td>
                        <td style="color:#28a745; font-weight:bold;">₹${p.wallet}</td>
                        <td style="text-transform:capitalize; font-weight:bold;">${p.plan}</td>
                        <td><button class="badge-btn ${wClass}" onclick="toggleStatus('${p.user_id}', 'withdraw', '${p.withdraw}')">${p.withdraw.toUpperCase()}</button></td>
                        <td><button class="badge-btn ${sClass}" onclick="toggleStatus('${p.user_id}', 'status', '${p.status}')">${p.status.toUpperCase()}</button></td>
                    </tr>`;
            });
        } else { loader.innerHTML = "❌ Error loading data: " + result.message; }
    } catch (e) { loader.innerHTML = "❌ Network Error!"; }
}

async function toggleStatus(userId, field, currentStatus) {
    const newValue = currentStatus.toLowerCase() === "active" ? "inactive" : "active";
    if (!confirm(`Mark ${field.toUpperCase()} as '${newValue}' for ${userId}?`)) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updatePatient", target_user_id: userId, field: field, value: newValue }) 
        });
        const result = await response.json();
        if (result.status === "success") fetchPatientsData();
        else alert("Error: " + result.message);
    } catch (error) { alert("Failed to update."); }
}

// ==========================================
// 2. VIP APPLICATIONS
// ==========================================
async function fetchVipData() {
    const tableBody = document.getElementById("vipsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipApplications" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            if (result.data.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No VIP applications found.</td></tr>";
                return;
            }
            result.data.forEach(vip => {
                let statusBadge = ''; let actionBtn = '';
                if (vip.status === 'inactive' || vip.status === '') {
                    statusBadge = `<span class="badge-btn status-pending">Pending</span>`;
                    actionBtn = `<button class="badge-btn status-primary" onclick="openVipModal('${vip.row_index}', '${vip.user_id}')">Take Action</button>`;
                } else if (vip.status === 'active') {
                    statusBadge = `<span class="badge-btn status-active">Active</span>`;
                    actionBtn = `<span style="font-size:12px; color:green; font-weight:bold;">Approved</span>`;
                } else {
                    statusBadge = `<span class="badge-btn status-inactive">Rejected</span>`;
                    actionBtn = `<span style="font-size:12px; color:red; font-weight:bold;">Rejected</span>`;
                }

                let pkgBadge = '';
                if (vip.vip_package && vip.vip_package.toLowerCase() === 'pending') {
                    pkgBadge = `<br><span style="font-size:10px; background:#ffeeba; padding:3px 6px; border-radius:4px;">🎁 Pkg Pending</span>`;
                } else if (vip.vip_package) {
                    pkgBadge = `<br><span style="font-size:10px; background:#d4edda; padding:3px 6px; border-radius:4px;">🎁 Pkg Done</span>`;
                }

                let ssLink = vip.payment_screenshot ? `<a href="${vip.payment_screenshot}" target="_blank" style="color:#0056b3; font-size:12px;">View SS</a>` : 'N/A';
                let dates = vip.start_date !== 'Not Started' ? `${vip.start_date} <br>to<br> ${vip.end_date}` : 'Not Started';

                tableBody.innerHTML += `
                    <tr>
                        <td><strong>${vip.user_id}</strong></td>
                        <td>${vip.member1}</td>
                        <td>${vip.referrer || 'None'}</td>
                        <td style="text-transform: capitalize;">${vip.payment_mode}</td>
                        <td>ID: ${vip.payment_id || 'N/A'}<br>${ssLink}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${vip.amount}</td>
                        <td style="text-align: center;">${statusBadge} ${pkgBadge}</td>
                        <td style="font-size: 11px; color:#555;">${dates}</td>
                        <td style="font-size: 12px; color:#777;">${vip.remarks || '-'}</td>
                        <td>${actionBtn}</td>
                    </tr>`;
            });
        }
    } catch (error) { loader.innerHTML = "❌ Error fetching VIP data."; }
}

function openVipModal(rowIndex, userId) {
    document.getElementById('modalRowIndex').value = rowIndex;
    document.getElementById('modalUserId').innerText = userId;
    document.getElementById('modalRemarks').value = '';
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('vipActionModal').style.display = 'block';
}

async function submitVipAction(statusValue) {
    const rowIndex = document.getElementById('modalRowIndex').value;
    const userId = document.getElementById('modalUserId').innerText;
    const remarks = document.getElementById('modalRemarks').value.trim();

    if (!confirm(`Confirm mark as ${statusValue.toUpperCase()}?`)) return;
    closeModals(); document.getElementById("loader").style.display = "block";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processVipAction", row_index: rowIndex, user_id: userId, vip_status: statusValue, remarks: remarks }) 
        });
        const result = await response.json();
        if (result.status === "success") { alert(result.message); fetchVipData(); } 
        else { alert("Error: " + result.message); }
    } catch (error) { alert("Action failed."); }
}

// ==========================================
// 3. PATIENT BOOKING (LAB ORDERS)
// ==========================================
async function fetchBookingOrders() {
    const tableBody = document.getElementById("bookingTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getLabOrders" }) 
        });
        const result = await response.json();
        loader.style.display = "none";

        if (result.status === "success") {
            if (result.data.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>No Bookings Found.</td></tr>";
                return;
            }

            result.data.forEach(order => {
                let itemsList = "<i>Invalid Data</i>";
                try {
                    let itemsArr = JSON.parse(order.cart_items_json);
                    itemsList = itemsArr.map(i => `• ${i.service_name} (x${i.qty || 1})`).join("<br>");
                } catch(e) {}

                let statusBadge = "";
                let s = order.status.toLowerCase();
                if(s === 'pending') statusBadge = `<span class="badge-btn status-pending">Pending</span>`;
                else if(s === 'confirmed') statusBadge = `<span class="badge-btn status-active">Confirmed</span>`;
                else if(s === 'cancelled') statusBadge = `<span class="badge-btn status-inactive">Cancelled</span>`;
                else statusBadge = `<span class="badge-btn">${order.status}</span>`;

                let reportBtnClass = "status-primary";
                let reportText = "Assign Report";
                if(order.report_type === 'online') {
                    reportText = "Update Link"; reportBtnClass = "status-active";
                } else if(order.report_type === 'in hand') {
                    reportText = "In Hand Selected"; reportBtnClass = "status-pending";
                }

                let viewReportLink = (order.report_type === 'online' && order.report_pdf) 
                    ? `<br><a href="${order.report_pdf}" target="_blank" style="font-size:11px; color:#0056b3; font-weight:bold;">View PDF</a>` : "";

                tableBody.innerHTML += `
                    <tr>
                        <td><strong>${order.order_id}</strong><br><span style="font-size: 11px; color: #888;">Cart: ${order.parent_cart_id}</span><br><span style="font-size: 12px; color: #555;">${order.date.split("T")[0]}</span></td>
                        <td><strong>${order.patient_name}</strong><br><span style="font-size: 11px; color: #555;">UID: ${order.user_id}</span></td>
                        <td><span style="font-weight:bold; color:#0056b3;">${order.lab_id}</span><br><span style="font-size: 12px; color: #d97706;">⏰ ${order.slot}</span></td>
                        <td style="font-size: 12px; line-height: 1.4;">${itemsList}</td>
                        <td style="font-size: 12px;">Sub: ₹${order.subtotal}<br>Coll: ₹${order.collection_charge}<br>Disc: -₹${order.discount}<br><strong style="color: #28a745; font-size:14px;">Total: ₹${order.final_payable}</strong></td>
                        <td style="font-size: 12px; max-width: 200px;"><span style="text-transform:uppercase; font-weight:bold; color:#17a2b8;">[${order.fulfillment}]</span><br>${order.address}</td>
                        <td style="text-align: center;">
                            ${statusBadge}<br>
                            <button class="badge-btn status-primary" onclick="openOrderStatusModal('${order.order_id}', '${order.status}')">Change Status</button>
                        </td>
                        <td style="text-align: center;">
                            <button class="badge-btn ${reportBtnClass}" onclick="openReportModal('${order.order_id}', '${order.report_type}', '${order.report_pdf}')">${reportText}</button>
                            ${viewReportLink}
                        </td>
                    </tr>`;
            });
        }
    } catch (error) { loader.innerHTML = "❌ Error fetching Bookings."; }
}

function openOrderStatusModal(orderId, currentStatus) {
    document.getElementById('statusOrderId').innerText = orderId;
    let sel = document.getElementById('newOrderStatus');
    for(let i=0; i<sel.options.length; i++) {
        if(sel.options[i].value.toLowerCase() === currentStatus.toLowerCase()) { sel.selectedIndex = i; break; }
    }
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('orderStatusModal').style.display = 'block';
}

async function submitOrderStatus() {
    const orderId = document.getElementById('statusOrderId').innerText;
    const newStatus = document.getElementById('newOrderStatus').value;
    if (!confirm(`Change order status to ${newStatus}?`)) return;

    closeModals(); document.getElementById("loader").style.display = "block";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateLabOrderStatus", order_id: orderId, new_status: newStatus }) 
        });
        const result = await response.json();
        alert(result.message || "Status Updated Successfully!"); 
        fetchBookingOrders(); 
    } catch (error) { alert("Action failed."); }
}

function openReportModal(orderId, currentType, currentLink) {
    document.getElementById('reportOrderId').innerText = orderId;
    document.getElementById('reportTypeSelect').value = currentType || "";
    document.getElementById('reportLinkInput').value = currentLink !== "undefined" ? currentLink : "";
    toggleReportLink(); 
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('orderReportModal').style.display = 'block';
}

function toggleReportLink() {
    const type = document.getElementById('reportTypeSelect').value;
    document.getElementById('reportLinkDiv').style.display = (type === 'online') ? 'block' : 'none';
}

async function submitOrderReport() {
    const orderId = document.getElementById('reportOrderId').innerText;
    const reportType = document.getElementById('reportTypeSelect').value;
    const reportLink = document.getElementById('reportLinkInput').value.trim();

    if (!reportType) return alert("Please select a report type.");
    if (reportType === 'online' && !reportLink) return alert("Please provide the Google Drive link.");

    closeModals(); document.getElementById("loader").style.display = "block";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateOrderReport", order_id: orderId, report_type: reportType, report_pdf: reportLink }) 
        });
        const result = await response.json();
        alert(result.message || "Report info saved!"); 
        fetchBookingOrders(); 
    } catch (error) { alert("Action failed."); }
}
