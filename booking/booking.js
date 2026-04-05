// ==========================================
// booking.js - 100% COMPLETE & FIXED (Aggressive Save)
// ==========================================

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

// Load cart aggressively on page load to sync state
let cart = [];
try {
    let stored = localStorage.getItem('bhavyaCart');
    if (stored) {
        let parsed = JSON.parse(stored);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Double stringify fix
        if (Array.isArray(parsed)) cart = parsed.map(item => ({...item, qty: item.qty || 1})); 
    }
} catch (e) { console.error("Cart Error", e); cart = []; }

let searchTimeout; 
let pollingInterval; 

const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartUI(); 
    fetchBookingData();

    const pendingFlag = localStorage.getItem("pending_vip_redirect");
    const userId = localStorage.getItem("bhavya_user_id");
    if (pendingFlag === "true" && userId) {
        localStorage.removeItem("pending_vip_redirect");
        openVipFormModal();
    }
};

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
        document.getElementById("loading").style.display = "none";
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
            
            localStorage.setItem("bhavya_services_cache", JSON.stringify(allServices));
            localStorage.setItem("bhavya_plan_cache", userPlanStatus);
            
            document.getElementById("loading").style.display = "none";
            handleBannerDisplay();
            renderCategories();
            renderServices(); 
        }
    }).catch(error => { 
        if(!cachedServices) document.getElementById("loading").innerHTML = "Failed to load data."; 
    });
}

function handleBannerDisplay() {
    const banner = document.getElementById("pendingWarningBanner");
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
    
    let mainHtml = "";
    let sliderHtml = "";
    
    // Backend se aane wali saari unique categories
    const existingTypes = [...new Set(allServices.map(s => String(s.service_type || '').toLowerCase().trim()))];

    // --- PART 1: FIXED CATEGORIES (GRID ME DIKHAYENGE) ---
    mainCategoryKeys.forEach(key => {
        let config = categoryConfig[key] || { name: formatText(key), icon: defaultIcon };
        let isPresent = existingTypes.includes(key);
        let isSelected = currentCategory === key ? 'selected' : '';
        
        // Agar backend me wo test available hai, tabhi grid me dikhao
        if(isPresent) {
            mainHtml += `<div class="cat-card ${isSelected}" onclick="selectCategory('${key}')">
                            <div class="cat-icon">${config.icon}</div>
                            <span class="cat-name">${config.name}</span>
                         </div>`;
        }
    });
    if(mainContainer) mainContainer.innerHTML = mainHtml;

    // --- PART 2: NAYI CATEGORIES (SLIDER ME DIKHAYENGE) ---
    let hasNewCategories = false;
    
    existingTypes.forEach(key => {
        if (!key) return; // Blank item ko skip karo
        
        // Agar category purani fixed list me HAI, toh isko chhod do
        if (mainCategoryKeys.includes(key)) return; 
        
        // Agar category NAYI hai:
        hasNewCategories = true;
        let isActive = currentCategory === key ? 'active' : '';
        let config = categoryConfig[key] || { name: formatText(key), icon: defaultIcon };
        
        // Naye button ko sub-category wale style me slider me add karo
        sliderHtml += `<button class="sub-cat-btn ${isActive}" onclick="selectCategory('${key}')" style="display:flex; align-items:center; gap:5px;">
                          <span>${config.icon}</span> ${config.name}
                       </button>`;
    });

    // Agar koi nayi category mili, toh slider dikhao, warna chupao
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
    document.getElementById("searchInput").value = ""; 
    renderCategories(); renderServices();
}

function selectSubCategory(subCat) { currentSubCategory = subCat; renderServices(); }

function filterServices() {
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(() => { renderServices(document.getElementById("searchInput").value.toLowerCase()); }, 300); 
}

function renderServices(searchQuery = "") {
    const container = document.getElementById("servicesList");
    const subContainer = document.getElementById("subCategoryContainer");
    
    let filtered = allServices.filter(s => String(s.service_type || '').toLowerCase().trim() === currentCategory);

    if (currentCategory === 'profile' && !searchQuery) {
        let subCats = ['all', ...new Set(filtered.map(s => String(s.service_category || 'Other').trim()))];
        let subHtml = `<div class="sub-cat-nav">`;
        subCats.forEach(sc => {
            let active = currentSubCategory === sc ? 'active' : '';
            subHtml += `<button class="sub-cat-btn ${active}" onclick="selectSubCategory('${sc}')">${formatText(sc)}</button>`;
        });
        subHtml += `</div>`;
        subContainer.innerHTML = subHtml;

        if (currentSubCategory !== 'all') { filtered = filtered.filter(s => String(s.service_category || 'Other').trim() === currentSubCategory); }
    } else { subContainer.innerHTML = ""; }

    if (searchQuery) {
        filtered = allServices.filter(s => 
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

        if (currentCategory === 'profile' && !searchQuery) {
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
            let catType = String(service.service_type || '').toLowerCase().trim();
            let catIcon = categoryConfig[catType]?.icon || defaultIcon;
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
    
    // Aggressive save to guarantee state is synced immediately
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    updateCartUI(); 
    renderServices(document.getElementById("searchInput").value); 
}

function updateCartUI() {
    const topCartBtn = document.getElementById("topCartBtn"); const cartBar = document.getElementById("bottomCartBar"); const cartText = document.getElementById("bottomCartText");
    let totalItems = cart.reduce((sum, item) => sum + item.qty, 0); let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    topCartBtn.innerText = `🛒 Cart (${totalItems})`;
    if (totalItems > 0) {
        cartText.innerHTML = `${totalItems} Item${totalItems > 1 ? 's' : ''} <span style="color:#cbd5e1; margin:0 8px;">|</span> ₹${totalPrice}`;
        cartBar.classList.add("visible");
    } else { cartBar.classList.remove("visible"); }
}

function openModal(serviceId) {
    const service = allServices.find(s => s.service_id === serviceId);
    if (!service) return;
    document.getElementById("modalTitle").innerText = formatText(service.service_name);
    let descRaw = String(service.description || '');
    let formattedDesc = "<p style='text-align:center;'>No details available.</p>";
    if (descRaw.trim() !== "") {
        let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
        formattedDesc = "<ul>" + items.map(i => `<li style="margin-bottom:6px; border-bottom:1px dashed #eee; padding-bottom:4px;">${formatText(i.trim())}</li>`).join('') + "</ul>";
    }
    document.getElementById("modalBody").innerHTML = formattedDesc; document.getElementById("infoModal").classList.add("active");
}

function closeModal() { document.getElementById("infoModal").classList.remove("active"); }

function openVipPromo() { 
    document.getElementById("vipPromoModal").classList.add("active"); 
    // Clear old values when modal opens
    document.getElementById("vipPromoPincode").value = "";
    document.getElementById("vipPromoPincodeMsg").style.display = "none";
}

function closeVipPromo() { document.getElementById("vipPromoModal").classList.remove("active"); }

// ==========================================
// 🌟 VIP FORM LOGIC 🌟
// ==========================================
let currentVipAmount = 3000;
let baseVipPrice = 3000;
let vipDiscount = 500;
let validReferrerId = "";

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

    // 1. Pincode Validation
    if(pincode.length !== 6) {
        msg.style.display = "block";
        msg.style.color = "var(--danger)";
        msg.innerHTML = "Please enter a valid 6-digit pincode.";
        return;
    }

    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Checking...`;
    btn.disabled = true;

    try {
        // 2. Call your existing checkVipPincode API
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "checkVipPincode", pincode: pincode })
        });
        const res = await response.json();

        // 3. Handle Response
        if (res.status === "success") {
            msg.style.display = "block";
            msg.style.color = "var(--success)";
            msg.innerHTML = "<i class='fas fa-check-circle'></i> Service Available! Proceeding...";
            
            // Wait slightly so user can read the success message
            setTimeout(() => {
                const userId = localStorage.getItem("bhavya_user_id");
                if (userId) { 
                    closeVipPromo(); 
                    openVipFormModal(); 
                } else {
                    localStorage.setItem("pending_vip_redirect", "true");
                    closeVipPromo();
                    if (typeof openPatientLogin === "function") { openPatientLogin(); } else { alert("Please login first."); }
                }
                
                // Reset button for next time
                btn.innerHTML = `<i class="fas fa-crown"></i> Activate Now`;
                btn.disabled = false;
            }, 800);

        } else {
            // Pincode not serviceable
            msg.style.display = "block";
            msg.style.color = "var(--danger)";
            msg.innerHTML = `<i class='fas fa-times-circle'></i> ${res.message || "VIP Plan is not available in this pincode yet."}`;
            btn.innerHTML = `<i class="fas fa-crown"></i> Activate Now`;
            btn.disabled = false;
        }
    } catch(err) {
        msg.style.display = "block";
        msg.style.color = "var(--danger)";
        msg.innerHTML = "Network error while checking pincode.";
        btn.innerHTML = `<i class="fas fa-crown"></i> Activate Now`;
        btn.disabled = false;
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

// 🌟 FIX: DELAYED NAVIGATION TO PREVENT EMPTY CART BUG 🌟
function openCart() { 
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    setTimeout(() => {
        window.location.href = "../cart/cart.html"; 
    }, 150); // Small 150ms delay guarantees the browser writes the data first!
}
