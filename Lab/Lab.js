// ==========================================
// Lab.gs - LAB LOGIN & REGISTRATION LOGIC
// ==========================================

function processLabLogin(data) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("labs_login");
    if (!sheet) return { status: "error", message: "labs_login sheet not found!" };

    var uid = data.uid;
    var mobile = data.mobile;
    var labName = data.name;

    var dataRange = sheet.getDataRange().getValues();
    
    // 1. Check if Lab is already registered (Old Lab Login)
    for (var i = 1; i < dataRange.length; i++) {
      if (dataRange[i][2] === uid) { // Column C (index 2) mein UID check
        
        // Update last login timestamp in Column A
        sheet.getRange(i + 1, 1).setValue(new Date());
        
        return {
          status: "success",
          message: "Lab login successful",
          user_id: dataRange[i][1], // Lab ID (e.g., ABC1234 (Test Lab))
          role: "lab",
          name: dataRange[i][4]     // Lab Name
        };
      }
    }

    // 2. Nayi Lab Registration (Agar UID nahi mila)
    // Lab ID Generation: First 3 letters + 4 random numbers + (Lab Name)
    var nameStr = (labName || "LAB").trim();
    var prefix = nameStr.length >= 3 ? nameStr.substring(0, 3).toUpperCase() : (nameStr + "XXX").substring(0, 3).toUpperCase();
    var randomNum = Math.floor(1000 + Math.random() * 9000); // Generates 4 digit random number
    var pureLabId = prefix + randomNum;
    var displayLabId = pureLabId + " (" + nameStr + ")";
    
    var timestamp = new Date();
    var role = "lab";

    // Sheet mein row append karna: timestamp, Lab ID, udi, mobile_number, lab_name, role
    sheet.appendRow([timestamp, displayLabId, uid, mobile, nameStr, role]);

    return {
      status: "success",
      message: "Lab registered successfully",
      user_id: displayLabId,
      role: "lab",
      name: nameStr
    };

  } catch (error) {
    return { status: "error", message: "Lab Login Error: " + error.message };
  }
}
