# 🗺️ Rotagram — Akıllı Seyahat ve Rota Planlayıcı

Rotagram, seyahat planlarınızı kolayca oluşturmanızı, optimize etmenizi ve yönetmenizi sağlayan modern ve dinamik bir web uygulamasıdır. Kullanıcı dostu ve engelsiz arayüzü sayesinde seyahatlerinizi adım adım planlayabilir, harita üzerinde canlı rotalar çizebilirsiniz.

🚀 **Canlı Demo:** [nalende.github.io/rotagram](https://nalende.github.io/rotagram/)

---

## ✨ Özellikler

### 🔐 1. Yerel Giriş & Veri İzolasyonu
* Sahte e-posta girişleri yerine tamamen `localStorage` tabanlı güvenli **Giriş Yap** ve **Kayıt Ol** mekanizması.
* Her kullanıcının seyahat verileri kendi e-posta adresiyle (`rotagram_trips_${email}`) izole edilerek güvenle saklanır.

### 🚗 2. Akıllı Rotalama (Yürüyüş vs Sürüş Seçimi)
* Haritaya eklediğiniz duraklar arası mesafe **2 km ve altındaysa** otomatik olarak yürüyüş rotası (`OSM /foot/` profili) çizilir.
* Mesafe **2 km'den fazla ise** sürüş rotası (`OSM /driving/` profili) hesaplanır.
* Tüm bacaklar birleştirilerek haritada akıcı ve kesintisiz tek bir rota çizgisi ve adım adım yol tarifi sunulur.

### 🌟 3. Dengeli ve Popüler Konum Önerileri
* Overpass API entegrasyonu ile çevrenizdeki tarihi, turistik, gastronomi ve manzara noktaları otomatik listelenir.
* Bir kategorinin listeyi domine etmesini önlemek amacıyla, her kategoriden **en fazla 3 öneri** gösterilir.

### ⚡ 4. Engelsiz ve Hızlı Etkileşimler (Confirm-less UI)
* Tarayıcıyı kilitleyen ve kullanıcıyı yoran eski `confirm()` onay pencereleri tamamen kaldırıldı!
* Plan silme, durak silme ve çıkış yapma işlemleri anında gerçekleşir.
* **Geri Al (Undo):** Silinen bir seyahat planı ekranın altında beliren modern bildirim panelindeki (Toast) "Geri Al" butonu ile tek tıkla kurtarılabilir.
* Kart ekleme, silme ve sayfa geçişleri akıcı CSS animasyonlarıyla desteklenmiştir.

### 💾 5. Gelişmiş Veri Yönetimi
* Seyahat planlarınızı tekil veya toplu olarak **`.json`** formatında dışa aktarabilir (indirilebilir),
* Daha önce indirdiğiniz veya paylaşılan planları tekrar uygulamaya **içe aktararak (yükleyerek)** anında harita üzerinde görüntüleyebilirsiniz.

---

## 🛠️ Kullanılan Teknolojiler

* **Frontend:** HTML5, Vanilla CSS3 (Custom Properties, Flexbox/Grid, Keyframe Animations)
* **Logic:** Vanilla Javascript (ES6+)
* **Harita & Rotalama:** Leaflet.js, OpenStreetMap (OSM) & OSRM API
* **Öneri Arama:** Overpass API
* **Veri Depolama:** Web LocalStorage API & Google Firebase (Authentication & Firestore)

---

## 🔥 Firebase Bulut Senkronizasyonu Kurulumu

Rotagram, Firebase yapılandırılmadığında tamamen çevrimdışı ve tarayıcı tabanlı (**LocalStorage**) modda çalışır. Kullanıcıların verilerini bulutta yedeklemek ve farklı cihazlardan erişmelerini sağlamak için şu adımları takip edebilirsiniz:

1. [Firebase Console](https://console.firebase.google.com/) üzerinden yeni bir proje oluşturun.
2. Projenizde **Authentication** servisini aktif edin ve **Email/Password** ile giriş yöntemini etkinleştirin.
3. Projenizde **Cloud Firestore** veri tabanını aktif edin ve "Start in Test Mode" veya aşağıdaki kurallarla başlatın:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
4. Firebase konsolundan web uygulaması oluşturarak API anahtarlarınızı alın.
5. Proje klasöründeki [js/firebase.js](file:///C:/Users/muhammed.emin/Downloads/aaaaa/js/firebase.js) dosyasını açıp `firebaseConfig` değişkenini kendi API anahtarlarınız ile güncelleyin:
   ```javascript
   const firebaseConfig = {
     apiKey: "API_ANAHTARINIZ",
     authDomain: "PROJE_ID.firebaseapp.com",
     projectId: "PROJE_ID",
     storageBucket: "PROJE_ID.appspot.com",
     messagingSenderId: "SENDER_ID",
     appId: "APP_ID"
   };
   ```
Uygulamanız anahtarları algıladığı anda otomatik olarak **Bulut Moduna** geçecek ve kullanıcı profilinde `☁️ Bulut` rozeti görüntülenecektir!

