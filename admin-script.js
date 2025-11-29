// =========================================================
// FIREBASE CONFIG
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyBYd5P0m7FM9ddiZeMC8WYgYWDvGcrsmvM",
    authDomain: "absensi-yayasan.firebaseapp.com",
    projectId: "absensi-yayasan",
    storageBucket: "absensi-yayasan.firebasestorage.app",
    messagingSenderId: "124598327702",
    appId: "1:124598327702:web:6d7f748c54fcfc667d65b7",
    measurementId: "G-KRZKL3FKKM"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =========================================================
// CEK AUTH & ADMIN
// =========================================================
let allPekerjaData = [];
let currentAdminUid = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentAdminUid = user.uid;
    
    // Cek apakah user ini admin
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists || doc.data().is_admin !== true) {
        alert('Anda tidak memiliki akses admin!');
        await auth.signOut();
        window.location.href = 'index.html';
        return;
    }
    
    // Tampilkan info admin
    const data = doc.data();
    document.getElementById('admin-nama').textContent = data.nama_lengkap || user.email;
    document.getElementById('admin-nik').textContent = data.NIK || '-';
    
    // Load data
    loadAllData();
});

// =========================================================
// LOAD ALL DATA
// =========================================================
async function loadAllData() {
    await loadPekerjaList();
    await loadStatistics();
    await loadAbsensiHariIni();
    
    // Set tanggal hari ini
    const today = new Date();
    document.getElementById('today-date').textContent = today.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// =========================================================
// LOAD PEKERJA LIST
// =========================================================
async function loadPekerjaList() {
    try {
        const snapshot = await db.collection('users')
            .where('is_admin', '==', false)
            .get();
        
        allPekerjaData = [];
        const tbody = document.getElementById('tbody-pekerja');
        
        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <p>Belum ada pekerja terdaftar</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const isDeleted = data.is_deleted === true;
            
            allPekerjaData.push({
                uid: doc.id,
                ...data
            });
            
            const row = `
                <tr style="${isDeleted ? 'opacity: 0.5;' : ''}">
                    <td>${data.NIK || '-'}</td>
                    <td style="text-transform: uppercase; font-weight: 600;">${data.nama_lengkap || '-'}</td>
                    <td><span class="badge" style="background: #667eea; color: white;">${data.jabatan || '-'}</span></td>
                    <td>${data.email || '-'}</td>
                    <td>
                        ${isDeleted 
                            ? '<span class="badge badge-danger">❌ Dihapus</span>' 
                            : '<span class="badge badge-success">✅ Aktif</span>'}
                    </td>
                    <td>
                        ${!isDeleted ? `
                            <button class="btn-action btn-edit" onclick="openEditModal('${doc.id}')">✏️ Edit</button>
                            <button class="btn-action btn-delete" onclick="deletePekerja('${doc.id}', '${data.nama_lengkap}')">🗑️ Hapus</button>
                            <button class="btn-action btn-reset" onclick="resetPassword('${data.email}')">🔑 Reset</button>
                        ` : `
                            <button class="btn-action btn-edit" onclick="restorePekerja('${doc.id}', '${data.nama_lengkap}')">↩️ Pulihkan</button>
                        `}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
        
    } catch (error) {
        console.error('Error loading pekerja:', error);
        alert('Gagal memuat data pekerja');
    }
}

// =========================================================
// SEARCH PEKERJA
// =========================================================
document.getElementById('search-pekerja').addEventListener('input', function(e) {
    const keyword = e.target.value.toLowerCase();
    const tbody = document.getElementById('tbody-pekerja');
    const rows = tbody.getElementsByTagName('tr');
    
    for (let row of rows) {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(keyword) ? '' : 'none';
    }
});

// =========================================================
// STATISTICS
// =========================================================
async function loadStatistics() {
    try {
        // Total pekerja aktif (tidak dihapus)
        const pekerjaSnapshot = await db.collection('users')
            .where('is_admin', '==', false)
            .where('is_deleted', '==', false)
            .get();
        
        const totalPekerja = pekerjaSnapshot.size;
        
        // Absensi hari ini
        const today = getTodayDateString();
        const absenSnapshot = await db.collection('absensi_reguler')
            .where('tanggal_key', '==', today)
            .get();
        
        const sudahAbsen = new Set();
        absenSnapshot.forEach(doc => {
            sudahAbsen.add(doc.data().user_id);
        });
        
        const jumlahHadir = sudahAbsen.size;
        const jumlahBelum = totalPekerja - jumlahHadir;
        
        document.getElementById('stat-total').textContent = totalPekerja;
        document.getElementById('stat-hadir').textContent = jumlahHadir;
        document.getElementById('stat-belum').textContent = jumlahBelum;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// =========================================================
// ABSENSI HARI INI
// =========================================================
async function loadAbsensiHariIni() {
    try {
        const today = getTodayDateString();
        
        // Get semua pekerja aktif
        const pekerjaSnapshot = await db.collection('users')
            .where('is_admin', '==', false)
            .where('is_deleted', '==', false)
            .get();
        
        const allPekerja = [];
        pekerjaSnapshot.forEach(doc => {
            allPekerja.push({
                uid: doc.id,
                ...doc.data()
            });
        });
        
        // Get absensi hari ini
        const absenSnapshot = await db.collection('absensi_reguler')
            .where('tanggal_key', '==', today)
            .get();
        
        const sudahAbsen = new Map();
        absenSnapshot.forEach(doc => {
            const data = doc.data();
            if (!sudahAbsen.has(data.user_id)) {
                sudahAbsen.set(data.user_id, data);
            }
        });
        
        // Pisahkan yang sudah dan belum absen
        const listHadir = document.getElementById('list-hadir');
        const listBelum = document.getElementById('list-belum');
        
        listHadir.innerHTML = '';
        listBelum.innerHTML = '';
        
        let countHadir = 0;
        let countBelum = 0;
        
        allPekerja.forEach(pekerja => {
            if (sudahAbsen.has(pekerja.uid)) {
                const absen = sudahAbsen.get(pekerja.uid);
                listHadir.innerHTML += `
                    <div style="padding: 8px; border-bottom: 1px solid #f0f0f0;">
                        <strong>${pekerja.nama_lengkap}</strong><br>
                        <small class="text-muted">Masuk: ${absen.waktu_masuk || '-'}</small>
                    </div>
                `;
                countHadir++;
            } else {
                listBelum.innerHTML += `
                    <div style="padding: 8px; border-bottom: 1px solid #f0f0f0;">
                        <strong>${pekerja.nama_lengkap}</strong><br>
                        <small class="text-muted">NIK: ${pekerja.NIK}</small>
                    </div>
                `;
                countBelum++;
            }
        });
        
        document.getElementById('count-hadir').textContent = countHadir;
        document.getElementById('count-belum').textContent = countBelum;
        
        if (countHadir === 0) {
            listHadir.innerHTML = '<p class="text-muted small">Belum ada yang absen</p>';
        }
        
        if (countBelum === 0) {
            listBelum.innerHTML = '<p class="text-muted small">Semua sudah absen!</p>';
        }
        
    } catch (error) {
        console.error('Error loading absensi:', error);
    }
}

function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// =========================================================
// EDIT PEKERJA
// =========================================================
function openEditModal(uid) {
    const pekerja = allPekerjaData.find(p => p.uid === uid);
    if (!pekerja) return;
    
    document.getElementById('edit-uid').value = uid;
    document.getElementById('edit-nik').value = pekerja.NIK || '';
    document.getElementById('edit-nama').value = pekerja.nama_lengkap || '';
    document.getElementById('edit-jabatan').value = pekerja.jabatan || 'HELPER';
    document.getElementById('edit-email').value = pekerja.email || '';
    
    document.getElementById('modal-edit').classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

document.getElementById('form-edit').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const uid = document.getElementById('edit-uid').value;
    const nik = document.getElementById('edit-nik').value.trim();
    const nama = document.getElementById('edit-nama').value.trim().toUpperCase();
    const jabatan = document.getElementById('edit-jabatan').value;
    const email = document.getElementById('edit-email').value.trim();
    
    // Validasi NIK
    if (nik.length !== 16) {
        alert('NIK harus 16 digit!');
        return;
    }
    
    if (!confirm(`Simpan perubahan data pekerja?`)) return;
    
    try {
        // Tentukan role_level berdasarkan jabatan
        let roleLevel = 4;
        let isAdmin = false;
        
        if (jabatan === 'DIREKTUR' || jabatan === 'ADMIN & IT') {
            roleLevel = 1;
            isAdmin = true;
        } else if (jabatan === 'PENGURUS') {
            roleLevel = 3;
            isAdmin = true;
        } else {
            roleLevel = 4;
            isAdmin = false;
        }
        
        // Update Firestore
        await db.collection('users').doc(uid).update({
            NIK: nik,
            nama_lengkap: nama,
            jabatan: jabatan,
            email: email,
            role_level: roleLevel,
            is_admin: isAdmin
        });
        
        alert('✅ Data pekerja berhasil diupdate!');
        closeModal('modal-edit');
        loadAllData();
        
    } catch (error) {
        console.error('Error updating pekerja:', error);
        alert('❌ Gagal update data: ' + error.message);
    }
});

// =========================================================
// DELETE PEKERJA (SOFT DELETE)
// =========================================================
async function deletePekerja(uid, nama) {
    if (!confirm(`Yakin ingin menghapus pekerja:\n${nama}\n\nPekerja tidak akan bisa login lagi.`)) {
        return;
    }
    
    try {
        // Soft delete - set flag is_deleted
        await db.collection('users').doc(uid).update({
            is_deleted: true,
            deleted_at: firebase.firestore.FieldValue.serverTimestamp(),
            deleted_by: currentAdminUid
        });
        
        alert('✅ Pekerja berhasil dihapus!');
        loadAllData();
        
    } catch (error) {
        console.error('Error deleting pekerja:', error);
        alert('❌ Gagal menghapus pekerja: ' + error.message);
    }
}

// =========================================================
// RESTORE PEKERJA
// =========================================================
async function restorePekerja(uid, nama) {
    if (!confirm(`Pulihkan akun pekerja:\n${nama}\n\nPekerja akan bisa login kembali.`)) {
        return;
    }
    
    try {
        await db.collection('users').doc(uid).update({
            is_deleted: false
        });
        
        alert('✅ Pekerja berhasil dipulihkan!');
        loadAllData();
        
    } catch (error) {
        console.error('Error restoring pekerja:', error);
        alert('❌ Gagal memulihkan pekerja: ' + error.message);
    }
}

// =========================================================
// RESET PASSWORD
// =========================================================
async function resetPassword(email) {
    if (!confirm(`Kirim email reset password ke:\n${email}\n\nPekerja akan menerima link untuk reset password.`)) {
        return;
    }
    
    try {
        await auth.sendPasswordResetEmail(email);
        alert(`✅ Email reset password telah dikirim ke ${email}`);
        
    } catch (error) {
        console.error('Error reset password:', error);
        alert('❌ Gagal kirim email: ' + error.message);
    }
}

// =========================================================
// LOGOUT
// =========================================================
document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('Logout dari admin dashboard?')) {
        await auth.signOut();
        window.location.href = 'index.html';
    }
});