// ==========================================
// Labadmin.gs - FOR ADMIN PANEL ONLY
// ==========================================

// 1. SAARI LABS KA DATA LANA
function getAdminLabs() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("labs");
    if (!sheet) return sendResponse("error", "labs sheet not found!");

    var dataRange = sheet.getDataRange().getValues();
    var labsList = [];
    
    // Services ki list jo humne form me di thi (Column 12 se 33 tak hain)
    var servicesKeys = [
        "pathology", "profile", "discount_profile", "usg", "xray", "ct", "mri", 
        "ecg", "echo", "tmt", "eeg", "pft", "holter", "abp", "ncv_emg", "ssep", 
        "evoked_potentiat", "sleep_study", "mammography", "dlco", "endoscopy", "colonoscopy"
    ];

    // Header chhod kar row 1 se padhna shuru karenge
    for (var i = 1; i < dataRange.length; i++) {
      var row = dataRange[i];
      if (!row[0]) continue; // Agar UID khali hai toh skip karo

      // Object banana UI ke liye
      var labData = {
        user_id: row[0],
        lab_name: row[1],
        email: row[3],
        city: row[5],
        pincode: row[6],
        status: row[51] ? row[51].toString().trim() : "Inactive", // Column 51 me status hai
        services: {}
      };

      // Services ka data nikalna (Col 12 se shuru hai)
      for(var s = 0; s < servicesKeys.length; s++) {
        labData.services[servicesKeys[s]] = row[12 + s]; // "Yes" ya "No" aayega
      }

      labsList.push(labData);
    }

    return sendResponse("success", labsList);

  } catch (error) {
    return sendResponse("error", "Error fetching labs: " + error.message);
  }
}

// 2. LAB KA STATUS AUR SERVICES UPDATE KARNA
function updateAdminLab(data) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("labs");
    if (!sheet) return sendResponse("error", "labs sheet not found!");

    var uid = data.user_id;
    var newStatus = data.status;
    var updatedServices = data.services; // Frontend se JSON aayega

    var dataRange = sheet.getDataRange().getValues();
    var rowIndex = -1;

    // Find the lab row
    for (var i = 1; i < dataRange.length; i++) {
      if (dataRange[i][0] === uid) {
        rowIndex = i + 1; // +1 kyunki sheet me index 1 se start hota hai
        break;
      }
    }

    if (rowIndex === -1) return sendResponse("error", "Lab not found in database.");

    // Update Status (Column AZ - index 52 in sheet terms, index 51 in JS)
    sheet.getRange(rowIndex, 52).setValue(newStatus);

    // Update Services (Column 13 to 34 in sheet terms)
    var servicesKeys = [
        "pathology", "profile", "discount_profile", "usg", "xray", "ct", "mri", 
        "ecg", "echo", "tmt", "eeg", "pft", "holter", "abp", "ncv_emg", "ssep", 
        "evoked_potentiat", "sleep_study", "mammography", "dlco", "endoscopy", "colonoscopy"
    ];

    for(var s = 0; s < servicesKeys.length; s++) {
      var srvKey = servicesKeys[s];
      // Updated value set karna (Yes/No)
      var val = updatedServices[srvKey] ? "Yes" : "No";
      sheet.getRange(rowIndex, 13 + s).setValue(val);
    }

    return sendResponse("success", "Lab Profile updated successfully!");

  } catch (error) {
    return sendResponse("error", "Error updating lab: " + error.message);
  }
}
