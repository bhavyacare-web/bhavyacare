// Map for Category Names and Premium Icons
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

// 🌟 FIX: Purane cart data ko nayi quantity format me migrate kiya
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
cart = cart.map(item => ({...item, qty: item.qty || 1})); 

let searchTimeout; 
const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartUI(); 
    fetchBookingData();
};

// 🌟 SMART TEXT FORMATTER (_ HATANA, TITLE CASE, ACRONYMS) 🌟
function formatText(text) {
    if (!text) return "";
    let cleanText = String(text).replace(/_/g, ' '); // Pura underscore hata diya
    let formatted = cleanText.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const acronyms = /\b(cbc|esr|usg|mri|ecg|echo|ct|lft|kft|hba1c|tsh|t3|t4|ana|psa|hiv|hcv|bun|aptt|sgpt|sgot|vdrl|rbc|wbc|bchg|aec|anc|amh|ada|hbsag|crp|abp|ncv|emg|ssep|dlco|eeg|pft)\b/gi;
    return formatted.replace(acronyms, match => match.toUpperCase());
}

// 🌟 CLEAN PRICE FORMATTER (12.6666 -> 12.67) 🌟
function formatPrice(price) {
    if (!price || isNaN(price)) return 0;
    return parseFloat(Number(price).toFixed(2));
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
        document.getElementById("loading").innerHTML = "Failed to load data.";
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

    if (currentCategory === 'profile' && !searchQuery) {
        let subCats = ['all', ...new Set(filtered.map(s => String(s.service_category || 'Other').trim()))];
        let subHtml = `<div class="sub-cat-nav">`;
        subCats.forEach(sc => {
            let active = currentSubCategory === sc ? 'active' : '';
            subHtml += `<button class="sub-cat-btn ${active}" onclick="selectSubCategory('${sc}')">${formatText(sc)}</button>`;
        });
        subHtml += `</div>`;
        subContainer.innerHTML = subHtml;

        if (currentSubCategory !== 'all') {
            filtered = filtered.filter(s => String(s.service_category || 'Other').trim() === currentSubCategory);
        }
    } else {
        subContainer.innerHTML = ""; 
    }

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
        const totalMrp = formatPrice(service.service_price);
        const basicPrice = formatPrice(service.basic_price);
        const vipPrice = formatPrice(service.vip_price);
        const applicablePrice = isVip ? vipPrice : basicPrice;
        
        // 🌟 CHECK CART QUANTITY 🌟
        const cartItem = cart.find(item => item.service_id === service.service_id);
        const inCart = !!cartItem;
        const currentQty = cartItem ? cartItem.qty : 0;
        
        const cleanName = formatText(service.service_name).replace(/'/g, "\\'");
        const cleanCat = formatText(service.service_category);

        // 🌟 GREEN QUANTITY CONTROLLER UI 🌟
        let actionBtnHtml = "";
        if (inCart) {
            actionBtnHtml = `
            <div class="qty-control">
                <button onclick="updateQty('${service.service_id}', -1, ${applicablePrice}, '${cleanName}')"><i class="fas fa-minus"></i></button>
                <span class="qty-text">${currentQty}</span>
                <button onclick="updateQty('${service.service_id}', 1, ${applicablePrice}, '${cleanName}')"><i class="fas fa-plus"></i></button>
            </div>`;
        } else {
            actionBtnHtml = `<button class="add-to-cart-btn" onclick="updateQty('${service.service_id}', 1, ${applicablePrice}, '${cleanName}')">ADD +</button>`;
        }

        let pricingHtml = "";
        if (isVip) {
            pricingHtml = `
                <div class="mrp-row">
                    <span>Total: <span class="mrp">₹${totalMrp}</span></span>
                    <span style="margin-left:8px;">Basic: <span class="mrp">₹${basicPrice}</span></span>
                </div>
                <div class="final-price">₹${vipPrice} <i class="fas fa-crown" style="color:var(--warning); font-size:14px;"></i></div>
            `;
        } else {
            pricingHtml = `
                <div class="mrp-row"><span>Total: <span class="mrp">₹${totalMrp}</span></span></div>
                <div class="final-price">₹${basicPrice} <span style="font-size:10px; font-weight:800; background:var(--primary-light); color:var(--primary); padding:2px 6px; border-radius:4px; transform:translateY(-2px);">BASIC</span></div>
                <div class="locked-price" onclick="openVipPromo()">
                    <i class="fas fa-lock" style="font-size:10px;"></i> VIP Rate: ₹${vipPrice}
                </div>
            `;
        }

        if (currentCategory === 'profile' && !searchQuery) {
            let descPreviewHtml = "";
            let descRaw = String(service.description || '');
            if (descRaw.trim() !== "") {
                let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
                if (items.length > 0) {
                    // Maximum 2 items dikhayenge taki card compact rahe
                    let previewItems = items.slice(0, 2).map(i => formatText(i.trim()));
                    
                    let moreText = "";
                    if (service.number_of_test) {
                        moreText = `+ ${service.number_of_test} Parameters (View All)`;
                    } else if (items.length > 2) {
                        moreText = `View All Details <i class="fas fa-arrow-right" style="font-size:10px;"></i>`;
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
                        <div class="action-container">${actionBtnHtml}</div>
                    </div>
                </div>
            `;
        } 
        else {
            let catType = String(service.service_type || '').toLowerCase().trim();
            let catIcon = categoryConfig[catType]?.icon || defaultIcon;
            let imgStr = service.service_image ? String(service.service_image).trim() : "";
            let imageHtml = imgStr !== "" ? `<img src="${imgStr}" onerror="this.style.display='none'; this.parentNode.innerHTML='${catIcon}';">` : catIcon;

            htmlContent += `
                <div class="service-item">
                    <div class="service-img-box">${imageHtml}</div>
                    <div class="service-info" style="flex-grow:1;">
                        <h3 style="font-size:14px; margin-bottom:6px;">${cleanName}</h3>
                        <div class="price-box">${pricingHtml}</div>
                    </div>
                    <div class="action-container">${actionBtnHtml}</div>
                </div>
            `;
        }
    });

    container.innerHTML = htmlContent;
}

// 🌟 SMART CART UPDATER (Handles Quantity) 🌟
function updateQty(id, change, price, name) {
    let index = cart.findIndex(item => item.service_id === id);
    
    if (index > -1) {
        cart[index].qty += change;
        if (cart[index].qty <= 0) {
            cart.splice(index, 1); // Remove if qty is 0
        }
    } else if (change > 0) {
        cart.push({ service_id: id, service_name: name, price: price, qty: 1 });
    }
    
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    updateCartUI();
    renderServices(document.getElementById("searchInput").value); 
}

function updateCartUI() {
    const topCartBtn = document.getElementById("topCartBtn");
    const cartBar = document.getElementById("bottomCartBar");
    const cartText = document.getElementById("bottomCartText");
    
    // Total Items count (Total members booked)
    let totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    // Total Price based on Qty
    let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    topCartBtn.innerText = `🛒 Cart (${totalItems})`;

    if (totalItems > 0) {
        cartText.innerHTML = `${totalItems} Item${totalItems > 1 ? 's' : ''} <span style="color:#cbd5e1; margin:0 8px;">|</span> ₹${totalPrice}`;
        cartBar.classList.add("visible");
    } else {
        cartBar.classList.remove("visible");
    }
}

function openModal(serviceId) {
    const service = allServices.find(s => s.service_id === serviceId);
    if (!service) return;

    document.getElementById("modalTitle").innerText = formatText(service.service_name);
    
    let descRaw = String(service.description || '');
    let formattedDesc = "<p style='text-align:center;'>No details available.</p>";
    
    if (descRaw.trim() !== "") {
        let items = descRaw.split(/<br>|\n/).filter(i => i.trim() !== '');
        formattedDesc = "<ul>" + items.map(i => `<li>${formatText(i.trim())}</li>`).join('') + "</ul>";
    }
    
    document.getElementById("modalBody").innerHTML = formattedDesc;
    document.getElementById("infoModal").classList.add("active");
}
function closeModal() {
    document.getElementById("infoModal").classList.remove("active");
}

function openVipPromo() {
    document.getElementById("vipPromoModal").classList.add("active");
}
function closeVipPromo() {
    document.getElementById("vipPromoModal").classList.remove("active");
}

function openCart() {
    window.location.href = "cart.html"; 
}
