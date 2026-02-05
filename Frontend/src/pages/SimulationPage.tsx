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
  Maximize,
  LayoutGrid,
  MonitorPlay,
  Compass,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Bot // AI Icon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as Cesium from "cesium";
import { functions } from "../firebase"; // 👈 确保这个路径指向你的 firebase.ts/js
import { httpsCallable } from "firebase/functions";
import "cesium/Build/Cesium/Widgets/widgets.css";

// ⚠️ 1. Google Maps Tiles API Key
// 定义常量读取环境变量
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ⚠️ 2. Gemini API Key (用于 Step 2 的实时评价)
// 如果你没有单独的 key，可以用和 Step 1 一样的
const GEMINI_API_KEY = "AIzaSyDTiCVcAddI_Ji6blWYuf6akBu8F5eNdhU"; 

// --- 🧮 核心算法：带旋转的阵列计算 ---
const calculateGridPositions = (
    centerLat: number, 
    centerLng: number, 
    rows: number, 
    cols: number, 
    offsetLat: number, 
    offsetLng: number,
    rotationDeg: number
) => {
  const positions = [];
  const stepLat = 0.000035; 
  const stepLng = 0.000035;

  const angleRad = (rotationDeg * Math.PI) / 180;
  const cosTheta = Math.cos(angleRad);
  const sinTheta = Math.sin(angleRad);

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

      positions.push({ lat: finalLat, lng: finalLng });
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

  const [isLoading, setIsLoading] = useState(true);
  
  // --- 状态管理 ---
  const [mode, setMode] = useState<"VIEW" | "EDIT">("VIEW");
  const [viewMode, setViewMode] = useState<"orbit" | "top-down">("orbit");

  // 蓝图数据
  const [blueprint] = useState<any>(() => {
    const raw = localStorage.getItem("step2_solar_blueprint");
    return raw ? JSON.parse(raw) : {
        panel_count: 20,
        grid_layout: { rows: 4, columns: 5 },
        orientation: "PORTRAIT",
        panel_color: "BLACK",
        technical: { roof_height: 30 }
    };
  });

  // 动态编辑状态
  const initialHeight = blueprint?.technical?.roof_height ? blueprint.technical.roof_height + 1.5 : 60;
  const [altitude, setAltitude] = useState<number>(initialHeight);
  const [gridRows, setGridRows] = useState<number>(blueprint?.grid_layout?.rows || 4);
  const [gridCols, setGridCols] = useState<number>(blueprint?.grid_layout?.columns || 5);
  const [rotation, setRotation] = useState<number>(0);
  
  const [nudgeLat, setNudgeLat] = useState(0);
  const [nudgeLng, setNudgeLng] = useState(0);
  
  // Add-on: Battery
  const [hasBattery, setHasBattery] = useState(false);

  // AI Real Check 状态
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{type: 'success' | 'warning', msg: string} | null>(null);

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

// --- Initialize Cesium ---
  useEffect(() => {
    if (!cesiumContainer.current) return;

    // A. Initialize Viewer
    // 这里的 useRef 赋值很重要
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
    viewerRef.current = viewer; // 绑定 Ref

    // B. Visual Style
    viewer.scene.globe.show = false; 
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0012; 
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;

    // C. Define Load Scene Function inside Effect to access current viewer closure
    const loadScene = async () => {
      const { lat, lng } = aiContext.location;

      try {
        console.log(`🌍 Loading 3D Scene...`);
        
        // 🛡️ 检查点 1: 开始前检查
        if (viewer.isDestroyed()) return;

        const tileset = await Cesium.Cesium3DTileset.fromUrl(
          `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_MAPS_API_KEY}`
        );
        
        // 🛡️ 检查点 2: 异步加载回来后，再次检查！
        if (viewer.isDestroyed()) return;
        
        tileset.maximumScreenSpaceError = 16; 
        viewer.scene.primitives.add(tileset);

        // 1. 先飞过去
        const initialPos = Cesium.Cartesian3.fromDegrees(lng, lat, 300);
        
        // 🛡️ 检查点 3
        if (viewer.isDestroyed()) return;
        
        await viewer.camera.flyTo({ destination: initialPos, duration: 1.0 });

        // 🛡️ 检查点 4: 飞完回来，再检查！(最容易报错的地方就在这)
        if (viewer.isDestroyed()) return;

        // 2. 确定高度
        let safeHeight = 60;
        if (blueprint?.technical?.roof_height) {
            safeHeight = blueprint.technical.roof_height + 1.5;
            setAltitude(safeHeight);
        }

        // 3. 锁定视角
        const center = Cesium.Cartesian3.fromDegrees(lng, lat, safeHeight);
        const offset = new Cesium.HeadingPitchRange(
             Cesium.Math.toRadians(0), 
             Cesium.Math.toRadians(-35), 
             200 
        );
        
        viewer.camera.lookAt(center, offset);
        
        setIsLoading(false);

      } catch (error) {
        // 如果是因为 destroy 导致的 error，忽略它；否则打印
        if (!viewer.isDestroyed()) {
             console.error("Load Error:", error);
             setIsLoading(false);
        }
      }
    };

    loadScene();

    // D. Cleanup Function
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        console.log("🧹 Destroying Viewer...");
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []); // Empty dependency array ensures it runs once on mount

  // --- 渲染循环 ---
  useEffect(() => {
    if (!viewerRef.current || isLoading) return;
    const viewer = viewerRef.current;
    viewer.entities.removeAll();

    const { lat: centerLat, lng: centerLng } = aiContext.location;
    
    const { positions, finalCenterLat, finalCenterLng, width, height } = calculateGridPositions(
        centerLat, centerLng, gridRows, gridCols, nudgeLat, nudgeLng, rotation
    );

    const panelColor = blueprint?.visual?.panel_color === "BLUE" 
        ? Cesium.Color.fromCssColorString("#3b82f6") 
        : Cesium.Color.WHITE;

    const heading = Cesium.Math.toRadians(-rotation);
    const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.fromDegrees(finalCenterLng, finalCenterLat, altitude), 
        hpr
    );

    positions.forEach((pos, index) => {
        const position = Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, altitude);
        
        viewer.entities.add({
            name: `Panel ${index}`,
            position: position,
            orientation: orientation, 
            model: {
                uri: "/models/solar_panel.glb",
                scale: 3.0,
                color: panelColor,
                colorBlendMode: Cesium.ColorBlendMode.MIX,
                colorBlendAmount: 0.2,
                minimumPixelSize: 64
            },
            polyline: mode === 'VIEW' ? {
                positions: [position, Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, 0)],
                width: 1,
                material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.CYAN.withAlpha(0.2) })
            } : undefined
        });
    });

    if (mode === 'EDIT') {
        const centerPos = Cesium.Cartesian3.fromDegrees(finalCenterLng, finalCenterLat, altitude);
        viewer.entities.add({
            position: centerPos,
            point: { pixelSize: 15, color: Cesium.Color.YELLOW.withAlpha(0.5), outlineColor: Cesium.Color.YELLOW, outlineWidth: 2 }
        });
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

  }, [altitude, gridRows, gridCols, nudgeLat, nudgeLng, rotation, mode, isLoading]);

  // --- 🎥 修复版：Toggle View (锁定高度) ---
  const toggleViewMode = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    
    const { lat, lng } = aiContext.location;
    const targetLat = lat + nudgeLat;
    const targetLng = lng + nudgeLng;
    
    // 🔥 修复：锁定目标改为板子的高度 (altitude)，而不是地面
    const center = Cesium.Cartesian3.fromDegrees(targetLng, targetLat, altitude);

    if (viewMode === "orbit") {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, altitude + 200), // 头顶 200米
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 1.5
      });
      setViewMode("top-down");
    } else {
      const offset = new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0), 
          Cesium.Math.toRadians(-35), 
          200
      );
      
      // 使用 flyToBoundingSphere 平滑过渡
      viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 200), {
          offset: offset,
          duration: 1.5,
          complete: () => { viewer.camera.lookAt(center, offset); }
      });
      setViewMode("orbit");
    }
  };

  const handleNudge = (dLat: number, dLng: number) => {
    setNudgeLat(p => p + dLat);
    setNudgeLng(p => p + dLng);
  };

// --- 🧠 Real AI Check via Backend (The Winning Move) ---
  const handleAICheck = async () => {
      setIsChecking(true);
      setAiFeedback(null);
      
      try {
          // 1. 呼叫后端函数
          const checkFeasibility = httpsCallable(functions, 'checkFeasibility');
          
          // 2. 传递参数
          const result: any = await checkFeasibility({
              originalCount: blueprint.panel_count || 20,
              currentCount: gridRows * gridCols,
              rows: gridRows,
              cols: gridCols,
              rotation: rotation
          });

          // 3. 获取结果
          const message = result.data.message;

          // 4. 简单情感分析决定颜色
          let type: 'success' | 'warning' = 'success';
          if (message.toLowerCase().includes("danger") || 
              message.toLowerCase().includes("risk") || 
              message.toLowerCase().includes("warn")) {
              type = 'warning';
          }

          setAiFeedback({ type, msg: message });

      } catch (error) {
          console.error("Check Failed:", error);
          setAiFeedback({
              type: 'warning',
              msg: "Connection to AI Engineer lost. Please try again."
          });
      } finally {
          setIsChecking(false);
      }
  };

  const currentCount = gridRows * gridCols;
  const baseSavings = currentCount * 150;
  const totalSavings = hasBattery ? baseSavings + 1200 : baseSavings; 
  const totalYield = currentCount * 0.45; 

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans selection:bg-blue-500/30">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      )}

      <div ref={cesiumContainer} className="w-full h-full" />

      {/* --- Top Bar --- */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center pointer-events-none z-20">
        <button onClick={() => navigate("/")} className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition">
          <ArrowLeft size={16} /> <span className="hidden md:inline">Back</span>
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

      {/* --- Left Toolbox (Edit Mode) --- */}
      {mode === 'EDIT' && (
        <div className="absolute top-20 left-4 z-20 w-64 flex flex-col gap-3 animate-in slide-in-from-left duration-300">
            
            {/* 1. Layout Config */}
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase mb-3">
                    <Grid3X3 size={14} /> Grid Layout
                </div>
                <div className="mb-3">
                    <div className="flex justify-between text-white text-sm mb-1">
                        <span>Rows: {gridRows}</span>
                        <span>Cols: {gridCols}</span>
                    </div>
                    <input type="range" min="1" max="10" step="1" value={gridRows} onChange={(e) => setGridRows(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 mb-2"/>
                    <input type="range" min="1" max="10" step="1" value={gridCols} onChange={(e) => setGridCols(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                </div>
                
                <div>
                    <div className="flex justify-between text-white text-sm mb-1">
                         <span className="flex items-center gap-1"><RotateCw size={12}/> Rotation</span>
                         <span className="font-mono text-yellow-400">{rotation}°</span>
                    </div>
                    <input type="range" min="-180" max="180" step="5" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                </div>
            </div>

            {/* 2. Transform Controls */}
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                 <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-3">
                    <Move size={14} /> Transform
                </div>
                <div className="flex gap-4">
                    <div className="grid grid-cols-3 gap-1 w-24">
                        <div />
                        <button onClick={() => handleNudge(0.000005, 0)} className="bg-zinc-800 hover:bg-blue-600 text-white rounded p-1 flex justify-center"><ArrowUp size={14}/></button>
                        <div />
                        <button onClick={() => handleNudge(0, -0.000005)} className="bg-zinc-800 hover:bg-blue-600 text-white rounded p-1 flex justify-center"><ArrowLeftIcon size={14}/></button>
                        <div className="flex items-center justify-center text-[10px] text-gray-500">MOVE</div>
                        <button onClick={() => handleNudge(0, 0.000005)} className="bg-zinc-800 hover:bg-blue-600 text-white rounded p-1 flex justify-center"><ArrowRight size={14}/></button>
                        <div />
                        <button onClick={() => handleNudge(-0.000005, 0)} className="bg-zinc-800 hover:bg-blue-600 text-white rounded p-1 flex justify-center"><ArrowDown size={14}/></button>
                        <div />
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-2">
                        <button onClick={() => setAltitude(h => h + 0.5)} className="bg-zinc-800 hover:bg-green-600 text-white rounded p-1 flex justify-center"><ArrowUp size={14}/></button>
                        <div className="text-center text-[10px] text-gray-500 font-mono">H: {altitude.toFixed(1)}m</div>
                        <button onClick={() => setAltitude(h => h - 0.5)} className="bg-zinc-800 hover:bg-green-600 text-white rounded p-1 flex justify-center"><ArrowDown size={14}/></button>
                    </div>
                </div>
            </div>

            {/* 3. Add-ons (Battery) */}
             <div className={`bg-black/80 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl transition-all duration-300 ${hasBattery ? 'border-green-500/50 bg-green-900/10' : 'border-white/10'}`}>
                <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase mb-3">
                    <Zap size={14} /> System Add-ons
                </div>
                <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-2 text-white text-sm">
                        <BatteryCharging size={16} className={`${hasBattery ? 'text-green-400 animate-pulse' : 'text-gray-400 group-hover:text-green-400'} transition`}/> 
                        <span>Tesla PowerWall</span>
                    </div>
                    <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={hasBattery} onChange={e => setHasBattery(e.target.checked)} />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                    </div>
                </label>
             </div>

            {/* 4. AI Feasibility Check */}
            <div className="relative">
                 <button 
                    onClick={handleAICheck}
                    disabled={isChecking}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-bold text-sm shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                    {isChecking ? <Loader2 className="animate-spin" size={16}/> : <Bot size={16} />} 
                    {isChecking ? "AI Analyzing..." : "Ask AI Engineer"}
                </button>
                
                {/* AI Feedback Popup */}
                {aiFeedback && (
                    <div className={`mt-2 p-3 rounded-xl border text-xs animate-in slide-in-from-top-2 ${
                        aiFeedback.type === 'success' ? 'bg-green-900/80 border-green-500 text-green-100' : 'bg-yellow-900/80 border-yellow-500 text-yellow-100'
                    }`}>
                        <div className="flex gap-2 items-start">
                             {aiFeedback.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0"/> : <AlertTriangle size={14} className="mt-0.5 shrink-0"/>}
                             <span className="font-mono">{aiFeedback.msg}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- Bottom Stats (View Mode) --- */}
      {mode === 'VIEW' && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] md:w-[700px] pointer-events-none z-10 animate-in slide-in-from-bottom duration-500">
             <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 text-center text-white shadow-2xl">
                <div className="grid grid-cols-3 gap-4">
                    <div className="border-r border-white/10">
                        <div className="text-gray-400 text-xs uppercase mb-1">System Size</div>
                        <div className="text-2xl font-bold text-white">{totalYield.toFixed(1)} kWp</div>
                    </div>
                    {/* Savings Display with Animation */}
                    <div className="border-r border-white/10">
                        <div className="text-gray-400 text-xs uppercase mb-1">Est. Savings</div>
                        <div className={`text-2xl font-bold transition-all duration-300 ${hasBattery ? 'text-green-300 scale-110' : 'text-green-400'}`}>
                            RM {totalSavings.toLocaleString()}
                        </div>
                        {hasBattery && <div className="text-[10px] text-green-500 font-bold animate-pulse">+ Battery Optim.</div>}
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