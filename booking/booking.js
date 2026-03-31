// Map for Category Names and Premium Icons
const categoryConfig = {
    'pathology': { name: 'Test', icon: '🩸' },
    'package':   { name: 'Package', icon: '🩺' },
    'usg':       { name: 'Ultrasound', icon: '🖥️' },
    'xray':      { name: 'X-Ray', icon: '🩻' },
    'ct':        { name: 'CT Scan', icon: '☢️' },
    'mri':       { name: 'MRI', icon: '🧲' },
    'ecg':       { name: 'ECG', icon: '❤️' },
    'echo':      { name: 'ECHO', icon: '💓' }
};

const defaultIcon = '🧪';
const mainCategoryKeys = ['pathology', 'package', 'usg', 'xray', 'ct', 'mri', 'ecg', 'echo'];

let allServices = [];
let userPlanStatus = "basic"; 
let currentCategory = 'pathology'; 
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let searchTimeout; 

// AAPKA ASLI API URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartUI(); 
    fetchBookingData();
};

function fetchBookingData() {
    // 🚀 FIX: Ab ye bhavya_user_id check karega jo login system set karta hai
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
            alert("Error fetching services: " + response.message);
        }
    })
    .catch(error => {
        document.getElementById("loading").innerHTML = "Failed to load data. Please check your connection.";
        console.error("Error:", error);
    });
}

function renderCategories() {
    const mainContainer = document.getElementById("mainCategories");
    const sliderContainer = document.getElementById("sliderCategories");
    
    let mainHtml = "";
    let sliderHtml = "";

    const existingTypes = [...new Set(allServices.map(s => s.service_type.toLowerCase().trim()))];

    // Main Grid Categories
    mainCategoryKeys.forEach(key => {
        let config = categoryConfig[key] || { name: key.toUpperCase(), icon: defaultIcon };
        let isPresent = existingTypes.includes(key);
        let isSelected = currentCategory === key ? 'selected' : '';
        
        if(isPresent) {
            mainHtml += `<div class="cat-card ${isSelected}" onclick="selectCategory('${key}')">
                            <div class="cat-icon">${config.icon}</div>
                            <span class="cat-name">${config.name}</span>
                         </div>`;
        } else {
            mainHtml += `<div class="cat-card" style="opacity: 0.5;" onclick="alert('${config.name} is currently unavailable.')">
                            <div class="cat-icon">${config.icon}</div>
                            <span class="cat-name">${config.name}</span>
                         </div>`;
        }
    });

    // Slider Categories
    existingTypes.forEach(key => {
        if (!mainCategoryKeys.includes(key)) {
            let isSelected = currentCategory === key ? 'selected' : '';
            sliderHtml += `<button class="slider-btn ${isSelected}" onclick="selectCategory('${key}')">${key.toUpperCase()}</button>`;
        }
    });

    mainContainer.innerHTML = mainHtml;
    sliderContainer.innerHTML = sliderHtml;
}

function selectCategory(categoryKey) {
    currentCategory = categoryKey;
    document.getElementById("searchInput").value = ""; 
    renderCategories(); 
    renderServices();
}

function filterServices() {
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(() => {
        const query = document.getElementById("searchInput").value.toLowerCase();
        renderServices(query);
    }, 300); 
}

function renderServices(searchQuery = "") {
    const container = document.getElementById("servicesList");
    
    let filtered = allServices.filter(s => s.service_type.toLowerCase().trim() === currentCategory);

    if (searchQuery) {
        filtered = allServices.filter(s => 
            s.service_name.toLowerCase().includes(searchQuery) || 
            s.service_id.toString().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding: 40px 20px;'><span style='font-size:40px;'>🔍</span><br><br><p style='color:var(--text-muted);'>No services found matching your search.</p></div>";
        return;
    }

    let htmlContent = "";

    filtered.forEach(service => {
        const applicablePrice = (userPlanStatus === "vip") ? service.vip_price : service.basic_price;
        const inCart = cart.some(item => item.service_id === service.service_id);
        
        const btnClass = inCart ? 'add-to-cart-btn added' : 'add-to-cart-btn';
        const btnText = inCart ? 'ADDED' : 'ADD +';

        let imageHtml = "";
        let catType = service.service_type.toLowerCase().trim();
        let catIcon = categoryConfig[catType]?.icon || defaultIcon;
        
        if (service.service_image && service.service_image.trim() !== "") {
            imageHtml = `<img src="${service.service_image}" alt="Test" onerror="this.style.display='none'; this.parentNode.innerHTML='${catIcon}';">`;
        } else {
            imageHtml = catIcon;
        }

        htmlContent += `
            <div class="service-item">
                <div class="service-img-box">
                    ${imageHtml}
                </div>
                <div class="service-info">
                    <h3>${service.service_name}</h3>
                    <p>${service.service_category} ${service.number_of_test ? `• ${service.number_of_test} Parameters` : ''}</p>
                    <div class="price-box">
                        <span class="final-price">₹${applicablePrice}</span>
                        <span class="mrp">₹${service.service_price}</span>
                        <span class="plan-tag">${userPlanStatus.toUpperCase()} PRICE</span>
                    </div>
                </div>
                <button class="${btnClass}" 
                        onclick="toggleCart('${service.service_id}', '${service.service_name}', ${applicablePrice})">
                    ${btnText}
                </button>
            </div>
        `;
    });

    container.innerHTML = htmlContent;
}

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
