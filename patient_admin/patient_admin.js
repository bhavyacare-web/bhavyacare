// 🌟 APNA SAME GOOGLE SCRIPT URL YAHAN DAALO 🌟
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzJBqkkPwvrU9bGZQXfFMnXuWOlBwegueUhYZyf1QCrcbdaqFrZEcgBx4OC90lEc5wV8w/exec";

// Page load hote hi data fetch karo
document.addEventListener("DOMContentLoaded", fetchPatientsData);

async function fetchPatientsData() {
    const tableBody = document.getElementById("patientsTableBody");
    const loader = document.getElementById("loader");
    
    tableBody.innerHTML = ""; // Purana data saaf karo
    loader.style.display = "block"; // Loader dikhao

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getPatients" }) // Backend ko bataya ki patients ka data chahiye
        });

        const result = await response.json();

        if (result.status === "success") {
            const patients = result.data;
            loader.style.display = "none";

            if (patients.length === 0) {
                tableBody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>No patients found in the system yet.</td></tr>";
                return;
            }

            // Har patient ke liye ek table row (tr) banao
            patients.forEach(patient => {
                const statusBadge = patient.status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive';
                
                const row = `
                    <tr>
                        <td>${patient.timestamp}</td>
                        <td><strong>${patient.user_id}</strong></td>
                        <td>${patient.patient_name}</td>
                        <td>${patient.mobile_number}</td>
                        <td style="text-transform: capitalize;">${patient.role}</td>
                        <td>${patient.referral_code}</td>
                        <td style="font-weight: bold; color: #28a745;">₹${patient.wallet}</td>
                        <td style="text-transform: capitalize;">${patient.plan}</td>
                        <td><span class="badge ${statusBadge}">${patient.status.toUpperCase()}</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } else {
            loader.innerHTML = "❌ Error loading data: " + result.message;
            loader.style.color = "red";
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        loader.innerHTML = "❌ Network Error! Failed to fetch data.";
        loader.style.color = "red";
    }
}
