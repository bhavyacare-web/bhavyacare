// 🌟 APNA SAME GOOGLE SCRIPT URL YAHAN DAALO 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFX5MRGW1XRhVVO1ABuKS8wi2lcN7PCcyNddHfzv407eZ6TyeWOesIf-FIbbTKu882vg/exec";

document.addEventListener("DOMContentLoaded", fetchPatientsData);

async function fetchPatientsData() {
    const tableBody = document.getElementById("patientsTableBody");
    const loader = document.getElementById("loader");
    
    tableBody.innerHTML = ""; 
    loader.style.display = "block"; 

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
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
                // Withdraw Toggle Logic
                const withdrawClass = patient.withdraw.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const withdrawText = patient.withdraw.toLowerCase() === 'active' ? 'Active 🟢' : 'Inactive 🔴';
                
                // Status Toggle Logic
                const statusClass = patient.status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                const statusText = patient.status.toLowerCase() === 'active' ? 'Active 🟢' : 'Blocked 🔴';
                
                const row = `
                    <tr>
                        <td style="text-align: center;">
                            <img src="${patient.image}" class="patient-img" alt="Pic">
                        </td>
                        
                        <td><span style="font-size: 12px; color: #555;">${patient.timestamp.split(" ")[0]}</span></td>
                        <td><strong>${patient.user_id}</strong><br><span style="font-size: 11px; color: #888;">Ref: ${patient.referral_code}</span></td>
                        <td style="font-weight: bold; color: #333;">${patient.patient_name}</td>
                        
                        <td>
                            <div style="font-weight: bold;">📞 ${patient.mobile_number}</div>
                            <div style="font-size: 11px; color: #555;">📧 ${patient.email}</div>
                        </td>
                        
                        <td style="max-width: 250px; font-size: 12px; line-height: 1.4;">${patient.address}</td>
                        
                        <td style="font-weight: bold; color: #28a745;">₹${patient.wallet}</td>
                        <td style="text-transform: capitalize; font-weight: bold;">${patient.plan}</td>
                        
                        <td>
                            <button class="badge-btn ${withdrawClass}" onclick="toggleStatus('${patient.user_id}', 'withdraw', '${patient.withdraw}')">
                                ${withdrawText}
                            </button>
                        </td>
                        
                        <td>
                            <button class="badge-btn ${statusClass}" onclick="toggleStatus('${patient.user_id}', 'status', '${patient.status}')">
                                ${statusText}
                            </button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } else {
            loader.innerHTML = "❌ Error loading data: " + result.message;
        }
    } catch (error) {
        loader.innerHTML = "❌ Network Error! Failed to fetch data.";
    }
}

// 🌟 NAYA FUNCTION: STATUS CHANGE KARNE KE LIYE 🌟
async function toggleStatus(userId, field, currentStatus) {
    // Agar active hai toh inactive karega, aur inactive hai toh active
    const newValue = currentStatus.toLowerCase() === "active" ? "inactive" : "active";
    
    // Admin se confirmation lena
    const confirmMsg = `Are you sure you want to make ${field.toUpperCase()} '${newValue}' for user ${userId}?`;
    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                action: "updatePatient", 
                target_user_id: userId, 
                field: field, 
                value: newValue 
            }) 
        });

        const result = await response.json();
        if (result.status === "success") {
            // Data update hone ke baad table refresh kar do
            fetchPatientsData();
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        alert("Failed to update status. Check your connection.");
    }
}
