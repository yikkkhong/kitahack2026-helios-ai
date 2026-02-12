import { useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import {
  CloudSun,
  Loader2,
  MapPin,
  Leaf,
  ArrowRight,
  Settings2,
  X,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";

// --- Types Definition ---
// To avoid red lines, we will force conversion to any when using it, but retain the definition for reference
interface AIReport {
  success?: boolean;
  analysis: {
    internal_thought_process?: string;
    ui_display?: {
      suitability: string;
      installation_method: string;
      reasons: string[];
    };
    financial_report?: {
      estimated_install_cost: number;
      yearly_savings_rm: number;
      roi_years: number;
      breakeven_year: number;
    };
    technical_config: {
      panel_count: number;
      placement: string;
      system_size_kw: number;
      grid_layout?: {
        rows: number;
        columns: number;
      };
      orientation?: "PORTRAIT" | "LANDSCAPE";
      panel_color?: "BLACK" | "BLUE";
    };
    next_steps?: string[];
  };
}

// --- Configuration ---
const CONFIG = {
  GOOGLE_MAPS_API_KEY:
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "API_KEY",
  DEFAULT_CENTER: { lat: 1.3521, lng: 103.8198 },
  SOLAR_API_URL: "https://solar.googleapis.com/v1/buildingInsights:findClosest",
};

const LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [
  "places",
];

const CustomizationPage = () => {
  const [bill, setBill] = useState<number>(300);
  const [budget, setBudget] = useState<number>(15000);
  const [loading, setLoading] = useState(false);

  // raw data returned by the solarData storage API
  const [solarData, setSolarData] = useState<any>(null);

  const [selectedLocation, setSelectedLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>("");

  const [showReport, setShowReport] = useState<boolean>(false);

  // --- User Inputs & AI State ---
  const [specialRequirements, setSpecialRequirements] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // 🔄 State: Storage AI Report
  const [aiReport, setAiReport] = useState<AIReport | null>(null);

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

  // --- Mock Data Generator ---
  const generateMockSolarData = () => {
    console.warn("⚠️ API Unavailable. Switching to Mock Data Mode.");
    return {
      panels: 24,
      sunshineHours: 1650,
      area: 65,
      yearlyOutput: 14200,
      yearlySavings: 7100, // RM
      carbon: 5400,
      isMock: true,
    };
  };

  // 📏 Core Algorithm: Calculates the actual distance (in meters) between two points of latitude and longitude on Earth.
  const getDistanceInMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3; // 地球半径
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // --- Solar Data Processing ---
  // 🟢 Input the precise coordinates of the user's click (userLat, userLng)
  const processSolarData = (data: any) => {
    const potential = data.solarPotential;
    if (!potential) throw new Error("No solar potential data found.");

    const maxPanels = potential.maxArrayPanelsCount;
    const roofArea = potential.maxArrayAreaMeters2;
    const sunshineHours = potential.maxSunshineHoursPerYear || 1800;
    const maxKwhYear = roofArea * 150;
    const moneySavedYear = maxKwhYear * 0.50;
    const carbonOffset = potential.carbonOffsetFactorKgPerMwh
      ? (maxKwhYear / 1000) * potential.carbonOffsetFactorKgPerMwh
      : maxKwhYear * 0.4;

    return {
      panels: maxPanels,
      sunshineHours: Math.round(sunshineHours),
      area: Math.round(roofArea),
      yearlyOutput: Math.round(maxKwhYear),
      yearlySavings: Math.round(moneySavedYear),
      carbon: Math.round(carbonOffset),
      isMock: false,
      solarPotential: potential, 
    };
  };

  // --- Fetch Solar Data ---
  const fetchSolarData = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setLoading(true);
    setError(null);
    setSolarData(null);
    setAiReport(null);

    try {
      console.log("📡 Attempt 1: Acquire Standard High-Resolution Data...");
      let url = `${CONFIG.SOLAR_API_URL}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;

      let response = await fetch(url);

      if (response.status === 404) {
        console.warn("⚠️ Standard data not found. Try switching to Normal/Experimental mode....");
        url = `${CONFIG.SOLAR_API_URL}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=BASE&experiments=EXPANDED_COVERAGE&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
        response = await fetch(url);
      }

      if (!response.ok) {
        console.warn("❌ API requests failed twice; use mock data.");
        setSolarData(generateMockSolarData());
        return;
      }

      const data = await response.json();
      console.log("✅ Successfully acquired Solar data:", data);

      const processed = processSolarData(data);
      setSolarData(processed);
    } catch (err: any) {
      console.error("🔥 System Error:", err);
      setSolarData(generateMockSolarData());
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
      else setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });

    fetchSolarData(lat, lng);
  };

  const navigate = useNavigate();

  // --- Generate AI Report ---
// --- Generate AI Report ---
const generateAIReport = async () => {
    if (!solarData || !selectedLocation) return;

    setAiLoading(true);
    try {
      // CClient timeout set to 120 seconds, to match the backend
      const analyzeWithGemini = httpsCallable(functions, "analyzeWithGemini", { timeout: 120000 });

      const physicalMaxPanels = solarData.panels || 20; 
      const roofArea = solarData.area || 50;

      // Build a lightweight payload; don't cram the entire solarData into it.
      // AI only needs to know about panels and areas; it doesn't need the huge object of solarPotential.
      const slimSolarData = {
          panels: solarData.panels,
          area: solarData.area,
          sunshineHours: solarData.sunshineHours
          // ❌ Absolutely do not share solarPotential
      };

      const result: any = await analyzeWithGemini({
        solarData: slimSolarData, // ✅ Data after weight loss
        userInputs: {
          bill: bill,
          budget: budget,
          specialRequirements: specialRequirements,
          roofConstraint: {
              maxPanels: physicalMaxPanels,
              areaSqM: roofArea
          }
        },
        location: {
          address: address,
        },
      });

      console.log("AI Result:", result.data);

      if (result.data.success) {
        // 将整个结果存入 aiReport
        setAiReport(result.data);
        setShowReport(true);
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("AI Service is temporarily overloaded.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveProject = async () => {
    setLoading(true);
    try {
      console.log("💾 Saving project...");

      // 🔍 Use `any` to bypass type checking and ensure the value can be retrieved.
      const report: any = aiReport || {};
      const currentAnalysis = report.analysis || {};
      const techConfig = currentAnalysis.technical_config || {};

      // 🔥 Core logic: Extracting the actual height from Google Solar API data
      let bestHeight = 30; // Default value (if the API has no data)

      if (solarData && !solarData.isMock && solarData.solarPotential?.roofSegmentStats) {
        const segments = solarData.solarPotential.roofSegmentStats;
        if (segments.length > 0) {
            // Sort by area and find the largest segment.
            segments.sort((a: any, b: any) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0));
            const mainRoof = segments[0];
            
            // Get the altitude measured by Google
            if (mainRoof.planeHeightAtCenterMeters) {
                bestHeight = mainRoof.planeHeightAtCenterMeters;
                console.log("🎯 Precise altitude provided by Google Solar API:", bestHeight);
            }
        }
      }

      // Preparing the Blueprint
      const blueprint = {
        technical_config: {
          panel_count: techConfig.panel_count || 20,
          grid_layout: techConfig.grid_layout || { rows: 4, columns: 5 },
          orientation: techConfig.orientation || "PORTRAIT",
          azimuth: 180,
          tilt: 20,
          roof_height: bestHeight, // ✅ Save actual height
        },
        visual: {
          panel_color: techConfig.panel_color || "BLACK",
          mounting_type: "ROOF_FLUSH",
        },
        financial: currentAnalysis.financial_report || {},
      };

      // Store in LocalStorage
      localStorage.setItem("step2_solar_blueprint", JSON.stringify(blueprint));

      if (selectedLocation) {
        localStorage.setItem("step2_lat", selectedLocation.lat.toString());
        localStorage.setItem("step2_lng", selectedLocation.lng.toString());
      }

      navigate("/simulation");
    } catch (error) {
      console.error("❌ Save failed:", error);
      navigate("/simulation");
    } finally {
      setLoading(false);
    }
  };

  // Adding ": any" will prevent TypeScript from throwing errors when using fields like ".financial_report" below.
  const analysisData: any = aiReport?.analysis || {};

  if (!isLoaded)
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="animate-spin mr-2" /> Loading Helios Maps...
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

        {/* Address Input */}
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
              placeholder="Search Singapore address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-zinc-800 text-white border border-gray-600 rounded-lg p-3 outline-none focus:border-blue-500 transition-all"
            />
          </Autocomplete>
        </div>

        {/* Sliders */}
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

        {/* Special Requirements */}
        <div className="mb-6">
          <label className="text-sm text-gray-300 font-medium flex gap-1 items-center mb-2">
            <MessageSquare size={16} className="text-purple-400" />
            <span className="bg-purple-900/30 text-purple-200 text-xs px-2 py-0.5 rounded ml-1">
              AI Context
            </span>
          </label>
          <textarea
            value={specialRequirements}
            onChange={(e) => setSpecialRequirements(e.target.value)}
            placeholder="Tell AI: 'I live in a condo with no balcony' or 'I am renting'..."
            className="w-full bg-zinc-800 text-white border border-gray-600 rounded-lg p-3 outline-none focus:border-purple-500 min-h-[100px] text-sm transition-all"
          />
        </div>

        {/* Status Messages */}
        {solarData && solarData.isMock && (
          <div className="p-3 bg-yellow-900/20 text-yellow-200 text-xs mb-4 rounded border border-yellow-500/20 flex gap-2 items-center">
            <span>
              ⚠️ Region not fully scanned. Using estimated data for AI analysis.
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto pt-6">
          <button
            onClick={generateAIReport}
            disabled={loading || aiLoading || !solarData}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg shadow-lg hover:from-blue-500 hover:to-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
          >
            {loading || aiLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles size={18} className="fill-white/20" />
            )}
            {loading
              ? "Scanning Roof..."
              : aiLoading
              ? "AI Analyzing Constraints..."
              : solarData
              ? "Generate AI Strategy"
              : "Select Location First"}
          </button>
        </div>
      </div>

      {/* --- Right Panel: Map --- */}
      <div className="flex-1 h-screen relative">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={CONFIG.DEFAULT_CENTER}
          zoom={14}
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

      {/* --- AI REPORT MODAL --- */}
      {showReport && solarData && aiReport && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-900/95 sticky top-0 z-20 backdrop-blur-sm">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="text-purple-400" /> Helios AI Analysis
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Powered by Gemini 2.5 •{" "}
                  <span className="text-green-400">
                    Constraint-Aware Engine
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowReport(false)}
                className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* AI Reasoning Section */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-b from-purple-900/10 to-zinc-900/30">
              {/* Suitability Badge */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm font-medium">
                    Status:
                  </span>
                  <span
                    className={`px-3 py-1 text-sm font-bold rounded-full border ${
                      analysisData.ui_display?.suitability?.includes("Suitable")
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    }`}
                  >
                    {analysisData.ui_display?.suitability}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm font-medium">
                    Method:
                  </span>
                  <span className="px-3 py-1 text-sm font-bold rounded-full border bg-white/10 text-white border-white/20">
                    {analysisData.ui_display?.installation_method}
                  </span>
                </div>
              </div>

              {/* Reasoning List */}
              <div className="bg-black/40 rounded-xl p-5 border border-white/5">
                <div className="text-purple-300 font-medium mb-3 flex items-center gap-2 text-sm">
                  <MessageSquare size={14} /> Why this solution?
                </div>
                <ul className="space-y-3">
                  {analysisData.ui_display?.reasons?.map(
                    (reason: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex gap-3 items-start text-gray-300 text-sm"
                      >
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                        <span className="leading-relaxed">{reason}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>

            {/* Financial & Technical Grid */}
            <div className="p-6 bg-zinc-900">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">
                Projected Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Card 1: Panel Count */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Recommended System
                  </div>
                  <div className="text-xl font-bold text-white">
                    {analysisData.technical_config?.panel_count}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      Panels
                    </span>
                  </div>
                  <div className="text-xs text-blue-400 mt-1 capitalize">
                    {analysisData.technical_config?.placement?.replace(
                      "_",
                      " "
                    )}{" "}
                    Mount
                  </div>
                </div>

                {/* Card 2: Savings */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Est. Yearly Savings
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    RM{" "}
                    {analysisData.financial_report?.yearly_savings_rm?.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600/70 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> ROI:{" "}
                    {analysisData.financial_report?.roi_years} Years
                  </div>
                </div>

                {/* Card 3: Install Cost */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Est. Install Cost
                  </div>
                  <div className="text-xl font-bold text-white">
                    RM{" "}
                    {analysisData.financial_report?.estimated_install_cost?.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Market Avg.</div>
                </div>

                {/* Card 4: Carbon */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Carbon Offset
                  </div>
                  <div className="text-xl font-bold text-white">
                    {solarData.carbon}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      kg
                    </span>
                  </div>
                  <div className="text-xs text-green-500/70 mt-1 flex items-center gap-1">
                    <Leaf size={12} /> Eco-friendly
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="p-6 bg-zinc-900 border-t border-white/10 flex gap-4 sticky bottom-0 z-20">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition flex items-center justify-center gap-2 border border-white/5"
              >
                <Settings2 size={18} /> Modify Inputs
              </button>

              <button
                onClick={handleSaveProject}
                disabled={loading}
                className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
                {loading ? "Creating Project..." : "Visualize in 3D"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomizationPage;