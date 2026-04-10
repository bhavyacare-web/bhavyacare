const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 
let isUserVip = false;
let globalBookingsData = [];

document.addEventListener("DOMContentLoaded", checkLoginAndFetchData);

async function checkLoginAndFetchData() {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) { alert("Please login first to access the dashboard."); window.location.href = "../index.html"; return; }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientProfile", user_id: userId }) 
        });

        const result = await response.json();

        if (result.status === "success") {
            const patient = result.data;
            
            safeSetText("userNameMobile", patient.patient_name);
            safeSetText("userNameDesktop", patient.patient_name);
            safeSetText("userIdDisplay", "ID: " + patient.user_id);
            safeSetText("walletBal", patient.wallet || "0");
            safeSetText("refCode", patient.referral_code || "-----");
            safeSetText("infoName", patient.patient_name);
            safeSetText("infoMobile", patient.mobile_number);

            if (patient.withdraw && patient.withdraw.toLowerCase() === 'active') {
                document.getElementById('btn-withdraw').style.display = 'block';
            } else {
                document.getElementById('btn-withdraw').style.display = 'none';
            }

            const planName = patient.plan ? patient.plan.toLowerCase() : "basic";
            isUserVip = (planName === "vip"); 
            safeSetText("vipStatus", patient.plan ? patient.plan.toUpperCase() : "BASIC");
            
            const vipBtn = document.getElementById("btn-vip-action");
            const vipSubText = document.getElementById("vipSubText");
            const vipAlert = document.getElementById("vipPackageAlert");

            if (isUserVip) {
                if (vipBtn) vipBtn.style.display = "none";
                if (vipSubText) vipSubText.innerHTML = "Enjoying VIP Benefits ✨ <br><small style='color:#0056b3;'>Click card to view details</small>"; 
                
                if (patient.vip_package_status === "pending") {
                    if (vipAlert) vipAlert.style.display = "block";
                    document.getElementById("notifDot").style.display = "block";
                } else {
                    if (vipAlert) vipAlert.style.display = "none";
                    document.getElementById("notifDot").style.display = "none";
                }

                if (patient.vip_details) {
                    safeSetText("vd-start", patient.vip_details.start_date || "N/A");
                    safeSetText("vd-end", patient.vip_details.end_date || "N/A");
                    document.getElementById("vd-mem1").innerHTML = `<span><strong>${patient.vip_details.member1_name || 'N/A'}</strong> <br><small style="color:#888;">(Self)</small></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member1_id || '-'}</span>`;
                    
                    if (patient.vip_details.member2_name) {
                        document.getElementById("vd-mem2").innerHTML = `<span><strong>${patient.vip_details.member2_name}</strong></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member2_id || '-'}</span>`;
                        document.getElementById("vd-mem2").style.display = "flex";
                    } else { document.getElementById("vd-mem2").style.display = "none"; }

                    if (patient.vip_details.member3_name) {
                        document.getElementById("vd-mem3").innerHTML = `<span><strong>${patient.vip_details.member3_name}</strong></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member3_id || '-'}</span>`;
                        document.getElementById("vd-mem3").style.display = "flex";
                    } else { document.getElementById("vd-mem3").style.display = "none"; }
                }
            } else {
                if (vipBtn) vipBtn.style.display = "block";
                if (vipSubText) vipSubText.innerText = "Upgrade for free home collection";
                if (vipAlert) vipAlert.style.display = "none";
                document.getElementById("notifDot").style.display = "none";
            }
            
            const banner = document.getElementById("profileBanner");
            const profileImages = document.querySelectorAll(".profile-img");
            const editPreview = document.getElementById("editProfilePreview");
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.patient_name)}&background=e6f0fa&color=0056b3&bold=true`;

            if (patient.extra_details) {
                if (banner) banner.style.display = "none";
                safeSetValue("infoEmail", patient.extra_details.email);
                safeSetValue("infoAddress", patient.extra_details.address);
                safeSetValue("infoCity", patient.extra_details.city);
                safeSetValue("infoDistrict", patient.extra_details.district);
                safeSetValue("infoState", patient.extra_details.state);
                safeSetValue("infoPincode", patient.extra_details.pincode);
                
                if (patient.extra_details.image && patient.extra_details.image.startsWith("data:image")) {
                    profileImages.forEach(img => img.src = patient.extra_details.image);
                    if(editPreview) editPreview.src = patient.extra_details.image;
                    document.getElementById("mobileProfileImg").src = patient.extra_details.image;
                    document.getElementById("desktopProfileImg").src = patient.extra_details.image;
                } else {
                    profileImages.forEach(img => img.src = fallbackUrl);
                    if(editPreview) editPreview.src = fallbackUrl;
                }
            } else {
                if (banner) banner.style.display = "block"; 
                profileImages.forEach(img => img.src = fallbackUrl);
                if(editPreview) editPreview.src = fallbackUrl;
            }

            fetchWalletHistory(userId);
            fetchPatientBookings(userId);

        } else {
            alert("Error: " + result.message);
            if(result.message === "Your account is blocked by Admin.") logoutDashboard();
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

function handleVipCardClick() {
    if (isUserVip) { document.getElementById('vip-details-modal').style.display = 'block'; } else { window.location.href = '../vip/vip_member.html'; }
}

function safeSetText(id, text) { const el = document.getElementById(id); if(el) el.innerText = text; }
function safeSetValue(id, val) { const el = document.getElementById(id); if(el && val) el.value = val; }

function switchTab(tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
    const links = document.querySelectorAll(".nav-item, .nav-links a");
    links.forEach(link => link.classList.remove("active"));
    const selectedTab = document.getElementById(tabId);
    if(selectedTab) selectedTab.classList.add("active");
    if(typeof event !== 'undefined' && event && event.currentTarget) { event.currentTarget.classList.add("active"); } 
    else { const activeNav = document.querySelector(`[onclick="switchTab('${tabId}')"]`); if(activeNav) activeNav.classList.add("active"); }
}

function logoutDashboard() { localStorage.clear(); window.location.href = "../index.html"; }

function copyMyReferral() {
    const code = document.getElementById("refCode").innerText;
    if (code && code !== "-----") { navigator.clipboard.writeText(code); alert("Referral Code '" + code + "' copied!"); }
}

const fileInput = document.getElementById("profileImageInput");
if(fileInput) {
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const scaleSize = 200 / img.width;
                canvas.width = 200; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6); 
                document.getElementById("editProfilePreview").src = compressedBase64;
                document.getElementById("infoImageBase64").value = compressedBase64;
            }
        }
    })
}

async function savePatientProfile() {
    const btn = document.getElementById("btnSaveProfile");
    btn.innerText = "Saving Please Wait..."; btn.disabled = true;
    
    const payload = {
        action: "savePatientDetails", user_id: localStorage.getItem("bhavya_user_id"),
        email: document.getElementById("infoEmail").value, address: document.getElementById("infoAddress").value,
        city: document.getElementById("infoCity").value, district: document.getElementById("infoDistrict").value,
        state: document.getElementById("infoState").value, pincode: document.getElementById("infoPincode").value,
        image: document.getElementById("infoImageBase64").value
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.status === "success") { alert("Profile Details Saved Successfully!"); checkLoginAndFetchData(); switchTab('overview'); } 
        else { alert("Error: " + result.message); }
    } catch (error) { alert("Failed to save. Check your connection."); } 
    finally { btn.innerText = "Save & Update Profile"; btn.disabled = false; }
}

async function fetchWalletHistory(userId) {
    const container = document.getElementById("walletHistoryContainer");
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getWalletHistory", user_id: userId })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            const history = result.data;
            if (history.length === 0) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-receipt" style="font-size: 40px; margin-bottom: 15px;"></i><p>No recent transactions.</p></div>`;
                return;
            }
            let html = "";
            history.forEach(txn => {
                const isCredit = txn.type.toLowerCase() === 'credit';
                const color = isCredit ? '#2e7d32' : '#d32f2f';
                const sign = isCredit ? '+' : '-';
                html += `
                <div class="list-item" style="align-items: flex-start;">
                    <div class="list-info">
                        <h5 style="margin-bottom: 3px;">${txn.description}</h5>
                        <p><i class="far fa-clock"></i> ${txn.date}</p>
                    </div>
                    <div style="font-weight: 800; color: ${color}; font-size: 16px; margin-top: 2px;">
                        ${sign}₹${txn.amount}
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="color:red; text-align:center;">Failed: ${result.message}</p>`;
        }
    } catch(e) {
        console.error("Wallet Fetch Error:", e);
        container.innerHTML = `<p style="color:red; text-align:center;">Network error.</p>`;
    }
}

// ===============================================
// 🌟 BOOKINGS, FILTERS & REPORTS LOGIC 🌟
// ===============================================
async function fetchPatientBookings(userId) {
    const reportsTab = document.getElementById("reportsTabContainer");
    const recentActivityContainer = document.getElementById("recentActivityContainer");
    
    // Loaders
    const loaderReports = `<div class="section-title">Medical Records</div><div style="text-align: center; padding: 50px 20px; color: var(--success);"><i class="fas fa-circle-notch fa-spin" style="font-size: 40px; margin-bottom: 15px;"></i><p style="color: #888; font-size: 14px; font-weight: bold;">Loading reports...</p></div>`;
    const loaderSmall = `<div style="text-align: center; padding: 30px 10px; color: var(--primary);"><i class="fas fa-spinner fa-pulse" style="font-size: 24px; margin-bottom: 10px;"></i><p style="color: #888; font-size: 12px; font-weight: bold;">Syncing activity...</p></div>`;

    if(reportsTab) reportsTab.innerHTML = loaderReports;
    if(recentActivityContainer) recentActivityContainer.innerHTML = loaderSmall;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientBookings", user_id: userId })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            globalBookingsData = result.data;
            processDashboardData(globalBookingsData); 
            renderBookingCards(globalBookingsData);   
        } else {
            document.getElementById("patientBookingsContainer").innerHTML = `<p style="color:red; text-align:center;">Failed to load data: ${result.message}</p>`;
        }
    } catch(e) { 
        document.getElementById("patientBookingsContainer").innerHTML = `<p style="color:red; text-align:center;">Network error. Please check your connection.</p>`;
    }
}

// 🌟 NAYA: FILTER FUNCTIONS 🌟
function clearBookingFilters() {
    document.getElementById("searchBookingText").value = "";
    document.getElementById("searchBookingDate").value = "";
    renderBookingCards(globalBookingsData);
}

function filterMyBookings() {
    const searchText = document.getElementById("searchBookingText").value.toLowerCase().trim();
    const searchDate = document.getElementById("searchBookingDate").value; 

    const filtered = globalBookingsData.filter(bk => {
        let matchText = true;
        if (searchText !== "") {
            const labName = (bk.lab_id || "").toLowerCase();
            const orderId = (bk.order_id || "").toLowerCase();
            let testNames = "";
            try {
                let items = JSON.parse(bk.cart_items);
                if(!Array.isArray(items)) items = [items];
                testNames = items.map(i => (i.service_name || i.name || "")).join(" ").toLowerCase();
            } catch(e) { testNames = (bk.cart_items || "").toLowerCase(); }
            
            matchText = labName.includes(searchText) || testNames.includes(searchText) || orderId.includes(searchText);
        }

        let matchDate = true;
        if (searchDate !== "") {
            const [year, month, day] = searchDate.split("-");
            const formattedSearch = `${day}-${month}-${year}`;
            matchDate = (bk.date || "").includes(formattedSearch);
        }
        return matchText && matchDate;
    });

    renderBookingCards(filtered);
}

// 🌟 SPLIT LOGIC 1: Overview & Reports Tab 🌟
function processDashboardData(bookings) {
    const reportsTab = document.getElementById("reportsTabContainer");
    const recentContainer = document.getElementById("recentActivityContainer");
    
    let reportsHtml = `<div class="section-title">Medical Records</div>`;
    let recentHtml = "";
    let hasReports = false;

    bookings.forEach((bk, index) => {
        let safeStatus = (bk.status || "pending").toString().toLowerCase().trim();
        let isComplete = (safeStatus.includes("complete") || safeStatus === "completed");

        // --- RECENT ACTIVITY (Top 3) ---
        if (index < 3) {
            let badgeClass = "status-warning"; let statusText = "Pending";
            if (safeStatus.includes("confirm")) { badgeClass = "status-primary"; statusText = "Confirmed"; } 
            else if (isComplete) { badgeClass = "status-success"; statusText = "Completed"; } 
            else if (safeStatus.includes("cancel")) { badgeClass = "status-danger"; statusText = "Cancelled"; }

            let testSummary = "Unknown Test";
            try {
                let items = JSON.parse(bk.cart_items);
                if(!Array.isArray(items)) items = [items];
                testSummary = items.map(i => (i.service_name || i.name || "")).join(", ");
            } catch(e) { testSummary = bk.cart_items || "Unknown Test"; }

            recentHtml += `
            <div class="list-item">
                <div class="list-info">
                    <h5 style="font-size:14px; margin-bottom:3px;">${testSummary.substring(0, 35)}${testSummary.length > 35 ? '...' : ''}</h5>
                    <p style="color:var(--primary); font-weight:bold; font-size:11px;"><i class="far fa-clock"></i> ${bk.slot}</p>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${badgeClass}">${statusText}</span>
                </div>
            </div>`;
        }

        // --- REPORTS TAB RENDER (Multiple PDFs) ---
        let onlinePdfArr = [];
        if (bk.report_pdf) {
            try { 
                onlinePdfArr = JSON.parse(bk.report_pdf); 
                if(!Array.isArray(onlinePdfArr)) onlinePdfArr = [bk.report_pdf];
            } catch(e) { onlinePdfArr = [bk.report_pdf]; }
        }

        if (isComplete && onlinePdfArr.length > 0) {
            hasReports = true;
            let linksHtml = "";
            onlinePdfArr.forEach((url, i) => {
                if(url.trim() !== "") {
                    linksHtml += `<a href="${url}" target="_blank" style="display:block; text-align:center; background:#e8f5e9; color:#2e7d32; padding:8px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px; margin-top:8px;"><i class="fas fa-cloud-download-alt"></i> Download Report ${i+1}</a>`;
                }
            });

            reportsHtml += `
            <div style="background:#fff; border:1px solid #e0e6ed; border-left: 4px solid var(--success); border-radius:8px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between;">
                    <h5 style="margin:0 0 5px 0; font-size:15px; color:var(--text-main);"><i class="fas fa-file-medical" style="color:var(--success);"></i> Order #${bk.order_id}</h5>
                    <span style="font-size:11px; color:var(--primary); font-weight:bold;">${bk.slot}</span>
                </div>
                <div style="font-size:12px; color:var(--text-light); margin-bottom:5px; line-height:1.5;">
                    <strong>Patient:</strong> ${bk.patient_name} <br>
                    <strong><span style="color:var(--text-main);">Lab: ${bk.lab_id ? bk.lab_id.split('(')[0].trim() : 'N/A'}</span></strong>
                </div>
                ${linksHtml}
            </div>`;
        }
    });

    if (!hasReports) reportsHtml += `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 15px;"></i><p>Reports will appear here once ready.</p></div>`;
    if (recentHtml === "") recentHtml = `<div style="text-align: center; padding: 20px; color: #aaa;">No recent activities.</div>`;

    if(reportsTab) reportsTab.innerHTML = reportsHtml;
    if(recentContainer) recentContainer.innerHTML = recentHtml;
}

// 🌟 SPLIT LOGIC 2: Render Booking Cards (With Filter Support) 🌟
function renderBookingCards(bookings) {
    const container = document.getElementById("patientBookingsContainer");
    if (!container) return;

    if (bookings.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 15px;"></i><p>No bookings found matching your search.</p></div>`;
        return;
    }

    let cardsHtml = "";
    bookings.forEach(bk => {
        let testsListHtml = "";
        let items = [];
        let rawCart = bk.cart_items;
        
        if (typeof rawCart === 'string') {
            try { rawCart = JSON.parse(rawCart); } catch(e) {}
            if (typeof rawCart === 'string') { try { rawCart = JSON.parse(rawCart); } catch(e) {} }
        }

        if (Array.isArray(rawCart)) { items = rawCart; } 
        else if (typeof rawCart === 'object' && rawCart !== null) { items = rawCart.items || rawCart.cart || [rawCart]; } 
        else if (typeof rawCart === 'string' && rawCart.trim() !== "") { items = [{ service_name: rawCart }]; }

        if (items.length > 0) {
            testsListHtml = `<ul style="margin: 8px 0; padding-left: 20px; font-size: 13px; color: #333;">`;
            items.forEach(item => {
                let tName = "Unknown Test"; let tPrice = "";
                if (typeof item === 'object' && item !== null) {
                    tName = item.service_name || item.test_name || item.name || item.title || "Unknown Test";
                    tPrice = item.price ? ` <span style="color:#888; font-size:11px;">(₹${item.price})</span>` : '';
                } else if (typeof item === 'string') { tName = item; }
                testsListHtml += `<li style="margin-bottom:4px;"><strong>${tName}</strong>${tPrice}</li>`;
            });
            testsListHtml += `</ul>`;
        } else {
            testsListHtml = `<p style="margin: 8px 0; font-size: 12px; color:#888;">No test details found.</p>`;
        }

        let safeStatus = (bk.status || "pending").toString().toLowerCase().trim();
        let safePayStatus = (bk.payment_status || "due").toString().toLowerCase().trim();
        let badgeClass = "status-warning"; let statusText = "Pending";
        let isComplete = false;

        if (safeStatus.includes("confirm")) { badgeClass = "status-primary"; statusText = "Confirmed"; } 
        else if (safeStatus.includes("complete") || safeStatus === "completed") { badgeClass = "status-success"; statusText = "Completed"; isComplete = true; } 
        else if (safeStatus.includes("cancel")) { badgeClass = "status-danger"; statusText = "Cancelled"; }

        let modeDisplay = (bk.fulfillment && bk.fulfillment.toLowerCase().includes('home')) ? "Home Collection" : "Lab Visit";

        let payStatus = (safePayStatus.includes("complete")) ? "COMPLETE" : "DUE";
        let payColor = (payStatus === "COMPLETE") ? "#2e7d32" : "#d32f2f";
        let payBg = (payStatus === "COMPLETE") ? "#e8f5e9" : "#ffebee";
        let paymentBadge = `<span style="font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:800; background:${payBg}; color:${payColor}; border:1px solid ${payColor}44;">${payStatus}</span>`;

        let cancelBtnHtml = "";
        if (!isComplete && !safeStatus.includes("cancel")) {
            cancelBtnHtml = `<button onclick="openCancelModal('${bk.order_id}')" style="background:var(--danger); color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; margin-top:12px; width:100%;">Cancel This Booking</button>`;
        }
        
        let reportSectionHtml = "";
        let handReportsArr = [];
        if (bk.hand_reports) {
            try { handReportsArr = JSON.parse(bk.hand_reports); if(!Array.isArray(handReportsArr)) handReportsArr = [bk.hand_reports]; } catch(e) { handReportsArr = [bk.hand_reports]; }
        }

        let onlinePdfArr = [];
        if (bk.report_pdf) {
            try { onlinePdfArr = JSON.parse(bk.report_pdf); if(!Array.isArray(onlinePdfArr)) onlinePdfArr = [bk.report_pdf]; } catch(e) { onlinePdfArr = [bk.report_pdf]; }
        }

        if (isComplete && (onlinePdfArr.length > 0 || handReportsArr.length > 0)) {
            reportSectionHtml = `<div style="margin-top:12px; padding:12px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px;">
                <div style="font-size:12px; color:#2e7d32; font-weight:bold; margin-bottom:5px;"><i class="fas fa-check-circle"></i> Booking Completed</div>`;
            
            if(onlinePdfArr.length > 0) {
                reportSectionHtml += `<div style="font-size:11px; color:#555; margin-top:8px; margin-bottom:5px; font-weight:bold;">Online Reports:</div>`;
                onlinePdfArr.forEach((url, i) => {
                    if(url.trim() !== "") {
                        reportSectionHtml += `<a href="${url}" target="_blank" style="display:block; text-align:center; margin-bottom:5px; padding:8px; background:var(--success); color:white; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px;"><i class="fas fa-download"></i> Download Report ${i+1}</a>`;
                    }
                });
            }
            if (handReportsArr.length > 0) {
                reportSectionHtml += `<div style="font-size:11px; color:#d84315; margin-top:10px; font-weight:bold;">To Collect Physically (In-Hand):</div>`;
                reportSectionHtml += `<ul style="margin:5px 0; padding-left:20px; font-size:12px; color:#d84315;">`;
                handReportsArr.forEach(srv => { if(srv.trim() !== "") reportSectionHtml += `<li>${srv}</li>`; });
                reportSectionHtml += `</ul>`;
            }
            reportSectionHtml += `</div>`;
        }

        cardsHtml += `
        <div style="background:#ffffff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                <div>
                    <div style="font-size:11px; color:#888; margin-bottom:2px;">Order ID</div>
                    <strong style="color:#333; font-size:14px;">#${bk.order_id}</strong>
                    <div style="margin-top:4px;"><strong style="font-size:12px; color:var(--primary);">Lab: ${bk.lab_id ? bk.lab_id.split('(')[0].trim() : 'Unknown'}</strong></div>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${badgeClass}" style="margin-bottom:6px;">${statusText.toUpperCase()}</span><br>
                    <span style="font-size:11px; color:var(--primary); font-weight:bold;"><i class="far fa-calendar-alt"></i> ${bk.slot}</span>
                </div>
            </div>
            
            <div style="margin-bottom:12px;">
                <h5 style="margin:0; color:#555; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Booked Tests</h5>
                ${testsListHtml}
            </div>

            <div style="background:#fcfcfc; padding:10px; border-radius:8px; font-size:12px; color:#666; line-height:1.6; border:1px solid #f0f0f0; margin-bottom:12px;">
                <strong>Patient Name:</strong> ${bk.patient_name} <br>
                <strong>Service Mode:</strong> ${modeDisplay} <br>
                <strong>Collection Address:</strong> ${bk.address}
            </div>

            <div style="background:#fffaf0; border:1px dashed #ffe0b2; border-radius:8px; padding:12px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Subtotal:</span> <span>₹${bk.subtotal}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Collection Charge:</span> <span>₹${bk.collection_charge}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#d32f2f;"><span>Discount Applied:</span> <span>-₹${bk.discount}</span></div>
                <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #ffe0b2; font-weight:800; font-size:15px; color:#e65100; align-items:center;">
                    <span>Final Payable:</span> 
                    <span>₹${bk.final_payable}${paymentBadge}</span>
                </div>
            </div>
            
            ${reportSectionHtml}
            ${cancelBtnHtml}
        </div>`;
    });

    container.innerHTML = cardsHtml;
}

function openCancelModal(orderId) {
    document.getElementById("cancelOrderIdHidden").value = orderId;
    document.getElementById("cancelReasonInput").value = "";
    document.getElementById("cancel-order-modal").style.display = "block";
}

async function submitCancelOrder() {
    const orderId = document.getElementById("cancelOrderIdHidden").value;
    const reason = document.getElementById("cancelReasonInput").value.trim();
    const btn = document.getElementById("btnConfirmCancel");
    
    if (!reason) { alert("Please enter a reason for cancellation."); return; }
    
    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                action: "cancelPatientOrder", 
                user_id: localStorage.getItem("bhavya_user_id"),
                order_id: orderId,
                cancel_reason: reason 
            })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            alert("Order cancelled successfully.");
            document.getElementById("cancel-order-modal").style.display = "none";
            fetchPatientBookings(localStorage.getItem("bhavya_user_id")); 
        } else {
            alert("Error: " + result.message);
        }
    } catch(e) {
        alert("Failed to cancel. Check your network.");
    } finally {
        btn.innerText = "Confirm Cancellation"; btn.disabled = false;
    }
}
