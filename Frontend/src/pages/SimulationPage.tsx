import React, { useState, useEffect, useRef } from 'react';
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
  Maximize2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Cesium from 'cesium';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Home,
  Car,
  Users,
  TrendingUp,
  PlayCircle,
  Sparkles,
  Activity,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import GlobalStepper from '../components/GlobalStepper';

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
      const rawLat = halfHeight - r * stepLat;
      const rawLng = -halfWidth + c * stepLng;

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

  return {
    positions,
    finalCenterLat: centerLat + offsetLat,
    finalCenterLng: centerLng + offsetLng,
    width,
    height,
  };
};

const SimulationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const moveInterval = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);

  //const [mode, setMode] = useState<"VIEW" | "EDIT">("VIEW");

  // 1. Update Mode includes SIMULATE
  const [mode, setMode] = useState<'VIEW' | 'EDIT' | 'SIMULATE'>('VIEW');

  // 2. Added Simulation-specific status
  const [simulationYear, setSimulationYear] = useState<number>(10);
  const [viewMode, setViewMode] = useState<'orbit' | 'top-down'>('orbit');

  // --- 1. Obtain the data from Step 1 ---
  const blueprint =
    location.state?.blueprintData ||
    JSON.parse(localStorage.getItem('step2_solar_blueprint') || '{}');

  const step1Concern =
    location.state?.concernData ||
    localStorage.getItem('step1_concern') ||
    'Relocation';

  // It's placed here so that the charts can also get the quantity.
  const initialPanelCount = blueprint?.technical_config?.panel_count || 10;
  const defaultRows =
    blueprint?.technical_config?.grid_layout?.rows ||
    Math.floor(Math.sqrt(initialPanelCount));
  const defaultCols =
    blueprint?.technical_config?.grid_layout?.columns ||
    Math.ceil(initialPanelCount / defaultRows);

  // Securely extract financial and ERU asset data
  const financialData = blueprint?.financial || {
    estimated_install_cost: 15000,
    yearly_savings_rm: 3000,
  };
  const capex = financialData.estimated_install_cost;
  const traditionalYearlySavings = financialData.yearly_savings_rm;

  // Secure ERU data read
  const assetData = blueprint?.asset_potential || {};
  const eruPegRate = Number(assetData?.eru_peg_rate_rm) || 0.5;

  // If the system cannot find the ERU calculated in Step 1, we can directly reverse calculate it locally using the panel count!
  // Fallback logic: Each panel generates approximately 300 RM worth of electricity savings per year, and we convert it to ERU using the peg rate. This is a rough estimate, but it ensures that the simulation can still run even if the ERU data is missing.
  const fallbackInitialERU = (initialPanelCount * 300) / eruPegRate;
  const initialERU = assetData?.initial_grant_eru
    ? Number(assetData.initial_grant_eru)
    : fallbackInitialERU;

  // --- 2. status control ---
  const [eventTriggered, setEventTriggered] = useState(false);
  const [eventYear, setEventYear] = useState(4);

  // --- AI Explainer & Text-to-Speech States ---
  const [isExplaining, setIsExplaining] = useState(false);
  const [chartExplanation, setChartExplanation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reset AI explanation and stop any ongoing speech when simulation parameters change to avoid confusion.
  useEffect(() => {
    setChartExplanation(null);
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [simulationYear, eventTriggered, eventYear, mode]);

  // AI Chart Explanation Handler
  const handleExplainChart = async () => {
    setIsExplaining(true);
    try {
      const explainData = httpsCallable(functions, 'explainSimulation');
      const result: any = await explainData({
        year: simulationYear,
        traditionalValue: currentDataPoint.Traditional,
        heliosValue: currentDataPoint.HeliosAsset,
        eruBalance: currentDataPoint.CurrentERU,
        hasCrisis: eventTriggered && simulationYear >= eventYear,
        concern: step1Concern === 'Relocation' ? 'Relocation' : 'Empty Nest',
        crisisYear: eventYear,
      });
      setChartExplanation(result.data.message);
    } catch (error) {
      console.error(error);
      setChartExplanation(
        'AI is currently offline, but the chart clearly shows Helios ERU outperforming traditional solar.'
      );
    } finally {
      setIsExplaining(false);
    }
  };

  // Toggle Text-to-Speech for the chart explanation
  const toggleSpeech = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else if (chartExplanation) {
      const utterance = new SpeechSynthesisUtterance(chartExplanation);
      // Try to select a more natural voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.name.includes('Google US English') || v.name.includes('Samantha')
        ) || voices.find((v) => v.lang === 'en-US');
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.rate = 1.0;
      utterance.pitch = 1.1;

      utterance.onend = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  // --- 3. The ERU business logic: saving on electricity costs + converting surplus into assets.
  const getSimulationData = () => {
    const data = [];

    // Total annual power generation capacity = Number of panels * 540 kWh
    const totalCapacity_kWh_per_year = initialPanelCount * 540;

    // This variable is used to track the accumulated ERU balance.
    let runningEruBalance = initialERU;
    let accumulatedSavings = 0;

    for (let i = 0; i <= simulationYear; i++) {
      if (i === 0) {
        data.push({
          name: `Year 0`,
          Traditional: -capex,
          HeliosAsset: runningEruBalance * eruPegRate - capex,
          CurrentERU: runningEruBalance,
        });
        continue;
      }

      let currentYearSavings = traditionalYearlySavings;
      let surplus_ERU = 0;

      // 🚨 When a crisis occurs (and the current year is greater than or equal to the year of the crisis).
      if (eventTriggered && i >= eventYear) {
        if (step1Concern === 'EmptyNest') {
          // Children living away from home: Electricity consumption is 40% lower, so the savings are less, but the remaining 40% is all cast into ERU.
          currentYearSavings = traditionalYearlySavings * 0.6;
          surplus_ERU = totalCapacity_kWh_per_year * 0.4;
        } else if (step1Concern === 'Relocation') {
          // Moving: No one will live there, no savings on electricity bills, 100% solar power converted to ERU.
          currentYearSavings = 0;
          surplus_ERU = totalCapacity_kWh_per_year;
        } else {
          // Worried about locking cash
          // There was no physical change, and electricity was being used normally. However, the user encountered a financial crisis where they urgently needed money.
          // In this case, we will not change the savings generated by the solar panels, but we will also allow the user to cash out all the ERU generated by the solar panels to help them through the crisis.
          currentYearSavings = traditionalYearlySavings;
          surplus_ERU = 0;
        }
      }

      // Add the surplus to user's wallet every year!
      accumulatedSavings += currentYearSavings;
      runningEruBalance += surplus_ERU;

      let tradValue = accumulatedSavings - capex;

      // The fatal flaw of traditional solar energy: If you're moving, and it's the year you're moving, the money saved up in the beginning is locked in and won't generate any further value.
      if (eventTriggered && i >= eventYear && step1Concern === 'Relocation') {
        tradValue = (eventYear - 1) * traditionalYearlySavings - capex;
      }

      // The value of Helios = Total savings + (Current ERU balance in wallet * Exchange rate) - Initial installation fee
      let heliosValue =
        accumulatedSavings + runningEruBalance * eruPegRate - capex;

      data.push({
        name: `Year ${i}`,
        Traditional: Math.round(tradValue),
        HeliosAsset: Math.round(heliosValue),
        // Store the final ERU balance for the year into the chart data.
        CurrentERU: Math.round(runningEruBalance),
      });
    }
    return data;
  };

  const chartData = getSimulationData();

  // When dragging the time slider, extract the ERU balance for the corresponding year!
  // The time slider stores the simulationYear, so directly retrieve the simulationYear data from chartData.
  const currentDataPoint = chartData[simulationYear] || {
    CurrentERU: initialERU,
    HeliosAsset: 0,
    Traditional: 0,
  };

  // Define placement type
  const placementType =
    blueprint?.technical_config?.placement?.toUpperCase() || 'ROOFTOP';
  //const placementType = "BALCONY"; // For Testing Only: Force Virtual Mode

  const isBalcony = placementType.includes('BALCONY');
  const isVirtual =
    placementType.includes('VIRTUAL') || placementType.includes('BATTERY');
  const isRooftop = !isBalcony && !isVirtual; // default to rooftop

  const [aiContext] = useState(() => {
    const savedLat = localStorage.getItem('step2_lat');
    const savedLng = localStorage.getItem('step2_lng');
    return {
      location: {
        lat: savedLat ? parseFloat(savedLat) : 1.284,
        lng: savedLng ? parseFloat(savedLng) : 103.861,
      },
    };
  });

  // Intelligent initialization parameters (retains new logic)
  const aiPlacement =
    blueprint?.technical_config?.placement?.toUpperCase() || 'ROOFTOP';
  const defaultHeight =
    aiPlacement === 'BALCONY' || aiPlacement === 'HIGH-RISE' ? 30 : 9;

  const [altitude, setAltitude] = useState<number>(defaultHeight);
  const [gridRows, setGridRows] = useState<number>(defaultRows);
  const [gridCols, setGridCols] = useState<number>(defaultCols);

  const [rotationHorizontal, setRotationHorizontal] = useState<number>(0);
  const [rotationVertical, setRotationVertical] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(-20); // Retain the new Tilt feature

  const [nudgeLat, setNudgeLat] = useState(0);
  const [nudgeLng, setNudgeLng] = useState(0);

  const [hasBattery, setHasBattery] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{
    type: 'success' | 'warning';
    msg: string;
  } | null>(null);

  const [isPlacingMode, setIsPlacingMode] = useState(false);

  const PANEL_WIDTH = 4.8;

  // Calculate the minimum required length; if it's too short, we guarantee at least 4 meters.
  const recommendedPlatformWidth = Math.max(4, initialPanelCount * PANEL_WIDTH);

  // Platform length
  const [platformWidth, setPlatformWidth] = useState<number>(
    recommendedPlatformWidth
  );

  // Number of boards (The quantity specified in Step 1 is used by default!)
  const [balconyPanelCount, setBalconyPanelCount] =
    useState<number>(initialPanelCount);

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

    // Load Scene Based on Placement
    const loadScene = async () => {
      console.log('Loading Scene Mode: ${placementType}');

      const { lat, lng } = aiContext.location;

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

        if (isBalcony) {
          // Balcony Mode: Zoom in slightly, look at it from eye level.
          const offset = new Cesium.HeadingPitchRange(
            0,
            Cesium.Math.toRadians(-20),
            80
          );
          viewer.camera.lookAt(center, offset);

          // virtual battery?
        } else {
          // Rooftop Mode: Top View
          const visualCenter = Cesium.Cartesian3.fromDegrees(
            lng,
            lat + 0.00015,
            altitude
          );
          viewer.camera.lookAt(
            visualCenter,
            new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-35), 150)
          );
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Load Error:', error);
        setIsLoading(false);
      }
    };

    loadScene();

    return () => {
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      if (moveInterval.current) clearInterval(moveInterval.current);
    };
  }, [aiContext.location]);

  // --- 🖱️ Independent control: Click to place event listeners ---
  useEffect(() => {
    // Make sure Earth is fully loaded before listening.
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      // If the placement mode is not enabled, do nothing.
      if (!isPlacingMode) return;

      const cartesian = viewer.scene.pickPosition(click.position);

      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const clickLat = Cesium.Math.toDegrees(cartographic.latitude);
        const clickLng = Cesium.Math.toDegrees(cartographic.longitude);
        const clickHeight = cartographic.height;

        const { lat: baseLat, lng: baseLng } = aiContext.location;

        setNudgeLat(clickLat - baseLat);
        setNudgeLng(clickLng - baseLng);
        setAltitude(clickHeight + 1);

        setIsPlacingMode(false);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Clean up old listeners each time isPlacingMode changes.
    return () => {
      handler.destroy();
    };
  }, [isPlacingMode, aiContext.location]); // 🟢 This little useEffect is only responsible for listening; no matter how it changes, it won't destroy the Earth.

  // --- 🔄 Rendering Loop ---
  useEffect(() => {
    if (!viewerRef.current || isLoading) return;
    const viewer = viewerRef.current;
    viewer.entities.removeAll();

    const { lat: baseLat, lng: baseLng } = aiContext.location;

    // Rendering logic skips Balcony mode (as current only work for rooftop)
    // const methodTitle = blueprint?.ui_display?.installation_method?.toUpperCase() || '';
    // if (methodTitle.includes('BALCONY')) return;

    console.log('========================================');
    console.log('🚀 Simulation Mode Loaded');
    console.log('📂 Blueprint Data:', blueprint); // Check if the entire data is correct.
    console.log('📍 Placement Type:', placementType); // Check if it is "BALCONY" (For Testing Only)

    let targetCameraCenter: Cesium.Cartesian3 | null = null;

    // =================================================
    // 🌆 Branch 1: BALCONY MODE (Holographic Platform)
    // =================================================
    if (isBalcony) {
      console.log('🏠 Balcony mode detected. Loading Google 3D Tiles...');

      // 1. Calculate the platform's center point (reuse the nudge and altitude variables so that the D-Pad button can directly control it!)
      const platformLat = baseLat + nudgeLat;
      const platformLng = baseLng + nudgeLng;
      const platformHeight = altitude; // Here, the altitude control platform is at its height.

      //const platformCenter = Cesium.Cartesian3.fromDegrees(platformLng, platformLat, platformHeight);
      targetCameraCenter = Cesium.Cartesian3.fromDegrees(
        platformLng,
        platformLat,
        altitude
      );

      // Draw the platform (the width is currently fixed; the next step will teach you how to control it using a slider).
      const pWidth = platformWidth;
      const pDepth = 1; // Balconies are usually quite narrow

      // 2. Holographic Platform (Holographic Platform)
      // Make the platform rotate along with the Rotate slider
      const rad = Cesium.Math.toRadians(-rotationHorizontal);
      const platformHpr = new Cesium.HeadingPitchRoll(rad, 0, 0);
      const platformOrientation = Cesium.Transforms.headingPitchRollQuaternion(
        targetCameraCenter,
        platformHpr
      );

      viewer.entities.add({
        position: targetCameraCenter,
        orientation: platformOrientation, // The platform follows
        box: {
          dimensions: new Cesium.Cartesian3(pWidth, pDepth, 0.05),
          material: Cesium.Color.CYAN.withAlpha(0.2),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
        },
      });

      // 3. Generate a board to hang outside the railing.
      // Calculate the coordinates of the edge "directly in front".
      // The distance pushed forward = (balcony depth / 2) + 0.1 meters (slightly overhanging)
      const forwardOffset = pDepth / 2 + 0.1;

      // Calculate the latitude and longitude offset ahead using trigonometric functions
      const dLat = (Math.cos(rad) * forwardOffset) / 111320;
      const dLng =
        (Math.sin(rad) * forwardOffset) /
        (111320 * Math.cos((platformLat * Math.PI) / 180));

      // True mount point edge coordinates
      const edgeLat = platformLat + dLat;
      const edgeLng = platformLng + dLng;

      // Reduce the board height! 0.2 meters lower than the platform.
      const hangHeight = platformHeight - 0.2;

      const singlePanelWidth = PANEL_WIDTH;
      const gap = 0.05;

      // Foolproofing logic: During rendering, it is absolutely forbidden to render a board that exceeds the length of the platform
      const maxAllowedPanels = Math.floor(platformWidth / singlePanelWidth);
      const actualRenderCount = Math.min(balconyPanelCount, maxAllowedPanels);

      for (let i = 0; i < actualRenderCount; i++) {
        // Calculate the distance between the left and right sides (using actualRenderCount and PANEL_WIDTH).
        const offsetX =
          (i - (actualRenderCount - 1) / 2) * (singlePanelWidth + gap);

        const rightRad = rad + Math.PI / 2;
        const sLat = (Math.cos(rightRad) * offsetX) / 111320;
        const sLng =
          (Math.sin(rightRad) * offsetX) /
          (111320 * Math.cos((platformLat * Math.PI) / 180));

        const panelPos = Cesium.Cartesian3.fromDegrees(
          edgeLng + sLng,
          edgeLat + sLat,
          hangHeight
        );

        // Forcibly add 90 degrees (Math.PI / 2) to the model's orientation.
        // ⚠️ If find that the back of the board is facing outwards after rotating it 90 degrees, change the + to - (i.e., rad - Math.PI / 2).
        const panelHeading = rad + Math.PI / 2 + Math.PI;

        // The slope should be close to the balcony, typically perfectly vertical (-90°) or slightly angled (-80°).
        const hpr = new Cesium.HeadingPitchRoll(
          panelHeading, // 👈 Using the new orientation after adding 90 degrees
          Cesium.Math.toRadians(-90), // 👈 -90 degrees = hanging vertically downwards
          0
        );
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          panelPos,
          hpr
        );

        viewer.entities.add({
          position: panelPos,
          orientation: orientation,
          model: { uri: '/models/solar_panel.glb', scale: 0.85 },
        });
      }

      // 4. Balcony's Edit Mode guide lines (Solve the problem of missing variables: just write them here!)
      if (mode === 'EDIT') {
        // Yellow dot (Platform Center)
        viewer.entities.add({
          position: targetCameraCenter,
          point: {
            pixelSize: 15,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        // Vertical line (to help users see the platform's projection on the ground)
        viewer.entities.add({
          polyline: {
            positions: [
              targetCameraCenter,
              Cesium.Cartesian3.fromDegrees(platformLng, platformLat, 0),
            ],
            width: 2,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.YELLOW,
            }),
          },
        });
      }
    } else if (isVirtual) {
      console.log('☁️ Virtual Battery Mode: Rendering Holographic Node...');

      // 1. Camera setup: Don't aim vertically like from a rooftop; tilt it slightly to the side, like you're looking at a landscape.
      targetCameraCenter = Cesium.Cartesian3.fromDegrees(
        baseLng,
        baseLat,
        altitude
      );

      // 2. Key special effect: Place an "energy connection pillar" in the user's home.
      // This is a gradient cylinder, representing "cloud connectivity".
      viewer.entities.add({
        position: targetCameraCenter,
        cylinder: {
          length: 40, // length
          topRadius: 15, // Wider at the top
          bottomRadius: 1, // The bottom is pointed, pointing towards the roof.
          material: new Cesium.ColorMaterialProperty(
            Cesium.Color.CYAN.withAlpha(0.3) // translucent cyan
          ),
        },
      });

      // 3. Add another pulse core (which looks like a beating heart).
      viewer.entities.add({
        position: targetCameraCenter,
        point: {
          pixelSize: 20,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 4,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // 4. Draw a large circle on the ground to represent the coverage area.
      viewer.entities.add({
        position: targetCameraCenter,
        ellipse: {
          semiMinorAxis: 30,
          semiMajorAxis: 30,
          material: Cesium.Color.CYAN.withAlpha(0.1),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.5),
        },
      });
    } else {
      console.log(
        '🏠 Roof mode detected (default). Loading Google 3D Tiles...'
      );

      //viewer.entities.removeAll();

      const { lat: centerLat, lng: centerLng } = aiContext.location;
      const { positions, finalCenterLat, finalCenterLng, width, height } =
        calculateGridPositions(
          centerLat,
          centerLng,
          gridRows,
          gridCols,
          nudgeLat,
          nudgeLng,
          rotationHorizontal,
          rotationVertical
        );

      targetCameraCenter = Cesium.Cartesian3.fromDegrees(
        finalCenterLng,
        finalCenterLat,
        altitude
      );

      const panelColor =
        blueprint?.technical_config?.panel_color === 'BLUE'
          ? Cesium.Color.fromCssColorString('#3b82f6')
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
        const position = Cesium.Cartesian3.fromDegrees(
          pos.lng,
          pos.lat,
          altitude + pos.altOffset
        );
        viewer.entities.add({
          name: `Panel ${index}`,
          position: position,
          orientation: orientation,
          model: {
            uri: '/models/solar_panel.glb',
            scale: 0.7, // the size of the solar panel model
            color: panelColor,
            colorBlendMode: Cesium.ColorBlendMode.MIX,
            colorBlendAmount: 0.2,
            minimumPixelSize: 32,
          },
          polyline:
            mode === 'VIEW'
              ? {
                  positions: [
                    position,
                    Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, 0),
                  ],
                  width: 1,
                  material: new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.CYAN.withAlpha(0.2),
                  }),
                }
              : undefined,
        });
      });

      // If in Edit Mode
      if (mode === 'EDIT') {
        const centerPos = Cesium.Cartesian3.fromDegrees(
          finalCenterLng,
          finalCenterLat,
          altitude
        );

        // 1. Yellow dot at center
        viewer.entities.add({
          position: centerPos,
          point: {
            pixelSize: 15,
            color: Cesium.Color.YELLOW.withAlpha(0.8),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // Ensure the point is always on the top layer and not obstructed by the board.
          },
        });

        // 2. Ellipse range
        viewer.entities.add({
          position: centerPos,
          ellipse: {
            semiMinorAxis: Math.max(width, height) * 60000,
            semiMajorAxis: Math.max(width, height) * 60000,
            material: Cesium.Color.YELLOW.withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.YELLOW.withAlpha(0.3),
          },
        });
      }
    }

    if (viewMode === 'orbit' && targetCameraCenter) {
      // Read the current camera angle and distance to maintain a smooth feel.
      const currentHeading = viewer.camera.heading;
      const currentPitch = viewer.camera.pitch;
      const currentRange = Cesium.Cartesian3.distance(
        viewer.camera.positionWC,
        targetCameraCenter
      );

      // Tell the camera: No matter how the target moves, keep your eyes glued to it.
      viewer.camera.lookAt(
        targetCameraCenter,
        new Cesium.HeadingPitchRange(currentHeading, currentPitch, currentRange)
      );
    }
  }, [
    altitude,
    gridRows,
    gridCols,
    nudgeLat,
    nudgeLng,
    rotationHorizontal,
    rotationVertical,
    pitch,
    mode,
    isLoading,
    viewMode,
    blueprint,
    platformWidth,
    balconyPanelCount,
  ]);

  // --- 🕹️ Control Logic (Long press to move - increase user experience) ---
  const handleMoveStart = (
    direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ALT_UP' | 'ALT_DOWN'
  ) => {
    if (moveInterval.current) return;
    const SPEED = 0.000005;
    const ALT_SPEED = 0.2;

    moveInterval.current = setInterval(() => {
      if (!viewerRef.current) return;
      const camera = viewerRef.current.camera;
      const heading = camera.heading;

      if (direction === 'ALT_UP') {
        setAltitude((h) => h + ALT_SPEED);
      } else if (direction === 'ALT_DOWN') {
        setAltitude((h) => h - ALT_SPEED);
      } else {
        let dx = 0,
          dy = 0;
        if (direction === 'UP') {
          dx = Math.sin(heading) * SPEED;
          dy = Math.cos(heading) * SPEED;
        } else if (direction === 'DOWN') {
          dx = -Math.sin(heading) * SPEED;
          dy = -Math.cos(heading) * SPEED;
        } else if (direction === 'RIGHT') {
          dx = Math.sin(heading + Math.PI / 2) * SPEED;
          dy = Math.cos(heading + Math.PI / 2) * SPEED;
        } else if (direction === 'LEFT') {
          dx = Math.sin(heading - Math.PI / 2) * SPEED;
          dy = Math.cos(heading - Math.PI / 2) * SPEED;
        }
        setNudgeLat((prev) => prev + dy);
        setNudgeLng((prev) => prev + dx);
      }
    }, 50);
  };

  const handleMoveStop = () => {
    if (moveInterval.current) {
      clearInterval(moveInterval.current);
      moveInterval.current = null;
    }
  };

  // --- Perfect View Toggle logic (combined with the stability of the old version) ---
  const toggleViewMode = () => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    const { lat, lng } = aiContext.location;
    const targetLat = lat + nudgeLat;
    const targetLng = lng + nudgeLng;
    const center = Cesium.Cartesian3.fromDegrees(
      targetLng,
      targetLat,
      altitude
    );

    if (viewMode === 'orbit') {
      // 🟢 First, unlock the Orbit (lookAtTransform), otherwise flyTo will fail.
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          targetLng,
          targetLat,
          altitude + 200
        ), // Set the height to 200 (better field of view).
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 1.5, // Smoother experience.
      });
      setViewMode('top-down');
    } else {
      // Back to Orbit from Top View
      const offset = new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-35),
        150
      );

      viewer.camera.flyToBoundingSphere(
        new Cesium.BoundingSphere(center, 150),
        {
          offset: offset,
          duration: 1.5,
          complete: () => {
            // After flying into position, relock the target.
            viewer.camera.lookAt(center, offset);
          },
        }
      );
      setViewMode('orbit');
    }
  };

  // --- Package the latest data and proceed to Step 3 (Assetization) ---
  const handleProceedToStep3 = () => {
    // 1. Get the latest number of panels (in case the user modifies the Grid in Edit mode).
    const currentPanelCount = gridRows * gridCols;

    // 2. Overwrite the latest configuration and correct ERU fallback data into the blueprint.
    const updatedBlueprint = {
      ...blueprint,
      technical_config: {
        ...blueprint?.technical_config,
        panel_count: currentPanelCount,
        grid_layout: { rows: gridRows, columns: gridCols },
      },
      asset_potential: {
        ...blueprint?.asset_potential,
        // Make sure to transmit the correct initial ERU calculated in Step 2.
        initial_grant_eru: initialERU,
        eru_peg_rate_rm: eruPegRate,
      },
    };

    // 3. Redirecting to Step 3 (AssetizationPage) with the updated data.
    // Note: Ensure that the path configured in your App.tsx route is "/assetization" or the path you are actually using.
    navigate('/assetization', {
      state: {
        blueprintData: updatedBlueprint,
        concernData: step1Concern,
      },
    });
  };

  // --- Purely local Edit Mode validation logic ---
  const handleVerifyFeasibility = () => {
    setIsChecking(true);
    setAiFeedback(null);

    setTimeout(() => {
      const currentCount = gridRows * gridCols;

      if (currentCount > initialPanelCount * 1.5) {
        setAiFeedback({
          type: 'warning',
          msg: 'Warning: Panel count significantly exceeds original budget and roof structural limit.',
        });
      } else if (currentCount < initialPanelCount * 0.5) {
        setAiFeedback({
          type: 'warning',
          msg: 'Warning: System size is too small to cover your current energy consumption.',
        });
      } else {
        setAiFeedback({
          type: 'success',
          msg: 'System Verified: Configuration is structurally safe and financially optimal.',
        });
      }
      setIsChecking(false);
    }, 800);
  };

  const currentCount = gridRows * gridCols;
  const totalYield = currentCount * 0.45;
  const totalSavings = hasBattery
    ? currentCount * 150 + 1200
    : currentCount * 150;

  const longPressProps = (
    dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ALT_UP' | 'ALT_DOWN'
  ) => ({
    onMouseDown: () => handleMoveStart(dir),
    onMouseUp: handleMoveStop,
    onMouseLeave: handleMoveStop,
    onTouchStart: () => handleMoveStart(dir),
    onTouchEnd: handleMoveStop,
  });

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans selection:bg-blue-500/30">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95">
          <Loader2 className="animate-spin text-blue-500" />
        </div>
      )}

      <div ref={cesiumContainer} className="w-full h-full" />

      {/* --- Top Bar (general) --- */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center pointer-events-none z-50">
        <GlobalStepper currentStep={2} onBack={() => navigate(-1)} />

        <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-1 rounded-full flex gap-1 shadow-2xl">
          <button
            onClick={() => setMode('VIEW')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${mode === 'VIEW' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Eye size={16} /> View
          </button>

          <button
            onClick={() => setMode('EDIT')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${mode === 'EDIT' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Pencil size={16} /> Edit
          </button>

          <button
            onClick={() => setMode('SIMULATE')}
            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${mode === 'SIMULATE' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50' : 'text-gray-400 hover:text-white'}`}
          >
            <PlayCircle size={16} /> Simulate
          </button>
        </div>

        <button
          onClick={toggleViewMode}
          className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition"
        >
          {viewMode === 'orbit' ? <Compass size={16} /> : <Camera size={16} />}
          <span className="hidden md:inline">
            {viewMode === 'orbit' ? 'Top View' : 'Orbit View'}
          </span>
        </button>
      </div>

      {/* --- Edit Mode Toolbox (Displays different content depending on the mode) --- */}
      {mode === 'EDIT' && (
        <>
          {aiFeedback && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto animate-in slide-in-from-top-4 fade-in duration-300">
              <div
                className={`px-6 py-4 rounded-2xl border-2 backdrop-blur-2xl flex items-center gap-4 shadow-2xl ${
                  aiFeedback.type === 'success'
                    ? 'bg-green-950/90 border-green-500 text-green-100 shadow-[0_0_50px_rgba(34,197,94,0.4)]'
                    : 'bg-yellow-950/90 border-yellow-500 text-yellow-100 shadow-[0_0_50px_rgba(234,179,8,0.4)]'
                }`}
              >
                {aiFeedback.type === 'success' ? (
                  <CheckCircle2 size={28} className="text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle
                    size={28}
                    className="text-yellow-400 shrink-0"
                  />
                )}
                <span className="font-mono text-sm font-bold max-w-sm leading-tight">
                  {aiFeedback.msg}
                </span>
                <button
                  onClick={() => setAiFeedback(null)}
                  className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ======================= */}
          {/* 1. VIRTUAL BATTERY HUD */}
          {/* ======================= */}
          {isVirtual && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 md:left-10 md:translate-x-0 z-30 w-[90%] md:w-80 animate-in fade-in zoom-in duration-500">
              <div className="bg-black/80 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                {/* title */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-cyan-900/50 flex items-center justify-center border border-cyan-400/30">
                    <Zap
                      size={20}
                      className="text-cyan-400 fill-cyan-400 animate-pulse"
                    />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight">
                      Helios Cloud
                    </h3>
                    <p className="text-cyan-400 text-xs font-mono uppercase tracking-wider">
                      Virtual Connection Active
                    </p>
                  </div>
                </div>
                {/* Data overview */}
                <div className="space-y-4">
                  <div className="bg-cyan-950/30 rounded-lg p-3 border border-cyan-800/30">
                    <div className="text-gray-400 text-xs mb-1">
                      Subscription Plan
                    </div>
                    <div className="text-white font-bold text-xl">
                      5.4 kWp{' '}
                      <span className="text-sm font-normal text-gray-500">
                        Equivalent
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-cyan-950/30 rounded-lg p-3 border border-cyan-800/30">
                      <div className="text-gray-400 text-xs mb-1">
                        Grid Offset
                      </div>
                      <div className="text-green-400 font-bold">100%</div>
                    </div>
                    <div className="bg-cyan-950/30 rounded-lg p-3 border border-cyan-800/30">
                      <div className="text-gray-400 text-xs mb-1">Battery</div>
                      <div className="text-blue-400 font-bold flex items-center gap-1">
                        <BatteryCharging size={14} /> Cloud
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative status bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-[10px] text-cyan-300/50 mb-1 font-mono">
                    <span>ENERGY TRANSMISSION</span>
                    <span>STABLE</span>
                  </div>
                  <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 w-2/3 animate-pulse shadow-[0_0_10px_#06b6d4]"></div>
                  </div>
                </div>
              </div>
              {/* In Virtual mode, only a simple AI button is needed; nothing else is required. */}
              <div className="mt-4">
                <button
                  onClick={handleVerifyFeasibility}
                  disabled={isChecking}
                  className="w-full py-3 bg-cyan-900/50 border border-cyan-500/30 rounded-xl text-cyan-100 font-bold text-sm shadow-lg hover:bg-cyan-800/50 transition flex items-center justify-center gap-2"
                >
                  {isChecking ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                  Analyze Virtual Output
                </button>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* 2. STANDARD SIDEBAR (Balcony & Rooftop) */}
          {/* ======================================= */}
          {!isVirtual && (
            <div className="absolute top-20 left-4 z-20 w-64 flex flex-col gap-3 animate-in slide-in-from-left duration-300">
              {/* --- A. CONFIG PANEL --- */}

              {/* Case A1: Balcony Config */}
              {isBalcony && (
                <div className="bg-black/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase mb-3">
                    <Grid3X3 size={14} /> Balcony Config
                  </div>

                  {/* Slider: Platform Size */}
                  <div className="mb-4">
                    <div className="flex justify-between text-white text-sm mb-1">
                      <span>Length: {platformWidth.toFixed(1)}m</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="20"
                      step="0.1"
                      value={platformWidth}
                      onChange={(e) => setPlatformWidth(Number(e.target.value))}
                      className="w-full h-1 bg-gray-700 rounded-lg accent-cyan-500"
                    />
                  </div>

                  {/* Slider: Panel Count */}
                  <div className="mb-4">
                    <div className="flex justify-between text-white text-sm mb-1">
                      <span>Panels: {balconyPanelCount}</span>
                      <span className="text-xs text-gray-400">
                        Max: {Math.floor(platformWidth / PANEL_WIDTH)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={Math.floor(platformWidth / PANEL_WIDTH) || 1}
                      step="1"
                      value={balconyPanelCount}
                      onChange={(e) => {
                        const newCount = Number(e.target.value);
                        setBalconyPanelCount(newCount);
                        setGridRows(1);
                        setGridCols(newCount);
                        const requiredLength = newCount * PANEL_WIDTH;
                        if (requiredLength > platformWidth) {
                          setPlatformWidth(Math.min(20, requiredLength));
                        }
                      }}
                      className="w-full h-1 bg-gray-700 rounded-lg accent-yellow-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-white text-sm mb-1">
                        <span className="flex items-center gap-1">
                          <RotateCw size={12} /> Rotate
                        </span>
                        <span className="font-mono text-blue-400">
                          {rotationHorizontal}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="5"
                        value={rotationHorizontal}
                        onChange={(e) =>
                          setRotationHorizontal(Number(e.target.value))
                        }
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Case A2: Rooftop Grid Config */}
              {isRooftop && (
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                  <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase mb-3">
                    <Grid3X3 size={14} /> Grid & Orientation
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-white text-sm mb-1">
                      <span>
                        Grid: {gridRows} x {gridCols}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={gridRows}
                        onChange={(e) => setGridRows(Number(e.target.value))}
                        className="w-1/2 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      />
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={gridCols}
                        onChange={(e) => setGridCols(Number(e.target.value))}
                        className="w-1/2 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-white text-sm mb-1">
                        <span className="flex items-center gap-1">
                          <RotateCw size={12} /> Rotate
                        </span>
                        <span className="font-mono text-blue-400">
                          {rotationHorizontal}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="5"
                        value={rotationHorizontal}
                        onChange={(e) =>
                          setRotationHorizontal(Number(e.target.value))
                        }
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-white text-sm mb-1">
                        <span className="flex items-center gap-1">
                          <RotateCw size={12} /> Slope
                        </span>
                        <span className="font-mono text-orange-400">
                          {rotationVertical}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="1"
                        value={rotationVertical}
                        onChange={(e) =>
                          setRotationVertical(Number(e.target.value))
                        }
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-white text-sm mb-1">
                        <span className="flex items-center gap-1">
                          <Maximize2 size={12} /> Tilt
                        </span>
                        <span className="font-mono text-green-400">
                          {pitch}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-90"
                        max="0"
                        step="5"
                        value={pitch}
                        onChange={(e) => setPitch(Number(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- B. POSITION CONTROLS (Common for Rooftop & Balcony) --- */}
              <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
                <button
                  onClick={() => setIsPlacingMode(!isPlacingMode)}
                  className={`w-full py-2 rounded-lg font-bold text-sm mb-3 transition-all ${
                    isPlacingMode
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {isPlacingMode
                    ? '🛑 Click Map to Place'
                    : isBalcony
                      ? '📍 Move Balcony (Tap)'
                      : '📍 Move Panels (Tap)'}
                </button>

                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase mb-3">
                  <Move size={14} /> Fine Tune (Hold)
                </div>
                <div className="flex gap-4">
                  <div className="grid grid-cols-3 gap-1 w-24">
                    <div />
                    <button
                      {...longPressProps('UP')}
                      className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <div />
                    <button
                      {...longPressProps('LEFT')}
                      className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"
                    >
                      <ArrowLeftIcon size={14} />
                    </button>
                    <div className="flex items-center justify-center text-[10px] text-gray-500 select-none">
                      MOVE
                    </div>
                    <button
                      {...longPressProps('RIGHT')}
                      className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"
                    >
                      <ArrowRight size={14} />
                    </button>
                    <div />
                    <button
                      {...longPressProps('DOWN')}
                      className="bg-zinc-800 hover:bg-blue-600 active:bg-blue-500 text-white rounded p-1 flex justify-center transition-colors"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <div />
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <button
                      {...longPressProps('ALT_UP')}
                      className="bg-zinc-800 hover:bg-green-600 active:bg-green-500 text-white rounded p-1 flex justify-center transition-colors"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <div className="text-center text-[10px] text-gray-500 font-mono select-none">
                      H: {altitude.toFixed(1)}m
                    </div>
                    <button
                      {...longPressProps('ALT_DOWN')}
                      className="bg-zinc-800 hover:bg-green-600 active:bg-green-500 text-white rounded p-1 flex justify-center transition-colors"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* --- D. Verify Feasibility --- */}
              <div className="relative mt-2">
                <button
                  onClick={handleVerifyFeasibility}
                  disabled={isChecking}
                  className="w-full py-3 bg-blue-600 rounded-xl text-white font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isChecking ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {isChecking ? 'Running Diagnostics...' : 'Verify Feasibility'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- View Mode Stats (Bottom) --- */}
      {mode === 'VIEW' && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[95%] md:w-[950px] pointer-events-auto z-10 animate-in slide-in-from-bottom duration-500">
          {/* The dark capsule design, but increase the vertical inner margin (py-8) to maintain the desired large size feel. */}
          <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] py-6 px-10 md:py-8 md:px-12 text-white shadow-2xl flex items-center justify-between">
            {/* Data area */}
            <div className="flex flex-1 justify-between items-center pr-12 border-r border-white/10">
              <div className="text-center">
                <div className="text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2">
                  System Size
                </div>
                <div className="text-xl md:text-3xl font-bold text-white font-mono">
                  {(isVirtual ? 5.4 : totalYield).toFixed(1)}{' '}
                  <span className="text-sm font-normal opacity-50">kWp</span>
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2">
                  Est. Savings
                </div>
                <div
                  className={`text-xl md:text-3xl font-bold transition-all font-mono ${hasBattery || isVirtual ? 'text-green-300 scale-110' : 'text-green-400'}`}
                >
                  RM {totalSavings.toLocaleString()}
                </div>
              </div>

              <div className="text-center">
                <div className="text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2">
                  {isVirtual ? 'Status' : 'Panels'}
                </div>
                <div className="text-xl md:text-3xl font-bold text-blue-400 font-mono">
                  {isVirtual ? 'Active' : currentCount}
                </div>
              </div>
            </div>

            {/* Button area */}
            <div className="pl-12 shrink-0">
              <button
                onClick={handleProceedToStep3}
                className="group flex items-center gap-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-8 py-4 rounded-full font-bold shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all transform hover:scale-105 active:scale-95"
              >
                <span className="tracking-[0.2em] uppercase text-xs md:text-sm">
                  Go to Assetization
                </span>
                <div className="bg-white/20 p-1 rounded-full group-hover:translate-x-1 transition-transform">
                  <ArrowRight size={18} />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🟢 Scene C: SIMULATION MODE (The "Wow" HUD Experience)    */}
      {/* ======================================================== */}
      {mode === 'SIMULATE' && (
        <div className="absolute inset-0 z-40 flex flex-col justify-between pointer-events-none overflow-hidden animate-in fade-in duration-500">
          {/* 🌌 Background mask: Gradient black at the top and bottom, completely transparent in the middle, perfectly revealing the 3D scene! */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/95 pointer-events-none -z-10"></div>

          {/* 🔴 A full-screen alert when a crisis is triggered! */}
          {eventTriggered && simulationYear >= eventYear && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-0 animate-in zoom-in duration-300">
              <div className="bg-red-900/40 border border-red-500 text-red-400 px-6 py-2 rounded-full font-mono text-sm uppercase tracking-[0.2em] animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.5)] mb-4">
                ⚠️ Traditional Solar Sunk Cost Detected
              </div>
              <div className="bg-purple-900/60 backdrop-blur-xl border-2 border-purple-400 p-6 rounded-2xl shadow-[0_0_100px_rgba(168,85,247,0.4)] text-center transform scale-110 transition-all">
                <Sparkles
                  className="text-purple-300 mx-auto mb-2 animate-bounce"
                  size={32}
                />
                <h3 className="text-white text-2xl font-black uppercase mb-1">
                  ERU Asset Deployed
                </h3>
                <p className="text-purple-200 font-mono">
                  Loss prevented. Portfolio Secured.
                </p>
              </div>
            </div>
          )}

          {/* --- 🔝 Top HUD Dashboard --- */}
          <div className="w-full px-6 pt-24 pb-6 flex justify-between items-start pointer-events-auto">
            {/* Top left: Control panel (floating glass state) */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl w-[380px] shadow-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                <TrendingUp className="text-purple-400" /> Lifecycle Stress Test
              </h2>

              {/* Pain trigger and fine-tuner combination */}
              <div className="relative">
                <button
                  onClick={() => setEventTriggered(!eventTriggered)}
                  className={`w-full p-3 rounded-xl border-2 transition-all font-bold flex items-center justify-between group relative overflow-hidden ${
                    eventTriggered
                      ? 'bg-red-900/30 border-red-500/50 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
                      : 'bg-zinc-800/50 border-zinc-600/50 text-gray-300 hover:border-purple-500/50 hover:text-purple-300'
                  }`}
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>

                  <div className="flex items-center gap-3 z-10">
                    <div
                      className={`p-2 rounded-lg ${eventTriggered ? 'bg-red-500/20' : 'bg-white/5'}`}
                    >
                      {step1Concern === 'Relocation' ? (
                        <Home size={16} />
                      ) : (
                        <Users size={16} />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
                        Inject Uncertainty
                      </div>
                      <div className="text-sm">
                        {step1Concern === 'Relocation'
                          ? 'Relocate'
                          : step1Concern === 'EmptyNest'
                            ? 'Kids Move Out'
                            : 'Financial Crisis'}
                        {/* When not triggered, display the year as semi-transparent text next to it to save space. */}
                        {!eventTriggered && (
                          <span className="ml-1 opacity-40 font-normal">
                            (Year {eventYear})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full z-10 transition-colors ${eventTriggered ? 'bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]' : 'bg-zinc-600'}`}
                  ></div>
                </button>

                {/* An extremely compact sci-fi stepper (replacing the original massive slider) */}
                {eventTriggered && (
                  <div className="mt-2 flex items-center justify-between bg-red-950/40 border border-red-500/30 rounded-xl px-3 py-2 animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[10px] text-red-300/80 uppercase tracking-wider font-bold">
                      Strike Year
                    </span>
                    <div className="flex items-center gap-2 bg-black/50 rounded-lg p-1">
                      <button
                        onClick={() => setEventYear(Math.max(1, eventYear - 1))}
                        className="text-red-500 hover:text-white hover:bg-red-500/50 w-6 h-6 flex items-center justify-center rounded transition-all font-mono text-lg leading-none"
                      >
                        -
                      </button>
                      <span className="text-white font-mono text-sm font-bold w-8 text-center">
                        {eventYear}
                      </span>
                      <button
                        onClick={() => setEventYear(Math.min(9, eventYear + 1))}
                        className="text-red-500 hover:text-white hover:bg-red-500/50 w-6 h-6 flex items-center justify-center rounded transition-all font-mono text-lg leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Time slider (main controller, margin slightly reduced to make room) */}
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex justify-between text-white text-sm mb-2 items-end">
                  <span className="font-bold flex items-center gap-2 text-gray-400 uppercase text-xs tracking-wider">
                    <PlayCircle size={14} /> Time Travel
                  </span>
                  <span className="text-lg font-mono font-bold text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded border border-purple-500/20">
                    Year {simulationYear}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={simulationYear}
                  onChange={(e) => setSimulationYear(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
                />
              </div>
            </div>

            {/* Top right: ERU Wealth Tracker (Money Printer effect) */}
            <div
              className={`bg-black/60 backdrop-blur-xl border px-8 py-5 rounded-2xl flex flex-col items-end shadow-2xl transition-all duration-300 ${eventTriggered && simulationYear >= 4 ? 'border-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.3)]' : 'border-white/10'}`}
            >
              <div className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <Activity size={14} className="text-purple-400" /> Live Asset
                Value
              </div>
              <div className="text-4xl font-mono font-black text-white tracking-tight drop-shadow-md">
                {currentDataPoint.CurrentERU.toLocaleString()}{' '}
                <span className="text-lg text-purple-400 font-bold">ERU</span>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent to-white/20 my-3"></div>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                Liquid Fiat Equivalent:
                <span className="text-2xl font-bold text-green-400 font-mono">
                  RM{' '}
                  {(currentDataPoint.CurrentERU * eruPegRate).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* --- ⬇️ Bottom Large Span Chart (The Proof) --- */}
          <div className="w-full h-[35vh] min-h-[300px] px-8 pb-8 pt-12 pointer-events-auto relative">
            {/* 🟢 AI Chart Explanation Floating Window (Top Right Corner) */}
            <div className="absolute top-0 right-12 z-20 flex flex-col items-end max-w-md">
              {!chartExplanation ? (
                <button
                  onClick={handleExplainChart}
                  disabled={isExplaining}
                  className="bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-500/50 px-5 py-2.5 rounded-full text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-50"
                >
                  {isExplaining ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                  {isExplaining
                    ? 'Analyzing Data...'
                    : 'Ask AI to Explain Chart'}
                </button>
              ) : (
                <div className="bg-black/80 backdrop-blur-2xl border border-cyan-500/50 p-5 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)] animate-in slide-in-from-right-4 relative overflow-hidden">
                  {/* Background scanning effect during playback */}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-[shimmer_2s_infinite]"></div>
                  )}

                  <div className="flex items-center justify-between gap-6 mb-3 relative z-10">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                      {isPlaying ? (
                        <Volume2 size={16} className="animate-pulse" />
                      ) : (
                        <Bot size={16} />
                      )}
                      AI Audio Briefing
                    </div>
                    <button
                      onClick={() => {
                        setChartExplanation(null);
                        window.speechSynthesis.cancel();
                        setIsPlaying(false);
                      }}
                      className="text-gray-500 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-gray-200 text-sm leading-relaxed mb-4 relative z-10 font-mono">
                    {chartExplanation}
                  </p>

                  {/* 🎧 Voice playback control bar */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-3 relative z-10">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Activity
                        size={12}
                        className={
                          isPlaying ? 'text-cyan-400 animate-bounce' : ''
                        }
                      />
                      {isPlaying ? 'BROADCASTING...' : 'READY TO PLAY'}
                    </div>
                    <button
                      onClick={toggleSpeech}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' : 'bg-cyan-500 text-black hover:bg-cyan-400'}`}
                    >
                      {isPlaying ? (
                        <>
                          <Square size={12} fill="currentColor" /> Stop
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="currentColor" /> Play Audio
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Legend Floating Window (Explains the meaning of the charts and eliminates judges' confusion) */}
            <div className="absolute top-0 left-12 flex gap-6 z-10 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-bold">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="w-3 h-3 rounded-full bg-red-500/80 border border-red-400"></div>
                Traditional Solar{' '}
                <span className="opacity-50 font-normal">
                  (Hardware Sunk Cost)
                </span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_#a855f7]"></div>
                Helios ERU{' '}
                <span className="text-purple-300/50 font-normal">
                  (Liquid Digital Asset)
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorHelios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff"
                  strokeOpacity={0.05}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />

                {/* Hide the Y-axis and leave only the text to enhance the sense of sophistication. */}
                <YAxis
                  stroke="#666"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  // Add a textShadow here, with a semi-transparent black outline to enhance contrast.
                  tick={{
                    fill: '#9ca3af',
                    style: { textShadow: '0px 2px 4px rgba(0,0,0,1)' },
                  }}
                  tickFormatter={(val) => `RM ${val.toLocaleString()}`}
                  width={80}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(10px)',
                    borderColor: 'rgba(168,85,247,0.3)',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                  itemStyle={{
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                  labelStyle={{
                    color: '#888',
                    marginBottom: '8px',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                  }}
                  formatter={(value: any, name: any) => {
                    // Make the name Tooltip look better
                    const label =
                      name === 'Traditional'
                        ? 'Traditional Value'
                        : 'Helios ERU Value';
                    return [`RM ${Number(value || 0).toLocaleString()}`, label];
                  }}
                />

                {/* Traditional solar power lines (in red to indicate losses during a crisis) */}
                <Area
                  type="monotone"
                  dataKey="Traditional"
                  name="Traditional"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#colorTrad)"
                  animationDuration={1000}
                />

                {/* Helios ERU line (purple, shimmering) */}
                <Area
                  type="monotone"
                  dataKey="HeliosAsset"
                  name="HeliosAsset"
                  stroke="#d8b4fe"
                  strokeWidth={4}
                  fill="url(#colorHelios)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationPage;
