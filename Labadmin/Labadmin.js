// NOTE: APNA MAIN DEPLOYMENT URL YAHAN DAALEIN
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec";

const servicesList = [
    "pathology", "profile", "discount_profile", "usg", "xray", "ct", "mri", 
    "ecg", "echo", "tmt", "eeg", "pft", "holter", "abp", "ncv_emg", "ssep", 
    "evoked_potentiat", "sleep_study", "mammography", "dlco", "endoscopy", "colonoscopy"
];
const daysArr = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

let allLabsData = [];
let currentEditUid = null;
let pendingStdRequests = [];

document.addEventListener("DOMContentLoaded", () => {
    fetchLabs();
    fetchPendingRequests();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

function fetchLabs() {
    document.getElementById("loadingMsg").style.display = "block";
    document.getElementById("labsTableBody").innerHTML = "";

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getAdminLabs" }) })
    .then(res => res.json())
    .then(data => {
        document.getElementById("loadingMsg").style.display = "none";
        if(data.status === "success") { allLabsData = data.data; renderTable(); } 
        else { alert("Error fetching labs: " + data.message); }
    }).catch(err => { document.getElementById("loadingMsg").innerText = "Network Error!"; });
}

function renderTable() {
    const tbody = document.getElementById("labsTableBody");
    tbody.innerHTML = "";
    allLabsData.forEach((lab, index) => {
        let badgeClass = "status-inactive"; let statusText = lab.status.toUpperCase();
        if(statusText === "ACTIVE") badgeClass = "status-active";
        else if(statusText === "CANCEL") badgeClass = "status-cancel";

        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:600;">${lab.lab_name}</td>
            <td>${lab.email}</td>
            <td>${lab.city} - ${lab.pincode}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            <td><button class="btn-edit" onclick="openModal(${index})"><i class="fas fa-search"></i> Review Docs</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function openModal(index) {
    const lab = allLabsData[index];
    currentEditUid = lab.user_id;

    document.getElementById("modalLabName").innerText = lab.lab_name;
    document.getElementById("modalUid").innerText = lab.user_id;
    document.getElementById("modalEmail").innerText = lab.email;
    document.getElementById("modalAddress").innerText = lab.address || "N/A";
    document.getElementById("modalCityPin").innerText = lab.city + " - " + lab.pincode;

    const docsDiv = document.getElementById("modalDocs");
    docsDiv.innerHTML = "";
    if(lab.reg_doc_url) docsDiv.innerHTML += `<a href="${lab.reg_doc_url}" target="_blank" class="doc-link"><i class="fas fa-file-pdf"></i> Registration Doc</a>`;
    if(lab.nabl === "Yes" && lab.nabl_url) docsDiv.innerHTML += `<a href="${lab.nabl_url}" target="_blank" class="doc-link"><i class="fas fa-check-circle"></i> NABL Certificate</a>`;
    else docsDiv.innerHTML += `<div class="doc-none">NABL: No</div>`;
    if(lab.nabh === "Yes" && lab.nabh_url) docsDiv.innerHTML += `<a href="${lab.nabh_url}" target="_blank" class="doc-link"><i class="fas fa-check-circle"></i> NABH Certificate</a>`;
    else docsDiv.innerHTML += `<div class="doc-none">NABH: No</div>`;

    const imgDiv = document.getElementById("modalImages");
    imgDiv.innerHTML = "";
    if(lab.img1_url) imgDiv.innerHTML += `<a href="${lab.img1_url}" target="_blank" class="doc-link"><i class="fas fa-image"></i> Lab Image 1</a>`;
    else imgDiv.innerHTML += `<div class="doc-none">Image 1: None</div>`;
    if(lab.img2_url) imgDiv.innerHTML += `<a href="${lab.img2_url}" target="_blank" class="doc-link"><i class="fas fa-image"></i> Lab Image 2</a>`;
    if(lab.img3_url) imgDiv.innerHTML += `<a href="${lab.img3_url}" target="_blank" class="doc-link"><i class="fas fa-image"></i> Lab Image 3</a>`;

    const timeDiv = document.getElementById("modalTimings");
    timeDiv.innerHTML = "";
    daysArr.forEach(day => {
        let t = lab.timings[day];
        let isClosed = (t.open === "Closed" || !t.open || t.open === "");
        let text = isClosed ? "Closed" : `${t.open} to ${t.close}`;
        let cls = isClosed ? "time-card closed" : "time-card";
        timeDiv.innerHTML += `<div class="${cls}"><div class="time-day">${day}</div><div class="time-val">${text}</div></div>`;
    });

    const statusVal = lab.status.charAt(0).toUpperCase() + lab.status.slice(1).toLowerCase();
    let sel = document.getElementById("modalStatusSelect");
    sel.value = "Inactive"; 
    for(let i=0; i<sel.options.length; i++){ if(sel.options[i].value.toLowerCase() === statusVal.toLowerCase()){ sel.selectedIndex = i; break; } }

    const servicesGrid = document.getElementById("modalServicesGrid");
    servicesGrid.innerHTML = "";
    servicesList.forEach(srv => {
        let isChecked = lab.services[srv] === "Yes";
        let displayName = srv.replace("_", " ").toUpperCase();
        let label = document.createElement("label");
        label.innerHTML = `<input type="checkbox" id="admin_srv_${srv}" ${isChecked ? 'checked' : ''}> ${displayName}`;
        servicesGrid.appendChild(label);
    });

    document.getElementById("editModal").style.display = "flex";
}

function closeModal() { document.getElementById("editModal").style.display = "none"; currentEditUid = null; }

function saveLabDetails() {
    if(!currentEditUid) return;
    const btn = document.getElementById("saveBtn");
    btn.innerText = "Updating & Sending Email... Please wait"; btn.disabled = true;

    const updatedStatus = document.getElementById("modalStatusSelect").value;
    let updatedServices = {};
    servicesList.forEach(srv => { updatedServices[srv] = document.getElementById("admin_srv_" + srv).checked; });

    const payload = { action: "updateAdminLab", user_id: currentEditUid, status: updatedStatus, services: updatedServices };

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(data => {
        btn.innerText = "Update & Notify Lab"; btn.disabled = false;
        if(data.status === "success") { alert("Lab updated successfully!"); closeModal(); fetchLabs(); } 
        else { alert("Error: " + data.message); }
    }).catch(err => { btn.innerText = "Update & Notify Lab"; btn.disabled = false; alert("Network Error!"); });
}

function fetchPendingRequests() {
    document.getElementById("loadingReqMsg").style.display = "block";
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: "getPendingServiceRequests" }) })
    .then(res => res.json())
    .then(data => {
        document.getElementById("loadingReqMsg").style.display = "none";
        if(data.status === "success") {
            pendingStdRequests = data.data.standard;
            
            if(pendingStdRequests.length > 0) {
                document.getElementById("reqBadge").style.display = "inline-block";
            } else {
                document.getElementById("reqBadge").style.display = "none";
            }
            renderStdRequests();
        }
    }).catch(err => { document.getElementById("loadingReqMsg").innerText = "Error loading requests!"; });
}

function renderStdRequests() {
    const tbody = document.getElementById("stdReqTableBody");
    tbody.innerHTML = "";
    if(pendingStdRequests.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; color:#64748b;'>No pending standard service requests.</td></tr>";
        return;
    }

    pendingStdRequests.forEach((req, index) => {
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td><b>${req.lab_name}</b><br><small style="color:#64748b;">${req.user_id}</small></td>
            <td><textarea id="req_json_${req.user_id}" style="width:100%; height:80px; font-size:13px; font-family: monospace; border:1px solid #cbd5e1; border-radius:4px; padding:5px;">${req.requested_services}</textarea></td>
            <td>
                <button class="btn-approve" onclick="handleStdReq('${req.user_id}', 'Approve')"><i class="fas fa-check"></i> Approve</button>
                <button class="btn-reject" style="margin-top:5px;" onclick="handleStdReq('${req.user_id}', 'Reject')"><i class="fas fa-times"></i> Reject</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleStdReq(userId, actionType) {
    if(!confirm(`Are you sure you want to ${actionType.toUpperCase()} this update request?`)) return;
    
    let modifiedJson = "";
    if (actionType === 'Approve') {
        modifiedJson = document.getElementById(`req_json_${userId}`).value;
        try {
            JSON.parse(modifiedJson); 
        } catch (e) {
            alert("Invalid JSON format! Please check if any commas or quotes (\") are missing.");
            return;
        }
    }

    document.body.style.opacity = "0.7"; document.body.style.pointerEvents = "none";
    
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: "processStandardServiceRequest", 
            user_id: userId, 
            request_action: actionType,
            modified_json: modifiedJson 
        })
    }).then(res => res.json()).then(data => {
        alert(data.message);
        fetchPendingRequests(); 
        fetchLabs(); 
    }).finally(() => { document.body.style.opacity = "1"; document.body.style.pointerEvents = "auto"; });
}
