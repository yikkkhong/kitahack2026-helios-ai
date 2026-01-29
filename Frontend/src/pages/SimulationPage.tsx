import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Sun,
  Battery,
  DollarSign,
  Maximize,
  Loader2,
  Compass,
  Camera,
  FileCheck,
  Zap,
  Building
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// put API for testing until this part success
const GOOGLE_API_KEY = "AIzaSyDTiCVcAddI_Ji6blWYuf6akBu8F5eNdhU"; 

const SimulationPage = () => {
  const navigate = useNavigate();
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"orbit" | "top-down">("orbit");

  // --- 1. Read the AI ​​decision sent in step 1 ---
  const [aiContext] = useState(() => {
    // 读取 AI 决定的安装类型 (Rooftop vs Balcony)
    const rawPlacement = localStorage.getItem("step2_placement") || "rooftop_mount";
    const placementDisplay = rawPlacement.replace("_", " ").toUpperCase();
    
    // just temporarily set a fixed location to test 3D scene generation.
    return {
      location: { lat: 1.2840, lng: 103.8610 }, 
      panels: 24, 
      energy: "14,200 kWh",
      savings: "SGD 3,200", 
      efficiency: "96%",
      placement: placementDisplay
    };
  });

  // --- 2. Initialize Cesium ---
  useEffect(() => {
    if (!cesiumContainer.current || viewerRef.current) return;

    // A. Initialize Viewer
    const viewer = new Cesium.Viewer(cesiumContainer.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      terrainProvider: undefined, 
      // To avoid type errors, do not pass skyBox yet; manually close it below.
    });
    viewerRef.current = viewer;

// B. Visual Style: Dark Spotlight (Cyberpunk Style)
// This style masks the incongruity of the "non-realistic location," making it look like an abstract digital twin.
    viewer.scene.globe.show = false; 
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    
    // Safely shut off environmental elements
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;

    // Turn on the black fog (spotlight)
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0012; // Slightly darker, focus on the center
    viewer.scene.fog.screenSpaceErrorFactor = 2.0;
    
    // Manual fill light
    viewer.scene.light.intensity = 2.8;

    // --- 3. Load 3D Scene ---
    const loadScene = async () => {
      const targetLat = aiContext.location.lat;
      const targetLng = aiContext.location.lng;

      try {
        console.log("启动 Google 3D Tiles...");
        
        // C. Load Google 3D Architecture
        const tileset = await Cesium.Cesium3DTileset.fromUrl(
          `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_API_KEY}`
        );
        
        // Force image quality (to prevent flattening)
        tileset.maximumScreenSpaceError = 16; 
        tileset.dynamicScreenSpaceError = false; 
        tileset.cacheBytes = 1024 * 1024 * 1024; 
        
        viewer.scene.primitives.add(tileset);

        // D. Add a “Virtual Solar Panel” (Visual Mockup)
        // This is a visual trick: we attach a blue grid to the 3D building.
        // Regardless of whether the AI ​​says it's a balcony or a roof, we show this grid to represent a “smart coverage area”.
        viewer.entities.add({
            name: "Proposed Solar System",
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray([
                targetLng - 0.00015, targetLat - 0.0001,
                targetLng + 0.00015, targetLat - 0.0001,
                targetLng + 0.00015, targetLat + 0.0001,
                targetLng - 0.00015, targetLat + 0.0001,
              ]),
              // Key: Ensure the mesh fits snugly against the surface of the 3D model.
              classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
              material: new Cesium.GridMaterialProperty({
                color: Cesium.Color.fromCssColorString("#0ea5e9").withAlpha(1.0),
                cellAlpha: 0.3,
                lineCount: new Cesium.Cartesian2(8, 4),
                lineThickness: new Cesium.Cartesian2(2.0, 2.0),
              }),
            },
        });

        // E. Cinematic Fly-to
        await viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, 500),
          orientation: { 
            heading: Cesium.Math.toRadians(175),
            pitch: Cesium.Math.toRadians(-25), // looking at it from slightly eye level creates a more immersive experience.
            roll: 0 
          },
          duration: 3,
          complete: () => {
             setIsLoading(false);
          }
        });

      } catch (error) {
        console.error("加载失败:", error);
        setIsLoading(false);
      }
    };

    loadScene();

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, [aiContext]);

  // --- switch view method ---
  const toggleViewMode = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const { lat, lng } = aiContext.location;

    if (viewMode === "orbit") {
      // Top view mode
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 800),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 1.5
      });
      setViewMode("top-down");
    } else {
      // surround mode
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500),
        orientation: { heading: Cesium.Math.toRadians(175), pitch: Cesium.Math.toRadians(-25), roll: 0 },
        duration: 1.5
      });
      setViewMode("orbit");
    }
  };

  const handleApply = () => {
    alert("Moving to Step 3: Generating Permit Documents...");
    // navigate("/implementation"); // at future to navigate to step3: implementation
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* --- Loading Screen --- */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-500">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <div className="text-white font-mono text-xl tracking-widest">
            AI ARCHITECT
          </div>
          <p className="text-blue-400/80 text-sm mt-2 animate-pulse">
            Reconstructing 3D Digital Twin...
          </p>
        </div>
      )}

      {/* --- Cesium Container --- */}
      <div ref={cesiumContainer} className="w-full h-full" />

      {/* --- Top UI (Header) --- */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-10">
        <button
          onClick={() => navigate("/")}
          className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 text-white px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-white/10 hover:border-white/30 transition-all group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          Re-Configure
        </button>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          {/* AI Decision Badge */}
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl text-right shadow-2xl">
            <h2 className="text-white font-bold text-lg flex items-center gap-2 justify-end">
              <Sun className="text-blue-400" size={18} /> 
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Solar Twin v2.0
              </span>
            </h2>
            
            {/* Dynamically display the type determined by AI */}
            <div className="mt-2 flex items-center justify-end gap-2">
                <span className="text-gray-400 text-xs uppercase tracking-wider">AI Strategy:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    aiContext.placement.includes("BALCONY") 
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/30" 
                    : "bg-green-500/20 text-green-300 border-green-500/30"
                }`}>
                    {aiContext.placement}
                </span>
            </div>
          </div>

          <button
            onClick={toggleViewMode}
            className="bg-blue-600/90 hover:bg-blue-500 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg transition-all border border-blue-400/30 backdrop-blur-md"
          >
            {viewMode === "orbit" ? <Compass size={18} /> : <Camera size={18} />}
            <span className="font-medium text-sm">
                {viewMode === "orbit" ? "Roof View" : "3D Orbit"}
            </span>
          </button>
        </div>
      </div>

      {/* --- Bottom Stats Panel --- */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] md:w-[700px] pointer-events-none z-10 flex flex-col gap-4">
        
        {/* Glass Stats Grid */}
        <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-1 grid grid-cols-3 shadow-2xl">
            <div className="text-center py-5 px-2 pointer-events-auto rounded-2xl hover:bg-white/5 transition-colors group">
                <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-green-500/20 text-green-400 group-hover:scale-110 transition-transform">
                        <Battery size={20} />
                    </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{aiContext.energy}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-semibold">Yield</div>
            </div>

            <div className="text-center py-5 px-2 pointer-events-auto rounded-2xl hover:bg-white/5 transition-colors group">
                <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                        <DollarSign size={20} />
                    </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{aiContext.savings}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-semibold">Savings</div>
            </div>

            <div className="text-center py-5 px-2 pointer-events-auto rounded-2xl hover:bg-white/5 transition-colors group">
                <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
                        <Maximize size={20} />
                    </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{aiContext.efficiency}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-semibold">Efficiency</div>
            </div>
        </div>

        {/* Action Button (Go to Step 3) */}
        <div className="flex gap-4 pointer-events-auto">
             <div className="flex-1 bg-zinc-900/90 backdrop-blur border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                <Building className="text-gray-400" size={24} />
                <div>
                    <div className="text-white text-sm font-bold">Property Check</div>
                    <div className="text-green-400 text-xs flex items-center gap-1">
                        <Zap size={10} /> Structure Verified
                    </div>
                </div>
             </div>

             <button 
                onClick={handleApply}
                className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
             >
                <FileCheck size={20} />
                <div className="text-left">
                    <div className="text-sm font-bold leading-tight">Apply for Permit</div>
                    <div className="text-[10px] text-blue-200">Auto-generate JMB/Gov docs</div>
                </div>
             </button>
        </div>

      </div>
    </div>
  );
};

export default SimulationPage;