// ✨ GLOBAL HEADER ✨
const globalHeader = `
    <header class="navbar">
        <div class="logo">
            <img src="image/bhavyacarelogo.jpeg" alt="BhavyaCare" onerror="this.onerror=null; this.src='image/bhavyacarelogo.png'; if(this.src.includes('png')) { this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block'; }">
            <h2 style="color: #0056b3; font-size: 26px; font-weight: 800; margin: 0;">Bhavya<span style="color: #28a745;">Care</span></h2>
        </div>
        
        <div class="nav-actions">
            <button id="nav-login-btn" class="nav-btn login-btn" onclick="openPatientLogin()">Login</button>
            
            <div class="dropdown">
                <button id="main-menu-btn" class="dropbtn" onclick="toggleMenu()">⋮</button>
                <div id="user-menu-container">
                    <button class="user-profile-btn" onclick="toggleMenu()">My Account</button>
                </div>
                <div id="myDropdown" class="dropdown-content">
                    <a href="#" id="menu-dashboard" onclick="goToDashboard()" style="display: none;"><i class="fas fa-chart-line" style="color: var(--secondary); width: 20px;"></i> My Dashboard</a>
                    <a href="prescription.html"><i class="fas fa-upload" style="color: #8b5cf6; width: 20px;"></i> Upload Prescription</a>
                    <a href="terms.html"><i class="fas fa-file-contract" style="color: #64748b; width: 20px;"></i> Terms & Conditions</a>
                    <a href="privacy.html"><i class="fas fa-user-shield" style="color: #64748b; width: 20px;"></i> Privacy Policy</a>
                    <a href="refund.html"><i class="fas fa-undo" style="color: #64748b; width: 20px;"></i> Refund Policy</a>
                    <a href="contact.html"><i class="fas fa-headset" style="color: #64748b; width: 20px;"></i> Help & Support</a>
                    <hr>
                    <a href="#" id="menu-logout" onclick="logoutUser()" style="display: none; color: #e74c3c;"><i class="fas fa-sign-out-alt" style="width: 20px;"></i> Logout</a>
                </div>
            </div>
        </div>
    </header>
`;

// ✨ GLOBAL MODALS (Login & Admin) ✨
const globalModals = `
    <div id="login-section">
        <button onclick="closeLoginPopup()" style="position:absolute; top:15px; right:15px; background:#f1f5f9; border:none; width:32px; height:32px; border-radius:50%; font-size:16px; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;"><i class="fas fa-times"></i></button>
        <h3 id="form-title">Login / Sign Up</h3>
        <div id="phone-section">
            <div id="partner-role-container" style="display: none; margin-bottom: 15px;">
                <p style="text-align: left; font-size: 14px; color: #666; margin-bottom: 2px;">Select Partner Type:</p>
                <select id="partnerRole" class="input-box" onchange="updateNameLabel()">
                    <option value="doctor" selected>Doctor</option>
                    <option value="lab">Lab</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="hospital">Hospital</option>
                    <option value="executive">Executive</option>
                </select>
            </div>
            <p id="nameLabel" style="text-align: left; font-size: 14px; color: #666; margin-bottom: 2px;">Full Name:</p>
            <input type="text" id="userName" class="input-box" placeholder="Enter your full name">
            <p style="text-align: left; font-size: 14px; color: #666; margin-bottom: 2px;">Mobile Number:</p>
            <input type="tel" id="phoneNumber" class="input-box" placeholder="e.g. 8950112467" maxlength="10">
            <div id="recaptcha-container" style="margin-top: 10px;"></div>
            <button id="send-otp-btn" class="action-btn" onclick="sendOTP()">Get OTP</button>
        </div>
        <div id="otp-section" style="display: none;">
            <p style="text-align: left; font-size: 14px; color: #666; margin-bottom: 2px;">Enter OTP:</p>
            <input type="tel" id="otpCode" class="input-box" placeholder="6-digit OTP" maxlength="6">
            <button class="action-btn" style="background-color: #0056b3;" onclick="verifyOTP()">Verify Mobile</button>
        </div>
        <p class="support-text">Need help? Email us at bhavyacare1@gmail.com</p>
    </div>

    <div id="adminPasswordModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:3000; justify-content:center; align-items:center; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:24px; width:90%; max-width:350px; position:relative; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.3); animation: slideUpToast 0.3s ease-out;">
            <button onclick="closeAdminPasswordModal()" style="position:absolute; right:15px; top:15px; border:none; background:#f1f5f9; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:16px; color:#64748b; transition:0.2s;"><i class="fas fa-times"></i></button>
            <div style="background:#e0f2fe; color:#0284c7; width:65px; height:65px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:26px; margin:0 auto 15px;">
                <i class="fas fa-user-shield"></i>
            </div>
            <h3 style="margin:0 0 15px 0; color:#0f172a; font-size:22px; font-weight:800;">Admin Area</h3>
            <p style="color:#64748b; font-size:13px; margin:0 0 20px;">Enter security password to access the panel.</p>
            <input type="password" id="adminPassInput" placeholder="Password" style="width:100%; padding:14px; border:2px solid #e2e8f0; border-radius:12px; font-size:16px; outline:none; text-align:center; margin-bottom:15px; font-weight:bold;">
            <button onclick="verifyAdminPassword()" style="background:var(--primary); color:white; border:none; width:100%; padding:14px; border-radius:12px; font-weight:800; font-size:16px; cursor:pointer; transition:0.2s; box-shadow:0 4px 15px rgba(37,99,235,0.3);">Access Panel</button>
        </div>
    </div>
`;

// ✨ GLOBAL FOOTER ✨
const globalFooter = `
    <footer class="footer">
        <div class="footer-grid">
            <div class="footer-col">
                <div class="logo" style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                    <img src="image/bhavyacarelogo.jpeg" alt="BhavyaCare" style="height: 45px; border-radius: 8px;" onerror="this.onerror=null; this.src='image/bhavyacarelogo.png'; if(this.src.includes('png')) { this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block'; }">
                    <h2 style="color: white; font-size: 24px; font-weight: 800; margin: 0;">Bhavya<span style="color: #28a745;">Care</span></h2>
                </div>
                <p>Making premium healthcare accessible, affordable, and accurate for everyone. Book tests, consult doctors, and order medicines with ease.</p>
                <div style="display: flex; gap: 15px; margin-top: 15px;">
                    <a href="https://wa.me/918950112467" style="color: white; font-size: 20px;"><i class="fab fa-whatsapp"></i></a>
                    <a href="#" style="color: white; font-size: 20px;"><i class="fab fa-facebook"></i></a>
                    <a href="#" style="color: white; font-size: 20px;"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            
            <div class="footer-col">
                <h3>Our Services</h3>
                <a href="booking/booking.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Book Lab Tests</a>
                <a href="bookdoctor/bookdoctor.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Consult a Doctor</a>
                <a href="pharmacy/medicineorders.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Order Medicines</a>
                <a href="vip/vip_member.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> VIP Membership</a>
                <a href="prescription.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Upload Prescription</a>
            </div>

            <div class="footer-col">
                <h3>Company</h3>
                <a href="about.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> About Us</a>
                <a href="#" onclick="openPartnerLogin()"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Join Us (Partner)</a>
                <a href="#" onclick="openAdminPasswordModal(event)"><i class="fas fa-shield-alt" style="font-size:10px; color:#17a2b8;"></i> Admin Login</a>
                <a href="contact.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Contact Support</a>
            </div>

            <div class="footer-col">
                <h3>Legal & Policies</h3>
                <a href="terms.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Terms & Conditions</a>
                <a href="privacy.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Privacy Policy</a>
                <a href="refund.html"><i class="fas fa-chevron-right" style="font-size:10px;"></i> Refund & Cancellation</a>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 BhavyaCare Healthcare Services. All Rights Reserved.</p>
        </div>
    </footer>
`;

// Yahan script chalegi aur in sabhi ko HTML page par inject kar degi
document.addEventListener("DOMContentLoaded", function() {
    
    // Header Inject
    const headerPlaceholder = document.getElementById("header-placeholder");
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = globalHeader;
    }

    // Modals Inject
    const modalsPlaceholder = document.getElementById("modals-placeholder");
    if (modalsPlaceholder) {
        modalsPlaceholder.innerHTML = globalModals;
    }

    // Footer Inject
    const footerPlaceholder = document.getElementById("footer-placeholder");
    if (footerPlaceholder) {
        footerPlaceholder.innerHTML = globalFooter;
    }
});
