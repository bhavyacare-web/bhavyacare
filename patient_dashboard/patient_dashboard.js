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

            // Withdraw Button Visibility 
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
                    document.getElementById("notifDot").style.display = "block"; // Notification logic
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

            // Data load hote waqt baaki cheezein bhi fetch ho jayengi
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
    });
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
// NEW: BOOKINGS & CANCEL ORDER LOGIC
// ===============================================
async function fetchPatientBookings(userId) {
    const bookingTab = document.querySelector("#bookings .data-box");
    const reportsTab = document.querySelector("#reports .data-box");
    const recentActivityContainer = document.getElementById("recentActivityContainer");
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientBookings", user_id: userId })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            globalBookingsData = result.data;
            renderBookings(globalBookingsData, bookingTab, reportsTab, recentActivityContainer);
        } else {
            console.error("Booking Fetch Error:", result.message);
        }
    } catch(e) { console.error("Network error fetching bookings.", e); }
}

function renderBookings(bookings, bookingTab, reportsTab, recentContainer) {
    let bookingsHtml = `<div class="section-title">My Bookings</div>`;
    let reportsHtml = `<div class="section-title">Medical Records</div>`;
    let recentHtml = "";
    
    let hasBookings = false;
    let hasReports = false;

    bookings.forEach((bk, index) => {
        // Test Names
        let testNames = "Tests";
        if(Array.isArray(bk.cart_items) && bk.cart_items.length > 0) {
            testNames = bk.cart_items.map(t => t.test_name || t.name || 'Test').join(', ');
        }
        
        // Status Badge Logic
        let badgeClass = "status-warning"; 
        let statusText = "Pending";
        if (bk.status === "confirmed") { badgeClass = "status-primary"; statusText = "Confirmed"; }
        else if (bk.status === "complete") { badgeClass = "status-success"; statusText = "Completed"; }
        else if (bk.status.includes("cancel")) { badgeClass = "status-danger"; statusText = "Cancelled"; }

        // Mode Display Logic (Home Collection or Lab Visit)
        let modeDisplay = (bk.fulfillment && bk.fulfillment.toLowerCase().includes('home')) ? "Home Collection" : "Lab Visit";

        // Payment Status Logic
        let payStatusText = (bk.payment_status === "complete") ? "Complete" : "Due";
        let payBadgeClass = (bk.payment_status === "complete") ? "background:#e8f5e9; color:#2e7d32;" : "background:#ffebee; color:#d32f2f;";
        let paymentBadgeHtml = `<span style="font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold; ${payBadgeClass}">${payStatusText}</span>`;

        hasBookings = true;

        // Cancel Logic
        let cancelBtnHtml = "";
        if (bk.status !== "complete" && !bk.status.includes("cancel")) {
            cancelBtnHtml = `<button onclick="openCancelModal('${bk.order_id}')" style="background:var(--danger); color:white; border:none; padding:8px 15px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; margin-top:10px; width:100%;">Cancel Booking</button>`;
        }
        
        // Report Logic (Visible only if status is complete)
        let reportSectionHtml = "";
        if (bk.status === "complete") {
            let rType = bk.report_type ? bk.report_type : "in hand";
            reportSectionHtml = `
            <div style="margin-top:12px; padding:12px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px;">
                <div style="font-size:12px; color:#2e7d32; font-weight:bold; margin-bottom:5px;">
                    <i class="fas fa-check-circle"></i> Booking Completed
                </div>
                <div style="font-size:11px; color:#555;">Report Mode: <strong style="text-transform:capitalize;">${rType}</strong></div>`;
            
            if (rType === "online" && bk.report_pdf) {
                reportSectionHtml += `<a href="${bk.report_pdf}" target="_blank" style="display:block; text-align:center; margin-top:10px; padding:8px; background:var(--success); color:white; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px;"><i class="fas fa-download"></i> Download Report PDF</a>`;
            } else if (rType === "in hand") {
                reportSectionHtml += `<div style="margin-top:8px; font-size:11px; color:#d84315;"><i class="fas fa-info-circle"></i> Please collect your physical report from the lab.</div>`;
            }
            reportSectionHtml += `</div>`;
        }

        // ----------- 1. DETAILED BOOKINGS TAB RENDER -----------
        bookingsHtml += `
        <div style="background:#ffffff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                <div>
                    <div style="font-size:11px; color:#888;">Order ID</div>
                    <strong style="color:var(--text-main); font-size:14px;">${bk.order_id}</strong>
                    <div style="font-size:10px; color:#aaa; margin-top:2px;">Cart ID: ${bk.parent_cart_id || 'N/A'} | Lab: ${bk.lab_id}</div>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${badgeClass}" style="margin-bottom:4px;">${statusText}</span><br>
                    <span style="font-size:11px; color:var(--primary); font-weight:bold;"><i class="far fa-clock"></i> ${bk.slot}</span>
                </div>
            </div>
            
            <div style="margin-bottom:12px;">
                <h5 style="margin:0 0 8px 0; color:var(--text-main); font-size:14px;">${testNames}</h5>
                <div style="background:#f9f9f9; padding:10px; border-radius:8px; font-size:12px; color:var(--text-light); line-height:1.6;">
                    <strong>Patient:</strong> ${bk.patient_name} <br>
                    <strong>Mode:</strong> ${modeDisplay} <br>
                    <strong>Address:</strong> ${bk.address}
                </div>
            </div>

            <div style="background:#fffaf0; border:1px dashed #ffe0b2; border-radius:8px; padding:10px; font-size:12px; color:#555;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Subtotal:</span> <span>₹${bk.subtotal}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Collection Charge:</span> <span>₹${bk.collection_charge}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#d32f2f;"><span>Discount:</span> <span>-₹${bk.discount}</span></div>
                <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px solid #ffe0b2; font-weight:bold; font-size:14px; color:#e65100; align-items:center;">
                    <span>Final Payable:</span> 
                    <span>₹${bk.final_payable} ${paymentBadgeHtml}</span>
                </div>
            </div>
            
            ${reportSectionHtml}
            ${cancelBtnHtml}
            
        </div>`;

        // ----------- 2. RECENT ACTIVITY RENDER (Top 3) -----------
        if (index < 3) {
            recentHtml += `
            <div class="list-item">
                <div class="list-info">
                    <h5 style="font-size:14px; text-transform:capitalize;">${testNames.substring(0, 30)}...</h5>
                    <p style="color:var(--primary); font-weight:bold;"><i class="far fa-clock"></i> ${bk.slot}</p>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${badgeClass}" style="margin-bottom:0;">${statusText}</span>
                </div>
            </div>`;
        }

        // ----------- 3. REPORTS TAB RENDER -----------
        if (bk.status === "complete" && bk.report_type === "online" && bk.report_pdf) {
            hasReports = true;
            reportsHtml += `
            <div style="background:#fff; border:1px solid #e0e6ed; border-left: 4px solid var(--success); border-radius:8px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between;">
                    <h5 style="margin:0 0 5px 0; font-size:15px; color:var(--text-main);"><i class="fas fa-file-medical" style="color:var(--success);"></i> Test Report</h5>
                    <span style="font-size:11px; color:var(--primary); font-weight:bold;"><i class="far fa-clock"></i> ${bk.slot}</span>
                </div>
                <div style="font-size:12px; color:var(--text-light); margin-bottom:10px; line-height:1.5;">
                    <strong>Patient:</strong> ${bk.patient_name} <br>
                    <strong>Address:</strong> ${bk.address}
                </div>
                <a href="${bk.report_pdf}" target="_blank" style="display:block; text-align:center; background:#e8f5e9; color:#2e7d32; padding:8px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px;">
                    <i class="fas fa-cloud-download-alt"></i> View & Download PDF
                </a>
            </div>`;
        }
    });

    if (!hasBookings) bookingsHtml += `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 15px;"></i><p>No active bookings found.</p></div>`;
    if (!hasReports) reportsHtml += `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 15px;"></i><p>Your online test reports will appear here.</p></div>`;
    if (recentHtml === "") recentHtml = `<div style="text-align: center; padding: 20px; color: #aaa; font-size: 13px;">No recent activities yet.</div>`;

    bookingTab.innerHTML = bookingsHtml;
    reportsTab.innerHTML = reportsHtml;
    recentContainer.innerHTML = recentHtml;
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
