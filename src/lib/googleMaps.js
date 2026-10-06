/* ─────────────────────────────────────────────────────────────
   Google Maps helpers — script loader, nearby EV charging
   station search (Places API) and distance utilities.
   The API key is read from VITE_GOOGLE_MAPS_API_KEY in .env
   ───────────────────────────────────────────────────────────── */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Keep this off until Places API (New) is enabled for the key's Cloud project.
// The map itself still uses Google Maps; station data comes from OpenStreetMap.
const USE_GOOGLE_PLACES = import.meta.env.VITE_USE_GOOGLE_PLACES === "true";

let loaderPromise = null;
let authFailed = false;
const authListeners = new Set();

/* Google calls this global when the key is invalid / not authorised */
window.gm_authFailure = () => {
  authFailed = true;
  authListeners.forEach((fn) => fn());
};

export function onMapsAuthFailure(fn) {
  if (authFailed) fn();
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}

/* Load the Maps JavaScript API once and resolve with google.maps */
export function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  if (!API_KEY) {
    return Promise.reject(
      new Error("Google Maps API key missing. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.")
    );
  }

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = "__solarHubMapsReady";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js" +
      `?key=${encodeURIComponent(API_KEY)}` +
      `&v=weekly&loading=async&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      script.remove();
      reject(new Error("Could not load Google Maps. Check your internet connection."));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/* Browser GPS → { lat, lng, accuracy } */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser does not support location access."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const messages = {
          1: "Location permission denied. Please allow location access in your browser and try again.",
          2: "Your location is unavailable right now. Please check GPS / network and try again.",
          3: "Getting your location timed out. Please try again.",
        };
        reject(new Error(messages[err.code] || "Could not get your location."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

/* Straight-line distance in km (haversine) */
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/* Google Maps app / website turn-by-turn navigation link */
export function googleMapsDirectionsUrl(origin, dest, travelMode = "driving") {
  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: travelMode,
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/* ─── Availability ─── */

const CONNECTOR_NAMES = {
  EV_CONNECTOR_TYPE_TYPE_2: "Type 2",
  EV_CONNECTOR_TYPE_CCS_COMBO_2: "CCS2",
  EV_CONNECTOR_TYPE_CCS_COMBO_1: "CCS1",
  EV_CONNECTOR_TYPE_CHADEMO: "CHAdeMO",
  EV_CONNECTOR_TYPE_J1772: "J1772",
  EV_CONNECTOR_TYPE_TESLA: "Tesla",
  EV_CONNECTOR_TYPE_UNSPECIFIED_GB_T: "GB/T",
  EV_CONNECTOR_TYPE_UNSPECIFIED_WALL_OUTLET: "Wall outlet",
  EV_CONNECTOR_TYPE_NACS: "NACS",
  EV_CONNECTOR_TYPE_OTHER: "Other",
};

function connectorName(type) {
  return CONNECTOR_NAMES[type] || String(type || "Other").replace("EV_CONNECTOR_TYPE_", "").replace(/_/g, " ");
}

/*
  status: "available" | "busy" | "closed" | "open" | "unknown"
  Uses live connector availability when Google has it, otherwise
  falls back to business status / opening hours.
*/
function availabilityOf(station) {
  if (station.businessStatus && station.businessStatus !== "OPERATIONAL") {
    return { status: "closed", label: "Closed" };
  }

  const withCounts = station.connectors.filter((c) => typeof c.available === "number");
  if (withCounts.length) {
    const available = withCounts.reduce((s, c) => s + c.available, 0);
    const total = withCounts.reduce((s, c) => s + (c.count || 0), 0);
    return available > 0
      ? { status: "available", label: `${available}/${total} chargers free` }
      : { status: "busy", label: "All chargers in use" };
  }

  if (station.openNow === true) return { status: "open", label: "Open now" };
  if (station.openNow === false) return { status: "closed", label: "Closed now" };
  return { status: "unknown", label: "Availability unknown" };
}

/* ─── Nearby search ─── */

const FULL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "businessStatus",
  "regularOpeningHours",
  "utcOffsetMinutes",
  "evChargeOptions",
  "googleMapsURI",
];

const BASIC_FIELDS = ["id", "displayName", "formattedAddress", "location", "rating", "userRatingCount", "businessStatus"];

async function normalizeNewPlace(place) {
  let openNow;
  if (place.regularOpeningHours) {
    try {
      openNow = await place.isOpen();
    } catch {
      openNow = undefined;
    }
  }

  const connectors = (place.evChargeOptions?.connectorAggregations || []).map((c) => ({
    type: connectorName(c.type),
    count: c.count,
    maxKw: c.maxChargeRateKw,
    available: c.availableCount ?? undefined,
    outOfService: c.outOfServiceCount ?? undefined,
  }));

  return {
    id: place.id,
    name: place.displayName || "EV Charging Station",
    address: place.formattedAddress || "",
    location: { lat: place.location.lat(), lng: place.location.lng() },
    rating: place.rating,
    ratingCount: place.userRatingCount,
    businessStatus: place.businessStatus,
    openNow,
    connectorCount: place.evChargeOptions?.connectorCount,
    connectors,
    mapsUrl: place.googleMapsURI,
  };
}

/* Places API (New) — Place.searchNearby */
async function searchWithNewPlaces(maps, center, radius, fields) {
  const { Place, SearchNearbyRankPreference } = await maps.importLibrary("places");
  const { places } = await Place.searchNearby({
    fields,
    locationRestriction: { center, radius },
    // Chargers attached to malls, car parks, fuel stations, or dealerships
    // can have a different primary type in Google's data.
    includedTypes: ["electric_vehicle_charging_station"],
    maxResultCount: 20,
    rankPreference: SearchNearbyRankPreference.DISTANCE,
  });
  return Promise.all((places || []).map(normalizeNewPlace));
}

const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function osmAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  return [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean).join(", ");
}

function osmConnectorName(value) {
  const names = {
    type2: "Type 2",
    type2_combo: "CCS2",
    type1: "Type 1",
    type1_combo: "CCS1",
    chademo: "CHAdeMO",
    tesla_supercharger: "Tesla Supercharger",
    tesla_destination: "Tesla Destination",
    gb_t: "GB/T",
  };
  return names[value] || value.replaceAll("_", " ");
}

function osmConnectors(tags) {
  return Object.entries(tags)
    .filter(([key, value]) => /^socket:[^:]+$/.test(key) && value !== "no")
    .map(([key, value]) => {
      const type = key.slice("socket:".length);
      const parsedCount = Number.parseInt(value, 10);
      const output = tags[`${key}:output`];
      const parsedOutput = output ? Number.parseFloat(output) : undefined;
      return {
        type: osmConnectorName(type),
        count: Number.isFinite(parsedCount) ? parsedCount : undefined,
        maxKw: Number.isFinite(parsedOutput) ? parsedOutput : undefined,
      };
    });
}

function normalizeOsmStation(element) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (["private", "no"].includes(tags.access) || tags.motorcar === "no") return null;

  const capacity = Number.parseInt(tags.capacity, 10);
  const name = tags.name || tags.operator || tags.brand || "EV Charging Station";
  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    address: osmAddress(tags) || tags.description || tags.operator || "",
    location: { lat, lng },
    businessStatus: "OPERATIONAL",
    openNow: tags.opening_hours === "24/7" ? true : undefined,
    connectorCount: Number.isFinite(capacity) ? capacity : undefined,
    connectors: osmConnectors(tags),
    mapsUrl: googleMapsDirectionsUrl(null, { lat, lng }),
    source: "openstreetmap",
  };
}

function photonAddress(properties) {
  return [
    properties.street,
    properties.locality,
    properties.district,
    properties.city,
    properties.postcode,
  ].filter((part, index, all) => part && all.indexOf(part) === index).join(", ");
}

function normalizePhotonStation(feature) {
  const properties = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    id: `photon-${properties.osm_type || "item"}-${properties.osm_id}`,
    name: properties.name || "EV Charging Station",
    address: photonAddress(properties),
    location: { lat, lng },
    businessStatus: "OPERATIONAL",
    connectors: [],
    mapsUrl: googleMapsDirectionsUrl(null, { lat, lng }),
    source: "openstreetmap",
  };
}

async function searchWithPhoton(center, radius) {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lon: String(center.lng),
    radius: String(Math.max(1, Math.ceil(radius / 1000))),
    limit: "50",
    osm_tag: "amenity:charging_station",
  });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`https://photon.komoot.io/reverse?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenStreetMap geocoder failed (${response.status})`);
    const data = await response.json();
    return (data.features || []).map(normalizePhotonStation).filter(Boolean);
  } finally {
    window.clearTimeout(timeout);
  }
}

/* Public fallback for projects that have not enabled Google Places API (New). */
async function searchWithOpenStreetMap(center, radius) {
  try {
    const stations = await searchWithPhoton(center, radius);
    if (stations.length) return stations;
  } catch (error) {
    console.warn("Fast OpenStreetMap station search failed; trying Overpass:", error);
  }

  const query = `[out:json][timeout:20];nwr["amenity"="charging_station"](around:${Math.round(radius)},${center.lat},${center.lng});out center tags;`;
  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OpenStreetMap search failed (${response.status})`);
      const data = await response.json();
      return (data.elements || []).map(normalizeOsmStation).filter(Boolean);
    } catch (error) {
      lastError = error;
      console.warn(`Charging-station fallback failed at ${endpoint}:`, error);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError || new Error("OpenStreetMap station search failed.");
}

/* Find EV charging stations around `center` within `radius` metres */
export async function findNearbyChargingStations(maps, center, radius) {
  let stations;

  if (USE_GOOGLE_PLACES) {
    try {
      stations = await searchWithNewPlaces(maps, center, radius, FULL_FIELDS);
    } catch (fullErr) {
      console.warn("Full-field nearby search failed, retrying with basic fields:", fullErr);
      try {
        stations = await searchWithNewPlaces(maps, center, radius, BASIC_FIELDS);
      } catch (basicErr) {
        console.warn("Places API (New) failed, using OpenStreetMap station data:", basicErr);
      }
    }
  }

  if (!stations) {
    try {
      stations = await searchWithOpenStreetMap(center, radius);
    } catch (fallbackErr) {
      console.error(fallbackErr);
      throw new Error("Could not download nearby charging-station data. Check your internet connection.", {
        cause: fallbackErr,
      });
    }
  }

  return stations
    .map((s) => {
      const distance = distanceKm(center, s.location);
      return { ...s, distance, availability: availabilityOf(s) };
    })
    .filter((s) => s.distance <= radius / 1000 + 0.1)
    .sort((a, b) => a.distance - b.distance);
}

/* ─── Directions ─── */

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

const toLatLng = (p) => ({
  lat: typeof p.lat === "function" ? p.lat() : p.lat,
  lng: typeof p.lng === "function" ? p.lng() : p.lng,
});

function stripHtml(html) {
  return new DOMParser().parseFromString(html || "", "text/html").body.textContent || "";
}

/* Routes API (Maps JS Route class) */
async function routeWithRoutesApi(maps, origin, destination, mode) {
  const { Route } = await maps.importLibrary("routes");
  const { routes } = await Route.computeRoutes({
    origin,
    destination,
    travelMode: mode,
    fields: ["path", "legs", "distanceMeters", "durationMillis", "localizedValues"],
  });
  const r = routes?.[0];
  if (!r) throw new Error("No route found");

  const steps = (r.legs || []).flatMap((leg) => leg.steps || []);
  return {
    path: (r.path || []).map(toLatLng),
    distance: r.localizedValues?.distance || formatDistance((r.distanceMeters || 0) / 1000),
    duration: r.localizedValues?.duration || formatDuration(r.durationMillis || 0),
    steps: steps
      .map((st) => ({
        text: st.instructions || st.navigationInstruction?.instructions || "",
        distance: st.localizedValues?.distance || (st.distanceMeters ? formatDistance(st.distanceMeters / 1000) : ""),
      }))
      .filter((st) => st.text),
  };
}

/* Legacy DirectionsService — fallback for keys that still have it */
async function routeWithDirectionsService(maps, origin, destination, mode) {
  const service = new maps.DirectionsService();
  const result = await service.route({
    origin,
    destination,
    travelMode: maps.TravelMode[mode] || maps.TravelMode.DRIVING,
  });
  const route = result.routes[0];
  const leg = route.legs[0];
  return {
    path: route.overview_path.map(toLatLng),
    distance: leg.distance?.text,
    duration: leg.duration?.text,
    steps: leg.steps.map((st) => ({ text: stripHtml(st.instructions), distance: st.distance?.text })),
  };
}

/* Route from origin → destination. mode: DRIVING | TWO_WHEELER | WALKING */
export async function computeRoute(maps, origin, destination, mode = "DRIVING") {
  try {
    return await routeWithRoutesApi(maps, origin, destination, mode);
  } catch (routesErr) {
    console.warn("Routes API failed, trying legacy Directions:", routesErr);
    return routeWithDirectionsService(maps, origin, destination, mode);
  }
}
