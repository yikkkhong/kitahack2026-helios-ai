import React, { useState, useEffect, useRef } from "react";
// 引入 Lucide 图标
import {
  ArrowLeft,
  Sun,
  Battery,
  DollarSign,
  Maximize,
  Loader2,
  Compass,
  Camera,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// 引入 CesiumJS (稍后需要 npm install cesium)
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// --- 你的 Google Map API Key (Cesium 也会用到它来获取 Google 3D 数据) ---
const GOOGLE_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "你的_API_KEY";

const VirtualRoomPage = () => {
  const navigate = useNavigate();
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  // UI 状态
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"orbit" | "top-down">("orbit");

  // --- 1. 读取 Step 1 存下的数据 ---
  const [planData] = useState(() => {
    const lat = parseFloat(localStorage.getItem("step2_lat") || "3.140853");
    const lng = parseFloat(localStorage.getItem("step2_lng") || "101.693207");

    return {
      location: { lat, lng },
      panels: 16,
      energy: "12,500 kWh",
      savings: "RM 6,200",
      efficiency: "94%",
    };
  });

  // --- 2. 初始化 Cesium 3D 场景 ---
  useEffect(() => {
    if (!cesiumContainer.current || viewerRef.current) return;

    // 初始化 Viewer (关闭自带的地图底图，我们要纯 3D)
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
      skyAtmosphere: false,
      // 💡 直接把 globe 那一行完全删掉！不需要写 globe: true 也不需要写 globe: false
    });
    viewerRef.current = viewer;

    // --- 核心更新：加载 Google Photorealistic 3D Tiles ---
    // --- 核心更新：强力加载模式 (防止 3D 失败导致功能卡死) ---
    const loadGoogle3DAndPanels = async () => {
      const targetLat = planData.location.lat;
      const targetLng = planData.location.lng;

      // 1. 先不管 3D，直接把模拟的蓝色太阳能板画上去！
      viewer.entities.add({
        name: "Full Roof Solar Coverage",
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            targetLng - 0.0001,
            targetLat - 0.0001,
            targetLng + 0.0001,
            targetLat - 0.0001,
            targetLng + 0.0001,
            targetLat + 0.0001,
            targetLng - 0.0001,
            targetLat + 0.0001,
          ]),
          // 这行代码保证网格能贴在任何表面上（2D地图或3D模型）
          classificationType: Cesium.ClassificationType.BOTH,
          material: new Cesium.GridMaterialProperty({
            color: Cesium.Color.fromCssColorString("#0ea5e9").withAlpha(0.6),
            cellAlpha: 0.2,
            lineCount: new Cesium.Cartesian2(10, 10),
            lineThickness: new Cesium.Cartesian2(2.0, 2.0),
          }),
        },
      });

      // 2. 强力镜头控制：直接飞去目标位置，不等待！
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, 800),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 2,
        complete: () => {
          setIsLoading(false);
          // 锁定视角，进入无人机模式
          viewer.camera.lookAt(
            Cesium.Cartesian3.fromDegrees(targetLng, targetLat, 0),
            new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 80),
          );
        },
      });

      // 3. 尝试加载 Google 3D 城市 (即使失败，上面的镜头和板子也已经成功了)
      try {
        const tileset =
          await Cesium.createGooglePhotorealistic3DTileset(GOOGLE_API_KEY);
        viewer.scene.primitives.add(tileset);
      } catch (error) {
        console.warn(
          "⚠️ 3D 建筑加载失败，已降级为 2D 地图。请检查 Google Billing 和 Map Tiles API。",
        );
      }
    };

    loadGoogle3DAndPanels();

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [planData]);

  // --- 3. 视角切换功能 (Top-down vs Orbit) ---
  const toggleViewMode = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    if (viewMode === "orbit") {
      // 切换到正上方俯视 (Top-down)
      viewer.camera.lookAt(
        Cesium.Cartesian3.fromDegrees(
          planData.location.lng,
          planData.location.lat,
          10,
        ),
        new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), 100),
      );
      setViewMode("top-down");
    } else {
      // 切换回 45 度环绕
      viewer.camera.lookAt(
        Cesium.Cartesian3.fromDegrees(
          planData.location.lng,
          planData.location.lat,
          10,
        ),
        new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 80),
      );
      setViewMode("orbit");
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* --- Loading Screen --- */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <div className="text-white font-mono text-lg">
            Generating 3D Digital Twin...
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Loading Photorealistic City Data
          </p>
        </div>
      )}

      {/* --- Cesium 3D Container --- */}
      <div ref={cesiumContainer} className="w-full h-full" />

      {/* --- UI Overlay (你的原版 HUD 界面) --- */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-10">
        <button
          onClick={() => navigate("/")}
          className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all shadow-lg"
        >
          <ArrowLeft size={16} /> Back to Planner
        </button>

        {/* 右上角控制面板 */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl text-right shadow-lg">
            <h2 className="text-white font-bold text-lg flex items-center gap-2 justify-end">
              <Sun className="text-yellow-400" size={18} /> 3D Solar Twin
            </h2>
            <p className="text-gray-400 text-xs mt-1">
              Left Click to Rotate • Scroll to Zoom
            </p>
          </div>

          {/* 新增：视角切换按钮 */}
          <button
            onClick={toggleViewMode}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg transition-all border border-blue-400/50"
          >
            {viewMode === "orbit" ? (
              <Compass size={16} />
            ) : (
              <Camera size={16} />
            )}
            Switch to {viewMode === "orbit" ? "Top-down View" : "3D Orbit View"}
          </button>
        </div>
      </div>

      {/* --- Bottom Info Panel (你的原版数据展示) --- */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] md:w-[600px] pointer-events-none z-10">
        <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-3xl p-6 grid grid-cols-3 gap-4 pointer-events-auto shadow-2xl">
          <div className="text-center border-r border-white/10">
            <div className="flex justify-center mb-2">
              <Battery className="text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {planData.energy}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
              Annual Output
            </div>
          </div>

          <div className="text-center border-r border-white/10">
            <div className="flex justify-center mb-2">
              <DollarSign className="text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {planData.savings}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
              Saved / Year
            </div>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Maximize className="text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {planData.efficiency}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
              Coverage
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualRoomPage;
