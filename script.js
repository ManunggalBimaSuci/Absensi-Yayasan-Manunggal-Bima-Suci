// =========================================================
// 1. KONFIGURASI FIREBASE
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
const storage = firebase.storage();

console.log("Firebase initialized successfully!");

// =========================================================
// 2. GLOBAL VARIABLES
// =========================================================
let currentUserLocation = null;
let locationWatchId = null;

// Halaman saat ini
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// =========================================================
// 3. TAUTAN ELEMEN HTML (DOM)
// =========================================================
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginErrorMessage = document.getElementById('login-error-message'); 
const btnLogout = document.getElementById('btn-logout');

const btnAbsenMasuk = document.getElementById('btn-absen-masuk');
const btnAbsenKeluar = document.getElementById('btn-absen-keluar');
const btnLemburMasuk = document.getElementById('btn-lembur-masuk');
const btnLemburKeluar = document.getElementById('btn-lembur-keluar');

const cameraInput = document.getElementById('camera-input');
const statusAbsensiReguler = document.getElementById('status-absensi-reguler');
const statusAbsensiLembur = document.getElementById('status-absensi-lembur');

// =========================================================
// 4. REQUEST LOKASI SAAT HALAMAN DIMUAT
// =========================================================
window.addEventListener('load', () => {
    requestLocationPermission();
});

function requestLocationPermission() {
    if (!navigator.geolocation) {
        console.error('Geolocation tidak didukung browser');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentUserLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            console.log('Lokasi berhasil didapat:', currentUserLocation);
            
            locationWatchId = navigator.geolocation.watchPosition(
                (pos) => {
                    currentUserLocation = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    };
                },
                (error) => console.error('Error watching location:', error),
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
            );
        },
        (error) => {
            console.error('Error getting location:', error);
            alert('Mohon izinkan akses lokasi untuk menggunakan sistem absensi!');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// =========================================================
// 5. LOGIKA LOGIN DAN CEK STATUS AUTH (PAGE-AWARE)
// =========================================================
auth.onAuthStateChanged((user) => {
    console.log("Auth state changed:", user ? user.email : "No user", "on page:", currentPage);
    
    if (user) {
        db.collection('users').doc(user.uid).get().then(doc => {
            if (!doc.exists) {
                alert('Akun tidak ditemukan!');
                auth.signOut();
                return;
            }
            
            const data = doc.data();
            
            // Cek apakah akun dihapus
            if (data.is_deleted === true) {
                alert('Akun Anda telah dinonaktifkan. Hubungi admin.');
                auth.signOut();
                return;
            }
            
            const roleLevel = data.role_level || 4;

            // ====== ADMIN & DIREKTUR (ROLE 1 & 2) ======
            if (roleLevel === 1 || roleLevel === 2) {
                if (currentPage !== 'admin-dashboard.html') {
                    // Kalau belum di admin-dashboard, paksa pindah
                    window.location.href = 'admin-dashboard.html';
                }
                // Kalau sudah di admin-dashboard, biarkan saja (script admin yang ngatur tampilan)
                return;
            }

            // ====== PENGURUS (ROLE 3) ======
            if (roleLevel === 3) {
                if (currentPage !== 'pengurus-dashboard.html') {
                    // Kalau belum di pengurus-dashboard, arahkan ke sana
                    window.location.href = 'pengurus-dashboard.html';
                }
                // Kalau SUDAH di pengurus-dashboard, jangan redirect lagi
                // Pengurus tidak memakai loginContainer/dashboardContainer di halaman ini
                return;
            }

            // ====== PEKERJA / HELPER (ROLE LAIN) → HALAMAN ABSENSI BIASA ======
            // Hanya di halaman index/dashboard utama kita atur tampilan ini
            if (currentPage === 'index.html' || currentPage === '' ) {
                if (loginContainer) loginContainer.style.display = 'none';
                if (dashboardContainer) dashboardContainer.style.display = 'block';
                
                getDataUser(user);
                checkAbsensiStatus(user, 'reguler');
                checkAbsensiStatus(user, 'lembur');
            } else {
                // Kalau pekerja tapi nyasar ke halaman lain → balikin ke index
                window.location.href = 'index.html';
            }
            
        }).catch(error => {
            console.error('Error checking user data:', error);
            alert('Terjadi kesalahan. Silakan coba lagi.');
            auth.signOut();
        });

    } else {
        // Tidak ada user login
        if (currentPage === 'index.html' || currentPage === '') {
            if (loginContainer) loginContainer.style.display = 'block';
            if (dashboardContainer) dashboardContainer.style.display = 'none';
            if (loginForm) loginForm.reset();
        } else {
            // Kalau bukan di halaman login utama, paksa balik ke index
            window.location.href = 'index.html';
        }
    }
});

function getDataUser(user) {
    db.collection('users').doc(user.uid).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            
            const userNik = document.getElementById('user-nik');
            const userNama = document.getElementById('user-nama');
            const userJabatan = document.getElementById('user-jabatan');
            
            if (userNik) userNik.textContent = data.NIK || '-';
            if (userNama) userNama.textContent = data.nama_lengkap || user.email;
            if (userJabatan) userJabatan.textContent = data.jabatan || '-';
            
        } else {
            const userNama = document.getElementById('user-nama');
            if (userNama) userNama.textContent = user.email;
        }
    }).catch(error => {
        console.error("Error mengambil data user:", error);
    });
}

// ================== LOGIN FORM (DILINDUNGI NULL) ==================
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        console.log("Attempting login with:", email);
        
        if (loginErrorMessage) {
            loginErrorMessage.style.display = 'none'; 
            loginErrorMessage.textContent = ''; 
        }

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Login successful:", userCredential.user.email);
                loginForm.reset();
            })
            .catch((error) => {
                console.error("Login Gagal:", error.code, error.message);
                
                if (!loginErrorMessage) return;

                if (error.code === 'auth/user-not-found') {
                    loginErrorMessage.textContent = "Email tidak terdaftar. Hubungi admin untuk mendaftar.";
                } else if (error.code === 'auth/wrong-password') {
                    loginErrorMessage.textContent = "Password salah. Coba lagi.";
                } else if (error.code === 'auth/invalid-credential') {
                    loginErrorMessage.textContent = "Email atau Password salah. Coba lagi.";
                } else if (error.code === 'auth/invalid-email') {
                    loginErrorMessage.textContent = "Format email tidak valid.";
                } else if (error.code === 'auth/too-many-requests') {
                    loginErrorMessage.textContent = "Terlalu banyak percobaan login. Coba lagi nanti.";
                } else {
                    loginErrorMessage.textContent = `Login Gagal: ${error.message}`;
                }
                
                loginErrorMessage.style.display = 'block';
            });
    });
}

// ================== LOGOUT ==================
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        if (confirm('Logout dari sistem absensi?')) {
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
            }
            
            auth.signOut().then(() => {
                console.log("Logout successful");
                window.location.href = 'index.html';
            }).catch((error) => {
                alert("Logout Gagal!");
                console.error("Logout Gagal:", error);
            });
        }
    });
}

// =========================================================
// 6. FUNGSI UTILITAS GLOBAL
// =========================================================
function getGeolocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation tidak didukung oleh browser.'));
        } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 0    
            });
        }
    });
}

function getSelfie() {
    return new Promise(resolve => {
        if (!cameraInput) {
            console.error("camera-input tidak ditemukan");
            resolve(null);
            return;
        }

        cameraInput.value = ''; 
        cameraInput.click();

        cameraInput.onchange = (e) => {
            const file = e.target.files[0];
            resolve(file || null); 
        };
    });
}

function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`Foto dikompres: ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Gagal kompres foto'));
                    }
                }, 'image/jpeg', quality);
            };
            
            img.onerror = () => reject(new Error('Gagal load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Gagal baca file'));
        reader.readAsDataURL(file);
    });
}

function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
}

function formatDateTime() {
    const now = new Date();
    return {
        tanggal: now.toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        jam: now.toLocaleTimeString('id-ID'),
        timestamp: now
    };
}

// =========================================================
// 7. LOGIKA ABSEN MASUK DENGAN PREVIEW & KONFIRMASI
// =========================================================
if (btnAbsenMasuk) {
    btnAbsenMasuk.addEventListener('click', () => showPreviewAbsen('MASUK', 'reguler'));
}
if (btnLemburMasuk) {
    btnLemburMasuk.addEventListener('click', () => showPreviewAbsen('MASUK', 'lembur'));
}

async function showPreviewAbsen(type, jenis) {
    const user = auth.currentUser;
    if (!user) {
        alert("Anda belum login!");
        return;
    }
    
    const statusElement = jenis === 'reguler' ? statusAbsensiReguler : statusAbsensiLembur;
    if (!statusElement) {
        console.warn("status element tidak ditemukan untuk jenis:", jenis);
        return;
    }
    
    try {
        statusElement.innerHTML = '<p class="text-info">📍 Mengambil lokasi akurat...</p>';
        const position = await getGeolocation();
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        const dateTime = formatDateTime();
        
        statusElement.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border: 2px solid #667eea;">
                <h6 class="text-primary" style="margin-bottom: 15px;">📋 Preview Absen ${type} ${jenis.toUpperCase()}</h6>
                
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 5px 0;"><strong>📍 Lokasi Anda:</strong></p>
                    <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">
                        Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}<br>
                        Akurasi: ±${accuracy.toFixed(0)} meter
                    </p>
                </div>
                
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 5px 0;"><strong>📅 ${dateTime.tanggal}</strong></p>
                    <p style="margin: 5px 0;"><strong>⏰ ${dateTime.jam}</strong></p>
                </div>
                
                <button onclick="takePhotoForAbsen('${type}', '${jenis}', ${latitude}, ${longitude})" 
                        class="btn btn-success w-100" style="padding: 12px; font-weight: 600;">
                    📸 Ambil Foto Selfie
                </button>
                <button onclick="cancelAbsen('${jenis}')" 
                        class="btn btn-outline-secondary w-100 mt-2">
                    ❌ Batal
                </button>
            </div>
        `;
        
    } catch (error) {
        let errorMessage = "Gagal mengambil lokasi. Pastikan GPS aktif!";
        if (error.code === 1) {
            errorMessage = "Akses lokasi ditolak. Mohon izinkan akses lokasi.";
        }
        if (statusElement) {
            statusElement.innerHTML = `<p class="text-danger">❌ ${errorMessage}</p>`;
        }
        console.error("Error preview absen:", error);
    }
}

window.takePhotoForAbsen = async function(type, jenis, latitude, longitude) {
    const user = auth.currentUser;
    const statusElement = jenis === 'reguler' ? statusAbsensiReguler : statusAbsensiLembur;
    if (!statusElement) return;
    
    try {
        statusElement.innerHTML = '<p class="text-info">📸 Menunggu foto selfie...</p>';
        
        const photoFile = await getSelfie();
        
        if (!photoFile) {
            statusElement.innerHTML = '<p class="text-danger">Absen dibatalkan (Foto tidak diambil).</p>';
            return;
        }
        
        const photoURL = URL.createObjectURL(photoFile);
        const dateTime = formatDateTime();
        
        statusElement.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; border: 2px solid #28a745;">
                <h6 class="text-success" style="margin-bottom: 15px;">✅ Konfirmasi Absen ${type}</h6>
                
                <div style="text-align: center; margin-bottom: 15px;">
                    <img src="${photoURL}" style="max-width: 100%; max-height: 300px; border-radius: 10px; border: 3px solid #28a745;">
                </div>
                
                <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="margin: 5px 0;">✅ <strong>Lokasi:</strong> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
                    <p style="margin: 5px 0;">✅ <strong>Tanggal:</strong> ${dateTime.tanggal}</p>
                    <p style="margin: 5px 0;">✅ <strong>Jam:</strong> ${dateTime.jam}</p>
                </div>
                
                <button onclick="confirmAbsen('${type}', '${jenis}', ${latitude}, ${longitude})" 
                        class="btn btn-success w-100 mb-2" style="padding: 12px; font-weight: 600;">
                    ✔️ Konfirmasi & Kirim
                </button>
                <button onclick="cancelAbsen('${jenis}')" 
                        class="btn btn-outline-secondary w-100">
                    🔄 Ambil Foto Ulang
                </button>
            </div>
        `;
        
    } catch (error) {
        statusElement.innerHTML = '<p class="text-danger">Gagal mengambil foto.</p>';
        console.error("Error taking photo:", error);
    }
};

window.confirmAbsen = async function(type, jenis, latitude, longitude) {
    const user = auth.currentUser;
    const collectionName = `absensi_${jenis}`;
    const statusElement = jenis === 'reguler' ? statusAbsensiReguler : statusAbsensiLembur;
    
    if (!statusElement) return;
    
    try {
        statusElement.innerHTML = '<p class="text-warning">⏳ Mengirim data absensi ke server...</p>';
        
        const photoFile = cameraInput && cameraInput.files ? cameraInput.files[0] : null;
        if (!photoFile) {
            statusElement.innerHTML = '<p class="text-danger">Error: Foto tidak ditemukan</p>';
            return;
        }
        
        const compressedBlob = await compressImage(photoFile, 800, 0.75);
        
        const now = new Date();
        const tanggal_key = getTodayDateString();
        const tanggal_view = now.toLocaleDateString('id-ID', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const jam = now.toLocaleTimeString('id-ID');
        
        statusElement.innerHTML = '<p class="text-warning">📤 Mengunggah foto... <span id="upload-progress">0%</span></p>';
        
        const photoRef = storage.ref(`${collectionName}/${user.uid}/${tanggal_key}_${jenis}_${type.toLowerCase()}.jpg`);
        const uploadTask = photoRef.put(compressedBlob);
        
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const progressEl = document.getElementById('upload-progress');
                if (progressEl) {
                    progressEl.textContent = `${progress.toFixed(0)}%`;
                }
            }
        );
        
        await uploadTask;
        const fotoUrl = await photoRef.getDownloadURL();
        
        await db.collection(collectionName).add({
            user_id: user.uid,
            tanggal_key: tanggal_key,
            tanggal_view: tanggal_view,
            waktu_masuk: jam,
            latitude_masuk: latitude,
            longitude_masuk: longitude,
            url_foto_masuk: fotoUrl,
            timestamp_masuk: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'MASUK',
            jenis_absen: jenis
        });
        
        statusElement.innerHTML = `
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); 
                        color: white; padding: 30px; border-radius: 15px; text-align: center; 
                        animation: fadeIn 0.5s;">
                <h3 style="margin: 0 0 10px 0; font-size: 2rem;">✅</h3>
                <h5 style="margin: 0 0 10px 0;">ABSEN BERHASIL!</h5>
                <h4 style="margin: 10px 0;">🎉 Selamat Bekerja!</h4>
                <p style="margin: 10px 0; font-size: 1.1rem; opacity: 0.95;">
                    <strong>${tanggal_view}</strong><br>
                    Jam Masuk: ${jam}
                </p>
            </div>
        `;
        
        setTimeout(() => {
            checkAbsensiStatus(user, jenis);
        }, 3000);
        
    } catch (error) {
        statusElement.innerHTML = `<p class="text-danger">❌ Gagal kirim absen: ${error.message}</p>`;
        console.error("Error confirm absen:", error);
    }
};

window.cancelAbsen = function(jenis) {
    const statusElement = jenis === 'reguler' ? statusAbsensiReguler : statusAbsensiLembur;
    if (!statusElement) return;
    statusElement.innerHTML = '<p class="text-muted small">Absen dibatalkan.</p>';
    if (auth.currentUser) {
        checkAbsensiStatus(auth.currentUser, jenis);
    }
};

// =========================================================
// 8. LOGIKA ABSEN KELUAR
// =========================================================
if (btnAbsenKeluar) {
    btnAbsenKeluar.addEventListener('click', () => handleAbsenKeluar('reguler'));
}
if (btnLemburKeluar) {
    btnLemburKeluar.addEventListener('click', () => handleAbsenKeluar('lembur'));
}

async function handleAbsenKeluar(jenis) {
    const user = auth.currentUser;
    if (!user) {
        alert("Anda belum login!");
        return;
    }

    const collectionName = `absensi_${jenis}`;
    const statusElement = jenis === 'reguler' ? statusAbsensiReguler : statusAbsensiLembur;
    if (!statusElement) return;

    const tanggal_key = getTodayDateString();

    statusElement.innerHTML = `<p class="text-info">Memproses Absen Keluar ${jenis}...</p>`;

    try {
        const snapshot = await db.collection(collectionName)
            .where('user_id', '==', user.uid)
            .where('tanggal_key', '==', tanggal_key)
            .where('status', '==', 'MASUK')
            .limit(1)
            .get();
            
        if (snapshot.empty) {
            statusElement.innerHTML = `<p class="text-danger">Data Absen Masuk hari ini tidak ditemukan atau sudah Selesai.</p>`;
            return;
        }

        const docToUpdate = snapshot.docs[0];
        const dataMasuk = docToUpdate.data();
        const timestampMasuk = dataMasuk.timestamp_masuk.toDate();

        const position = await getGeolocation();
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        statusElement.innerHTML += '<p class="text-info small">📸 Menunggu foto selfie keluar...</p>';
        const photoFile = await getSelfie();
        if (!photoFile) {
            statusElement.innerHTML = `<p class="text-danger">Absen dibatalkan (Foto tidak diambil).</p>`;
            return;
        }

        const compressedBlob = await compressImage(photoFile, 800, 0.75);

        const now = new Date();
        const jam_keluar = now.toLocaleTimeString('id-ID');

        const selisihMs = now.getTime() - timestampMasuk.getTime();
        const totalJamKerja = (selisihMs / (1000 * 60 * 60)).toFixed(2);

        statusElement.innerHTML += '<p class="text-warning small">⬆️ Mengunggah foto keluar...</p>';
        const photoRef = storage.ref(`${collectionName}/${user.uid}/${tanggal_key}_${jenis}_keluar.jpg`);
        
        await photoRef.put(compressedBlob);
        const fotoUrlKeluar = await photoRef.getDownloadURL();

        await docToUpdate.ref.update({
            waktu_keluar: jam_keluar,
            latitude_keluar: latitude,
            longitude_keluar: longitude,
            url_foto_keluar: fotoUrlKeluar,
            timestamp_keluar: firebase.firestore.FieldValue.serverTimestamp(),
            total_jam_kerja: totalJamKerja,
            status: 'SELESAI'
        });

        statusElement.innerHTML = `
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                        color: white; padding: 25px; border-radius: 15px; text-align: center;">
                <h5 style="margin: 0 0 15px 0;">✅ Absen Keluar Berhasil!</h5>
                <p style="margin: 5px 0;">⏰ Jam Keluar: <strong>${jam_keluar}</strong></p>
                <p style="margin: 5px 0;">⏱ Total Jam Kerja: <strong>${totalJamKerja} jam</strong></p>
                <h4 style="margin: 15px 0 0 0;">🏠 Hati-hati di jalan!</h4>
            </div>
        `;
        
        setTimeout(() => {
            checkAbsensiStatus(user, jenis);
        }, 3000);

    } catch (error) {
        statusElement.innerHTML = `<p class="text-danger">Gagal Absen Keluar.</p>`;
        console.error("Error Absen Keluar:", error);
    }
}

// =========================================================
// 9. FUNGSI CEK STATUS TOMBOL (AMAN UNTUK HALAMAN TANPA LEMBUR)
// =========================================================
async function checkAbsensiStatus(user, jenis) {
    if (!user) return;

    const tanggal_key = getTodayDateString();
    const collectionName = `absensi_${jenis}`;
    const btnMasuk = jenis === 'reguler' ? btnAbsenMasuk : btnLemburMasuk;
    const btnKeluar = jenis === 'reguler' ? btnAbsenKeluar : btnLemburKeluar;
    const statusElement = jenis === 'reguler' ? statusAbsensiReguler : statusAbsensiLembur;
    
    if (!btnMasuk || !btnKeluar || !statusElement) {
        console.warn(`Elemen tombol/status untuk ${jenis} tidak lengkap di halaman ini, skip checkAbsensiStatus.`);
        return;
    }

    btnMasuk.disabled = false;
    btnKeluar.disabled = true;

    try {
        const snapshot = await db.collection(collectionName)
            .where('user_id', '==', user.uid)
            .where('tanggal_key', '==', tanggal_key)
            .get();

        if (snapshot.empty) {
            if (jenis === 'reguler') statusElement.innerHTML = '<p class="text-muted small">Anda belum Absen Masuk hari ini.</p>';
            if (jenis === 'lembur') statusElement.innerHTML = '<p class="text-muted small">Belum ada Absensi Lembur hari ini.</p>';
            return;
        }

        let latestAbsen = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'MASUK' && data.timestamp_masuk) {
                if (!latestAbsen || data.timestamp_masuk.toDate() > latestAbsen.data().timestamp_masuk.toDate()) {
                    latestAbsen = doc;
                }
            }
        });
        
        if (latestAbsen) {
            const data = latestAbsen.data();
            btnMasuk.disabled = true;
            btnKeluar.disabled = true; // default: true, nanti bisa diubah kalau mau
            btnKeluar.disabled = false;
            statusElement.innerHTML = `
                <p class="text-success small mb-0">Sudah Masuk <strong>${jenis.toUpperCase()}</strong> Jam: ${data.waktu_masuk}.</p>
                <p class="text-warning small mb-0">Jangan lupa Absen Keluar!</p>
            `;
        } else {
            btnMasuk.disabled = true;
            btnKeluar.disabled = true;
            
            const latestSelesai = snapshot.docs.find(doc => doc.data().status === 'SELESAI');
            const totalJam = latestSelesai ? latestSelesai.data().total_jam_kerja : 'N/A';
            
            statusElement.innerHTML = `
                <p class="text-info small mb-0">Absen ${jenis.toUpperCase()} hari ini telah Selesai!</p>
                <p class="text-info small mb-0">Total Jam Kerja: <strong>${totalJam} jam</strong>.</p>
            `;
        }
        
    } catch (error) {
        console.error(`Error checking status ${jenis}:`, error);
        statusElement.innerHTML = `<p class="text-danger small">Gagal memuat status absen.</p>`;
    }
}

// =========================================================
// 10. HISTORY MANAGEMENT (Back Button HP) & ANIMASI
// =========================================================
window.addEventListener('popstate', function(event) {
    if (auth.currentUser) {
        const user = auth.currentUser;
        checkAbsensiStatus(user, 'reguler');
        checkAbsensiStatus(user, 'lembur');
    }
});

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);