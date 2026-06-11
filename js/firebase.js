/* Rotagram Firebase Integration Module */

// Firebase Yapılandırmasını Yerel Depolamadan (LocalStorage) yüklemeyi dene
let firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE",
  measurementId: "YOUR_MEASUREMENT_ID_HERE"
};

try {
  const savedConfig = localStorage.getItem('rotagram_firebase_config');
  if (savedConfig) {
    const parsed = JSON.parse(savedConfig);
    if (parsed && parsed.apiKey) {
      firebaseConfig = parsed;
    }
  }
} catch (e) {
  console.error("Firebase config parsing error:", e);
}

let isFirebaseEnabled = false;
let db = null;
let auth = null;

// Firebase'in doğru yapılandırılıp yapılandırılmadığını kontrol et
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== "YOUR_PROJECT_ID_HERE";

if (isConfigured) {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseEnabled = true;
    console.log("🔥 Firebase başarıyla başlatıldı ve aktif.");
  } catch (error) {
    console.error("❌ Firebase başlatma hatası, LocalStorage moduna dönülüyor:", error);
    isFirebaseEnabled = false;
  }
} else {
  console.log("ℹ️ Firebase yapılandırılmamış. Yerel (LocalStorage) modda çalışılıyor.");
}

/**
 * Firebase Auth Durum Değişikliği Dinleyicisi
 */
function setupFirebaseListener(onLogin, onLogout) {
  if (!isFirebaseEnabled) return;

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log("🔥 Kullanıcı oturum açtı (Firebase):", user.email);
      const userData = {
        username: user.displayName || user.email.split('@')[0],
        email: user.email,
        uid: user.uid
      };
      localStorage.setItem('rotagram_user', JSON.stringify(userData));
      
      // Kullanıcı verilerini Firestore'dan yükle
      if (typeof onLogin === 'function') {
        await onLogin(userData);
      }
    } else {
      console.log("🔥 Kullanıcı oturumu kapattı (Firebase)");
      localStorage.removeItem('rotagram_user');
      if (typeof onLogout === 'function') {
        onLogout();
      }
    }
  });
}

/**
 * Firebase Kayıt Olma İşlemi
 */
async function firebaseRegister(username, email, password) {
  if (!isFirebaseEnabled) throw new Error("Firebase aktif değil.");
  
  const userCredential = await auth.createUserWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  // Profil ismini güncelle
  await user.updateProfile({
    displayName: username
  });
  
  // Kullanıcı kaydı oluşturulduğunda ilk boş trips verisini Firestore'da oluştur
  await db.collection("users").doc(user.uid).set({
    username: username,
    email: email,
    trips: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  return { username, email, uid: user.uid };
}

/**
 * Firebase Giriş Yapma İşlemi
 */
async function firebaseLogin(email, password) {
  if (!isFirebaseEnabled) throw new Error("Firebase aktif değil.");
  
  const userCredential = await auth.signInWithEmailAndPassword(email, password);
  const user = userCredential.user;
  
  return {
    username: user.displayName || email.split('@')[0],
    email: user.email,
    uid: user.uid
  };
}

/**
 * Firebase Çıkış Yapma İşlemi
 */
async function firebaseLogout() {
  if (!isFirebaseEnabled) return;
  await auth.signOut();
}

/**
 * Firestore'a seyahat verilerini kaydet
 */
async function firebaseSaveTrips(uid, tripsList) {
  if (!isFirebaseEnabled || !uid) return;
  try {
    // Limits limits... limit to max 10 trips to optimize database storage in free plan
    const slicedTrips = tripsList.slice(0, 10);
    await db.collection("users").doc(uid).set({
      trips: slicedTrips,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log("🔥 Seyahat planları Firestore bulutuna yedeklendi.");
  } catch (error) {
    console.error("❌ Seyahat planları buluta yedeklenirken hata oluştu:", error);
  }
}

/**
 * Firestore'dan seyahat verilerini getir
 */
async function firebaseLoadTrips(uid) {
  if (!isFirebaseEnabled || !uid) return [];
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      console.log("🔥 Seyahat planları Firestore bulutundan yüklendi.");
      return data.trips || [];
    }
    return [];
  } catch (error) {
    console.error("❌ Seyahat planları buluttan yüklenirken hata oluştu:", error);
    return [];
  }
}

/**
 * Firebase Google Sign-In
 */
async function firebaseGoogleLogin() {
  if (!isFirebaseEnabled) throw new Error("Firebase aktif değil.");
  const provider = new firebase.auth.GoogleAuthProvider();
  const userCredential = await auth.signInWithPopup(provider);
  const user = userCredential.user;
  
  // Save user document in Firestore on login/register
  await db.collection("users").doc(user.uid).set({
    username: user.displayName || user.email.split('@')[0],
    email: user.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  return {
    username: user.displayName || user.email.split('@')[0],
    email: user.email,
    uid: user.uid
  };
}

/**
 * Firebase Phone Authentication: SMS Kodu Gönder
 */
let recaptchaVerifier = null;
let confirmationResult = null;

async function firebasePhoneSendCode(phoneNumber) {
  if (!isFirebaseEnabled) throw new Error("Firebase aktif değil.");
  
  // Dinamik Recaptcha Container
  if (!document.getElementById('recaptcha-container')) {
    const recaptchaDiv = document.createElement('div');
    recaptchaDiv.id = 'recaptcha-container';
    document.body.appendChild(recaptchaDiv);
  }
  
  if (!recaptchaVerifier) {
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible'
    });
  }
  
  confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, recaptchaVerifier);
  return confirmationResult;
}

/**
 * Firebase Phone Authentication: SMS Kodu Onayla
 */
async function firebasePhoneVerifyCode(code) {
  if (!confirmationResult) throw new Error("Aktif bir SMS kodu doğrulama isteği bulunamadı.");
  const result = await confirmationResult.confirm(code);
  const user = result.user;
  
  if (!user.displayName) {
    const defaultName = "Gezgin " + user.phoneNumber.slice(-4);
    await user.updateProfile({
      displayName: defaultName
    });
  }
  
  await db.collection("users").doc(user.uid).set({
    username: user.displayName || "Gezgin",
    email: user.email || user.phoneNumber,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  return {
    username: user.displayName || "Gezgin",
    email: user.email || user.phoneNumber,
    uid: user.uid
  };
}
