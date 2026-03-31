const GOOGLE_SCRIPT_URL = "// ==========================================
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

let baseVipPrice = 3000;
let vipDiscount = 500;
let finalAmount = 3000;
let validReferrerId = "";

document.addEventListener("DOMContentLoaded", initVipPage);

async function initVipPage() {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) { window.location.href = "../index.html"; return; }

    try {
        // 1. Check VIP Application Status First
        const statusRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "checkVipStatus", user_id: userId })
        });
        const statusData = await statusRes.json();

        if (statusData.status === "success") {
            const appStatus = statusData.data.status;
            
            if (appStatus === "inactive" || appStatus === "pending") {
                document.getElementById("vip-pending-container").style.display = "block";
                return; // Execution yahin rok do, form load nahi karna
            } 
            else if (appStatus === "active") {
                document.getElementById("vip-active-container").style.display = "block";
                document.getElementById("activeStartDate").innerText = statusData.data.start_date || "N/A";
                document.getElementById("activeEndDate").innerText = statusData.data.end_date || "N/A";
                return; // Execution yahin rok do
            } 
            else if (appStatus === "rejected") {
                document.getElementById("vip-rejected-container").style.display = "block";
                document.getElementById("rejectedRemarks").innerText = statusData.data.remarks || "No reason provided by Admin.";
                // Return nahi karenge, background me profile data load hone denge taaki re-apply kar sake
            } 
            else {
                // appStatus is "none" (Naya user)
                document.getElementById("vip-form-container").style.display = "block";
            }
        }

        // 2. Fetch Patient Profile (Sirf naam pre-fill karne ke liye)
        const profileRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientProfile", user_id: userId })
        });
        const profileData = await profileRes.json();
        if (profileData.status === "success") {
            document.getElementById("mem1Name").value = profileData.data.patient_name;
        }

        // 3. Fetch Pricing Rules
        const ruleRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipRulesAndReferral" })
        });
        const ruleData = await ruleRes.json();
        if (ruleData.status === "success") {
            baseVipPrice = ruleData.data.price;
            vipDiscount = ruleData.data.discount;
            finalAmount = baseVipPrice;
            updatePayableUI();
        }
    } catch (err) {
        console.error("Failed to load page data:", err);
    }
}

// Function to handle "Re-apply" button click
function showVipForm() {
    document.getElementById("vip-rejected-container").style.display = "none";
    document.getElementById("vip-form-container").style.display = "block";
}

function updatePayableUI() {
    document.getElementById("finalPayable").innerText = finalAmount;
}

// Toggle Online/Cash
function togglePaymentMode() {
    const isOnline = document.querySelector('input[name="payMode"]:checked').value === 'online';
    document.getElementById('online-pay-section').style.display = isOnline ? 'block' : 'none';
}

// Validate Referral
async function verifyReferral() {
    const code = document.getElementById("refCodeInput").value.trim();
    const msg = document.getElementById("refMsg");
    const btn = document.getElementById("btn-apply-ref");

    if (!code) { msg.style.display="block"; msg.style.color="red"; msg.innerText="Enter code first!"; return; }

    btn.innerText = "Checking...";
    btn.disabled = true;

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getVipRulesAndReferral", user_id: localStorage.getItem("bhavya_user_id"), referral_code: code })
        });
        const data = await res.json();

        if (data.status === "success" && data.data.validReferral) {
            validReferrerId = data.data.referrer_id;
            finalAmount = baseVipPrice - vipDiscount;
            updatePayableUI();
            
            msg.style.display="block"; msg.style.color="green"; msg.innerText=`Valid! ₹${vipDiscount} discount applied.`;
            document.getElementById("refCodeInput").readOnly = true;
            btn.style.display = "none";
        } else {
            msg.style.display="block"; msg.style.color="red"; msg.innerText=data.message || "Invalid Code.";
            validReferrerId = "";
            finalAmount = baseVipPrice;
            updatePayableUI();
        }
    } catch(err) {
        msg.style.display="block"; msg.style.color="red"; msg.innerText="Error checking code.";
    } finally {
        btn.innerText = "Apply";
        btn.disabled = false;
    }
}

// Image Compression
const payScreenshotInput = document.getElementById("payScreenshot");
if (payScreenshotInput) {
    payScreenshotInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const scaleSize = 600 / img.width; 
                canvas.width = 600; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                document.getElementById("payScreenshotBase64").value = canvas.toDataURL("image/jpeg", 0.7);
            }
        }
    });
}

// Submit Application
async function submitVIP() {
    const payMode = document.querySelector('input[name="payMode"]:checked').value;
    const payId = document.getElementById("payId").value.trim();
    const screenshot = document.getElementById("payScreenshotBase64").value;

    if (payMode === 'online' && !payId && !screenshot) {
        alert("For Online Payment, please provide either a Transaction ID or upload a Screenshot.");
        return;
    }

    const btn = document.getElementById("btn-submit");
    btn.innerText = "Submitting Please Wait...";
    btn.disabled = true;

    const payload = {
        action: "submitVipApplication",
        user_id: localStorage.getItem("bhavya_user_id"),
        member1_name: document.getElementById("mem1Name").value,
        member2_name: document.getElementById("mem2Name").value.trim(),
        member3_name: document.getElementById("mem3Name").value.trim(),
        referrer_user_id: validReferrerId,
        payment_mode: payMode,
        payment_id: payId,
        payment_screenshot: screenshot,
        amount_paid: finalAmount
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === "success") {
            alert(result.message);
            window.location.reload(); // Page reload karne par apne aap 'Pending' screen aa jayegi
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Submission failed. Check your internet connection.");
    } finally {
        btn.innerText = "Submit Application";
        btn.disabled = false;
    }
}
