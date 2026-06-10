# 🗺️ Rotagram — Akıllı Seyahat Planlayıcı & Dinamik Rota Optimizasyonu

[![GitHub version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/nalende/rotagram)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Web](https://img.shields.io/badge/Platform-Web-orange.svg)](https://nalende.github.io/rotagram/)
[![Database: Firebase & LocalStorage](https://img.shields.io/badge/Database-Firebase%20%26%20LocalStorage-green.svg)](https://firebase.google.com/)

**Rotagram**, seyahat severlerin rotalarını akıllı algoritmalarla optimize etmesini, keşfedilen yeni yerleri planlarına eklemesini ve güzergâhlarını dinamik olarak yönetmesini sağlayan modern, duyarlı ve arayüz odaklı bir **Web Seyahat Planlayıcısıdır**.

HTML5, CSS3 ve modern ES6+ Javascript mimarisiyle sıfırdan geliştirilen Rotagram; **Leaflet.js**, **OSRM API** ve **Overpass API** entegrasyonlarıyla tamamen ücretsiz, sunucusuz (Serverless) ve yüksek hızlı bir harita deneyimi sunar.

🚀 **Canlı Demo Deneyin:** [nalende.github.io/rotagram](https://nalende.github.io/rotagram/)

---

## 💎 Temel Özellikler (Core Features)

### 🔐 1. Hibrit Oturum ve Veri Depolama (Firebase & LocalStorage)
*   **Google Firebase Entegrasyonu:** Kullanıcılar e-posta/şifre yöntemiyle güvenle kayıt olabilir, oturum açabilir ve planlarını bulutta yedekleyebilir.
*   **Çevrimdışı Mod (Fallback):** Firebase anahtarları tanımlanmadığında veya bağlantı kesildiğinde, uygulama kesintisiz olarak **LocalStorage** üzerinde çalışmaya devam eder.
*   **Akıllı Senkronizasyon (Smart Merge):** Çevrimdışı modda oluşturulan seyahat planları, kullanıcı ilk kez giriş yaptığında otomatik olarak bulut veri tabanına aktarılır.
*   **Veri İzolasyonu:** Her kullanıcının seyahat verileri tamamen kendine özel depolanır.

### 🚗 2. Akıllı Yönlendirme Algoritması (Smart Routing)
*   Duraklar arası mesafe **2 km ve altındaysa** yürüyüş profili (`OSM /foot/`), **2 km'den fazla ise** sürüş profili (`OSM /driving/`) dinamik olarak seçilir.
*   Farklı profillerden alınan rota geometrileri, haritada tek bir akıcı çizgi halinde birleştirilir ve adım adım yön tarifleri üretilir.
*   OSRM cache engelleme mekanizması sayesinde rota değişiklikleri haritada anında güncellenir.

### 📍 3. Coğrafi Veri Önerileri (Overpass API POI)
*   Mevcut konumunuza veya aktif seyahat noktalarınıza yakın tarihi yerler, manzara noktaları, deniz kıyıları, gastronomik duraklar ve kültürel alanlar Overpass API ile aranır.
*   **Kategori Kısıtlaması (Max 3):** Öneriler listelenirken her kategoriden en fazla 3 popüler nokta seçilir. Böylece listenin dengeli olması ve seyahatin çeşitlendirilmesi sağlanır.

### ⚡ 4. Engelsiz ve Akıcı Kullanıcı Deneyimi (Confirm-less & Undo)
*   Kullanıcıyı yoran ve tarayıcı akışını kesen `confirm()` pencereleri tamamen kaldırılmıştır.
*   Plan veya konum silme işlemleri anlık olarak gerçekleşir. Yanlışlıkla silinen planlar, ekranın altında beliren modern Toast bildirimindeki **"Geri Al"** butonuyla tek tıkla geri getirilebilir.
*   Mobil ekranlarda (örn. iPhone 13) alt navigasyon barı genişliğe tam oturacak şekilde duyarlı (`responsive`) tasarlanmıştır.

### 💾 5. Esnek Veri Paylaşımı ve İçe Aktarma
*   Aktif planlarınızı tek tıkla **`.json`** dosyası olarak indirebilirsiniz.
*   Daha önce indirilen seyahat planı dosyalarını uygulamaya sürükleyip bırakarak veya dosya seçerek anında harita üzerine yükleyebilirsiniz.

---

## 🛠️ Teknolojik Altyapı (Tech Stack)

*   **Arayüz Tasarımı:** Semantik HTML5, CSS3 Custom Properties (CSS Değişkenleri), Flexbox ve Grid sistemleri, pürüzsüz animasyonlar.
*   **Programlama Dili:** Vanilla JavaScript (ES6+ Modüler Yapı).
*   **Harita Motoru:** [Leaflet.js](https://leafletjs.com/) (Dinamik Katman Değişimi: Voyager, Uydu, Sokak, Karanlık Mod).
*   **Rotalama Servisi:** OpenStreetMap (OSM) & [OSRM API](http://project-osrm.org/).
*   **Veri Tabanı & Auth:** Google Firebase (Authentication & Cloud Firestore).
*   **Coğrafi Arama:** [Nominatim API](https://nominatim.org/) ve [Overpass API](https://overpass-api.de/).

---

## 🔥 Firebase Bulut Kurulumu (Firebase Configuration)

Rotagram, Firebase bağlantısı olmadığında yerel depolamada çalışmaya devam eder. Bulut senkronizasyonunu aktifleştirmek için şu adımları izleyin:

1.  [Firebase Console](https://console.firebase.google.com/) üzerinde ücretsiz bir proje oluşturun.
2.  **Authentication** sekmesinden **Email/Password** yöntemini etkinleştirin.
3.  **Cloud Firestore** veri tabanını oluşturup, aşağıdaki güvenlik kurallarını (Security Rules) ekleyin:
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
4.  Proje dizinindeki [js/firebase.js](file:///C:/Users/muhammed.emin/Downloads/aaaaa/js/firebase.js) dosyasını açarak `firebaseConfig` nesnesini kendi API anahtarlarınız ile güncelleyin:
    ```javascript
    const firebaseConfig = {
      apiKey: "API_KEY",
      authDomain: "PROJECT_ID.firebaseapp.com",
      projectId: "PROJECT_ID",
      storageBucket: "PROJECT_ID.appspot.com",
      messagingSenderId: "SENDER_ID",
      appId: "APP_ID"
    };
    ```

Yapılandırma tamamlandığı anda uygulamanız otomatik olarak bulut moduna geçecek ve profilinizde `☁️ Bulut` rozeti yanacaktır.

---

## 🚀 SEO ve Performans Optimizasyonları

*   **Semantik HTML5 Yapısı:** Hiyerarşik başlıklar (`h1`, `h2`, `h3`) ve açıklayıcı metin etiketleri sayesinde arama motorları için optimize edilmiştir.
*   **Meta ve Open Graph Etiketleri:** Sosyal medya paylaşımlarında doğru başlık, açıklama ve önizleme görseli göstermek için OG etiketleri hazır durumdadır.
*   **Hızlı Yükleme Süresi:** Harici kütüphaneler (`Leaflet`, `Tabler Icons`, `Google Fonts`) yüksek performanslı CDN ağları üzerinden asenkron ve ertelenmiş (`defer`/`async`) olarak yüklenir.

---

## 📜 Lisans (License)

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır. Kişisel veya ticari projelerinizde dilediğiniz gibi kullanabilir, değiştirebilir ve dağıtabilirsiniz.
