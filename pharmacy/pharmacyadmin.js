const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

let pharmacyData = [];
let currentSelectedId = null;

document.addEventListener("DOMContentLoaded", () => {
    fetchPharmacies();
});

function fetchPharmacies() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = `<tr><td colspan="5" id="loader"><i class="fas fa-spinner fa-spin"></i> Loading data...</td></tr>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getAdminPharmacies" })
    })
    .then(res => res.json())
    .then(resData => {
        pharmacyData = resData.data.data || [];
        renderTable();
    })
    .catch(err => {
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error loading data.</td></tr>`;
        console.error(err);
    });
}

function renderTable() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (pharmacyData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No pharmacies registered yet.</td></tr>`;
        return;
    }

    pharmacyData.forEach(pharma => {
        let badgeClass = "bg-pending";
        if (pharma.status === "ACTIVE") badgeClass = "bg-active";
        if (pharma.status === "REJECTED") badgeClass = "bg-rejected";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${pharma.pharmacy_id}</strong></td>
            <td>${pharma.pharmacy_name}</td>
            <td>${pharma.city} (${pharma.pincode})</td>
            <td><span class="badge ${badgeClass}">${pharma.status}</span></td>
            <td>
                <button class="btn btn-view" onclick="viewDetails('${pharma.pharmacy_id}')">View Details</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewDetails(id) {
    const pharma = pharmacyData.find(p => p.pharmacy_id === id);
    if (!pharma) return;
    
    currentSelectedId = id;

    document.getElementById("m_name").innerText = pharma.pharmacy_name;
    document.getElementById("m_id").innerText = "ID: " + pharma.pharmacy_id;
    document.getElementById("m_email").innerText = pharma.email;
    document.getElementById("m_location").innerText = `${pharma.address}, ${pharma.city} - ${pharma.pincode}`;
    document.getElementById("m_cities").innerText = pharma.available_city;
    
    // Clean up pincode array display
    let pincodeArr = [];
    try { pincodeArr = JSON.parse(pharma.available_pincode); } catch(e) { pincodeArr = [pharma.available_pincode]; }
    document.getElementById("m_pincodes").innerText = pincodeArr.join(", ");

    // Timings
    const t = pharma.timings;
    document.getElementById("m_timings").innerHTML = `
        <b>Mon:</b> ${t.monday} &nbsp;|&nbsp; <b>Tue:</b> ${t.tuesday} &nbsp;|&nbsp; <b>Wed:</b> ${t.wednesday} <br>
        <b>Thu:</b> ${t.thursday} &nbsp;|&nbsp; <b>Fri:</b> ${t.friday} &nbsp;|&nbsp; <b>Sat:</b> ${t.saturday} <br>
        <b>Sun:</b> ${t.sunday}
    `;

    // Documents
    let docsHtml = "";
    if (pharma.doc1) docsHtml += `<a href="${pharma.doc1}" target="_blank"><i class="fas fa-file-pdf"></i> Reg Doc 1</a>`;
    if (pharma.doc2) docsHtml += `<a href="${pharma.doc2}" target="_blank"><i class="fas fa-file-pdf"></i> Reg Doc 2</a>`;
    if (pharma.img1) docsHtml += `<a href="${pharma.img1}" target="_blank"><i class="fas fa-image"></i> Store Image 1</a>`;
    if (pharma.img2) docsHtml += `<a href="${pharma.img2}" target="_blank"><i class="fas fa-image"></i> Store Image 2</a>`;
    document.getElementById("m_docs").innerHTML = docsHtml || "No documents uploaded.";

    // Action Buttons Logic
    const btnApprove = document.getElementById("btnApprove");
    const btnReject = document.getElementById("btnReject");
    
    // Remove old listeners to avoid multiple fires
    btnApprove.replaceWith(btnApprove.cloneNode(true));
    btnReject.replaceWith(btnReject.cloneNode(true));
    
    document.getElementById("btnApprove").addEventListener("click", () => changeStatus('ACTIVE'));
    document.getElementById("btnReject").addEventListener("click", () => changeStatus('REJECTED'));

    if(pharma.status === "ACTIVE") {
        document.getElementById("btnApprove").style.display = "none";
        document.getElementById("btnReject").style.display = "block";
    } else if(pharma.status === "REJECTED") {
        document.getElementById("btnApprove").style.display = "block";
        document.getElementById("btnReject").style.display = "none";
    } else {
        document.getElementById("btnApprove").style.display = "block";
        document.getElementById("btnReject").style.display = "block";
    }

    document.getElementById("detailModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("detailModal").style.display = "none";
}

function changeStatus(newStatus) {
    if (!currentSelectedId) return;
    if (!confirm(`Are you sure you want to mark this pharmacy as ${newStatus}?`)) return;

    const btnAction = document.getElementById("actionButtons");
    const originalBtns = btnAction.innerHTML;
    btnAction.innerHTML = `<p style="color: #2563eb; font-weight: bold;"><i class="fas fa-spinner fa-spin"></i> Updating status & sending email...</p>`;

    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ 
            action: "updatePharmacyStatus", 
            pharmacy_id: currentSelectedId, 
            new_status: newStatus 
        })
    })
    .then(res => res.json())
    .then(resData => {
        if(resData.status === "success") {
            alert("Status updated successfully!");
            closeModal();
            fetchPharmacies(); // Refresh table
        } else {
            alert("Error: " + resData.message);
            btnAction.innerHTML = originalBtns;
        }
    })
    .catch(err => {
        console.error(err);
        alert("Network error occurred.");
        btnAction.innerHTML = originalBtns;
    });
}
