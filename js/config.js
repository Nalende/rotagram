/* Rotagram Global Configurations & App State */
/* ???????????????????????????????????????????
       CURATED EXPLORE DATABASE (TURKEY SIGHTS)
       ??????????????????????????????????????????? */
    let RECOMMENDED_DATABASE = [];
    let PLAN_RECOMMENDATIONS = [];
    let lastFetchedCentroid = null;
    let lastFetchedUserLoc = null;

    const CATS = {
      tarih: { label: 'Tarih', color: '#F97316', bg: '#FFF7ED', icon: 'building-castle' },
      deniz: { label: 'Deniz', color: '#0284C7', bg: '#F0F9FF', icon: 'swimming' },
      kultur: { label: 'Kültür', color: '#10B981', bg: '#ECFDF5', icon: 'palette' },
      gastro: { label: 'Gastro', color: '#EF4444', bg: '#FEF2F2', icon: 'tools-kitchen-2' },
      manzara: { label: 'Manzara', color: '#EAB308', bg: '#FEFCE8', icon: 'mountain' },
      oneri: { label: 'Öneri+', color: '#6366F1', bg: '#EEF2FF', icon: 'sparkles' }
    };

    const DAYS = {
      1: '#6366F1', 2: '#06B6D4', 3: '#F97316', 4: '#3B82F6',
      5: '#10B981', 6: '#EF4444', 7: '#F59E0B'
    };
    const DAYBG = {
      1: '#EEF2FF', 2: '#ECFEFF', 3: '#FFF7ED', 4: '#EFF6FF',
      5: '#ECFDF5', 6: '#FEF2F2', 7: '#FEF3C7'
    };

    /* APP STATE */
    let trips = [];             // List of user trips: [{id, name, createdAt, locations: [...]}]
    let activeTrip = null;      // Active selected trip object pointer

    let LOCATIONS = [];         // Shorthand reference to activeTrip.locations
    let orderedLocs = [];       // Holds rendering order (and optimized route orders)

    let nextId = 2000;          // Auto-increment ID for custom user locations

    let selectedId = null;      // Selected location ID (active marker/detail panel highlight)
    let activeTab = 'list';     // Active sidebar detail tab: 'list' | 'timeline' | 'nav'

    let activeDays = new Set([1]); // Filtered/active planning days
    let activeCats = new Set(['tarih', 'deniz', 'kultur', 'gastro', 'manzara', 'oneri']); // Filtered categories
    let selectedDayFilter = 'all'; // 'all' or 1, 2, 3, etc. or 'null' for Plan Dışı
    let osrmDaysData = {};         // OSRM route data map keyed by day number
    let activeRouteCoordsByDay = {}; // OSRM coordinates string cache map keyed by day number

    let rotaActive = false;     // True if route path rendering is active
    let userLocation = null;    // User GPS location {lat, lng}
    let userMarker = null;      // Leaflet marker for user

    let currentUser = null;     // Current logged in user {username, email}
    let activeAppTab = 'home';  // Current bottom nav active tab
    let mapPinningActive = false;// True if clicking map to select coords is active
    const KVDB_BASE_URL = 'https://kvdb.io/rotagram_db_v1_2026/';

    /* MAP LAYERS */
    let map = null;
    let markersLayer = null;
    let routeLine = null;
    let currentTileLayer = null;
    let mapLayers = {};
    let osrmCache = new Map();
    let osrmData = null;
    let activeRouteCoordsStr = '';

    let draggedIndex = null;    // Used for list drag reordering

    /* ═══════════════════════════════════════════
       TRIP DATA STORAGE & SYNC
       ═══════════════════════════════════════════ */
// Google OAuth Client ID Configuration
// Kendi Google Client ID'niz varsa varsayılan ID yerine buraya yazabilirsiniz.
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
// OpenStreetMap Nominatim queries requirement email config
const NOMINATIM_EMAIL = 'contact@rotagram.app';
// Haversine formula to calculate distance in km between two lat/lng coordinates
function calculateDistance(loc1, loc2) {
  const R = 6371; // Earth's radius in km
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}