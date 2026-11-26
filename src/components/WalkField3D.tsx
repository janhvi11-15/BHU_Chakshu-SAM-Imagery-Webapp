import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GameMission,
  ParcelPolygon,
  SatelliteTilePreset,
  ScenarioCondition,
  UserPersona,
} from '../types/satellite';
import { GAME_MISSIONS } from '../data/personas';
import {
  Compass,
  Volume2,
  VolumeX,
  Trophy,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Droplets,
  Sun,
  CloudRain,
  Smartphone,
  MapPin,
  Wrench,
  Sprout,
  Flag,
  Waves,
  CheckCircle2,
  Circle,
  Zap,
} from 'lucide-react';

interface WalkField3DProps {
  preset: SatelliteTilePreset;
  activeParcel: ParcelPolygon | null;
  persona: UserPersona;
  onExitToWorkbench: () => void;
}

type FieldTool = 'probe' | 'sluice' | 'stake';

interface LiveFieldTelemetry {
  x: number;
  z: number;
  elev: number;
  localNdvi: number;
  localNdwi: number;
  nearestMissionId: string | null;
  nearestDist: number;
  targetBearingDeg: number;
  autoPilotActive: boolean;
  customStakesCount: number;
}

// Reusable scratch math objects outside animation loop (Zero GC)
const _scratchVec3 = new THREE.Vector3();
const _scratchDir = new THREE.Vector3();
const _scratchTarget = new THREE.Vector3();
const _scratchDummy = new THREE.Object3D();
const _scratchColor = new THREE.Color();

// Procedural terrain elevation function shared between terrain mesh and grounded props
function createHeightSampler(presetId: string) {
  return (x: number, z: number): number => {
    if (presetId === 'wayanad-landslide') {
      const slope = -z * 0.16 + Math.sin(x * 0.12) * 1.4;
      const scar = Math.exp(-Math.pow((x - 1.5) / 3.2, 2)) * -1.4;
      return slope + scar + Math.cos(x * 0.25 + z * 0.2) * 0.35;
    }
    if (presetId === 'godavari-delta' || presetId === 'sundarbans-mangrove') {
      const channel = Math.exp(-Math.pow((z - Math.sin(x * 0.15) * 4) / 3.5, 2)) * -1.1;
      return channel + Math.sin(x * 0.2) * 0.2 + Math.cos(z * 0.2) * 0.2;
    }
    const canal = Math.exp(-Math.pow((z - x * 0.22 - 2) / 2.2, 2)) * -0.75;
    const micro = Math.sin(x * 0.18) * 0.22 + Math.cos(z * 0.18) * 0.22;
    return canal + micro;
  };
}

function sampleSimulatedIndices(
  x: number,
  z: number,
  scenario: ScenarioCondition,
  sluiceOpen: boolean,
  cropTreated: boolean
) {
  const canalDist = Math.abs(z - x * 0.22 - 2);
  const stressDist = Math.hypot(x - 9, z + 7);
  let ndvi = 0.48 + Math.sin(x * 0.25) * 0.14 + Math.cos(z * 0.22) * 0.1;
  let ndwi = canalDist < 3.0 ? 0.28 - canalDist * 0.08 : -0.18;

  if (stressDist < 5.5) {
    ndvi -= cropTreated ? -0.14 : (5.5 - stressDist) * 0.06;
  }
  if (sluiceOpen) {
    ndwi += 0.16;
    ndvi += 0.08;
  }
  if (scenario === 'severe_drought') {
    ndvi -= 0.18;
    ndwi -= 0.22;
  } else if (scenario === 'monsoon_flood') {
    ndwi += 0.32;
  }

  return {
    ndvi: Math.max(-0.3, Math.min(0.92, ndvi)),
    ndwi: Math.max(-0.5, Math.min(0.85, ndwi)),
  };
}

// Procedural Web Audio feedback synth (zero external .mp3 dependencies)
function playSynthTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  muted = false,
  slideToFreq?: number
) {
  if (muted) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close().catch(() => {}), duration * 1000 + 80);
  } catch {
    // ignore audio block
  }
}

function getExpectedToolForMission(m: GameMission): FieldTool {
  if (m.targetType === 'water') return 'sluice';
  if (m.targetType === 'stressed_crop') return 'probe';
  return 'stake';
}

function getActionVerbForMission(m: GameMission): string {
  if (m.targetType === 'water') return 'Open Sluice Gate';
  if (m.targetType === 'stressed_crop') return 'Run Soil Probe & Treat';
  return 'Drive Boundary Stake';
}

export const WalkField3D: React.FC<WalkField3DProps> = ({
  preset,
  activeParcel,
  persona,
  onExitToWorkbench,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // Game & UI State
  const [gameState, setGameState] = useState<'title' | 'playing' | 'victory'>('title');
  const [cameraMode, setCameraMode] = useState<'walk' | 'orbit'>('walk');
  const [scenario, setScenario] = useState<ScenarioCondition>('normal');
  const [activeTool, setActiveTool] = useState<FieldTool>('probe');
  const [muted, setMuted] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [lowEnd2DFallback, setLowEnd2DFallback] = useState<boolean>(false);

  // Interactive Doer World States
  const [completedMissionIds, setCompletedMissionIds] = useState<string[]>([]);
  const [xp, setXp] = useState<number>(0);
  const [sluiceOpen, setSluiceOpen] = useState<boolean>(false);
  const [cropTreated, setCropTreated] = useState<boolean>(false);
  const [bundBuilt, setBundBuilt] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<{
    title: string;
    detail: string;
    coords: string;
  } | null>(null);

  const [telemetry, setTelemetry] = useState<LiveFieldTelemetry>({
    x: 0,
    z: 12,
    elev: 0,
    localNdvi: 0.48,
    localNdwi: -0.12,
    nearestMissionId: GAME_MISSIONS[0].id,
    nearestDist: 10,
    targetBearingDeg: 0,
    autoPilotActive: false,
    customStakesCount: 0,
  });

  // Mutable refs for 60fps simulation loop without tearing down WebGL
  const scenarioRef = useRef<ScenarioCondition>('normal');
  const cameraModeRef = useRef<'walk' | 'orbit'>('walk');
  const gameStateRef = useRef<'title' | 'playing' | 'victory'>('title');
  const activeToolRef = useRef<FieldTool>('probe');
  const mutedRef = useRef<boolean>(false);
  const completedRef = useRef<string[]>([]);
  const sluiceOpenRef = useRef<boolean>(false);
  const cropTreatedRef = useRef<boolean>(false);
  const bundBuiltRef = useRef<boolean>(false);
  const heldKeysRef = useRef<Record<string, boolean>>({});
  const roverPosRef = useRef<{ x: number; z: number; yaw: number }>({ x: 0, z: 12, yaw: Math.PI });
  const waypointRef = useRef<{ x: number; z: number } | null>(null);
  const probeAnimRef = useRef<number>(0);
  const scanPulseRef = useRef<{ active: boolean; progress: number; x: number; z: number; color: number }>({
    active: false,
    progress: 0,
    x: 0,
    z: 0,
    color: 0x10b981,
  });
  const pendingStakeRef = useRef<{ x: number; z: number } | null>(null);
  const customStakesCountRef = useRef<number>(0);

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    completedRef.current = completedMissionIds;
  }, [completedMissionIds]);

  useEffect(() => {
    sluiceOpenRef.current = sluiceOpen;
  }, [sluiceOpen]);

  useEffect(() => {
    cropTreatedRef.current = cropTreated;
  }, [cropTreated]);

  useEffect(() => {
    bundBuiltRef.current = bundBuilt;
  }, [bundBuilt]);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
  }, []);

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 2600);
    return () => clearTimeout(t);
  }, [actionToast]);

  const completeMission = useCallback(
    (mission: GameMission) => {
      if (completedRef.current.includes(mission.id)) return;
      const updated = [...completedRef.current, mission.id];
      completedRef.current = updated;
      setCompletedMissionIds(updated);
      setXp((prev) => prev + mission.xpReward);

      if (mission.targetType === 'water') {
        sluiceOpenRef.current = true;
        setSluiceOpen(true);
      } else if (mission.targetType === 'stressed_crop') {
        cropTreatedRef.current = true;
        setCropTreated(true);
      } else if (mission.targetType === 'flood_boundary') {
        bundBuiltRef.current = true;
        setBundBuilt(true);
      }

      setSelectedInfo({
        title: `Completed: ${mission.title}`,
        detail: `${mission.badgeName} unlocked (+${mission.xpReward} XP). Field world updated dynamically!`,
        coords: `${preset.coordinates.lat.toFixed(4)}°N, ${preset.coordinates.lon.toFixed(4)}°E`,
      });
      playSynthTone(523.25, 0.14, 'triangle', mutedRef.current);
      setTimeout(() => playSynthTone(659.25, 0.22, 'triangle', mutedRef.current), 110);

      if (updated.length >= GAME_MISSIONS.length) {
        setTimeout(() => {
          setGameState('victory');
          playSynthTone(783.99, 0.38, 'triangle', mutedRef.current);
        }, 700);
      }
    },
    [preset.coordinates]
  );

  // Trigger interactive field tool action at rover's current position
  const executeFieldAction = useCallback(
    (forcedTool?: FieldTool) => {
      if (gameStateRef.current !== 'playing') return;

      const rx = roverPosRef.current.x;
      const rz = roverPosRef.current.z;

      // Check proximity to an incomplete mission beacon
      const nearbyMission = GAME_MISSIONS.find(
        (m) =>
          !completedRef.current.includes(m.id) &&
          Math.hypot(rx - m.targetWorldPos.x, rz - m.targetWorldPos.z) <= 4.6
      );

      const toolToUse =
        forcedTool || (nearbyMission ? getExpectedToolForMission(nearbyMission) : activeToolRef.current);
      if (toolToUse !== activeToolRef.current) {
        setActiveTool(toolToUse);
      }

      if (nearbyMission) {
        if (nearbyMission.targetType === 'water') {
          sluiceOpenRef.current = true;
          setSluiceOpen(true);
          scanPulseRef.current = { active: true, progress: 0, x: rx, z: rz, color: 0x06b6d4 };
          playSynthTone(320, 0.25, 'sine', mutedRef.current, 620);
          showToast('Sluice Gate Opened — Canal Irrigation Flowing!');
        } else if (nearbyMission.targetType === 'stressed_crop') {
          probeAnimRef.current = 1.0;
          cropTreatedRef.current = true;
          setCropTreated(true);
          scanPulseRef.current = { active: true, progress: 0, x: rx, z: rz, color: 0x10b981 };
          playSynthTone(190, 0.28, 'sawtooth', mutedRef.current, 120);
          showToast('Soil Probe Verified — Bio-Nutrients & Moisture Applied!');
        } else {
          bundBuiltRef.current = true;
          setBundBuilt(true);
          pendingStakeRef.current = { x: rx, z: rz };
          scanPulseRef.current = { active: true, progress: 0, x: rx, z: rz, color: 0xf43f5e };
          playSynthTone(140, 0.18, 'square', mutedRef.current, 90);
          showToast('Bund Barrier & Geodesic Survey Stake Anchored!');
        }
        completeMission(nearbyMission);
        return;
      }

      // Freeform Doer Actions anywhere on the terrain!
      if (toolToUse === 'probe') {
        probeAnimRef.current = 1.0;
        scanPulseRef.current = { active: true, progress: 0, x: rx, z: rz, color: 0x10b981 };
        const sampled = sampleSimulatedIndices(
          rx,
          rz,
          scenarioRef.current,
          sluiceOpenRef.current,
          cropTreatedRef.current
        );
        setXp((prev) => prev + 15);
        playSynthTone(240, 0.22, 'sawtooth', mutedRef.current, 140);
        setSelectedInfo({
          title: 'Local Soil & NDVI Sample (+15 XP)',
          detail: `Measured NDVI ${sampled.ndvi.toFixed(2)} (${
            sampled.ndvi > 0.45 ? 'Healthy Canopy' : 'Needs Moisture'
          }) · NDWI ${sampled.ndwi.toFixed(2)}.`,
          coords: `Rover (${rx.toFixed(1)}, ${rz.toFixed(1)})`,
        });
        showToast(`Soil Sampled: NDVI ${sampled.ndvi.toFixed(2)} (+15 XP)`);
      } else if (toolToUse === 'sluice') {
        const nearPump = Math.hypot(rx - -7.5, rz - 5.5) <= 5.5;
        if (nearPump) {
          const nextState = !sluiceOpenRef.current;
          sluiceOpenRef.current = nextState;
          setSluiceOpen(nextState);
          scanPulseRef.current = { active: true, progress: 0, x: -7.5, z: 5.5, color: 0x06b6d4 };
          playSynthTone(nextState ? 340 : 480, 0.24, 'sine', mutedRef.current, nextState ? 620 : 280);
          showToast(nextState ? 'Irrigation Sluice Gate Opened!' : 'Irrigation Sluice Gate Closed');
        } else {
          playSynthTone(220, 0.12, 'triangle', mutedRef.current);
          showToast('Drive near the Canal Pump-House to operate the Sluice Valve');
        }
      } else if (toolToUse === 'stake') {
        if (customStakesCountRef.current < 8) {
          pendingStakeRef.current = { x: rx, z: rz };
          scanPulseRef.current = { active: true, progress: 0, x: rx, z: rz, color: 0xf59e0b };
          setXp((prev) => prev + 25);
          playSynthTone(150, 0.16, 'square', mutedRef.current, 85);
          showToast(`Survey Boundary Peg #${customStakesCountRef.current + 1} Driven (+25 XP)`);
        } else {
          showToast('Max 8 custom parcel boundary pegs placed');
        }
      }
    },
    [completeMission, showToast]
  );

  const navigateToMission = useCallback(
    (mission: GameMission) => {
      if (gameStateRef.current !== 'playing') {
        setGameState('playing');
      }
      setCameraMode('walk');
      setActiveTool(getExpectedToolForMission(mission));
      waypointRef.current = {
        x: mission.targetWorldPos.x,
        z: mission.targetWorldPos.z + 1.6,
      };
      showToast(`Auto-Pilot engaged -> ${mission.title}`);
      playSynthTone(480, 0.1, 'sine', mutedRef.current, 600);
    },
    [showToast]
  );

  const handleRestartMissions = () => {
    completedRef.current = [];
    sluiceOpenRef.current = false;
    cropTreatedRef.current = false;
    bundBuiltRef.current = false;
    customStakesCountRef.current = 0;
    waypointRef.current = null;
    roverPosRef.current = { x: 0, z: 12, yaw: Math.PI };
    setCompletedMissionIds([]);
    setSluiceOpen(false);
    setCropTreated(false);
    setBundBuilt(false);
    setXp(0);
    setSelectedInfo(null);
    setActionToast(null);
    setGameState('playing');
  };

  // Mount Three.js scene once per preset or fallback toggle
  useEffect(() => {
    if (lowEnd2DFallback) return;
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1726);
    scene.fog = new THREE.FogExp2(0x0b1726, 0.014);

    // Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 180);
    camera.position.set(0, 14, 24);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 48;

    // 2. Studio 3-Point + Warm/Cool Outdoor Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3b2f24, 0.7);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    sunLight.position.set(18, 28, 14);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -26;
    sunLight.shadow.camera.right = 26;
    sunLight.shadow.camera.top = 26;
    sunLight.shadow.camera.bottom = -26;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-16, 10, -18);
    scene.add(rimLight);

    // 3. DEM Terrain Mesh draped with Satellite + Segmentation CanvasTexture
    const groundHeightAt = createHeightSampler(preset.id);
    const terrainSize = 48;
    const segments = 64;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(x, z));
    }
    terrainGeo.computeVertexNormals();

    const texCanvas = document.createElement('canvas');
    texCanvas.width = 512;
    texCanvas.height = 512;
    const texCtx = texCanvas.getContext('2d')!;
    texCtx.fillStyle = '#1e3a29';
    texCtx.fillRect(0, 0, 512, 512);

    const terrainTexture = new THREE.CanvasTexture(texCanvas);
    terrainTexture.colorSpace = THREE.SRGBColorSpace;
    terrainTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = preset.thumbnailUrl;
    img.onload = () => {
      texCtx.drawImage(img, 0, 0, 512, 512);
      if (activeParcel && activeParcel.points.length >= 3) {
        texCtx.beginPath();
        const scale = 512 / 800;
        texCtx.moveTo(activeParcel.points[0].x * scale, activeParcel.points[0].y * scale);
        for (let i = 1; i < activeParcel.points.length; i++) {
          texCtx.lineTo(activeParcel.points[i].x * scale, activeParcel.points[i].y * scale);
        }
        texCtx.closePath();
        texCtx.fillStyle = 'rgba(16, 185, 129, 0.32)';
        texCtx.fill();
        texCtx.strokeStyle = '#34d399';
        texCtx.lineWidth = 4;
        texCtx.stroke();
      }
      terrainTexture.needsUpdate = true;
    };

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.88,
      metalness: 0.04,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.userData = {
      isTerrain: true,
      title: preset.name,
      detail: `${preset.sensor} (${preset.gsdMetersPerPixel}m GSD) · ${preset.primaryClass}`,
    };
    scene.add(terrainMesh);

    // 4. Scenario Water Layer
    const waterGeo = new THREE.PlaneGeometry(terrainSize * 1.4, terrainSize * 1.4);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.14,
      metalness: 0.1,
      transparent: true,
      opacity: 0.62,
      clearcoat: 1.0,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = -2.0;
    scene.add(waterMesh);

    // 5. Composite 12-Part Procedural Surveyor Rover + Animated Wheels + Soil Probe Arm
    const roverGroup = new THREE.Group();
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.45 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.75 });
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.85 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.9,
    });
    const probeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.85,
    });

    const bodyGeo = new THREE.BoxGeometry(0.95, 0.28, 1.3);
    const body = new THREE.Mesh(bodyGeo, chassisMat);
    body.position.y = 0.44;
    body.castShadow = true;
    roverGroup.add(body);

    const solarGeo = new THREE.BoxGeometry(0.84, 0.04, 0.92);
    const solarPanel = new THREE.Mesh(solarGeo, solarMat);
    solarPanel.position.set(0, 0.6, -0.08);
    solarPanel.castShadow = true;
    roverGroup.add(solarPanel);

    const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const roverWheels: THREE.Mesh[] = [];
    const wheelOffsets: [number, number, number][] = [
      [-0.52, 0.22, 0.44],
      [0.52, 0.22, 0.44],
      [-0.52, 0.22, -0.44],
      [0.52, 0.22, -0.44],
    ];
    wheelOffsets.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, darkMetalMat);
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      roverGroup.add(wheel);
      roverWheels.push(wheel);
    });

    const mastGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.56, 10);
    const mast = new THREE.Mesh(mastGeo, darkMetalMat);
    mast.position.set(0, 0.84, 0.36);
    roverGroup.add(mast);

    const camHeadGeo = new THREE.BoxGeometry(0.28, 0.18, 0.22);
    const camHead = new THREE.Mesh(camHeadGeo, chassisMat);
    camHead.position.set(0, 1.12, 0.38);
    roverGroup.add(camHead);

    const camLensGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
    const camLens = new THREE.Mesh(camLensGeo, lensMat);
    camLens.rotation.x = Math.PI / 2;
    camLens.position.set(0, 1.12, 0.5);
    roverGroup.add(camLens);

    // Animated Mechanical Soil Probe Arm on front-right
    const probeArmGroup = new THREE.Group();
    probeArmGroup.position.set(0.38, 0.48, 0.56);
    const probeShaftGeo = new THREE.CylinderGeometry(0.035, 0.02, 0.65, 8);
    const probeShaft = new THREE.Mesh(probeShaftGeo, probeMat);
    probeShaft.position.y = -0.1;
    probeArmGroup.add(probeShaft);
    const probeTipGeo = new THREE.ConeGeometry(0.06, 0.14, 8);
    probeTipGeo.rotateX(Math.PI);
    const probeTip = new THREE.Mesh(probeTipGeo, lensMat);
    probeTip.position.y = -0.45;
    probeArmGroup.add(probeTip);
    roverGroup.add(probeArmGroup);

    roverGroup.position.set(
      roverPosRef.current.x,
      groundHeightAt(roverPosRef.current.x, roverPosRef.current.z),
      roverPosRef.current.z
    );
    scene.add(roverGroup);

    // 6. Composite 7-Part Animated Canal Pump-House + Sluice Valve Wheel + Water Particle Flow
    const pumpHouse = new THREE.Group();
    const plinthGeo = new THREE.BoxGeometry(2.3, 0.3, 2.3);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.15;
    pumpHouse.add(plinth);

    const wallsGeo = new THREE.BoxGeometry(1.75, 1.25, 1.75);
    const wallsMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const walls = new THREE.Mesh(wallsGeo, wallsMat);
    walls.position.y = 0.92;
    walls.castShadow = true;
    pumpHouse.add(walls);

    const roofGeo = new THREE.ConeGeometry(1.55, 0.72, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.9;
    roof.castShadow = true;
    pumpHouse.add(roof);

    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.85, 0.65, 0),
      new THREE.Vector3(1.65, 0.58, 0.42),
      new THREE.Vector3(2.25, -0.25, 0.8),
    ]);
    const pipeGeo = new THREE.TubeGeometry(pipeCurve, 12, 0.12, 8, false);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.7 });
    pumpHouse.add(new THREE.Mesh(pipeGeo, pipeMat));

    // Spinning Sluice Valve Handwheel
    const valveMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.6 });
    const valveWheelGeo = new THREE.TorusGeometry(0.28, 0.05, 8, 16);
    const valveWheel = new THREE.Mesh(valveWheelGeo, valveMat);
    valveWheel.position.set(0.95, 1.15, 0);
    valveWheel.rotation.y = Math.PI / 2;
    pumpHouse.add(valveWheel);

    // Movable Sluice Gate Shutter
    const gateGeo = new THREE.BoxGeometry(0.12, 0.65, 0.65);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, metalness: 0.8 });
    const sluiceGate = new THREE.Mesh(gateGeo, gateMat);
    sluiceGate.position.set(1.02, 0.52, 0.1);
    pumpHouse.add(sluiceGate);

    const px = -7.5;
    const pz = 5.5;
    pumpHouse.position.set(px, groundHeightAt(px, pz), pz);
    pumpHouse.userData = {
      inspectable: true,
      missionId: 'mission-water',
      title: 'Canal Pump-House & Irrigation Sluice',
      detail: 'Drive close and press [E] with the Sluice Tool [2] to open irrigation flow.',
    };
    scene.add(pumpHouse);

    // Animated Water Flow Particles out of Pump-House Pipe
    const waterDropCount = 32;
    const waterDropGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const waterDropMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.15,
    });
    const waterDrops = new THREE.InstancedMesh(waterDropGeo, waterDropMat, waterDropCount);
    waterDrops.visible = false;
    scene.add(waterDrops);

    // 7. InstancedMesh Field Trees along Natural Outdoor Perimeter
    const treeCount = 42;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.1, 7);
    trunkGeo.translate(0, 0.55, 0);
    const canopyGeo = new THREE.ConeGeometry(0.85, 1.9, 8);
    canopyGeo.translate(0, 1.8, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.78 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    trunks.castShadow = !isSoftwareGl;
    canopies.castShadow = !isSoftwareGl;

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 16.5 + (i % 4) * 2.1;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      const scale = 0.85 + ((i * 17) % 30) / 100;
      _scratchDummy.position.set(tx, groundHeightAt(tx, tz), tz);
      _scratchDummy.scale.setScalar(scale);
      _scratchDummy.rotation.set(0, i * 0.7, 0);
      _scratchDummy.updateMatrix();
      trunks.setMatrixAt(i, _scratchDummy.matrix);
      canopies.setMatrixAt(i, _scratchDummy.matrix);
      _scratchColor.setHSL(0.32 + ((i % 5) - 2) * 0.02, 0.65, 0.35 + (i % 3) * 0.06);
      canopies.setColorAt(i, _scratchColor);
    }
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();
    scene.add(trunks);
    scene.add(canopies);

    // 8. Instanced Crop Clusters (48 living agricultural tufts reacting to hydration & treatment!)
    const cropCount = 48;
    const cropGeo = new THREE.ConeGeometry(0.28, 0.68, 6);
    cropGeo.translate(0, 0.34, 0);
    const cropMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
    const cropTufts = new THREE.InstancedMesh(cropGeo, cropMat, cropCount);
    const cropCoords: { x: number; z: number; isStressedSector: boolean }[] = [];

    for (let i = 0; i < cropCount; i++) {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const cx = -11 + col * 3.1 + ((i % 3) - 1) * 0.45;
      const cz = -11 + row * 3.5 + ((i % 2) - 0.5) * 0.4;
      const isStressedSector = Math.hypot(cx - 9, cz + 7) < 6.5;
      cropCoords.push({ x: cx, z: cz, isStressedSector });
      _scratchDummy.position.set(cx, groundHeightAt(cx, cz), cz);
      _scratchDummy.scale.setScalar(isStressedSector ? 0.65 : 1.0);
      _scratchDummy.rotation.set(0, i * 0.5, 0);
      _scratchDummy.updateMatrix();
      cropTufts.setMatrixAt(i, _scratchDummy.matrix);
      _scratchColor.setHex(isStressedSector ? 0xd97706 : 0x22c55e);
      cropTufts.setColorAt(i, _scratchColor);
    }
    cropTufts.computeBoundingSphere();
    scene.add(cropTufts);

    // 9. Bund / Flood Protection Berms (Appear on ridge when Tool 3 completes mission-boundary!)
    const bundGroup = new THREE.Group();
    const bermGeo = new THREE.BoxGeometry(1.15, 0.42, 0.55);
    const bermMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.92 });
    for (let b = -3; b <= 3; b++) {
      const bx = -10 + b * 0.9;
      const bz = -10 + Math.sin(b * 0.6) * 0.6;
      const berm = new THREE.Mesh(bermGeo, bermMat);
      berm.position.set(bx, groundHeightAt(bx, bz) + 0.2, bz);
      berm.rotation.y = b * 0.15;
      berm.castShadow = true;
      bundGroup.add(berm);
    }
    bundGroup.visible = bundBuiltRef.current;
    scene.add(bundGroup);

    // 10. Dynamic Geodesic Survey Pegs + Connecting Laser Loop (Tool 3 Doer Action)
    const stakesGroup = new THREE.Group();
    scene.add(stakesGroup);
    const stakeVertices: THREE.Vector3[] = [];
    const stakeBaseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10);
    const stakePoleGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8);
    const stakeCapGeo = new THREE.SphereGeometry(0.09, 10, 10);
    const stakeMetalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.8 });
    const stakeCapMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
    });
    const boundaryLineGeo = new THREE.BufferGeometry();
    const boundaryLineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
    const boundaryLine = new THREE.Line(boundaryLineGeo, boundaryLineMat);
    scene.add(boundaryLine);

    const spawnSurveyStake = (sx: number, sz: number) => {
      const sy = groundHeightAt(sx, sz);
      const peg = new THREE.Group();
      const base = new THREE.Mesh(stakeBaseGeo, stakeMetalMat);
      base.position.y = 0.04;
      peg.add(base);
      const pole = new THREE.Mesh(stakePoleGeo, stakeMetalMat);
      pole.position.y = 0.54;
      pole.castShadow = true;
      peg.add(pole);
      const cap = new THREE.Mesh(stakeCapGeo, stakeCapMat);
      cap.position.y = 1.08;
      peg.add(cap);
      peg.position.set(sx, sy, sz);
      stakesGroup.add(peg);

      stakeVertices.push(new THREE.Vector3(sx, sy + 0.95, sz));
      if (stakeVertices.length >= 2) {
        const pts = [...stakeVertices];
        if (pts.length >= 3) pts.push(pts[0]);
        boundaryLine.geometry.dispose();
        boundaryLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      }
      customStakesCountRef.current = stakeVertices.length;
    };

    // 11. Terrain Scan Ripple Ring + Click-to-Drive Waypoint Ring
    const scanRingGeo = new THREE.RingGeometry(0.35, 0.55, 32);
    scanRingGeo.rotateX(-Math.PI / 2);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const scanRingMesh = new THREE.Mesh(scanRingGeo, scanRingMat);
    scanRingMesh.visible = false;
    scene.add(scanRingMesh);

    const waypointGeo = new THREE.RingGeometry(0.45, 0.65, 24);
    waypointGeo.rotateX(-Math.PI / 2);
    const waypointMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const waypointMesh = new THREE.Mesh(waypointGeo, waypointMat);
    waypointMesh.visible = false;
    scene.add(waypointMesh);

    // 12. Mission Waypoint Beacons + Guidance Light Columns
    const missionObjects: {
      mission: GameMission;
      group: THREE.Group;
      ring: THREE.Mesh;
      core: THREE.Mesh;
      beam: THREE.Mesh;
    }[] = [];
    const clickableMeshes: THREE.Object3D[] = [terrainMesh, pumpHouse];
    const missionGeos: THREE.BufferGeometry[] = [];
    const missionMats: THREE.Material[] = [];

    GAME_MISSIONS.forEach((m) => {
      const bGroup = new THREE.Group();
      const baseColor =
        m.targetType === 'water' ? 0x06b6d4 : m.targetType === 'stressed_crop' ? 0xf59e0b : 0xf43f5e;

      const pedGeo = new THREE.CylinderGeometry(0.55, 0.72, 0.25, 16);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
      const pedestal = new THREE.Mesh(pedGeo, pedMat);
      pedestal.position.y = 0.125;
      bGroup.add(pedestal);

      const coreGeo = new THREE.OctahedronGeometry(0.42, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.5,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = 1.45;
      core.userData = { missionId: m.id };
      bGroup.add(core);

      const rGeo = new THREE.TorusGeometry(0.75, 0.06, 10, 28);
      const rMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.position.y = 1.45;
      bGroup.add(ring);

      const beamGeo = new THREE.CylinderGeometry(0.1, 0.35, 9, 12, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 4.6;
      bGroup.add(beam);

      const by = groundHeightAt(m.targetWorldPos.x, m.targetWorldPos.z);
      bGroup.position.set(m.targetWorldPos.x, by, m.targetWorldPos.z);
      scene.add(bGroup);

      missionGeos.push(pedGeo, coreGeo, rGeo, beamGeo);
      missionMats.push(pedMat, coreMat, rMat, beamMat);
      clickableMeshes.push(core);
      missionObjects.push({ mission: m, group: bGroup, ring, core, beam });
    });

    // 13. Raycasting: Click beacons to execute (if close) or auto-navigate; click ground to set drive waypoint!
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, true);
      if (hits.length === 0) return;

      const hit = hits[0];
      let cur: THREE.Object3D | null = hit.object;
      let missionId: string | undefined;
      while (cur) {
        if (cur.userData?.missionId) {
          missionId = cur.userData.missionId;
          break;
        }
        cur = cur.parent;
      }

      if (missionId) {
        const found = GAME_MISSIONS.find((gm) => gm.id === missionId);
        if (found) {
          const dist = Math.hypot(
            roverPosRef.current.x - found.targetWorldPos.x,
            roverPosRef.current.z - found.targetWorldPos.z
          );
          if (dist <= 4.6 && !completedRef.current.includes(found.id)) {
            executeFieldAction(getExpectedToolForMission(found));
          } else {
            setCameraMode('walk');
            setActiveTool(getExpectedToolForMission(found));
            waypointRef.current = { x: found.targetWorldPos.x, z: found.targetWorldPos.z + 1.6 };
            showToast(`Driving to ${found.title}...`);
            playSynthTone(480, 0.08, 'sine', mutedRef.current);
          }
          return;
        }
      }

      if (hit.object.userData?.isTerrain) {
        const pt = hit.point;
        const clampedX = THREE.MathUtils.clamp(pt.x, -21, 21);
        const clampedZ = THREE.MathUtils.clamp(pt.z, -21, 21);
        waypointRef.current = { x: clampedX, z: clampedZ };
        const sampled = sampleSimulatedIndices(
          clampedX,
          clampedZ,
          scenarioRef.current,
          sluiceOpenRef.current,
          cropTreatedRef.current
        );
        setSelectedInfo({
          title: 'Waypoint Locked (Driving)',
          detail: `Est. NDVI ${sampled.ndvi.toFixed(2)} · NDWI ${sampled.ndwi.toFixed(2)}. Press [E] anytime to probe soil or drive a stake.`,
          coords: `Elev ${pt.y.toFixed(1)}m · (${clampedX.toFixed(1)}, ${clampedZ.toFixed(1)})`,
        });
        playSynthTone(420, 0.06, 'sine', mutedRef.current);
      }
    };
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // Keyboard listeners (WASD + Shift sprint + 1/2/3 tool select + E/Space Execute)
    const onKeyDown = (e: KeyboardEvent) => {
      heldKeysRef.current[e.code] = true;
      if (e.code === 'Digit1') setActiveTool('probe');
      if (e.code === 'Digit2') setActiveTool('sluice');
      if (e.code === 'Digit3') setActiveTool('stake');
      if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) {
        if (gameStateRef.current === 'playing') {
          e.preventDefault();
          executeFieldAction();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current[e.code] = false;
    };
    const onWindowBlur = () => {
      heldKeysRef.current = {};
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 14. 60fps Simulation Loop (clamped dt + afterDraw guard + throttled 10Hz HUD sync)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let lastHudSync = 0;
    let lastHydratedVisual = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Spawn any queued survey stake
      if (pendingStakeRef.current) {
        spawnSurveyStake(pendingStakeRef.current.x, pendingStakeRef.current.z);
        pendingStakeRef.current = null;
      }

      // Bund visibility
      bundGroup.visible = bundBuiltRef.current;

      // Scenario Water Layer
      const targetWaterY =
        scenarioRef.current === 'monsoon_flood'
          ? 0.25
          : scenarioRef.current === 'severe_drought'
          ? -3.5
          : sluiceOpenRef.current
          ? -0.65
          : -1.15;
      waterMesh.position.y = THREE.MathUtils.damp(waterMesh.position.y, targetWaterY, 2.5, dt);

      if (scenarioRef.current === 'severe_drought') {
        terrainMat.color.setHex(0xe5c49f);
        sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, 2.35, 3, dt);
      } else if (scenarioRef.current === 'monsoon_flood') {
        terrainMat.color.setHex(0xcbd5e1);
        sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, 1.35, 3, dt);
      } else {
        terrainMat.color.setHex(0xffffff);
        sunLight.intensity = THREE.MathUtils.damp(sunLight.intensity, 1.85, 3, dt);
      }

      // Pump-House Sluice Animation & Water Droplets
      const targetGateY = sluiceOpenRef.current ? 1.02 : 0.52;
      sluiceGate.position.y = THREE.MathUtils.damp(sluiceGate.position.y, targetGateY, 4, dt);
      if (sluiceOpenRef.current) {
        valveWheel.rotation.x += dt * 3.2;
        waterDrops.visible = true;
        for (let i = 0; i < waterDropCount; i++) {
          const t = ((elapsed * 1.8 + i / waterDropCount) % 1);
          const wx = px + 2.25 + t * 2.4;
          const wz = pz + 0.8 + t * 1.1;
          const wy = groundHeightAt(px, pz) + 0.45 - t * t * 1.4;
          _scratchDummy.position.set(wx, wy, wz);
          _scratchDummy.scale.setScalar(0.85 + Math.sin(t * Math.PI) * 0.4);
          _scratchDummy.updateMatrix();
          waterDrops.setMatrixAt(i, _scratchDummy.matrix);
        }
        waterDrops.instanceMatrix.needsUpdate = true;
      } else {
        waterDrops.visible = false;
      }

      // Update Instanced Crop Tufts when irrigation/treatment changes
      const hydratedOrTreated = sluiceOpenRef.current || cropTreatedRef.current;
      if (hydratedOrTreated !== lastHydratedVisual) {
        lastHydratedVisual = hydratedOrTreated;
        for (let i = 0; i < cropCount; i++) {
          const c = cropCoords[i];
          const recovered = !c.isStressedSector || cropTreatedRef.current;
          _scratchDummy.position.set(c.x, groundHeightAt(c.x, c.z), c.z);
          _scratchDummy.scale.setScalar(recovered ? (sluiceOpenRef.current ? 1.15 : 1.0) : 0.65);
          _scratchDummy.rotation.set(0, i * 0.5, 0);
          _scratchDummy.updateMatrix();
          cropTufts.setMatrixAt(i, _scratchDummy.matrix);
          _scratchColor.setHex(recovered ? 0x22c55e : 0xd97706);
          cropTufts.setColorAt(i, _scratchColor);
        }
        cropTufts.instanceMatrix.needsUpdate = true;
        if (cropTufts.instanceColor) cropTufts.instanceColor.needsUpdate = true;
      }

      // Rover Soil Probe Animation & Lens Color Matching Active Tool
      if (probeAnimRef.current > 0) {
        probeAnimRef.current = Math.max(0, probeAnimRef.current - dt * 1.5);
        probeArmGroup.position.y = 0.48 - Math.sin(probeAnimRef.current * Math.PI) * 0.34;
      } else {
        probeArmGroup.position.y = 0.48;
      }
      const activeToolHex =
        activeToolRef.current === 'probe'
          ? 0x10b981
          : activeToolRef.current === 'sluice'
          ? 0x06b6d4
          : 0xf59e0b;
      lensMat.color.setHex(activeToolHex);
      lensMat.emissive.setHex(activeToolHex);

      // Terrain Scan Ripple Ring Animation
      if (scanPulseRef.current.active) {
        scanPulseRef.current.progress += dt * 1.3;
        const p = scanPulseRef.current.progress;
        if (p >= 1) {
          scanPulseRef.current.active = false;
          scanRingMesh.visible = false;
        } else {
          scanRingMesh.visible = true;
          scanRingMesh.position.set(
            scanPulseRef.current.x,
            groundHeightAt(scanPulseRef.current.x, scanPulseRef.current.z) + 0.14,
            scanPulseRef.current.z
          );
          scanRingMesh.scale.setScalar(1 + p * 7.5);
          scanRingMat.color.setHex(scanPulseRef.current.color);
          scanRingMat.opacity = (1 - p) * 0.85;
        }
      }

      // Mission Beacons Animation
      missionObjects.forEach((mo, idx) => {
        const isDone = completedRef.current.includes(mo.mission.id);
        mo.ring.rotation.y += dt * (isDone ? 0.5 : 1.6);
        mo.ring.rotation.x = isDone ? Math.PI / 2 : Math.sin(elapsed + idx) * 0.4;
        mo.core.rotation.y -= dt * (isDone ? 0.4 : 1.2);
        mo.core.position.y = isDone ? 0.95 : 1.45 + Math.sin(elapsed * 2 + idx) * 0.14;
        mo.core.scale.setScalar(isDone ? 0.48 : 1.0);
        mo.beam.visible = !isDone;
        if (!isDone) {
          (mo.beam.material as THREE.MeshBasicMaterial).opacity =
            0.14 + Math.sin(elapsed * 3 + idx) * 0.05;
        }
      });

      // Rover Movement (Manual WASD/Arrows or Waypoint Auto-Drive)
      const keys = heldKeysRef.current;
      let moveX = 0;
      let moveZ = 0;
      if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

      const manualInput = moveX !== 0 || moveZ !== 0;
      if (manualInput) {
        waypointRef.current = null; // Manual controls cleanly override auto-pilot
      }

      let currentSpeed = 0;
      if (gameStateRef.current === 'title') {
        camera.position.x = Math.sin(elapsed * 0.18) * 20;
        camera.position.z = Math.cos(elapsed * 0.18) * 20;
        camera.position.y = 12;
        controls.target.set(0, 0, 0);
      } else if (cameraModeRef.current === 'walk') {
        const isSprinting = keys['ShiftLeft'] || keys['ShiftRight'];
        const maxSpeed = isSprinting ? 11.5 : 7.8;

        if (manualInput) {
          _scratchDir.set(moveX, 0, moveZ).normalize();
          currentSpeed = maxSpeed;
        } else if (waypointRef.current) {
          const dx = waypointRef.current.x - roverPosRef.current.x;
          const dz = waypointRef.current.z - roverPosRef.current.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.6) {
            _scratchDir.set(dx / dist, 0, dz / dist);
            currentSpeed = 7.2;
          } else {
            waypointRef.current = null;
          }
        }

        if (currentSpeed > 0) {
          roverPosRef.current.x = THREE.MathUtils.clamp(
            roverPosRef.current.x + _scratchDir.x * currentSpeed * dt,
            -21,
            21
          );
          roverPosRef.current.z = THREE.MathUtils.clamp(
            roverPosRef.current.z + _scratchDir.z * currentSpeed * dt,
            -21,
            21
          );
          const targetYaw = Math.atan2(_scratchDir.x, _scratchDir.z);
          roverGroup.rotation.y = targetYaw;
          roverPosRef.current.yaw = targetYaw;

          // Spin rover wheels proportionally
          for (let w = 0; w < roverWheels.length; w++) {
            roverWheels[w].rotation.x += currentSpeed * dt * 3.5;
          }
        }

        const groundY = groundHeightAt(roverPosRef.current.x, roverPosRef.current.z);
        roverGroup.position.set(roverPosRef.current.x, groundY, roverPosRef.current.z);

        // Waypoint Marker ring
        if (waypointRef.current) {
          waypointMesh.visible = true;
          waypointMesh.position.set(
            waypointRef.current.x,
            groundHeightAt(waypointRef.current.x, waypointRef.current.z) + 0.14,
            waypointRef.current.z
          );
          waypointMesh.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.15);
        } else {
          waypointMesh.visible = false;
        }

        // Smooth 3rd-person chase camera
        _scratchTarget.set(roverPosRef.current.x, groundY + 1.4, roverPosRef.current.z);
        controls.target.lerp(_scratchTarget, 1 - Math.exp(-6 * dt));
        _scratchVec3.set(roverPosRef.current.x, groundY + 5.2, roverPosRef.current.z + 9.2);
        if (currentSpeed > 0) {
          camera.position.lerp(_scratchVec3, 1 - Math.exp(-3.5 * dt));
        }
      }

      // Throttled 10Hz HUD Telemetry Sync (Radar bearing + nearest mission + local indices)
      if (elapsed - lastHudSync > 0.1) {
        lastHudSync = elapsed;
        let nearestMission: GameMission | null = null;
        let nearestDist = 999;
        for (const gm of GAME_MISSIONS) {
          if (completedRef.current.includes(gm.id)) continue;
          const d = Math.hypot(
            gm.targetWorldPos.x - roverPosRef.current.x,
            gm.targetWorldPos.z - roverPosRef.current.z
          );
          if (d < nearestDist) {
            nearestDist = d;
            nearestMission = gm;
          }
        }
        const bearingRad = nearestMission
          ? Math.atan2(
              nearestMission.targetWorldPos.x - roverPosRef.current.x,
              -(nearestMission.targetWorldPos.z - roverPosRef.current.z)
            )
          : 0;
        const sampled = sampleSimulatedIndices(
          roverPosRef.current.x,
          roverPosRef.current.z,
          scenarioRef.current,
          sluiceOpenRef.current,
          cropTreatedRef.current
        );

        setTelemetry({
          x: roverPosRef.current.x,
          z: roverPosRef.current.z,
          elev: groundHeightAt(roverPosRef.current.x, roverPosRef.current.z),
          localNdvi: sampled.ndvi,
          localNdwi: sampled.ndwi,
          nearestMissionId: nearestMission ? nearestMission.id : null,
          nearestDist: nearestMission ? nearestDist : 0,
          targetBearingDeg: (bearingRad * 180) / Math.PI,
          autoPilotActive: !!waypointRef.current,
          customStakesCount: customStakesCountRef.current,
        });
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      terrainTexture.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      bodyGeo.dispose();
      solarGeo.dispose();
      wheelGeo.dispose();
      mastGeo.dispose();
      camHeadGeo.dispose();
      camLensGeo.dispose();
      probeShaftGeo.dispose();
      probeTipGeo.dispose();
      chassisMat.dispose();
      darkMetalMat.dispose();
      solarMat.dispose();
      lensMat.dispose();
      probeMat.dispose();
      plinthGeo.dispose();
      wallsGeo.dispose();
      roofGeo.dispose();
      pipeGeo.dispose();
      valveWheelGeo.dispose();
      gateGeo.dispose();
      plinthMat.dispose();
      wallsMat.dispose();
      roofMat.dispose();
      pipeMat.dispose();
      valveMat.dispose();
      gateMat.dispose();
      waterDropGeo.dispose();
      waterDropMat.dispose();
      trunkGeo.dispose();
      canopyGeo.dispose();
      trunkMat.dispose();
      canopyMat.dispose();
      cropGeo.dispose();
      cropMat.dispose();
      bermGeo.dispose();
      bermMat.dispose();
      stakeBaseGeo.dispose();
      stakePoleGeo.dispose();
      stakeCapGeo.dispose();
      stakeMetalMat.dispose();
      stakeCapMat.dispose();
      boundaryLine.geometry.dispose();
      boundaryLineMat.dispose();
      scanRingGeo.dispose();
      scanRingMat.dispose();
      waypointGeo.dispose();
      waypointMat.dispose();
      missionGeos.forEach((g) => g.dispose());
      missionMats.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, [preset, activeParcel, lowEnd2DFallback, completeMission, executeFieldAction, showToast]);

  const setVirtualKey = (code: string, pressed: boolean) => {
    heldKeysRef.current[code] = pressed;
  };

  // Compute nearest incomplete mission & proximity for contextual Doer CTA
  const activeMission = GAME_MISSIONS.find((m) => m.id === telemetry.nearestMissionId) || null;
  const inMissionRange = !!activeMission && telemetry.nearestDist <= 4.6;

  if (lowEnd2DFallback) {
    return (
      <div className="relative w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              Lightweight 2D Field Ops (Low-End Device Mode)
            </h3>
            <button
              onClick={() => setLowEnd2DFallback(false)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white"
            >
              Restore 3D View
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {(
              [
                { id: 'probe', label: '1. Soil Probe' },
                { id: 'sluice', label: '2. Sluice Valve' },
                { id: 'stake', label: '3. Survey Peg' },
              ] as { id: FieldTool; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                className={`flex-1 py-1.5 rounded-lg border font-medium ${
                  activeTool === t.id
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative rounded-xl overflow-hidden border border-slate-700 aspect-square max-h-[48vh] mx-auto">
            <img src={preset.thumbnailUrl} alt={preset.name} className="w-full h-full object-cover" />
            {GAME_MISSIONS.map((m) => {
              const done = completedMissionIds.includes(m.id);
              const leftPct = ((m.targetWorldPos.x + 24) / 48) * 100;
              const topPct = ((m.targetWorldPos.z + 24) / 48) * 100;
              return (
                <button
                  key={m.id}
                  onClick={() => completeMission(m)}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded text-[11px] font-semibold shadow-lg ${
                    done ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {done ? '✓ ' : '▶ '}
                  {getActionVerbForMission(m)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Tasks Done: {completedMissionIds.length}/{GAME_MISSIONS.length}</span>
            <span className="font-mono text-emerald-400">XP: {xp}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* Isolated WebGL Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Low-Occlusion HUD Overlay Wrapper (no backdrop-filter over WebGL!) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        {/* Top Perimeter Bar */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left Live Radar, Telemetry & Interactive Task Checklist */}
          <div className="pointer-events-auto rounded-xl bg-slate-900/92 border border-slate-700 p-3 shadow-xl space-y-2.5 max-w-xs w-full sm:w-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0"
                  title="Bearing toward active objective"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-400">
                    <g transform={`rotate(${Math.round(telemetry.targetBearingDeg)} 12 12)`}>
                      <polygon points="12,3 17,19 12,15.5 7,19" fill="currentColor" />
                    </g>
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-white truncate max-w-[140px]">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono tabular-nums">
                    XP: {xp} · Tasks: {completedMissionIds.length}/{GAME_MISSIONS.length}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLowEnd2DFallback(true)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700 flex items-center gap-1"
                title="Switch to lightweight 2D field mode"
              >
                <Smartphone className="w-3 h-3" />
                <span className="hidden sm:inline">2D Lite</span>
              </button>
            </div>

            {/* Live Ground Indices Bar */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800">
              <span className="text-emerald-400">NDVI {telemetry.localNdvi.toFixed(2)}</span>
              <span className="text-sky-400">NDWI {telemetry.localNdwi.toFixed(2)}</span>
              <span className="text-slate-300">Elev {telemetry.elev.toFixed(1)}m</span>
            </div>

            {/* Interactive Field Task Checklist with Auto-Pilot buttons */}
            {gameState === 'playing' && (
              <div className="space-y-1">
                {GAME_MISSIONS.map((m) => {
                  const done = completedMissionIds.includes(m.id);
                  const isTarget = activeMission?.id === m.id;
                  const dist = Math.hypot(
                    m.targetWorldPos.x - telemetry.x,
                    m.targetWorldPos.z - telemetry.z
                  );
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg border text-[11px] ${
                        done
                          ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-300'
                          : isTarget
                          ? 'bg-slate-800/90 border-amber-500/60 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">
                          {persona === 'farmer' ? m.titleHi : m.title}
                        </span>
                      </div>
                      {!done && (
                        <button
                          onClick={() => navigateToMission(m)}
                          className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700 hover:bg-emerald-600 text-[10px] font-mono text-white transition-colors"
                          title="Auto-pilot rover to this task"
                        >
                          {dist.toFixed(0)}m →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Perimeter Actions */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setMuted((m) => !m)}
              className="p-2 rounded-lg bg-slate-900/92 border border-slate-700 text-slate-200 hover:bg-slate-800"
              title={muted ? 'Unmute audio feedback' : 'Mute audio feedback'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onExitToWorkbench}
              className="px-3 py-2 rounded-lg bg-slate-900/92 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Back to SAM 2D
            </button>
          </div>
        </div>

        {/* Middle Feedback Area: Toast + Selected Beacon Card */}
        <div className="flex flex-col items-start gap-2">
          {actionToast && gameState === 'playing' && (
            <div className="self-center px-4 py-1.5 rounded-xl bg-emerald-950/95 border border-emerald-400 text-xs font-semibold text-emerald-200 shadow-lg flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{actionToast}</span>
            </div>
          )}

          {selectedInfo && gameState === 'playing' && (
            <div className="pointer-events-auto self-start max-w-xs rounded-xl bg-slate-900/95 border border-emerald-500/60 p-3 shadow-xl space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedInfo.title}
                </span>
                <button
                  onClick={() => setSelectedInfo(null)}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">{selectedInfo.detail}</p>
              <span className="text-[10px] font-mono text-slate-400 block">{selectedInfo.coords}</span>
            </div>
          )}
        </div>

        {/* Bottom Contextual Task Trigger + Collapsible Control Dock */}
        <div className="flex flex-col items-center gap-2">
          {/* Contextual Interactive Action CTA */}
          {gameState === 'playing' && (
            <div className="pointer-events-auto flex items-center gap-2">
              {inMissionRange && activeMission ? (
                <button
                  onClick={() => executeFieldAction(getExpectedToolForMission(activeMission))}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xl border border-amber-300 flex items-center gap-2 transition-colors"
                >
                  <Wrench className="w-4 h-4" />
                  <span>
                    [E] {getActionVerbForMission(activeMission)} (+{activeMission.xpReward} XP)
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => executeFieldAction()}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-emerald-300 text-xs font-semibold shadow-lg border border-emerald-500/50 flex items-center gap-2"
                >
                  {activeTool === 'probe' && <Sprout className="w-3.5 h-3.5" />}
                  {activeTool === 'sluice' && <Waves className="w-3.5 h-3.5" />}
                  {activeTool === 'stake' && <Flag className="w-3.5 h-3.5" />}
                  <span>
                    [E]{' '}
                    {activeTool === 'probe'
                      ? 'Sample Soil & NDVI (+15 XP)'
                      : activeTool === 'sluice'
                      ? 'Operate Canal Sluice'
                      : `Drive Survey Peg (${telemetry.customStakesCount}/8)`}
                  </span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setDockCollapsed((c) => !c)}
            className="pointer-events-auto px-3 py-1 rounded-t-lg bg-slate-900/95 border border-b-0 border-slate-700 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto w-full max-w-5xl rounded-xl bg-slate-900/95 border border-slate-700 px-3 py-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
              {/* Interactive Field Tools Selector (1 / 2 / 3) */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveTool('probe')}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 ${
                    activeTool === 'probe'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Sprout className="w-3 h-3" />
                  <span>1 Probe</span>
                </button>
                <button
                  onClick={() => setActiveTool('sluice')}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 ${
                    activeTool === 'sluice'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Waves className="w-3 h-3" />
                  <span>2 Sluice</span>
                </button>
                <button
                  onClick={() => setActiveTool('stake')}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 ${
                    activeTool === 'stake'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Flag className="w-3 h-3" />
                  <span>3 Stake</span>
                </button>
              </div>

              {/* Camera Mode */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setCameraMode('walk')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    cameraMode === 'walk' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Drive (WASD)
                </button>
                <button
                  onClick={() => setCameraMode('orbit')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    cameraMode === 'orbit' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Free Orbit
                </button>
              </div>

              {/* Touch D-Pad for Mobile Walk Mode */}
              {cameraMode === 'walk' && gameState === 'playing' && (
                <div className="flex items-center gap-1">
                  {[
                    { code: 'ArrowLeft', label: '◀' },
                    { code: 'ArrowUp', label: '▲' },
                    { code: 'ArrowDown', label: '▼' },
                    { code: 'ArrowRight', label: '▶' },
                  ].map((btn) => (
                    <button
                      key={btn.code}
                      onPointerDown={() => setVirtualKey(btn.code, true)}
                      onPointerUp={() => setVirtualKey(btn.code, false)}
                      onPointerLeave={() => setVirtualKey(btn.code, false)}
                      className="w-7 h-7 rounded bg-slate-800 active:bg-emerald-600 text-xs text-white border border-slate-700"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Scenario Sandbox Toggle */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-amber-300 uppercase mr-0.5">
                  Sim:
                </span>
                <button
                  onClick={() => setScenario('normal')}
                  className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 border ${
                    scenario === 'normal'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span>Normal</span>
                </button>
                <button
                  onClick={() => setScenario('monsoon_flood')}
                  className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 border ${
                    scenario === 'monsoon_flood'
                      ? 'bg-sky-950 border-sky-500 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <CloudRain className="w-3 h-3" />
                  <span>Flood</span>
                </button>
                <button
                  onClick={() => setScenario('severe_drought')}
                  className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 border ${
                    scenario === 'severe_drought'
                      ? 'bg-amber-950 border-amber-500 text-amber-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Droplets className="w-3 h-3" />
                  <span>Drought</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-emerald-500/40 p-6 shadow-2xl space-y-4 text-center">
            <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>3D Field Ops & Interactive Simulation</span>
            </div>
            <h2 className="text-xl font-bold text-white">Step Into {preset.name}</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Drive your Rover across live terrain, open the <strong>Canal Sluice Gate</strong>, run the <strong>Soil & NDVI Probe</strong> on stressed plots, and anchor <strong>Geodesic Survey Stakes</strong> along the boundary ridge.
            </p>
            <div className="text-[11px] text-slate-400 font-mono py-2 border-y border-slate-800 space-y-1">
              <div>WASD / Click Terrain: Drive · Shift: Turbo</div>
              <div>1 / 2 / 3: Select Tool · E / Space: Execute Task</div>
            </div>
            <button
              onClick={() => setGameState('playing')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Enter 3D Field ({persona === 'farmer' ? 'किसान मोड' : 'Field Ops'})</span>
            </button>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-emerald-500/50 p-6 shadow-2xl text-center space-y-4">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">All Field Operations Completed!</h2>
            <p className="text-xs text-slate-300">
              You irrigated the canal, treated stressed crops, and secured the boundary ridge in <strong>{preset.name}</strong> for <span className="text-emerald-400 font-mono font-bold">{xp} XP</span>.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {GAME_MISSIONS.map((m) => (
                <span
                  key={m.id}
                  className="text-[11px] font-medium text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-700/50"
                >
                  {m.badgeName}
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleRestartMissions}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Ops</span>
              </button>
              <button
                onClick={() => setGameState('playing')}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
              >
                Free Explore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
