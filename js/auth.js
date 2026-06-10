/* Rotagram Authentication & User Profiles */

let authTab = 'login'; // 'login' | 'register'

function switchAuthTab(tab) {
  authTab = tab;
  renderFriendsView();
}

function getUsers() {
  return JSON.parse(localStorage.getItem('rotagram_users') || '[]');
}

function saveUserToDB(user) {
  const users = getUsers();
  users.push(user);
  localStorage.setItem('rotagram_users', JSON.stringify(users));
}

async function handleLocalRegister(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('regUsername');
  const emailInput = document.getElementById('regEmail');
  const passwordInput = document.getElementById('regPassword');

  if (!usernameInput || !emailInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  if (!username || !email || !password) {
    showToast('⚠️ Lütfen tüm alanları doldurun!');
    return;
  }

  if (password.length < 4) {
    showToast('⚠️ Şifre en az 4 karakter olmalıdır!');
    return;
  }

  if (typeof isFirebaseEnabled !== 'undefined' && isFirebaseEnabled) {
    try {
      showToast('⏳ Kayıt yapılıyor...');
      const user = await firebaseRegister(username, email, password);
      showToast(`🎉 Kayıt başarılı! Hoş geldiniz, ${user.username}!`);
      
      if (typeof loadTrips === 'function') {
        loadTrips();
      }
      renderFriendsView();
      if (typeof renderTripList === 'function') renderTripList();
      if (typeof updateRecommendations === 'function') updateRecommendations();
    } catch (err) {
      console.error(err);
      let errorMsg = err.message || 'Kayıt sırasında bir hata oluştu!';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = '⚠️ Bu e-posta adresiyle zaten kayıtlı bir kullanıcı var!';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = '⚠️ Geçersiz e-posta adresi!';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = '⚠️ Şifre çok zayıf!';
      }
      showToast(errorMsg);
    }
    return;
  }

  // Local Storage Fallback
  const users = getUsers();
  if (users.some(u => u.email === email)) {
    showToast('⚠️ Bu e-posta adresiyle zaten kayıtlı bir kullanıcı var!');
    return;
  }

  const newUser = { username, email, password };
  saveUserToDB(newUser);

  // Auto-login after registration
  localStorage.setItem('rotagram_user', JSON.stringify({ username, email }));
  showToast(`🎉 Kayıt başarılı! Hoş geldiniz, ${username}!`);

  // Reload trips for this user
  if (typeof loadTrips === 'function') {
    loadTrips();
  }

  renderFriendsView();
  if (typeof renderTripList === 'function') renderTripList();
  if (typeof updateRecommendations === 'function') updateRecommendations();
}

async function handleLocalLogin(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showToast('⚠️ Lütfen e-posta ve şifrenizi girin!');
    return;
  }

  if (typeof isFirebaseEnabled !== 'undefined' && isFirebaseEnabled) {
    try {
      showToast('⏳ Giriş yapılıyor...');
      const user = await firebaseLogin(email, password);
      showToast(`🔑 Giriş başarılı! Tekrar hoş geldiniz, ${user.username}.`);
      
      if (typeof loadTrips === 'function') {
        loadTrips();
      }
      renderFriendsView();
      if (typeof renderTripList === 'function') renderTripList();
      if (typeof updateRecommendations === 'function') updateRecommendations();
    } catch (err) {
      console.error(err);
      let errorMsg = err.message || 'Giriş sırasında bir hata oluştu!';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMsg = '❌ E-posta veya şifre hatalı!';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = '⚠️ Geçersiz e-posta adresi!';
      }
      showToast(errorMsg);
    }
    return;
  }

  // Local Storage Fallback
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    showToast('❌ E-posta veya şifre hatalı!');
    return;
  }

  localStorage.setItem('rotagram_user', JSON.stringify({ username: user.username, email: user.email }));
  showToast(`🔑 Giriş başarılı! Tekrar hoş geldiniz, ${user.username}.`);

  // Reload trips for this user
  if (typeof loadTrips === 'function') {
    loadTrips();
  }

  renderFriendsView();
  if (typeof renderTripList === 'function') renderTripList();
  if (typeof updateRecommendations === 'function') updateRecommendations();
}

async function handleLocalLogout() {
  localStorage.removeItem('rotagram_user');
  localStorage.removeItem('rotagram_active_trip_id');
  currentUser = null;

  showToast('🚪 Başarıyla çıkış yapıldı.');

  if (typeof isFirebaseEnabled !== 'undefined' && isFirebaseEnabled) {
    try {
      await firebaseLogout();
    } catch (err) {
      console.error("Firebase logout error:", err);
    }
  }

  // Reload trips (will fall back to guest trips)
  if (typeof loadTrips === 'function') {
    loadTrips();
  }

  renderFriendsView();
  if (typeof renderTripList === 'function') renderTripList();
  if (typeof updateRecommendations === 'function') updateRecommendations();
}

function clearUserTrips() {
  trips = [];
  if (typeof saveTrips === 'function') saveTrips();
  
  activeTrip = null;
  LOCATIONS = [];
  orderedLocs = [];
  selectedId = null;
  if (routeLine && map) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  osrmData = null;
  rotaActive = false;
  const routeSummary = document.getElementById('routeSummary');
  if (routeSummary) routeSummary.classList.remove('show');

  showToast('🗑️ Tüm seyahat verileriniz temizlendi.');
  renderFriendsView();
  if (typeof renderTripList === 'function') renderTripList();
  if (typeof updateRoute === 'function') updateRoute();
}

function renderFriendsView() {
  const container = document.getElementById('viewFriends');
  if (!container) return;

  currentUser = JSON.parse(localStorage.getItem('rotagram_user') || 'null');

  if (!currentUser) {
    // Show login/register screen
    const isLogin = authTab === 'login';
    
    container.innerHTML = `
      <div class="home-header">
        <h2>${isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
        <p>${isLogin ? 'Kayıtlı hesabınızla giriş yaparak seyahat planlarınızı yönetin.' : 'Hemen ücretsiz hesap oluşturun, gezi planlarınızı cihazınızda saklayın.'}</p>
      </div>
      
      <div class="home-scroll-area" style="flex:1; overflow-y:auto; padding:0 20px 20px; display:flex; flex-direction:column; gap:16px;">
        <!-- Auth Tabs -->
        <div style="display:flex; background:var(--bg-alt); border:1px solid var(--border); border-radius:var(--radius-md); padding:4px;">
          <button class="action-btn" onclick="switchAuthTab('login')" style="flex:1; border:none; background:${isLogin ? '#fff' : 'transparent'}; box-shadow:${isLogin ? 'var(--shadow-sm)' : 'none'}; color:${isLogin ? 'var(--primary)' : 'var(--ink2)'}; font-weight:${isLogin ? '700' : '600'}; padding:8px 0; font-size:12.5px;">Giriş Yap</button>
          <button class="action-btn" onclick="switchAuthTab('register')" style="flex:1; border:none; background:${!isLogin ? '#fff' : 'transparent'}; box-shadow:${!isLogin ? 'var(--shadow-sm)' : 'none'}; color:${!isLogin ? 'var(--primary)' : 'var(--ink2)'}; font-weight:${!isLogin ? '700' : '600'}; padding:8px 0; font-size:12.5px;">Kayıt Ol</button>
        </div>

        ${isLogin ? `
          <!-- Login Form -->
          <form onsubmit="handleLocalLogin(event)" style="display:flex; flex-direction:column; gap:14px;">
            <div class="form-group" style="margin-bottom:0;">
              <label for="loginEmail">E-posta Adresi</label>
              <input type="email" id="loginEmail" placeholder="ornek@rotagram.app" required style="width:100%; box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label for="loginPassword">Şifre</label>
              <input type="password" id="loginPassword" placeholder="••••••••" required style="width:100%; box-sizing:border-box;">
            </div>
            <button type="submit" class="action-btn primary" style="width:100%; padding:12px; font-weight:700; margin-top:6px;">
              <i class="ti ti-login"></i> Giriş Yap
            </button>
          </form>
          <div style="font-size:12px; color:var(--ink2); text-align:center; margin-top:8px;">
            Hesabınız yok mu? <a href="#" onclick="switchAuthTab('register'); return false;" style="color:var(--primary); font-weight:700; text-decoration:none;">Hemen Kayıt Olun</a>
          </div>
        ` : `
          <!-- Register Form -->
          <form onsubmit="handleLocalRegister(event)" style="display:flex; flex-direction:column; gap:14px;">
            <div class="form-group" style="margin-bottom:0;">
              <label for="regUsername">Kullanıcı Adı</label>
              <input type="text" id="regUsername" placeholder="Gezgin..." required style="width:100%; box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label for="regEmail">E-posta Adresi</label>
              <input type="email" id="regEmail" placeholder="ornek@rotagram.app" required style="width:100%; box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label for="regPassword">Şifre (En az 4 karakter)</label>
              <input type="password" id="regPassword" placeholder="••••••••" required style="width:100%; box-sizing:border-box;">
            </div>
            <button type="submit" class="action-btn primary" style="width:100%; padding:12px; font-weight:700; margin-top:6px;">
              <i class="ti ti-user-plus"></i> Hesap Oluştur
            </button>
          </form>
          <div style="font-size:12px; color:var(--ink2); text-align:center; margin-top:8px;">
            Zaten hesabınız var mı? <a href="#" onclick="switchAuthTab('login'); return false;" style="color:var(--primary); font-weight:700; text-decoration:none;">Giriş Yapın</a>
          </div>
        `}
      </div>
    `;
  } else {
    // Show logged-in profile & settings panel
    const totalTrips = trips.length;
    
    container.innerHTML = `
      <div class="home-header">
        <h2>Profil & Ayarlar</h2>
        <p>Hesap bilgilerinizi ve uygulama ayarlarını bu panelden yönetebilirsiniz.</p>
      </div>
      
      <div class="home-scroll-area" style="flex:1; overflow-y:auto; padding:0 20px 20px; display:flex; flex-direction:column; gap:18px;">
        <!-- User Profile Card -->
        <div style="background:#fff; border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; display:flex; align-items:center; gap:14px; box-shadow:var(--shadow-sm);">
          <div style="width:48px; height:48px; border-radius:50%; background:var(--primary-bg); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; border:2px solid var(--primary-light); flex-shrink:0;">
            ${currentUser.username.substring(0, 2).toUpperCase()}
          </div>
          <div style="min-width:0; flex:1;">
            <h3 style="font-size:14.5px; font-weight:700; color:var(--ink); margin:0; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:flex; align-items:center; gap:6px;">
              ${currentUser.username}
              ${typeof isFirebaseEnabled !== 'undefined' && isFirebaseEnabled ? `<span style="font-size:10px; padding:2px 6px; background:#e0f2fe; color:#0369a1; border-radius:10px; font-weight:600; display:inline-flex; align-items:center; gap:3px;"><i class="ti ti-cloud-computing" style="font-size:11px;"></i> Bulut</span>` : ''}
            </h3>
            <span style="font-size:11.5px; color:var(--ink2); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:block;">${currentUser.email}</span>
          </div>
          <button class="action-btn secondary" onclick="handleLocalLogout()" style="padding:6px 10px; font-size:11px; color:#e74c3c; border-color:rgba(231,76,60,0.15);" title="Çıkış Yap">
            <i class="ti ti-logout"></i>
          </button>
        </div>

        <!-- Application Settings Box -->
        <div style="background:#fff; border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:14px;">
          <h4 style="font-size:12px; font-weight:700; color:var(--ink); text-transform:uppercase; letter-spacing:0.04em; margin:0; display:flex; align-items:center; gap:6px;">
            <i class="ti ti-settings" style="color:var(--primary); font-size:16px;"></i> Harita & Arayüz Ayarları
          </h4>
          
          <!-- Map Layer Setting -->
          <div style="display:flex; flex-direction:column; gap:6px; border-top:1px dashed var(--border); padding-top:12px;">
            <span style="font-size:11.5px; font-weight:600; color:var(--ink2);">Varsayılan Harita Stili</span>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:2px;">
              <button class="action-btn secondary style-btn-voyager" onclick="changeMapStyle('voyager')" style="padding:8px; font-size:11px; font-weight:600;">Voyager</button>
              <button class="action-btn secondary style-btn-dark" onclick="changeMapStyle('dark')" style="padding:8px; font-size:11px; font-weight:600;">Karanlık</button>
              <button class="action-btn secondary style-btn-terrain" onclick="changeMapStyle('terrain')" style="padding:8px; font-size:11px; font-weight:600;">Sokak</button>
              <button class="action-btn secondary style-btn-satellite" onclick="changeMapStyle('satellite')" style="padding:8px; font-size:11px; font-weight:600;">Uydu</button>
            </div>
          </div>
        </div>

        <!-- Data Management Box -->
        <div style="background:#fff; border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:12px;">
          <h4 style="font-size:12px; font-weight:700; color:var(--ink); text-transform:uppercase; letter-spacing:0.04em; margin:0; display:flex; align-items:center; gap:6px;">
            <i class="ti ti-database" style="color:var(--accent); font-size:16px;"></i> Veri Yönetimi
          </h4>
          
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; border-top:1px dashed var(--border); padding-top:10px;">
            <span style="color:var(--ink2);">Aktif Seyahat Planı Sayısı</span>
            <span style="font-weight:700; color:var(--ink);">${totalTrips} Plan</span>
          </div>

          <div style="display:flex; gap:8px; margin-top:6px;">
            <button class="action-btn secondary" onclick="exportRoute('json')" style="flex:1; padding:10px; font-size:11.5px;"><i class="ti ti-download"></i> Aktif Planı İndir</button>
            <input type="file" id="importAllTripsInput" accept=".json" style="display:none;" onchange="importAllTripsFromJson(event)">
            <button class="action-btn secondary" onclick="document.getElementById('importAllTripsInput').click()" style="flex:1; padding:10px; font-size:11.5px; color:var(--primary); border-color:rgba(85,239,196,0.2);"><i class="ti ti-upload"></i> İçe Aktar</button>
          </div>
        </div>
      </div>
    `;

    // Highlight current map style button in Settings
    setTimeout(() => {
      const activeStyleBtn = document.querySelector(`.layer-btn.active`);
      if (activeStyleBtn) {
        const styleName = activeStyleBtn.dataset.layer;
        const targetBtn = document.querySelector(`.style-btn-${styleName}`);
        if (targetBtn) {
          targetBtn.style.background = 'var(--primary-bg)';
          targetBtn.style.borderColor = 'var(--primary)';
          targetBtn.style.color = 'var(--primary)';
        }
      }
    }, 50);
  }
}

// Firebase Auth State Listener setup on file load
if (typeof setupFirebaseListener === 'function' && typeof isFirebaseEnabled !== 'undefined' && isFirebaseEnabled) {
  setupFirebaseListener(
    // On Login Callback
    async (userData) => {
      // 1. Fetch trips from Firestore database
      const cloudTrips = await firebaseLoadTrips(userData.uid);
      
      // 2. Load locally cached storage trips for this user (if any)
      const storageKey = `rotagram_trips_${userData.email}`;
      const localCachedTrips = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // 3. Merging logic: if cloud is empty but local has trips, save local trips to cloud database
      let mergedTrips = cloudTrips;
      if (cloudTrips.length === 0 && localCachedTrips.length > 0) {
        mergedTrips = localCachedTrips;
        console.log("☁️ Yerel seyahat planları Firestore bulut veri tabanına yükleniyor...");
        await firebaseSaveTrips(userData.uid, mergedTrips);
      }
      
      // Cache the merged list in localStorage
      localStorage.setItem(storageKey, JSON.stringify(mergedTrips));
      
      // Update app state and refresh UI
      if (typeof loadTrips === 'function') {
        loadTrips();
      }
      renderFriendsView();
      if (typeof renderTripList === 'function') renderTripList();
      if (typeof updateRecommendations === 'function') updateRecommendations();
    },
    // On Logout Callback
    () => {
      if (typeof loadTrips === 'function') {
        loadTrips();
      }
      renderFriendsView();
      if (typeof renderTripList === 'function') renderTripList();
      if (typeof updateRecommendations === 'function') updateRecommendations();
    }
  );
}