import { useState, useCallback, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from '@react-google-maps/api';
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
  Unlock,
  Activity,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  GripHorizontal,
  Info,
} from 'lucide-react';

import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import GlobalStepper from '../components/GlobalStepper';
import Draggable from 'react-draggable';

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
    asset_potential?: {
      total_eru_10yr: number;
      initial_grant_eru: number;
      eru_peg_rate_rm: number;
      total_fiat_value_10yr: number;
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
      orientation?: 'PORTRAIT' | 'LANDSCAPE';
      panel_color?: 'BLACK' | 'BLUE';
    };
    next_steps?: string[];
  };
}

// --- Configuration ---
const CONFIG = {
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'API_KEY',
  DEFAULT_CENTER: { lat: 1.3521, lng: 103.8198 },
  SOLAR_API_URL: 'https://solar.googleapis.com/v1/buildingInsights:findClosest',
};

const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'visualization')[] = [
  'places',
];

const CustomizationPage = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [bill, setBill] = useState<number>(300);
  const [budget, setBudget] = useState<number>(15000);
  const [loading, setLoading] = useState(false);

  // raw data returned by the solarData storage API
  const [solarData, setSolarData] = useState<any>(null);

  const [selectedLocation, setSelectedLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string>('');

  const [showReport, setShowReport] = useState<boolean>(false);

  const [showPricingLogic, setShowPricingLogic] = useState(false);

  // --- User Inputs & AI State ---
  const [specialRequirements, setSpecialRequirements] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Future Concerns Option
  const [selectedConcern, setSelectedConcern] = useState<string>('None');

  const futureConcerns = [
    { id: 'None', label: 'No major changes expected' },
    { id: 'Relocation', label: 'Might move house in 3-5 years' },
    { id: 'EmptyNest', label: 'Kids moving out (Lower energy needs)' },
    { id: 'Liquidity', label: 'Worried about locking up cash' },
  ];

  // 🔄 State: Storage AI Report
  const [aiReport, setAiReport] = useState<AIReport | null>(null);

  // Load Google Maps Script
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: CONFIG.GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const draggableRef = useRef<HTMLDivElement>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);
  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);
  const onLoadAutocomplete = (
    autocomplete: google.maps.places.Autocomplete
  ) => {
    autocompleteRef.current = autocomplete;
  };

  // --- Mock Data Generator ---
  const generateMockSolarData = () => {
    console.warn('⚠️ API Unavailable. Switching to Mock Data Mode.');
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

  // Calculates the actual distance (in meters) between two points of latitude and longitude on Earth.
  const getDistanceInMeters = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ) => {
    const R = 6371e3; // Earth radius
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- Solar Data Processing ---
  // 🟢 Input the precise coordinates of the user's click (userLat, userLng)
  const processSolarData = (data: any) => {
    const potential = data.solarPotential;
    if (!potential) throw new Error('No solar potential data found.');

    const maxPanels = potential.maxArrayPanelsCount;
    const roofArea = potential.maxArrayAreaMeters2;
    const sunshineHours = potential.maxSunshineHoursPerYear || 1800;
    const maxKwhYear = roofArea * 150;
    const moneySavedYear = maxKwhYear * 0.5;
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
      console.log('📡 Attempt 1: Acquire Standard High-Resolution Data...');
      let url = `${CONFIG.SOLAR_API_URL}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;

      let response = await fetch(url);

      if (response.status === 404) {
        console.warn(
          '⚠️ Standard data not found. Try switching to Normal/Experimental mode....'
        );
        url = `${CONFIG.SOLAR_API_URL}?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=BASE&experiments=EXPANDED_COVERAGE&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;
        response = await fetch(url);
      }

      if (!response.ok) {
        console.warn('❌ API requests failed twice; use mock data.');
        setSolarData(generateMockSolarData());
        return;
      }

      const data = await response.json();
      console.log('✅ Successfully acquired Solar data:', data);

      const processed = processSolarData(data);
      setSolarData(processed);
    } catch (err: any) {
      console.error('🔥 System Error:', err);
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
        setAddress(place.formatted_address || place.name || '');
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
      if (status === 'OK' && results && results[0])
        setAddress(results[0].formatted_address);
      else setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });

    fetchSolarData(lat, lng);
  };

  const navigate = useNavigate();

  // --- Generate AI Report ---
  const generateAIReport = async () => {
    if (!solarData || !selectedLocation) return;

    setAiLoading(true);
    try {
      // CClient timeout set to 120 seconds, to match the backend
      const analyzeWithGemini = httpsCallable(functions, 'analyzeWithGemini', {
        timeout: 120000,
      });

      const physicalMaxPanels = solarData.panels || 20;
      const roofArea = solarData.area || 50;

      // Build a lightweight payload; don't cram the entire solarData into it.
      // AI only needs to know about panels and areas; it doesn't need the huge object of solarPotential.
      const slimSolarData = {
        panels: solarData.panels,
        area: solarData.area,
        sunshineHours: solarData.sunshineHours,
        // ❌ Absolutely do not share solarPotential
      };

      const result: any = await analyzeWithGemini({
        solarData: slimSolarData, // ✅ Data after weight loss
        userInputs: {
          bill: bill,
          budget: budget,
          specialRequirements: `User Concern: ${selectedConcern}. Notes: ${specialRequirements}`,
          roofConstraint: {
            maxPanels: physicalMaxPanels,
            areaSqM: roofArea,
          },
        },
        location: {
          address: address,
        },
      });

      console.log('AI Result:', result.data);

      if (result.data.success) {
        // Store the entire result in aiReport
        setAiReport(result.data);
        setShowReport(true);
      }
    } catch (error) {
      console.error('AI Generation Error:', error);
      alert('AI Service is temporarily overloaded.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveProject = async () => {
    setLoading(true);
    try {
      console.log('💾 Saving project...');

      // 🔍 Use `any` to bypass type checking and ensure the value can be retrieved.
      const report: any = aiReport || {};
      const currentAnalysis = report.analysis || {};
      const techConfig = currentAnalysis.technical_config || {};

      // 🔥 Core logic: Extracting the actual height from Google Solar API data
      let bestHeight = 30; // Default value (if the API has no data)

      if (
        solarData &&
        !solarData.isMock &&
        solarData.solarPotential?.roofSegmentStats
      ) {
        const segments = solarData.solarPotential.roofSegmentStats;
        if (segments.length > 0) {
          // Sort by area and find the largest segment.
          segments.sort(
            (a: any, b: any) =>
              (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0)
          );
          const mainRoof = segments[0];

          // Get the altitude measured by Google
          if (mainRoof.planeHeightAtCenterMeters) {
            bestHeight = mainRoof.planeHeightAtCenterMeters;
            console.log(
              '🎯 Precise altitude provided by Google Solar API:',
              bestHeight
            );
          }
        }
      }

      let finalPlacement = techConfig.placement || 'ROOFTOP';
      let finalPanelCount = techConfig.panel_count || 20;

      if (finalPlacement.toUpperCase().includes('BALCONY')) {
        console.log(
          '🏢 Apartment mode detected: Automatically apply 2-Panel Starter Kit'
        );
        finalPanelCount = 2;
        // The logic here is: the AI ​​might suggest 10 panels based on the electricity cost.
        // However, in order for the SimulationPage to display correctly and conform to the laws of physics, we need to "press" it back to 2 pieces.
      }

      // Preparing the Blueprint
      const blueprint = {
        technical_config: {
          panel_count: finalPanelCount,
          grid_layout: techConfig.grid_layout || { rows: 4, columns: 5 },
          orientation: techConfig.orientation || 'PORTRAIT',
          azimuth: 180,
          tilt: 20,
          roof_height: bestHeight, // ✅ Save actual height
          placement: finalPlacement,
        },
        visual: {
          panel_color: techConfig.panel_color || 'BLACK',
          mounting_type: 'ROOF_FLUSH',
        },
        financial: currentAnalysis.financial_report || {},
      };

      // Store in LocalStorage
      // Also store the selected concern and location for use in the SimulationPage, so that we can display it in the UI and use it in the logic there.
      localStorage.setItem('step2_solar_blueprint', JSON.stringify(blueprint));
      localStorage.setItem('step1_concern', selectedConcern || 'Relocation');

      if (selectedLocation) {
        localStorage.setItem('step2_lat', selectedLocation.lat.toString());
        localStorage.setItem('step2_lng', selectedLocation.lng.toString());
      }

      navigate('/simulation', {
        state: {
          blueprintData: blueprint,
          concernData: selectedConcern || 'Relocation',
        },
      });
    } catch (error) {
      console.error('❌ Save failed:', error);
      navigate('/simulation');
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
    // The outermost layer is still a full-screen anti-scrolling layer.
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans flex flex-col">
      {/* ========================================================= */}
      {/* 🌍 Full-screen underlying map                             */}
      {/* ========================================================= */}
      <div className="absolute inset-0 z-0">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={CONFIG.DEFAULT_CENTER}
          zoom={14}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={{
            mapTypeId: 'hybrid',
            disableDefaultUI: true,
            zoomControl: false,
            tilt: 0,
          }}
        >
          {selectedLocation && <Marker position={selectedLocation} />}
        </GoogleMap>
      </div>

      {/* ========================================================= */}
      {/* 🌟 interaction layer */}
      {/* ========================================================= */}
      <div className="absolute inset-0 z-10 pointer-events-none p-6">
        {/* Top-fixed Stepper */}
        <div className="pointer-events-auto relative z-50">
          <GlobalStepper currentStep={1} onBack={() => navigate('/')} />
        </div>

        {/* ============================================================== */}
        {/* 🚀 Draggable, foldable, fully-fledged floating control console */}
        {/* ============================================================== */}
        <Draggable nodeRef={draggableRef} handle=".drag-handle" bounds="parent">
          <div
            ref={draggableRef} // Must add this ref, otherwise React will crash and display a black screen!
            className={`pointer-events-auto absolute top-24 left-6 w-[90%] md:w-[420px] bg-black/70 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col transition-all duration-300 z-40 overflow-hidden`}
            style={{ maxHeight: isCollapsed ? '80px' : 'calc(100vh - 120px)' }}
          >
            {/* 1. Drag and drop handles & title bar (Header) */}
            <div className="drag-handle flex items-center justify-between p-5 border-b border-white/5 cursor-move bg-white/5 hover:bg-white/10 transition-colors shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-500/20 p-2 rounded-xl border border-cyan-500/30">
                  <CloudSun className="text-cyan-400" size={24} />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white leading-tight tracking-wide drop-shadow-lg">
                    Helios AI
                  </h1>
                  <p className="text-cyan-400 text-[9px] font-bold tracking-[0.2em] uppercase mt-0.5">
                    Property Parameters
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Drag and drop the icon */}
                <GripHorizontal size={16} className="text-gray-500 mr-2" />
                {/* Collapse control button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCollapsed(!isCollapsed);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronUp size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* 2. Form content area (rendered only when not collapsed) */}
            {!isCollapsed && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Scrolling area (removed the exaggerated capitalization and wide spacing, restoring a clean SaaS font layout) */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-none">
                  {/* Address Input */}
                  <div className="mb-6">
                    <label className="text-sm text-gray-300 font-medium flex gap-2 items-center mb-2">
                      <MapPin size={16} className="text-red-400" /> Find Your
                      Home
                    </label>
                    <Autocomplete
                      onLoad={onLoadAutocomplete}
                      onPlaceChanged={onPlaceChanged}
                    >
                      <input
                        type="text"
                        placeholder="Search your address..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-black/40 text-white border border-gray-600 rounded-lg p-3 outline-none focus:border-cyan-500 transition-all placeholder:text-gray-500"
                      />
                    </Autocomplete>
                  </div>

                  {/* Sliders */}
                  <div className="mb-6 space-y-4">
                    <label className="text-sm text-gray-300 font-medium flex justify-between items-center">
                      <span>Avg. Monthly Bill</span>
                      <span className="text-cyan-400 font-bold">RM {bill}</span>
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="2000"
                      step="10"
                      value={bill}
                      onChange={(e) => setBill(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  {/* Est. Budget Slider with Expandable Explanation */}
                  <div className="mb-6 space-y-4">
                    <label className="text-sm text-gray-300 font-medium flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        Est. Budget
                        {/* Clicking it triggers a folding switch. */}
                        <button
                          onClick={() => setShowPricingLogic(!showPricingLogic)}
                          className={`transition-colors ${showPricingLogic ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'}`}
                        >
                          <Info size={14} />
                        </button>
                      </span>
                      <span className="text-green-400 font-bold">
                        RM {budget.toLocaleString()}
                      </span>
                    </label>
                    <input
                      type="range"
                      min="5000"
                      max="100000"
                      step="1000"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />

                    {/* Click on Info button to open the science information panel */}
                    {showPricingLogic && (
                      <div className="bg-cyan-900/20 border border-cyan-500/30 p-4 rounded-xl text-xs text-cyan-100/80 leading-relaxed mt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="font-bold text-cyan-400 mb-2 tracking-widest uppercase text-[10px]">
                          Market Validation Logic
                        </div>
                        <ul className="space-y-2">
                          <li>
                            <strong className="text-white">
                              Why ~RM 1,500 per panel?
                            </strong>
                            <br />
                            We calculate the{' '}
                            <span className="text-cyan-300 italic">
                              Fully Installed Blended Cost
                            </span>
                            . While a raw 450W panel costs ~RM 500, the Malaysia
                            market average including inverter, mounting, TNB
                            application, and labor is RM 3.5k - RM 4k per kWp.
                          </li>
                          <li>
                            <strong className="text-white">
                              Why RM 0.50 per kWh?
                            </strong>
                            <br />
                            Malaysia's TNB domestic tariff is tiered. Target
                            users for solar systems typically exceed 600
                            kWh/month, placing them in the highest bracket (RM
                            0.571/kWh). We use RM 0.50 as a conservative,
                            baseline peg rate for ERU.
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Future Outlook */}
                  <div className="mb-6">
                    <label className="text-sm text-gray-300 font-medium flex gap-2 items-center mb-3">
                      <Activity size={16} className="text-purple-400" /> Future
                      Outlook (The "Blind Gamble")
                    </label>
                    <div className="flex flex-col gap-2">
                      {futureConcerns.map((concern) => (
                        <button
                          key={concern.id}
                          onClick={() => setSelectedConcern(concern.id)}
                          className={`text-left px-4 py-3 rounded-lg text-sm transition-all border ${
                            selectedConcern === concern.id
                              ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                              : 'bg-zinc-800/50 border-gray-700 text-gray-400 hover:bg-zinc-700 hover:border-gray-500'
                          }`}
                        >
                          {concern.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Property Notes */}
                  <div className="mb-4">
                    <label className="text-sm text-gray-300 font-medium flex gap-2 items-center mb-2">
                      <MessageSquare size={16} className="text-blue-400" />{' '}
                      Property Type & Notes
                    </label>
                    <textarea
                      value={specialRequirements}
                      onChange={(e) => setSpecialRequirements(e.target.value)}
                      placeholder="e.g., 'I live in a Condo', 'No roof access'..."
                      className="w-full bg-zinc-800/80 text-white border border-gray-700 rounded-lg p-3 outline-none focus:border-blue-500 min-h-[80px] text-sm transition-all resize-none placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {/* The sticky bottom button area (always visible, does not scroll with the page) */}
                <div className="p-5 border-t border-white/5 bg-black/40 shrink-0">
                  <button
                    onClick={generateAIReport}
                    disabled={loading || aiLoading || !solarData}
                    className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 uppercase tracking-widest text-xs"
                  >
                    {loading || aiLoading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Sparkles size={18} />
                    )}
                    {loading
                      ? 'Scanning Area...'
                      : aiLoading
                        ? 'AI Processing...'
                        : solarData
                          ? 'Generate AI Strategy'
                          : 'Select Location'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Draggable>
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
                  Powered by Gemini 2.5 •{' '}
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
                      analysisData.ui_display?.suitability?.includes('Suitable')
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
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

            {/* Financial, Technical & Asset Grid */}
            <div className="p-6 bg-zinc-900">
              {/* Asset Management Popular Science Banner*/}
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/40 to-blue-900/20 border border-purple-500/30 rounded-xl">
                <h3 className="text-purple-300 font-bold mb-2 flex items-center gap-2">
                  <Sparkles size={16} /> Solar Assetization Activated
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Your system doesn't just save electricity—it mints{' '}
                  <strong className="text-purple-400">
                    Energy Revenue Units (ERU)
                  </strong>
                  .
                  <br />
                  <span className="text-xs text-gray-400 mt-1 inline-block">
                    ⚡ 1 ERU = 1 kWh produced. <br />
                    💰 You can <b>Hold</b>, <b>Buy</b>, or <b>Sell</b> ERUs for
                    cash anytime.
                  </span>
                </p>
              </div>

              {/* 🟢 First row: Digital Asset Indicators (ERU Assets)*/}
              <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                Your Digital Assets
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {/* 1. total amount */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-5">
                    <Activity size={64} />
                  </div>
                  <div className="text-gray-500 text-xs mb-1">
                    10-Year ERU Cap
                  </div>
                  <div className="text-xl font-bold text-white">
                    {analysisData.asset_potential?.total_eru_10yr?.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-gray-500">
                      ERU
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Total Mined Potential
                  </div>
                </div>

                {/* 2. Initial distribution (highlighted) */}
                <div className="bg-gradient-to-br from-green-900/40 to-zinc-800/50 p-4 rounded-xl border border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)] relative overflow-hidden">
                  <div className="absolute -right-2 -top-2 opacity-10">
                    <Unlock size={48} />
                  </div>
                  <div className="text-green-400/90 text-xs mb-1 font-bold flex items-center gap-1">
                    Initial Unlocked
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {analysisData.asset_potential?.initial_grant_eru?.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-500/70 mt-1 font-mono">
                    ≈ RM{' '}
                    {(
                      analysisData.asset_potential?.initial_grant_eru *
                      analysisData.asset_potential?.eru_peg_rate_rm
                    ).toLocaleString()}{' '}
                    Value
                  </div>
                </div>

                {/* 3. Cash-anchored value */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Est. 10-Yr Fiat Value
                  </div>
                  <div className="text-xl font-bold text-white">
                    RM{' '}
                    {analysisData.asset_potential?.total_fiat_value_10yr?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-400 mt-1 flex items-center gap-1">
                    <RefreshCw size={10} /> Pegged @ RM{' '}
                    {analysisData.asset_potential?.eru_peg_rate_rm?.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 🟢 Second row: Traditional physical hardware and financial performance */}
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">
                Physical Hardware & Impact
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* System Size */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">System Size</div>
                  <div className="text-lg font-bold text-white">
                    {analysisData.technical_config?.panel_count}{' '}
                    <span className="text-xs font-normal text-gray-500">
                      Panels
                    </span>
                  </div>
                  <div className="text-xs text-blue-400 mt-1 capitalize">
                    {analysisData.technical_config?.placement}
                  </div>
                </div>

                {/* Install Cost */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">Install Cost</div>
                  <div className="text-lg font-bold text-white">
                    RM{' '}
                    {analysisData.financial_report?.estimated_install_cost?.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Market Avg.</div>
                </div>

                {/* ROI & Savings */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Traditional ROI
                  </div>
                  <div className="text-lg font-bold text-green-400">
                    {analysisData.financial_report?.roi_years}{' '}
                    <span className="text-xs font-normal text-green-600/70">
                      Years
                    </span>
                  </div>
                  <div className="text-[10px] text-green-600/70 mt-1 flex items-center gap-1">
                    <TrendingUp size={10} /> Save RM{' '}
                    {analysisData.financial_report?.yearly_savings_rm}/yr
                  </div>
                </div>

                {/* Carbon Offset */}
                <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
                  <div className="text-gray-500 text-xs mb-1">
                    Carbon Offset
                  </div>
                  <div className="text-lg font-bold text-white">
                    {solarData?.carbon || 0}{' '}
                    <span className="text-xs font-normal text-gray-500">
                      kg
                    </span>
                  </div>
                  <div className="text-[10px] text-green-500/70 mt-1 flex items-center gap-1">
                    <Leaf size={10} /> Eco-friendly
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
                {loading ? 'Creating Project...' : 'Visualize in 3D'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomizationPage;
