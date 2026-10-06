import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadGoogleMaps,
  onMapsAuthFailure,
  getCurrentPosition,
  findNearbyChargingStations,
  formatDistance,
  googleMapsDirectionsUrl,
  computeRoute,
} from "../lib/googleMaps";
import "../stations.css";

const RADIUS_OPTIONS = [
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
  { label: "50 km", value: 50000 },
];

const DEFAULT_RADIUS = 5000;
const EMPTY_RESULT_RETRY_RADIUS = 25000;
const CURRENT_LOCATION_STATION_ID = "current-location-charging-station";

function currentLocationStation(pos) {
  return {
    id: CURRENT_LOCATION_STATION_ID,
    name: "My Current Location Charging Station",
    address: `Current GPS location (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`,
    location: { lat: pos.lat, lng: pos.lng },
    distance: 0,
    businessStatus: "OPERATIONAL",
    openNow: true,
    availability: { status: "available", label: "Available now" },
    connectorCount: 5,
    connectors: [
      { type: "USB Type-C", count: 1 },
      { type: "AC Socket (230V)", count: 2 },
      { type: "USB Multi Pin", count: 1 },
      { type: "DC Fast Charging", count: 1 },
    ],
    source: "current-location",
    isCurrentLocationStation: true,
  };
}

const TRAVEL_MODES = [
  { id: "DRIVING", label: "🚗 Drive", url: "driving" },
  { id: "TWO_WHEELER", label: "🛵 Bike", url: "two-wheeler" },
  { id: "WALKING", label: "🚶 Walk", url: "walking" },
];

const STATUS_COLORS = {
  available: "#10b981",
  open: "#10b981",
  busy: "#f59e0b",
  closed: "#ef4444",
  unknown: "#3b82f6",
};

/* Dark map theme to match the app */
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0c1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#030a12" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#112240" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a4a75" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#030a12" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function FindStations() {
  const mapDivRef = useRef(null);
  const mapsRef = useRef(null);          // google.maps namespace
  const mapRef = useRef(null);           // google.maps.Map
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const routeLineRef = useRef(null);         // google.maps.Polyline for the route

  const [mapReady, setMapReady] = useState(false);
  const [phase, setPhase] = useState("loading"); // loading | locating | searching | done | error
  const [error, setError] = useState("");
  const [userPos, setUserPos] = useState(null);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [stations, setStations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [travelMode, setTravelMode] = useState("DRIVING");
  const [route, setRoute] = useState(null);        // { stationId, distance, duration, steps }
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  const findStationsRef = useRef(null);

  const visibleStations = onlyAvailable
    ? stations.filter((s) => ["available", "open", "unknown"].includes(s.availability.status))
    : stations;
  const selected = stations.find((s) => s.id === selectedId) || null;
  const usingOpenStreetMap = stations.some((s) => s.source === "openstreetmap");

  /* ── 1. Load Google Maps and create the map ── */
  useEffect(() => {
    let cancelled = false;
    const offAuth = onMapsAuthFailure(() => {
      setError("Google Maps rejected the API key. Check that the key is valid and the Maps JavaScript API is enabled.");
      setPhase("error");
    });

    loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || mapRef.current) return;
        const { Map, InfoWindow } = await maps.importLibrary("maps");
        if (cancelled || mapRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new Map(mapDivRef.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 5,
          styles: DARK_MAP_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });
        infoWindowRef.current = new InfoWindow();
        setMapReady(true);
        /* Search automatically on first load — later searches are user-triggered */
        findStationsRef.current?.(DEFAULT_RADIUS);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setPhase("error");
      });

    return () => {
      cancelled = true;
      offAuth();
    };
  }, []);

  /* ── 2. Locate the user and search nearby stations ── */
  const findStations = useCallback(async (searchRadius) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    setError("");
    setRoute(null);
    setRouteError("");
    setSelectedId(null);
    routeLineRef.current?.setMap(null);
    infoWindowRef.current?.close();

    try {
      setPhase("locating");
      const pos = await getCurrentPosition();
      setUserPos(pos);

      /* "You are here" marker + accuracy circle */
      userMarkerRef.current?.setMap(null);
      accuracyCircleRef.current?.setMap(null);
      userMarkerRef.current = new maps.Marker({
        map,
        position: pos,
        title: "You are here",
        zIndex: 999,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      accuracyCircleRef.current = new maps.Circle({
        map,
        center: pos,
        radius: Math.min(pos.accuracy || 0, 1000),
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        clickable: false,
      });
      map.setCenter(pos);
      map.setZoom(14);

      setPhase("searching");
      let found = [];
      try {
        found = await findNearbyChargingStations(maps, pos, searchRadius);

        // If a small local search is empty, show the nearest practical options
        // instead of leaving the user with an empty map.
        if (found.length === 0 && searchRadius < EMPTY_RESULT_RETRY_RADIUS) {
          setRadius(EMPTY_RESULT_RETRY_RADIUS);
          found = await findNearbyChargingStations(maps, pos, EMPTY_RESULT_RETRY_RADIUS);
        }
      } catch (stationError) {
        // Keep the user's station visible if a public data provider is down.
        console.warn("Nearby public stations could not be loaded:", stationError);
      }

      const ownStation = currentLocationStation(pos);
      const overlapKm = Math.min(
        0.1,
        Math.max(0.025, (Number(pos.accuracy) || 0) / 1000)
      );
      const otherStations = found.filter((station) => station.distance > overlapKm);
      setStations([ownStation, ...otherStations]);
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setStations([]);
      setPhase("error");
    }
  }, []);
  useEffect(() => {
    findStationsRef.current = findStations;
  }, [findStations]);

  /* ── 3. Draw station markers whenever the list changes ── */
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    stationMarkersRef.current.forEach((m) => m.setMap(null));
    stationMarkersRef.current = visibleStations.map((s, i) => {
      const marker = new maps.Marker({
        map,
        position: s.location,
        title: s.name,
        zIndex: s.isCurrentLocationStation ? 1000 : undefined,
        label: { text: String(i + 1), color: "#ffffff", fontWeight: "800", fontSize: "12px" },
        icon: {
          path: "M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z",
          fillColor: STATUS_COLORS[s.availability.status],
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.2,
          anchor: new maps.Point(12, 36),
          labelOrigin: new maps.Point(12, 12),
        },
      });
      marker.addListener("click", () => setSelectedId(s.id));
      return marker;
    });

    /* Fit map to user + stations */
    if (userPos && visibleStations.length) {
      const bounds = new maps.LatLngBounds();
      bounds.extend(userPos);
      visibleStations.forEach((s) => bounds.extend(s.location));
      map.fitBounds(bounds, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, onlyAvailable]);

  /* ── 4. Info window for the selected station ── */
  useEffect(() => {
    const map = mapRef.current;
    const info = infoWindowRef.current;
    if (!map || !info) return;
    if (!selected) {
      info.close();
      return;
    }
    const idx = visibleStations.findIndex((s) => s.id === selected.id);
    const marker = stationMarkersRef.current[idx];

    const content = document.createElement("div");
    content.className = "gm-info";
    const title = document.createElement("strong");
    title.textContent = selected.name;
    const meta = document.createElement("span");
    meta.textContent = `${formatDistance(selected.distance)} away · ${selected.availability.label}`;
    content.append(title, meta);
    info.setContent(content);

    if (marker) info.open({ map, anchor: marker });
    else {
      info.setPosition(selected.location);
      info.open({ map });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ── 5. Directions ── */
  const showDirections = useCallback(
    async (station, mode = travelMode) => {
      const maps = mapsRef.current;
      if (!maps || !userPos) return;

      setSelectedId(station.id);
      setRouteLoading(true);
      setRouteError("");

      try {
        const result = await computeRoute(maps, userPos, station.location, mode);

        routeLineRef.current?.setMap(null);
        routeLineRef.current = new maps.Polyline({
          map: mapRef.current,
          path: result.path,
          strokeColor: "#22c55e",
          strokeWeight: 6,
          strokeOpacity: 0.9,
        });
        const bounds = new maps.LatLngBounds();
        result.path.forEach((p) => bounds.extend(p));
        mapRef.current.fitBounds(bounds, 60);

        setRoute({ stationId: station.id, ...result });
      } catch (err) {
        console.error("Directions failed:", err);
        routeLineRef.current?.setMap(null);
        setRoute(null);
        setRouteError(
          mode === "TWO_WHEELER"
            ? "Two-wheeler routes are not available here. Try Drive, or open in Google Maps."
            : "Could not draw the route on this map. Use \"Open in Google Maps\" for turn-by-turn navigation."
        );
      } finally {
        setRouteLoading(false);
      }
    },
    [travelMode, userPos]
  );

  const changeTravelMode = (mode) => {
    setTravelMode(mode);
    if (selected && route) showDirections(selected, mode);
  };

  const clearRoute = () => {
    routeLineRef.current?.setMap(null);
    setRoute(null);
    setRouteError("");
  };

  const travelUrl = TRAVEL_MODES.find((m) => m.id === travelMode)?.url || "driving";
  const busy = phase === "loading" || phase === "locating" || phase === "searching";

  const statusText = {
    loading: "Loading Google Maps…",
    locating: "Getting your current location…",
    searching: `Searching charging stations within ${radius / 1000} km…`,
  }[phase];

  return (
    <main className="page stations-page">
      <div className="page-title-row">
        <span className="section-label">📍 Nearby Charging</span>
        <h1>Find a Charging Station</h1>
        <p>
          We use your current location to find EV charging stations around you,
          show which ones are available, and guide you there with directions.
        </p>
      </div>

      {/* ── Controls ── */}
      <div className="stations-toolbar">
        <button className="btn-main" onClick={() => findStations(radius)} disabled={!mapReady || busy}>
          {busy ? "⏳ Searching…" : "📍 Use My Current Location"}
        </button>

        <label className="stations-field">
          <span>Radius</span>
          <select
            value={radius}
            onChange={(e) => {
              const r = Number(e.target.value);
              setRadius(r);
              if (mapReady && !busy) findStations(r);
            }}
          >
            {RADIUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="stations-toggle">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          <span>Show only available</span>
        </label>

        <div className="stations-modes">
          {TRAVEL_MODES.map((m) => (
            <button
              key={m.id}
              className={travelMode === m.id ? "active" : ""}
              onClick={() => changeTravelMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {statusText && <div className="stations-status">{statusText}</div>}
      {userPos && phase === "done" && (
        <div className="stations-location">
          <span>📍 Using your current GPS location</span>
          <code>{userPos.lat.toFixed(5)}, {userPos.lng.toFixed(5)}</code>
        </div>
      )}
      {phase === "error" && error && (
        <div className="stations-error">
          ⚠️ {error}
        </div>
      )}

      <div className="stations-layout">
        {/* ── Map ── */}
        <div className="stations-map-wrap">
          <div ref={mapDivRef} className="stations-map" />
          <div className="stations-legend">
            <span><i style={{ background: STATUS_COLORS.available }} /> Available / Open</span>
            <span><i style={{ background: STATUS_COLORS.busy }} /> Busy</span>
            <span><i style={{ background: STATUS_COLORS.closed }} /> Closed</span>
            <span><i style={{ background: STATUS_COLORS.unknown }} /> Unknown</span>
          </div>
        </div>

        {/* ── List / directions panel ── */}
        <aside className="stations-panel">
          {route || routeError || routeLoading ? (
            <div className="route-card">
              <div className="route-head">
                <div>
                  <span className="route-label">Directions to</span>
                  <h3>{selected?.name}</h3>
                </div>
                <button className="route-close" onClick={clearRoute} title="Back to list">✕</button>
              </div>

              {routeLoading && <p className="stations-muted">Calculating route…</p>}

              {route && !routeLoading && (
                <>
                  <div className="route-summary">
                    <div><strong>{route.duration}</strong><span>Travel time</span></div>
                    <div><strong>{route.distance}</strong><span>Distance</span></div>
                  </div>
                  <ol className="route-steps">
                    {route.steps.map((st, i) => (
                      <li key={i}>
                        <span>{st.text}</span>
                        <em>{st.distance}</em>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {routeError && <p className="stations-error small">{routeError}</p>}

              {selected && (
                <a
                  className="btn-main route-nav"
                  href={googleMapsDirectionsUrl(userPos, selected.location, travelUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  🧭 Start Navigation in Google Maps
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="stations-count">
                {phase === "done" && (
                  <>
                    <strong>{visibleStations.length}</strong> station
                    {visibleStations.length === 1 ? "" : "s"} found within {radius / 1000} km
                  </>
                )}
              </div>

              {usingOpenStreetMap && (
                <div className="stations-source">
                  Google Places is not enabled for this key, so station data is from{" "}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    OpenStreetMap contributors
                  </a>.
                </div>
              )}

              {phase === "done" && visibleStations.length === 0 && (
                <div className="stations-empty">
                  <div>🔌</div>
                  <p>
                    No {onlyAvailable ? "available " : ""}charging stations found nearby.
                    Try increasing the search radius.
                  </p>
                </div>
              )}

              <div className="stations-list">
                {visibleStations.map((s, i) => (
                  <div
                    key={s.id}
                    className={`ev-card ${selectedId === s.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="ev-card-head">
                      <span
                        className="ev-index"
                        style={{ background: STATUS_COLORS[s.availability.status] }}
                      >
                        {i + 1}
                      </span>
                      <div className="ev-title">
                        <h3>{s.name}</h3>
                        <p>{s.address}</p>
                      </div>
                      <span className="ev-distance">{formatDistance(s.distance)}</span>
                    </div>

                    <div className="ev-meta">
                      <span className={`ev-badge ${s.availability.status}`}>
                        {s.availability.label}
                      </span>
                      {s.rating > 0 && (
                        <span className="ev-rating">
                          ⭐ {s.rating.toFixed(1)}
                          {s.ratingCount ? ` (${s.ratingCount})` : ""}
                        </span>
                      )}
                      {s.connectorCount > 0 && (
                        <span className="ev-rating">🔌 {s.connectorCount} connectors</span>
                      )}
                    </div>

                    {s.connectors.length > 0 && (
                      <div className="ev-connectors">
                        {s.connectors.map((c, ci) => (
                          <span key={ci}>
                            {c.type}
                            {c.maxKw ? ` · ${Math.round(c.maxKw)} kW` : ""}
                            {typeof c.available === "number"
                              ? ` · ${c.available}/${c.count} free`
                              : c.count ? ` · ×${c.count}` : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="ev-actions">
                      <button
                        className="btn-main"
                        onClick={(e) => {
                          e.stopPropagation();
                          showDirections(s);
                        }}
                      >
                        🧭 Directions
                      </button>
                      <a
                        className="btn-outline"
                        href={googleMapsDirectionsUrl(userPos, s.location, travelUrl)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open in Maps ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

export default FindStations;
