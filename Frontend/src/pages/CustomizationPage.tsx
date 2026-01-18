import { useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { CloudSun, Save, Loader2 } from "lucide-react";

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

// --- Configuration ---
const CONFIG = {
  GOOGLE_MAPS_API_KEY:
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyBqdYJ84VFITPzIoMaxUV6BFeTePCYruBM",
  DEFAULT_CENTER: { lat: 3.139, lng: 101.6869 }, // KL
  SOLAR_API_URL: "https://solar.googleapis.com/v1/buildingInsights:findClosest",
};

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
];

const CustomizationPage = () => {
  // --- 1. State Definitions (This is why the name might not be found previously)---
  const [bill, setBill] = useState<number>(200);
  const [budget, setBudget] = useState<number>(15000);
  const [loading, setLoading] = useState(false);
  const [solarData, setSolarData] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load Google Maps Script
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: CONFIG.GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // --- Logic: Process Data ---
  const processSolarData = (data: any) => {
    const potential = data.solarPotential;

    if (!potential) {
      throw new Error("No solar potential data found for this roof.");
    }

    const maxPanels = potential.maxArrayPanelsCount;
    const maxKwhYear = potential.maxArrayAreaMeters2 * 150;
    const moneySavedYear = maxKwhYear * 0.5;
    const carbonOffset = potential.carbonOffsetFactorKgPerMwh
      ? ((maxKwhYear / 1000) * potential.carbonOffsetFactorKgPerMwh) / 1000
      : 0;

    setSolarData({
      panels: maxPanels,
      yearlyOutput: maxKwhYear.toFixed(0),
      yearlySavings: moneySavedYear.toFixed(0),
      carbon: carbonOffset.toFixed(2),
      area: potential.maxArrayAreaMeters2.toFixed(1),
    });
  };

  // --- Logic: Handle Map Click ---
  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

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
            "No solar data here. Try clicking the center of a roof.",
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

  // --- Logic: Save to Backend (调用你的 Backend Function) ---
  const handleSaveProject = async () => {
    if (!solarData || !selectedLocation) return;
    setLoading(true); // Reuse loading state for saving

    try {
      // 1. Link to backend function 'createSolarProject'
      const createProjectApi = httpsCallable(functions, "createSolarProject");

      // 2. 发送数据
      const result: any = await createProjectApi({
        location: selectedLocation,
        bill: bill, // The error "cannot find name 'bill'" will no longer occur here because it has been defined above
        budget: budget, // same for budget
        analysis: solarData,
      });

      console.log("Backend Response:", result.data);
      alert("Project saved successfully! Check your Firebase Console.");
    } catch (error) {
      console.error("Backend Error:", error);
      alert("Failed to save project. See console for details.");
    } finally {
      setLoading(false);
    }
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
      <div className="absolute top-0 left-0 z-10 w-full md:w-[400px] h-auto md:h-screen bg-black/80 backdrop-blur-xl border-r border-white/10 p-8 flex flex-col overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white">
            <CloudSun className="text-blue-400" /> Helios Analysis
          </h1>
          <p className="text-gray-400 text-sm">Step 1: Configure your needs</p>
        </div>

        {/* Input: Bill */}
        <div className="mb-8 space-y-4">
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

        {/* Input: Budget */}
        <div className="mb-8 space-y-4">
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

        {/* Results Area */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        {solarData && (
          <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-700">
            <div className="h-px w-full bg-white/10 my-4"></div>
            <h3 className="text-lg font-semibold text-white">
              Analysis Results
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 p-4 rounded-xl border border-white/5">
                <div className="text-gray-400 text-xs mb-1">Yearly Savings</div>
                <div className="text-xl font-mono text-green-400">
                  RM {solarData.yearlySavings}
                </div>
              </div>
              <div className="bg-zinc-900 p-4 rounded-xl border border-white/5">
                <div className="text-gray-400 text-xs mb-1">Max Panels</div>
                <div className="text-xl font-mono text-white">
                  {solarData.panels}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6">
              <button
                onClick={handleSaveProject}
                disabled={loading}
                className="w-full py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {loading ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Right Panel: Map --- */}
      <div className="flex-1 h-screen relative">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={CONFIG.DEFAULT_CENTER}
          zoom={18}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={{
            styles: mapStyles,
            disableDefaultUI: true,
            zoomControl: true,
            tilt: 45,
          }}
        >
          {selectedLocation && <Marker position={selectedLocation} />}
        </GoogleMap>
      </div>
    </div>
  );
};

export default CustomizationPage;
