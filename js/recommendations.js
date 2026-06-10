/* Rotagram Dynamic Overpass POI Recommendations Engine */
    async function fetchRecommendationsFromOverpass(lat, lng, radius = 30000) {
      const query = `
        [out:json][timeout:15];
        (
          nwr["tourism"~"attraction|museum|viewpoint|artwork|gallery|beach-resort"](around:${radius}, ${lat}, ${lng});
          nwr["historic"~"monument|castle|ruins|archaeological_site"](around:${radius}, ${lat}, ${lng});
          nwr["natural"="beach"](around:${radius}, ${lat}, ${lng});
          nwr["amenity"="restaurant"](around:${radius}, ${lat}, ${lng});
        );
        out center 30;
      `;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data || !data.elements) return [];
        return data.elements.map(el => {
          const tags = el.tags || {};
          const name = tags.name || tags.name_tr || tags.name_en || tags.official_name || "Bilinmeyen Yer";
          let category = 'oneri';
          if (tags.historic) {
            category = 'tarih';
          } else if (tags.tourism === 'viewpoint') {
            category = 'manzara';
          } else if (tags.tourism === 'museum' || tags.tourism === 'gallery' || tags.tourism === 'theatre') {
            category = 'kultur';
          } else if (tags.natural === 'beach' || tags.tourism === 'beach-resort') {
            category = 'deniz';
          } else if (tags.amenity === 'restaurant' || tags.amenity === 'cafe') {
            category = 'gastro';
          }
          const elLat = el.lat || (el.center && el.center.lat);
          const elLng = el.lon || (el.center && el.center.lon);
          return {
            id: el.id,
            name: name,
            lat: elLat,
            lng: elLng,
            cats: [category],
            rating: (Math.random() * 1.5 + 3.5).toFixed(1),
            region: tags['addr:city'] || tags['addr:province'] || 'Yakınlarda',
            desc: tags.description || tags.comment || `${name} konumunda bir gezi noktası.`
          };
        }).filter(item => item.name !== "Bilinmeyen Yer" && item.lat && item.lng);
      } catch (err) {
        console.error("Overpass fetch error:", err);
        return [];
      }
    }
function applyCategoryLimit(items, limitPerCat = 3) {
  const counts = {};
  const filtered = [];
  for (const item of items) {
    const cat = item.cats[0] || 'oneri';
    if (!counts[cat]) counts[cat] = 0;
    if (counts[cat] < limitPerCat) {
      filtered.push(item);
      counts[cat]++;
    }
  }
  return filtered;
}

async function updateRecommendations() {
  const gpsListContainer = document.getElementById('gpsRecsList');
  const gpsBlock = document.getElementById('gpsRecsBlock');
  const planListContainer = document.getElementById('planRecsList');
  const planBlock = document.getElementById('planRecsBlock');

  if (!gpsListContainer || !gpsBlock || !planListContainer || !planBlock) return;

  // 1. GPS Proximity Recommendations
  if (userLocation) {
    const distFromLast = lastFetchedUserLoc ? calculateDistance(userLocation, lastFetchedUserLoc) : Infinity;
    if (distFromLast > 5 || RECOMMENDED_DATABASE.length === 0) {
      lastFetchedUserLoc = { ...userLocation };
      gpsListContainer.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--ink2); text-align:center;"><span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid rgba(0,0,0,0.1); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; margin-right:6px; vertical-align:middle;"></span>Öneriler yükleniyor...</div>';
      try {
        RECOMMENDED_DATABASE = await fetchRecommendationsFromOverpass(userLocation.lat, userLocation.lng);
      } catch (err) {
        console.error("Failed to fetch GPS suggestions:", err);
      }
    }

    let rawGpsSugg = RECOMMENDED_DATABASE.filter(r => {
      return !LOCATIONS.some(l => l.name.toLowerCase() === r.name.toLowerCase());
    }).map(r => {
      const dist = calculateDistance(r, userLocation);
      return { ...r, dist };
    }).sort((a, b) => a.dist - b.dist);

    // Enforce category limits, then slice to top 10
    let gpsSugg = applyCategoryLimit(rawGpsSugg, 3).slice(0, 10);

    gpsListContainer.innerHTML = '';
    if (gpsSugg.length > 0) {
      const titleEl = gpsBlock.querySelector('.recs-title');
      if (titleEl) titleEl.innerHTML = '<i class="ti ti-navigation"></i> Bulunduğunuz Konuma Yakın Önemli Yerler';
      gpsSugg.forEach(item => {
        const div = createRecItemHTML(item, `${item.dist.toFixed(1)} km yakınınızda`);
        gpsListContainer.appendChild(div);
      });
      gpsBlock.style.display = 'flex';
    } else {
      gpsBlock.style.display = 'none';
    }
  } else {
    gpsBlock.style.display = 'none';
  }

  // 2. Active Trip Proximity Recommendations
  if (activeTrip && activeTrip.locations.length > 0) {
    let sumLat = 0, sumLng = 0;
    activeTrip.locations.forEach(l => {
      sumLat += l.lat;
      sumLng += l.lng;
    });
    const centroid = {
      lat: sumLat / activeTrip.locations.length,
      lng: sumLng / activeTrip.locations.length
    };

    const distFromLastCentroid = lastFetchedCentroid ? calculateDistance(centroid, lastFetchedCentroid) : Infinity;
    if (distFromLastCentroid > 10 || PLAN_RECOMMENDATIONS.length === 0) {
      lastFetchedCentroid = { ...centroid };
      planListContainer.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--ink2); text-align:center;"><span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid rgba(0,0,0,0.1); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; margin-right:6px; vertical-align:middle;"></span>Plan önerileri yükleniyor...</div>';
      try {
        PLAN_RECOMMENDATIONS = await fetchRecommendationsFromOverpass(centroid.lat, centroid.lng);
      } catch (err) {
        console.error("Failed to fetch plan suggestions:", err);
      }
    }

    let rawPlanSugg = PLAN_RECOMMENDATIONS.filter(r => {
      return !activeTrip.locations.some(l => l.name.toLowerCase() === r.name.toLowerCase());
    }).map(r => {
      let minDist = Infinity;
      let nearestLoc = null;
      activeTrip.locations.forEach(aLoc => {
        const d = calculateDistance(r, aLoc);
        if (d < minDist) {
          minDist = d;
          nearestLoc = aLoc;
        }
      });
      return { ...r, dist: minDist, relativeToName: nearestLoc ? nearestLoc.name : '' };
    }).sort((a, b) => a.dist - b.dist);

    // Enforce category limits, then slice to top 10
    let planSugg = applyCategoryLimit(rawPlanSugg, 3).slice(0, 10);

    planListContainer.innerHTML = '';
    if (planSugg.length > 0) {
      const titleEl = planBlock.querySelector('.recs-title');
      if (titleEl) titleEl.innerHTML = '<i class="ti ti-sparkles"></i> Seyahat Planınıza Uygun Öneriler';
      planSugg.forEach(item => {
        const div = createRecItemHTML(item, `"${item.relativeToName}" konumuna ${item.dist.toFixed(1)} km`);
        const addBtn = div.querySelector('.rec-add-btn');
        if (addBtn) addBtn.setAttribute('onclick', `event.stopPropagation(); handleAddRecClick(${item.id}, true)`);
        planListContainer.appendChild(div);
      });
      planBlock.style.display = 'flex';
    } else {
      planBlock.style.display = 'none';
    }
  } else {
    planBlock.style.display = 'none';
  }
}

    function createRecItemHTML(item, distanceText) {
      const div = document.createElement('div');
      div.className = 'rec-item';

      const mainCat = item.cats[0] || 'oneri';
      const catBadge = `<span class="loc-cat cat-${mainCat}">${CATS[mainCat].label}</span>`;
      const ratingSpan = item.rating ? `<span class="loc-rating">\u2605 ${item.rating}</span>` : '';

      div.innerHTML = `
        <div class="rec-item-info">
          <div class="rec-item-name">${item.name}</div>
          <div class="rec-item-meta">
            ${catBadge}
            ${ratingSpan}
            <span class="loc-dist"><i class="ti ti-map-pin"></i> ${distanceText}</span>
          </div>
        </div>
        <button class="rec-add-btn" onclick="event.stopPropagation(); handleAddRecClick(${item.id})" title="Gezime Ekle">+</button>
      `;

      div.onclick = () => {
        map.flyTo([item.lat, item.lng], 13);
        showTemporaryRecommendationMarker(item);
      };

      return div;
    }

    function showTemporaryRecommendationMarker(item) {
      if (tempRecMarker) map.removeLayer(tempRecMarker);

      const size = 36;
      const color = '#6C5CE7';
      const mainCat = item.cats[0] || 'oneri';
      const iconName = CATS[mainCat] ? CATS[mainCat].icon : 'map-pin';

      tempRecMarker = L.marker([item.lat, item.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `
            <div class="marker-pulse" style="background:${color};"></div>
            <div class="marker-pin selected" style="background:${color};">
              <span class="marker-num"><i class="ti ti-${iconName}"></i></span>
            </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size]
        })
      }).addTo(map);

      tempRecMarker.bindTooltip(
        `<strong>${item.name}</strong><br>(\u00d6nerilen Yer \u00b7 T\u0131klay\u0131p Plana Ekleyin)`,
        { direction: 'top', offset: [0, -size], className: 'leaflet-tooltip-custom' }
      ).openTooltip();

      tempRecMarker.on('click', () => {
        openAddToTripAndDayModal(item);
      });
    }

    function handleAddRecClick(recId, isPlanRec = false) {
      const db = isPlanRec ? PLAN_RECOMMENDATIONS : RECOMMENDED_DATABASE;
      const rec = db.find(r => r.id === recId);
      if (rec) {
        openAddToTripAndDayModal(rec);
      }
    }

function openAddToTripAndDayModal(locData) {
  // If there are no trips, auto-create a default one to reduce friction (0-click onboarding)
  if (trips.length === 0) {
    const newTrip = {
      id: Date.now(),
      name: 'Seyahat Rotalarım 🗺️',
      duration: 3,
      createdAt: new Date().toISOString(),
      locations: []
    };
    trips.push(newTrip);
    activeTrip = newTrip;
    LOCATIONS = activeTrip.locations;
    orderedLocs = [...LOCATIONS];
  }

  if (activeTrip) {
    let dayVal = 1;
    if (selectedDayFilter !== 'all' && selectedDayFilter !== 'null') {
      dayVal = parseInt(selectedDayFilter);
    } else if (selectedDayFilter === 'null') {
      dayVal = null;
    }

    const newLoc = {
      id: Date.now() + Math.floor(Math.random() * 100),
      name: locData.name,
      lat: parseFloat(locData.lat),
      lng: parseFloat(locData.lng),
      day: dayVal,
      cats: locData.cats || ['oneri'],
      desc: locData.desc || 'Eklenen konum.',
      rating: locData.rating || null,
      hours: locData.hours || null,
      tip: locData.tip || null,
      region: locData.region || 'Türkiye',
      userAdded: locData.userAdded !== undefined ? locData.userAdded : true
    };

    activeTrip.locations.push(newLoc);

    // Refresh UI states
    LOCATIONS = activeTrip.locations;
    orderedLocs = [...LOCATIONS];
    if (dayVal !== null) {
      activeDays.add(dayVal);
    }

    if (rotaActive) {
      optimizeAllDaysTSP().then(() => {
        updateRoute();
        renderTripList();
        updateRecommendations();
        showToast(`📍 "${newLoc.name}" başarıyla ${dayVal !== null ? dayVal + '. güne' : 'plana'} eklendi!`);
      });
    } else {
      saveTrips();
      updateRoute();
      renderTripList();
      updateRecommendations();
      showToast(`📍 "${newLoc.name}" başarıyla ${dayVal !== null ? dayVal + '. güne' : 'plana'} eklendi!`);
    }
    return;
  }
}

    function toggleAddLocationNewTripInput() {
      const tripSelect = document.getElementById('fAddLocationTripSelect');
      document.getElementById('addLocationNewTripGroup').style.display = tripSelect.value === 'new' ? 'block' : 'none';
    }

    function closeAddToTripAndDayModal() {
      document.getElementById('modalAddToTripAndDay').classList.remove('open');
      pendingLocationToAddToTrip = null;
    }

    async function submitAddToTripAndDay() {
      if (!pendingLocationToAddToTrip) return;

      const tripSelect = document.getElementById('fAddLocationTripSelect');
      const daySelect = document.getElementById('fAddLocationDaySelect');
      const dayVal = daySelect.value === 'null' ? null : parseInt(daySelect.value);

      let targetTrip = null;

      if (tripSelect.value === 'new') {
        const newTripNameInput = document.getElementById('fAddLocationNewTripName');
        const name = newTripNameInput.value.trim() || 'Yeni Gezi Planı 🗺️';

        currentUser = JSON.parse(localStorage.getItem('rotagram_user') || 'null');
        if (currentUser && trips.length >= 10) {
          showToast('⚠️ Bulut senkronizasyonu için en fazla 10 seyahat planı oluşturabilirsiniz.');
          return;
        }

        targetTrip = {
          id: Date.now(),
          name: name,
          createdAt: new Date().toISOString(),
          locations: []
        };
        trips.push(targetTrip);
      } else {
        targetTrip = trips.find(t => t.id == tripSelect.value);
      }

      if (!targetTrip) return;

      const newLoc = {
        id: Date.now() + Math.floor(Math.random() * 100),
        name: pendingLocationToAddToTrip.name,
        lat: parseFloat(pendingLocationToAddToTrip.lat),
        lng: parseFloat(pendingLocationToAddToTrip.lng),
        day: dayVal,
        cats: pendingLocationToAddToTrip.cats || ['oneri'],
        desc: pendingLocationToAddToTrip.desc || 'Eklenen konum.',
        rating: pendingLocationToAddToTrip.rating || null,
        hours: pendingLocationToAddToTrip.hours || null,
        tip: pendingLocationToAddToTrip.tip || null,
        region: pendingLocationToAddToTrip.region || 'Türkiye',
        userAdded: pendingLocationToAddToTrip.userAdded !== undefined ? pendingLocationToAddToTrip.userAdded : true
      };

      targetTrip.locations.push(newLoc);
      closeAddToTripAndDayModal();

      // Refresh UI if target is the currently active trip
      if (activeTrip && activeTrip.id === targetTrip.id) {
        LOCATIONS = activeTrip.locations;
        orderedLocs = [...LOCATIONS];
        if (dayVal !== null) {
          activeDays.add(dayVal);
        }
        if (rotaActive) {
          await optimizeAllDaysTSP();
        } else {
          saveTrips();
        }
        updateRoute();
      } else {
        saveTrips();
      }

      renderTripList();
      updateRecommendations();
      showToast(`📍 "${newLoc.name}" başarıyla eklendi!`);
    }
// Helper function to add recommendation directly to a specific day in standard sidebar list
function addRecommendationToSpecificDay(item, dayNum) {
  if (!activeTrip) return;
  const newLoc = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    cats: item.cats || ['oneri'],
    rating: item.rating || '4.0',
    region: item.region || 'Yakınlarda',
    desc: item.desc || '',
    day: dayNum,
    isStartPoint: false
  };
  activeTrip.locations.push(newLoc);
  saveTrips();
  updateRoute();
  renderStandardList();
  if (typeof activeAppTab !== 'undefined' && activeAppTab === 'timeline') {
    renderTimelineView();
  }
  renderMarkers();
  updateRecommendations();
  showToast(`📍 "${newLoc.name}" ${dayNum}. Güne eklendi!`);
}