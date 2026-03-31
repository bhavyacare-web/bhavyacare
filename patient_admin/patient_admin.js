const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";
// patient.gs - Patient Dashboard Logic
// ==========================================

function getPatientProfile(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("patients");
  var detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("patient_details");
  var vipSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("vip_member"); 
  
  var targetUserId = data.user_id;
  var lastRow = sheet.getLastRow();
  var patientData = null;

  // Main Data nikalo
  if (lastRow > 1) {
    var sheetData = sheet.getRange(2, 1, lastRow - 1, 11).getDisplayValues();
    for (var i = 0; i < sheetData.length; i++) {
      if (sheetData[i][1] === targetUserId) { 
        patientData = {
          timestamp: sheetData[i][0], user_id: sheetData[i][1],
          patient_name: sheetData[i][3], mobile_number: sheetData[i][4],
          referral_code: sheetData[i][6], wallet: sheetData[i][7],
          withdraw: sheetData[i][8], plan: sheetData[i][9], status: sheetData[i][10],
          extra_details: null,
          vip_package_status: "none",
          vip_details: null
        };
        break;
      }
    }
  }

  // Extra Details nikalo
  if (patientData && detailSheet) {
    var detailLastRow = detailSheet.getLastRow();
    if (detailLastRow > 1) {
      var dData = detailSheet.getRange(2, 1, detailLastRow - 1, 9).getValues();
      for (var j = 0; j < dData.length; j++) {
        if (dData[j][0] === targetUserId) {
          patientData.extra_details = {
            email: dData[j][1], address: dData[j][2], city: dData[j][3],
            district: dData[j][4], state: dData[j][5], pincode: dData[j][6],
            image: dData[j][7]
          };
          break;
        }
      }
    }
  }

  // VIP Package ka status aur VIP HISTORY nikalo
  if (patientData && patientData.plan.toLowerCase() === "vip" && vipSheet) {
    var vipLastRow = vipSheet.getLastRow();
    if (vipLastRow > 1) {
      var vData = vipSheet.getRange(2, 1, vipLastRow - 1, 17).getValues();
      for (var k = vData.length - 1; k >= 0; k--) {
        if (vData[k][0] === targetUserId && vData[k][16] === "active") {
          patientData.vip_package_status = vData[k][15] ? vData[k][15].toLowerCase() : "pending";
          patientData.vip_details = {
            start_date: vData[k][1], end_date: vData[k][2],
            member1_name: vData[k][3], member1_id: vData[k][4],
            member2_name: vData[k][5], member2_id: vData[k][6],
            member3_name: vData[k][7], member3_id: vData[k][8]
          };
          break;
        }
      }
    }
  }

  if (patientData) {
    if (patientData.status.toLowerCase() !== "active") return sendResponse("error", "Your account is blocked by Admin.");
    return sendResponse("success", patientData);
  } else {
    return sendResponse("error", "User not found!");
  }
}

function savePatientDetails(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("patient_details");
  var userId = data.user_id;
  var lastRow = sheet.getLastRow();
  var found = false;
  var rowIndex = -1;
  var existingImage = "";

  if (lastRow > 1) {
    var sheetData = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = 0; i < sheetData.length; i++) {
      if (sheetData[i][0] === userId) {
        found = true; rowIndex = i + 2; existingImage = sheetData[i][7]; break;
      }
    }
  }

  var finalImage = existingImage; 
  if (data.image && data.image.length > 50) finalImage = data.image; 

  if (found) {
    sheet.getRange(rowIndex, 2, 1, 8).setValues([[ data.email, data.address, data.city, data.district, data.state, data.pincode, finalImage, "updated" ]]);
  } else {
    sheet.appendRow([ userId, data.email, data.address, data.city, data.district, data.state, data.pincode, finalImage, "active" ]);
  }

  try {
    if (data.email && data.email.trim() !== "") {
      MailApp.sendEmail(data.email, "Profile Successfully Updated - BhavyaCare", "Dear Patient,\n\nYour profile details have been successfully saved.\n\nTeam BhavyaCare");
    }
  } catch(e) {}

  return sendResponse("success", "Profile saved successfully!");
}

// ==========================================
// Fetch Wallet History (Safe Version)
// ==========================================
function getWalletHistory(data) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("wallet_transactions");
    if (!sheet) return sendResponse("error", "Transactions sheet missing!");
    
    var targetUserId = data.user_id;
    var lastRow = sheet.getLastRow();
    var history = [];
    
    if (lastRow > 1) {
      var sheetData = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      for (var i = sheetData.length - 1; i >= 0; i--) { 
        if (sheetData[i][1] === targetUserId) {
          
          var rawDate = sheetData[i][0];
          var formattedDate = "N/A";
          if (rawDate) {
            try {
              formattedDate = Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a");
            } catch(e) {
              formattedDate = rawDate.toString(); 
            }
          }

          history.push({
            date: formattedDate,
            type: sheetData[i][2] ? sheetData[i][2].toString() : "credit",
            amount: sheetData[i][3] ? sheetData[i][3].toString() : "0",
            description: sheetData[i][4] ? sheetData[i][4].toString() : "-",
            reference: sheetData[i][5] ? sheetData[i][5].toString() : ""
          });
        }
      }
    }
    return sendResponse("success", history);
  } catch (mainErr) {
    return sendResponse("error", "Backend crash: " + mainErr.message);
  }
}";
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

// ==========================================
// 1. PATIENTS LIST LOGIC (Purana waisa ka waisa)
// ==========================================
async function fetchPatientsData() {
    const tableBody = document.getElementById("patientsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; 
    loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatients" }) 
        });
        const result = await response.json();

        if (result.status === "success") {
            const patients = result.data;
            loader.style.display = "none";

            if (patients.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No patients found in the system yet.</td></tr>";
                return;
            }

            patients.forEach(patient => {
                const withdrawClass = patient.withdraw.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const withdrawText = patient.withdraw.toLowerCase() === 'active' ? 'Active 🟢' : 'Inactive 🔴';
                
                const statusClass = patient.status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const statusText = patient.status.toLowerCase() === 'active' ? 'Active 🟢' : 'Blocked 🔴';
                
                const row = `
                    <tr>
                        <td style="text-align: center;"><img src="${patient.image}" class="patient-img" alt="Pic"></td>
                        <td><span style="font-size: 12px; color: #555;">${patient.timestamp.split(" ")[0]}</span></td>
                        <td><strong>${patient.user_id}</strong><br><span style="font-size: 11px; color: #888;">Ref: ${patient.referral_code}</span></td>
                        <td style="font-weight: bold; color: #333;">${patient.patient_name}</td>
                        <td><div style="font-weight: bold;">📞 ${patient.mobile_number}</div><div style="font-size: 11px; color: #555;">📧 ${patient.email}</div></td>
                        <td style="max-width: 250px; font-size: 12px; line-height: 1.4;">${patient.address}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${patient.wallet}</td>
                        <td style="text-transform: capitalize; font-weight: bold;">${patient.plan}</td>
                        <td><button class="badge-btn ${withdrawClass}" onclick="toggleStatus('${patient.user_id}', 'withdraw', '${patient.withdraw}')">${withdrawText}</button></td>
                        <td><button class="badge-btn ${statusClass}" onclick="toggleStatus('${patient.user_id}', 'status', '${patient.status}')">${statusText}</button></td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } else {
            loader.innerHTML = "❌ Error loading data: " + result.message;
        }
    } catch (error) { loader.innerHTML = "❌ Network Error! Failed to fetch data."; }
}

async function toggleStatus(userId, field, currentStatus) {
    const newValue = currentStatus.toLowerCase() === "active" ? "inactive" : "active";
    if (!confirm(`Are you sure you want to make ${field.toUpperCase()} '${newValue}' for user ${userId}?`)) return;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updatePatient", target_user_id: userId, field: field, value: newValue }) 
        });
        const result = await response.json();
        if (result.status === "success") fetchPatientsData();
        else alert("Error: " + result.message);
    } catch (error) { alert("Failed to update status."); }
}

// ==========================================
// 2. VIP APPLICATIONS LOGIC (Naya Add Hua)
// ==========================================
async function fetchVipData() {
    const tableBody = document.getElementById("vipsTableBody");
    const loader = document.getElementById("loader");
    tableBody.innerHTML = ""; 
    loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipApplications" }) 
        });
        const result = await response.json();

        if (result.status === "success") {
            const vips = result.data;
            loader.style.display = "none";

            if (vips.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='10' style='text-align:center;'>No VIP applications found.</td></tr>";
                return;
            }

            vips.forEach(vip => {
                let statusBadge = '';
                let actionBtn = '';

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

                let ssLink = vip.payment_screenshot ? `<a href="${vip.payment_screenshot}" target="_blank" style="color:#0056b3; font-weight:bold; font-size:12px;">View SS</a>` : 'N/A';
                let dates = vip.start_date ? `${vip.start_date} <br>to<br> ${vip.end_date}` : 'Not Started';

                const row = `
                    <tr>
                        <td><strong>${vip.user_id}</strong></td>
                        <td>${vip.member1}</td>
                        <td>${vip.referrer || 'None'}</td>
                        <td style="text-transform: capitalize;">${vip.payment_mode}</td>
                        <td>ID: ${vip.payment_id || 'N/A'}<br>${ssLink}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${vip.amount}</td>
                        <td>${statusBadge}</td>
                        <td style="font-size: 11px; color:#555;">${dates}</td>
                        <td style="font-size: 12px; color:#777;">${vip.remarks || '-'}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
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
            body: JSON.stringify({ 
                action: "processVipAction", 
                row_index: rowIndex, 
                user_id: userId, 
                vip_status: statusValue, 
                remarks: remarks 
            }) 
        });
        const result = await response.json();
        
        if (result.status === "success") {
            alert("Success: " + result.message);
            fetchVipData(); // Table refresh
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Action failed to submit.");
    }
}
