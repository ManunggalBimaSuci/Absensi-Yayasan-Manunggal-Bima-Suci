// FINAL PENGURUS-SCRIPT.JS
// Versi lengkap — dashboard pengurus dengan pemisahan Pengurus vs Pekerja/Helper

/**
 * ROLE LEVEL
 * 1 = Direktur → Tidak masuk daftar absensi
 * 2 = Admin IT → Tidak masuk daftar absensi
 * 3 = Pengurus → Masuk daftar khusus Pengurus
 * 4 = Pekerja/Helper → Masuk daftar pekerja
 */

firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;

    const db = firebase.firestore();

    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists) {
        const data = doc.data();
        document.getElementById('pengurus-nama').textContent = data.nama_lengkap || user.email;
        document.getElementById('pengurus-nik').textContent = data.NIK || '-';
        document.getElementById('pengurus-jabatan').textContent = data.jabatan || 'Pengurus';
    }

    loadStatistik();
    loadAbsensiHarian();
});

document.getElementById('today-date').textContent = new Date().toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric'
});

// ========================================================
// 1. STATISTIK — Total PENGURUS dan Pekerja
// ========================================================
async function loadStatistik() {
    const db = firebase.firestore();
    const today = new Date();
    const tanggalKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Hitung semua pekerja role ≥ 3 (Pengurus + Helper)
    const usersSnap = await db.collection('users')
        .where('role_level', '>=', 3)
        .get();

    const total = usersSnap.size;
    document.getElementById('stat-total').textContent = total;

    // Hitung yang sudah absen
    const absenSnap = await db.collection('absensi_reguler')
        .where('tanggal_key', '==', tanggalKey)
        .get();

    let hadir = 0;
    absenSnap.forEach(a => {
        const userExist = usersSnap.docs.find(x => x.id === a.data().user_id);
        if (userExist) hadir++;
    });

    document.getElementById('stat-hadir').textContent = hadir;
    document.getElementById('stat-belum').textContent = total - hadir;
}

// ========================================================
// 2. DAFTAR ABSENSI — Pisahkan Pengurus VS Pekerja
// ========================================================
async function loadAbsensiHarian() {
    const db = firebase.firestore();
    const today = new Date();
    const tanggalKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Elemen DOM
    const listHadirPengurus = document.getElementById('list-hadir-pengurus');
    const listBelumPengurus = document.getElementById('list-belum-pengurus');

    const listHadirPekerja = document.getElementById('list-hadir-pekerja');
    const listBelumPekerja = document.getElementById('list-belum-pekerja');

    const countHadirPengurus = document.getElementById('count-hadir-pengurus');
    const countBelumPengurus = document.getElementById('count-belum-pengurus');

    const countHadirPekerja = document.getElementById('count-hadir-pekerja');
    const countBelumPekerja = document.getElementById('count-belum-pekerja');

    // Tampilkan loading
    listHadirPengurus.innerHTML = listBelumPengurus.innerHTML = '<p class="text-muted">Memuat...</p>';
    listHadirPekerja.innerHTML = listBelumPekerja.innerHTML = '<p class="text-muted">Memuat...</p>';

    // Ambil semua user role ≥ 3 (pengurus & pekerja)
    const usersSnap = await db.collection('users')
        .where('role_level', '>=', 3)
        .get();

    // Ambil absensi hari ini
    const absenSnap = await db.collection('absensi_reguler')
        .where('tanggal_key', '==', tanggalKey)
        .get();

    const hadirIds = new Set();
    absenSnap.forEach(doc => hadirIds.add(doc.data().user_id));

    // Reset tampilan
    listHadirPengurus.innerHTML = '';
    listBelumPengurus.innerHTML = '';

    listHadirPekerja.innerHTML = '';
    listBelumPekerja.innerHTML = '';

    let hadirPengurus = 0;
    let belumPengurus = 0;
    let hadirPekerja = 0;
    let belumPekerja = 0;

    // Loop user satu per satu
    usersSnap.forEach(doc => {
        const data = doc.data();
        const item = document.createElement('div');
        item.className = 'absensi-item';
        item.innerHTML = `
            <strong>${data.nama_lengkap}</strong><br>
            <small>${data.jabatan || '-'} | NIK: ${data.NIK || '-'}</small>
        `;

        const isPengurus = data.role_level === 3;
        const sudahAbsen = hadirIds.has(doc.id);

        if (isPengurus) {
            if (sudahAbsen) {
                listHadirPengurus.appendChild(item);
                hadirPengurus++;
            } else {
                listBelumPengurus.appendChild(item);
                belumPengurus++;
            }
        } else {
            // Pekerja / Helper
            if (sudahAbsen) {
                listHadirPekerja.appendChild(item);
                hadirPekerja++;
            } else {
                listBelumPekerja.appendChild(item);
                belumPekerja++;
            }
        }
    });

    // Update jumlah
    countHadirPengurus.textContent = hadirPengurus;
    countBelumPengurus.textContent = belumPengurus;

    countHadirPekerja.textContent = hadirPekerja;
    countBelumPekerja.textContent = belumPekerja;

    // JAM REALTIME GLOBAL
setInterval(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');

    const jamEl = document.getElementById('jam-realtime');
    if (jamEl) jamEl.textContent = `${hh}:${mm}:${ss}`;
}, 1000);

}