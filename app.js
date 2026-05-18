// --- FIREBASE REAL-TIME CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBvljGvya6X2DMnUsXYG4eSQLPoSAA_tWI",
    authDomain: "siva-pravathi-sarees-21e51.firebaseapp.com",
    databaseURL: "https://siva-pravathi-sarees-21e51-default-rtdb.firebaseio.com",
    projectId: "siva-pravathi-sarees-21e51",
    storageBucket: "siva-pravathi-sarees-21e51.firebasestorage.app",
    messagingSenderId: "898509144668",
    appId: "1:898509144668:web:36c8e74e1e72df6e561c99",
    measurementId: "G-8Y87KQ7NK3"
};

// Initialize Firebase SDK
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- INITIALIZATION & STATE ---
const SHOP_ID = "170617";
const SHOP_PASS = "123456";
const ROOT_PATH = `shops/${SHOP_ID}`;

let currentUser = { id: SHOP_ID, pass: SHOP_PASS };
let syncRef = null;
let isFirebaseReady = false;

// Initial state with local cache support
let state = loadInitialState();

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    startLiveSync();
    setupEventListeners();
    updateDate();
    loadFast2SMSKey();
    loadMetaWhatsAppKeys();
    setInterval(updateDate, 60000);
});

function loadInitialState() {
    const defaultState = { borrowers: [], sales: [], suppliers: [], password: SHOP_PASS };
    const saved = localStorage.getItem('sp_state_backup');
    try {
        return saved ? JSON.parse(saved) : defaultState;
    } catch (e) {
        return defaultState;
    }
}

function updateDate() { 
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.innerText = formatDate(new Date()); 
}

// --- FIREBASE SYNC LOGIC (Matches Footwear App Pattern) ---
function startLiveSync() {
    if (!currentUser) return;
    const status = document.getElementById('sync-status');
    if (status) status.innerHTML = '<i class="fas fa-sync fa-spin"></i> Connecting...';

    syncRef = db.ref(ROOT_PATH);
    syncRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const cloudData = snapshot.val();
            // Verify password or just sync if it's our shop
            if (cloudData.password === SHOP_PASS) {
                // Only update if cloud data is actually different
                if (JSON.stringify(cloudData) !== JSON.stringify(state)) {
                    state = cloudData;
                    localStorage.setItem('sp_state_backup', JSON.stringify(state));
                    renderAll();
                }
                isFirebaseReady = true;
                if (status) status.innerHTML = '<i class="fas fa-check-circle"></i> Live Sync Active';
            }
        } else {
            // First time setup: push current local state to cloud
            saveState();
            isFirebaseReady = true;
        }
    }, (error) => {
        console.error("Sync Error:", error);
        if (status) status.innerHTML = '<i class="fas fa-wifi-slash"></i> Sync Offline';
    });
}

async function saveState() {
    // 1. Update local cache immediately for instant feel
    localStorage.setItem('sp_state_backup', JSON.stringify(state));
    updateDashboardStats();
    
    // 2. Sync to Firebase
    const status = document.getElementById('sync-status');
    try {
        state.password = SHOP_PASS; // Ensure password persists
        await db.ref(ROOT_PATH).set(state);
        if (status) status.innerHTML = '<i class="fas fa-check-circle"></i> Saved to Cloud';
        
        // Return to "Live Active" status after a short delay
        setTimeout(() => {
            if (isFirebaseReady && status) status.innerHTML = '<i class="fas fa-check-circle"></i> Live Sync Active';
        }, 2000);
    } catch (e) {
        console.error("Cloud Save Failed:", e);
        if (status) status.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Save Failed';
    }
}

// --- CORE LOGIC ---
function initNavigation() {
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-section');
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('main > section').forEach(sec => sec.style.display = 'none');
            const targetSec = document.getElementById(target);
            if(targetSec) targetSec.style.display = 'block';
            document.querySelector('aside').classList.remove('show');
            renderAll();
        });
    });
    const d = document.getElementById('dashboard'); if(d) d.style.display = 'block';
}

function renderAll() {
    renderBorrowers(); renderSales(); renderSuppliers(); updateDashboardStats();
    if (document.getElementById('reports').style.display !== 'none') generateMonthlyReport();
}

function renderBorrowers() {
    const list = document.querySelector('#borrowerTable tbody'); if (!list) return;
    const search = (document.getElementById('borrowerSearch')?.value || "").toLowerCase();
    list.innerHTML = (state.borrowers || []).filter(b => b.name.toLowerCase().includes(search) || (b.phone && b.phone.includes(search))).map((b, i) => {
        const paid = (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
        const bal = Number(b.amount) - paid;
        return `<tr><td>${b.name}</td><td>${b.phone||''}</td><td>₹${b.amount}</td><td>₹${paid}</td><td class="gold">₹${bal}</td>
            <td><div style="display:flex; gap:0.2rem; flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="openPaymentModal(${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem;">Pay</button>
                <button class="btn btn-outline" onclick="openEditBorrowerModal(${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem;"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline" onclick="openBorrowCreditModal(${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem;">+Bill</button>
                <button class="btn btn-outline" onclick="exportIndividual('borrowers', ${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem; color:var(--accent);"><i class="fas fa-file-excel"></i></button>
                <button class="btn btn-whatsapp" onclick="remindBorrower(${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem;"><i class="fab fa-whatsapp"></i></button>
                <a href="tel:${b.phone}" class="btn btn-outline" style="padding:0.2rem 0.4rem; font-size:0.65rem;"><i class="fas fa-phone"></i></a>
                <button class="btn btn-outline" onclick="deleteItem('borrowers', ${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem; color:var(--error);"><i class="fas fa-trash"></i></button>
            </div></td></tr>`;
    }).join('');
}

function renderSales() {
    const list = document.querySelector('#salesTable tbody'); if (!list) return;
    list.innerHTML = (state.sales || []).map((s, i) => `<tr><td>${s.date}</td><td>₹${s.price}</td><td><button class="btn btn-outline" onclick="deleteItem('sales', ${i})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function renderSuppliers() {
    const list = document.querySelector('#supplierTable tbody'); if (!list) return;
    list.innerHTML = (state.suppliers || []).map((s, i) => {
        const paid = (s.payments || []).reduce((a, c) => a + Number(c.amount), 0);
        const debt = Number(s.amount) - paid;
        return `<tr><td>${s.name}</td><td>₹${s.amount}</td><td>₹${paid}</td><td class="red">₹${debt}</td><td><div style="display:flex; gap:0.2rem; flex-wrap:wrap;"><button class="btn btn-primary" onclick="openSuppPaymentModal(${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem;">Pay</button><button class="btn btn-outline" onclick="openSuppBillModal(${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem;">+Bill</button><button class="btn btn-outline" onclick="exportIndividual('suppliers', ${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem; color:var(--accent);"><i class="fas fa-file-excel"></i></button><button class="btn btn-outline" onclick="deleteItem('suppliers', ${i})" style="padding:0.2rem 0.4rem; font-size:0.65rem; color:var(--error);"><i class="fas fa-trash"></i></button></div></td></tr>`;
    }).join('');
}

function updateDashboardStats() {
    const safeNum = (val) => {
        if (!val) return 0;
        const num = Number(val.toString().replace(/[^0-9.-]+/g, ""));
        return isNaN(num) ? 0 : num;
    };

    const formatCurrency = (num) => {
        return '₹' + Math.round(num).toLocaleString('en-IN');
    };

    // 1. Total Outstanding Credit (Borrowers)
    const totalCredit = (state.borrowers || []).reduce((acc, b) => {
        const borrowed = safeNum(b.amount);
        const paid = (b.payments || []).reduce((pAcc, p) => pAcc + safeNum(p.amount), 0);
        return acc + (borrowed - paid);
    }, 0);

    // 2. Daily Sales (Today)
    const todayStr = formatDate(new Date());
    const todaySales = (state.sales || []).reduce((acc, s) => {
        if (s.date && s.date.trim() === todayStr) {
            return acc + safeNum(s.price);
        }
        return acc;
    }, 0);

    // 3. Total Purchased (Supplier Bills)
    const totalPurchased = (state.suppliers || []).reduce((acc, s) => acc + safeNum(s.amount), 0);

    // 4. Total Owed to Suppliers
    const totalOwed = (state.suppliers || []).reduce((acc, s) => {
        const bill = safeNum(s.amount);
        const paid = (s.payments || []).reduce((pAcc, p) => pAcc + safeNum(p.amount), 0);
        return acc + (bill - paid);
    }, 0);

    // Update UI
    if (document.getElementById('totalBarrow')) document.getElementById('totalBarrow').innerText = formatCurrency(totalCredit);
    if (document.getElementById('todaySales')) document.getElementById('todaySales').innerText = formatCurrency(todaySales);
    if (document.getElementById('totalPurchasedSum')) document.getElementById('totalPurchasedSum').innerText = formatCurrency(totalPurchased);
    if (document.getElementById('totalOwed')) document.getElementById('totalOwed').innerText = formatCurrency(totalOwed);
}

function setupEventListeners() {
    const handleForm = (id, logic) => {
        const el = document.getElementById(id);
        if (el) el.onsubmit = async (e) => {
            e.preventDefault();
            const btn = el.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            // 1. Instant UI Feedback
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            btn.disabled = true;

            try { 
                // 2. Run logic (Update local state)
                logic(); 
                
                // 3. Render and Close Modal immediately
                renderAll(); 
                closeModal(); 
                el.reset(); 

                // 4. Cloud Sync in background (Don't wait/await if we want instant feel)
                saveState(); 
            } catch (err) { 
                console.error("Form Error:", err);
                alert("Something went wrong locally!"); 
            } finally { 
                // Restore button state for next time
                btn.innerHTML = originalText; 
                btn.disabled = false; 
            }
        };
    };
    handleForm('borrowerForm', () => {
        const editIdx = document.getElementById('borrowerEditIndex').value;
        const name = document.getElementById('custName').value; 
        const phone = document.getElementById('custPhone').value; 
        const amt = document.getElementById('custAmount').value; 
        const today = formatDate(new Date());

        if (!state.borrowers) state.borrowers = [];

        if (editIdx !== "-1") {
            // Update existing
            const b = state.borrowers[editIdx];
            // Only update history if amount changed
            if (Number(b.amount) !== Number(amt)) {
                b.history.push({ date: today, type: 'Amount Updated', amount: amt });
            }
            b.name = name;
            b.phone = phone;
            b.amount = amt;
        } else {
            // Add new
            state.borrowers.push({ 
                name, phone, amount: amt, date: today, payments: [], 
                history: [{ date: today, type: 'Initial Borrow', amount: amt }] 
            });
        }
    });
    handleForm('paymentForm', () => {
        const i = document.getElementById('paymentBorrowerIndex').value; const amt = document.getElementById('payAmount').value; const dateVal = document.getElementById('payDate').value;
        const date = dateVal ? formatDateFromInput(dateVal) : formatDate(new Date());
        if(!state.borrowers[i].payments) state.borrowers[i].payments = [];
        state.borrowers[i].payments.push({ amount: amt, date: date });
        state.borrowers[i].history = (state.borrowers[i].history || []).concat([{ date: date, type: 'Payment', amount: `-${amt}` }]);
    });
    handleForm('saleForm', () => { 
        if(!state.sales) state.sales = []; 
        const amt = document.getElementById('salePrice').value;
        const dateVal = document.getElementById('saleDate').value;
        const date = dateVal ? formatDateFromInput(dateVal) : formatDate(new Date());
        state.sales.push({ price: amt, date: date }); 
    });
    handleForm('supplierForm', () => {
        const name = document.getElementById('suppName').value; const amt = document.getElementById('suppAmount').value; 
        const dateVal = document.getElementById('suppDate').value;
        const date = dateVal ? formatDateFromInput(dateVal) : formatDate(new Date());
        if(!state.suppliers) state.suppliers = [];
        state.suppliers.push({ name, amount: amt, payments: [], date: date, history: [{ date: date, type: 'Initial Bill', amount: amt }] });
    });
    handleForm('suppPaymentForm', () => {
        const i = document.getElementById('suppPaymentIndex').value; const amt = document.getElementById('suppPayAmount').value; 
        const dateVal = document.getElementById('suppPayDate').value;
        const date = dateVal ? formatDateFromInput(dateVal) : formatDate(new Date());
        if(!state.suppliers[i].payments) state.suppliers[i].payments = [];
        state.suppliers[i].payments.push({ amount: amt, date: date });
        state.suppliers[i].history = (state.suppliers[i].history || []).concat([{ date: date, type: 'Payment', amount: `-${amt}` }]);
    });
    handleForm('suppBillForm', () => {
        const i = document.getElementById('suppBillIndex').value; const amt = document.getElementById('suppBillAmount').value; 
        const dateVal = document.getElementById('suppBillDate').value;
        const date = dateVal ? formatDateFromInput(dateVal) : formatDate(new Date());
        state.suppliers[i].amount = Number(state.suppliers[i].amount) + Number(amt);
        state.suppliers[i].history = (state.suppliers[i].history || []).concat([{ date: date, type: 'Additional Bill', amount: amt }]);
    });
    handleForm('borrowCreditForm', () => {
        const i = document.getElementById('borrowCreditIndex').value; const amt = document.getElementById('extraBorrowAmount').value; 
        const dateVal = document.getElementById('borrowCreditDate').value;
        const date = dateVal ? formatDateFromInput(dateVal) : formatDate(new Date());
        state.borrowers[i].amount = Number(state.borrowers[i].amount) + Number(amt);
        state.borrowers[i].history = (state.borrowers[i].history || []).concat([{ date: date, type: 'Additional Borrow', amount: amt }]);
    });
    document.getElementById('borrowerSearch')?.addEventListener('input', renderAll);
}

function closeModal() { 
    stopAutoSend();
    document.getElementById('modalOverlay').style.display = 'none'; 
}
function showModal(id) {
    document.getElementById('modalOverlay').style.display = 'flex';
    document.querySelectorAll('#modalOverlay > .form-card').forEach(m => m.style.display = 'none');
    if(document.getElementById(id)) {
        document.getElementById(id).style.display = 'block';
        // Reset to default "Add" state for borrower modal if id is borrowerModal
        if(id === 'borrowerModal' && document.getElementById('borrowerEditIndex').value === "-1") {
            document.getElementById('borrowerModalTitle').innerText = "Add New Borrower";
            document.getElementById('borrowerForm').reset();
            document.getElementById('borrowerEditIndex').value = "-1";
        }
        // Set default date to today for any date input in the modal
        const dateInput = document.getElementById(id).querySelector('input[type="date"]');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }
}

function openPaymentModal(i) { document.getElementById('paymentBorrowerIndex').value = i; showModal('paymentModal'); }
function openBorrowCreditModal(i) { document.getElementById('borrowCreditIndex').value = i; showModal('borrowCreditModal'); }
function openSuppPaymentModal(i) { document.getElementById('suppPaymentIndex').value = i; showModal('suppPaymentModal'); }
function openSuppBillModal(i) { document.getElementById('suppBillIndex').value = i; showModal('suppBillModal'); }

function openEditBorrowerModal(i) {
    const b = state.borrowers[i];
    document.getElementById('borrowerModalTitle').innerText = "Edit Borrower";
    document.getElementById('borrowerEditIndex').value = i;
    document.getElementById('custName').value = b.name;
    document.getElementById('custPhone').value = b.phone;
    document.getElementById('custAmount').value = b.amount;
    showModal('borrowerModal');
}

function openNewBorrowerModal() {
    document.getElementById('borrowerEditIndex').value = "-1";
    document.getElementById('borrowerModalTitle').innerText = "Add New Borrower";
    document.getElementById('borrowerForm').reset();
    showModal('borrowerModal');
}

function loadFast2SMSKey() {
    let key = localStorage.getItem('fast2sms_api_key') || '';
    if (!key) {
        key = 'B9tOEby7xYWzojcawmq5piGKD2RdC1IuZ6NrTVMhJH843gLUSXFQqRgKDbz41xcM7PrUsdWZ5e9AypBm';
        localStorage.setItem('fast2sms_api_key', key);
    }
    const input = document.getElementById('fast2smsApiKey');
    if (input) input.value = key;
    return key;
}

function saveFast2SMSKey() {
    const input = document.getElementById('fast2smsApiKey');
    if (input) {
        localStorage.setItem('fast2sms_api_key', input.value.trim());
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('fast2smsApiKey');
    const icon = document.getElementById('apiKeyEyeIcon');
    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function loadMetaWhatsAppKeys() {
    let key = localStorage.getItem('meta_waba_key') || '';
    let phoneId = localStorage.getItem('meta_waba_phone_id') || '';
    let templateId = localStorage.getItem('meta_waba_template_id') || '';

    const keyInput = document.getElementById('metaWabaKey');
    const phoneIdInput = document.getElementById('metaWabaPhoneId');
    const templateIdInput = document.getElementById('metaWabaTemplateId');

    if (keyInput) keyInput.value = key;
    if (phoneIdInput) phoneIdInput.value = phoneId;
    if (templateIdInput) templateIdInput.value = templateId;
}

function saveMetaWhatsAppKeys() {
    const keyInput = document.getElementById('metaWabaKey');
    const phoneIdInput = document.getElementById('metaWabaPhoneId');
    const templateIdInput = document.getElementById('metaWabaTemplateId');

    if (keyInput) localStorage.setItem('meta_waba_key', keyInput.value.trim());
    if (phoneIdInput) localStorage.setItem('meta_waba_phone_id', phoneIdInput.value.trim());
    if (templateIdInput) localStorage.setItem('meta_waba_template_id', templateIdInput.value.trim());
}

function toggleWabaKeyVisibility() {
    const input = document.getElementById('metaWabaKey');
    const icon = document.getElementById('wabaKeyEyeIcon');
    if (!input || !icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function formatWhatsAppPhone(phone) {
    if (!phone) return "";
    let clean = phone.toString().replace(/[^0-9]/g, "");
    if (clean.length === 10) {
        return "91" + clean;
    }
    return clean;
}

function remindBorrower(i) {
    const b = state.borrowers[i];
    const bal = Number(b.amount) - (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
    const msg = `నమస్కారం ${b.name}, శివ పార్వతి సారీస్ షాపు నుండి గుర్తు చేయునది. మీ బాకీ మొత్తం ₹${bal} ఇంకా చెల్లించాల్సి ఉంది. ధన్యవాదాలు!`;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = `whatsapp://send?phone=${formatWhatsAppPhone(b.phone)}&text=${encodeURIComponent(msg)}`;
    } else {
        window.open(`https://web.whatsapp.com/send?phone=${formatWhatsAppPhone(b.phone)}&text=${encodeURIComponent(msg)}`, '_blank');
    }
}

async function sendMacroDroidSMS(customerPhone, messageText) {
    const deviceId = "fa5f57e6-5ff2-418f-8fee-be5eb0967b83";
    const identifier = "saree";
    const url = `https://trigger.macrodroid.com/${deviceId}/${identifier}?phone=${encodeURIComponent(customerPhone)}&msg=${encodeURIComponent(messageText)}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            console.log("Signal sent to phone! SMS is sending in background.");
            return true;
        } else {
            console.error("Failed to trigger phone SMS.");
            return false;
        }
    } catch (error) {
        console.error("Error connecting to SMS Gateway:", error);
        return false;
    }
}

async function remindBorrowerSMS(i) {
    const b = state.borrowers[i];
    const bal = Number(b.amount) - (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
    const msg = `నమస్కారం ${b.name}, శివ పార్వతి సారీస్ షాపు నుండి గుర్తు చేయునది. మీ బాకీ మొత్తం ₹${bal} ఇంకా చెల్లించాల్సి ఉంది. ధన్యవాదాలు!`;
    
    // Trigger the free background SMS via MacroDroid
    sendMacroDroidSMS(b.phone, msg);
    alert(`Signal sent to your phone! SMS is being sent to ${b.name} in the background.`);
}

function deleteItem(type, i) { if(confirm('Delete?')) { state[type].splice(i, 1); saveState(); renderAll(); } }
function formatDate(date) { const d = new Date(date); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; }
function formatDateFromInput(val) { const [y, m, d] = val.split('-'); return `${d}-${m}-${y}`; }

function exportIndividual(type, index) {
    const item = state[type][index];
    let csv = `History for: ${item.name}\n\nDate,Action,Amount,Balance After\n`;
    let bal = 0;
    (item.history || [{ date: item.date, type: 'Initial', amount: item.amount }]).forEach(h => {
        const amtStr = h.amount.toString().replace('-','').replace('₹','');
        const amt = Number(amtStr);
        if (h.type.includes('Borrow') || h.type.includes('Initial') || h.type.includes('Bill')) bal += amt; else bal -= amt;
        csv += `${h.date},${h.type},₹${amt},₹${bal}\n`;
    });
    downloadCSV(csv, `${item.name}_Report.csv`);
}

function generateMonthlyReport() {
    const picker = document.getElementById('reportMonthPicker'); if (!picker?.value) return;
    const [year, month] = picker.value.split('-');
    let s_t = 0, c_t = 0, p_t = 0; const list = [];
    (state.sales||[]).forEach(s => { if(s.date.split('-')[1] === month && s.date.split('-')[2] === year) { s_t += Number(s.price); list.push({d:s.date, t:'Sale', a:s.price}); } });
    (state.borrowers||[]).forEach(b => (b.history || []).forEach(h => {
        const pts = h.date.split('-');
        if (pts[1] === month && pts[2] === year) {
            const amtStr = h.amount.toString().replace('-','').replace('₹','');
            const amt = Number(amtStr);
            if (h.type.includes('Borrow') || h.type.includes('Initial')) { c_t += amt; list.push({d:h.date, t:'Credit ('+b.name+')', a:amt}); }
            if (h.type === 'Payment') { p_t += amt; list.push({d:h.date, t:'Collection ('+b.name+')', a:amt}); }
        }
    }));
    document.getElementById('monthTotalSales').innerText = `₹${s_t}`;
    document.getElementById('monthTotalCredit').innerText = `₹${c_t}`;
    document.getElementById('monthTotalCollected').innerText = `₹${p_t}`;
    const tbody = document.querySelector('#monthlyBreakdownTable tbody');
    if(tbody) tbody.innerHTML = list.sort((a,b) => a.d.localeCompare(b.d)).map(i => `<tr><td>${i.d}</td><td>${i.t.includes('Sale') ? '₹'+i.a : '-'}</td><td>${i.t.includes('Credit') ? '₹'+i.a : '-'}</td><td>${i.t.includes('Collection') ? '₹'+i.a : '-'}</td></tr>`).join('');
}

function exportMonthlyReport() {
    const picker = document.getElementById('reportMonthPicker'); if (!picker?.value) return;
    let csv = `Monthly Report: ${picker.value}\nSales: ${document.getElementById('monthTotalSales').innerText}, Credits: ${document.getElementById('monthTotalCredit').innerText}, Collections: ${document.getElementById('monthTotalCollected').innerText}\n\nDate,Type,Amount\n`;
    document.querySelectorAll('#monthlyBreakdownTable tbody tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        const type = tds[1].innerText !== '-' ? 'Sale' : (tds[2].innerText !== '-' ? 'Credit' : 'Collection');
        const amt = tds[1].innerText !== '-' ? tds[1].innerText : (tds[2].innerText !== '-' ? tds[2].innerText : tds[3].innerText);
        csv += `${tds[0].innerText},${type},${amt}\n`;
    });
    downloadCSV(csv, `Monthly_Report_${picker.value}.csv`);
}

function exportData(type) {
    let csv = "Name,Phone,Total,Paid,Balance\n";
    if (type === 'sales') { csv = "Date,Amount\n"; (state.sales||[]).forEach(s => csv += `${s.date},₹${s.price}\n`); }
    else (state[type]||[]).forEach(b => csv += `"${b.name}",${b.phone||''},₹${b.amount},₹${(b.payments||[]).reduce((a,c)=>a+Number(c.amount),0)},₹${Number(b.amount)-(b.payments||[]).reduce((a,c)=>a+Number(c.amount),0)}\n`);
    downloadCSV(csv, `Siva_Sarees_${type}.csv`);
}

function downloadCSV(csv, f) { const b = new Blob(["\ufeff"+csv], {type:'text/csv;charset=utf-8;'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f; a.click(); }
let bulkQueue = [];
let currentQueueIndex = 0;
let autoSendTimer = null;
let countdownInterval = null;
let countdownSeconds = 5;
let isAutoSending = false;
let activeReminderMode = 'whatsapp'; // 'whatsapp' or 'sms'

function openBulkReminderModal() {
    bulkQueue = (state.borrowers || []).filter(b => {
        const paid = (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
        return (Number(b.amount) - paid) > 600;
    }).map(b => {
        const paid = (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
        return { ...b, balance: Number(b.amount) - paid };
    });

    currentQueueIndex = 0;
    stopAutoSend();
    renderBulkModalState();
    
    // Hide status card initially
    const statusCard = document.getElementById('bulkStatusCard');
    if (statusCard) statusCard.style.display = 'none';

    showModal('bulkReminderModal');
}

function renderBulkModalState() {
    const listDiv = document.getElementById('bulkReminderList');
    const progressText = document.getElementById('bulkProgressText');
    
    if (!listDiv || !progressText) return;

    if (bulkQueue.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-muted);">No borrowers found with balance > ₹600.</p>';
        progressText.innerText = "No pending reminders.";
        return;
    }

    // Render list with highlighted active customer
    listDiv.innerHTML = bulkQueue.map((b, i) => {
        const isActive = i === currentQueueIndex;
        const isCompleted = i < currentQueueIndex;
        const bg = isActive ? 'rgba(37, 211, 102, 0.15)' : (isCompleted ? 'rgba(255,255,255,0.01)' : 'transparent');
        const borderColor = isActive ? 'var(--accent)' : 'var(--border)';
        const checkIcon = isCompleted ? '<i class="fas fa-check-circle" style="color:#25D366; margin-right:5px;"></i>' : '';
        const activeIndicator = isActive ? '<span style="font-size:0.7rem; background:var(--accent); color:black; padding:2px 6px; border-radius:100px; font-weight:bold;">Next</span>' : '';

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem; border-bottom:1px solid var(--border); background:${bg}; border-left: 3px solid ${borderColor}; transition: all 0.3s ease;">
                <span style="display:flex; align-items:center; color:${isCompleted ? 'var(--text-muted)' : 'white'};">
                    ${checkIcon} ${b.name}
                </span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    ${activeIndicator}
                    <span class="gold" style="font-weight:bold;">₹${b.balance}</span>
                </div>
            </div>
        `;
    }).join('');

    if (currentQueueIndex < bulkQueue.length) {
        if (!isAutoSending) {
            const modeLabel = activeReminderMode === 'whatsapp' ? 'WhatsApp' : 'SMS';
            progressText.innerHTML = `Sending <strong>${currentQueueIndex + 1}</strong> of <strong>${bulkQueue.length}</strong> ${modeLabel} reminders`;
        }
    } else {
        progressText.innerHTML = `<span style="color:#25D366; font-weight:bold;"><i class="fas fa-check-double"></i> All reminders sent successfully!</span>`;
    }
}

function startCustomQueue(mode) {
    if (bulkQueue.length === 0) {
        alert("No borrowers to remind.");
        return;
    }
    activeReminderMode = mode;
    currentQueueIndex = 0;
    stopAutoSend();
    renderBulkModalState();
    startAutoSend();
}

function startAutoSend() {
    if (currentQueueIndex >= bulkQueue.length) {
        alert("Queue is already finished!");
        return;
    }

    isAutoSending = true;
    
    // Show status card during auto send
    const statusCard = document.getElementById('bulkStatusCard');
    if (statusCard) statusCard.style.display = 'block';

    runAutoSendStep();
}

function runAutoSendStep() {
    if (currentQueueIndex >= bulkQueue.length) {
        stopAutoSend();
        renderBulkModalState();
        return;
    }

    // 1. Send the current reminder
    sendNextSingleTabReminderDirectly();

    // 2. If there are more left, start the 5-second countdown to the next one
    if (currentQueueIndex < bulkQueue.length) {
        countdownSeconds = 5;
        updateCountdownUI();
        
        countdownInterval = setInterval(() => {
            countdownSeconds--;
            updateCountdownUI();
            if (countdownSeconds <= 0) {
                clearInterval(countdownInterval);
                runAutoSendStep(); // Trigger next send!
            }
        }, 1000);
    } else {
        stopAutoSend();
        renderBulkModalState();
    }
}

function updateCountdownUI() {
    const progressText = document.getElementById('bulkProgressText');
    if (!progressText) return;

    if (currentQueueIndex < bulkQueue.length) {
        const nextCustomer = bulkQueue[currentQueueIndex];
        const modeLabel = activeReminderMode === 'whatsapp' ? 'WhatsApp' : 'SMS';
        progressText.innerHTML = `<span style="color:#25D366; font-weight:bold;"><i class="fas fa-spinner fa-spin"></i> Next ${modeLabel} to ${nextCustomer.name} in ${countdownSeconds}s...</span>`;
    }
}

function sendNextSingleTabReminderDirectly() {
    if (currentQueueIndex >= bulkQueue.length) return;

    const b = bulkQueue[currentQueueIndex];
    const msg = `నమస్కారం ${b.name}, శివ పార్వతి సారీస్ షాపు నుండి గుర్తు చేయునది. మీ బాకీ మొత్తం ₹${b.balance} ఇంకా చెల్లించాల్సి ఉంది. ధన్యవాదాలు!`;

    const apiKey = (localStorage.getItem('fast2sms_api_key') || '').trim();

    if (activeReminderMode === 'whatsapp') {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            // Instantly launch native WhatsApp mobile app directly (100% Free, no Chrome prompts!)
            window.location.href = `whatsapp://send?phone=${formatWhatsAppPhone(b.phone)}&text=${encodeURIComponent(msg)}`;
        } else {
            // Desktop WhatsApp Web
            window.open(`https://web.whatsapp.com/send?phone=${formatWhatsAppPhone(b.phone)}&text=${encodeURIComponent(msg)}`, 'whatsapp_sender_tab');
        }
    } else {
        // Trigger the free background SMS via MacroDroid
        sendMacroDroidSMS(b.phone, msg);
    }

    // Move to next customer
    currentQueueIndex++;
    renderBulkModalState();
}

function sendManualReminder() {
    if (currentQueueIndex >= bulkQueue.length) {
        alert("Queue is finished!");
        return;
    }
    stopAutoSend();
    sendNextSingleTabReminderDirectly();
}

function pauseAutoSend() {
    stopAutoSend();
    renderBulkModalState();
}

function stopAutoSend() {
    isAutoSending = false;
    if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        autoSendTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // Hide status card when auto send stops
    const statusCard = document.getElementById('bulkStatusCard');
    if (statusCard) statusCard.style.display = 'none';
}

function resetBulkQueue() {
    stopAutoSend();
    currentQueueIndex = 0;
    renderBulkModalState();
}

async function sendGroupSMS() {
    const list = (state.borrowers || []).filter(b => {
        const paid = (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
        return (Number(b.amount) - paid) > 600;
    }).map(b => {
        const paid = (b.payments || []).reduce((a, c) => a + Number(c.amount), 0);
        return { ...b, balance: Number(b.amount) - paid };
    });

    if (list.length === 0) {
        alert("No borrowers found with balance > ₹600.");
        return;
    }

    const phones = list.map(b => b.phone.trim()).filter(p => p.length === 10);
    if (phones.length === 0) {
        alert("No valid 10-digit phone numbers found!");
        return;
    }

    const apiKey = (localStorage.getItem('fast2sms_api_key') || '').trim();
    const msg = "నమస్కారం, శివ పార్వతి సారీస్ షాపు నుండి గుర్తు చేయునది. దయచేసి మీ బాకీ మొత్తం త్వరగా చెల్లించగలరు. ధన్యవాదాలు!";

        if (!confirm(`Are you sure you want to send automated background SMS to all ${list.length} borrowers using your phone's free SMS plan?`)) {
            return;
        }

        const statusCard = document.getElementById('bulkStatusCard');
        const progressText = document.getElementById('bulkProgressText');
        if (statusCard) statusCard.style.display = 'block';
        if (progressText) {
            progressText.innerHTML = `<span style="color:var(--accent); font-weight:bold;"><i class="fas fa-spinner fa-spin"></i> Dispatched bulk SMS to Phone...</span>`;
        }

        let successCount = 0;
        try {
            for (const borrower of list) {
                 const success = await sendMacroDroidSMS(borrower.phone, msg);
                 if (success) successCount++;
                 // Small delay so phone doesn't get overwhelmed
                 await new Promise(resolve => setTimeout(resolve, 2000));
            }
            alert(`Successfully sent signals! Your phone will now send SMS to ${successCount} borrowers in the background.`);
        } catch (err) {
            console.error("SMS Gateway Error:", err);
            alert("Error communicating with your phone.");
        } finally {
            if (statusCard) statusCard.style.display = 'none';
        }
}

async function sendWhatsAppAPIBulk() {
    const key = (localStorage.getItem('meta_waba_key') || '').trim();
    const phoneId = (localStorage.getItem('meta_waba_phone_id') || '').trim();
    const templateId = (localStorage.getItem('meta_waba_template_id') || '').trim();

    if (!key || !phoneId || !templateId) {
        alert("Please enter your Meta WhatsApp Access Token, Phone Number ID, and Template Name on the Dashboard settings card first!");
        return;
    }

    if (bulkQueue.length === 0) {
        alert("No borrowers found with balance > ₹600.");
        return;
    }

    if (!confirm(`Are you sure you want to send 100% automated background WhatsApp Business reminders to all ${bulkQueue.length} customers?`)) {
        return;
    }

    stopAutoSend();
    
    // Show progress indicator
    const statusCard = document.getElementById('bulkStatusCard');
    const progressText = document.getElementById('bulkProgressText');
    if (statusCard) statusCard.style.display = 'block';
    
    let successCount = 0;
    let lastErrorMsg = "";
    
    for (let i = 0; i < bulkQueue.length; i++) {
        const b = bulkQueue[i];
        if (progressText) {
            progressText.innerHTML = `<span style="color:#00e676; font-weight:bold;"><i class="fas fa-paper-plane fa-spin"></i> Sending Meta WhatsApp to ${b.name} (${i + 1}/${bulkQueue.length})...</span>`;
        }

        const formattedPhone = formatWhatsAppPhone(b.phone); // e.g. "919381515692"

        try {
            // Call official Meta Graph API messages endpoint
            const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "messaging_product": "whatsapp",
                    "to": formattedPhone,
                    "type": "template",
                    "template": {
                        "name": templateId,
                        "language": {
                            "code": "te" // Assuming Telugu template code. Can be updated dynamically if needed.
                        },
                        "components": [
                            {
                                "type": "body",
                                "parameters": [
                                    {
                                        "type": "text",
                                        "text": b.name
                                    },
                                    {
                                        "type": "text",
                                        "text": b.balance.toString()
                                    }
                                ]
                            }
                        ]
                    }
                })
            });

            const result = await response.json();
            if (response.ok && result.messages) {
                successCount++;
                currentQueueIndex = i + 1;
                renderBulkModalState();
            } else {
                lastErrorMsg = (result.error && result.error.message) || "Unknown Meta API error.";
                console.error("Failed to send message to", b.name, result);
            }
        } catch (err) {
            lastErrorMsg = "Network connection error.";
            console.error("Error calling Meta Cloud API:", err);
        }

        // Add a small 1-second delay between background messages to prevent spam flags
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (statusCard) statusCard.style.display = 'none';
    
    if (successCount === 0 && lastErrorMsg) {
        alert(`Meta WhatsApp API Error:\n\n"${lastErrorMsg}"\n\n(Please check if your System User Token has the 'whatsapp_business_messaging' permission, if your Phone Number ID is correct, or if your template name matches exactly on Facebook Developers portal).`);
    } else {
        alert(`Successfully sent ${successCount} out of ${bulkQueue.length} WhatsApp Business reminders automatically in the background!`);
    }
    resetBulkQueue();
}

function backupFullData() { const b = new Blob([JSON.stringify(state)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Backup.json`; a.click(); }
function restoreFullData(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (ev) => { try { state = JSON.parse(ev.target.result); saveState(true); alert("Restored!"); window.location.reload(); } catch(err) { alert("Error!"); } }; r.readAsText(f); }
function toggleSidebar() { document.querySelector('aside').classList.toggle('show'); }
