// 🌟 APNA SAME GOOGLE SCRIPT URL YAHAN DAALO 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8cnaQLCDP6OaZ2vOyl9Oy8HWICc9nigQChCSpMpAeUOwJ4xijq5L1iPX1CJhPAo4W0w/exec";

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
                tableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>No patients found in the system yet.</td></tr>";
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
                        <td>${patient.timestamp.split(" ")[0]}</td>
                        <td><strong>${patient.user_id}</strong></td>
                        <td>${patient.patient_name}</td>
                        <td>${patient.mobile_number}</td>
                        <td>${patient.referral_code}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${patient.wallet}</td>
                        <td style="text-transform: capitalize;">${patient.plan}</td>
                        
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
