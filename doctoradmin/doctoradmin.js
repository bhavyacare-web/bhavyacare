// Apni wahi purani web app URL yahan dalein
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

window.onload = function() {
    fetchDoctors();
};

async function fetchDoctors() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getAdminDoctors" })
        });
        
        const resData = await response.json();
        if (resData.status === "success") {
            renderTable(resData.data);
        } else {
            alert("Error loading data: " + resData.message);
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        alert("System error loading data.");
    }
}

function renderTable(doctors) {
    const tbody = document.getElementById("doctorsBody");
    tbody.innerHTML = "";
    
    document.getElementById("loader").style.display = "none";
    document.getElementById("doctorsTable").style.display = "table";

    doctors.forEach(doc => {
        let actionButtons = "";
        
        // Agar pehle se active nahi hai, toh Approve/Reject button dikhao
        if (doc.status !== "Active") {
            actionButtons = `
                <button class="btn btn-approve" onclick="updateStatus('${doc.doctor_id}', 'Active')">✔ Approve</button>
                <button class="btn btn-reject" onclick="updateStatus('${doc.doctor_id}', 'Rejected')">✖ Reject</button>
            `;
        } else {
            actionButtons = `<button class="btn btn-reject" onclick="updateStatus('${doc.doctor_id}', 'Inactive')">Deactivate</button>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img src="${doc.imgUrl}" alt="Profile" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #ccc;"></td>
            <td style="font-weight: bold; color: #555;">${doc.doctor_id}</td>
            <td>
                <strong>${doc.doctor_name}</strong><br>
                <span style="font-size: 12px; color: #777;">${doc.speciality}</span>
            </td>
            <td>${doc.clinic_name}, ${doc.city}</td>
            <td><a href="${doc.docUrl}" target="_blank" class="btn btn-view">📄 View Doc</a></td>
            <td><span class="status-badge status-${doc.status}">${doc.status}</span></td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateStatus(docId, newStatus) {
    let reason = "";
    
    if (newStatus === "Rejected") {
        reason = prompt("Please enter the reason for rejection (This will be emailed to the doctor):");
        if (reason === null || reason.trim() === "") {
            alert("Action cancelled. Reason is mandatory for rejection!");
            return;
        }
    } else {
        if (!confirm(`Are you sure you want to mark ${docId} as ${newStatus}?`)) return;
    }
    
    document.body.style.opacity = "0.6";

    try {
        const payload = {
            action: "updateAdminDoctorStatus",
            doctor_id: docId,
            status: newStatus,
            reason: reason // Frontend se reason bheja
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        
        if (resData.status === "success") {
            alert("Success! " + resData.message);
            fetchDoctors();
        } else {
            alert("Error: " + resData.message);
        }
    } catch (error) {
        console.error("Update Error:", error);
        alert("System error updating status.");
    } finally {
        document.body.style.opacity = "1";
    }
}
