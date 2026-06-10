    let lastAddedTripId = null;
    let deletedTripBackup = null;

    function getTripsStorageKey() {
      const userStr = localStorage.getItem('rotagram_user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u && u.email) {
            return `rotagram_trips_${u.email}`;
          }
        } catch (e) {}
      }
      return 'rotagram_trips';
    }

    function saveTrips() {
      const key = getTripsStorageKey();
      const user = localStorage.getItem('rotagram_user');
      if (user && trips.length > 10) {
        trips = trips.slice(0, 10);
      }

      localStorage.setItem(key, JSON.stringify(trips));
      if (activeTrip) {
        localStorage.setItem('rotagram_active_trip_id', activeTrip.id);
      } else {
        localStorage.removeItem('rotagram_active_trip_id');
      }

      if (user && typeof syncTripsToCloud === 'function') {
        syncTripsToCloud();
      }
    }

    function loadTrips() {
      const key = getTripsStorageKey();
      trips = JSON.parse(localStorage.getItem(key) || '[]');
      currentUser = JSON.parse(localStorage.getItem('rotagram_user') || 'null');

      // Restore Google Access Token if valid
      const token = localStorage.getItem('rotagram_g_access_token');
      const expiry = parseInt(localStorage.getItem('rotagram_g_token_expiry') || '0');
      if (token && Date.now() < expiry) {
        googleAccessToken = token;
      }

      const savedActiveId = localStorage.getItem('rotagram_active_trip_id');

      if (savedActiveId && trips.length > 0) {
        const found = trips.find(t => t.id == savedActiveId);
        if (found) {
          selectTrip(found.id);
          return;
        }
      }

      // Reset active trip selections if transitioning to empty state or unknown active trip ID
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
      const routeBtn = document.getElementById('btnRouteToggle');
      if (routeBtn) {
        routeBtn.classList.remove('active');
        routeBtn.innerHTML = '<i class="ti ti-route"></i> Güzergâh Çiz ve Hesapla';
      }
      const routeSummary = document.getElementById('routeSummary');
      if (routeSummary) routeSummary.classList.remove('show');

      goHome();
      updateHeaderControls();
    }

    function switchAppView(tabName) {
      activeAppTab = tabName;
      const isMobile = window.innerWidth <= 768;

      // Hide all sidebar views
      document.getElementById('viewHome').style.display = 'none';
      document.getElementById('viewSearch').style.display = 'none';
      document.getElementById('viewTrips').style.display = 'none';
      document.getElementById('viewFriends').style.display = 'none';

      // Deactivate all bottom nav buttons
      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
      });

      // Mobile: show/hide map container
      const mapContainer = document.getElementById('mapContainer');
      const mapTopBar = document.getElementById('mapTopBar');
      if (isMobile) {
        if (tabName === 'map') {
          mapContainer.classList.add('mobile-map-visible');
          if (mapTopBar) mapTopBar.classList.add('mobile-visible');
        } else {
          mapContainer.classList.remove('mobile-map-visible');
          if (mapTopBar) mapTopBar.classList.remove('mobile-visible');
        }
      }

      if (tabName === 'home') {
        document.getElementById('viewHome').style.display = 'flex';
        // Reset view to user GPS or Turkey
        if (userLocation) {
          map.flyTo([userLocation.lat, userLocation.lng], 10);
        } else {
          map.flyTo([39.0, 35.0], 6);
        }
      } else if (tabName === 'search') {
        document.getElementById('viewSearch').style.display = 'flex';
        setTimeout(() => document.getElementById('searchTabInput').focus(), 100);
      } else if (tabName === 'trips') {
        document.getElementById('viewTrips').style.display = 'flex';
        if (activeTrip) {
          document.getElementById('tripsListSubView').style.display = 'none';
          document.getElementById('viewTripDetail').style.display = 'flex';
        } else {
          document.getElementById('tripsListSubView').style.display = 'flex';
          document.getElementById('viewTripDetail').style.display = 'none';
        }
      } else if (tabName === 'friends') {
        document.getElementById('viewFriends').style.display = 'flex';
        renderFriendsView();
      } else if (tabName === 'map') {
        updateMapTopBar();
        if (!isMobile) fitMapToVisible();
      }
      setTimeout(() => map.invalidateSize(), 300);
    }

    function goHome() {
      switchAppView('home');
    }

    function goBackToTripsList() {
      activeTrip = null;
      LOCATIONS = [];
      orderedLocs = [];
      selectedId = null;

      // Update subviews
      document.getElementById('tripsListSubView').style.display = 'flex';
      document.getElementById('viewTripDetail').style.display = 'none';

      // Reset Route layer on map
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }
      osrmData = null;
      activeRouteCoordsStr = '';
      document.getElementById('routeSummary').classList.remove('show');

      renderMarkers();

      if (userLocation) {
        map.flyTo([userLocation.lat, userLocation.lng], 10);
      } else {
        map.flyTo([39.0, 35.0], 6);
      }

      renderTripList();
      saveTrips();
      updateHeaderControls();
    }

    function selectTrip(tripId) {
      const trip = trips.find(t => t.id == tripId);
      if (!trip) return;

      activeTrip = trip;
      LOCATIONS = activeTrip.locations;
      orderedLocs = [...LOCATIONS];
      selectedId = null;

      // Determine max day in locations to setup activeDays filter
      activeDays.clear();
      let maxDay = 1;
      LOCATIONS.forEach(l => {
        if (l.day !== null) {
          activeDays.add(l.day);
          if (l.day > maxDay) maxDay = l.day;
        }
      });
      if (activeDays.size === 0) activeDays.add(1);

      // Set UI states
      document.getElementById('detailTripName').textContent = activeTrip.name;

      switchAppView('trips');

      // Turn off OSRM route by default on load
      rotaActive = false;
      const routeBtn = document.getElementById('btnRouteToggle');
      if (routeBtn) {
        routeBtn.classList.remove('active');
        routeBtn.innerHTML = '<i class="ti ti-route"></i> Güzergâh Çiz ve Hesapla';
      }

      selectedDayFilter = 'all';
      renderDayFilterChips();

      updateRoute();
      fitMapToVisible();
      updateRecommendations();
      saveTrips();
      updateHeaderControls();
    }

    function openCreateTripModal() {
      // Respect 10 trip limit for authenticated users
      currentUser = JSON.parse(localStorage.getItem('rotagram_user') || 'null');
      if (currentUser && trips.length >= 10) {
        showToast('⚠️ Bulut senkronizasyonu için en fazla 10 seyahat planı oluşturabilirsiniz.');
        return;
      }
      document.getElementById('modalCreateTrip').classList.add('open');
      document.getElementById('fTripName').focus();
    }

    function closeCreateTripModal() {
      document.getElementById('modalCreateTrip').classList.remove('open');
      document.getElementById('fTripName').value = '';
      const durInput = document.getElementById('fTripDuration');
      if (durInput) durInput.value = '3';
    }

    function submitCreateTrip() {
      const nameInput = document.getElementById('fTripName');
      const name = nameInput.value.trim() || 'Yeni Gezi Rotalarım 🗺️';
      const durationInput = document.getElementById('fTripDuration');
      const duration = durationInput ? parseInt(durationInput.value) : 3;
      currentUser = JSON.parse(localStorage.getItem('rotagram_user') || 'null');
      if (currentUser && trips.length >= 10) {
        showToast('⚠️ Bulut senkronizasyonu için en fazla 10 seyahat planı oluşturabilirsiniz.');
        closeCreateTripModal();
        return;
      }
      const newTrip = {
        id: Date.now(),
        name: name,
        duration: duration,
        createdAt: new Date().toISOString(),
        locations: []
      };

      lastAddedTripId = newTrip.id;
      trips.push(newTrip);
      saveTrips();
      closeCreateTripModal();
      selectTrip(newTrip.id);
      showToast('🚀 "' + name + '" başarıyla oluşturuldu!');
    }

    function openRenameTripModal() {
      if (!activeTrip) return;
      document.getElementById('modalRenameTrip').classList.add('open');
      document.getElementById('fRenameTripName').value = activeTrip.name;
      document.getElementById('fRenameTripName').focus();
    }

    function closeRenameTripModal() {
      document.getElementById('modalRenameTrip').classList.remove('open');
      document.getElementById('fRenameTripName').value = '';
    }

    function submitRenameTrip() {
      const nameInput = document.getElementById('fRenameTripName');
      const name = nameInput.value.trim();
      if (!name || !activeTrip) return;

      activeTrip.name = name;
      document.getElementById('detailTripName').textContent = name;

      saveTrips();
      closeRenameTripModal();
      updateHeaderControls();
      showToast('📝 Gezi adı güncellendi.');
    }

    function undoDeleteTrip() {
      if (!deletedTripBackup) return;
      trips.push(deletedTripBackup);
      saveTrips();
      renderTripList();
      updateHeaderControls();
      if (typeof updateMapTopBar === 'function') {
        updateMapTopBar();
      }
      showToast(`✨ "${deletedTripBackup.name}" geri yüklendi!`);
      deletedTripBackup = null;
    }
    window.undoDeleteTrip = undoDeleteTrip;

    function deleteTrip(tripId) {
      const tripToDelete = trips.find(t => t.id == tripId);
      if (!tripToDelete) return;
      
      deletedTripBackup = tripToDelete;

      const performDelete = () => {
        const wasActive = activeTrip && activeTrip.id == tripId;
        trips = trips.filter(t => t.id != tripId);
        
        showToast(`🗑️ "${deletedTripBackup.name}" silindi. <button onclick="window.undoDeleteTrip()" style="background:none; border:none; color:#55EFC4; font-weight:700; text-decoration:underline; cursor:pointer; font-family:inherit; font-size:12px; margin-left:8px;">Geri Al</button>`);

        const listSubView = document.getElementById('tripsListSubView');
        const detailSubView = document.getElementById('viewTripDetail');
        const listWasVisible = listSubView && listSubView.style.display === 'flex';

        if (wasActive || trips.length === 0) {
          activeTrip = null;
          LOCATIONS = [];
          orderedLocs = [];
          selectedId = null;
          if (routeLine && map) { map.removeLayer(routeLine); routeLine = null; }
          osrmData = null;
          rotaActive = false;
          const routeBtn = document.getElementById('btnRouteToggle');
          if (routeBtn) {
            routeBtn.classList.remove('active');
            routeBtn.innerHTML = '<i class="ti ti-route"></i> Güzergâh Çiz ve Hesapla';
          }
          const routeSummary = document.getElementById('routeSummary');
          if (routeSummary) routeSummary.classList.remove('show');
          renderMarkers();
        }

        saveTrips();
        renderTripList();
        updateHeaderControls();
        
        // Update all map-related selectors and filters immediately
        if (typeof updateMapTopBar === 'function') {
          updateMapTopBar();
        }

        // If we deleted the active trip or if we were already looking at the list, force showing the list
        if (wasActive || listWasVisible || trips.length === 0) {
          if (listSubView) listSubView.style.display = 'flex';
          if (detailSubView) detailSubView.style.display = 'none';
        }

        switchAppView('trips');
      };

      // Animate card removal in sidebar list
      const cards = document.querySelectorAll('.trip-card');
      let targetCard = null;
      cards.forEach(c => {
        if (c.outerHTML.includes(`deleteTrip(${tripId})`)) {
          targetCard = c;
        }
      });

      if (targetCard) {
        targetCard.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        targetCard.style.opacity = '0';
        targetCard.style.transform = 'scale(0.9) translateY(10px)';
        targetCard.style.maxHeight = '0';
        targetCard.style.padding = '0';
        targetCard.style.margin = '0';
        setTimeout(performDelete, 300);
      } else {
        performDelete();
      }
    }

    function openOptimizeChoiceModal() {
      document.getElementById('modalOptimizeChoice').classList.add('open');
    }

    function closeOptimizeChoiceModal(isProceeding = false) {
      document.getElementById('modalOptimizeChoice').classList.remove('open');
      if (!isProceeding && rotaActive && !osrmData) {
        rotaActive = false;
        const btn = document.getElementById('btnRouteToggle');
        if (btn) {
          btn.classList.remove('active');
          btn.innerHTML = '<i class="ti ti-route"></i> Güzergâh Çiz ve Hesapla';
        }
        updateRoute();
      }
    }

    async function runOptimizationFlow(allowDayClustering) {
      closeOptimizeChoiceModal(true);

      if (!activeTrip) return;

      if (allowDayClustering) {
        clusterLocationsIntoDays();
      }

      const activeLocs = activeTrip.locations.filter(l => l.day !== null);
      if (activeLocs.length < 2) {
        showToast('⚠️ Optimizasyon için en az 2 konum olmalıdır.');
        updateRoute();
        return;
      }

      pendingOptimizationAllowClustering = allowDayClustering;

      // Check start points for each day
      const daysMap = {};
      activeTrip.locations.filter(l => l.day !== null).forEach(l => {
        if (!daysMap[l.day]) daysMap[l.day] = [];
        daysMap[l.day].push(l);
      });

      const missingStartDays = [];
      Object.keys(daysMap).forEach(dNum => {
        const dayLocs = daysMap[dNum];
        if (dayLocs.length >= 2 && !dayLocs.some(l => l.isStartPoint)) {
          missingStartDays.push(parseInt(dNum));
        }
      });

      if (missingStartDays.length > 0) {
        promptForStartPoint(missingStartDays[0], missingStartDays.slice(1));
        return;
      }

      showToast('⏳ Güzergâh optimize ediliyor...');
      await optimizeAllDaysTSP();

      showToast('✨ Güzergâh en efektif şekilde optimize edildi!');
      updateRoute();

      // After route is computed, go to map tab on mobile
      if (window.innerWidth <= 768) {
        setTimeout(() => { switchAppView('map'); updateMapTopBar(); fitMapToVisible(); }, 800);
      }
    }

    function promptForStartPoint(dayNum, remainingDays = []) {
      const modal = document.getElementById('modalSelectStartPoint');
      const promptText = document.getElementById('selectStartPointPrompt');
      const listContainer = document.getElementById('selectStartPointList');

      if (!modal || !promptText || !listContainer) return;

      promptText.innerHTML = `🏠 <strong>${dayNum}. Gün</strong> için konaklayacağınız / başlayacağınız yeri seçin:`;
      listContainer.innerHTML = '';

      const dayLocs = activeTrip.locations.filter(l => l.day === dayNum);

      dayLocs.forEach(loc => {
        const item = document.createElement('div');
        item.className = 'select-start-point-item';
        item.style.cssText = `
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
        `;
        item.innerHTML = `
          <div style="font-size: 18px; color: var(--ink3);"><i class="ti ti-home"></i></div>
          <div style="flex:1; font-weight: 500; font-size:13px; color:var(--ink);">${loc.name}</div>
          <div style="font-size: 11px; color: var(--ink3);">${loc.region}</div>
        `;

        item.onmouseenter = () => {
          item.style.background = 'var(--primary-bg)';
          item.style.borderColor = 'var(--primary)';
        };
        item.onmouseleave = () => {
          item.style.background = 'transparent';
          item.style.borderColor = 'var(--border)';
        };

        item.onclick = async () => {
          // Set this location as start point
          toggleStartPoint(loc.id);

          closeSelectStartPointModal(true);

          // Check if there are other missing days
          if (remainingDays.length > 0) {
            setTimeout(() => {
              promptForStartPoint(remainingDays[0], remainingDays.slice(1));
            }, 300);
          } else {
            // All starting points set! Run optimization
            showToast('⏳ Güzergâh optimize ediliyor...');
            rotaActive = true;
            const btn = document.getElementById('btnRouteToggle');
            if (btn) {
              btn.classList.add('active');
              btn.innerHTML = '<i class="ti ti-route"></i> Güzergâhı Kapat';
            }
            await optimizeAllDaysTSP();
            showToast('✨ Güzergâh en efektif şekilde optimize edildi!');
            updateRoute();

            // Go to map tab on mobile
            if (window.innerWidth <= 768) {
              setTimeout(() => { switchAppView('map'); updateMapTopBar(); fitMapToVisible(); }, 800);
            }
          }
        };

        listContainer.appendChild(item);
      });

      modal.classList.add('open');
    }

    function closeSelectStartPointModal(isSuccess = false) {
      const modal = document.getElementById('modalSelectStartPoint');
      if (modal) {
        modal.classList.remove('open');
      }
      if (!isSuccess) {
        rotaActive = false;
        const btn = document.getElementById('btnRouteToggle');
        if (btn) {
          btn.classList.remove('active');
          btn.innerHTML = '<i class="ti ti-route"></i> Güzergâh Çiz ve Hesapla';
        }
        updateRoute();
      }
    }

    function renderDayFilterChips() {
      const container = document.getElementById('dayFilters');
      if (!container) return;
      container.innerHTML = '';

      // All days chip
      const allChip = document.createElement('div');
      allChip.className = `fchip ${selectedDayFilter === 'all' ? 'on' : 'off'}`;
      allChip.textContent = 'Tüm Günler';
      allChip.onclick = () => selectDayFilter('all');
      container.appendChild(allChip);

      // Collect days from activeTrip duration
      const sortedDays = [];
      const duration = (activeTrip && activeTrip.duration) || 3;
      for (let i = 1; i <= duration; i++) {
        sortedDays.push(i);
      }
      sortedDays.forEach(d => {
        const chip = document.createElement('div');
        chip.className = `fchip ${selectedDayFilter == d ? 'on' : 'off'}`;
        const dayColor = DAYS[d] || '#6C5CE7';
        chip.innerHTML = `<span class="dot" style="background:${dayColor}"></span>${d}. Gün`;
        chip.onclick = () => selectDayFilter(d);
        container.appendChild(chip);
      });

      // Alternative chip
      const hasAlternative = LOCATIONS.some(l => l.day === null);
      if (hasAlternative) {
        const altChip = document.createElement('div');
        altChip.className = `fchip ${selectedDayFilter === 'null' ? 'on' : 'off'}`;
        altChip.textContent = 'Plan Dışı';
        altChip.onclick = () => selectDayFilter('null');
        container.appendChild(altChip);
      }
    }

    function selectDayFilter(dayVal) {
      selectedDayFilter = dayVal;
      renderDayFilterChips();
      updateRoute();

      const headerSelect = document.getElementById('headerDaySelect');
      if (headerSelect) {
        headerSelect.value = dayVal;
      }
    }

    function toggleTripSearch() {
      const container = document.getElementById('tripSearchContainer');
      const btn = document.getElementById('btnToggleTripSearch');
      if (!container || !btn) return;
      if (container.style.display === 'none' || !container.style.display) {
        container.style.display = 'block';
        setTimeout(() => {
          container.style.maxHeight = '100px';
          container.style.opacity = '1';
        }, 10);
        btn.classList.add('active');
        const input = document.getElementById('tripSearchInput');
        if (input) input.focus();
      } else {
        container.style.maxHeight = '0px';
        container.style.opacity = '0';
        btn.classList.remove('active');
        setTimeout(() => {
          if (container.style.maxHeight === '0px') {
            container.style.display = 'none';
          }
        }, 300);
      }
    }

    function toggleFiltersCollapse() {
      const filters = document.getElementById('combinedFilters');
      const btn = document.getElementById('btnToggleFilters');
      if (!filters || !btn) return;
      if (filters.style.display === 'none' || !filters.style.display) {
        filters.style.display = 'flex';
        setTimeout(() => {
          filters.style.maxHeight = '300px';
          filters.style.opacity = '1';
        }, 10);
        btn.classList.add('active');
      } else {
        filters.style.maxHeight = '0px';
        filters.style.opacity = '0';
        btn.classList.remove('active');
        setTimeout(() => {
          if (filters.style.maxHeight === '0px') {
            filters.style.display = 'none';
          }
        }, 300);
      }
    }

    function renderList() {
      if (activeTab === 'list') {
        renderStandardList();
      } else if (activeTab === 'timeline') {
        renderTimelineView();
      } else if (activeTab === 'nav') {
        renderNavDirections();
      }
    }

    async function fetchWeatherForWidget(lat, lng) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          document.getElementById('widgetWeatherTemp').textContent = `${temp}°C`;

          let icon = 'sun';
          let condText = 'Güneşli';
          const code = data.current_weather.weathercode;

          if ([1, 2, 3].includes(code)) { icon = 'cloud-sun'; condText = 'Parçalı Bulutlu'; }
          else if ([45, 48].includes(code)) { icon = 'mist'; condText = 'Sisli'; }
          else if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) { icon = 'cloud-rain'; condText = 'Yağmurlu'; }
          else if ([71, 73, 75, 85, 86].includes(code)) { icon = 'snowflake'; condText = 'Karlı'; }
          else if ([95, 96, 99].includes(code)) { icon = 'cloud-storm'; condText = 'Fırtınalı'; }
          else if (code > 3) { icon = 'cloud'; condText = 'Bulutlu'; }

          document.getElementById('widgetWeatherCond').innerHTML = `<i class="ti ti-${icon}"></i> ${condText}`;
          document.getElementById('widgetWeather').style.display = 'flex';
        }
      } catch (err) {
        console.warn('Widget hava durumu alınamadı:', err);
      }
    }

    function toggleCoordInputs() {
      const form = document.getElementById('manualAddFormFields');
      if (form.style.display === 'none' || !form.style.display) {
        form.style.display = 'flex';
        document.getElementById('mName').focus();
      } else {
        form.style.display = 'none';
      }
    }

    function toggleManualFormCat(el) {
      el.classList.toggle('selected');
    }

    function submitManualAdd() {
      const name = document.getElementById('mName').value.trim();
      const lat = parseFloat(document.getElementById('mLat').value);
      const lng = parseFloat(document.getElementById('mLng').value);
      const desc = document.getElementById('mDesc').value.trim();

      if (!name || isNaN(lat) || isNaN(lng)) {
        showToast('⚠️ İsim, enlem ve boylam girilmesi zorunludur!');
        return;
      }

      const selectedCats = [];
      document.querySelectorAll('.m-cat-chip.selected').forEach(c => {
        selectedCats.push(c.dataset.cat);
      });
      if (selectedCats.length === 0) selectedCats.push('oneri');

      const tempLocationData = {
        name: name,
        lat: lat,
        lng: lng,
        cats: selectedCats,
        desc: desc || 'Manuel eklenen konum.',
        rating: null,
        region: 'Manuel Konum',
        userAdded: true
      };

      document.getElementById('manualAddFormFields').style.display = 'none';
      document.getElementById('mName').value = '';
      document.getElementById('mLat').value = '';
      document.getElementById('mLng').value = '';
      document.getElementById('mDesc').value = '';
      document.querySelectorAll('.m-cat-chip').forEach(c => c.classList.remove('selected'));

      openAddToTripAndDayModal(tempLocationData);
    }

    async function sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function clearTabSearch() {
      document.getElementById('searchTabInput').value = '';
      document.getElementById('searchTabClear').style.display = 'none';
      document.getElementById('searchTabResults').innerHTML = '';
      document.getElementById('searchTabResults').classList.remove('active');
    }

    function clearTripSearch() {
      document.getElementById('tripSearchInput').value = '';
      document.getElementById('tripSearchClear').style.display = 'none';
      document.getElementById('tripSearchResults').innerHTML = '';
      document.getElementById('tripSearchResults').classList.remove('active');
    }

    async function triggerGeocoding(query, source) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=tr&limit=5&email=${encodeURIComponent(NOMINATIM_EMAIL)}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        renderGeocodeResults(data, source);
      } catch (e) {
        console.error('Arama hatası:', e);
      }
    }

    function renderGeocodeResults(data, source) {
      const containerId = source === 'searchTab' ? 'searchTabResults' : 'tripSearchResults';
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="search-item" style="color: var(--ink3); cursor: default;">Sonuç bulunamadı</div>';
        container.classList.add('active');
        return;
      }

      data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item';
        const displayName = item.display_name;
        div.innerHTML = `<i class="ti ti-map-pin"></i> <span>${displayName}</span>`;
        div.title = displayName;

        div.onclick = () => {
          const nameClean = item.name || displayName.split(',')[0];
          handleSearchResultSelect(nameClean, item.lat, item.lon, displayName, source);
        };

        container.appendChild(div);
      });
      container.classList.add('active');
    }

    async function handleSearchResultSelect(name, lat, lng, fullName, source) {
      if (source === 'searchTab') clearTabSearch(); else clearTripSearch();

      map.flyTo([lat, lng], 14);

      showToast('🔍 İnternetten detaylı konum araştırması yapılıyor...');

      const cleanName = name.split(',')[0].trim();
      let wikiInfo = await fetchWikipediaSummary(cleanName);

      if (!wikiInfo || !wikiInfo.summary) {
        const queryPart = cleanName.replace(/(İlçe|Belde|Köyü|Mahallesi|Sokağı|Yolu|Limanı|Plajı|Koyu)/g, '').trim();
        wikiInfo = await fetchWikipediaSummary(queryPart);
      }

      let desc = '';
      let cats = [];

      if (wikiInfo && wikiInfo.summary) {
        desc = wikiInfo.summary;
        cats = detectCategory(cleanName, wikiInfo.summary);
        showToast('✨ Wikipedia yardımıyla bilgiler yüklendi!');
      } else {
        desc = `${fullName.split(',').slice(0, 3).join(',')} bölgesinde yer alan seyahat noktası.`;
        cats = detectCategory(cleanName, desc);
        showToast('📍 Konum koordinatları belirlendi.');
      }

      const tempLocationData = {
        name: cleanName,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        cats: cats,
        desc: desc,
        rating: wikiInfo && wikiInfo.coordinates ? '4.5' : null,
        region: fullName.split(',')[1]?.trim() || 'Türkiye',
        userAdded: true
      };

      openAddToTripAndDayModal(tempLocationData);
    }

    async function fetchWikipediaSummary(query) {
      const searchUrl = `https://tr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      try {
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
          const title = searchData.query.search[0].title;
          const summaryUrl = `https://tr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const summaryRes = await fetch(summaryUrl);
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            return {
              title: title,
              summary: summaryData.extract || summaryData.description || '',
              coordinates: summaryData.coordinates || null
            };
          }
        }
      } catch (e) {
        console.warn('Wikipedia arama hatası:', e);
      }
      return null;
    }

    function detectCategory(name, desc) {
      const text = (name + ' ' + desc).toLowerCase();
      const cats = [];
      if (text.match(/(antik|kale|tapınak|tarih|müze|kilise|altar|harabe|tiyatro|kazı|yüzyıl|romalı|bizans|osmanlı|lahit)/)) {
        cats.push('tarih');
      }
      if (text.match(/(koy|plaj|deniz|liman|ada|sahil|bük|plajı|tekne|akvaryum|marina|körfez)/)) {
        cats.push('deniz');
      }
      if (text.match(/(kültür|sanat|galeri|sergi|etkinlik|kütüphane|evleri|sokak|taş ev|köprü|çarşı)/)) {
        cats.push('kultur');
      }
      if (text.match(/(meyhane|lokanta|restoran|yemek|gastronomi|lezzet|tadım|balık|meze|mutfak|tatlı|dondurma|kahvaltı|zeytinyağ)/)) {
        cats.push('gastro');
      }
      if (text.match(/(tepe|manzara|seyir|günbatımı|gün batımı|panoramik|teras|doğa|orman|akropol)/)) {
        cats.push('manzara');
      }
      if (cats.length === 0) {
        cats.push('oneri');
      }
      return cats;
    }

    function switchTab(tab) {
      activeTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });

      document.getElementById('tabContentList').style.display = tab === 'list' ? 'block' : 'none';
      document.getElementById('tabContentTimeline').style.display = tab === 'timeline' ? 'block' : 'none';
      document.getElementById('tabContentNav').style.display = tab === 'nav' ? 'block' : 'none';

      if (tab === 'list') {
        renderStandardList();
      } else if (tab === 'timeline') {
        renderTimelineView();
      } else if (tab === 'nav') {
        renderNavDirections();
      }
    }

    function handleDragStart(e, index) {
      draggedIndex = index;
      e.dataTransfer.effectAllowed = 'move';
      e.target.classList.add('dragging');
    }

    function handleDragOver(e) {
      e.preventDefault();
      return false;
    }

    function handleDragEnter(e, el) {
      el.classList.add('drag-over');
    }

    function handleDragLeave(e, el) {
      el.classList.remove('drag-over');
    }

    function handleDrop(e, targetIndex) {
      e.stopPropagation();
      if (draggedIndex === null || draggedIndex === targetIndex) return;

      const item = orderedLocs.splice(draggedIndex, 1)[0];
      orderedLocs.splice(targetIndex, 0, item);

      if (activeTrip) {
        activeTrip.locations = [...orderedLocs];
      }

      saveTrips();
      updateRoute();
      draggedIndex = null;
    }

    function handleDragEnd(e) {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.loc-item').forEach(el => el.classList.remove('drag-over'));
    }

    async function handleDayDrop(e, targetDay) {
      e.preventDefault();
      if (draggedIndex === null) return;

      const vis = getVisibleLocations();
      const draggedItem = vis[draggedIndex];
      if (!draggedItem) return;

      const oldDay = draggedItem.day;
      if (oldDay === targetDay) return;

      draggedItem.day = targetDay;

      if (targetDay !== null) {
        activeDays.add(targetDay);
      }

      if (rotaActive) {
        await optimizeAllDaysTSP();
      } else {
        saveTrips();
      }
      updateRoute();
      draggedIndex = null;
      showToast(`📍 "${draggedItem.name}" ${targetDay}. Gün planına taşındı.`);
    }

    function selectLocationInline(id) {
      if (selectedId === id) {
        selectedId = null;
      } else {
        selectedId = id;
        const loc = LOCATIONS.find(x => x.id === id);
        if (loc) {
          map.flyTo([loc.lat, loc.lng], 14, { duration: 0.8 });
        }

        // Auto expand list scroll
        setTimeout(() => {
          const elements = document.querySelectorAll('.loc-item, .timeline-item');
          const vis = getVisibleLocations();
          const idx = vis.findIndex(x => x.id === id);
          if (idx >= 0 && elements[idx]) {
            elements[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 200);
      }

      renderMarkers();
      if (activeTab === 'list') {
        renderStandardList();
      } else if (activeTab === 'timeline') {
        renderTimelineView();
      }
    }

    function closeLocationDetail() {
      selectedId = null;
      renderMarkers();
      if (activeTab === 'list') renderStandardList();
      else if (activeTab === 'timeline') renderTimelineView();
    }

    function getVisibleLocations() {
      // Filter based on active categories, ordering, and day filter
      return orderedLocs.filter(l => {
        const matchCat = l.cats.some(c => activeCats.has(c));
        if (!matchCat) return false;

        if (selectedDayFilter !== 'all') {
          if (selectedDayFilter === 'null') {
            return l.day === null;
          }
          return l.day == selectedDayFilter;
        }
        return true;
      });
    }

    function renderStandardList() {
      const container = document.getElementById('locList');
      if (!container) return;
      container.innerHTML = '';
      if (!activeTrip) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="ti ti-map-2" style="font-size:32px; color:var(--ink3);"></i>
            <p>Gezi planınız henüz boş. Yukarıdaki arama çubuğundan veya önerilerdeki konumlardan planınıza durak ekleyebilirsiniz.</p>
          </div>
        `;
        return;
      }
      const vis = getVisibleLocations();
      const activeVis = vis.filter(l => l.day !== null);
      const passiveVis = vis.filter(l => l.day === null);
      // Update count badge
      document.getElementById('statLocs').textContent = activeVis.length;
      const duration = activeTrip.duration || 3;
      const activeDaysSet = new Set();
      activeVis.forEach(l => {
        if (l.day !== null) activeDaysSet.add(l.day);
      });
      document.getElementById('statDays').textContent = activeDaysSet.size;
      // Function to render standard active item
      function createLocationDOM(l, idx) {
        const div = document.createElement('div');
        const isSelected = selectedId === l.id;
        const isNight = isNightActivity(l);
        div.className = 'loc-item' + (isSelected ? ' selected' : '') + (isNight ? ' night-activity' : '');
        div.draggable = true;
        div.ondragstart = (e) => handleDragStart(e, orderedLocs.findIndex(x => x.id === l.id));
        div.ondragover = (e) => handleDragOver(e);
        div.ondragenter = (e) => handleDragEnter(e, div);
        div.ondragleave = (e) => handleDragLeave(e, div);
        div.ondrop = (e) => handleDrop(e, orderedLocs.findIndex(x => x.id === l.id));
        div.ondragend = (e) => handleDragEnd(e);
        div.onclick = (e) => {
          if (!e.target.closest('.loc-detail-expanded')) selectLocationInline(l.id);
        };
        const catsHtml = l.cats.map(c => `<span class="loc-cat cat-${c}">${CATS[c].label}</span>`).join('');
        const nightBadge = isNight ? `<span class="loc-cat" style="background:#E8EAF6; color:#3F51B5; border:1px solid #C5CAE9;"><i class="ti ti-moon"></i> Gece</span>` : '';
        const ratingHtml = l.rating ? `<span class="loc-rating">★ ${l.rating}</span>` : '';
        const startIconHtml = l.isStartPoint ? '<i class="ti ti-home" style="color:#FF7675; margin-right:4px;" title="Başlangıç/Konaklama Noktası"></i>' : '';
        let expandedHtml = '';
        if (isSelected) {
          expandedHtml = createExpandedDetailsHTML(l);
        }
        div.innerHTML = `
          <div class="loc-order" style="background:${DAYBG[l.day] || '#f0ecfb'}; color:${DAYS[l.day] || '#6c5ce7'};">${idx + 1}</div>
          <div class="loc-body">
            <div class="loc-name">${startIconHtml}${l.name}</div>
            <div class="loc-meta">
              ${catsHtml}
              ${nightBadge}
              ${ratingHtml}
              <span class="loc-dist">${l.day}. Gün Planı</span>
            </div>
            ${expandedHtml}
          </div>
          <div class="loc-actions" onclick="event.stopPropagation()">
            <button class="loc-action-btn start-point-btn ${l.isStartPoint ? 'active-start' : ''}" onclick="toggleStartPoint(${l.id})" title="${l.isStartPoint ? 'Başlangıç Noktasını İptal Et' : 'Konaklama / Başlangıç Noktası Yap'}"><i class="ti ti-home"></i></button>
            <button class="loc-action-btn delete-btn" onclick="deactivateLocation(${l.id})" title="Plandan Çıkar"><i class="ti ti-x"></i></button>
            <button class="loc-action-btn loc-drag-handle" style="cursor:grab;"><i class="ti ti-menu-2"></i></button>
          </div>
        `;
        return div;
      }
      // Function to render suggestion item (black & white, grayscale)
      function createSuggestionDOM(item, dayNum) {
        const div = document.createElement('div');
        div.className = 'loc-item passive suggestion-passive';
        div.style.cssText = `
          filter: grayscale(100%);
          opacity: 0.6;
          border: 1px dashed var(--border);
          background: #fafafa;
          margin-left: 10px;
          margin-bottom: 6px;
          transition: all 0.2s ease;
          cursor: pointer;
        `;
        div.onmouseenter = () => {
          div.style.filter = 'none';
          div.style.opacity = '1';
          div.style.background = 'var(--primary-bg)';
          div.style.borderColor = 'var(--primary)';
        };
        div.onmouseleave = () => {
          div.style.filter = 'grayscale(100%)';
          div.style.opacity = '0.6';
          div.style.background = '#fafafa';
          div.style.borderColor = 'var(--border)';
        };
        div.onclick = () => {
          addRecommendationToSpecificDay(item, dayNum);
        };
        const mainCat = item.cats[0] || 'oneri';
        const catsHtml = `<span class="loc-cat cat-${mainCat}">${CATS[mainCat].label}</span>`;
        const ratingHtml = item.rating ? `<span class="loc-rating">★ ${item.rating}</span>` : '';
        div.innerHTML = `
          <div class="loc-order oneri" style="background: #e0e0e0; color: #666;">💡</div>
          <div class="loc-body" style="padding-right: 10px;">
            <div class="loc-name" style="font-size:12px; font-weight:600; color:var(--ink);">${item.name}</div>
            <div class="loc-meta">
              ${catsHtml}
              ${ratingHtml}
              <span class="loc-dist">${item.dist.toFixed(1)} km yakınında</span>
            </div>
          </div>
          <div class="loc-actions">
            <button class="loc-action-btn" style="color:var(--primary); font-size:16px; font-weight:bold;" title="Güne Ekle">+</button>
          </div>
        `;
        return div;
      }
      // Decide which days to render
      const daysToRender = [];
      if (selectedDayFilter === 'all') {
        for (let i = 1; i <= duration; i++) {
          daysToRender.push(i);
        }
      } else if (typeof selectedDayFilter === 'number') {
        daysToRender.push(selectedDayFilter);
      }
      // Grouped rendering by Day
      daysToRender.forEach(dayNum => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-list-header';
        const dayColor = DAYS[dayNum] || '#6c5ce7';
        const dayBg = DAYBG[dayNum] || '#f0ecfb';
        const dayLocs = activeVis.filter(l => l.day === dayNum);
        dayHeader.style.cssText = `
          background: ${dayBg};
          border-left: 4px solid ${dayColor};
          color: var(--ink);
          font-weight: 700;
          font-size: 12.5px;
          padding: 8px 12px;
          margin: 14px 0 8px 0;
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        dayHeader.innerHTML = `
          <span>${dayNum}. Gün Planı</span>
          <span style="font-size: 11px; font-weight: 500; color: var(--ink2);">${dayLocs.length} konum</span>
        `;
        container.appendChild(dayHeader);
        // Render added locations
        if (dayLocs.length > 0) {
          dayLocs.forEach((l, idx) => {
            container.appendChild(createLocationDOM(l, idx));
          });
        } else {
          const emptyDay = document.createElement('div');
          emptyDay.style.cssText = 'padding: 12px; font-size: 11.5px; color: var(--ink3); text-align: center; border: 1px dashed var(--border); border-radius: var(--radius-md); margin-bottom: 8px;';
          emptyDay.textContent = 'Henüz konum eklenmedi.';
          container.appendChild(emptyDay);
        }
        // Render passive suggestions within 10km radius
        if (dayLocs.length > 0) {
          const allSuggSource = [...(typeof RECOMMENDED_DATABASE !== 'undefined' ? RECOMMENDED_DATABASE : []), ...(typeof PLAN_RECOMMENDATIONS !== 'undefined' ? PLAN_RECOMMENDATIONS : [])];
          const suggestions = [];
          const seenNames = new Set(activeTrip.locations.map(l => l.name.toLowerCase()));
          allSuggSource.forEach(r => {
            if (!seenNames.has(r.name.toLowerCase()) && r.lat && r.lng) {
              let minDist = Infinity;
              dayLocs.forEach(dl => {
                const d = calculateDistance(r, dl);
                if (d < minDist) minDist = d;
              });
              if (minDist <= 10) {
                suggestions.push({ ...r, dist: minDist });
              }
            }
          });
          // Deduplicate by name and sort by distance
          const uniqueSuggestions = [];
          const seenSuggNames = new Set();
          suggestions.sort((a, b) => a.dist - b.dist).forEach(s => {
            const key = s.name.toLowerCase();
            if (!seenSuggNames.has(key)) {
              seenSuggNames.add(key);
              uniqueSuggestions.push(s);
            }
          });
          // Render top 3 suggestions
          const suggestionsToRender = uniqueSuggestions.slice(0, 3);
          if (suggestionsToRender.length > 0) {
            const sugHeader = document.createElement('div');
            sugHeader.style.cssText = 'font-size: 10px; font-weight: 700; color: var(--ink3); text-transform: uppercase; margin: 8px 0 4px 12px; letter-spacing: 0.05em;';
            sugHeader.textContent = '💡 Yakınlardaki Öneriler (Max 10km)';
            container.appendChild(sugHeader);
            suggestionsToRender.forEach(s => {
              container.appendChild(createSuggestionDOM(s, dayNum));
            });
          }
        }
      });
      // Render plan-dışı locations at bottom (only when selectedDayFilter is 'all')
      if (selectedDayFilter === 'all' && passiveVis.length > 0) {
        const header = document.createElement('div');
        header.style.cssText = 'font-size: 11px; font-weight:700; color:var(--ink3); text-transform:uppercase; letter-spacing:0.06em; margin: 20px 0 6px 4px;';
        header.innerHTML = '<i class="ti ti-sparkles"></i> Alternatif / Plan Dışı Yerler';
        container.appendChild(header);
        passiveVis.forEach(l => {
          const div = document.createElement('div');
          const isSelected = selectedId === l.id;
          div.className = 'loc-item passive' + (isSelected ? ' selected' : '');
          div.onclick = (e) => {
            if (!e.target.closest('.loc-detail-expanded')) selectLocationInline(l.id);
          };
          const catsHtml = l.cats.map(c => `<span class="loc-cat cat-${c}">${CATS[c].label}</span>`).join('');
          const ratingHtml = l.rating ? `<span class="loc-rating">★ ${l.rating}</span>` : '';
          let expandedHtml = '';
          if (isSelected) {
            expandedHtml = createExpandedDetailsHTML(l);
          }
          div.innerHTML = `
            <div class="loc-order oneri">📍</div>
            <div class="loc-body">
              <div class="loc-name">${l.name}</div>
              <div class="loc-meta">
                ${catsHtml}
                ${ratingHtml}
                <span class="loc-dist">Plan Dışı</span>
              </div>
              ${expandedHtml}
            </div>
            <div class="loc-actions" onclick="event.stopPropagation()">
              <button class="loc-action-btn" onclick="activateLocation(${l.id})" style="color:var(--primary)" title="Plana Ekle"><i class="ti ti-plus"></i></button>
              <button class="loc-action-btn delete-btn" onclick="deleteLocationPermanently(${l.id})" title="Tamamen Sil"><i class="ti ti-trash"></i></button>
            </div>
          `;
          container.appendChild(div);
        });
      }
    }
    function createExpandedDetailsHTML(l) {
      const regionVal = l.region || 'Bilinmiyor';
      const hoursVal = l.hours || 'Belirtilmemiş';
      const tipVal = l.tip || 'İpucu eklenmemiş.';

      return `
        <div class="loc-detail-expanded" onclick="event.stopPropagation()">
          <p class="loc-desc-text">${l.desc}</p>
          <div class="loc-expanded-grid">
            <div class="loc-expanded-item">
              <span class="loc-expanded-lbl">Bölge</span>
              <span class="loc-expanded-val">${regionVal}</span>
            </div>
            <div class="loc-expanded-item">
              <span class="loc-expanded-lbl">Ziyaret Saatleri</span>
              <span class="loc-expanded-val">${hoursVal}</span>
            </div>
          </div>
          <div style="font-size: 11px; font-style: italic; color: var(--primary); background: var(--primary-bg); padding:6px 10px; border-radius:var(--radius-sm);">
            💡 ${tipVal}
          </div>
          <div class="loc-detail-actions">
            <div class="loc-day-select">
              <label>Plan Günü:</label>
              <select onchange="changeLocationPlanDay(${l.id}, this.value)">
                <option value="null" ${l.day === null ? 'selected' : ''}>Plan Dışı</option>
                <option value="1" ${l.day === 1 ? 'selected' : ''}>1. Gün</option>
                <option value="2" ${l.day === 2 ? 'selected' : ''}>2. Gün</option>
                <option value="3" ${l.day === 3 ? 'selected' : ''}>3. Gün</option>
                <option value="4" ${l.day === 4 ? 'selected' : ''}>4. Gün</option>
                <option value="5" ${l.day === 5 ? 'selected' : ''}>5. Gün</option>
                <option value="6" ${l.day === 6 ? 'selected' : ''}>6. Gün</option>
                <option value="7" ${l.day === 7 ? 'selected' : ''}>7. Gün</option>
              </select>
            </div>
            <div class="loc-maps-links">
              ${l.day !== null ? `
              <button class="loc-map-btn start-point-toggle-btn ${l.isStartPoint ? 'active' : ''}" onclick="toggleStartPoint(${l.id})" style="border: 1px solid ${l.isStartPoint ? '#FF7675' : 'var(--border)'}; background: ${l.isStartPoint ? '#FFF0F0' : 'transparent'}; color: ${l.isStartPoint ? '#FF7675' : 'var(--ink)'}; padding: 4px 8px; border-radius: var(--radius-sm); font-size:11px; cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:600;" title="${l.isStartPoint ? 'Konaklama/Başlangıç Noktasını İptal Et' : 'Bu Konumu Konaklama/Başlangıç Noktası Yap'}">
                <i class="ti ti-home"></i> ${l.isStartPoint ? 'Başlangıç Noktası' : 'Başlangıç Yap'}
              </button>
              ` : ''}
              <a href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}" target="_blank" class="loc-map-btn gmaps"><i class="ti ti-brand-google-maps"></i> Google</a>
              <a href="https://maps.apple.com/maps?daddr=${l.lat},${l.lng}" target="_blank" class="loc-map-btn apple"><i class="ti ti-brand-apple"></i> Apple</a>
            </div>
          </div>
        </div>
      `;
    }

    function toggleTimelineDay(d) {
      if (collapsedDays.has(d)) collapsedDays.delete(d); else collapsedDays.add(d);
      renderTimelineView();
    }

    function renderTimelineView() {
      const container = document.getElementById('timelineContainer');
      if (!container) return;
      container.innerHTML = '';

      const vis = getVisibleLocations();

      // Group by day values
      const daysMap = {};
      vis.filter(l => l.day !== null).forEach(l => {
        if (!daysMap[l.day]) daysMap[l.day] = [];
        daysMap[l.day].push(l);
      });

      const sortedDays = Object.keys(daysMap).sort((a, b) => a - b);

      // Update statistics days count
      document.getElementById('statDays').textContent = sortedDays.length;

      if (sortedDays.length > 0) {
        sortedDays.forEach(dayStr => {
          const dayNum = parseInt(dayStr);
          const dayLocs = daysMap[dayNum];
          const isCollapsed = collapsedDays.has(dayNum);
          const dayColor = DAYS[dayNum] || '#6C5CE7';
          const dayBg = DAYBG[dayNum] || '#F0EEFF';

          let totalLegDist = 0;
          for (let i = 0; i < dayLocs.length - 1; i++) {
            totalLegDist += calculateDistance(dayLocs[i], dayLocs[i + 1]);
          }
          const distStr = totalLegDist > 0 ? ` · ~${totalLegDist.toFixed(1)} km` : '';

          const dayGroupDiv = document.createElement('div');
          dayGroupDiv.className = `timeline-day-group ${isCollapsed ? 'collapsed' : ''}`;

          dayGroupDiv.innerHTML = `
            <div class="timeline-day-header" onclick="toggleTimelineDay(${dayNum})" style="border-left-color: ${dayColor};">
              <div class="timeline-day-title">
                <i class="ti ti-calendar" style="color: ${dayColor};"></i>
                <span>${dayNum}. Gün Rotası <span style="font-size:10px; font-weight:normal; color:var(--ink3);">(${dayLocs.length} durak${distStr})</span></span>
              </div>
              <i class="ti ti-chevron-down timeline-day-arrow" style="transform: ${isCollapsed ? 'rotate(-90deg)' : 'none'};"></i>
            </div>
            <div class="timeline-items" 
                 ondragover="event.preventDefault(); this.classList.add('drag-over');"
                 ondragleave="this.classList.remove('drag-over');"
                 ondrop="handleDayDrop(event, ${dayNum}); this.classList.remove('drag-over');"
                 style="display: ${isCollapsed ? 'none' : 'block'}; border-left-color: ${dayColor}40;">
            </div>
          `;

          const itemsContainer = dayGroupDiv.querySelector('.timeline-items');

          dayLocs.forEach((l, idx) => {
            const itemDiv = document.createElement('div');
            const isSelected = selectedId === l.id;
            const isNight = isNightActivity(l);
            itemDiv.className = `timeline-item ${isSelected ? 'selected' : ''} ${isNight ? 'night-activity' : ''}`;

            const globalIndex = orderedLocs.findIndex(x => x.id === l.id);
            itemDiv.draggable = true;
            itemDiv.ondragstart = (e) => handleDragStart(e, globalIndex);
            itemDiv.ondragover = (e) => handleDragOver(e);
            itemDiv.ondragenter = (e) => handleDragEnter(e, itemDiv);
            itemDiv.ondragleave = (e) => handleDragLeave(e, itemDiv);
            itemDiv.ondrop = (e) => handleDrop(e, globalIndex);
            itemDiv.ondragend = (e) => handleDragEnd(e);

            itemDiv.onclick = (e) => {
              if (!e.target.closest('.loc-detail-expanded')) selectLocationInline(l.id);
            };
            itemDiv.style.setProperty('--timeline-bullet-color', dayColor);

            const catsHtml = l.cats.map(c => `<span class="loc-cat cat-${c}">${CATS[c].label}</span>`).join('');
            const nightBadge = isNight ? `<span class="loc-cat" style="background:#E8EAF6; color:#3F51B5; border:1px solid #C5CAE9;"><i class="ti ti-moon"></i> Gece</span>` : '';
            const ratingHtml = l.rating ? `<span class="loc-rating">★ ${l.rating}</span>` : '';
            const startIconHtml = l.isStartPoint ? '<i class="ti ti-home" style="color:#FF7675; margin-right:4px;" title="Başlangıç/Konaklama Noktası"></i>' : '';

            let connHtml = '';
            if (rotaActive && idx < dayLocs.length - 1) {
              const nextLoc = dayLocs[idx + 1];
              const dist = calculateDistance(l, nextLoc);
              const time = Math.round(dist / 50 * 60);
              connHtml = `
                <div class="timeline-connector-info" style="color:${dayColor}">
                  <i class="ti ti-arrow-narrow-down"></i> ${dist.toFixed(1)} km (~${time} dk)
                </div>`;
            }

            let expandedHtml = '';
            if (isSelected) {
              expandedHtml = createExpandedDetailsHTML(l);
            } else {
              expandedHtml = `<div style="font-size:11px; color:var(--ink2); margin-top:4px;">${l.tip || l.desc.substring(0, 75) + '...'}</div>`;
            }

            itemDiv.innerHTML = `
              <div class="timeline-item-title-row">
                <div class="timeline-item-title">${startIconHtml}${l.name}</div>
                <div class="timeline-item-num" style="border-color:${dayColor}; color:${dayColor};">${idx + 1}</div>
              </div>
              <div class="loc-meta" style="margin-top:2px;">
                ${catsHtml}
                ${nightBadge}
                ${ratingHtml}
              </div>
              ${expandedHtml}
              ${connHtml}
            `;

            itemsContainer.appendChild(itemDiv);
          });

          container.appendChild(dayGroupDiv);
        });
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <i class="ti ti-calendar" style="font-size:32px; color:var(--ink3);"></i>
            <p>Zaman tünelini görüntülemek için plana konum eklemelisiniz.</p>
          </div>
        `;
      }
    }

    function renderNavDirections() {
      const container = document.getElementById('navDirections');
      if (!container) return;

      const vis = getVisibleLocations().filter(l => l.day !== null);

      if (!rotaActive) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="ti ti-route" style="font-size: 32px; color: var(--ink3); display: block; margin-bottom: 8px;"></i>
            <p>Adım adım yol tarifini görmek için aşağıdaki <strong>Güzergâh Çiz ve Hesapla</strong> butonuna tıklayın.</p>
          </div>`;
        return;
      }

      if (vis.length < 2) {
        container.innerHTML = `
          <div class="empty-state">
            <p>Yol tarifi almak için planınızda en az 2 konum bulunmalıdır.</p>
          </div>`;
        return;
      }

      if (!osrmData) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="width: 24px; height: 24px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom:8px;"></div>
            <p>Yol tarifleri OSRM sunucusundan yükleniyor...</p>
          </div>`;
        return;
      }

      let html = '';
      const legs = osrmData.routes[0].legs;

      legs.forEach((leg, idx) => {
        const fromLoc = vis[idx];
        const toLoc = vis[idx + 1];
        const legDist = (leg.distance / 1000).toFixed(1);
        const legTime = Math.round(leg.duration / 60);
        let durText = legTime > 60 ? `${Math.floor(legTime / 60)} sa ${legTime % 60} dk` : `${legTime} dk`;

        html += `
          <div class="nav-leg">
            <div class="nav-leg-header" onclick="toggleNavLegSteps(${idx})">
              <div class="nav-leg-title">
                <span class="nav-leg-num">${idx + 1}</span>
                <span class="nav-leg-names">${fromLoc.name} ➔ ${toLoc.name}</span>
              </div>
              <div class="nav-leg-summary">
                <span>${legDist} km · ~${durText}</span>
                <i class="ti ti-chevron-down leg-arrow" id="leg-arrow-${idx}"></i>
              </div>
            </div>
            <div class="nav-leg-steps" id="leg-steps-${idx}" style="display:none;">
        `;

        if (leg.steps && leg.steps.length > 0) {
          leg.steps.forEach(step => {
            const trans = parseNavigationStep(step);
            html += `
              <div class="nav-step-item">
                <span class="nav-step-icon"><i class="ti ti-${trans.icon}"></i></span>
                <div class="nav-step-body">
                  <div class="nav-step-text">${trans.action}</div>
                  <div class="nav-step-dist">${trans.dist}</div>
                </div>
              </div>
            `;
          });
        } else {
          html += `<div class="nav-no-steps">Adım adım sürüş tarifi bulunamadı.</div>`;
        }

        html += `
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    function toggleNavLegSteps(idx) {
      const panel = document.getElementById(`leg-steps-${idx}`);
      const arrow = document.getElementById(`leg-arrow-${idx}`);
      if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        arrow.style.transform = 'rotate(-180deg)';
      } else {
        panel.style.display = 'none';
        arrow.style.transform = 'none';
      }
    }

    function parseNavigationStep(step) {
      const type = step.maneuver.type;
      const modifier = step.maneuver.modifier;
      const name = step.name || '';
      const dist = step.distance;

      let action = 'Düz ilerleyin';
      let icon = 'arrow-up';

      if (type === 'depart') { action = 'Yola çıkın'; icon = 'map-pin'; }
      else if (type === 'arrive') { action = 'Hedefe ulaştınız'; icon = 'flag'; }
      else if (type === 'fork') { action = 'Çatal yoldan sapın'; icon = 'git-fork'; }
      else if (type === 'merge') { action = 'Yola katılın'; icon = 'arrows-join'; }
      else if (type === 'roundabout') { action = 'Kavşaktan dönerken'; icon = 'circle-dot'; }
      else if (type === 'turn') {
        let dir = 'yöne';
        if (modifier === 'left') { dir = 'sola'; icon = 'arrow-back-up'; }
        else if (modifier === 'right') { dir = 'sağa'; icon = 'arrow-forward-up'; }
        else if (modifier === 'sharp left') { dir = 'keskin sola'; icon = 'arrow-back-up'; }
        else if (modifier === 'sharp right') { dir = 'keskin sağa'; icon = 'arrow-forward-up'; }
        else if (modifier === 'slight left') { dir = 'hafif sola'; icon = 'arrow-up-left'; }
        else if (modifier === 'slight right') { dir = 'hafif sağa'; icon = 'arrow-up-right'; }
        action = `${dir} dönün`;
      }

      const road = name ? ` (${name})` : '';
      const distStr = dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;

      return {
        action: action + road,
        dist: distStr,
        icon: icon
      };
    }

    function openSplitModal() {
      if (!activeTrip) return;
      document.getElementById('modalSplitDays').classList.add('open');
    }

    function closeSplitModal() {
      document.getElementById('modalSplitDays').classList.remove('open');
    }

    function submitSplitDays() {
      const daysCount = parseInt(document.getElementById('fSplitDayCount').value);
      const activeVis = LOCATIONS.filter(l => l.day !== null);

      if (activeVis.length === 0) {
        showToast('⚠️ Dağıtılacak etkin konum bulunamadı!');
        closeSplitModal();
        return;
      }

      // Distribute evenly among days
      activeVis.forEach((loc, idx) => {
        loc.day = (idx % daysCount) + 1;
      });

      // Update activeDays set
      activeDays.clear();
      for (let i = 1; i <= daysCount; i++) activeDays.add(i);

      if (rotaActive) {
        optimizeAllDaysTSP();
      } else {
        saveTrips();
      }
      closeSplitModal();
      updateRoute();
      showToast(`📅 Gezi ${daysCount} güne dengeli şekilde bölündü.`);
    }

    function openAddModal() {
      if (!activeTrip) return;
      document.getElementById('modalAddLocation').classList.add('open');
      document.getElementById('fName').focus();
    }

    function closeAddModal() {
      document.getElementById('modalAddLocation').classList.remove('open');
      document.getElementById('fName').value = '';
      document.getElementById('fLat').value = '';
      document.getElementById('fLng').value = '';
      document.getElementById('fDesc').value = '';
      document.getElementById('fRating').value = '';
      document.getElementById('fHours').value = '';
      document.getElementById('fTip').value = '';
      document.getElementById('fBulkText').value = '';
      document.querySelectorAll('.form-cat-chip').forEach(c => c.classList.remove('selected'));
      switchAddModalTab('single');
    }

    function switchAddModalTab(type) {
      const tabSingle = document.getElementById('tabBtnSingle');
      const tabBulk = document.getElementById('tabBtnBulk');
      const formSingle = document.getElementById('formSingleLoc');
      const formBulk = document.getElementById('formBulkLoc');

      if (type === 'single') {
        tabSingle.classList.add('active'); tabSingle.style.color = 'var(--ink)';
        tabBulk.classList.remove('active'); tabBulk.style.color = 'var(--ink3)';
        tabSingle.style.borderBottom = '2px solid var(--primary)';
        tabBulk.style.borderBottom = 'none';
        formSingle.style.display = 'block';
        formBulk.style.display = 'none';
        document.getElementById('btnSubmitAddLocation').setAttribute('onclick', 'submitAddLocation()');
      } else {
        tabBulk.classList.add('active'); tabBulk.style.color = 'var(--ink)';
        tabSingle.classList.remove('active'); tabSingle.style.color = 'var(--ink3)';
        tabBulk.style.borderBottom = '2px solid var(--primary)';
        tabSingle.style.borderBottom = 'none';
        formSingle.style.display = 'none';
        formBulk.style.display = 'block';
        document.getElementById('btnSubmitAddLocation').setAttribute('onclick', 'submitBulkLocations()');
      }
    }

    function toggleFormCat(el) {
      el.classList.toggle('selected');
    }

    async function submitAddLocation() {
      const name = document.getElementById('fName').value.trim();
      const lat = parseFloat(document.getElementById('fLat').value);
      const lng = parseFloat(document.getElementById('fLng').value);
      const dayVal = document.getElementById('fDay').value;
      const desc = document.getElementById('fDesc').value.trim();
      const rating = document.getElementById('fRating').value.trim() || null;
      const hours = document.getElementById('fHours').value.trim() || null;
      const tip = document.getElementById('fTip').value.trim() || null;

      if (!name || isNaN(lat) || isNaN(lng)) {
        showToast('⚠️ İsim, enlem ve boylam girilmesi zorunludur!');
        return;
      }

      const selectedCats = [];
      document.querySelectorAll('.form-cat-chip.selected').forEach(c => {
        selectedCats.push(c.dataset.cat);
      });
      if (selectedCats.length === 0) selectedCats.push('oneri');

      const parsedDay = (dayVal === 'null' || !dayVal) ? null : parseInt(dayVal);

      const newLoc = {
        id: nextId++,
        name, lat, lng,
        day: parsedDay,
        cats: selectedCats,
        desc: desc || 'Kullanıcı tarafından eklenen konum.',
        rating, hours, tip,
        region: 'Kullanıcı Konumu',
        userAdded: true
      };

      LOCATIONS.push(newLoc);
      orderedLocs.push(newLoc);

      if (rotaActive) {
        await optimizeAllDaysTSP();
      } else {
        saveTrips();
      }

      closeAddModal();
      updateRoute();
      map.flyTo([lat, lng], 13);
      showToast(`📍 "${name}" plana eklendi!`);
    }

    async function submitBulkLocations() {
      const text = document.getElementById('fBulkText').value.trim();
      if (!text) {
        showToast('⚠️ Lütfen aratılacak konum isimlerini girin!');
        return;
      }

      const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
      if (names.length === 0) return;

      const progressDiv = document.getElementById('bulkProgress');
      const progressText = document.getElementById('bulkProgressText');

      progressDiv.style.display = 'flex';
      let added = 0;

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        progressText.textContent = `"${name}" aranıyor (${i + 1}/${names.length})...`;

        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&countrycodes=tr&limit=1&email=${encodeURIComponent(NOMINATIM_EMAIL)}`;
          const res = await fetch(url);
          const data = await res.json();

          if (data && data.length > 0) {
            const item = data[0];
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);

            let desc = '';
            let wiki = await fetchWikipediaSummary(name.split(',')[0]);
            if (wiki && wiki.summary) desc = wiki.summary;
            else desc = `${item.display_name.split(',').slice(0, 3).join(',')} bölgesinde turistik konum.`;

            const cats = detectCategory(name, desc);
            const newLoc = {
              id: nextId++,
              name: name.split(',')[0].trim(),
              lat, lng,
              day: 1, // Default Day 1
              cats, desc,
              rating: wiki ? '4.5' : null,
              hours: null, tip: null,
              region: item.display_name.split(',')[1]?.trim() || 'Türkiye',
              userAdded: true
            };

            LOCATIONS.push(newLoc);
            orderedLocs.push(newLoc);
            added++;
          }
          // Throttle API requests slightly to avoid rate limit
          await new Promise(r => setTimeout(r, 250));
        } catch (e) {
          console.error(e);
        }
      }

      progressDiv.style.display = 'none';
      closeAddModal();

      if (added > 0) {
        saveTrips();
        updateRoute();
        showToast(`✅ ${added} adet yeni konum bulundu ve plana eklendi!`);
        openSplitModal();
      } else {
        showToast('❌ Girilen konumlar harita üzerinde bulunamadı.');
      }
    }

    async function changeLocationPlanDay(id, dayVal) {
      const loc = LOCATIONS.find(x => x.id === id);
      if (!loc) return;

      const newDay = dayVal === 'null' ? null : parseInt(dayVal);
      loc.day = newDay;

      if (newDay !== null) {
        activeDays.add(newDay);
      }

      if (rotaActive) {
        await optimizeAllDaysTSP();
      } else {
        saveTrips();
      }
      updateRoute();
      showToast(`📍 "${loc.name}" konumu güncellendi.`);
    }

    async function activateLocation(id) {
      const loc = LOCATIONS.find(x => x.id === id);
      if (!loc) return;
      // Add to first available day
      loc.day = activeDays.values().next().value || 1;
      if (rotaActive) {
        await optimizeAllDaysTSP();
      } else {
        saveTrips();
      }
      updateRoute();
      showToast(`📍 "${loc.name}" ${loc.day}. gün rotasına dahil edildi.`);
    }

    async function deactivateLocation(id) {
      const loc = LOCATIONS.find(x => x.id === id);
      if (!loc) return;
      loc.day = null;
      if (selectedId === id) selectedId = null;
      if (rotaActive) {
        await optimizeAllDaysTSP();
      } else {
        saveTrips();
      }
      updateRoute();
      showToast(`🗑️ "${loc.name}" rotadan çıkarıldı, plana dahil değil.`);
    }

    async function deleteLocationPermanently(id) {
      LOCATIONS = LOCATIONS.filter(x => x.id !== id);
      orderedLocs = orderedLocs.filter(x => x.id !== id);
      if (activeTrip) activeTrip.locations = LOCATIONS;

      if (selectedId === id) selectedId = null;
      if (rotaActive) {
        await optimizeAllDaysTSP();
      } else {
        saveTrips();
      }
      updateRoute();
      showToast('🗑️ Konum tamamen silindi.');
    }

    function toggleStartPoint(locId) {
      const loc = LOCATIONS.find(l => l.id === locId);
      if (!loc || loc.day === null) return;

      const targetDay = loc.day;
      const isCurrentlyStart = !!loc.isStartPoint;

      // Clear starting point for all other locations on this day
      LOCATIONS.forEach(l => {
        if (l.day === targetDay) {
          l.isStartPoint = false;
        }
      });

      // Toggle
      loc.isStartPoint = !isCurrentlyStart;

      saveTrips();

      if (rotaActive) {
        optimizeAllDaysTSP().then(() => {
          updateRoute();
        });
      } else {
        updateRoute();
      }

      if (loc.isStartPoint) {
        showToast(`🏠 "${loc.name}" ${targetDay}. günün konaklama / başlangıç noktası olarak ayarlandı.`);
      } else {
        showToast(`🏠 "${loc.name}" başlangıç noktası iptal edildi.`);
      }
    }

    function toggleExportMenu() {
      const menu = document.getElementById('exportMenu');
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }

    function getGoogleMapsRouteUrl() {
      const vis = getVisibleLocations().filter(l => l.day !== null);
      if (vis.length < 2) return '#';
      const origin = `${vis[0].lat},${vis[0].lng}`;
      const dest = `${vis[vis.length - 1].lat},${vis[vis.length - 1].lng}`;

      let waypoints = '';
      if (vis.length > 2) {
        waypoints = vis.slice(1, -1).map(l => `${l.lat},${l.lng}`).join('|');
      }

      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? '&waypoints=' + encodeURIComponent(waypoints) : ''}`;
    }

    function exportRoute(type) {
      document.getElementById('exportMenu').style.display = 'none';
      if (!activeTrip) return;

      if (type === 'json') {
        const dataStr = JSON.stringify(activeTrip, null, 2);
        const blob = new Blob([dataStr], { type: 'application/octet-stream;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = activeTrip.name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]/gi, '_').toLowerCase();
        a.download = `${safeName}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        showToast('💾 Rota planı JSON dosyası indirildi.');
      } else if (type === 'gmaps') {
        const url = getGoogleMapsRouteUrl();
        if (url === '#') {
          showToast('⚠️ Rota oluşturmak için en az 2 konum planlanmış olmalıdır.');
        } else {
          window.open(url, '_blank');
        }
      } else if (type === 'link') {
        // Serialise trip name and locations into URL hash
        const locsData = LOCATIONS.map(l => {
          const nameEsc = encodeURIComponent(l.name);
          const catsStr = l.cats.join('-');
          return `${nameEsc},${l.lat},${l.lng},${l.day === null ? 'null' : l.day},${catsStr}`;
        }).join(';');

        const shareUrl = window.location.origin + window.location.pathname + `#tripName=${encodeURIComponent(activeTrip.name)}&route=${locsData}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('🔗 Rota paylaşım linki panoya kopyalandı!');
        }).catch(() => {
          showToast('⚠️ Paylaşım linki kopyalanamadı.');
        });
      }
    }

    function importTripFromJson(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const importedTrip = JSON.parse(e.target.result);
          
          if (!importedTrip || !importedTrip.name || !Array.isArray(importedTrip.locations)) {
            showToast('⚠️ Geçersiz gezi planı dosyası formatı.');
            return;
          }

          // Generate new unique ID for the imported trip to avoid conflicts
          importedTrip.id = Date.now() + Math.floor(Math.random() * 1000);
          
          // Generate new unique IDs for locations to avoid conflicts
          importedTrip.locations.forEach((loc, idx) => {
            loc.id = Date.now() + idx + Math.floor(Math.random() * 100000);
          });

          trips.push(importedTrip);
          saveTrips();
          renderTripList();
          
          showToast('📥 "' + importedTrip.name + '" başarıyla içe aktarıldı!');
          selectTrip(importedTrip.id);
          
        } catch (err) {
          console.error(err);
          showToast('⚠️ Dosya okunamadı veya JSON formatı hatalı.');
        } finally {
          event.target.value = ''; // Reset input
        }
      };
      
      reader.readAsText(file);
    }

    function exportAllTrips() {
      if (!trips || trips.length === 0) {
        showToast('⚠️ Dışa aktarılacak plan bulunamadı.');
        return;
      }
      
      const dataStr = JSON.stringify(trips, null, 2);
      // 'application/octet-stream' forces the browser to download it as a file with the exact name given
      const blob = new Blob([dataStr], { type: 'application/octet-stream;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rotagram_tum_planlar.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      showToast('💾 Tüm planlar JSON olarak indirildi.');
    }

    function importAllTripsFromJson(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const importedData = JSON.parse(e.target.result);
          
          let tripsToImport = [];
          if (Array.isArray(importedData)) {
            tripsToImport = importedData;
          } else if (importedData && importedData.name && Array.isArray(importedData.locations)) {
            tripsToImport = [importedData];
          } else {
            showToast('⚠️ Geçersiz dosya formatı.');
            return;
          }

          let addedCount = 0;
          tripsToImport.forEach(importedTrip => {
            if (importedTrip && importedTrip.name && Array.isArray(importedTrip.locations)) {
              // Generate new unique ID
              importedTrip.id = Date.now() + Math.floor(Math.random() * 1000) + addedCount;
              
              importedTrip.locations.forEach((loc, idx) => {
                loc.id = Date.now() + idx + Math.floor(Math.random() * 100000);
              });
              
              trips.push(importedTrip);
              addedCount++;
            }
          });

          if (addedCount > 0) {
            saveTrips();
            renderTripList();
            if (typeof renderFriendsView === 'function') renderFriendsView();
            showToast('📥 ' + addedCount + ' plan başarıyla içe aktarıldı!');
          } else {
            showToast('⚠️ Dosya içinde geçerli plan bulunamadı.');
          }
        } catch (err) {
          console.error(err);
          showToast('⚠️ Dosya okunamadı veya JSON formatı hatalı.');
        } finally {
          event.target.value = ''; // Reset input
        }
      };
      
      reader.readAsText(file);
    }

    function loadSharedTripFromUrl() {
      const hash = window.location.hash;
      if (!hash) return;

      const params = new URLSearchParams(hash.substring(1));
      const tripName = params.get('tripName');
      const routeData = params.get('route');

      if (routeData) {
        try {
          const parsedLocs = routeData.split(';').map((str, idx) => {
            const [name, latStr, lngStr, dayStr, catsStr] = str.split(',');
            return {
              id: 3000 + idx,
              name: decodeURIComponent(name),
              lat: parseFloat(latStr),
              lng: parseFloat(lngStr),
              day: dayStr === 'null' ? null : parseInt(dayStr),
              cats: catsStr.split('-'),
              desc: 'Paylaşılan gezi noktası.',
              region: 'Paylaşılan Konum',
              userAdded: true
            };
          });

          if (parsedLocs.length > 0) {
            const newTripName = tripName ? decodeURIComponent(tripName) : 'Paylaşılan Rota Planı 🔗';
            const newTrip = {
              id: Date.now(),
              name: newTripName,
              createdAt: new Date().toISOString(),
              locations: parsedLocs
            };

            trips.push(newTrip);
            saveTrips();

            // Clean URL hash
            window.history.replaceState("", document.title, window.location.pathname);

            selectTrip(newTrip.id);
            showToast('ℹ️ Paylaşılan seyahat planı başarıyla yüklendi!');
          }
        } catch (e) {
          console.error('Paylaşılan rota yüklenemedi:', e);
        }
      }
    }

    function toggleCat(cat, el) {
      if (activeCats.has(cat)) activeCats.delete(cat); else activeCats.add(cat);
      el.classList.toggle('on', activeCats.has(cat));
      el.classList.toggle('off', !activeCats.has(cat));

      closeLocationDetail();
      updateRoute();
    }

    let toastTimeout = null;
    function showToast(msg) {
      const t = document.getElementById('toast');
      document.getElementById('toastText').innerHTML = msg;
      t.classList.add('show');
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => t.classList.remove('show'), 4000);
    }

    function toggleMobileSidebar() {
      const sb = document.getElementById('sidebar');
      const btn = document.getElementById('mobileToggle');
      sb.classList.toggle('expanded');

      if (sb.classList.contains('expanded')) {
        btn.innerHTML = '<i class="ti ti-map"></i> Haritayı Göster';
      } else {
        btn.innerHTML = '<i class="ti ti-list"></i> Liste Görünümü';
      }
      setTimeout(() => map.invalidateSize(), 300);
    }

    function renderTripList() {
      const grid = document.getElementById('tripsGrid');
      grid.innerHTML = '';

      if (trips.length === 0) {
        grid.innerHTML = `
          <div class="trip-card add-trip-card" onclick="openCreateTripModal()" style="border: 2px dashed var(--primary-light); background: var(--primary-bg); justify-content: center; align-items: center; padding: 24px; min-height: 100px; display: flex; flex-direction: column; gap: 8px; box-shadow: none;">
            <i class="ti ti-plus" style="font-size: 32px; color: var(--primary); pointer-events: none;"></i>
            <span style="font-size: 14px; font-weight: 600; color: var(--primary); pointer-events: none;">Yeni Gezi Planı Oluştur</span>
          </div>
          <div class="trips-empty-state" style="margin-top: 20px; text-align: center; width: 100%; padding: 0 10px;">
            <p style="font-size: 13.5px; color: var(--ink2); line-height: 1.5;">Kayıtlı bir gezi planınız bulunmamaktadır. Yukarıdaki karttan yeni bir plan oluşturarak başlayabilirsiniz.</p>
          </div>
        `;
        return;
      }

      trips.forEach(t => {
        const card = document.createElement('div');
        card.className = 'trip-card';
        if (typeof lastAddedTripId !== 'undefined' && lastAddedTripId === t.id) {
          card.classList.add('new-card');
          lastAddedTripId = null;
        }
        card.onclick = () => selectTrip(t.id);

        const count = t.locations.filter(l => l.day !== null).length;
        const date = new Date(t.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

        card.innerHTML = `
          <div class="trip-card-details">
            <div class="trip-card-name">${t.name}</div>
            <div class="trip-card-meta">
              <span><i class="ti ti-map-pin"></i> ${count} konum</span>
              <span><i class="ti ti-calendar"></i> ${date}</span>
            </div>
          </div>
          <div class="trip-card-actions" onclick="event.stopPropagation()">
            <button class="trip-card-btn delete-trip-btn" onclick="deleteTrip(${t.id})" title="Geziyi Sil"><i class="ti ti-trash"></i></button>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    function updateHeaderControls() {
      const headerControls = document.getElementById('headerControls');
      const headerTripSelect = document.getElementById('headerTripSelect');
      const headerDaySelect = document.getElementById('headerDaySelect');
      const headerDayWrapper = document.getElementById('headerDayWrapper');

      if (!headerControls || !headerTripSelect || !headerDaySelect || !headerDayWrapper) return;

      if (trips.length === 0) {
        headerControls.style.display = 'none';
        return;
      }

      headerControls.style.display = 'flex';

      // Populate trips
      headerTripSelect.innerHTML = '';
      trips.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (activeTrip && activeTrip.id === t.id) {
          opt.selected = true;
        }
        headerTripSelect.appendChild(opt);
      });

      if (!activeTrip) {
        headerDayWrapper.style.display = 'none';
        return;
      }

      headerDayWrapper.style.display = 'flex';

      // Populate days
      headerDaySelect.innerHTML = '';

      const optAll = document.createElement('option');
      optAll.value = 'all';
      optAll.textContent = 'Tüm Günler';
      if (selectedDayFilter === 'all') optAll.selected = true;
      headerDaySelect.appendChild(optAll);

      // Gather days from duration
      const sortedDays = [];
      const duration = activeTrip.duration || 3;
      for (let i = 1; i <= duration; i++) {
        sortedDays.push(i);
      }
      sortedDays.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d}. Gün`;
        if (selectedDayFilter == d) opt.selected = true;
        headerDaySelect.appendChild(opt);
      });

      const hasAlt = activeTrip.locations.some(l => l.day === null);
      if (hasAlt) {
        const optNull = document.createElement('option');
        optNull.value = 'null';
        optNull.textContent = 'Plan Dışı';
        if (selectedDayFilter === 'null') optNull.selected = true;
        headerDaySelect.appendChild(optNull);
      }

      headerDaySelect.value = selectedDayFilter;
    }

    function changeHeaderDayFilter(dayVal) {
      if (dayVal === 'all') {
        selectedDayFilter = 'all';
      } else if (dayVal === 'null') {
        selectedDayFilter = 'null';
      } else {
        selectedDayFilter = parseInt(dayVal);
      }

      renderDayFilterChips();
      updateMapDayFilter();
      updateRoute();
      if (activeAppTab === 'map') {
        fitMapToVisible();
      }

      const headerSelect = document.getElementById('headerDaySelect');
      if (headerSelect) {
        headerSelect.value = dayVal;
      }
    }

    function toggleMapLayerMenu(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('mapLayerMenu');
      if (menu) {
        menu.classList.toggle('open');
      }
    }

/* Application initialization and bindings */

    /* ═══════════════════════════════════════════
       APP VIEWS ROUTING / NAVIGATION (5 TABS)
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       TRIP MANAGEMENT (CRUD)
       ═══════════════════════════════════════════ */

    document.getElementById('btnDeleteActiveTrip').addEventListener('click', () => {
      if (activeTrip) deleteTrip(activeTrip.id);
    });

    /* ═══════════════════════════════════════════
       SMART ROUTING & SPATIAL OPTIMIZATION ALGORITHMS
       ═══════════════════════════════════════════ */

    let pendingOptimizationAllowClustering = false;

    /* ═══════════════════════════════════════════
       DAY FILTER UI UTILITIES
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       MAP INITIALIZATION & CONTROLS
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       OSRM ROUTING SERVICE
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       MAP TOP BAR — Day filter & Plan selector
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       GEOLOCATION & WEATHER INTEGRATION
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       SMART GEOGRAPHIC RECOMMENDATION SYSTEM
       ═══════════════════════════════════════════ */

    let tempRecMarker = null;

    /* ═══════════════════════════════════════════
       ADD TO TRIP AND DAY SELECTOR MODAL FLOW
       ═══════════════════════════════════════════ */
    let pendingLocationToAddToTrip = null;

    /* ═══════════════════════════════════════════
       MAP CLICK PINNING & COORDINATE UTILS
       ═══════════════════════════════════════════ */
    let pinningSourceView = null;

    /* ═══════════════════════════════════════════
       CLIENT AUTHENTICATION & CLOUD DATABASE SYNC
       ═══════════════════════════════════════════ */

    let tokenClient = null;
    let googleAccessToken = null;

    /* ═══════════════════════════════════════════
       TAB SWITCHING
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       DRAG AND DROP HANDLERS (LIST REORDERING)
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       INTERACTIVE MAP MARKERS GENERATION
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       STATE SELECTION AND DETAIL UI
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       PLANNER SIDEBAR RENDERING (TAB 1: LIST)
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       PLANNER SIDEBAR RENDERING (TAB 2: TIMELINE)
       ═══════════════════════════════════════════ */
    let collapsedDays = new Set();

    /* ═══════════════════════════════════════════
       PLANNER SIDEBAR RENDERING (TAB 3: DIRECTIONS)
       ═══════════════════════════════════════════ */

    /* ═══════════════════════════════════════════
       SIDEBAR ACTIONS & MODALS FOR ACTIVE TRIP
       ═══════════════════════════════════════════ */

    // 1. Rename Day split modal triggers

    // 2. Add custom location modal triggers

    // 3. Location settings actions

    /* ═══════════════════════════════════════════
       EXPORT MENU & FUNCTIONS
       ═══════════════════════════════════════════ */

    document.addEventListener('click', (e) => {
      const btn = document.getElementById('exportBtn');
      const menu = document.getElementById('exportMenu');
      if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });

    /* ═══════════════════════════════════════════
       URL SHARED PLAN PARSING ON LOAD
       ═══════════════════════════════════════════ */

    // Modal background click to close
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) {
          m.classList.remove('open');
          // If bulk add modal is closed, clear inputs
          if (m.id === 'modalAddLocation') closeAddModal();
        }
      });
    });

    // Mobile Sidebar Drawer Toggles

    // renderTripList updates the list of user plans in the sidebar

    /* ═══════════════════════════════════════════
       PAGE SETUP & WINDOW INITIAL LOAD
       ═══════════════════════════════════════════ */
    window.addEventListener('DOMContentLoaded', () => {
      initMap();
      trackUserLocation();
      loadTrips();
      loadSharedTripFromUrl();

      // Lazy init Google Auth if loaded
      setTimeout(() => {
        if (typeof google !== 'undefined') {
          initGoogleAuth();
        }
      }, 1500);

      // Bind Search Tab Autocomplete input
      const searchTabInput = document.getElementById('searchTabInput');
      const searchTabClear = document.getElementById('searchTabClear');
      if (searchTabInput) {
        searchTabInput.addEventListener('input', (e) => {
          const query = e.target.value.trim();
          if (searchTabClear) searchTabClear.style.display = query ? 'block' : 'none';
          clearTimeout(searchTimeout);
          if (!query) {
            document.getElementById('searchTabResults').innerHTML = '';
            document.getElementById('searchTabResults').classList.remove('active');
            return;
          }
          searchTimeout = setTimeout(() => {
            triggerGeocoding(query, 'searchTab');
          }, 400);
        });
      }

      // Bind Active Trip Search Autocomplete input
      const tripSearchInput = document.getElementById('tripSearchInput');
      const tripSearchClear = document.getElementById('tripSearchClear');
      if (tripSearchInput) {
        tripSearchInput.addEventListener('input', (e) => {
          const query = e.target.value.trim();
          if (tripSearchClear) tripSearchClear.style.display = query ? 'block' : 'none';
          clearTimeout(searchTimeout);
          if (!query) {
            document.getElementById('tripSearchResults').innerHTML = '';
            document.getElementById('tripSearchResults').classList.remove('active');
            return;
          }
          searchTimeout = setTimeout(() => {
            triggerGeocoding(query, 'trip');
          }, 400);
        });
      }

      // Auto-close search results when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-section')) {
          const res = document.getElementById('searchTabResults');
          if (res) res.classList.remove('active');
        }
        if (!e.target.closest('.trip-search-section')) {
          const res = document.getElementById('tripSearchResults');
          if (res) res.classList.remove('active');
        }
        const layerWrapper = document.getElementById('mapLayerControlWrapper');
        const layerMenu = document.getElementById('mapLayerMenu');
        if (layerWrapper && layerMenu && !layerWrapper.contains(e.target)) {
          layerMenu.classList.remove('open');
        }
      });

      // Responsive check for filter boxes
      if (window.innerWidth <= 768) {
        const filters = document.getElementById('combinedFilters');
        if (filters) {
          filters.style.display = 'none';
          filters.style.maxHeight = '0px';
          filters.style.opacity = '0';
        }
        const btn = document.getElementById('btnToggleFilters');
        if (btn) btn.classList.remove('active');
      }

      // Disable splash screen
      const splash = document.getElementById('splash');
      if (splash) splash.classList.add('hide');
    });
function startMapPinning() {
  mapPinningActive = true;
  map.getContainer().style.cursor = 'crosshair';
  showToast('📍 Lütfen haritada eklemek istediğiniz konuma tıklayın.');
  pinningSourceView = activeAppTab;
  switchAppView('map');
}
async function onMapPinClick(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  map.getContainer().style.cursor = '';
  mapPinningActive = false;
  showToast('🔍 Seçilen koordinatlar çözümleniyor...');
  let cleanName = 'Seçilen Konum';
  let fullName = 'Haritadan seçilen koordinatlar.';
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${lat},${lng}&limit=1&email=${encodeURIComponent(NOMINATIM_EMAIL)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
      fullName = data[0].display_name;
      cleanName = data[0].name || fullName.split(',')[0];
    }
  } catch (err) {
    console.warn(err);
  }
  const confirmAdd = confirm(`"${cleanName}" konumunu seyahat planına eklemek istiyor musunuz?`);
  if (confirmAdd) {
    const tempLocationData = {
      name: cleanName,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      cats: ['oneri'],
      desc: fullName,
      rating: null,
      region: fullName.split(',')[1]?.trim() || 'Türkiye',
      userAdded: true
    };
    openAddToTripAndDayModal(tempLocationData);
  }
  if (pinningSourceView) {
    switchAppView(pinningSourceView);
  }
}