import { useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import {
  CloudSun,
  Save,
  Loader2,
  MapPin,
  Zap,
  Sun,
  Leaf,
  ArrowRight,
  Settings2,
  X,
} from "lucide-react";

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";

// --- Configuration ---
const CONFIG = {
  GOOGLE_MAPS_API_KEY:
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyBqdYJ84VFITPzIoMaxUV6BFeTePCYruBM",
  DEFAULT_CENTER: { lat: 3.140853, lng: 101.693207 }, // KL
  SOLAR_API_URL: "https://solar.googleapis.com/v1/buildingInsights:findClosest",
};

const LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [
  "places",
];

const CustomizationPage = () => {
  const [bill, setBill] = useState<number>(200);
  const [budget, setBudget] = useState<number>(15000);
  const [loading, setLoading] = useState(false);
  const [solarData, setSolarData] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("");

  // --- Added: Control the display of the report pop-up window ---
  const [showReport, setShowReport] = useState<boolean>(false);

  // Load Google Maps Script
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: CONFIG.GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);
  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);
  const onLoadAutocomplete = (
    autocomplete: google.maps.places.Autocomplete,
  ) => {
    autocompleteRef.current = autocomplete;
  };

  // --- Upgraded Logic: Process Data (Extracts more advanced data) ---
  const processSolarData = (data: any) => {
    const potential = data.solarPotential;
    if (!potential)
      throw new Error("No solar potential data found for this roof.");

    // 1. Get panel maximum capacity
    const maxPanels = potential.maxArrayPanelsCount;
    // 2. Annual sunshine duration
    const sunshineHours = potential.maxSunshineHoursPerYear || 1800;
    // 3. Total usable roof area (square meters)
    const roofArea = potential.maxArrayAreaMeters2;
    // 4. Annual power generation (kWh), calculated based on approximately 150 kWh produced per square meter of panel.
    const maxKwhYear = roofArea * 150;
    // 5. The money saved each year (assuming Malaysian electricity cost is RM0.5/kWh)
    const moneySavedYear = maxKwhYear * 0.5;
    // 6. Carbon neutrality (equivalent to how many trees to plant)
    const carbonOffset = potential.carbonOffsetFactorKgPerMwh
      ? (maxKwhYear / 1000) * potential.carbonOffsetFactorKgPerMwh
      : maxKwhYear * 0.4; // If the API is not provided, use the Malaysian average coefficient of 0.4 kg/kWh for estimation.

    setSolarData({
      panels: maxPanels,
      sunshineHours: Math.round(sunshineHours),
      area: Math.round(roofArea),
      yearlyOutput: Math.round(maxKwhYear),
      yearlySavings: Math.round(moneySavedYear),
      carbon: Math.round(carbonOffset),
    });
  };

  const fetchSolarData = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setLoading(true);
    setError(null);
    setSolarData(null);

    try {
      const url = `${CONFIG.SOLAR_API_URL}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=BASE&experiments=EXPANDED_COVERAGE&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404)
          throw new Error(
            "No roof detected here. Try clicking the center of a building.",
          );
        throw new Error("API Error");
      }

      const data = await response.json();
      processSolarData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze roof.");
    } finally {
      setLoading(false);
    }
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setAddress(place.formatted_address || place.name || "");
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(20);
        fetchSolarData(lat, lng);
      }
    }
  };

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results && results[0])
        setAddress(results[0].formatted_address);
    });

    fetchSolarData(lat, lng);
  };

  const navigate = useNavigate();

  function goToVirtualRoom() {
    navigate("/simulation");
  }

  const handleSaveProject = async () => {
    setLoading(true);
    try {
      const createProjectApi = httpsCallable(functions, "createSolarProject");
      await createProjectApi({
        location: selectedLocation,
        bill: bill,
        budget: budget,
        analysis: solarData,
      });

      localStorage.setItem("step2_lat", selectedLocation!.lat.toString());
      localStorage.setItem("step2_lng", selectedLocation!.lng.toString());

      alert("Project saved! Navigating to 3D View...");
      // navigate('/step2');
    } catch (error) {
      console.error(error);
      alert("Failed to save project.");
    } finally {
      setLoading(false);
    }

    goToVirtualRoom();
  };

  if (!isLoaded)
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white">
        Loading Maps...
      </div>
    );

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col md:flex-row">
      {/* --- Left Panel --- */}
      <div className="absolute top-0 left-0 z-10 w-full md:w-[420px] h-auto md:h-screen bg-black/85 backdrop-blur-xl border-r border-white/10 p-8 flex flex-col overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white">
            <CloudSun className="text-blue-400" /> Helios AI
          </h1>
          <p className="text-gray-400 text-sm">Step 1: Locate & Configure</p>
        </div>

        {/* address input */}
        <div className="mb-6">
          <label className="text-sm text-gray-300 font-medium flex gap-1 items-center mb-2">
            <MapPin size={16} className="text-red-400" /> Find Your Home
          </label>
          <Autocomplete
            onLoad={onLoadAutocomplete}
            onPlaceChanged={onPlaceChanged}
          >
            <input
              type="text"
              placeholder="Search or click map..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-zinc-800 text-white border border-gray-600 rounded-lg p-3 outline-none focus:border-blue-500"
            />
          </Autocomplete>
        </div>

        {/* budget adjustment */}
        <div className="mb-6 space-y-4">
          <label className="text-sm text-gray-300 font-medium flex justify-between">
            <span>Avg. Monthly Bill</span>
            <span className="text-blue-400">RM {bill}</span>
          </label>
          <input
            type="range"
            min="50"
            max="2000"
            step="10"
            value={bill}
            onChange={(e) => setBill(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="mb-6 space-y-4">
          <label className="text-sm text-gray-300 font-medium flex justify-between">
            <span>Est. Budget</span>
            <span className="text-green-400">RM {budget.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min="5000"
            max="100000"
            step="1000"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 text-red-200 text-sm mb-4 rounded">
            {error}
          </div>
        )}

        {/* --- [Change] Once the data is retrieved, it will no longer be displayed directly; instead, a "Generate Report" button will be shown. --- */}
        <div className="mt-auto pt-6">
          <button
            onClick={() => setShowReport(true)}
            disabled={loading || !solarData}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-700"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
            {loading
              ? "Analyzing Roof..."
              : solarData
                ? "Generate AI Report"
                : "Select Location First"}
          </button>
        </div>
      </div>

      {/* --- Right Panel --- */}
      <div className="flex-1 h-screen relative">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={CONFIG.DEFAULT_CENTER}
          zoom={18}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={{
            mapTypeId: "hybrid",
            disableDefaultUI: true,
            zoomControl: true,
            tilt: 0,
          }}
        >
          {selectedLocation && <Marker position={selectedLocation} />}
        </GoogleMap>
      </div>

      {/* ================================================================= */}
      {/* ---[New Feature] Pop-up Layer: Beautiful Analysis Report Modal--- */}
      {/* ================================================================= */}
      {showReport && solarData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            {/* Pop-up header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-800/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CloudSun className="text-blue-400" /> Your Solar Potential
                Report
              </h2>
              <button
                onClick={() => setShowReport(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* report main data*/}
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-center">
                <Sun className="mx-auto text-yellow-500 mb-2" size={24} />
                <div className="text-gray-400 text-xs">Annual Sunshine</div>
                <div className="text-xl font-bold text-white">
                  {solarData.sunshineHours}{" "}
                  <span className="text-sm text-gray-500">hrs</span>
                </div>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-center">
                <Zap className="mx-auto text-blue-400 mb-2" size={24} />
                <div className="text-gray-400 text-xs">Yearly Output</div>
                <div className="text-xl font-bold text-white">
                  {solarData.yearlyOutput}{" "}
                  <span className="text-sm text-gray-500">kWh</span>
                </div>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-center">
                <Leaf className="mx-auto text-green-500 mb-2" size={24} />
                <div className="text-gray-400 text-xs">Carbon Offset</div>
                <div className="text-xl font-bold text-white">
                  {solarData.carbon}{" "}
                  <span className="text-sm text-gray-500">kg CO₂</span>
                </div>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-center">
                <div className="text-gray-400 text-xs mb-1">
                  Usable Roof Area
                </div>
                <div className="text-lg font-bold text-white">
                  {solarData.area} m²
                </div>
              </div>

              <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-center">
                <div className="text-gray-400 text-xs mb-1">
                  Max Panels Capacity
                </div>
                <div className="text-lg font-bold text-white">
                  {solarData.panels} Panels
                </div>
              </div>

              <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-500/30 text-center">
                <div className="text-blue-200 text-xs mb-1">
                  Est. Yearly Savings
                </div>
                <div className="text-xl font-bold text-green-400">
                  RM {solarData.yearlySavings}
                </div>
              </div>
            </div>

            {/* bottom button control */}
            <div className="p-6 bg-black/50 flex gap-4">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-3 bg-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-600 transition flex items-center justify-center gap-2"
              >
                <Settings2 size={18} /> Re-adjust Inputs
              </button>

              <button
                onClick={handleSaveProject}
                disabled={loading}
                className="flex-[2] py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
                {loading ? "Saving to Cloud..." : "Confirm & View in 3D"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomizationPage;
