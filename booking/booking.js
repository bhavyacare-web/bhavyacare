// Map for the specific names you requested
const typeNameMap = {
    'pathology': 'Test',
    'package': 'Health Package',
    'usg': 'Ultrasound',
    'xray': 'X-Ray',
    'ct': 'CT Scan',
    'mri': 'MRI',
    'ecg': 'ECG',
    'echo': 'ECHO'
};

const mainCategoryKeys = ['pathology', 'package', 'usg', 'xray', 'ct', 'mri', 'ecg', 'echo'];

let allServices = [];
let userPlanStatus = "basic"; 
let currentCategory = 'pathology'; 
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];
let searchTimeout; // Debounce timer ke liye

// GOOGLE APPS SCRIPT WEB APP URL YAHAN DALEIN
const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartBadge();
    fetchBookingData();
};

function fetchBookingData() {
    const userId = localStorage.getItem("user_id"); 
    
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
            renderServices(); // Initial render
        } else {
            alert("Error fetching services: " + response.message);
        }
    })
    .catch(error => {
        document.getElementById("loading").innerHTML = "Failed to load data.";
        console.error("Error:", error);
    });
}

function renderCategories() {
    const mainContainer = document.getElementById("mainCategories");
    const sliderContainer = document.getElementById("sliderCategories");
    
    // String builder for performance (No innerHTML inside loops!)
    let mainHtml = "";
    let sliderHtml = "";

    const existingTypes = [...new Set(allServices.map(s => s.service_type.toLowerCase()))];

    mainCategoryKeys.forEach(key => {
        let displayName = typeNameMap[key] || key.toUpperCase();
        let isPresent = existingTypes.includes(key);
        let isSelected = currentCategory === key ? 'selected' : '';
        
        if(isPresent) {
            mainHtml += `<div class="cat-card ${isSelected}" onclick="selectCategory('${key}')">
                            <strong>${displayName}</strong>
                         </div>`;
        } else {
            mainHtml += `<div class="cat-card" onclick="alert('${displayName} is currently unavailable.')">
                            <strong>${displayName}</strong><br><span class="coming-soon">Coming Soon</span>
                         </div>`;
        }
    });

    existingTypes.forEach(key => {
        if (!mainCategoryKeys.includes(key)) {
            let isSelected = currentCategory === key ? 'selected' : '';
            sliderHtml += `<button class="slider-btn ${isSelected}" onclick="selectCategory('${key}')">${key.toUpperCase()}</button>`;
        }
    });

    // Update DOM strictly ONCE
    mainContainer.innerHTML = mainHtml;
    sliderContainer.innerHTML = sliderHtml;
}

function selectCategory(categoryKey) {
    currentCategory = categoryKey;
    document.getElementById("searchInput").value = ""; 
    renderCategories(); 
    renderServices();
}

// 🚀 FIXED: Search with Debounce (Prevents hanging while typing)
function filterServices() {
    clearTimeout(searchTimeout); // Purana timer cancel karo
    searchTimeout = setTimeout(() => {
        const query = document.getElementById("searchInput").value.toLowerCase();
        renderServices(query);
    }, 300); // 300ms ka delay typing ke baad
}

// 🚀 FIXED: Render optimization
function renderServices(searchQuery = "") {
    const container = document.getElementById("servicesList");
    
    let filtered = allServices.filter(s => s.service_type.toLowerCase() === currentCategory);

    if (searchQuery) {
        filtered = allServices.filter(s => 
            s.service_name.toLowerCase().includes(searchQuery) || 
            s.service_id.toString().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#666;'>No services found.</p>";
        return;
    }

    // String Builder: Sab kuch memory me banayenge, fir ek sath print karenge
    let htmlContent = "";

    filtered.forEach(service => {
        const applicablePrice = (userPlanStatus === "vip") ? service.vip_price : service.basic_price;
        const inCart = cart.some(item => item.service_id === service.service_id);
        const btnBg = inCart ? 'background:var(--success);' : '';
        const btnText = inCart ? 'Added ✔' : 'Add +';

        htmlContent += `
            <div class="service-item">
                <div class="service-info">
                    <h3>${service.service_name} <span style="font-size:10px; color:#999;">(${service.service_id})</span></h3>
                    <p>Type: ${service.service_category}</p>
                    ${service.number_of_test ? `<p>Includes: ${service.number_of_test} Parameters</p>` : ''}
                    <div class="price-box">
                        <span class="mrp">₹${service.service_price}</span>
                        <span class="final-price">₹${applicablePrice}</span>
                        <span style="font-size:10px; background:var(--warning); padding:2px 5px; border-radius:3px; margin-left:5px;">${userPlanStatus.toUpperCase()} Price</span>
                    </div>
                </div>
                <button class="add-to-cart-btn" 
                        onclick="toggleCart('${service.service_id}', '${service.service_name}', ${applicablePrice})"
                        style="${btnBg}">
                    ${btnText}
                </button>
            </div>
        `;
    });

    // Update the DOM exactly ONCE per render
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
    updateCartBadge();
    
    // Sirf buttons update karne chahiye ideally, but for now re-render is safe
    renderServices(document.getElementById("searchInput").value); 
}

function updateCartBadge() {
    document.getElementById("cartBtn").innerText = `🛒 Cart (${cart.length})`;
}

function openCart() {
    alert("Navigating to Cart Page... Items: " + cart.length);
    // window.location.href = "cart.html"; // Hum baad me ye enable karenge
}
