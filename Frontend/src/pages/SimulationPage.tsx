import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  Move,
  Grid3X3,
  Eye,
  Pencil,
  RotateCw,
  Zap,
  BatteryCharging,
  Compass,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Maximize2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as Cesium from "cesium";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import "cesium/Build/Cesium/Widgets/widgets.css";

// ⚠️ API Keys
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// --- 🧮 Core Algorithm ---
const calculateGridPositions = (
    centerLat: number, 
    centerLng: number, 
    rows: number, 
    cols: number, 
    offsetLat: number, 
    offsetLng: number,
    rotationHorizontalDeg: number,
    rotationVerticalDeg: number
) => {
  const positions = [];

  // The size of each panel grid step in degrees
  const stepLat = 0.0000365; // Up down (Higher value = more spacing, Lesser value = tighter)
  const stepLng = 0.0000162; // Left right (Higher value = more spacing, Lesser value = tighter)

  const angleRad = (rotationHorizontalDeg * Math.PI) / 180;
  const cosTheta = Math.cos(angleRad);
  const sinTheta = Math.sin(angleRad);

  // calculate tan for vertical rotation
  const angleRadV = (rotationVerticalDeg * Math.PI) / 180;
  const tanThetaV = Math.tan(angleRadV);

  const halfWidth = ((cols - 1) * stepLng) / 2;
  const halfHeight = ((rows - 1) * stepLat) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rawLat = halfHeight - (r * stepLat); 
      const rawLng = -halfWidth + (c * stepLng);

      const rotatedLng = rawLng * cosTheta - rawLat * sinTheta;
      const rotatedLat = rawLng * sinTheta + rawLat * cosTheta;

      const finalLat = centerLat + offsetLat + rotatedLat;
      const finalLng = centerLng + offsetLng + rotatedLng;

      const localYInMeters = rawLat * 111320; // approx conversion
      const altOffset = localYInMeters * tanThetaV;

      positions.push({ lat: finalLat, lng: finalLng, altOffset });
    }
  }
  
  const width = cols * stepLng;
  const height = rows * stepLat;

  return { positions, finalCenterLat: centerLat + offsetLat, finalCenterLng: centerLng + offsetLng, width, height };
};

const SimulationPage = () => {
  const navigate = useNavigate();
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const moveInterval = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  
  const [mode, setMode] = useState<"VIEW" | "EDIT">("VIEW");
  const [viewMode, setViewMode] = useState<"orbit" | "top-down">("orbit");

  // Data reading
  const [blueprint] = useState<any>(() => {
    const raw = localStorage.getItem("step2_solar_blueprint");
    return raw ? JSON.parse(raw) : {
        technical_config: {
            panel_count: 12,
            placement: "ROOFTOP",
            grid_layout: { rows: 3, columns: 4 }
        },
        ui_display: { installation_method: "Standard Roof Mount" }
    };
  });

  const [aiContext] = useState(() => {
    const savedLat = localStorage.getItem("step2_lat");
    const savedLng = localStorage.getItem("step2_lng");
    return {
      location: { 
        lat: savedLat ? parseFloat(savedLat) : 1.2840, 
        lng: savedLng ? parseFloat(savedLng) : 103.8610 
      }
    };
  });

  // Intelligent initialization parameters (retains new logic)
  const aiPlacement = blueprint?.technical_config?.placement?.toUpperCase() || 'ROOFTOP';
  const defaultHeight = (aiPlacement === 'BALCONY' || aiPlacement === 'HIGH-RISE') ? 30 : 9; 
  const initialPanelCount = blueprint?.technical_config?.panel_count || 10;
  const initialRows = Math.floor(Math.sqrt(initialPanelCount)); 
  const initialCols = Math.ceil(initialPanelCount / initialRows);

  const [altitude, setAltitude] = useState<number>(defaultHeight);
  const [gridRows, setGridRows] = useState<number>(initialRows);
  const [gridCols, setGridCols] = useState<number>(initialCols);
  
  const [rotationHorizontal, setRotationHorizontal] = useState<number>(0); 
  const [rotationVertical, setRotationVertical] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(-20); // Retain the new Tilt feature
  
  const [nudgeLat, setNudgeLat] = useState(0);
  const [nudgeLng, setNudgeLng] = useState(0);
  
  const [hasBattery, setHasBattery] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{type: 'success' | 'warning', msg: string} | null>(null);

  // --- Initialize Cesium ---
  useEffect(() => {
    if (!cesiumContainer.current) return;

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
    });
    viewerRef.current = viewer;

    viewer.scene.globe.show = false; 
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0012; 
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

    // Load Scene
    const loadScene = async () => {
      const { lat, lng } = aiContext.location;
      const methodTitle = blueprint?.ui_display?.installation_method?.toUpperCase() || '';
      let finalPlacement = aiPlacement;
      
      if (methodTitle.includes('BALCONY') || methodTitle.includes('RAILING') || methodTitle.includes('CONDO')) {
          finalPlacement = 'BALCONY';
      }

      try {
        if (viewer.isDestroyed()) return;

        const tileset = await Cesium.Cesium3DTileset.fromUrl(
          `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_MAPS_API_KEY}`
        );
        if (viewer.isDestroyed()) return;
        
        tileset.maximumScreenSpaceError = 16; 
        viewer.scene.primitives.add(tileset);

        const initialPos = Cesium.Cartesian3.fromDegrees(lng, lat, 300);
        await viewer.camera.flyTo({ destination: initialPos, duration: 1.0 });

        const center = Cesium.Cartesian3.fromDegrees(lng, lat, altitude);
        viewer.entities.removeAll();

        // Initial perspective setting
        if (finalPlacement === 'BALCONY') {
             // Balcony logic...
             viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 50));
        } else {
            // Rooftop logic - Default Orbit perspective
            viewer.camera.lookAt(center, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 150));
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Load Error:", error);
        setIsLoading(false);
      }
    };

    loadScene();

    return () => {
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      if (moveInterval.current) clearInterval(moveInterval.current);
    };
  }, []); 

  // --- 🔄 Rendering Loop ---
  useEffect(() => {
    if (!viewerRef.current || isLoading) return;
    const viewer = viewerRef.current;
    
    // Rendering logic skips Balcony mode (as current only work for rooftop)
    const methodTitle = blueprint?.ui_display?.installation_method?.toUpperCase() || '';
    if (methodTitle.includes('BALCONY')) return;

    viewer.entities.removeAll();

    const { lat: centerLat, lng: centerLng } = aiContext.location;
    const { positions, finalCenterLat, finalCenterLng, width, height } = calculateGridPositions(
        centerLat, centerLng, gridRows, gridCols, nudgeLat, nudgeLng, rotationHorizontal, rotationVertical
    );

    const panelColor = blueprint?.technical_config?.panel_color === "BLUE" 
        ? Cesium.Color.fromCssColorString("#3b82f6") 
        : Cesium.Color.WHITE; 

    // Constructing directional quaternions (Heading + Pitch)
    const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(-rotationHorizontal), 
        Cesium.Math.toRadians(pitch - rotationVertical),     
        0
    );
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(finalCenterLng, finalCenterLat, altitude), 
        hpr
    );

    // Generating solar panels
    positions.forEach((pos, index) => {
        const position = Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, altitude + pos.altOffset);
        viewer.entities.add({
            name: `Panel ${index}`,
            position: position,
            orientation: orientation, 
            model: {
                uri: "/models/solar_panel.glb",
                scale: 0.7, // the size of the solar panel model
                color: panelColor,
                colorBlendMode: Cesium.ColorBlendMode.MIX,
                colorBlendAmount: 0.2,
                minimumPixelSize: 32 
            },
            polyline: mode === 'VIEW' ? {
                positions: [position, Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, 0)],
                width: 1,
                material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN.withAlpha(0.2) })
            } : undefined
        });
    });

    // If in Edit Mode
    if (mode === 'EDIT') {
        const centerPos = Cesium.Cartesian3.fromDegrees(finalCenterLng, finalCenterLat, altitude);
        
        // 1. Yellow dot at center
        viewer.entities.add({
            position: centerPos,
            point: { 
                pixelSize: 15, 
                color: Cesium.Color.YELLOW.withAlpha(0.8), 
                outlineColor: Cesium.Color.BLACK, 
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY // Ensure the point is always on the top layer and not obstructed by the board.
            }
        });

        // 2. Ellipse range
        viewer.entities.add({
            position: centerPos,
            ellipse: {
                semiMinorAxis: Math.max(width, height) * 60000, 
                semiMajorAxis: Math.max(width, height) * 60000,
                material: Cesium.Color.YELLOW.withAlpha(0.1),
                outline: true,
                outlineColor: Cesium.Color.YELLOW.withAlpha(0.3)
            }
        });
    }

    //update camera position, ensure it follows the center with the same offset
    if (viewMode === "orbit") {
        const newTarget = Cesium.Cartesian3.fromDegrees(finalCenterLng, finalCenterLat, altitude);
        const currentHeading = viewer.camera.heading;
        const currentPitch = viewer.camera.pitch;
        const currentRange = Cesium.Cartesian3.distance(viewer.camera.positionWC, newTarget);
        viewer.camera.lookAt(newTarget, new Cesium.HeadingPitchRange(currentHeading, currentPitch, currentRange));
    }

  }, [altitude, gridRows, gridCols, nudgeLat, nudgeLng, rotationHorizontal, rotationVertical, pitch, mode, isLoading, viewMode]);

  // --- 🕹️ Control Logic (Long press to move - increase user experience) ---
  const handleMoveStart = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ALT_UP' | 'ALT_DOWN') => {
    if (moveInterval.current) return; 
    const SPEED = 0.000005; 
    const ALT_SPEED = 0.2;

    moveInterval.current = setInterval(() => {
        if (!viewerRef.current) return;
        const camera = viewerRef.current.camera;
        const heading = camera.heading;

        if (direction === 'ALT_UP') {
            setAltitude(h => h + ALT_SPEED);
        } else if (direction === 'ALT_DOWN') {
            setAltitude(h => h - ALT_SPEED);
        } else {
            let dx = 0, dy = 0;
            if (direction === 'UP') {
                dx = Math.sin(heading) * SPEED; 
                dy = Math.cos(heading) * SPEED; 
            } else if (direction === 'DOWN') {
                dx = -Math.sin(heading) * SPEED;
                dy = -Math.cos(heading) * SPEED;
            } else if (direction === 'RIGHT') {
                dx = Math.sin(heading + Math.PI/2) * SPEED;
                dy = Math.cos(heading + Math.PI/2) * SPEED;
            } else if (direction === 'LEFT') {
                dx = Math.sin(heading - Math.PI/2) * SPEED;
                dy = Math.cos(heading - Math.PI/2) * SPEED;
            }
            setNudgeLat(prev => prev + dy);
            setNudgeLng(prev => prev + dx);
        }
    }, 50); 
  };

  const handleMoveStop = () => {
    if (moveInterval.current) {
        clearInterval(moveInterval.current);
        moveInterval.current = null;
    }
  };

  // --- 🎥 Fix 1: Perfect View Toggle logic (combined with the stability of the old version) ---
  const toggleViewMode = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    
    const { lat, lng } = aiContext.location;
    const targetLat = lat + nudgeLat;
    const targetLng = lng + nudgeLng;
    const center = Cesium.Cartesian3.fromDegrees(targetLng, targetLat, altitude);

    if (viewMode === "orbit") {
      // 🟢 First, unlock the Orbit (lookAtTransform), otherwise flyTo will fail.
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, altitude + 200), // Set the height to 200 (better field of view).
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 1.5 // Smoother experience.
      });
      setViewMode("top-down");
    } else {
      // Back to Orbit from Top View
      const offset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 150);
      
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 150), {
          offset: offset,
          duration: 1.5,
          complete: () => { 
              // After flying into position, relock the target.
              viewer.camera.lookAt(center, offset); 
          }
      });
      setViewMode("orbit");
    }
  };

  const handleAICheck = async () => {
      setIsChecking(true);
      setAiFeedback(null);
      try {
          const checkFeasibility = httpsCallable(functions, 'checkFeasibility');
          const result: any = await checkFeasibility({
              originalCount: initialPanelCount,
              currentCount: gridRows * gridCols,
              rows: gridRows,
              cols: gridCols,
              rotationHorizontal: rotationHorizontal
          });
          const message = result.data.message;
          let type: 'success' | 'warning' = 'success';
          if (message.toLowerCase().includes("danger") || message.toLowerCase().includes("risk")) {
              type = 'warning';
          }
          setAiFeedback({ type, msg: message });
      } catch (error) {
          setAiFeedback({ type: 'warning', msg: "Connection to AI Engineer lost." });
      } finally {
          setIsChecking(false);
      }
  };

  const currentCount = gridRows * gridCols;
  const totalYield = currentCount * 0.45; 
  const totalSavings = hasBattery ? (currentCount * 150 + 1200) : (currentCount * 150);

  const longPressProps = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ALT_UP' | 'ALT_DOWN') => ({
      onMouseDown: () => handleMoveStart(dir),
      onMouseUp: handleMoveStop,
      onMouseLeave: handleMoveStop,
      onTouchStart: () => handleMoveStart(dir), 
      onTouchEnd: handleMoveStop
  });

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans selection:bg-blue-500/30">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      )}

      <div ref={cesiumContainer} className="w-full h-full" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center pointer-events-none z-20">
        <button onClick={() => navigate("/")} className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-1 rounded-full flex gap-1 shadow-2xl">
            <button onClick={() => setMode("VIEW")} className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${mode === 'VIEW' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Eye size={16} /> View
            </button>
            <button onClick={() => setMode("EDIT")} className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${mode === 'EDIT' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Pencil size={16} /> Edit
            </button>
        </div>

        <button onClick={toggleViewMode} className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition">
            {viewMode === "orbit" ? <Compass size={16} /> : <Camera size={16} />}
            <span className="hidden md:inline">{viewMode === "orbit" ? "Top View" : "Orbit View"}</span>
        </button>
      </div>

      {/* Edit Mode Toolbox */}
      {mode === 'EDIT' && (
        <div className="absolute top-20 left-4 z-20 w-64 flex flex-col gap-3 animate-in slide-in-from-left duration-300">
            {/* 1. Grid & Orientation */}
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase mb-3">
                    <Grid3X3 size={14} /> Grid & Orientation
                </div>
                <div className="mb-4">
                    <div className="flex justify-between text-white text-sm mb-1">
                        <span>Grid: {gridRows} x {gridCols}</span>
                    </div>
                    <div className="flex gap-2">
                        <input type="range" min="1" max="8" step="1" value={gridRows} onChange={(e) => setGridRows(Number(e.target.value))} className="w-1/2 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                        <input type="range" min="1" max="8" step="1" value={gridCols} onChange={(e) => setGridCols(Number(e.target.value))} className="w-1/2 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                    </div>
                </div>
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-white text-sm mb-1">
                             <span className="flex items-center gap-1"><RotateCw size={12}/> Rotate</span>
                             <span className="font-mono text-blue-400">{rotationHorizontal}°</span>
                        </div>
                        <input type="range" min="-180" max="180" step="5" value={rotationHorizontal} onChange={(e) => setRotationHorizontal(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                    </div>

                    <div>
                        <div className="flex justify-between text-white text-sm mb-1">
                            <span className="flex items-center gap-1"><RotateCw size={12}/> V-Rotate (Slope)</span>
                            <span className="font-mono text-orange-400">{rotationVertical}°</span>
                        </div>
                        <input type="range" min="-45" max="45" step="1" value={rotationVertical} onChange={(e) => setRotationVertical(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"/>
                    </div>
                    
                    <div>
                        <div className="flex justify-between text-white text-sm mb-1">
                             <span className="flex items-center gap-1"><Maximize2 size={12}/> Tilt</span>
                             <span className="font-mono text-green-400">{pitch}°</span>
                        </div>
                        <input type="range" min="-90" max="0" step="5" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"/>
                    </div>
                </div>
            </div>

            {/* 2. Position Controls */}
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                 <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-3">
                    <Move size={14} /> Adjust Position (Hold)
                </div>
                <div className="flex gap-4">
                    <div className="grid grid-cols-3 gap-1 w-24">
                        <div />
                        <button {...longPressProps('UP')} className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"><ArrowUp size={14}/></button>
                        <div />
                        <button {...longPressProps('LEFT')} className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"><ArrowLeftIcon size={14}/></button>
                        <div className="flex items-center justify-center text-[10px] text-gray-500 select-none">MOVE</div>
                        <button {...longPressProps('RIGHT')} className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"><ArrowRight size={14}/></button>
                        <div />
                        <button {...longPressProps('DOWN')} className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"><ArrowDown size={14}/></button>
                        <div />
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-2">
                        <button {...longPressProps('ALT_UP')} className="bg-zinc-800 hover:bg-green-600 active:bg-green-500 text-white rounded p-1 flex justify-center transition-colors"><ArrowUp size={14}/></button>
                        <div className="text-center text-[10px] text-gray-500 font-mono select-none">H: {altitude.toFixed(1)}m</div>
                        <button {...longPressProps('ALT_DOWN')} className="bg-zinc-800 hover:bg-green-600 active:bg-green-500 text-white rounded p-1 flex justify-center transition-colors"><ArrowDown size={14}/></button>
                    </div>
                </div>
            </div>

            {/* 3. Add-ons */}
             <div className={`bg-black/80 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl transition-all ${hasBattery ? 'border-green-500/50 bg-green-900/10' : 'border-white/10'}`}>
                <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase mb-3">
                    <Zap size={14} /> Add-ons
                </div>
                <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2 text-white text-sm">
                        <BatteryCharging size={16} className={`${hasBattery ? 'text-green-400 animate-pulse' : 'text-gray-400 group-hover:text-green-400'} transition`}/> 
                        <span>Tesla PowerWall</span>
                    </div>
                    <input type="checkbox" className="accent-green-500" checked={hasBattery} onChange={e => setHasBattery(e.target.checked)} />
                </label>
             </div>

            {/* 4. AI Check */}
            <div className="relative">
                 <button onClick={handleAICheck} disabled={isChecking} className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-bold text-sm shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2 disabled:opacity-50">
                    {isChecking ? <Loader2 className="animate-spin" size={16}/> : <Bot size={16} />} 
                    {isChecking ? "Analyzing..." : "Ask AI Engineer"}
                </button>
                {aiFeedback && (
                    <div className={`mt-2 p-3 rounded-xl border text-xs animate-in slide-in-from-top-2 ${aiFeedback.type === 'success' ? 'bg-green-900/80 border-green-500 text-green-100' : 'bg-yellow-900/80 border-yellow-500 text-yellow-100'}`}>
                        <div className="flex gap-2 items-start">
                             {aiFeedback.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0"/> : <AlertTriangle size={14} className="mt-0.5 shrink-0"/>}
                             <span className="font-mono">{aiFeedback.msg}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* View Mode Stats */}
      {mode === 'VIEW' && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] md:w-[700px] pointer-events-none z-10 animate-in slide-in-from-bottom duration-500">
             <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 text-center text-white shadow-2xl">
                <div className="grid grid-cols-3 gap-4">
                    <div className="border-r border-white/10">
                        <div className="text-gray-400 text-xs uppercase mb-1">System Size</div>
                        <div className="text-2xl font-bold text-white">{totalYield.toFixed(1)} kWp</div>
                    </div>
                    <div className="border-r border-white/10">
                        <div className="text-gray-400 text-xs uppercase mb-1">Est. Savings</div>
                        <div className={`text-2xl font-bold transition-all ${hasBattery ? 'text-green-300 scale-110' : 'text-green-400'}`}>
                            RM {totalSavings.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs uppercase mb-1">Panels</div>
                        <div className="text-2xl font-bold text-blue-400">{currentCount}</div>
                    </div>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default SimulationPage;