/* Rotagram Google Drive Backup & Synchronization */
    async function loadTripsFromGoogleDrive() {
      if (!googleAccessToken) return;
      try {
        const query = encodeURIComponent("name = 'rotagram_trips.json' and 'appDataFolder' in parents and trashed = false");
        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name)`, {
          headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });
        const listData = await listRes.json();

        if (listData.files && listData.files.length > 0) {
          const fileId = listData.files[0].id;
          localStorage.setItem('rotagram_g_file_id', fileId);

          const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
          });

          const driveTrips = await fileRes.json();
          if (Array.isArray(driveTrips)) {
            trips = driveTrips;
            localStorage.setItem('rotagram_trips', JSON.stringify(trips));
            showToast('\ud83c\udf89 Seyahat planlar\u0131 Google Drive\'dan senkronize edildi.');
          }
        } else {
          showToast('\u2139\ufe0f Google Drive\'da yeni veri dosyas\u0131 olu\u015fturulacak.');
        }
      } catch (err) {
        console.error('Google Drive load error:', err);
        showToast('\u26a0\ufe0f Google Drive\'dan y\u00fckleme ba\u015far\u0131s\u0131z. Yerel veriler kullan\u0131l\u0131yor.');
      }
    }

    async function syncTripsToGoogleDrive() {
      if (!googleAccessToken) return;

      const expiry = parseInt(localStorage.getItem('rotagram_g_token_expiry') || '0');
      if (Date.now() > expiry) {
        console.warn('Access token expired. Re-auth needed.');
        return;
      }

      let fileId = localStorage.getItem('rotagram_g_file_id');
      const fileContent = JSON.stringify(trips);

      try {
        if (!fileId) {
          const query = encodeURIComponent("name = 'rotagram_trips.json' and 'appDataFolder' in parents and trashed = false");
          const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name)`, {
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
          });
          const listData = await listRes.json();
          if (listData.files && listData.files.length > 0) {
            fileId = listData.files[0].id;
            localStorage.setItem('rotagram_g_file_id', fileId);
          }
        }

        if (fileId) {
          const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: fileContent
          });

          if (res.ok) {
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('tr-TR');
            localStorage.setItem('rotagram_last_sync', 'Drive ile E\u015fitlendi: ' + now);
            const label = document.getElementById('syncTimeLabel');
            if (label) label.textContent = 'Drive ile E\u015fitlendi: ' + now;
          }
        } else {
          const metadata = {
            name: 'rotagram_trips.json',
            parents: ['appDataFolder']
          };

          const boundary = 'foo_bar_boundary';
          const multipartBody = 
            `\r\n--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            `${fileContent}\r\n` +
            `--${boundary}--`;

          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
          });

          if (res.ok) {
            const data = await res.json();
            if (data.id) {
              localStorage.setItem('rotagram_g_file_id', data.id);
            }
            const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('tr-TR');
            localStorage.setItem('rotagram_last_sync', 'Drive ile E\u015fitlendi: ' + now);
            const label = document.getElementById('syncTimeLabel');
            if (label) label.textContent = 'Drive ile E\u015fitlendi: ' + now;
          }
        }
      } catch (err) {
        console.error('Google Drive sync error:', err);
      }
    }

    async function syncTripsToCloud() {
      const user = JSON.parse(localStorage.getItem('rotagram_user') || 'null');
      if (!user) return;

      const token = localStorage.getItem('rotagram_g_access_token');
      const expiry = parseInt(localStorage.getItem('rotagram_g_token_expiry') || '0');
      if (!token || Date.now() > expiry) {
        const label = document.getElementById('syncTimeLabel');
        if (label) label.textContent = 'Ba\u011flant\u0131 Kesildi (Yeniden Giri\u015f Yap\u0131n)';
        return;
      }

      googleAccessToken = token;
      await syncTripsToGoogleDrive();
    }

    async function fetchTripsFromCloud(email) {
      const token = localStorage.getItem('rotagram_g_access_token');
      if (token) {
        googleAccessToken = token;
        await loadTripsFromGoogleDrive();
      }
    }

    async function manualSync() {
      showToast('\u23f3 Senkronize ediliyor...');
      const user = JSON.parse(localStorage.getItem('rotagram_user') || 'null');
      if (user) {
        const token = localStorage.getItem('rotagram_g_access_token');
        const expiry = parseInt(localStorage.getItem('rotagram_g_token_expiry') || '0');
        if (!token || Date.now() > expiry) {
          showToast('\ud83d\udd11 Oturum s\u00fcrest dolmu\u015f. Yeniden ba\u011flan\u0131l\u0131yor...');
          submitGoogleLogin();
          return;
        }
        googleAccessToken = token;
        await syncTripsToGoogleDrive();
        showToast('\u2705 Seyahat planlar\u0131n\u0131z ba\u015far\u0131yla e\u015fitlendi.');
      } else {
        showToast('\u26a0\ufe0f L\u00fctfen \u00f6nce oturum a\u00e7\u0131n.');
      }
    }