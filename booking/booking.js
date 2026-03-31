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

// Main 8 categories as requested
const mainCategoryKeys = ['pathology', 'package', 'usg', 'xray', 'ct', 'mri', 'ecg', 'echo'];

// Global State Variables
let allServices = [];
let userPlanStatus = "basic"; // 'basic' or 'vip'
let currentCategory = 'pathology'; // Default selection
let cart = JSON.parse(localStorage.getItem('bhavyaCart')) || [];

// Google Apps Script Web App URL (REPLACE WITH YOUR MACRO URL)
const GAS_URL = "https://script.google.com/macros/s/AKfycbz_leCWfb7HNhh4BLGLMqhM8dF9jCKpvmqIZkijnzEJl__E3dZftwl3z-hZ7mmzYtrHSA/exec"; 

window.onload = () => {
    updateCartBadge();
    fetchBookingData();
};

function fetchBookingData() {
    // Assuming you store user_id in localStorage during OTP login
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
            renderServices();
        } else {
            alert("Error fetching services: " + response.message);
        }
    })
    .catch(error => {
        document.getElementById("loading").innerHTML = "Failed to load.";
        console.error("Error:", error);
    });
}

function renderCategories() {
    const mainContainer = document.getElementById("mainCategories");
    const sliderContainer = document.getElementById("sliderCategories");
    
    mainContainer.innerHTML = "";
    sliderContainer.innerHTML = "";

    // Find all unique service_types in the data
    const existingTypes = [...new Set(allServices.map(s => s.service_type.toLowerCase()))];

    // Render Main 8 Categories
    mainCategoryKeys.forEach(key => {
        let displayName = typeNameMap[key] || key.toUpperCase();
        let isPresent = existingTypes.includes(key);
        
        let card = document.createElement("div");
        card.className = `cat-card ${currentCategory === key ? 'selected' : ''}`;
        card.innerHTML = `
            <strong>${displayName}</strong>
            ${!isPresent ? '<br><span class="coming-soon">Coming Soon</span>' : ''}
        `;
        
        if(isPresent) {
            card.onclick = () => selectCategory(key);
        } else {
            card.onclick = () => alert(`${displayName} is currently unavailable.`);
        }
        mainContainer.appendChild(card);
    });

    // Render Remaining Categories in Slider
    existingTypes.forEach(key => {
        if (!mainCategoryKeys.includes(key)) {
            let btn = document.createElement("button");
            btn.className = `slider-btn ${currentCategory === key ? 'selected' : ''}`;
            btn.innerText = key.toUpperCase();
            btn.onclick = () => selectCategory(key);
            sliderContainer.appendChild(btn);
        }
    });
}

function selectCategory(categoryKey) {
    currentCategory = categoryKey;
    document.getElementById("searchInput").value = ""; // clear search
    renderCategories(); // Re-render to update 'selected' CSS class
    renderServices();
}

function filterServices() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    renderServices(query);
}

function renderServices(searchQuery = "") {
    const container = document.getElementById("servicesList");
    container.innerHTML = "";

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

    filtered.forEach(service => {
        // Determine correct price based on VIP status
        const applicablePrice = (userPlanStatus === "vip") ? service.vip_price : service.basic_price;
        const inCart = cart.some(item => item.service_id === service.service_id);

        let html = `
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
                        ${inCart ? 'style="background:var(--success);"' : ''}>
                    ${inCart ? 'Added ✔' : 'Add +'}
                </button>
            </div>
        `;
        container.innerHTML += html;
    });
}

function toggleCart(id, name, price) {
    const index = cart.findIndex(item => item.service_id === id);
    if (index > -1) {
        cart.splice(index, 1); // Remove if already in cart
    } else {
        cart.push({ service_id: id, service_name: name, price: price });
    }
    
    localStorage.setItem('bhavyaCart', JSON.stringify(cart));
    updateCartBadge();
    renderServices(document.getElementById("searchInput").value); // Re-render to update button state
}

function updateCartBadge() {
    document.getElementById("cartBtn").innerText = `🛒 Cart (${cart.length})`;
}

function openCart() {
    // Next phase: Implement navigation to cart.html
    alert("Navigating to Cart Page... Items: " + cart.length);
}
