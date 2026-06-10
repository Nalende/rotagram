/* Rotagram Leaflet Maps, Routing, and TSP Solvers */
    function estimateTrafficFactor(lat, lng) {
      const hour = new Date().getHours();
      let baseFactor = 1.05; // base highway/rural traffic

      const isRushHour = ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19));

      // Determine urban density based on average distance between active locations
      let isUrban = false;
      const activeLocs = LOCATIONS.filter(l => l.day !== null);
      if (activeLocs.length >= 2) {
        let totalPairDist = 0;
        let countPairs = 0;
        for (let i = 0; i < activeLocs.length; i++) {
          for (let j = i + 1; j < activeLocs.length; j++) {
            totalPairDist += calculateDistance(activeLocs[i], activeLocs[j]);
            countPairs++;
          }
        }
        const avgPairDist = totalPairDist / countPairs;
        if (avgPairDist < 8.0) {
          isUrban = true;
        }
      }

      if (isUrban) {
        if (isRushHour) {
          baseFactor = 1.5; // High city rush hour traffic
        } else {
          baseFactor = 1.25; // Moderate daytime city traffic
        }
      } else {
        if (isRushHour) {
          baseFactor = 1.25; // Moderate highway traffic
        } else {
          baseFactor = 1.08; // Fluid highway traffic
        }
      }
      return baseFactor;
    }

    function getLocationVisitDuration(loc) {
      if (loc.visitDuration) return loc.visitDuration;
      const mainCat = (loc.cats && loc.cats[0]) ? loc.cats[0] : 'oneri';

      if (mainCat === 'tarih') return 120;   // 2 hours
      if (mainCat === 'deniz') return 180;   // 3 hours
      if (mainCat === 'kultur') return 90;    // 1.5 hours
      if (mainCat === 'gastro') return 60;   // 1 hour
      if (mainCat === 'manzara') return 45;  // 45 mins
      return 60; // 1 hour default
    }

    function isNightActivity(loc) {
      const text = (loc.name + " " + (loc.desc || "")).toLowerCase();
      return text.match(/(gece kulübü|bar|pub|gece kulubu|night club|disko|disco|meyhane|konser|parti|bira|şarap)/i) !== null;
    }

    async function fetchOSRMDistanceMatrix(locations) {
      if (locations.length < 2) return null;
      const coordsStr = locations.map(l => `${l.lng},${l.lat}`).join(';');
      const url = `https://router.project-osrm.org/table/v1/driving/${coordsStr}?annotations=distance`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM Table API hatası');
        const data = await res.json();
        if (data.code === 'Ok' && data.distances) {
          return data.distances;
        }
      } catch (err) {
        console.warn('OSRM mesafe matrisi alınamadı:', err);
      }
      return null;
    }

    function solveTSP(locations, distanceMatrix = null) {
      if (locations.length <= 2) return [...locations];
      const n = locations.length;

      const getDist = (i, j) => {
        if (distanceMatrix && distanceMatrix[i] !== undefined && distanceMatrix[i][j] !== undefined && distanceMatrix[i][j] !== null) {
          return distanceMatrix[i][j];
        }
        return calculateDistance(locations[i], locations[j]);
      };

      let bestIndices = [];
      let minDist = Infinity;

      // Look for a designated starting point (hotel / accommodation)
      const startIndex = locations.findIndex(l => l.isStartPoint);

      if (n <= 8) {
        // Exact solution via permutations
        const indices = Array.from({ length: n }, (_, i) => i);

        function permute(arr, memo = []) {
          if (arr.length === 0) {
            let total = 0;
            for (let i = 0; i < memo.length - 1; i++) {
              total += getDist(memo[i], memo[i + 1]);
            }
            if (total < minDist) {
              minDist = total;
              bestIndices = [...memo];
            }
          } else {
            for (let i = 0; i < arr.length; i++) {
              let curr = arr.slice();
              let next = curr.splice(i, 1);
              permute(curr, memo.concat(next));
            }
          }
        }

        if (startIndex !== -1) {
          // If start index is fixed, start permutation with startIndex, only permute remaining indices
          const unvisited = indices.filter(idx => idx !== startIndex);
          permute(unvisited, [startIndex]);
        } else {
          permute(indices);
        }
      } else {
        // Heuristic Nearest-Neighbor
        const runNearestNeighbor = (startIdx) => {
          let path = [startIdx];
          let unvisited = Array.from({ length: n }, (_, i) => i).filter(idx => idx !== startIdx);

          while (unvisited.length > 0) {
            let last = path[path.length - 1];
            let nearestIdx = 0;
            let nearestDist = Infinity;
            for (let i = 0; i < unvisited.length; i++) {
              let d = getDist(last, unvisited[i]);
              if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
              }
            }
            path.push(unvisited[nearestIdx]);
            unvisited.splice(nearestIdx, 1);
          }

          let total = 0;
          for (let i = 0; i < path.length - 1; i++) {
            total += getDist(path[i], path[i + 1]);
          }
          if (total < minDist) {
            minDist = total;
            bestIndices = path;
          }
        };

        if (startIndex !== -1) {
          // Only start NN search from the selected starting point
          runNearestNeighbor(startIndex);
        } else {
          // Fallback to Multi-Start NN starting from all nodes
          for (let startIdx = 0; startIdx < n; startIdx++) {
            runNearestNeighbor(startIdx);
          }
        }
      }

      return bestIndices.length > 0 ? bestIndices.map(idx => locations[idx]) : [...locations];
    }

    function clusterLocationsIntoDays() {
      const allActiveLocs = activeTrip.locations.filter(l => l.day !== null);
      const nightLocs = allActiveLocs.filter(isNightActivity);
      const dayLocs = allActiveLocs.filter(l => !isNightActivity(l));

      if (dayLocs.length === 0) return;

      let unassigned = [...dayLocs];
      let days = [];
      let currentDayIndex = 0;

      while (unassigned.length > 0) {
        if (!days[currentDayIndex]) {
          days[currentDayIndex] = [];
        }

        let currentCluster = days[currentDayIndex];

        if (currentCluster.length === 0) {
          const seed = unassigned.shift();
          currentCluster.push(seed);
        } else {
          const lastLoc = currentCluster[currentCluster.length - 1];
          let bestIdx = -1;
          let minDist = Infinity;

          for (let i = 0; i < unassigned.length; i++) {
            const d = calculateDistance(lastLoc, unassigned[i]);
            if (d < minDist) {
              minDist = d;
              bestIdx = i;
            }
          }

          if (bestIdx !== -1) {
            const candidate = unassigned[bestIdx];
            const testPath = [...currentCluster, candidate];
            const tspSorted = solveTSP(testPath);

            const totalVisitMin = tspSorted.reduce((sum, loc) => sum + getLocationVisitDuration(loc), 0);

            let totalTravelMin = 0;
            for (let i = 0; i < tspSorted.length - 1; i++) {
              const d = calculateDistance(tspSorted[i], tspSorted[i + 1]);
              totalTravelMin += (d * 1.2) + 10;
            }

            const totalDayMin = totalVisitMin + totalTravelMin;

            if (totalDayMin <= 720) {
              currentCluster.push(candidate);
              unassigned.splice(bestIdx, 1);
            } else {
              currentDayIndex++;
            }
          } else {
            break;
          }
        }
      }

      // Assign night locations to their spatially closest day
      nightLocs.forEach(nLoc => {
        let nearestDayIdx = 0;
        let minDistanceToDay = Infinity;

        days.forEach((dayClust, dIdx) => {
          dayClust.forEach(dLoc => {
            const dist = calculateDistance(nLoc, dLoc);
            if (dist < minDistanceToDay) {
              minDistanceToDay = dist;
              nearestDayIdx = dIdx;
            }
          });
        });

        if (!days[nearestDayIdx]) days[nearestDayIdx] = [];
        days[nearestDayIdx].push(nLoc);
      });

      let exceededDays = false;
      days.forEach((cluster, dIdx) => {
        const targetDay = dIdx + 1;
        if (targetDay > 7) exceededDays = true;
        cluster.forEach(loc => {
          const original = activeTrip.locations.find(l => l.id === loc.id);
          if (original) {
            original.day = targetDay > 7 ? null : targetDay;
          }
        });
      });

      if (exceededDays) {
        showToast('⚠️ Seyahat 7 günü aşamayacağı için bazı konumlar alternatif (Plan Dışı) olarak işaretlendi.');
      }
      saveTrips();
    }

    async function optimizeAllDaysTSP() {
      const allLocs = activeTrip.locations;
      let finalLocations = [];

      for (let d = 1; d <= 7; d++) {
        const dayLocs = allLocs.filter(l => l.day === d);
        if (dayLocs.length === 0) continue;

        const matrix = await fetchOSRMDistanceMatrix(dayLocs);
        const sortedDayLocs = solveTSP(dayLocs, matrix);

        finalLocations = finalLocations.concat(sortedDayLocs);
      }

      const alternativeLocs = allLocs.filter(l => l.day === null);
      finalLocations = finalLocations.concat(alternativeLocs);

      activeTrip.locations = finalLocations;
      saveTrips();

      LOCATIONS = activeTrip.locations;
      orderedLocs = [...LOCATIONS];
    }

    function initMap() {
      // Map configuration
      map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([39.0, 35.0], 6); // Default Turkey center

      // Define Leaflet Tile layers
      mapLayers = {
        voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
        terrain: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
        dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 })
      };

      // Set default
      currentTileLayer = mapLayers.voyager;
      currentTileLayer.addTo(map);

      // Position zoom controls in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);

      // Map click handler to clear selected item details
      map.on('click', (e) => {
        if (typeof mapPinningActive !== 'undefined' && mapPinningActive) {
          if (typeof onMapPinClick === 'function') {
            onMapPinClick(e);
            return;
          }
        }
        if (e.originalEvent.target.id === 'map' || e.originalEvent.target.classList.contains('leaflet-container')) {
          closeLocationDetail();
        }
      });
    }

    function changeMapStyle(styleName) {
      if (!mapLayers[styleName]) return;
      map.removeLayer(currentTileLayer);
      currentTileLayer = mapLayers[styleName];
      currentTileLayer.addTo(map);

      document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layer === styleName);
      });

      const menu = document.getElementById('mapLayerMenu');
      if (menu) menu.classList.remove('open');
    }

    function fitMapToVisible() {
      const vis = getVisibleLocations();
      if (vis.length > 0) {
        const bounds = L.latLngBounds(vis.map(l => [l.lat, l.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 0.6 });
      }
    }

    async function fetchOSRMSingleLeg(loc1, loc2) {
      const dist = calculateDistance(loc1, loc2);
      const profile = dist <= 2.0 ? 'foot' : 'driving';
      const coordsStr = `${loc1.lng},${loc1.lat};${loc2.lng},${loc2.lat}`;
      const cacheKey = `${coordsStr};${profile}`;
      if (osrmCache.has(cacheKey)) {
        return osrmCache.get(cacheKey);
      }

      const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=true`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM API error for ${profile}`);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          osrmCache.set(cacheKey, data);
          return data;
        }
      } catch (err) {
        console.warn(`Error fetching OSRM leg (${profile}):`, err);
      }
      return null;
    }

    async function fetchOSRMRoute(locations) {
      if (locations.length < 2) return null;
      
      const combinedRoute = {
        geometry: {
          type: "LineString",
          coordinates: []
        },
        legs: [],
        distance: 0,
        duration: 0
      };

      for (let i = 0; i < locations.length - 1; i++) {
        const loc1 = locations[i];
        const loc2 = locations[i + 1];
        const legData = await fetchOSRMSingleLeg(loc1, loc2);
        
        if (!legData || !legData.routes || legData.routes.length === 0) {
          return null;
        }

        const route = legData.routes[0];
        const leg = route.legs[0];

        // Accumulate distance and duration
        combinedRoute.distance += route.distance;
        combinedRoute.duration += route.duration;

        // Push the leg
        combinedRoute.legs.push(leg);

        // Concatenate geometry coordinates
        const coords = route.geometry.coordinates;
        if (combinedRoute.geometry.coordinates.length === 0) {
          combinedRoute.geometry.coordinates.push(...coords);
        } else {
          // Skip first coordinate to avoid duplicating endpoint
          combinedRoute.geometry.coordinates.push(...coords.slice(1));
        }
      }

      return {
        code: "Ok",
        routes: [combinedRoute]
      };
    }

    async function updateRoute() {
      const vis = getVisibleLocations().filter(l => l.day !== null);

      // Group locations by day
      const daysMap = {};
      vis.forEach(l => {
        if (!daysMap[l.day]) daysMap[l.day] = [];
        daysMap[l.day].push(l);
      });

      const activeDays = Object.keys(daysMap).map(Number).sort((a, b) => a - b);

      if (rotaActive && activeDays.length > 0) {
        document.getElementById('rsTotalDist').textContent = 'Hesaplanıyor...';
        document.getElementById('rsTotalTime').textContent = '';

        let totalDistMeter = 0;
        let totalDurationSec = 0;
        let routeErrors = [];

        for (const dayNum of activeDays) {
          const dayLocs = daysMap[dayNum];
          if (dayLocs.length < 2) {
            delete osrmDaysData[dayNum];
            delete activeRouteCoordsByDay[dayNum];
            continue;
          }

          const coordsStr = dayLocs.map(l => `${l.lng},${l.lat}`).join(';');

          if (activeRouteCoordsByDay[dayNum] !== coordsStr) {
            activeRouteCoordsByDay[dayNum] = coordsStr;
            try {
              const data = await fetchOSRMRoute(dayLocs);
              osrmDaysData[dayNum] = data;
            } catch (e) {
              console.error(`OSRM Day ${dayNum} hatası:`, e);
              osrmDaysData[dayNum] = null;
              routeErrors.push(dayNum);
            }
          }

          const dayData = osrmDaysData[dayNum];
          if (dayData && dayData.routes && dayData.routes[0]) {
            totalDistMeter += dayData.routes[0].distance;
            totalDurationSec += dayData.routes[0].duration;
          }
        }

        if (totalDistMeter > 0) {
          const distKm = (totalDistMeter / 1000).toFixed(1);
          const baseDurationMin = Math.round(totalDurationSec / 60);

          // Calculate traffic factor globally based on coordinates density
          let trafficFactor = 1.05;
          if (vis.length > 0) {
            const avgLat = vis.reduce((sum, l) => sum + l.lat, 0) / vis.length;
            const avgLng = vis.reduce((sum, l) => sum + l.lng, 0) / vis.length;
            trafficFactor = estimateTrafficFactor(avgLat, avgLng);
          }

          const durMin = Math.round(baseDurationMin * trafficFactor);
          let durText = durMin > 60 ? `${Math.floor(durMin / 60)} sa ${durMin % 60} dk` : `${durMin} dk`;

          let trafficText = "";
          if (trafficFactor >= 1.45) {
            trafficText = " <span style='color:#FF7675; font-weight:700;'><i class='ti ti-traffic-lights'></i> Yoğun Trafik</span>";
          } else if (trafficFactor >= 1.2) {
            trafficText = " <span style='color:#FFEAA7; font-weight:700;'><i class='ti ti-traffic-lights'></i> Orta Yoğunluk</span>";
          } else {
            trafficText = " <span style='color:#55EFC4; font-weight:700;'><i class='ti ti-circle-check'></i> Trafik Akıcı</span>";
          }

          document.getElementById('rsTotalDist').textContent = distKm + ' km';
          document.getElementById('rsTotalTime').innerHTML = `~${durText}${trafficText}`;
          document.getElementById('rsTotalStops').textContent = vis.length + ' durak';
          document.getElementById('routeSummary').classList.add('show');

          // Sync with trip stats
          document.getElementById('statDist').textContent = distKm + ' km';
          document.getElementById('statDuration').textContent = durText;
        } else if (vis.length === 1) {
          document.getElementById('rsTotalDist').textContent = '0 km';
          document.getElementById('rsTotalTime').innerHTML = `~0 dk <span style='color:#55EFC4; font-weight:700;'><i class='ti ti-circle-check'></i> Tek Durak</span>`;
          document.getElementById('rsTotalStops').textContent = '1 durak';
          document.getElementById('routeSummary').classList.add('show');

          document.getElementById('statDist').textContent = '0 km';
          document.getElementById('statDuration').textContent = 'Tek Durak';
        } else {
          document.getElementById('rsTotalDist').textContent = 'Hata';
          document.getElementById('rsTotalTime').textContent = 'Yol verisi alınamıyor';
          document.getElementById('rsTotalStops').textContent = vis.length + ' durak';
          document.getElementById('routeSummary').classList.add('show');

          document.getElementById('statDist').textContent = '— km';
          document.getElementById('statDuration').textContent = '— dk';

          if (routeErrors.length > 0) {
            showToast('⚠️ OSRM API hatası: Yol tarifi hesaplanamıyor.');
          }
        }
      } else {
        osrmDaysData = {};
        activeRouteCoordsByDay = {};
        document.getElementById('routeSummary').classList.remove('show');
        document.getElementById('statDist').textContent = '— km';
        document.getElementById('statDuration').textContent = '— dk';
      }

      if (rotaActive && activeDays.length > 0) {
        const dayKey = (selectedDayFilter === 'all') ? activeDays[0] : selectedDayFilter;
        osrmData = osrmDaysData[dayKey] || null;
      } else {
        osrmData = null;
      }

      renderMarkers();
      renderRouteLines();
      renderList();
    }

    function toggleRouteDrawing() {
      if (!activeTrip || LOCATIONS.filter(l => l.day !== null).length < 2) {
        showToast('⚠️ Güzergâh çizmek için en az 2 aktif planlı konuma sahip olmalısınız!');
        return;
      }

      rotaActive = !rotaActive;
      const btn = document.getElementById('btnRouteToggle');
      btn.classList.toggle('active', rotaActive);

      if (rotaActive) {
        btn.innerHTML = '<i class="ti ti-route-off"></i> Güzergâhı Kapat';
        openOptimizeChoiceModal();
        // Auto navigate to map tab on mobile after route is drawn
        if (window.innerWidth <= 768) {
          setTimeout(() => switchAppView('map'), 400);
        }
      } else {
        btn.innerHTML = '<i class="ti ti-route"></i> Güzergâh Çiz ve Hesapla';
        updateRoute();
      }
    }

    function updateMapTopBar() {
      updateMapDayFilter();
      updateMapPlanSelector();
    }

    function updateMapDayFilter() {
      const container = document.getElementById('mapDayFilter');
      if (!container) return;
      container.innerHTML = '';

      // All days button
      const allBtn = document.createElement('button');
      allBtn.className = 'map-day-btn' + (selectedDayFilter === 'all' ? ' active' : '');
      allBtn.textContent = 'Tüm Günler';
      allBtn.onclick = () => { selectedDayFilter = 'all'; updateMapDayFilter(); renderDayFilterChips(); updateRoute(); fitMapToVisible(); };
      container.appendChild(allBtn);

      if (!activeTrip) return;

      // Unique days
      const days = new Set();
      LOCATIONS.forEach(l => { if (l.day !== null) days.add(l.day); });
      const sortedDays = Array.from(days).sort((a, b) => a - b);

      sortedDays.forEach(d => {
        const btn = document.createElement('button');
        const dayColor = DAYS[d] || '#6C5CE7';
        btn.className = 'map-day-btn' + (selectedDayFilter == d ? ' active' : '');
        btn.style.cssText = selectedDayFilter == d ? '' : `border: 2px solid ${dayColor};`;
        btn.textContent = d + '. Gün';
        btn.onclick = () => {
          selectedDayFilter = d;
          updateMapDayFilter();
          renderDayFilterChips();
          updateRoute();
          fitMapToVisible();
        };
        container.appendChild(btn);
      });

      // Alternative
      const hasAlt = LOCATIONS.some(l => l.day === null);
      if (hasAlt) {
        const altBtn = document.createElement('button');
        altBtn.className = 'map-day-btn' + (selectedDayFilter === 'null' ? ' active' : '');
        altBtn.textContent = 'Plan Dışı';
        altBtn.onclick = () => { selectedDayFilter = 'null'; updateMapDayFilter(); renderDayFilterChips(); updateRoute(); };
        container.appendChild(altBtn);
      }

      const headerSelect = document.getElementById('headerDaySelect');
      if (headerSelect) {
        headerSelect.value = selectedDayFilter;
      }
    }

    function updateMapPlanSelector() {
      const select = document.getElementById('mapPlanSelect');
      const row = document.getElementById('mapPlanRow');
      if (!select || !row) return;

      select.innerHTML = '';
      if (trips.length <= 1) {
        row.style.display = 'none';
        return;
      }
      row.style.display = 'flex';
      trips.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (activeTrip && activeTrip.id === t.id) opt.selected = true;
        select.appendChild(opt);
      });
    }

    function switchTripFromMap(tripId) {
      selectTrip(tripId);
      // Stay on map view
      setTimeout(() => { switchAppView('map'); updateMapTopBar(); }, 300);
    }

    function trackUserLocation() {
      if (!navigator.geolocation) {
        showToast('⚠️ Tarayıcınız konum paylaşımını desteklemiyor.');
        updateRecommendations();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          renderUserMarker();
          reverseGeocodeUserLoc(userLocation.lat, userLocation.lng);
          fetchWeatherForWidget(userLocation.lat, userLocation.lng);
          updateRecommendations();
        },
        (err) => {
          console.warn('Konum alınamadı:', err);
          document.getElementById('widgetLocationName').textContent = 'İzmir, Türkiye (Varsayılan)';
          userLocation = { lat: 38.4192, lng: 27.1287 }; // İzmir default
          fetchWeatherForWidget(userLocation.lat, userLocation.lng);
          updateRecommendations();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    function renderUserMarker() {
      if (!map || !userLocation) return;
      if (userMarker) {
        map.removeLayer(userMarker);
      }

      userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div class="user-pulse-dot"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map);
    }

    async function reverseGeocodeUserLoc(lat, lng) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${lat},${lng}&limit=1&email=${encodeURIComponent(NOMINATIM_EMAIL)}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
          const parts = data[0].display_name.split(',');
          // Get town/city and state
          const label = parts[2]?.trim() + ', ' + parts[4]?.trim();
          document.getElementById('widgetLocationName').textContent = label;
        } else {
          document.getElementById('widgetLocationName').textContent = 'Konumunuz Yakınlarında';
        }
      } catch (e) {
        document.getElementById('widgetLocationName').textContent = 'Konumunuz Yakınlarında';
      }
    }

    function getMarkerIcon(loc, index) {
      const isOneri = loc.day === null;
      if (isOneri) {
        const isSelected = selectedId === loc.id;
        const fontSize = isSelected ? '26px' : '20px';
        const pulse = isSelected ? `<div class="marker-pulse" style="background:var(--c-oneri); width:24px; height:24px;"></div>` : '';
        return L.divIcon({
          className: 'custom-marker emoji-marker',
          html: `
            ${pulse}
            <span style="font-size: ${fontSize}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); line-height: 1; display: block;">📍</span>`,
          iconSize: isSelected ? [28, 28] : [22, 22],
          iconAnchor: isSelected ? [14, 26] : [11, 20],
          popupAnchor: [0, -20]
        });
      }

      // Check if starting point or night activity
      const isStart = !!loc.isStartPoint;
      const isNight = isNightActivity(loc);

      const color = DAYS[loc.day] || '#6C5CE7';
      const isSelected = selectedId === loc.id;
      const size = isSelected ? 38 : 30;

      const mainCat = loc.cats[0] || 'oneri';
      let iconName = CATS[mainCat] ? CATS[mainCat].icon : 'map-pin';

      if (isStart) {
        iconName = 'home';
      } else if (isNight) {
        iconName = 'moon';
      }

      const iconHtml = `<i class="ti ti-${iconName}"></i>`;
      const pulse = isSelected ? `<div class="marker-pulse" style="background:${color};"></div>` : '';

      return L.divIcon({
        className: 'custom-marker',
        html: `
          ${pulse}
          <div class="marker-pin ${isSelected ? 'selected' : ''}" style="background:${color};">
            <span class="marker-num">${iconHtml}</span>
          </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size]
      });
    }

    function renderMarkers() {
      if (!markersLayer) return;
      markersLayer.clearLayers();

      const vis = getVisibleLocations();

      // Render active route locations
      const activeVis = vis.filter(l => l.day !== null);
      activeVis.forEach((l, i) => {
        const marker = L.marker([l.lat, l.lng], {
          icon: getMarkerIcon(l, i)
        });
        marker.on('click', () => selectLocationInline(l.id));
        marker.bindTooltip(
          `<strong>${l.name}</strong><br>${l.region}${l.rating ? '<br>★ ' + l.rating : ''}`,
          { direction: 'top', offset: [0, -20], className: 'leaflet-tooltip-custom' }
        );
        marker.addTo(markersLayer);
      });

      // Show temporary recommendation marker if selected
      if (selectedId !== null) {
        const selectedLoc = LOCATIONS.find(x => x.id === selectedId);
        if (selectedLoc && selectedLoc.day === null) {
          const marker = L.marker([selectedLoc.lat, selectedLoc.lng], {
            icon: getMarkerIcon(selectedLoc, 0)
          });
          marker.on('click', () => selectLocationInline(selectedLoc.id));
          marker.bindTooltip(
            `<strong>${selectedLoc.name}</strong><br>(Öneri Konum)`,
            { direction: 'top', offset: [0, -20], className: 'leaflet-tooltip-custom' }
          );
          marker.addTo(markersLayer);
        }
      }
    }

    function renderRouteLines() {
      if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
      }

      const vis = getVisibleLocations().filter(l => l.day !== null);
      if (!rotaActive || vis.length < 2) return;

      const lg = L.layerGroup();
      let hasLines = false;

      // Group locations by day
      const daysMap = {};
      vis.forEach(l => {
        if (!daysMap[l.day]) daysMap[l.day] = [];
        daysMap[l.day].push(l);
      });

      const activeDays = Object.keys(daysMap).map(Number).sort((a, b) => a - b);

      activeDays.forEach(dayNum => {
        const dayLocs = daysMap[dayNum];
        if (dayLocs.length < 2) return;

        const dayData = osrmDaysData[dayNum];
        if (dayData && dayData.routes && dayData.routes[0]) {
          hasLines = true;
          const dayColor = DAYS[dayNum] || '#4285F4';
          const casingColor = '#1e2229'; // dark casing

          // 1. Casing (wider dark casing line)
          L.geoJSON(dayData.routes[0].geometry, {
            style: {
              color: casingColor,
              weight: 8,
              opacity: 0.75,
              lineCap: 'round',
              lineJoin: 'round'
            }
          }).addTo(lg);

          // 2. Core (inner line with the actual day color!)
          L.geoJSON(dayData.routes[0].geometry, {
            style: {
              color: dayColor,
              weight: 4,
              opacity: 1.0,
              lineCap: 'round',
              lineJoin: 'round'
            }
          }).addTo(lg);

          // Draw distance labels on each leg using the day color as background
          const legs = dayData.routes[0].legs;
          legs.forEach((leg, idx) => {
            const coords = leg.steps.flatMap(s => s.geometry.coordinates);
            if (coords.length > 0) {
              const midIdx = Math.floor(coords.length / 2);
              const midCoord = coords[midIdx];
              const legDist = (leg.distance / 1000).toFixed(1);

              L.marker([midCoord[1], midCoord[0]], {
                icon: L.divIcon({
                  className: 'leg-dist-label-container',
                  html: `<div class="leg-dist-label" style="background:${dayColor}; border-color:${dayColor};">${legDist} km</div>`,
                  iconSize: [50, 18],
                  iconAnchor: [25, 9]
                })
              }).addTo(markersLayer);
            }
          });
        }
      });

      if (hasLines) {
        routeLine = lg.addTo(map);
      }
    }