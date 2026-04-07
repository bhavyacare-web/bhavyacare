// =======================================================
// MASTER FRONTEND JS (booking.js & cart.js UNIFIED)
// =======================================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

// --- SHARED GLOBALS ---
let cart = [];

// --- BOOKING PAGE GLOBALS ---
const categoryConfig = {
    'pathology': { name: 'Test', icon: '🩸' },
    'profile':   { name: 'Package', icon: '🩺' }, 
    'usg':       { name: 'Ultrasound', icon: '🖥️' },
    'xray':      { name: 'X-Ray', icon: '🩻' },
    'ct':        { name: 'CT Scan', icon: '☢️' },
    'mri':       { name: 'MRI', icon: '🧠' }, 
    'ecg':       { name: 'ECG', icon: '❤️' },
    'echo':      { name: 'ECHO', icon: '💓' }
};
const defaultIcon = '🧪';
const mainCategoryKeys = ['pathology', 'profile', 'usg', 'xray', 'ct', 'mri', 'ecg', 'echo'];
let allServices = [];
let userPlanStatus = "basic"; 
let currentCategory = 'profile'; 
let currentSubCategory = 'all'; 
let searchTimeout; 
let pollingInterval; 
let currentVipAmount = 3000;
let baseVipPrice = 3000;
let vipDiscount = 500;
let validReferrerId = "";

// --- CART PAGE GLOBALS ---
const homeServiceCategories = ['pathology', 'profile', 'package', 'ecg', 'blood test'];
let bookingData = { name: "", mobile: "", city: "", pincode: "", address: "", isVip: false };
let allActiveLabsList = []; 
let cartConfirmationResult; 
let appRules = {};
let userWalletBalance = 0;
let finalBill = { subtotal: 0, collectionCharge: 0, walletUsed: 0, refDiscount: 0, totalPayable: 0, refCode: "" };
let labSlots = {}; 

// =======================================================
// 🌟 INITIALIZATION & SMART ROUTER (CART EMPTY FIX) 🌟
// =======================================================
document.addEventListener('DOMContentLoaded', function() {
    loadUniversalCart();

    // Booking Page Route
    if (document.getElementById("mainCategories") || document.getElementById("servicesList")) {
        initBookingPage();
    }

    // Cart/Checkout Page Route
    if (document.getElementById("cartItemsContainer") || document.getElementById("step1-card")) {
        initCartPage();
    }
});

window.addEventListener('pageshow', function(event) {
    if (event.persisted) { window.location.reload(); }
});

function loadUniversalCart() {
    try {
        let stored = localStorage.getItem('bhavyaCart');
        if (stored) {
            let parsed = JSON.parse(stored);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed); 
            if (Array.isArray(parsed) && parsed.length > 0) {
                cart = parsed.filter(item => item !== null && typeof item === 'object' && item.service_id)
                             .map(item => ({...item, qty: item.qty || 1})); 
            } else { cart = []; }
        } else { cart = []; }
    } catch (e) { console.error("Cart Load Error", e); cart = []; }
}

function initBookingPage() {
    updateCartUI(); 
    fetchBookingData();

    const pendingFlag = localStorage.getItem("pending_vip_redirect");
    const userId = localStorage.getItem("bhavya_user_id");
    if (pendingFlag === "true" && userId) {
        localStorage.removeItem("pending_vip_redirect");
        openVipFormModal();
    }
}

function initCartPage() {
    if(cart.length === 0) { showEmptyCart(); return; }

    let s2 = document.getElementById('step2-card');
    let step1Nav = document.getElementById('step1-nav');
    if(s2 && step1Nav && step1Nav.classList.contains('completed')) {
        s2.style.display = 'block';
    }

    calculateFinalBill(); 

    const userId = localStorage.getItem("bhavya_user_id");
    if (userId) { fetchProfile(userId); } 
    else { 
        let loader = document.getElementById('loadingOverlay');
        if(loader) loader.style.display = 'none'; 
    }
}

// =======================================================
// 🌟 BOOKING PAGE LOGIC 🌟
// =======================================================
function formatText(text) {
    if (!text) return "";
    let cleanText = String(text).replace(/_/g, ' '); 
    let formatted = cleanText.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const acronyms = /\b(cbc|esr|usg|mri|ecg|echo|ct|lft|kft|hba1c|tsh|t3|t4|ana|psa|hiv|hcv|bun|aptt|sgpt|sgot|vdrl|rbc|wbc|bchg|aec|anc|amh|ada|hbsag|crp|abp|ncv|emg|ssep|dlco|eeg|pft)\b/gi;
    return formatted.replace(acronyms, match => match.toUpperCase());
}

function formatPrice(price) { return (!price || isNaN(price)) ? 0 : parseFloat(Number(price).toFixed(2)); }

function fetchBookingData() {
    const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id"); 
    const cachedServices = localStorage.getItem("bhavya_services_cache");
    const cachedPlan = localStorage.getItem("bhavya_plan_cache");
    
    if (cachedServices) {
        allServices = JSON.parse(cachedServices);
        userPlanStatus = cachedPlan || "basic";
        let loader = document.getElementById("loading");
        if(loader) loader.style.display = "none";
        handleBannerDisplay();
        renderCategories();
        renderServices();
    }

    fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "getBookingData", user_id: userId }) })
    .then(res => res.json())
    .then(response => {
        if(response.status === "success") {
            allServices = response.data.services;
            userPlanStatus = response.data.userPlan;
            
            let claimBanner = document.getElementById("vipClaimBanner");
            if (claimBanner) {
                if (response.data.vipPackageStatus === "pending" && userPlanStatus === "vip") {
                    claimBanner.style.display = "block";
                } else {
                    claimBanner.style.display = "none";
                }
            }
            
            localStorage.setItem("bhavya_services_cache", JSON.stringify(allServices));
            localStorage.setItem("bhavya_plan_cache", userPlanStatus);
            
            let loader = document.getElementById("loading");
            if(loader) loader.style.display = "none";
            handleBannerDisplay();
            renderCategories();
            renderServices(); 
        }
    }).catch(error => { 
        let loader = document.getElementById("loading");
        if(!cachedServices && loader) loader.innerHTML = "Failed to load data."; 
    });
}

function handleBannerDisplay() {
    const banner = document.getElementById("pendingWarningBanner");
    if(!banner) return;
    if (userPlanStatus === "pending") {
        banner.style.display = "block";
        startVipPolling(); 
    } else {
        banner.style.display = "none";
        if(pollingInterval) clearInterval(pollingInterval);
    }
}

function startVipPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id"); 
        if (!userId) return;
        
        fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "checkVipStatus", user_id: userId }) })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                const status = data.data.status;
                if (status === "active") {
                    userPlanStatus = "vip"; 
                    localStorage.setItem("bhavya_plan_cache", "vip");
                    handleBannerDisplay(); 
                    fetchBookingData(); 
                    renderServices(); 
                    clearInterval(pollingInterval);
                } else if (status === "rejected") {
                    userPlanStatus = "basic"; 
                    localStorage.setItem("bhavya_plan_cache", "basic");
                    handleBannerDisplay();
                    renderServices();
                    clearInterval(pollingInterval);
                }
            }
        }).catch(err => {});
    }, 15000); 
}

function renderCategories() {
    const mainContainer = document.getElementById("mainCategories");
    const sliderContainer = document.getElementById("dynamicCategorySlider");
    if(!mainContainer) return;
    
    let mainHtml = "";
    let sliderHtml = "";
    let filteredTypes = allServices.filter(s => s.service_id !== "VIP-FREE-001");
    const existingTypes = [...new Set(filteredTypes.map(s => String(s.service_type || '').toLowerCase().trim()))];

    mainCategoryKeys.forEach(key => {
        let config = categoryConfig[key] || { name: formatText(key), icon: defaultIcon };
        let isPresent = existingTypes.includes(key);
        let isSelected = currentCategory === key ? 'selected' : '';
        
        if(isPresent) {
            mainHtml += `<div class="cat-card ${isSelected}" onclick="selectCategory('${key}')">
                            <div class="cat-icon">${config.icon}</div>
                            <span class="cat-name">${config.name}</span>
                         </div>`;
        }
    });
    mainContainer.innerHTML = mainHtml;

    let hasNewCategories = false;
    existingTypes.forEach(key => {
        if (!key) return; 
        if (mainCategoryKeys.includes(key)) return; 
        
        hasNewCategories = true;
        let isActive = currentCategory === key ? 'active' : '';
        let config = categoryConfig[key] || { name: formatText(key), icon: defaultIcon };
        
        sliderHtml += `<button class="sub-cat-btn ${isActive}" onclick="selectCategory('${key}')" style="display:flex; align-items:center; gap:5px;">
                          <span>${config.icon}</span> ${config.name}
                       </button>`;
    });

    if (sliderContainer) {
        if (hasNewCategories) {
            sliderContainer.innerHTML = sliderHtml;
            sliderContainer.style.display = "flex";
        } else {
            sliderContainer.innerHTML = "";
            sliderContainer.style.display = "none";
        }
    }
}

function selectCategory(categoryKey) {
    currentCategory = categoryKey; currentSubCategory = 'all';
    let searchInp = document.getElementById("searchInput");
    if(searchInp) searchInp.value = ""; 
    renderCategories(); renderServices();
}

function selectSubCategory(subCat) { currentSubCategory = subCat; renderServices(); }

function filterServices() {
    clearTimeout(searchTimeout); 
    let searchInp = document.getElementById("searchInput");
    if(!searchInp) return;
    searchTimeout = setTimeout(() => { renderServices(searchInp.value.toLowerCase()); }, 300); 
}

function renderServices(searchQuery = "") {
    const container = document.getElementById("servicesList");
    const subContainer = document.getElementById("subCategoryContainer");
    if(!container) return;
    
    let displayServices = allServices.filter(s => s.service_id !== "VIP-FREE-001");
    let filtered = displayServices.filter(s => String(s.service_type || '').toLowerCase().trim() === currentCategory);

    if (currentCategory === 'profile' && !searchQuery) {
        let subCats = ['all', ...new Set(filtered.map(s => String(s.service_category || 'Other').trim()))];
        let subHtml = `<div class="sub-cat-nav">`;
        subCats.forEach(sc => {
            let active = currentSubCategory === sc ? 'active' : '';
            subHtml += `<button class="sub-cat-btn ${active}" onclick="selectSubCategory('${sc}')">${formatText(sc)}</button>`;
        });
        subHtml += `</div>`;
        if(subContainer) subContainer.innerHTML = subHtml;

        if (currentSubCategory !== 'all') { filtered = filtered.filter(s => String(s.service_category || 'Other').trim() === currentSubCategory); }
    } else { 
        if(subContainer) subContainer.innerHTML = ""; 
    }

    if (searchQuery) {
        filtered = displayServices.filter(s => 
            String(s.service_name || '').toLowerCase().includes(searchQuery) || 
            String(s.service_id || '').toLowerCase().includes(searchQuery) ||
            String(s.description || '').toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding:40px;'><i class='fas fa-search' style='font-size:30px; color:#cbd5e1; margin-bottom:15px;'></i><br><span style='color:var(--text-muted); font-weight:500;'>No tests found.</span></div>";
        return;
    }

    let htmlContent = "";

    filtered.forEach(service => {
        const isVip = (userPlanStatus === "vip" || userPlanStatus === "pending");
        const totalMrp = formatPrice(service.service_price);
        const basicPrice = formatPrice(service.basic_price);
        const vipPrice = formatPrice(service.vip_price);
        const applicablePrice = isVip ? vipPrice : basicPrice;
        
        const s_id = String(service.service_id).replace(/'/g, "\\'");
        const cartItem = cart.find(item => String(item.service_id) === String(service.service_id));
        const inCart = !!cartItem;
        const currentQty = cartItem ? cartItem.qty : 0;
        
        const cleanName = formatText(service.service_name).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const cleanType = String(service.service_type || '').replace(/'/g, "\\'");
        const cleanCat = formatText(service.service_category);

        let actionBtnHtml = "";
        if (inCart) {
            actionBtnHtml = `<div class="qty-control"><button onclick="updateQty('${s_id}', -1, ${applicablePrice}, '${cleanName}', '${cleanType}')"><i class="fas fa-minus"></i></button><span class="qty-text">${currentQty}</span><button onclick="updateQty('${s_id}', 1, ${applicablePrice}, '${cleanName}', '${cleanType}')"><i class="fas fa-plus"></i></button></div>`;
        } else {
            actionBtnHtml = `<button class="add-to-cart-btn" onclick="updateQty('${s_id}', 1, ${applicablePrice}, '${cleanName}', '${cleanType}')">ADD +</button>`;
        }

        let pricingHtml = "";
        if (isVip) {
            pricingHtml = `<div class="mrp-row"><span>Total: <span class="mrp">₹${totalMrp}</span></span><span style="margin-left:8px;">Basic: <span class="mrp">₹${basicPrice}</span></span></div><div class="final-price">₹${vipPrice} <i class="fas fa-crown" style="color:var(--warning); font-size:14px;"></i></div>`;
        } else {
            pricingHtml = `<div class="mrp-row"><span>Total: <span class="mrp">₹${totalMrp}</span></span></div><div class="final-price">₹${basicPrice} <span style="font-size:10px; font-weight:800; background:var(--primary-light); color:var(--primary); padding:2px 6px; border-radius:4px; transform:translateY(-2px);">BASIC</span></div><div class="locked-price" onclick="openVipPromo()"><i class="fas fa-lock" style="font-size:10px;"></i> VIP Rate: ₹${vipPrice}</div>`;
        }

        let sTypeLowerCase = String(service.service_type || '').toLowerCase().trim();
        let isPackageOrProfile = (sTypeLowerCase === 'profile' || sTypeLowerCase === 'package');

        if (isPackageOrProfile) {
            let descPreviewHtml = "";
            let descRaw = String(service.description || '');
            if (descRaw.trim() !== "") {
                let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
                if (items.length > 0) {
                    let previewItems = items.slice(0, 2).map(i => formatText(i.trim()));
                    let moreText = service.number_of_test ? `+ ${service.number_of_test} Parameters` : (items.length > 2 ? "View All Details" : "");
                    descPreviewHtml = `<div class="desc-preview"><ul>${previewItems.map(i => `<li>${i}</li>`).join('')}</ul>${moreText ? `<div class="view-more-btn" onclick="openModal('${s_id}')">${moreText}</div>` : ''}</div>`;
                }
            }

            htmlContent += `<div class="profile-item"><div class="profile-header"><span class="profile-badge">${cleanCat}</span>${service.number_of_test ? `<span class="param-badge"><i class="fas fa-microscope"></i> ${service.number_of_test} Tests</span>` : ''}</div><div class="service-info"><h3>${cleanName}</h3>${descPreviewHtml}</div><div class="price-action-row"><div class="price-box">${pricingHtml}</div><div class="action-container">${actionBtnHtml}</div></div></div>`;
        } else {
            let catIcon = categoryConfig[sTypeLowerCase]?.icon || defaultIcon;
            let imgStr = service.service_image ? String(service.service_image).trim() : "";
            let imageHtml = imgStr !== "" ? `<img src="${imgStr}" onerror="this.style.display='none'; this.parentNode.innerHTML='${catIcon}';">` : catIcon;

            htmlContent += `<div class="service-item"><div class="service-img-box">${imageHtml}</div><div class="service-info-normal" style="flex-grow:1; min-width:0; padding-right:5px;"><h3 style="font-size:14px; margin-bottom:6px;">${cleanName}</h3><div class="price-box">${pricingHtml}</div></div><div class="action-container">${actionBtnHtml}</div></div>`;
        }
    });
    container.innerHTML = htmlContent;
}

function updateQty(id, change, price, name, type) {
    id = String(id);
    let index = cart.findIndex(item => String(item.service_id) === id);
    if (index > -1) {
        cart[index].qty += change;
        if (cart[index].qty <= 0) cart.splice(index, 1); 
    } else if (change > 0) { 
        cart.push({ service_id: id, service_name: name, price: price, qty: 1, service_type: type }); 
    }
    
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    updateCartUI(); 
    
    let searchInp = document.getElementById("searchInput");
    renderServices(searchInp ? searchInp.value : ""); 
}

function updateCartUI() {
    const topCartBtn = document.getElementById("topCartBtn"); 
    const cartBar = document.getElementById("bottomCartBar"); 
    const cartText = document.getElementById("bottomCartText");
    
    if(!topCartBtn || !cartBar || !cartText) return; 

    let totalItems = cart.reduce((sum, item) => sum + item.qty, 0); 
    let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    topCartBtn.innerText = `🛒 Cart (${totalItems})`;
    if (totalItems > 0) {
        cartText.innerHTML = `${totalItems} Item${totalItems > 1 ? 's' : ''} <span style="color:#cbd5e1; margin:0 8px;">|</span> ₹${totalPrice}`;
        cartBar.classList.add("visible");
    } else { cartBar.classList.remove("visible"); }
}

function openModal(serviceId) {
    const service = allServices.find(s => s.service_id === serviceId);
    if (!service) return alert("Details not loaded yet.");
    
    document.getElementById("modalTitle").innerText = formatText(service.service_name);
    let descRaw = String(service.description || '');
    let formattedDesc = "<p style='text-align:center;'>No details available.</p>";
    if (descRaw.trim() !== "") {
        let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
        formattedDesc = "<ul>" + items.map(i => `<li style="margin-bottom:6px; border-bottom:1px dashed #eee; padding-bottom:4px;">${formatText(i.trim())}</li>`).join('') + "</ul>";
        if (service.number_of_test) {
            formattedDesc = `<div style="background:#e0f2fe; color:#0284c7; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:12px; margin-bottom:15px; display:inline-block;"><i class="fas fa-microscope"></i> Includes ${service.number_of_test} Parameters</div>` + formattedDesc;
        }
    }
    document.getElementById("modalBody").innerHTML = formattedDesc; 
    document.getElementById("infoModal").classList.add("active");
}

function closeModal() { document.getElementById("infoModal").classList.remove("active"); }

function openVipPromo() { 
    document.getElementById("vipPromoModal").classList.add("active"); 
    document.getElementById("vipPromoPincode").value = "";
    document.getElementById("vipPromoPincodeMsg").style.display = "none";
}
function closeVipPromo() { document.getElementById("vipPromoModal").classList.remove("active"); }

function openVipFormModal() {
    document.getElementById("vipFormModal").classList.add("active");
    const savedName = localStorage.getItem("bhavya_name") || "Self";
    document.getElementById("vipMem1").value = savedName;
    updateVipPayableUI();
}
function closeVipFormModal() { document.getElementById("vipFormModal").classList.remove("active"); }

async function handleVipPromoClick() {
    const pincode = document.getElementById("vipPromoPincode").value.trim();
    const msg = document.getElementById("vipPromoPincodeMsg");
    const btn = document.getElementById("vipPromoCheckBtn");

    if(pincode.length !== 6) {
        msg.style.display = "block"; msg.style.color = "var(--danger)";
        msg.innerHTML = "Please enter a valid 6-digit pincode."; return;
    }

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Checking...`; btn.disabled = true;

    try {
        const response = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "checkVipPincode", pincode: pincode }) });
        const res = await response.json();

        if (res.status === "success") {
            msg.style.display = "block"; msg.style.color = "var(--success)";
            msg.innerHTML = "<i class='fas fa-check-circle'></i> Service Available! Proceeding...";
            
            setTimeout(() => {
                const userId = localStorage.getItem("bhavya_user_id");
                if (userId) { closeVipPromo(); openVipFormModal(); } 
                else {
                    localStorage.setItem("pending_vip_redirect", "true");
                    closeVipPromo();
                    if (typeof openPatientLogin === "function") { openPatientLogin(); } else { alert("Please login first."); }
                }
                btn.innerHTML = `<i class="fas fa-crown"></i> Activate Now`; btn.disabled = false;
            }, 800);
        } else {
            msg.style.display = "block"; msg.style.color = "var(--danger)";
            msg.innerHTML = `<i class='fas fa-times-circle'></i> ${res.message || "VIP Plan is not available in this pincode yet."}`;
            btn.innerHTML = `<i class="fas fa-crown"></i> Activate Now`; btn.disabled = false;
        }
    } catch(err) {
        msg.style.display = "block"; msg.style.color = "var(--danger)"; msg.innerHTML = "Network error.";
        btn.innerHTML = `<i class="fas fa-crown"></i> Activate Now`; btn.disabled = false;
    }
}

function updateVipPayableUI() {
    document.getElementById('vipFinalAmount').innerText = currentVipAmount;
    const upiUrl = `upi://pay?pa=8950112467@ptsbi&pn=BhavyaCare&am=${currentVipAmount}&cu=INR&tn=VIP%20Subscription`;
    document.getElementById("upiPaymentBtn").href = upiUrl;
}

async function applyVipPromo() {
    const code = document.getElementById("vipRefCode").value.trim().toUpperCase();
    const msg = document.getElementById("vipRefMsg");
    if (!code) { msg.style.display="block"; msg.style.color="var(--danger)"; msg.innerText="Enter code first!"; return; }
    
    try {
        const res = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getVipRulesAndReferral", user_id: localStorage.getItem("bhavya_user_id"), referral_code: code }) });
        const data = await res.json();
        if (data.status === "success" && data.data.validReferral) {
            validReferrerId = data.data.referrer_id; 
            currentVipAmount = baseVipPrice - vipDiscount; 
            updateVipPayableUI();
            msg.style.display="block"; msg.style.color="var(--success)"; msg.innerHTML=`<i class="fas fa-check-circle"></i> ₹${vipDiscount} discount applied!`;
        } else {
            msg.style.display="block"; msg.style.color="var(--danger)"; msg.innerHTML=`<i class="fas fa-times-circle"></i> ${data.message || "Invalid Code"}`;
            currentVipAmount = baseVipPrice; updateVipPayableUI();
        }
    } catch(err) { msg.style.display="block"; msg.style.color="var(--danger)"; msg.innerText="Error checking code."; }
}

function updateFileName() {
    const fileInput = document.getElementById('vipScreenshot');
    const btnText = document.getElementById('fileUploadBtnText');
    if (fileInput.files.length > 0) {
        btnText.innerHTML = `<i class="fas fa-check-circle" style="color:var(--success);"></i> ${fileInput.files[0].name}`;
        btnText.style.borderColor = "var(--success)"; btnText.style.background = "#f0fdf4";
    }
}

const screenInput = document.getElementById("vipScreenshot");
if (screenInput) {
    screenInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image(); img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement("canvas");
                const scaleSize = 600 / img.width; 
                canvas.width = 600; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                document.getElementById("vipScreenshotBase64").value = canvas.toDataURL("image/jpeg", 0.7);
            }
        }
    });
}

function submitVipApplicationForm() {
    const txnId = document.getElementById('vipTxnId').value.trim();
    const screenshot = document.getElementById('vipScreenshotBase64').value;
    
    if(!screenshot) { alert("Please upload the payment screenshot. It is mandatory."); return; }

    const btn = document.getElementById('submitVipBtn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Submitting...`; btn.disabled = true;

    const payload = {
        action: "submitVipApplication",
        user_id: localStorage.getItem("bhavya_user_id"),
        member1_name: document.getElementById("vipMem1").value,
        member2_name: document.getElementById("vipMem2").value.trim(),
        member3_name: document.getElementById("vipMem3").value.trim(),
        referrer_user_id: validReferrerId,
        payment_mode: "online", 
        payment_id: txnId,
        payment_screenshot: screenshot,
        amount_paid: currentVipAmount
    };

    fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            alert("VIP Application Submitted! Your plan is under review.");
            userPlanStatus = "pending"; 
            localStorage.setItem("bhavya_plan_cache", "pending"); 
            closeVipFormModal();
            handleBannerDisplay(); 
            renderServices(); 
        } else { alert("Error: " + res.message); }
    }).catch(error => { alert("Network error."); })
    .finally(() => { btn.innerHTML = `Submit Application <i class="fas fa-arrow-right"></i>`; btn.disabled = false; });
}

// 🌟 CART EMPTY FIX: Removed setTimeout to make it save & load instantly
function openCart() { 
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    window.location.href = "../cart/cart.html"; 
}

function handleHomeNavigation() {
    const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id");
    if (userId) { window.location.href = '../patient_dashboard/patient_dashboard.html'; } 
    else { window.location.href = '../index.html'; }
}

function claimVipPackage() {
    const vipPackageId = "VIP-FREE-001"; 
    const service = allServices.find(s => String(s.service_id) === vipPackageId);
    if (service) {
        updateQty(service.service_id, 1, 0, service.service_name, service.service_type);
        openCart();
    } else { alert("Loading... Please wait a second or contact Admin."); }
}

// =======================================================
// 🌟 CART & CHECKOUT PAGE LOGIC 🌟
// =======================================================
function showEmptyCart() {
    let container = document.querySelector('.container');
    if(container) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px 20px;">
                <i class="fas fa-shopping-cart" style="font-size: 50px; color: var(--border); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text-main);">Your Cart is Empty</h3>
                <p style="font-size:13px; color:var(--text-muted);">Please add tests from the booking page to proceed.</p>
                <a href="../index.html" class="btn-main" style="display: inline-block; margin-top: 15px; width: auto; text-decoration:none;">Go to Home</a>
            </div>`;
    }
    let loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.style.display = 'none';
    
    ['step1-card', 'step2-card', 'step3-card', 'dateTimeSection'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    let bottomBar = document.querySelector('.bottom-bar');
    if(bottomBar) bottomBar.style.display = 'none';
}

function fetchProfile(userId) {
    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getPatientCheckoutProfile", user_id: userId }) })
    .then(res => res.json())
    .then(res => {
        let loader = document.getElementById('loadingOverlay');
        if(loader) loader.style.display = 'none';

        if(res.status === "success") {
            const data = res.data;
            bookingData.mobile = data.mobile;
            bookingData.isVip = data.isVip; 
            
            let uMob = document.getElementById('uMobile');
            if(uMob) { uMob.value = data.mobile; uMob.setAttribute("readonly", true); }
            
            let uPin = document.getElementById('uPincode');
            if(uPin) uPin.value = data.pincode;
            
            let uAddr = document.getElementById('uAddress');
            if(uAddr) uAddr.value = data.address;

            const nameBox = document.getElementById('nameInputBox');
            if(nameBox) {
                if(data.isVip && data.vipMembers && data.vipMembers.length > 0) {
                    let badge = document.getElementById('vipBadge');
                    if(badge) badge.innerHTML = '<span style="background:var(--warning); color:white; font-size:10px; padding:4px 8px; border-radius:12px; margin-left: 10px;"><i class="fas fa-crown"></i> VIP Active</span>';
                    let opts = data.vipMembers.map(m => `<option value="${m}">${m}</option>`).join('');
                    nameBox.innerHTML = `<select id="uName" class="form-input">${opts}</select>`;
                } else {
                    nameBox.innerHTML = `<input type="text" id="uName" class="form-input" value="${data.name}" placeholder="Patient Name">`;
                }
            }
        }
    }).catch(e => { 
        let loader = document.getElementById('loadingOverlay');
        if(loader) loader.style.display = 'none'; 
    });

    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getCartRulesAndWallet", user_id: userId }) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            appRules = res.data.rules || {};
            userWalletBalance = res.data.wallet_balance || 0;
            let walletTxt = document.getElementById('walletBalTxt');
            if(walletTxt) walletTxt.innerText = userWalletBalance;
            calculateFinalBill(); 
        }
    });
}

function savePatientInfo() {
    const name = document.getElementById('uName').value.trim();
    const mobile = document.getElementById('uMobile').value.trim();
    const city = document.getElementById('uCity').value.trim();
    const pin = document.getElementById('uPincode').value.trim();
    const addr = document.getElementById('uAddress').value.trim();

    if(!name || !city || pin.length < 6 || mobile.length < 10) return alert("Please enter valid Name, 10-digit Mobile, City, and 6-digit Pincode.");

    bookingData.name = name;
    bookingData.mobile = mobile;
    bookingData.city = city.toLowerCase();
    bookingData.pincode = pin;
    bookingData.address = addr;

    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if(!item.fulfillment) item.fulfillment = homeServiceCategories.includes(type) ? "home" : "center";
    });

    document.getElementById('step1-nav').classList.add('completed');
    document.getElementById('step2-nav').classList.add('active');
    document.getElementById('sumName').innerText = bookingData.name;
    document.getElementById('sumMobile').innerText = "+91 " + bookingData.mobile;
    document.getElementById('sumCityPin').innerText = `${city.toUpperCase()} - ${pin}`;
    document.getElementById('sumAddress').innerText = bookingData.address;
    document.getElementById('infoForm').style.display = 'none';
    document.getElementById('infoSummary').style.display = 'block';
    
    const s2 = document.getElementById('step2-card');
    s2.style.display = 'block'; s2.style.opacity = '1'; s2.style.pointerEvents = 'auto';
    
    fetchLabs(); 
}

function editPatientInfo() {
    document.getElementById('infoForm').style.display = 'block';
    document.getElementById('infoSummary').style.display = 'none';
    const s2 = document.getElementById('step2-card');
    s2.style.opacity = '0.5'; s2.style.pointerEvents = 'none';
    validateCheckout();
}

function fetchLabs() {
    let spinner = document.getElementById('loadingLabsSpinner');
    if (spinner) spinner.style.display = 'block';
    document.getElementById('cartItemsContainer').innerHTML = "";

    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "getAllActiveLabs" }) })
    .then(res => res.json())
    .then(res => {
        if (spinner) spinner.style.display = 'none';
        if(res.status === "success") {
            allActiveLabsList = res.data.labs;

            let canServiceAnything = false;
            let containsVipOnly = true;

            cart.forEach(item => {
                if (item.service_id === "VIP-FREE-001") {
                    canServiceAnything = true;
                    return; 
                }
                containsVipOnly = false;
                let type = (item.service_type || "pathology").toLowerCase().trim();
                let labsForSvc = allActiveLabsList.filter(l => l.provided_services[type] === true);
                
                let matchHome = labsForSvc.some(l => l.pincode === bookingData.pincode || l.available_pincodes.includes(bookingData.pincode));
                let matchCity = labsForSvc.some(l => l.city === bookingData.city || l.available_cities.includes(bookingData.city));

                if (matchHome || matchCity) { canServiceAnything = true; }
            });

            if (!canServiceAnything && !containsVipOnly) {
                alert("No provider found in your area for service");
                window.location.href = "../index.html"; 
                return;
            }

            autoAssignGroupLabs(); 
            renderGroupedCart(); 
        } else alert("Error fetching labs.");
    }).catch(e => {
        if (spinner) spinner.style.display = 'none';
        alert("Network Error.");
    });
}

function autoAssignGroupLabs() {
    let assignedLabs = {}; 
    cart.forEach(item => {
        if (item.service_id === "VIP-FREE-001") {
            item.selected_lab_id = "BHAVYACARE-INTERNAL";
            item.fulfillment = "home"; 
            return;
        }

        let type = (item.service_type || "pathology").toLowerCase().trim();
        let allLabsForSvc = allActiveLabsList.filter(lab => lab.provided_services[type] === true);

        let homeEligibleLabs = allLabsForSvc.filter(lab => lab.available_pincodes.includes(bookingData.pincode) || lab.pincode === bookingData.pincode);
        let cityEligibleLabs = allLabsForSvc.filter(lab => lab.city === bookingData.city || lab.available_cities.includes(bookingData.city));

        let eligibleLabs = [];

        if (item.fulfillment === "home") {
            if (homeEligibleLabs.length === 0 && cityEligibleLabs.length > 0) {
                item.fulfillment = "center";
                eligibleLabs = cityEligibleLabs;
            } else if (homeEligibleLabs.length > 0) {
                eligibleLabs = homeEligibleLabs;
            }
        } else {
            eligibleLabs = cityEligibleLabs.length > 0 ? cityEligibleLabs : homeEligibleLabs;
        }

        if (eligibleLabs.length > 0) {
            if (!assignedLabs[type]) {
                let existingValidLab = eligibleLabs.find(l => String(l.lab_id) === String(item.selected_lab_id));
                assignedLabs[type] = existingValidLab ? String(existingValidLab.lab_id) : String(eligibleLabs[0].lab_id);
            }
            item.selected_lab_id = assignedLabs[type];
        } else {
            item.selected_lab_id = null; 
        }
    });
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
}

function renderGroupedCart() {
    let html = ""; 
    let groupedCart = {};

    cart.forEach((item, index) => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if (item.service_id === "VIP-FREE-001") { type = "vip sponsored"; }

        if(!groupedCart[type]) {
            groupedCart[type] = {
                items: [],
                fulfillment: item.fulfillment || (homeServiceCategories.includes(type) || type === "vip sponsored" ? "home" : "center"),
                selected_lab_id: item.service_id === "VIP-FREE-001" ? "BHAVYACARE-INTERNAL" : item.selected_lab_id
            };
        }
        groupedCart[type].items.push({ ...item, originalIndex: index });
    });

    for (const [type, group] of Object.entries(groupedCart)) {
        let isVipGroup = type === "vip sponsored";
        let groupTitle = isVipGroup ? '<i class="fas fa-gift" style="color:var(--warning);"></i> VIP Package' : `<i class="fas fa-notes-medical"></i> ${type} Booking`;

        html += `<div class="group-container">
                    <div class="group-header">${groupTitle}</div>`;

        group.items.forEach(item => {
            let itemPrice = Number(item.price || item.service_price || item.basic_price || 0);
            html += `
                <div class="cart-item-header" style="margin-bottom: 12px;">
                    <div class="item-title-box">
                        <strong style="font-size:14px; color: var(--text-main);">${item.service_name} <span style="color:var(--text-muted); font-size:12px;">(x${item.qty || 1})</span></strong>
                    </div>
                    <div class="price-box" style="display:flex; align-items:center;">
                        <strong style="color:var(--success); font-size: 15px;">₹${itemPrice * (item.qty || 1)}</strong>
                        <button class="btn-remove-item" onclick="removeCartItem(${item.originalIndex})" title="Remove"><i class="fas fa-times"></i></button>
                    </div>
                </div>`;
        });

        if (isVipGroup) {
            html += `
            <div style="background: var(--primary-soft); border: 1px solid #bfdbfe; border-radius: 12px; padding: 15px; margin-top: 15px;">
                <p style="font-size:12px; font-weight:800; color:var(--primary); margin: 0 0 10px 0; text-transform:uppercase;"><i class="fas fa-star" style="color:var(--warning);"></i> Handled Internally</p>
                <div class="lab-card selected" style="border-color: var(--primary); background: #ffffff; margin-bottom: 0; cursor: default;">
                    <div class="lab-img" style="background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                        <i class="fas fa-heartbeat"></i>
                    </div>
                    <div class="lab-info">
                        <h4 class="lab-name" style="color: var(--primary);">BhavyaCare Nodal Center <span class="badge-small" style="background:var(--warning); color:white;">SPONSORED</span></h4>
                        <p class="lab-addr" style="color: var(--text-muted);"><i class="fas fa-check-circle" style="color:var(--success);"></i> Free Home Collection Included</p>
                    </div>
                </div>
            </div></div>`;
            continue; 
        }

        let isHomeEligible = homeServiceCategories.includes(type);
        let isHome = group.fulfillment === "home";
        
        let allLabsForSvc = allActiveLabsList.filter(lab => lab.provided_services[type] === true);
        let homeLabsForSvc = allLabsForSvc.filter(lab => lab.available_pincodes.includes(bookingData.pincode) || lab.pincode === bookingData.pincode);
        let cityLabsForSvc = allLabsForSvc.filter(lab => lab.city === bookingData.city || lab.available_cities.includes(bookingData.city));

        let hasHomeProvider = homeLabsForSvc.length > 0;
        let hasCityProvider = cityLabsForSvc.length > 0;

        if(isHomeEligible) {
            let homeClickAction = hasHomeProvider ? `changeGroupFulfill('${type}', 'home')` : `showHomeUnavailableAlert('${type}')`;
            let homeBtnStyle = hasHomeProvider ? "" : "opacity: 0.6; cursor: not-allowed; background: #f8fafc;";
            let lockIcon = hasHomeProvider ? "" : ' <i class="fas fa-lock" style="font-size:11px; margin-left:4px;"></i>';

            html += `
                <div class="service-toggle-box" style="margin-bottom:15px;">
                    <button class="toggle-btn ${isHome ? 'active' : ''}" style="${homeBtnStyle}" onclick="${homeClickAction}"><i class="fas fa-home"></i> Home Collection${lockIcon}</button>
                    <button class="toggle-btn ${!isHome ? 'active' : ''}" onclick="changeGroupFulfill('${type}', 'center')"><i class="fas fa-hospital"></i> Center Visit</button>
                </div>`;
        } else {
            html += `<div class="center-only-badge"><i class="fas fa-info-circle"></i> Center Visit Required for Scans</div>`;
        }

        if (!hasHomeProvider && !hasCityProvider) {
            html += `<div class="item-error-box"><span><i class="fas fa-exclamation-triangle"></i> No provider found in your area for ${type}.</span></div>`;
        } else {
            let displayLabs = isHome ? homeLabsForSvc : (hasCityProvider ? cityLabsForSvc : homeLabsForSvc);
            html += `<p style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Provider for ${type}:</p>`;
            displayLabs.forEach(lab => {
                let isSelected = String(lab.lab_id) === String(group.selected_lab_id) ? "selected" : "";
                let nablBadge = lab.nabl ? `<span class="badge-small">NABL</span>` : "";
                let nabhBadge = lab.nabh ? `<span class="badge-small" style="background:#dcfce7; color:#065f46;">NABH</span>` : "";
                let imgSrc = lab.lab_image || "https://via.placeholder.com/60?text=LAB";

                html += `
                    <div class="lab-card ${isSelected}" onclick="assignLabToGroup('${type}', '${lab.lab_id}')">
                        <img src="${imgSrc}" class="lab-img" onerror="this.src='https://via.placeholder.com/60?text=LAB'">
                        <div class="lab-info">
                            <h4 class="lab-name">${lab.lab_name} ${nablBadge} ${nabhBadge}</h4>
                            <p class="lab-addr"><i class="fas fa-map-marker-alt"></i> ${lab.lab_address}, ${lab.city} - ${lab.pincode}</p>
                        </div>
                        ${isSelected ? '<i class="fas fa-check-circle" style="color:var(--success); font-size:18px;"></i>' : ''}
                    </div>`;
            });
        }
        
        html += `</div>`; 
    }
    
    document.getElementById('cartItemsContainer').innerHTML = html;
    renderLabTimeSelectors();
    calculateFinalBill(); 
}

function showHomeUnavailableAlert(type) {
    alert(`No provider found in your area for this service. However, this facility is available in your city, please visit the center.`);
}

function changeGroupFulfill(type, fulfillment) {
    if (fulfillment === "home") {
        let hasHomeProvider = allActiveLabsList.some(l => l.provided_services[type] && (l.pincode === bookingData.pincode || l.available_pincodes.includes(bookingData.pincode)));
        if (!hasHomeProvider) { showHomeUnavailableAlert(type); return; }
    }
    cart.forEach(item => {
        if ((item.service_type || "pathology").toLowerCase().trim() === type) item.fulfillment = fulfillment;
    });
    autoAssignGroupLabs(); 
    renderGroupedCart(); 
}

function assignLabToGroup(type, labId) {
    cart.forEach(item => {
        if ((item.service_type || "pathology").toLowerCase().trim() === type) item.selected_lab_id = String(labId);
    });
    localStorage.setItem('bhavyaCart', JSON.stringify(cart)); 
    renderGroupedCart(); 
}

function removeCartItem(originalIndex) {
    if(confirm("Remove this item from your cart?")) {
        cart.splice(originalIndex, 1);
        localStorage.setItem('bhavyaCart', JSON.stringify(cart));
        if(cart.length === 0) showEmptyCart();
        else { autoAssignGroupLabs(); renderGroupedCart(); }
    }
}

function parseTime(t) {
    if(!t) return null;
    let match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if(!match) return null;
    let h = parseInt(match[1]); let m = parseInt(match[2]); let ampm = match[3].toUpperCase();
    if(ampm === "PM" && h < 12) h += 12;
    if(ampm === "AM" && h === 12) h = 0;
    return h * 60 + m; 
}

function formatTime(mins) {
    let h = Math.floor(mins / 60); let m = mins % 60; let ampm = h >= 12 ? "PM" : "AM";
    let h12 = h % 12; if(h12 === 0) h12 = 12;
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function renderLabTimeSelectors() {
    let container = document.getElementById('labTimesContainer');
    if(!container) return;

    let uniqueLabIds = [...new Set(cart.map(c => c.selected_lab_id).filter(Boolean))];
    
    if(uniqueLabIds.length === 0) { 
        container.innerHTML = ''; 
        validateCheckout();
        return; 
    }

    let todayStr = new Date().toISOString().split('T')[0];
    let html = `<h3 style="font-size:15px; font-weight:800; margin-bottom:15px; color:var(--text-main);">Select Appointment Time</h3>`;

    uniqueLabIds.forEach(labId => {
        let lab = allActiveLabsList.find(l => String(l.lab_id) === String(labId));
        let labName = lab ? lab.lab_name : "Selected Provider";
        
        if (labId === "BHAVYACARE-INTERNAL") labName = "BhavyaCare Nodal Center";
        
        let fulfills = cart.filter(c => c.selected_lab_id === labId).map(c => c.fulfillment);
        let fText = fulfills.includes("home") ? "Home Collection" : "Center Visit";

        if(!labSlots[labId]) labSlots[labId] = { date: "", time: "" };
        let savedDate = labSlots[labId].date;

        html += `
        <div style="background: var(--primary-soft); border: 1px solid #bfdbfe; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
            <strong style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:12px; color:var(--primary);">
                <span><i class="far fa-clock"></i> ${labName}</span>
                <span style="font-size:11px; background:#dbeafe; padding:2px 8px; border-radius:6px; color:var(--text-main); font-weight:800;">${fText}</span>
            </strong>
            <input type="date" class="form-input" min="${todayStr}" value="${savedDate}" onchange="updateLabDate('${labId}', this.value)" style="margin-bottom:10px; background:white; padding:10px;">
            <div class="slot-grid" id="slots-${labId}"></div>
        </div>`;
    });

    container.innerHTML = html;

    uniqueLabIds.forEach(labId => {
        if(labSlots[labId].date) {
            updateLabDate(labId, labSlots[labId].date, true);
        }
    });

    validateCheckout();
}

function updateLabDate(labId, dateStr, isRenderCall = false) {
    labSlots[labId].date = dateStr;
    if(!isRenderCall) labSlots[labId].time = ""; 

    let container = document.getElementById(`slots-${labId}`);
    if(!container || !dateStr) return;

    container.style.maxHeight = "500px";
    container.style.opacity = "1";
    const label = document.getElementById(`selected-time-label-${labId}`);
    if(label) label.remove();

    let dateObj = new Date(dateStr);
    let days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let dayName = days[dateObj.getDay()];

    let lab = allActiveLabsList.find(l => String(l.lab_id) === String(labId));
    
    if (labId === "BHAVYACARE-INTERNAL") {
        lab = { timings: { 
            [dayName]: { open: "08:00 AM", close: "08:00 PM" } 
        }};
    }

    let html = "";

    if(lab && lab.timings && lab.timings[dayName]) {
        let o = parseTime(lab.timings[dayName].open) || parseTime("09:00 AM");
        let c = parseTime(lab.timings[dayName].close) || parseTime("08:00 PM");
        
        let now = new Date();
        let isToday = (dateObj.toDateString() === now.toDateString());
        let currentMins = (now.getHours() * 60) + now.getMinutes();
        
        let planCache = localStorage.getItem("bhavya_plan_cache") || "basic";
        let hasVipPackageInCart = cart.some(item => item.service_id === "VIP-FREE-001");
        
        let bufferMins = (planCache === "pending" || hasVipPackageInCart) ? 120 : 30;
        
        if (o >= c - 30) {
            html = `<p style="color:var(--danger); font-size:12px; font-weight:700;">Provider is closed on this day.</p>`;
        } else {
            let slotsAdded = 0;
            for(let t = o; t <= c - 30; t += 30) {
                if (isToday && t < (currentMins + bufferMins)) { continue; }

                let slotStr = formatTime(t);
                let sel = labSlots[labId].time === slotStr ? "selected" : "";
                html += `<button class="slot-btn ${sel}" onclick="selectLabTime('${labId}', '${slotStr}')">${slotStr}</button>`;
                slotsAdded++;
            }
            
            if (slotsAdded === 0) {
                html = `<p style="color:var(--danger); font-size:12px; font-weight:700;">No more slots available for today. Please select tomorrow.</p>`;
            }
        }
    }
    container.innerHTML = html;
    validateCheckout();
}

function selectLabTime(labId, timeStr) {
    labSlots[labId].time = timeStr;

    const slotButtons = document.querySelectorAll(`#slots-${labId} .slot-btn`);
    slotButtons.forEach(btn => {
        if (btn.innerText === timeStr) { btn.classList.add('selected'); } 
        else { btn.classList.remove('selected'); }
    });

    const slotGrid = document.getElementById(`slots-${labId}`);
    if (slotGrid) {
        setTimeout(() => {
            slotGrid.style.maxHeight = "0px";
            slotGrid.style.overflow = "hidden";
            slotGrid.style.opacity = "0";
            slotGrid.style.transition = "all 0.4s ease";
            
            const timeLabel = document.createElement('div');
            timeLabel.id = `selected-time-label-${labId}`;
            timeLabel.innerHTML = `<span style="font-size:12px; color:var(--success); font-weight:700;"><i class="fas fa-check"></i> Selected: ${timeStr}</span>`;
            
            const oldLabel = document.getElementById(`selected-time-label-${labId}`);
            if(oldLabel) oldLabel.remove();
            slotGrid.parentNode.insertBefore(timeLabel, slotGrid);
        }, 300);
    }

    validateCheckout();
}

function applyReferral() {
    let code = document.getElementById('refCodeInput').value.trim().toUpperCase();
    let msg = document.getElementById('refMessage');
    let btn = document.getElementById('applyRefBtn');
    
    if(!code) { msg.innerText = "Enter code!"; msg.style.color = "var(--danger)"; return; }
    
    let allowedTypesStr = appRules.referral_applicable_services_type || "pathology, profile, package, ct, mri";
    let allowedTypes = allowedTypesStr.toLowerCase().split(',').map(s => s.trim());

    let hasEligibleService = false;
    let eligibleSubtotal = 0;

    cart.forEach(item => {
        let type = (item.service_type || "pathology").toLowerCase().trim();
        if (allowedTypes.includes(type) || allowedTypes.includes("all")) {
            hasEligibleService = true;
            eligibleSubtotal += (Number(item.price || item.basic_price || item.service_price || 0) * Number(item.qty || 1));
        }
    });

    if (!hasEligibleService) {
        msg.innerText = `Referral only valid on: ${allowedTypesStr.toUpperCase()}`;
        msg.style.color = "var(--danger)"; return;
    }

    let minOrder = appRules.min_order_for_referral || 300;
    if(eligibleSubtotal < minOrder) {
        msg.innerText = `Minimum eligible order ₹${minOrder} required.`;
        msg.style.color = "var(--danger)"; return;
    }

    const userId = localStorage.getItem("bhavya_user_id") || "GUEST"; 

    btn.innerText = "Wait..."; btn.disabled = true;

    fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "verifyReferralCode", user_id: userId, referral_code: code }) })
    .then(res => res.json())
    .then(res => {
        btn.innerText = "Apply"; btn.disabled = false;
        if(res.status === "success") {
            finalBill.refCode = code;
            finalBill.refDiscount = appRules.referral_bonus || 50; 
            msg.innerHTML = `<i class="fas fa-check-circle"></i> Code applied! ₹${finalBill.refDiscount} off.`;
            msg.style.color = "var(--success)";
            calculateFinalBill();
        } else {
            finalBill.refCode = ""; finalBill.refDiscount = 0;
            msg.innerHTML = `<i class="fas fa-times-circle"></i> ${res.message}`;
            msg.style.color = "var(--danger)";
            calculateFinalBill();
        }
    }).catch(e => { btn.innerText = "Apply"; btn.disabled = false; });
}

function calculateFinalBill() {
    let subtotal = 0;
    let eligibleSubtotal = 0; 
    let isHomeCollection = false;
    let hasVipPackage = false; 
    
    let allowedTypesStr = appRules.referral_applicable_services_type || "pathology, profile, package, ct, mri";
    let allowedTypes = allowedTypesStr.toLowerCase().split(',').map(s => s.trim());

    cart.forEach(item => {
        if (item.service_id === "VIP-FREE-001") hasVipPackage = true;

        let itemPrice = (Number(item.price || item.basic_price || item.service_price || 0) * Number(item.qty || 1));
        subtotal += itemPrice;

        let type = (item.service_type || "pathology").toLowerCase().trim();
        if (allowedTypes.includes(type) || allowedTypes.includes("all")) {
            eligibleSubtotal += itemPrice;
        }

        if (item.fulfillment === "home") isHomeCollection = true;
    });

    let collectionCharge = 0;
    if (isHomeCollection) {
        if (hasVipPackage) {
            collectionCharge = 0;
        } else {
            let freeLimit = bookingData.isVip ? (appRules.free_collection_limit_vip || 100) : (appRules.free_collection_limit_basic || 300);
            if (subtotal < freeLimit) {
                collectionCharge = appRules.home_collection_charge || 50;
            }
        }
    }

    let walletUsed = 0;
    let walletCb = document.getElementById('useWalletCb');
    if (walletCb && walletCb.checked) {
        if (eligibleSubtotal === 0) {
            walletCb.checked = false; 
            alert(`Wallet can only be used on: ${allowedTypesStr.toUpperCase()}`);
        } else {
            let maxAllowed = bookingData.isVip ? (appRules.vip_max_wallet_use || 200) : (appRules.basic_max_wallet_use || 50);
            walletUsed = Math.min(userWalletBalance, maxAllowed, eligibleSubtotal); 
        }
    }

    let actualRefDiscount = finalBill.refDiscount;
    if(actualRefDiscount > 0 && (eligibleSubtotal - walletUsed) < actualRefDiscount) {
        actualRefDiscount = Math.max(0, eligibleSubtotal - walletUsed);
    }

    let totalDiscount = walletUsed + actualRefDiscount;
    let totalPayable = subtotal + collectionCharge - totalDiscount;
    if (totalPayable < 0) totalPayable = 0;

    finalBill.subtotal = subtotal;
    finalBill.collectionCharge = collectionCharge;
    finalBill.walletUsed = walletUsed;
    finalBill.totalPayable = totalPayable;

    let tAmt = document.getElementById('totalAmt'); if(tAmt) tAmt.innerText = totalPayable;
    let sumTotal = document.getElementById('summaryTotalAmt'); if(sumTotal) sumTotal.innerText = totalPayable;
    let sumCount = document.getElementById('summaryItemCount'); if(sumCount) sumCount.innerText = cart.length;
    
    let chargeUI = document.getElementById('summaryChargeTxt'); 
    if (chargeUI) {
        if (collectionCharge === 0) chargeUI.innerHTML = `<span style="color:var(--success); background:var(--success-soft); padding:2px 8px; border-radius:6px;">FREE</span>`;
        else { chargeUI.innerText = `₹${collectionCharge}`; chargeUI.style.color = "var(--text-main)"; chargeUI.style.background = "transparent"; }
    }
}

function validateCheckout() {
    const btn = document.getElementById('confirmBtn');
    const btnProceed = document.getElementById('btnProceedCheckout'); 
    if(!btn) return;
    
    if (cart.length === 0) { btn.disabled = true; if(btnProceed) btnProceed.style.display = 'none'; return; }
    
    let uniqueLabIds = [...new Set(cart.map(c => c.selected_lab_id).filter(Boolean))];
    let allLabsAssigned = cart.every(item => item.selected_lab_id);
    let allTimesSelected = uniqueLabIds.every(id => labSlots[id] && labSlots[id].date && labSlots[id].time);

    const s3 = document.getElementById('step3-card');

    if(allLabsAssigned && allTimesSelected) {
        if(btnProceed) btnProceed.style.display = 'block';
        calculateFinalBill(); 
        btn.disabled = false;
    } else {
        if(btnProceed) btnProceed.style.display = 'none';
        if(s3) { s3.style.display = 'none'; s3.style.opacity = '0.5'; s3.style.pointerEvents = 'none'; }
        btn.disabled = true;
        let step3Nav = document.getElementById('step3-nav');
        if(step3Nav) step3Nav.classList.remove('active');
    }
}

function goToStep3() {
    document.getElementById('cartItemsContainer').style.display = 'none';
    document.getElementById('labTimesContainer').style.display = 'none';
    document.getElementById('btnProceedCheckout').style.display = 'none';
    
    let summaryDiv = document.getElementById('servicesSummary');
    if(summaryDiv) {
        summaryDiv.style.display = 'block';
        document.getElementById('sumTotalTests').innerText = `${cart.length} Tests / Packages Selected`;
    }

    document.getElementById('step2-nav').classList.add('completed');
    document.getElementById('step3-nav').classList.add('active');

    const s3 = document.getElementById('step3-card');
    if(s3) { 
        s3.style.display = 'block'; 
        s3.style.opacity = '1'; 
        s3.style.pointerEvents = 'auto'; 
        s3.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function editServicesInfo() {
    document.getElementById('servicesSummary').style.display = 'none';
    document.getElementById('cartItemsContainer').style.display = 'block';
    document.getElementById('labTimesContainer').style.display = 'block';
    document.getElementById('btnProceedCheckout').style.display = 'block';

    document.getElementById('step2-nav').classList.remove('completed');
    document.getElementById('step3-nav').classList.remove('active');

    const s3 = document.getElementById('step3-card');
    if(s3) { 
        s3.style.display = 'none'; 
        s3.style.opacity = '0.5'; 
        s3.style.pointerEvents = 'none'; 
    }
}

function finalizeBooking() {
    const userId = localStorage.getItem("bhavya_user_id");
    
    if (!userId) {
        document.getElementById("displayOtpMobile").innerText = "+91 " + bookingData.mobile;
        document.getElementById("cartOtpModal").style.display = "flex";
        
        if (!window.cartRecaptchaVerifier) {
            window.cartRecaptchaVerifier = new firebase.auth.RecaptchaVerifier('cart-recaptcha-container', { 'size': 'normal' });
            window.cartRecaptchaVerifier.render();
        }

        firebase.auth().signInWithPhoneNumber("+91" + bookingData.mobile, window.cartRecaptchaVerifier)
            .then((result) => {
                cartConfirmationResult = result;
                document.getElementById("cart-recaptcha-container").style.display = "none";
                document.getElementById("cartOtpInputSection").style.display = "block";
            }).catch((error) => {
                alert("Error sending OTP.");
                document.getElementById("cartOtpModal").style.display = "none";
            });
    } else {
        processOrderSubmission(userId);
    }
}

function verifyCartOTP() {
    const otp = document.getElementById('cartOtpCode').value;
    if(otp.length !== 6) return alert("Please enter valid 6-digit OTP");

    const btn = document.getElementById('cartVerifyOtpBtn');
    btn.innerText = "Verifying..."; btn.disabled = true;

    cartConfirmationResult.confirm(otp).then((result) => {
        proceedWithRegistration(result.user); 
    }).catch((error) => {
        alert("Invalid OTP! Please try again.");
        btn.innerHTML = "Confirm Order <i class='fas fa-check-circle' style='margin-left: 5px;'></i>"; btn.disabled = false;
    });
}

function proceedWithRegistration(user) {
    const payload = { action: "login", uid: user.uid, mobile: user.phoneNumber, role: "patient", name: bookingData.name };

    fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            const finalUserId = res.user_id || (res.data ? res.data.user_id : null); 
            localStorage.setItem("bhavya_uid", user.uid); localStorage.setItem("bhavya_mobile", user.phoneNumber); localStorage.setItem("bhavya_role", res.role || "patient"); localStorage.setItem("bhavya_user_id", finalUserId); localStorage.setItem("bhavya_name", bookingData.name);
            document.getElementById('cartOtpModal').style.display = 'none';
            processOrderSubmission(finalUserId); 
        } else { alert("Registration failed."); }
    }).catch(e => { alert("Network Error."); });
}

function processOrderSubmission(userId) {
    const btn = document.getElementById('confirmBtn');
    btn.innerText = "Processing Order..."; btn.disabled = true;

    const payload = {
        action: "submitBookingOrder",
        user_id: userId,
        patient_name: bookingData.name,
        mobile: bookingData.mobile, 
        pincode: bookingData.pincode,
        address: bookingData.address,
        cart_items: cart, 
        lab_slots: labSlots,
        subtotal: finalBill.subtotal,
        collection_charge: finalBill.collectionCharge,
        wallet_used: finalBill.walletUsed,
        total_discount: (finalBill.walletUsed + finalBill.refDiscount),
        referral_code: finalBill.refCode,
        final_total: finalBill.totalPayable
    };

    fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) })
    .then(res => res.json())
    .then(res => {
        if(res.status === "success") {
            localStorage.removeItem('bhavyaCart'); 
            alert("🎉 Booking Successful!\n\nYour Order is confirmed. You can pay directly via Cash or UPI.");
            window.location.href = "../patient_dashboard/patient_dashboard.html";
        } else {
            alert("Booking Error: " + res.message);
            btn.innerText = "Confirm Booking"; btn.disabled = false;
        }
    }).catch(e => { alert("Error during checkout."); btn.innerText = "Confirm Booking"; btn.disabled = false; });
}
