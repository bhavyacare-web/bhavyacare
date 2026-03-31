// Map for Category Names and Premium Icons
const categoryConfig = {
    'pathology': { name: 'Test', icon: '🩸' },
    'profile':   { name: 'Package', icon: '🩺' }, 
    'usg':       { name: 'Ultrasound', icon: '🖥️' },
    'xray':      { name: 'X-Ray', icon: '🩻' },
    'ct':        { name: 'CT Scan', icon: '☢️' },
    'mri':       { name: 'MRI', icon: '🧲' },
    'ecg':       { name: 'ECG', icon: '❤️' },
    'echo':      { name: 'ECHO', icon: '💓' }
};

const defaultIcon = '🧪';
const mainCategoryKeys = ['pathology', 'profile', 'usg', 'xray', 'ct', 'mri', 'ecg', 'echo'];

let allServices = [];
let userPlanStatus = "basic"; 
let currentCategory = 'profile'; // By default profile open karte hain as it's premium
let currentSubCategory = 'all'; // For package sub-categories
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let searchTimeout; 

// AAPKA ASLI API URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartUI(); 
    fetchBookingData();
};

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
    currentSubCategory = 'all'; // reset sub category
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

    // DYNAMIC SUB-CATEGORIES ONLY FOR PROFILES
    if (currentCategory === 'profile' && !searchQuery) {
        let subCats = ['all', ...new Set(filtered.map(s => String(s.service_category || 'Other').trim().replace(/_/g, ' ')))];
        let subHtml = `<div class="sub-cat-nav">`;
        subCats.forEach(sc => {
            let active = currentSubCategory === sc ? 'active' : '';
            subHtml += `<button class="sub-cat-btn ${active}" onclick="selectSubCategory('${sc}')">${sc.toUpperCase()}</button>`;
        });
        subHtml += `</div>`;
        subContainer.innerHTML = subHtml;

        if (currentSubCategory !== 'all') {
            filtered = filtered.filter(s => String(s.service_category || 'Other').trim().replace(/_/g, ' ') === currentSubCategory);
        }
    } else {
        subContainer.innerHTML = ""; // Clear if not profile or if searching
    }

    // SEARCH LOGIC
    if (searchQuery) {
        filtered = allServices.filter(s => 
            String(s.service_name || '').toLowerCase().includes(searchQuery) || 
            String(s.service_id || '').includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#666;'>No services found.</p>";
        return;
    }

    let htmlContent = "";

    filtered.forEach(service => {
        const isVip = userPlanStatus === "vip";
        const applicablePrice = isVip ? service.vip_price : service.basic_price;
        const inCart = cart.some(item => item.service_id === service.service_id);
        
        const btnClass = inCart ? 'add-to-cart-btn added' : 'add-to-cart-btn';
        const btnText = inCart ? 'ADDED ✔' : 'ADD +';
        
        const cleanDesc = String(service.description || '').replace(/'/g, "\\'").replace(/\n/g, "<br>");

        // 🌟 THE 3-TIER PRICING LOGIC 🌟
        let pricingHtml = "";
        if (isVip) {
            pricingHtml = `
                <div class="mrp-row">
                    <span>Total: <span class="mrp">₹${service.service_price}</span></span>
                    <span>Basic: <span class="mrp">₹${service.basic_price}</span></span>
                </div>
                <div class="final-price">₹${service.vip_price} <i class="fas fa-crown" style="color:var(--warning); font-size:14px;"></i> VIP</div>
            `;
        } else {
            pricingHtml = `
                <div class="mrp-row">
                    <span>Total: <span class="mrp">₹${service.service_price}</span></span>
                </div>
                <div class="final-price">₹${service.basic_price} <span style="font-size:10px; font-weight:normal; background:var(--primary-light); padding:2px 5px; border-radius:4px;">Basic</span></div>
                <div class="locked-price" onclick="alert('Upgrade to VIP Family Plan to unlock this premium rate!')">
                    <i class="fas fa-lock"></i> VIP Rate: ₹${service.vip_price}
                </div>
            `;
        }

        // 🌟 PROFILE (PACKAGE) SPECIAL UI 🌟
        if (currentCategory === 'profile' && !searchQuery) {
            htmlContent += `
                <div class="profile-item">
                    <div class="profile-header">
                        <span class="profile-badge">${String(service.service_category).replace(/_/g, ' ')}</span>
                        ${service.description ? `<div class="info-icon" onclick="openModal('${service.service_name}', '${cleanDesc}')"><i class="fas fa-info"></i></div>` : ''}
                    </div>
                    <div class="service-info">
                        <h3>${service.service_name}</h3>
                        ${service.number_of_test ? `<p>Includes <b>${service.number_of_test}</b> Tests/Parameters</p>` : ''}
                    </div>
                    <div class="price-box">
                        ${pricingHtml}
                    </div>
                    <button class="${btnClass}" onclick="toggleCart('${service.service_id}', '${service.service_name}', ${applicablePrice})">
                        ${btnText}
                    </button>
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
                        <h3 style="font-size:14px;">${service.service_name}</h3>
                        <div class="price-box" style="margin-top:5px; padding:5px;">
                            ${pricingHtml}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:flex-end;">
                        <button class="${btnClass}" style="position:static; padding:6px 15px; border-radius:8px;" onclick="toggleCart('${service.service_id}', '${service.service_name}', ${applicablePrice})">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = htmlContent;
}

// 🌟 MODAL LOGIC 🌟
function openModal(title, description) {
    document.getElementById("modalTitle").innerText = title + " Details";
    
    // Formatting descriptions into a clean list
    let formattedDesc = description;
    if(description.includes('<br>')) {
        let items = description.split('<br>').filter(i => i.trim() !== '');
        formattedDesc = "<ul>" + items.map(i => `<li>${i.trim().toUpperCase()}</li>`).join('') + "</ul>";
    }
    
    document.getElementById("modalBody").innerHTML = formattedDesc;
    document.getElementById("infoModal").classList.add("active");
}

function closeModal() {
    document.getElementById("infoModal").classList.remove("active");
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
        cartText.innerText = `${cart.length} Item${cart.length > 1 ? 's' : ''} | ₹${total}`;
        cartBar.classList.add("visible");
    } else {
        cartBar.classList.remove("visible");
    }
}

function openCart() {
    window.location.href = "cart.html"; 
}
