// Map for Category Names and Premium Icons (MRI changed to Brain 🧠)
const categoryConfig = {
    'pathology': { name: 'Test', icon: '🩸' },
    'profile':   { name: 'Package', icon: '🩺' }, 
    'usg':       { name: 'Ultrasound', icon: '🖥️' },
    'xray':      { name: 'X-Ray', icon: '🩻' },
    'ct':        { name: 'CT Scan', icon: '☢️' },
    'mri':       { name: 'MRI', icon: '🧠' }, // New Premium Icon for MRI
    'ecg':       { name: 'ECG', icon: '❤️' },
    'echo':      { name: 'ECHO', icon: '💓' }
};

const defaultIcon = '🧪';
const mainCategoryKeys = ['pathology', 'profile', 'usg', 'xray', 'ct', 'mri', 'ecg', 'echo'];

let allServices = [];
let userPlanStatus = "basic"; 
let currentCategory = 'profile'; 
let currentSubCategory = 'all'; 
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let searchTimeout; 

const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartUI(); 
    fetchBookingData();
};

// 🌟 SMART TEXT FORMATTER (Title Case + Acronyms) 🌟
function formatText(text) {
    if (!text) return "";
    let formatted = text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    // Auto Capitalize Medical Short Forms
    const acronyms = /\b(cbc|esr|usg|mri|ecg|echo|ct|lft|kft|hba1c|tsh|t3|t4|ana|psa|hiv|hcv|bun|aptt|sgpt|sgot|vdrl|rbc|wbc|bchg|aec|anc|amh|ada|hbsag|crp|abp|ncv|emg|ssep|dlco|eeg|pft)\b/gi;
    return formatted.replace(acronyms, match => match.toUpperCase());
}

function fetchBookingData() {
    const userId = localStorage.getItem("bhavya_user_id") || localStorage.getItem("user_id"); 
    
    fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "getBookingData", user_id: userId })
    })
    .then(res => res.json())
    .then(response => {
        document.getElementById("loading").style.display = "none";
        if(response.status === "success") {
            allServices = response.data.services;
            userPlanStatus = response.data.userPlan;
            renderCategories();
            renderServices(); 
        } else {
            alert("Error fetching services.");
        }
    })
    .catch(error => {
        document.getElementById("loading").innerHTML = "Failed to load data. Please check your connection.";
    });
}

function renderCategories() {
    const mainContainer = document.getElementById("mainCategories");
    let mainHtml = "";
    
    const existingTypes = [...new Set(allServices.map(s => String(s.service_type || '').toLowerCase().trim()))];

    mainCategoryKeys.forEach(key => {
        let config = categoryConfig[key] || { name: key.toUpperCase(), icon: defaultIcon };
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
}

function selectCategory(categoryKey) {
    currentCategory = categoryKey;
    currentSubCategory = 'all';
    document.getElementById("searchInput").value = ""; 
    renderCategories(); 
    renderServices();
}

function selectSubCategory(subCat) {
    currentSubCategory = subCat;
    renderServices();
}

function filterServices() {
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(() => {
        renderServices(document.getElementById("searchInput").value.toLowerCase());
    }, 300); 
}

function renderServices(searchQuery = "") {
    const container = document.getElementById("servicesList");
    const subContainer = document.getElementById("subCategoryContainer");
    
    let filtered = allServices.filter(s => String(s.service_type || '').toLowerCase().trim() === currentCategory);

    // SUB-CATEGORIES FOR PROFILES
    if (currentCategory === 'profile' && !searchQuery) {
        let subCats = ['all', ...new Set(filtered.map(s => String(s.service_category || 'Other').trim().replace(/_/g, ' ')))];
        let subHtml = `<div class="sub-cat-nav">`;
        subCats.forEach(sc => {
            let active = currentSubCategory === sc ? 'active' : '';
            subHtml += `<button class="sub-cat-btn ${active}" onclick="selectSubCategory('${sc}')">${formatText(sc)}</button>`;
        });
        subHtml += `</div>`;
        subContainer.innerHTML = subHtml;

        if (currentSubCategory !== 'all') {
            filtered = filtered.filter(s => String(s.service_category || 'Other').trim().replace(/_/g, ' ') === currentSubCategory);
        }
    } else {
        subContainer.innerHTML = ""; 
    }

    // 🌟 DEEP SEARCH LOGIC (Description ke andar bhi dhundega) 🌟
    if (searchQuery) {
        filtered = allServices.filter(s => 
            String(s.service_name || '').toLowerCase().includes(searchQuery) || 
            String(s.service_id || '').toLowerCase().includes(searchQuery) ||
            String(s.description || '').toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding: 40px;'><i class='fas fa-search' style='font-size:30px; color:#cbd5e1; margin-bottom:15px;'></i><br><span style='color:var(--text-muted); font-weight:500;'>No tests found matching your criteria.</span></div>";
        return;
    }

    let htmlContent = "";

    filtered.forEach(service => {
        const isVip = userPlanStatus === "vip";
        const applicablePrice = isVip ? service.vip_price : service.basic_price;
        const inCart = cart.some(item => item.service_id === service.service_id);
        
        const btnClass = inCart ? 'add-to-cart-btn added' : 'add-to-cart-btn';
        const btnText = inCart ? 'ADDED ✔' : 'ADD';
        
        const cleanName = formatText(service.service_name);
        const cleanCat = formatText(service.service_category).replace(/_/g, ' ');

        // 🌟 3-TIER PRICING UI WITH NEW VIP PROMO CLICK 🌟
        let pricingHtml = "";
        if (isVip) {
            pricingHtml = `
                <div class="mrp-row">
                    <span>Total: <span class="mrp">₹${service.service_price}</span></span>
                    <span style="margin-left:8px;">Basic: <span class="mrp">₹${service.basic_price}</span></span>
                </div>
                <div class="final-price">₹${service.vip_price} <i class="fas fa-crown" style="color:var(--warning); font-size:14px;" title="VIP Rate Applied"></i></div>
            `;
        } else {
            pricingHtml = `
                <div class="mrp-row"><span>Total: <span class="mrp">₹${service.service_price}</span></span></div>
                <div class="final-price">₹${service.basic_price} <span style="font-size:10px; font-weight:800; background:var(--primary-light); color:var(--primary); padding:2px 6px; border-radius:4px; transform:translateY(-2px);">BASIC</span></div>
                <div class="locked-price" onclick="openVipPromo()">
                    <i class="fas fa-lock"></i> VIP Rate: ₹${service.vip_price}
                </div>
            `;
        }

        // 🌟 PREMIUM PROFILE UI 🌟
        if (currentCategory === 'profile' && !searchQuery) {
            
            let descPreviewHtml = "";
            let descRaw = String(service.description || '');
            if (descRaw.trim() !== "") {
                let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
                if (items.length > 0) {
                    // Preview first 3 items with Title Case & Acronyms
                    let previewItems = items.slice(0, 3).map(i => formatText(i.trim()));
                    
                    let moreText = "";
                    if (service.number_of_test) {
                        moreText = `+ ${service.number_of_test} Parameters (View All)`;
                    } else if (items.length > 3) {
                        moreText = `+ ${items.length - 3} More Tests (View All)`;
                    }

                    descPreviewHtml = `<div class="desc-preview">
                        <ul>${previewItems.map(i => `<li>${i}</li>`).join('')}</ul>
                        ${moreText ? `<div class="view-more-btn" onclick="openModal('${service.service_id}')">${moreText}</div>` : ''}
                    </div>`;
                }
            }

            htmlContent += `
                <div class="profile-item">
                    <div class="profile-header">
                        <span class="profile-badge">${cleanCat}</span>
                        ${service.number_of_test ? `<span class="param-badge"><i class="fas fa-microscope"></i> ${service.number_of_test} Parameters</span>` : ''}
                    </div>
                    
                    <div class="service-info">
                        <h3>${cleanName}</h3>
                        ${descPreviewHtml}
                    </div>
                    
                    <div class="price-action-row">
                        <div class="price-box">${pricingHtml}</div>
                        <button class="${btnClass}" onclick="toggleCart('${service.service_id}', '${cleanName}', ${applicablePrice})">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
        } 
        // 🌟 NORMAL TEST UI 🌟
        else {
            let catType = String(service.service_type || '').toLowerCase().trim();
            let catIcon = categoryConfig[catType]?.icon || defaultIcon;
            let imgStr = service.service_image ? String(service.service_image).trim() : "";
            let imageHtml = imgStr !== "" ? `<img src="${imgStr}" onerror="this.style.display='none'; this.parentNode.innerHTML='${catIcon}';">` : catIcon;

            htmlContent += `
                <div class="service-item">
                    <div class="service-img-box">${imageHtml}</div>
                    <div class="service-info" style="flex-grow:1;">
                        <h3 style="font-size:15px; margin-bottom:8px;">${cleanName}</h3>
                        <div class="price-box">
                            ${pricingHtml}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <button class="${btnClass}" onclick="toggleCart('${service.service_id}', '${cleanName}', ${applicablePrice})">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = htmlContent;
}

// 🌟 DETAILS MODAL 🌟
function openModal(serviceId) {
    const service = allServices.find(s => s.service_id === serviceId);
    if (!service) return;

    document.getElementById("modalTitle").innerText = formatText(service.service_name);
    
    let descRaw = String(service.description || '');
    let formattedDesc = "<p style='text-align:center;'>No details available.</p>";
    
    if (descRaw.trim() !== "") {
        let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
        // Apply Title Case & Acronyms to each item in the Modal
        formattedDesc = "<ul>" + items.map(i => `<li>${formatText(i.trim())}</li>`).join('') + "</ul>";
    }
    
    document.getElementById("modalBody").innerHTML = formattedDesc;
    document.getElementById("infoModal").classList.add("active");
}
function closeModal() {
    document.getElementById("infoModal").classList.remove("active");
}

// 🌟 VIP PROMO MODAL 🌟
function openVipPromo() {
    document.getElementById("vipPromoModal").classList.add("active");
}
function closeVipPromo() {
    document.getElementById("vipPromoModal").classList.remove("active");
}

// CART LOGIC
function toggleCart(id, name, price) {
    const index = cart.findIndex(item => item.service_id === id);
    if (index > -1) {
        cart.splice(index, 1); 
    } else {
        cart.push({ service_id: id, service_name: name, price: price });
    }
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    updateCartUI();
    renderServices(document.getElementById("searchInput").value); 
}

function updateCartUI() {
    const topCartBtn = document.getElementById("topCartBtn");
    const cartBar = document.getElementById("bottomCartBar");
    const cartText = document.getElementById("bottomCartText");
    
    topCartBtn.innerText = `🛒 Cart (${cart.length})`;

    if (cart.length > 0) {
        let total = cart.reduce((sum, item) => sum + item.price, 0);
        cartText.innerHTML = `${cart.length} Item${cart.length > 1 ? 's' : ''} <span style="color:#cbd5e1; margin:0 8px;">|</span> ₹${total}`;
        cartBar.classList.add("visible");
    } else {
        cartBar.classList.remove("visible");
    }
}

function openCart() {
    window.location.href = "cart.html"; 
}
