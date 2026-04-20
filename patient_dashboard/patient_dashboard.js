const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 
let isUserVip = false;
let globalBookingsData = [];
let globalConsultsData = [];
let globalCompletedReports = []; 
let globalMedicineOrders = []; // Naya array for Medicine Orders

// Variables for Handshake
let activeVideoCallApptId = null;
let handledPatTriggers = new Set(); 

// ✨ TOAST NOTIFICATION LOGIC ✨
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = 'fa-check-circle'; 
    if(type === 'error') icon = 'fa-exclamation-circle'; else if(type === 'info') icon = 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

document.addEventListener("DOMContentLoaded", checkLoginAndFetchData);

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = error => reject(error);
    });
}

function toggleMobileMenu() {
    const sheet = document.getElementById("mobileMenuSheet"); const backdrop = document.getElementById("menuBackdrop");
    if(sheet && backdrop) {
        if(sheet.classList.contains("active")) { sheet.classList.remove("active"); backdrop.classList.remove("active"); } 
        else { sheet.classList.add("active"); backdrop.classList.add("active"); }
    }
}

function safeSetText(id, text) { const el = document.getElementById(id); if(el) el.innerText = text; }
function safeSetValue(id, val) { const el = document.getElementById(id); if(el && val) el.value = val; }

function switchTab(tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
    const links = document.querySelectorAll(".nav-item"); links.forEach(link => link.classList.remove("active"));
    const selectedTab = document.getElementById(tabId); if(selectedTab) selectedTab.classList.add("active");
    
    if(typeof event !== 'undefined' && event && event.currentTarget && event.currentTarget.classList.contains('nav-item')) { 
        event.currentTarget.classList.add("active"); 
    } else { 
        const activeNav = document.querySelector(`[onclick*="switchTab('${tabId}')"].nav-item:not(.mobile-only)`); 
        if(activeNav) activeNav.classList.add("active"); 
    }
}

function logoutDashboard() { localStorage.clear(); window.location.href = "../index.html"; }

async function checkLoginAndFetchData() {
    const userId = localStorage.getItem("bhavya_user_id");
    if (!userId) { showToast("Please login first to access the dashboard.", "error"); window.location.href = "../index.html"; return; }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientProfile", user_id: userId }) 
        });
        const result = await response.json();
        if (result.status === "success") {
            const patient = result.data;
            if(patient.patient_name) localStorage.setItem("bhavya_name", patient.patient_name);

            safeSetText("userNameMobile", patient.patient_name); safeSetText("userNameDesktop", patient.patient_name); safeSetText("userIdDisplay", "ID: " + patient.user_id);
            safeSetText("walletBal", patient.wallet || "0"); safeSetText("refCode", patient.referral_code || "-----");
            safeSetText("infoName", patient.patient_name); safeSetText("infoMobile", patient.mobile_number);

            let btnWithdraw = document.getElementById('btn-withdraw');
            if (btnWithdraw) {
                if (patient.withdraw && patient.withdraw.toLowerCase() === 'active') btnWithdraw.style.display = 'block';
                else btnWithdraw.style.display = 'none';
            }

            const planName = patient.plan ? patient.plan.toLowerCase() : "basic";
            isUserVip = (planName === "vip"); 
            safeSetText("vipStatus", patient.plan ? patient.plan.toUpperCase() : "BASIC");
            
            const vipBtn = document.getElementById("btn-vip-action"); const vipSubText = document.getElementById("vipSubText");
            const vipAlert = document.getElementById("vipPackageAlert"); const notifDot = document.getElementById("notifDot"); const notifDotDesktop = document.getElementById("notifDotDesktop");

            if (isUserVip) {
                if (vipBtn) vipBtn.style.display = "none";
                if (vipSubText) vipSubText.innerHTML = "Enjoying VIP Benefits ✨ <br><small style='color:#0056b3;'>Click card to view details</small>"; 
                
                if (patient.vip_package_status === "pending") {
                    if (vipAlert) vipAlert.style.display = "block"; if (notifDot) notifDot.style.display = "block"; if (notifDotDesktop) notifDotDesktop.style.display = "block";
                } else {
                    if (vipAlert) vipAlert.style.display = "none"; if (notifDot) notifDot.style.display = "none"; if (notifDotDesktop) notifDotDesktop.style.display = "none";
                }
                if (patient.vip_details) {
                    safeSetText("vd-start", patient.vip_details.start_date || "N/A"); safeSetText("vd-end", patient.vip_details.end_date || "N/A");
                    let mem1 = document.getElementById("vd-mem1");
                    if(mem1) mem1.innerHTML = `<span><strong>${patient.vip_details.member1_name || 'N/A'}</strong> <br><small style="color:#888;">(Self)</small></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member1_id || '-'}</span>`;
                    
                    let mem2 = document.getElementById("vd-mem2");
                    if (mem2) {
                        if (patient.vip_details.member2_name) { mem2.innerHTML = `<span><strong>${patient.vip_details.member2_name}</strong></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member2_id || '-'}</span>`; mem2.style.display = "flex"; } else { mem2.style.display = "none"; }
                    }
                    let mem3 = document.getElementById("vd-mem3");
                    if (mem3) {
                        if (patient.vip_details.member3_name) { mem3.innerHTML = `<span><strong>${patient.vip_details.member3_name}</strong></span><span style="font-size:11px; background:#e6f0fa; color:#0056b3; padding:3px 8px; border-radius:4px; font-weight:bold;">${patient.vip_details.member3_id || '-'}</span>`; mem3.style.display = "flex"; } else { mem3.style.display = "none"; }
                    }
                }
            } else {
                if (vipBtn) vipBtn.style.display = "block"; if (vipSubText) vipSubText.innerText = "Upgrade for free home collection";
                if (vipAlert) vipAlert.style.display = "none"; if (notifDot) notifDot.style.display = "none"; if (notifDotDesktop) notifDotDesktop.style.display = "none";
            }
            
            const banner = document.getElementById("profileBanner"); const profileImages = document.querySelectorAll(".profile-img"); const editPreview = document.getElementById("editProfilePreview");
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.patient_name)}&background=e6f0fa&color=0056b3&bold=true`;

            if (patient.extra_details) {
                if (banner) banner.style.display = "none";
                safeSetValue("infoEmail", patient.extra_details.email); safeSetValue("infoAddress", patient.extra_details.address); safeSetValue("infoCity", patient.extra_details.city);
                safeSetValue("infoDistrict", patient.extra_details.district); safeSetValue("infoState", patient.extra_details.state); safeSetValue("infoPincode", patient.extra_details.pincode);
                if (patient.extra_details.image && patient.extra_details.image.startsWith("data:image")) {
                    profileImages.forEach(img => img.src = patient.extra_details.image); if(editPreview) editPreview.src = patient.extra_details.image;
                    let mobImg = document.getElementById("mobileProfileImg"); if(mobImg) mobImg.src = patient.extra_details.image;
                    let deskImg = document.getElementById("desktopProfileImg"); if(deskImg) deskImg.src = patient.extra_details.image;
                } else { profileImages.forEach(img => img.src = fallbackUrl); if(editPreview) editPreview.src = fallbackUrl; }
            } else {
                if (banner) banner.style.display = "block"; profileImages.forEach(img => img.src = fallbackUrl); if(editPreview) editPreview.src = fallbackUrl;
            }

            fetchWalletHistory(userId);
            // ✨ FIX: Medicine Orders bhi sath me fetch honge ✨
            await Promise.all([ fetchPatientBookings(userId), fetchPatientConsults(userId), fetchPatientMedicines(userId) ]);
            updateRecentActivityMixed();
        } else {
            showToast("Error: " + result.message, "error");
            if(result.message === "Your account is blocked by Admin.") logoutDashboard();
        }
    } catch (error) { console.error("Fetch Error:", error); }
}

function handleVipCardClick() {
    if (isUserVip) { document.getElementById('vip-details-modal').style.display = 'block'; } else { window.location.href = '../vip/vip_member.html'; }
}

function copyMyReferral() {
    const code = document.getElementById("refCode").innerText;
    if (code && code !== "-----") { navigator.clipboard.writeText(code); showToast("Referral Code '" + code + "' copied!", "success"); }
}

const fileInput = document.getElementById("profileImageInput");
if(fileInput) {
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image(); img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas"); const scaleSize = 200 / img.width;
                canvas.width = 200; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6); 
                document.getElementById("editProfilePreview").src = compressedBase64; document.getElementById("infoImageBase64").value = compressedBase64;
            }
        }
    })
}

async function savePatientProfile() {
    const btn = document.getElementById("btnSaveProfile"); btn.innerText = "Saving Please Wait..."; btn.disabled = true;
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
        if (result.status === "success") { showToast("Profile Details Saved Successfully!", "success"); checkLoginAndFetchData(); switchTab('overview'); } 
        else { showToast("Error: " + result.message, "error"); }
    } catch (error) { showToast("Failed to save. Check your connection.", "error"); } 
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
            if (history.length === 0) { container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-receipt" style="font-size: 40px; margin-bottom: 15px;"></i><p>No recent transactions.</p></div>`; return; }
            let html = "";
            history.forEach(txn => {
                const isCredit = txn.type.toLowerCase() === 'credit'; const color = isCredit ? '#2e7d32' : '#d32f2f'; const sign = isCredit ? '+' : '-';
                html += `
                <div class="list-item" style="align-items: flex-start;">
                    <div class="list-info"><h5 style="margin-bottom: 3px;">${txn.description}</h5><p><i class="far fa-clock"></i> ${txn.date}</p></div>
                    <div style="font-weight: 800; color: ${color}; font-size: 16px; margin-top: 2px;">${sign}₹${txn.amount}</div>
                </div>`;
            });
            container.innerHTML = html;
        } else { container.innerHTML = `<p style="color:red; text-align:center;">Failed: ${result.message}</p>`; }
    } catch(e) { container.innerHTML = `<p style="color:red; text-align:center;">Network error.</p>`; }
}

// ==========================================
// 🌟 PHARMACY/MEDICINES TAB (NAYA CODE YAHAN HAI) 🌟
// ==========================================

async function fetchPatientMedicines(userId) {
    const container = document.getElementById("patientMedicinesContainer");
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientOrders", user_id: userId })
        });
        const result = await response.json();
        if (result.status === "success") {
            globalMedicineOrders = result.data.orders;
            renderMedicineOrders(globalMedicineOrders);
        } else {
            if(container) container.innerHTML = `<p style="color:red; text-align:center;">Failed to load data: ${result.message}</p>`;
        }
    } catch(e) { 
        if(container) container.innerHTML = `<p style="color:red; text-align:center;">Network error. Please check your connection.</p>`; 
    }
}

// ✨ PATIENT DASHBOARD: RENDER MEDICINE ORDERS ✨
function renderMedicineOrders(orders) {
    const container = document.getElementById("patientMedicinesContainer");
    if (!container) return;
    container.innerHTML = "";

    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; background:white; border-radius:15px;"><p>No medicine orders found.</p></div>`;
        return;
    }

    orders.forEach(order => {
        let badgeHtml = ""; let actionHtml = ""; let isComplete = false;
        let safeStatus = (order.patient_status || "Pending").toString().trim();

        if (safeStatus === "Pending") {
            badgeHtml = `<span class="status-badge status-warning"><i class="fas fa-clock"></i> Waiting for Pharmacy</span>`;
            actionHtml = `<p style="font-size:12px; color:#64748b; margin:0;"><i class="fas fa-info-circle"></i> Pharmacy is reviewing your request.</p>
                          <button onclick="openCancelMedicineModal('${order.order_id}')" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px; transition: 0.2s;">Cancel Order</button>`;
        } 
        else if (safeStatus === "confirm_for_patient") {
            badgeHtml = `<span class="status-badge status-primary"><i class="fas fa-exclamation-circle"></i> Action Required</span>`;
            actionHtml = `<button onclick="openConfirmMedicineModal('${order.order_id}', '${order.presc_req}')" style="background:var(--primary); color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; width:100%; margin-top:5px;">
                            <i class="fas fa-check-double"></i> Review & Confirm Order
                          </button>
                          <button onclick="openCancelMedicineModal('${order.order_id}')" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px; transition: 0.2s;">Cancel Order</button>`;
        }
        else if (safeStatus === "Confirmed") {
            badgeHtml = `<span class="status-badge status-success"><i class="fas fa-check"></i> Order Confirmed</span>`;
            actionHtml = `<p style="font-size:13px; color:#059669; margin:0; font-weight:bold;"><i class="fas fa-box"></i> Order is being prepared by Pharmacy.</p>`;
        }
        else if (safeStatus === "Completed") {
            isComplete = true;
            badgeHtml = `<span class="status-badge" style="background:#ecfdf5; color:#065f46;"><i class="fas fa-check-circle"></i> Completed</span>`;
            
            let billBtn = order.medicine_bill ? `<button onclick="window.open('${order.medicine_bill}', '_blank')" style="background:#e8f5e9; color:#2e7d32; border:1px solid #2e7d32; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; flex:1;"><i class="fas fa-file-invoice"></i> Bill</button>` : "";
            let rateBtn = order.pharmacy_rating ? `<button disabled style="background:#f4f4f4; color:#aaa; border:1px solid #ddd; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; flex:1;"><i class="fas fa-star"></i> Rated</button>` : `<button onclick="openPharmaReviewModal('${order.order_id}')" style="background:#fff8e1; color:#f57c00; border:1px solid #f57c00; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; flex:1;"><i class="fas fa-star"></i> Rate Pharmacy</button>`;

            actionHtml = `<div style="display:flex; gap:10px; margin-top:10px;">${billBtn}${rateBtn}</div>`;
        }
        else if (safeStatus === "Cancelled") {
            badgeHtml = `<span class="status-badge status-danger"><i class="fas fa-ban"></i> Cancelled</span>`;
            actionHtml = `<p style="font-size:12px; color:#dc2626; margin:0;"><i class="fas fa-times-circle"></i> This order was cancelled.</p>`;
        }

        let orderDate = new Date(order.order_date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
        let formattedDelivery = order.delivery_date;
        try { if (order.delivery_date && String(order.delivery_date).includes('T')) { let dObj = new Date(order.delivery_date); formattedDelivery = `${dObj.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} at ${dObj.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit', hour12: true})}`; } } catch(e) {}

       let callBtn = order.pharma_mobile && !String(order.pharma_mobile).includes("Hidden") ? `<a href="tel:${order.pharma_mobile}" style="display:block; text-align:center; text-decoration:none; background:#eff6ff; color:var(--primary); padding:10px; border-radius:8px; font-size:12px; font-weight:bold; margin-top:10px;"><i class="fas fa-phone-alt"></i> Call Pharmacy</a>` : ``;

        // ✨ NAYA LOGIC: Payment Badge, Order Type Badge & Delivery/Pickup Text ✨
        let isPickup = (order.order_type === "Collect from Pharmacy" || order.order_type === "Self Pickup");
        let orderTypeDisplay = isPickup 
            ? `<span style="color: #d97706; font-weight: bold; font-size: 11px; background: #fef3c7; padding: 2px 6px; border-radius: 4px;"><i class="fas fa-store-alt"></i> Self Pickup</span>`
            : `<span style="color: var(--primary); font-weight: bold; font-size: 11px; background: #e0e7ff; padding: 2px 6px; border-radius: 4px;"><i class="fas fa-motorcycle"></i> Home Delivery</span>`;
            
        let deliveryIconText = isPickup ? `<i class="fas fa-walking"></i> <b>Pickup By:</b>` : `<i class="fas fa-truck-fast"></i> <b>Deliver By:</b>`;
        let addressLabel = isPickup ? "Pharmacy Address" : "Delivery Address";
        
        let payStatusBadge = (order.payment_status === "Completed" || order.payment_status === "Paid") 
            ? `<span style="background:#d1fae5; color:#059669; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800; margin-left:8px;">PAID</span>` 
            : `<span style="background:#fee2e2; color:#dc2626; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800; margin-left:8px;">DUE</span>`;

        let pharmaReplyHtml = "";
        if (order.total_mrp && Number(order.total_mrp) > 0) {
            let planDisplay = isUserVip ? `<span style="background:#fff8e1; color:#f57c00; font-size:10px; padding:2px 5px; border-radius:4px; margin-left:5px;">VIP PLAN APPLIED</span>` : `<span style="background:#e6f0fa; color:#0056b3; font-size:10px; padding:2px 5px; border-radius:4px; margin-left:5px;">BASIC PLAN APPLIED</span>`;

            pharmaReplyHtml = `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #e2e8f0;">
                <h5 style="margin:0 0 10px 0; color:#0f172a;">Pharmacy Update</h5>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                    <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                        <h6 style="margin:0 0 5px 0; font-size:11px; color:var(--text-light);">Available</h6>
                        <p style="margin:0; font-size:12px; color:#059669; font-weight:bold;">${order.avail_meds || "Yes"}</p>
                    </div>
                    <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                        <h6 style="margin:0 0 5px 0; font-size:11px; color:var(--text-light);">Not Available</h6>
                        <p style="margin:0; font-size:12px; color:#dc2626;">${order.not_avail_meds || "None"}</p>
                    </div>
                </div>
                
                <div style="background:#fff; border:1px solid #e2e8f0; padding:12px; border-radius:8px;">
                    <h6 style="margin:0 0 10px 0; font-size:12px; color:var(--text-main);">Bill Summary ${planDisplay}</h6>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b; margin-bottom:5px;">
                        <span>Total MRP:</span> <span>₹${Number(order.total_mrp).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#10b981; margin-bottom:5px;">
                        <span>Discount Applied:</span> <span>- ₹${Number(order.patient_discount).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b; margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:5px;">
                        <span>Delivery Charge:</span> <span>+ ₹${Number(order.delivery_charge).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:15px; color:#0f172a; font-weight:800; align-items:center;">
                        <span>Final Payable:</span> <span>₹${Number(order.final_payable).toFixed(2)} ${payStatusBadge}</span>
                    </div>
                </div>
            </div>`;
        }

        let addressHtml = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; margin-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <h6 style="margin:0; color:#475569; font-size:11px; text-transform:uppercase;">${addressLabel}</h6>
            </div>
            <p style="margin:0; font-size:13px; color:#334155; font-weight:600; line-height: 1.4;">${order.patient_address || "Address not provided"}</p>
            <div style="margin-top: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; color: #065f46;">
                <p style="font-size: 13px; margin: 0;">${deliveryIconText} ${formattedDelivery}</p>
            </div>
        </div>`;

        let card = `
        <div style="background:#ffffff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                <div>
                    <strong style="color:#2563eb; font-size:15px;">#${order.order_id}</strong>
                    <div style="margin-top:4px;">${orderTypeDisplay}</div>
                </div>
                <div style="text-align:right;">${badgeHtml}</div>
            </div>
            <p style="font-size:12px; color:#64748b; margin:0 0 5px 0;"><i class="far fa-calendar-alt"></i> Ordered: ${orderDate}</p>
            
            ${addressHtml}

            <div style="background:#f9fafb; padding:10px; border-radius:8px; font-size:13px; font-weight:600; color:#333;">
                <div style="font-size:11px; color:#888; margin-bottom:4px; text-transform:uppercase;">Medicine Details:</div>
                ${order.medicine_details}
            </div>
            
            ${pharmaReplyHtml}

            <div style="margin-top: 15px;">
                ${actionHtml}
                ${!isComplete && safeStatus !== "Cancelled" ? callBtn : ''}
            </div>
        </div>`;
        
        container.innerHTML += card;
    });
}
// ✨ NAYA LOGIC: PATIENT CANCEL MEDICINE ORDER ✨
function openCancelMedicineModal(orderId) {
    document.getElementById("cancelMedOrderIdHidden").value = orderId; 
    document.getElementById("cancelMedReasonInput").value = ""; 
    document.getElementById("cancel-med-order-modal").style.display = "block";
}

async function submitCancelMedicineOrder(e) {
    e.preventDefault();
    const orderId = document.getElementById("cancelMedOrderIdHidden").value; 
    const reason = document.getElementById("cancelMedReasonInput").value.trim(); 
    const btn = document.getElementById("btnConfirmMedCancel");

    if (!reason) { showToast("Please enter a reason for cancellation.", "error"); return; }
    
    btn.innerText = "Processing..."; btn.disabled = true;
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { 
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify({ 
                action: "cancelMedicineOrderPatient", 
                user_id: localStorage.getItem("bhavya_user_id"), 
                order_id: orderId, 
                cancel_reason: reason 
            }) 
        });
        const result = await response.json();
        
        if (result.status === "success") { 
            showToast("Order cancelled successfully.", "success"); 
            document.getElementById("cancel-med-order-modal").style.display = "none"; 
            fetchPatientMedicines(localStorage.getItem("bhavya_user_id")); 
        } else { showToast("Error: " + result.message, "error"); }
    } catch(e) { showToast("Failed to cancel. Check your network.", "error"); } 
    finally { btn.innerText = "Confirm Cancellation"; btn.disabled = false; }
}

function openConfirmMedicineModal(orderId, prescReq) {
    document.getElementById("modalMedOrderId").value = orderId;
    
    const prescGroup = document.getElementById("prescUploadGroup");
    const prescAlert = document.getElementById("prescAlert");
    const fileInput = document.getElementById("validPrescriptionFile");

    // Agar Pharmacy ne 'Yes' bola hai toh upload mandatory ho jayega
    if (prescReq === "Yes") {
        prescGroup.style.display = "block";
        prescAlert.style.display = "block";
        fileInput.required = true;
    } else {
        prescGroup.style.display = "none";
        prescAlert.style.display = "none";
        fileInput.required = false;
    }

    document.getElementById("confirmMedicineModal").style.display = "flex";
}

function closeConfirmMedicineModal() {
    document.getElementById("confirmMedicineModal").style.display = "none";
    document.getElementById("confirmMedicineForm").reset();
}

async function submitConfirmMedicineForm() {
    const btn = document.getElementById("btnSubmitConfirmMed");
    const fileInput = document.getElementById("validPrescriptionFile");

    // Check validation manually because we are not using standard submit event
    if(fileInput.required && (!fileInput.files || fileInput.files.length === 0)) {
        showToast("Please upload the required prescription.", "error");
        return;
    }

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Confirming...`; btn.disabled = true;

    try {
        let base64File = "";
        if(fileInput.files && fileInput.files.length > 0){
             base64File = await getBase64(fileInput.files[0]);
        }

        const payload = {
            action: "confirmOrderPatient",
            user_id: localStorage.getItem("bhavya_user_id"),
            order_id: document.getElementById("modalMedOrderId").value,
            prescription_base64: base64File
        };

        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
            showToast("Order Confirmed Successfully!", "success");
            closeConfirmMedicineModal();
            fetchPatientMedicines(localStorage.getItem("bhavya_user_id")); 
            checkLoginAndFetchData(); // For activity update
        } else {
            showToast("Error: " + resData.message, "error");
        }
    } catch (error) {
        showToast("Network error, please try again.", "error");
    } finally {
        btn.innerHTML = "Confirm & Place Order"; btn.disabled = false;
    }
}

// ✨ PHARMACY RATING LOGIC ✨
let currentPharmaRating = 0;
function openPharmaReviewModal(orderId) { 
    document.getElementById("pharmaReviewOrderIdHidden").value = orderId; 
    document.getElementById("pharmaReviewCommentInput").value = ""; 
    setPharmaRating(0); 
    document.getElementById("pharma-review-modal").style.display = "block"; 
}

function setPharmaRating(stars) {
    currentPharmaRating = stars; 
    const icons = document.getElementById("pharmaStarRatingContainer").children;
    for(let i=0; i<icons.length; i++) { 
        if(i < stars) { icons[i].classList.add("active"); icons[i].style.color = "#ffc107"; } 
        else { icons[i].classList.remove("active"); icons[i].style.color = "#ddd"; } 
    }
}

async function submitPharmaReview() {
    const orderId = document.getElementById("pharmaReviewOrderIdHidden").value; 
    const comment = document.getElementById("pharmaReviewCommentInput").value.trim(); 
    const btn = document.getElementById("btnSubmitPharmaReview");
    
    if(currentPharmaRating === 0) { showToast("Please select a star rating.", "error"); return; }
    
    btn.innerText = "Submitting..."; btn.disabled = true;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { 
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, 
            body: JSON.stringify({ action: "submitPharmacyReview", user_id: localStorage.getItem("bhavya_user_id"), order_id: orderId, rating: currentPharmaRating, comment: comment }) 
        });
        const result = await response.json();
        if (result.status === "success") { 
            showToast("Pharmacy rated successfully!", "success"); 
            document.getElementById("pharma-review-modal").style.display = "none"; 
            fetchPatientMedicines(localStorage.getItem("bhavya_user_id")); 
        } else { showToast(result.message, "error"); }
    } catch(e) { showToast("Failed to submit review.", "error"); } 
    finally { btn.innerText = "Submit Rating"; btn.disabled = false; }
}


// ==========================================
// 🌟 EXISTING LABS & DOCTORS LOGIC 🌟
// ==========================================

async function fetchPatientBookings(userId) {
    const bookingsContainer = document.getElementById("patientBookingsContainer");
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientBookings", user_id: userId })
        });
        const result = await response.json();
        if (result.status === "success") {
            globalBookingsData = result.data; renderBookingCards(globalBookingsData);
            globalCompletedReports = globalBookingsData.filter(bk => {
                let safeStatus = (bk.status || "pending").toString().toLowerCase().trim();
                return safeStatus.includes("complete") || safeStatus === "completed";
            });
            renderFilteredReports(globalCompletedReports);
        } else { if(bookingsContainer) bookingsContainer.innerHTML = `<p style="color:red; text-align:center;">Failed to load data: ${result.message}</p>`; }
    } catch(e) { if(bookingsContainer) bookingsContainer.innerHTML = `<p style="color:red; text-align:center;">Network error. Please check your connection.</p>`; }
}

function clearBookingFilters() {
    document.getElementById("searchBookingText").value = ""; document.getElementById("searchBookingDate").value = "";
    renderBookingCards(globalBookingsData);
}

function filterMyBookings() {
    const searchText = document.getElementById("searchBookingText").value.toLowerCase().trim();
    const searchDate = document.getElementById("searchBookingDate").value; 
    const filtered = globalBookingsData.filter(bk => {
        let matchText = true;
        if (searchText !== "") {
            const labName = (bk.lab_id || "").toLowerCase(); const orderId = (bk.order_id || "").toLowerCase();
            let items = []; let rawCart = bk.cart_items;
            if (typeof rawCart === 'string') {
                try { rawCart = JSON.parse(rawCart); } catch(e) {}
                if (typeof rawCart === 'string') { try { rawCart = JSON.parse(rawCart); } catch(e) {} }
            }
            if (Array.isArray(rawCart)) { items = rawCart; } 
            else if (typeof rawCart === 'object' && rawCart !== null) { items = rawCart.items || rawCart.cart || [rawCart]; } 
            else if (typeof rawCart === 'string' && rawCart.trim() !== "") { items = [{ service_name: rawCart }]; }

            let testNames = items.map(i => {
                if (typeof i === 'object' && i !== null) return i.service_name || i.test_name || i.name || i.title || "";
                return String(i);
            }).join(" ").toLowerCase();
            matchText = labName.includes(searchText) || testNames.includes(searchText) || orderId.includes(searchText);
        }
        let matchDate = true;
        if (searchDate !== "") {
            const [year, month, day] = searchDate.split("-");
            matchDate = (bk.date || "").includes(`${day}-${month}-${year}`);
        }
        return matchText && matchDate;
    });
    renderBookingCards(filtered);
}

function renderBookingCards(bookings) {
    const container = document.getElementById("patientBookingsContainer"); if (!container) return;
    if (bookings.length === 0) { container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 15px;"></i><p>No lab bookings found.</p></div>`; return; }

    let cardsHtml = "";
    bookings.forEach(bk => {
        let testsListHtml = ""; let items = []; let rawCart = bk.cart_items;
        if (typeof rawCart === 'string') { try { rawCart = JSON.parse(rawCart); } catch(e) {} if (typeof rawCart === 'string') { try { rawCart = JSON.parse(rawCart); } catch(e) {} } }
        if (Array.isArray(rawCart)) { items = rawCart; } else if (typeof rawCart === 'object' && rawCart !== null) { items = rawCart.items || rawCart.cart || [rawCart]; } else if (typeof rawCart === 'string' && rawCart.trim() !== "") { items = [{ service_name: rawCart }]; }

        if (items.length > 0) {
            testsListHtml = `<ul style="margin: 8px 0; padding-left: 20px; font-size: 13px; color: #333;">`;
            items.forEach(item => {
                let tName = "Unknown Test"; let tPrice = "";
                if (typeof item === 'object' && item !== null) { tName = item.service_name || item.test_name || item.name || item.title || "Unknown Test"; tPrice = item.price ? ` <span style="color:#888; font-size:11px;">(₹${item.price})</span>` : ''; } else if (typeof item === 'string') { tName = item; }
                testsListHtml += `<li style="margin-bottom:4px;"><strong>${tName}</strong>${tPrice}</li>`;
            });
            testsListHtml += `</ul>`;
        } else { testsListHtml = `<p style="margin: 8px 0; font-size: 12px; color:#888;">No test details found.</p>`; }

        let safeStatus = (bk.status || "pending").toString().toLowerCase().trim(); let safePayStatus = (bk.payment_status || "due").toString().toLowerCase().trim();
        let badgeClass = "status-warning"; let statusText = "Pending"; let isComplete = false;

        if (safeStatus.includes("confirm")) { badgeClass = "status-primary"; statusText = "Confirmed"; } else if (safeStatus.includes("complete") || safeStatus === "completed") { badgeClass = "status-success"; statusText = "Completed"; isComplete = true; } else if (safeStatus.includes("cancel")) { badgeClass = "status-danger"; statusText = "Cancelled"; }

        let modeDisplay = (bk.fulfillment && bk.fulfillment.toLowerCase().includes('home')) ? "Home Collection" : "Lab Visit";
        let payStatus = (safePayStatus.includes("complete") || safePayStatus.includes("verified")) ? "COMPLETE" : "DUE"; let payColor = (payStatus === "COMPLETE") ? "#2e7d32" : "#d32f2f"; let payBg = (payStatus === "COMPLETE") ? "#e8f5e9" : "#ffebee";
        let paymentBadge = `<span style="font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:800; background:${payBg}; color:${payColor}; border:1px solid ${payColor}44;">${payStatus}</span>`;

        let cancelBtnHtml = "";
        if (!isComplete && !safeStatus.includes("cancel")) cancelBtnHtml = `<button onclick="openCancelModal('${bk.order_id}')" style="background:var(--danger); color:white; border:none; padding:10px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; margin-top:12px; width:100%;">Cancel This Booking</button>`;

        let reportSectionHtml = ""; let handReportsArr = [];
        if (bk.hand_reports) { try { handReportsArr = JSON.parse(bk.hand_reports); if(!Array.isArray(handReportsArr)) handReportsArr = [bk.hand_reports]; } catch(e) { handReportsArr = [bk.hand_reports]; } }
        let onlinePdfArr = [];
        if (bk.report_pdf) { try { onlinePdfArr = JSON.parse(bk.report_pdf); if(!Array.isArray(onlinePdfArr)) onlinePdfArr = [bk.report_pdf]; } catch(e) { onlinePdfArr = [bk.report_pdf]; } }

        if (isComplete && (onlinePdfArr.length > 0 || handReportsArr.length > 0)) {
            reportSectionHtml = `<div style="margin-top:12px; padding:12px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px;"><div style="font-size:12px; color:#2e7d32; font-weight:bold; margin-bottom:5px;"><i class="fas fa-check-circle"></i> Booking Completed</div>`;
            if(onlinePdfArr.length > 0) {
                reportSectionHtml += `<div style="font-size:11px; color:#555; margin-top:8px; margin-bottom:5px; font-weight:bold;">Online Reports:</div>`;
                onlinePdfArr.forEach((url, i) => { if(url.trim() !== "") { reportSectionHtml += `<a href="${url}" target="_blank" style="display:block; text-align:center; margin-bottom:5px; padding:8px; background:var(--success); color:white; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px;"><i class="fas fa-download"></i> Download Report ${i+1}</a>`; } });
            }
            if (handReportsArr.length > 0) {
                reportSectionHtml += `<div style="font-size:11px; color:#d84315; margin-top:10px; font-weight:bold;">To Collect Physically (In-Hand):</div><ul style="margin:5px 0; padding-left:20px; font-size:12px; color:#d84315;">`;
                handReportsArr.forEach(srv => { if(srv.trim() !== "") reportSectionHtml += `<li>${srv}</li>`; });
                reportSectionHtml += `</ul>`;
            }
            reportSectionHtml += `</div>`;
        }
        
        cardsHtml += `
        <div style="background:#ffffff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                <div><div style="font-size:11px; color:#888; margin-bottom:2px;">Order ID</div><strong style="color:#333; font-size:14px;">#${bk.order_id}</strong><div style="margin-top:4px;"><strong style="font-size:12px; color:var(--primary);">Lab: ${bk.lab_id ? bk.lab_id.split('(')[0].trim() : 'Unknown'}</strong></div></div>
                <div style="text-align:right;"><span class="status-badge ${badgeClass}" style="margin-bottom:6px;">${statusText.toUpperCase()}</span><br><span style="font-size:11px; color:var(--primary); font-weight:bold;"><i class="far fa-calendar-alt"></i> ${bk.slot}</span></div>
            </div>
            <div style="margin-bottom:12px;"><h5 style="margin:0; color:#555; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Booked Tests</h5>${testsListHtml}</div>
            <div style="background:#fcfcfc; padding:10px; border-radius:8px; font-size:12px; color:#666; line-height:1.6; border:1px solid #f0f0f0; margin-bottom:12px;"><strong>Patient Name:</strong> ${bk.patient_name} <br><strong>Service Mode:</strong> ${modeDisplay} <br><strong>Collection Address:</strong> ${bk.address}</div>
            <div style="background:#fffaf0; border:1px dashed #ffe0b2; border-radius:8px; padding:12px; font-size:12px;"><div style="display:flex; justify-content:space-between; margin-top:8px; font-weight:800; font-size:15px; color:#e65100; align-items:center;"><span>Payable:</span> <span>₹${bk.final_payable}${paymentBadge}</span></div></div>
            ${reportSectionHtml}${cancelBtnHtml}
        </div>`;
    });
    container.innerHTML = cardsHtml;
}

function openCancelModal(orderId) {
    document.getElementById("cancelOrderIdHidden").value = orderId; document.getElementById("cancelReasonInput").value = ""; document.getElementById("cancel-order-modal").style.display = "block";
}

async function submitCancelOrder() {
    const orderId = document.getElementById("cancelOrderIdHidden").value; const reason = document.getElementById("cancelReasonInput").value.trim(); const btn = document.getElementById("btnConfirmCancel");
    if (!reason) { showToast("Please enter a reason for cancellation.", "error"); return; }
    btn.innerText = "Processing..."; btn.disabled = true;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "cancelPatientOrder", user_id: localStorage.getItem("bhavya_user_id"), order_id: orderId, cancel_reason: reason }) });
        const result = await response.json();
        if (result.status === "success") { showToast("Order cancelled successfully.", "success"); document.getElementById("cancel-order-modal").style.display = "none"; fetchPatientBookings(localStorage.getItem("bhavya_user_id")); } 
        else { showToast("Error: " + result.message, "error"); }
    } catch(e) { showToast("Failed to cancel. Check your network.", "error"); } 
    finally { btn.innerText = "Confirm Cancellation"; btn.disabled = false; }
}

function clearReportFilters() { document.getElementById("searchReportText").value = ""; document.getElementById("searchReportDate").value = ""; renderFilteredReports(globalCompletedReports); }

function filterPatientReports() {
    const searchText = document.getElementById("searchReportText").value.toLowerCase().trim(); const searchDate = document.getElementById("searchReportDate").value; 
    const filtered = globalCompletedReports.filter(bk => {
        let matchText = true;
        if (searchText !== "") {
            let testNames = "";
            try { 
                let cart = typeof bk.cart_items === 'string' ? JSON.parse(bk.cart_items) : bk.cart_items; let items = Array.isArray(cart) ? cart : [cart];
                testNames = items.map(i => typeof i === 'object' ? (i.service_name || i.test_name || "") : String(i)).join(" ").toLowerCase();
            } catch(e){}
            matchText = (bk.lab_id || "").toLowerCase().includes(searchText) || testNames.includes(searchText);
        }
        let matchDate = searchDate === "" || (bk.date || "").includes(`${searchDate.split("-")[2]}-${searchDate.split("-")[1]}-${searchDate.split("-")[0]}`);
        return matchText && matchDate;
    });
    renderFilteredReports(filtered);
}

function renderFilteredReports(bookings) {
    const reportsTab = document.getElementById("reportsTabContainer"); let reportsHtml = ""; let hasReports = false;
    bookings.forEach(bk => {
        let onlinePdfArr = []; let handReportsArr = [];
        try { if (bk.report_pdf) onlinePdfArr = Array.isArray(JSON.parse(bk.report_pdf)) ? JSON.parse(bk.report_pdf) : [bk.report_pdf]; } catch(e) { onlinePdfArr = [bk.report_pdf]; }
        try { if (bk.hand_reports) handReportsArr = Array.isArray(JSON.parse(bk.hand_reports)) ? JSON.parse(bk.hand_reports) : [bk.hand_reports]; } catch(e) { handReportsArr = [bk.hand_reports]; }

        if (onlinePdfArr.length > 0 || handReportsArr.length > 0) {
            hasReports = true; let linksHtml = "";
            if(onlinePdfArr.length > 0) { onlinePdfArr.forEach((url, i) => { if(url && url.trim() !== "") linksHtml += `<a href="${url}" target="_blank" style="display:block; text-align:center; background:#e8f5e9; color:#2e7d32; padding:10px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:12px; margin-top:8px;"><i class="fas fa-cloud-download-alt"></i> Download E-Report ${i+1}</a>`; }); }
            if (handReportsArr.length > 0) {
                linksHtml += `<div style="font-size:11px; color:#d84315; margin-top:10px; font-weight:bold;">To Collect Physically (In-Hand):</div><ul style="margin:5px 0; padding-left:20px; font-size:12px; color:#d84315;">`;
                handReportsArr.forEach(srv => { if(srv && srv.trim() !== "") linksHtml += `<li>${srv}</li>`; }); linksHtml += `</ul>`;
            }
            reportsHtml += `
            <div style="background:#fff; border:1px solid #e0e6ed; border-left: 4px solid var(--success); border-radius:8px; padding:15px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><h5 style="margin:0; font-size:14px; color:var(--text-main);"><i class="fas fa-file-medical" style="color:var(--success);"></i> Order #${bk.order_id}</h5><span style="font-size:11px; color:var(--primary); font-weight:bold;">${bk.date.split(' ')[0]}</span></div>
                <div style="font-size:12px; color:var(--text-light); line-height:1.5;"><strong>Patient:</strong> ${bk.patient_name} <br><strong>Lab:</strong> ${bk.lab_id ? bk.lab_id.split('(')[0].trim() : 'N/A'}</div>${linksHtml}
            </div>`;
        }
    });
    if (!hasReports) reportsHtml += `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-folder-open" style="font-size: 40px; margin-bottom: 15px;"></i><p>No reports found.</p></div>`;
    if(reportsTab) reportsTab.innerHTML = reportsHtml;
}

async function fetchPatientConsults(userId) {
    const container = document.getElementById("patientConsultsContainer");
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getPatientConsults", user_id: userId }) });
        const result = await response.json();
        if (result.status === "success") { globalConsultsData = result.data; renderConsultCards(globalConsultsData); renderPrescriptionsTab(globalConsultsData); } 
        else { if(container) container.innerHTML = `<p style="color:red; text-align:center;">Failed to load consults: ${result.message}</p>`; }
    } catch(e) { if(container) container.innerHTML = `<p style="color:red; text-align:center;">Network error.</p>`; }
}

function renderConsultCards(consults) {
    const container = document.getElementById("patientConsultsContainer"); if (!container) return;
    if (consults.length === 0) { container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-stethoscope" style="font-size: 40px; margin-bottom: 15px;"></i><p>No doctor consultations found.</p></div>`; return; }

    let html = "";
    consults.forEach(c => {
        let safeStatus = (c.appt_status || "Pending").toString().toLowerCase().trim();
        let badgeClass = "status-warning"; let statusText = "Pending";
        
        if (safeStatus === "approved") { badgeClass = "status-primary"; statusText = "Approved"; } 
        else if (safeStatus === "completed") { badgeClass = "status-success"; statusText = "Completed"; } 
        else if (safeStatus.includes("no-show") || safeStatus.includes("cancel") || safeStatus === "cancelled") { badgeClass = "status-danger"; statusText = "Cancelled"; }

        let typeBadge = c.consult_type === "Online" ? "💻 Online Video" : "🏥 Clinic Visit";
        let joinBtnHtml = ""; let postConsultHtml = ""; let cancelBtnHtml = "";

        if (safeStatus === "pending" || safeStatus === "approved") {
            cancelBtnHtml = `<button onclick="openConsultCancelModal('${c.appt_id}')" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px; transition: 0.2s;">Cancel Appointment</button>`;
        }

        if (c.appt_status === "Approved" && c.consult_type === "Online") {
            if (c.handshake_status === "Patient_Ready") {
                joinBtnHtml = `<button onclick="joinVideoCall('${c.meet_link}', '${c.appt_id}')" style="background:#fd7e14; color:white; border:none; padding:10px; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px; animation: pulse 1.5s infinite;">📹 Join Video Call</button>`;
            } else if (c.handshake_status === "Doctor_Ready") {
                joinBtnHtml = `<div style="text-align:center; font-size:12px; color:#28a745; margin-top:10px; padding: 10px; background: #e8f5e9; border-radius: 8px; font-weight:bold;">Doctor is waiting. Please click "I Am Ready" from the popup.</div>`;
            } else {
                joinBtnHtml = `<div style="text-align:center; font-size:11px; color:#888; margin-top:10px; padding: 10px; background: #f8f9fa; border-radius: 8px;">Video call button will appear here when the doctor is ready.</div>`;
            }
        } 
        
        else if (safeStatus.includes("cancel") || safeStatus === "cancelled") { 
            badgeClass = "status-danger"; statusText = "Cancelled"; 
            let reasonHtml = (c.cancel_reason && c.cancel_reason !== "Payment Not Received") ? `<div style="background:#ffebee; color:#d32f2f; padding:8px 10px; border-radius:6px; font-size:12px; margin-top:10px; border:1px solid #ffcdd2;"><strong>Cancel Reason:</strong> ${c.cancel_reason}</div>` : "";
            let claimHtml = "";
            if (c.cancel_reason === "Payment Not Received" || c.refund_status === "No Refund (Not Paid)") {
                claimHtml = `
                <div style="margin-top:10px; padding: 12px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--danger); font-size:13px;">Your Payment Not Received</strong> 
                    <a href="../help/patient_help.html" style="color:#0056b3; font-weight:bold; font-size:13px; text-decoration:none; padding: 5px 10px; background: white; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><i class="fas fa-question-circle"></i> Get Help</a>
                </div>`;
            }
            else if (c.refund_status === "Action Required by Patient") {
                claimHtml = `<button onclick="openClaimRefundModal('${c.appt_id}')" style="background:#f57c00; color:white; border:none; padding:10px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px; animation: pulse 2s infinite;">💸 Click Here to Claim Refund</button>`;
            } 
            else if (c.refund_status && c.refund_status !== "No Refund (Not Paid)") {
                claimHtml = `<div style="font-size:12px; color:#2e7d32; margin-top:8px; font-weight:bold; background:#e8f5e9; padding:8px; border-radius:6px; text-align:center;">Refund Status: ${c.refund_status}</div>`;
            }
            postConsultHtml = reasonHtml + claimHtml;
        }

        else if (c.appt_status === "Completed") {
            let rxHtml = "";
            if (c.prescription_link) {
                let valText = c.validity_days ? `<br><span style="font-size:9px; color:#666;">Valid for ${c.validity_days}</span>` : "";
                rxHtml = `<div style="flex:1; text-align:center;"><button onclick="window.open('${c.prescription_link}', '_blank')" style="width:100%; background:#e8f5e9; color:#2e7d32; border:1px solid #2e7d32; padding:8px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;"><i class="fas fa-file-prescription"></i> View Rx</button>${valText}</div>`;
            }
            let revHtml = c.review ? `<div style="flex:1; text-align:center;"><button disabled style="width:100%; background:#f4f4f4; color:#aaa; border:1px solid #ddd; padding:8px; border-radius:6px; font-weight:bold; font-size:12px;"><i class="fas fa-star"></i> Reviewed</button></div>` : `<div style="flex:1; text-align:center;"><button onclick="openReviewModal('${c.appt_id}')" style="width:100%; background:#fff8e1; color:#f57c00; border:1px solid #f57c00; padding:8px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer;"><i class="fas fa-star"></i> Rate Doctor</button></div>`;
            postConsultHtml = `<div style="display:flex; gap:10px; margin-top:10px; align-items:flex-start;">${rxHtml}${revHtml}</div>`;
        }

        html += `
        <div style="background:#ffffff; border:1px solid #e0e0e0; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
                <div>
                    <div style="font-size:11px; color:#888; margin-bottom:2px;">Appt ID</div>
                    <strong style="color:#333; font-size:14px;">${c.appt_id}</strong>
                    <div style="margin-top:4px;"><strong style="font-size:14px; color:#2e7d32;">Dr. ${c.doctor_name}</strong></div>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${badgeClass}" style="margin-bottom:6px;">${statusText.toUpperCase()}</span><br>
                    <span style="font-size:11px; color:var(--primary); font-weight:bold;"><i class="far fa-calendar-alt"></i> ${c.appt_date} | ${c.appt_time}</span>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; background:#f8f9fa; padding:10px; border-radius:8px;">
                <div><strong>Type:</strong> ${typeBadge}</div>
                <div><strong>Fee Paid:</strong> ₹${c.fee_paid} <del style="font-size:10px; color:#999; margin-left:3px;">₹${c.total_mrp}</del></div>
            </div>
            ${joinBtnHtml}
            ${postConsultHtml}
            ${cancelBtnHtml}
        </div>`;
    });

    container.innerHTML = html;
}

function openConsultCancelModal(apptId) {
    document.getElementById("cancelConsultIdHidden").value = apptId; document.getElementById("cancelConsultReason").value = ""; document.getElementById("refundQrInput").value = "";
    document.querySelector('input[name="refundMethod"][value="Wallet"]').checked = true; toggleRefundMethod();
    document.getElementById("cancel-consult-modal").style.display = "block";
}

function toggleRefundMethod() {
    const method = document.querySelector('input[name="refundMethod"]:checked').value; const bankSection = document.getElementById("bankRefundSection");
    if (method === "Bank") { bankSection.style.display = "block"; } else { bankSection.style.display = "none"; }
}

async function submitCancelConsult() {
    const apptId = document.getElementById("cancelConsultIdHidden").value; const reason = document.getElementById("cancelConsultReason").value.trim(); const method = document.querySelector('input[name="refundMethod"]:checked').value; const qrInput = document.getElementById("refundQrInput"); const btn = document.getElementById("btnConfirmConsultCancel");
    if (!reason) { showToast("Please provide a reason for cancellation.", "error"); return; }
    let qrBase64 = ""; let qrMime = "";
    if (method === "Bank") {
        if (!qrInput.files || qrInput.files.length === 0) { showToast("Please upload your UPI QR Code for the bank refund.", "error"); return; }
        const file = qrInput.files[0]; try { qrBase64 = await getBase64(file); qrMime = file.type; } catch(e) { showToast("Failed to process QR image.", "error"); return; }
    }
    btn.innerText = "Processing..."; btn.disabled = true;
    try {
        const payload = { action: "cancelDoctorConsult", user_id: localStorage.getItem("bhavya_user_id"), appt_id: apptId, cancel_reason: reason, refund_choice: method, qr_base64: qrBase64, qr_mime: qrMime };
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.status === "success") { showToast("Appointment cancelled successfully. Refund method: " + method, "success"); document.getElementById("cancel-consult-modal").style.display = "none"; fetchPatientConsults(localStorage.getItem("bhavya_user_id")); checkLoginAndFetchData(); } 
        else { showToast("Error: " + result.message, "error"); }
    } catch(e) { showToast("Network error.", "error"); } finally { btn.innerText = "Confirm Cancellation"; btn.disabled = false; }
}

let currentRating = 0;
function openReviewModal(apptId) { document.getElementById("reviewApptIdHidden").value = apptId; document.getElementById("reviewCommentInput").value = ""; setRating(0); document.getElementById("review-modal").style.display = "block"; }
function setRating(stars) {
    currentRating = stars; const icons = document.getElementById("starRatingContainer").children;
    for(let i=0; i<icons.length; i++) { if(i < stars) { icons[i].classList.add("active"); icons[i].style.color = "#ffc107"; } else { icons[i].classList.remove("active"); icons[i].style.color = "#ddd"; } }
}

async function submitReview() {
    const apptId = document.getElementById("reviewApptIdHidden").value; const comment = document.getElementById("reviewCommentInput").value.trim(); const btn = document.getElementById("btnSubmitReview");
    if(currentRating === 0) { showToast("Please select a star rating.", "error"); return; }
    btn.innerText = "Submitting..."; btn.disabled = true;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "submitConsultReview", user_id: localStorage.getItem("bhavya_user_id"), appt_id: apptId, rating: currentRating, comment: comment }) });
        const result = await response.json();
        if (result.status === "success") { showToast("Thank you for your feedback!", "success"); document.getElementById("review-modal").style.display = "none"; fetchPatientConsults(localStorage.getItem("bhavya_user_id")); } 
        else { showToast("Error: " + result.message, "error"); }
    } catch(e) { showToast("Failed to submit review.", "error"); } finally { btn.innerText = "Submit Review"; btn.disabled = false; }
}

function renderPrescriptionsTab(consults) {
    const container = document.getElementById("prescriptionsTabContainer"); if (!container) return;
    let rxConsults = consults.filter(c => c.prescription_link && c.prescription_link !== "");
    if (rxConsults.length === 0) { container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ddd;"><i class="fas fa-file-excel" style="font-size: 40px; margin-bottom: 15px;"></i><p>No prescriptions available yet.</p></div>`; return; }

    let html = "";
    rxConsults.forEach(c => {
        let valText = c.validity_days ? `<span style="font-size:11px; background:#fff3cd; color:#856404; padding:2px 6px; border-radius:4px; margin-left:5px;">Valid: ${c.validity_days}</span>` : "";
        html += `
        <div class="list-item" style="border-bottom:1px solid #eee; padding:15px 0;">
            <div style="flex:1;"><h5 style="margin:0 0 5px 0; color:#333; font-size:15px;"><i class="fas fa-file-medical" style="color:#0056b3;"></i> Dr. ${c.doctor_name}</h5><p style="margin:0; font-size:12px; color:#777;"><i class="far fa-calendar-alt"></i> ${c.appt_date} | ${c.consult_type} ${valText}</p></div>
            <button onclick="window.open('${c.prescription_link}', '_blank')" style="background:#e8f5e9; color:#2e7d32; border:none; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.05);">Download</button>
        </div>`;
    });
    container.innerHTML = `<div style="background:#fff; padding:0 15px; border-radius:12px;">${html}</div>`;
}

function updateRecentActivityMixed() {
    let allActivity = [];
    
    globalBookingsData.forEach(bk => {
        let safeStatus = (bk.status || "pending").toString().toLowerCase().trim(); let isComplete = (safeStatus.includes("complete") || safeStatus === "completed");
        let badgeClass = "status-warning"; let statusText = "Pending";
        if (safeStatus.includes("confirm")) { badgeClass = "status-primary"; statusText = "Confirmed"; } else if (isComplete) { badgeClass = "status-success"; statusText = "Completed"; } else if (safeStatus.includes("cancel")) { badgeClass = "status-danger"; statusText = "Cancelled"; }
        let testSummary = "Lab Test";
        try { let cart = (typeof bk.cart_items === 'string') ? JSON.parse(bk.cart_items) : bk.cart_items; let items = Array.isArray(cart) ? cart : (cart.items || [cart]); testSummary = items.map(i => i.service_name || i.test_name || "Lab Test").join(", "); } catch(e) {}
        testSummary = testSummary.substring(0, 30) + (testSummary.length > 30 ? '...' : '');
        allActivity.push({ type: 'lab', id: bk.order_id, title: testSummary, dateTime: bk.date + " | " + bk.slot.split('-')[0], badgeClass: badgeClass, statusText: statusText, icon: '<i class="fas fa-microscope" style="color:var(--primary); font-size:18px;"></i>', timestamp: new Date(bk.date.split("-").reverse().join("-")).getTime() || 0 });
    });

    globalConsultsData.forEach(c => {
        let safeStatus = (c.appt_status || "Pending").toString().toLowerCase().trim();
        let badgeClass = "status-warning"; let statusText = "Pending";
        if (safeStatus === "approved") { badgeClass = "status-primary"; statusText = "Approved"; } else if (safeStatus === "completed") { badgeClass = "status-success"; statusText = "Completed"; } else if (safeStatus.includes("no-show") || safeStatus.includes("cancel") || safeStatus === "cancelled") { badgeClass = "status-danger"; statusText = "Cancelled"; }
        allActivity.push({ type: 'doctor', id: c.appt_id, title: "Dr. " + c.doctor_name, dateTime: c.appt_date + " | " + c.appt_time, badgeClass: badgeClass, statusText: statusText, icon: '<i class="fas fa-user-md" style="color:#2e7d32; font-size:18px;"></i>', timestamp: new Date(c.appt_date.split("-").reverse().join("-")).getTime() || 0 });
    });

    globalMedicineOrders.forEach(med => {
        let safeStatus = (med.patient_status || "Pending").toString().toLowerCase().trim();
        let badgeClass = "status-warning"; let statusText = "Pending";
        if (safeStatus === "confirmed") { badgeClass = "status-success"; statusText = "Confirmed"; }
        else if (safeStatus === "confirm_for_patient") { badgeClass = "status-primary"; statusText = "Action Needed"; }
        
        let medSummary = med.medicine_details || "Medicines";
        medSummary = medSummary.substring(0, 30) + (medSummary.length > 30 ? '...' : '');
        allActivity.push({ 
            type: 'medicine', id: med.order_id, title: medSummary, 
            dateTime: new Date(med.order_date).toLocaleDateString('en-IN') + " (Pharmacy)", 
            badgeClass: badgeClass, statusText: statusText, 
            icon: '<i class="fas fa-pills" style="color:#0056b3; font-size:18px;"></i>', 
            timestamp: new Date(med.order_date).getTime() || 0 
        });
    });

    allActivity.sort((a, b) => b.timestamp - a.timestamp);
    let recentHtml = "";
    allActivity.slice(0, 3).forEach(act => {
        recentHtml += `<div class="list-item"><div class="list-info" style="display:flex; gap:12px; align-items:center;"><div style="background:#f4f7f6; padding:10px; border-radius:10px;">${act.icon}</div><div><h5 style="font-size:14px; margin-bottom:3px;">${act.title}</h5><p style="color:var(--text-light); font-weight:bold; font-size:11px;"><i class="far fa-clock"></i> ${act.dateTime}</p></div></div><div style="text-align:right;"><span class="status-badge ${act.badgeClass}">${act.statusText}</span><div style="font-size:10px; color:#888; margin-top:3px; font-family:monospace;">${act.id}</div></div></div>`;
    });

    if (recentHtml === "") recentHtml = `<div style="text-align: center; padding: 20px; color: #aaa;">No recent activities.</div>`;
    const rcContainer = document.getElementById("recentActivityContainer"); if(rcContainer) rcContainer.innerHTML = recentHtml;
}

setInterval(silentPatientPolling, 30000);

async function silentPatientPolling() {
    const userId = localStorage.getItem("bhavya_user_id");
    if(!userId) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatientConsults", user_id: userId })
        });
        const result = await response.json();
        if (result.status === "success") {
            globalConsultsData = result.data;
            renderConsultCards(globalConsultsData); 
            checkPatientHandshakeTrigger();
        }
    } catch(e) { console.log("Silent patient poll failed"); }
}

function checkPatientHandshakeTrigger() {
    globalConsultsData.forEach(c => {
        if (c.appt_status === "Approved" && c.consult_type === "Online") {
            if (c.handshake_status === "Doctor_Ready" && !handledPatTriggers.has(c.appt_id)) {
                if (document.getElementById("patient-ready-modal").style.display !== "block") {
                    document.getElementById("patient-ready-modal").innerHTML = `
                        <div style="text-align: center; padding: 15px;">
                            <input type="hidden" id="readyApptIdHidden" value="${c.appt_id}">
                            <i class="fas fa-user-md" style="font-size: 40px; color: var(--success); margin-bottom:15px;"></i>
                            <h3 style="margin:0; color: #333; font-size: 22px;">Doctor is Ready!</h3>
                            <p style="color:#555; font-size:14px; margin-top:10px;">Your doctor is waiting in the clinic room. Please confirm your presence.</p>
                            <button style="background:var(--success); width:100%; color:white; border:none; font-weight:bold; padding:12px; border-radius:8px; cursor:pointer; margin-top:15px;" onclick="patientConfirmsReady()">I Am Ready</button>
                        </div>
                    `;
                    document.getElementById("patient-ready-modal").style.display = "block";
                    handledPatTriggers.add(c.appt_id); 
                }
            } 
        }
    });
}

async function patientConfirmsReady() {
    const apptId = document.getElementById("readyApptIdHidden").value;
    document.getElementById("patient-ready-modal").style.display = "none";
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "updateHandshakeStatus", appt_id: apptId, handshake_status: "Patient_Ready" })
        });
        const res = await response.json();
        if(res.status === "success") {
            const consult = globalConsultsData.find(c => c.appt_id == apptId);
            if(consult) consult.handshake_status = "Patient_Ready";
            renderConsultCards(globalConsultsData); 
        }
    } catch(e) { showToast("Network error while connecting.", "error"); }
}

function joinVideoCall(link, apptId) {
    if (!link || link === "" || link === "N/A") { showToast("Video link is not ready yet.", "error"); return; }
    
    activeVideoCallApptId = apptId;
    const patientName = localStorage.getItem("bhavya_name") || "Patient";
    const finalLink = link + "?name=" + encodeURIComponent(patientName);

    const modal = document.createElement('div');
    modal.id = "video-modal";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; flex-direction:column;";
    modal.innerHTML = `
        <div style="height:60px; background:#0056b3; color:white; display:flex; justify-content:space-between; align-items:center; padding:0 20px;">
            <h3 style="margin:0; font-size:18px;">BhavyaCare Secure Video Consult</h3>
            <button onclick="closeVideoCall()" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">End Call / Close</button>
        </div>
        <iframe src="${finalLink}" allow="camera; microphone; fullscreen; display-capture; autoplay" style="width:100%; flex-grow:1; border:none;"></iframe>
    `;
    document.body.appendChild(modal);
}

function closeVideoCall() {
    activeVideoCallApptId = null; 
    const modal = document.getElementById('video-modal');
    if (modal) modal.remove();
    fetchPatientConsults(localStorage.getItem("bhavya_user_id"));
}

function openClaimRefundModal(apptId) {
    document.getElementById("claimRefundApptId").value = apptId;
    document.getElementById("claimRefundQrInput").value = "";
    document.querySelector('input[name="claimRefundMethod"][value="Wallet"]').checked = true; 
    toggleClaimRefundMethod();
    document.getElementById("claim-refund-modal").style.display = "block";
}

function toggleClaimRefundMethod() {
    const method = document.querySelector('input[name="claimRefundMethod"]:checked').value;
    document.getElementById("claimBankRefundSection").style.display = method === "Bank" ? "block" : "none";
}

async function submitClaimRefund() {
    const apptId = document.getElementById("claimRefundApptId").value;
    const method = document.querySelector('input[name="claimRefundMethod"]:checked').value;
    const qrInput = document.getElementById("claimRefundQrInput");
    const btn = document.getElementById("btnConfirmClaim");

    let qrBase64 = ""; let qrMime = "";
    if (method === "Bank") {
        if (!qrInput.files || qrInput.files.length === 0) { showToast("Please upload your UPI QR Code for the bank refund.", "error"); return; }
        const file = qrInput.files[0]; try { qrBase64 = await getBase64(file); qrMime = file.type; } catch(e) { return; }
    }

    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        const payload = { action: "claimConsultRefund", user_id: localStorage.getItem("bhavya_user_id"), appt_id: apptId, refund_choice: method, qr_base64: qrBase64, qr_mime: qrMime };
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const result = await response.json();
        
        if (result.status === "success") { 
            showToast("Refund Claimed Successfully!", "success"); 
            document.getElementById("claim-refund-modal").style.display = "none"; 
            fetchPatientConsults(localStorage.getItem("bhavya_user_id")); 
            checkLoginAndFetchData(); 
        } else { showToast("Error: " + result.message, "error"); }
    } catch(e) { showToast("Network error.", "error"); } finally { btn.innerText = "Submit Refund Request"; btn.disabled = false; }
}
