const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; // <-- YAHAN APNA LATEST URL DAALNA

let currentTab = 'patients';

document.addEventListener("DOMContentLoaded", fetchPatientsData);

function switchAdminTab(tabName) {
    currentTab = tabName;
    document.getElementById('tab-patients').classList.remove('active');
    document.getElementById('tab-vips').classList.remove('active');
    document.getElementById('patients-section').style.display = 'none';
    document.getElementById('vips-section').style.display = 'none';
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`${tabName}-section`).style.display = 'block';
    fetchCurrentTabData();
}

function fetchCurrentTabData() {
    if (currentTab === 'patients') fetchPatientsData();
    else fetchVipData();
}

async function fetchPatientsData() {
    const tableBody = document.getElementById("patientsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getPatients" }) });
        const result = await response.json();

        if (result.status === "success") {
            const patients = result.data;
            loader.style.display = "none";
            if (patients.length === 0) { tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No patients found.</td></tr>"; return; }

            patients.forEach(patient => {
                const withdrawClass = patient.withdraw.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const withdrawText = patient.withdraw.toLowerCase() === 'active' ? 'Active 🟢' : 'Inactive 🔴';
                const statusClass = patient.status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const statusText = patient.status.toLowerCase() === 'active' ? 'Active 🟢' : 'Blocked 🔴';
                
                tableBody.innerHTML += `
                    <tr>
                        <td style="text-align: center;"><img src="${patient.image}" class="patient-img"></td>
                        <td><span style="font-size: 12px; color: #555;">${patient.timestamp.split(" ")[0]}</span></td>
                        <td><strong>${patient.user_id}</strong><br><span style="font-size: 11px; color: #888;">Ref: ${patient.referral_code}</span></td>
                        <td style="font-weight: bold;">${patient.patient_name}</td>
                        <td><strong>📞 ${patient.mobile_number}</strong><br><span style="font-size: 11px; color: #555;">📧 ${patient.email}</span></td>
                        <td style="max-width: 250px; font-size: 12px;">${patient.address}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${patient.wallet}</td>
                        <td style="text-transform: capitalize; font-weight: bold;">${patient.plan}</td>
                        <td><button class="badge-btn ${withdrawClass}" onclick="toggleStatus('${patient.user_id}', 'withdraw', '${patient.withdraw}')">${withdrawText}</button></td>
                        <td><button class="badge-btn ${statusClass}" onclick="toggleStatus('${patient.user_id}', 'status', '${patient.status}')">${statusText}</button></td>
                    </tr>`;
            });
        }
    } catch (error) { loader.innerHTML = "❌ Error fetching data."; }
}

async function toggleStatus(userId, field, currentStatus) {
    const newValue = currentStatus.toLowerCase() === "active" ? "inactive" : "active";
    if (!confirm(`Are you sure you want to make ${field.toUpperCase()} '${newValue}' for user ${userId}?`)) return;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "updatePatient", target_user_id: userId, field: field, value: newValue }) });
        const result = await response.json();
        if (result.status === "success") fetchPatientsData();
        else alert("Error: " + result.message);
    } catch (error) { alert("Failed to update."); }
}

async function fetchVipData() {
    const tableBody = document.getElementById("vipsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getVipApplications" }) });
        const result = await response.json();

        if (result.status === "success") {
            const vips = result.data;
            loader.style.display = "none";
            if (vips.length === 0) { tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No VIP applications found.</td></tr>"; return; }

            vips.forEach(vip => {
                let statusBadge = '', actionBtn = '';
                if (vip.status === 'inactive' || vip.status === '') {
                    statusBadge = `<span class="badge-btn status-pending">Pending</span>`;
                    actionBtn = `<button class="badge-btn" style="background:#0056b3; color:white;" onclick="openVipModal('${vip.row_index}', '${vip.user_id}')">Take Action</button>`;
                } else if (vip.status === 'active') {
                    statusBadge = `<span class="badge-btn status-active">Active</span>`;
                    actionBtn = `<span style="font-size:12px; color:green; font-weight:bold;">Approved</span>`;
                } else {
                    statusBadge = `<span class="badge-btn status-inactive">Rejected</span>`;
                    actionBtn = `<span style="font-size:12px; color:red; font-weight:bold;">Rejected</span>`;
                }

                let pkgBadge = '';
                if (vip.vip_package && vip.vip_package.toLowerCase() === 'pending') {
                    pkgBadge = `<br><span style="font-size:10px; background:#ffeeba; color:#856404; padding:3px 6px; border-radius:4px; margin-top:5px; display:inline-block; font-weight:bold;">🎁 Pkg Pending</span>`;
                } else if (vip.vip_package) {
                    pkgBadge = `<br><span style="font-size:10px; background:#d4edda; color:#155724; padding:3px 6px; border-radius:4px; margin-top:5px; display:inline-block; font-weight:bold;">🎁 Pkg Done</span>`;
                }

                let ssLink = vip.payment_screenshot ? `<a href="${vip.payment_screenshot}" target="_blank" style="color:#0056b3; font-weight:bold; font-size:12px;">View SS</a>` : 'N/A';
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

function closeVipModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('vipActionModal').style.display = 'none';
}

async function submitVipAction(statusValue) {
    const rowIndex = document.getElementById('modalRowIndex').value;
    const userId = document.getElementById('modalUserId').innerText;
    const remarks = document.getElementById('modalRemarks').value.trim();

    if (!confirm(`Confirm mark as ${statusValue.toUpperCase()}?`)) return;

    closeVipModal();
    document.getElementById("loader").style.display = "block";

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "processVipAction", row_index: rowIndex, user_id: userId, vip_status: statusValue, remarks: remarks }) 
        });
        const result = await response.json();
        if (result.status === "success") { alert("Success: " + result.message); fetchVipData(); } 
        else { alert("Error: " + result.message); }
    } catch (error) { alert("Action failed to submit."); }
}
