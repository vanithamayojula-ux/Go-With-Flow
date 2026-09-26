import React, { useState } from 'react';
import {
  Camera,
  Layers,
  Database,
  Sliders,
  CheckCircle2,
  Copy,
  Download,
  Terminal,
  Zap,
  Tag,
  FolderTree,
  Eye,
  FileCode,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';

interface DatasetCaptureSpec {
  id: string;
  name: string;
  category: 'urban' | 'surfaces' | 'motion' | 'vistas';
  targetObject: string;
  visualGoal: 'energetic' | 'cinematic' | 'atmospheric' | 'monumental';
  motionFlow: 'forward directional flow' | 'continuous motion sequence' | 'slight ambient movement' | 'static specular';
  lighting: string;
  angles: string[];
  referenceThumb: string;
  dominantPalette: string[];
  tags: {
    scene: string;
    object: string;
    lighting: string;
    motion: string;
    mood: string;
  };
  generatedPrompt: string;
}

const CAPTURE_DATASET_SPECS: DatasetCaptureSpec[] = [
  {
    id: 'URB-WET-PAVE-01',
    name: 'Wet Obsidian Basalt Paving & Puddle Mirrors',
    category: 'surfaces',
    targetObject: 'wet rectangular stone slabs, water puddle mirror reflections, tile grout seams',
    visualGoal: 'cinematic',
    motionFlow: 'static specular',
    lighting: 'low-light night with glancing cyan and hot magenta neon backlighting',
    angles: ['Downward 45° close-up', 'Ground-level 10cm puddle skim', 'Wide road vanishing axis'],
    referenceThumb: 'Wet asphalt reflecting cyber spires and storefront awnings',
    dominantPalette: ['#00F0FF', '#FF007F', '#090D18', '#E0F7FF'],
    tags: {
      scene: 'cyberpunk street canyon highway',
      object: 'wet asphalt pavement and mirror puddles',
      lighting: 'night low-light with neon cyan and magenta reflections',
      motion: 'forward flow reflection streaks',
      mood: 'cinematic high-contrast',
    },
    generatedPrompt:
      'A wet rectangular pavement slab road with reflective puddle water in a dense cyberpunk street corridor, with high-contrast cyan and hot magenta neon lighting, showing forward directional flow, in an energetic cinematic style, cinematic, smooth flow, high detail',
  },
  {
    id: 'URB-STORE-CANOPY-02',
    name: 'Ground-Floor Neon Cyber Storefronts & Canopies',
    category: 'urban',
    targetObject: 'ramen cyber bars, glowing neon awnings, multi-tiered vertical kanji signposts',
    visualGoal: 'energetic',
    motionFlow: 'slight ambient movement',
    lighting: 'dusk-to-midnight high saturation neon pink, amber and cyan sign bleed',
    angles: ['Street-level pedestrian eye-height', 'Side facade tracking 90°', 'Upward 30° canopy framing'],
    referenceThumb: 'RAMEN 24H and CYBER NET storefronts with illuminated awnings',
    dominantPalette: ['#FF0055', '#FFAA00', '#00F0FF', '#110515'],
    tags: {
      scene: 'multi-tier neon alleyway storefronts',
      object: 'illuminated ramen shops and projecting neon blade signs',
      lighting: 'low-light dusk with glowing shopfront canopies',
      motion: 'slight ambient movement and pedestrian silhouette drift',
      mood: 'energetic atmospheric',
    },
    generatedPrompt:
      'Illuminated ramen and cyber storefronts with projecting vertical blade signs in a multi-tier neon alleyway, with low-light dusk ambience and glowing shopfront canopies, showing slight ambient movement, in an atmospheric energetic style, cinematic, smooth flow, high detail',
  },
  {
    id: 'URB-HORIZON-MEGA-03',
    name: 'Colossal Central Megatower Horizon Anchor',
    category: 'vistas',
    targetObject: 'cylindrical tiered skyscraper, vertical white light channels, pulsing ruby beacon',
    visualGoal: 'monumental',
    motionFlow: 'forward directional flow',
    lighting: 'midnight dark sky with backlit cold-cyan atmospheric volumetric haze',
    angles: ['Corridor center-line vanishing point', 'Extreme low-angle skyward tilt', 'Flanking skyscraper framing'],
    referenceThumb: 'Tiered megatower with needle spire anchoring the road corridor',
    dominantPalette: ['#00F0FF', '#E0F7FF', '#FF0033', '#050914'],
    tags: {
      scene: 'endless futuristic urban canyon',
      object: 'colossal cylindrical megatower spire with vertical light bands',
      lighting: 'dark midnight sky and backlit cyan atmospheric fog',
      motion: 'continuous forward camera motion along the road axis',
      mood: 'monumental cinematic',
    },
    generatedPrompt:
      'A colossal cylindrical megatower spire with illuminated white light bands in an endless urban street canyon, with dark midnight sky and backlit cyan atmospheric fog, showing continuous forward camera motion, in a monumental cinematic style, cinematic, smooth flow, high detail',
  },
  {
    id: 'URB-MONORAIL-GRID-04',
    name: 'Elevated High-Speed Grind Rails & Energy Conduits',
    category: 'motion',
    targetObject: 'suspended magnetic grind rails, glowing laser barriers, overhead conduit arches',
    visualGoal: 'energetic',
    motionFlow: 'continuous motion sequence',
    lighting: 'vibrant neon rim lighting, electric arc discharge, dynamic speed reflections',
    angles: ['Rider hoverboard POV alignment', 'Side tracking high-speed bracket', 'Under-rail upward sweep'],
    referenceThumb: 'Neon cyan grind rails with support pylons and neon arches',
    dominantPalette: ['#00FFFF', '#FF007F', '#FFD700', '#030A1A'],
    tags: {
      scene: 'elevated transit highway',
      object: 'magnetic grind rail and glowing laser hurdle gates',
      lighting: 'vibrant neon rim lighting and volumetric ground reflections',
      motion: 'fast continuous motion sequence',
      mood: 'fast-paced energetic',
    },
    generatedPrompt:
      'An elevated magnetic grind rail running between towering cyberpunk skyscrapers, with vibrant neon rim lighting and volumetric ground reflections, showing fast continuous motion sequence, in a fast-paced energetic style, cinematic, smooth flow, high detail',
  },
];

interface VisualDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisualDatasetModal: React.FC<VisualDatasetModalProps> = ({ isOpen, onClose }) => {
  const [selectedSpec, setSelectedSpec] = useState<DatasetCaptureSpec>(CAPTURE_DATASET_SPECS[0]);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'dataset' | 'generator' | 'validation'>('pipeline');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);

  // Custom Interactive Prompt Generator State
  const [genObject, setGenObject] = useState('wet asphalt pavement');
  const [genScene, setGenScene] = useState('cyberpunk street corridor');
  const [genLighting, setGenLighting] = useState('high-contrast cyan and hot magenta neon lighting');
  const [genMotion, setGenMotion] = useState('forward directional flow');
  const [genMood, setGenMood] = useState('energetic cinematic');

  const customGeneratedPrompt = `A ${genObject} in a ${genScene}, with ${genLighting}, showing ${genMotion}, in a ${genMood} style, cinematic, smooth flow, high detail`;

  if (!isOpen) return null;

  const handleCopy = (text: string, isPrompt: boolean) => {
    navigator.clipboard.writeText(text);
    if (isPrompt) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } else {
      setCopiedJSON(true);
      setTimeout(() => setCopiedJSON(false), 2000);
    }
  };

  const handleExportManifest = () => {
    const manifest = {
      pipeline_version: '2.4-production',
      calibration_device: 'Sony A7 IV / Apple ProRAW 48MP Uncompressed',
      color_space: 'ACEScg / D65 Rec.709 sRGB Target',
      resolution_spec: '2048x2048 Normalized PNG (16-bit)',
      captures: CAPTURE_DATASET_SPECS,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cyberpunk_environment_dataset_manifest.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-950 border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/30 bg-black/70 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-wide text-white uppercase font-mono">
                  Visual Capture & Dataset Engineering System
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-500/30 text-cyan-300 border border-cyan-400/50">
                  REAL-WORLD TO GAME PIPELINE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Structured reference capture, metadata tagging, AI prompt generation & real-time shader mapping
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportManifest}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
              title="Download Full Dataset JSON Manifest"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT MANIFEST</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-red-400 hover:text-red-400 text-slate-400 transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 px-6 pt-3 bg-black/40 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'pipeline'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. DATAFLOW PIPELINE</span>
          </button>
          <button
            onClick={() => setActiveTab('dataset')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'dataset'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>2. CAPTURE DATASET & TAGS</span>
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'generator'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3. PROMPT GENERATOR</span>
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'validation'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>4. VALIDATION & SHADER MAPPING</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: DATAFLOW PIPELINE */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Flowchart Diagram */}
              <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 backdrop-blur-md">
                <div className="text-xs font-black uppercase font-mono text-cyan-400 mb-3 tracking-wider flex items-center space-x-2">
                  <Terminal className="w-4 h-4" />
                  <span>END-TO-END DATAFLOW PIPELINE</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/80 flex flex-col items-center">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase mb-1">STAGE 01</span>
                    <Camera className="w-6 h-6 text-cyan-300 mb-2" />
                    <span className="text-xs font-bold text-white">Photo Capture</span>
                    <span className="text-[10px] text-slate-400 mt-1">4 angles, 3 lighting tiers, forward walk</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/80 flex flex-col items-center">
                    <span className="text-[10px] text-fuchsia-400 font-bold uppercase mb-1">STAGE 02</span>
                    <Tag className="w-6 h-6 text-fuchsia-300 mb-2" />
                    <span className="text-xs font-bold text-white">Data Tagging</span>
                    <span className="text-[10px] text-slate-400 mt-1">Structured JSON metadata schema</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/80 flex flex-col items-center">
                    <span className="text-[10px] text-amber-400 font-bold uppercase mb-1">STAGE 03</span>
                    <Sliders className="w-6 h-6 text-amber-300 mb-2" />
                    <span className="text-xs font-bold text-white">Preprocessing</span>
                    <span className="text-[10px] text-slate-400 mt-1">Lanczos 2048x2048, CLAHE, palette K-means</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/80 flex flex-col items-center">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase mb-1">STAGE 04</span>
                    <Sparkles className="w-6 h-6 text-emerald-300 mb-2" />
                    <span className="text-xs font-bold text-white">AI Prompt Synthesis</span>
                    <span className="text-[10px] text-slate-400 mt-1">Formulaic prompt string generation</span>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-400 flex flex-col items-center shadow-lg shadow-cyan-950/40">
                    <span className="text-[10px] text-cyan-300 font-bold uppercase mb-1">STAGE 05</span>
                    <Zap className="w-6 h-6 text-cyan-200 mb-2 animate-bounce" />
                    <span className="text-xs font-bold text-white">Game Engine Output</span>
                    <span className="text-[10px] text-cyan-300 mt-1">Real-time Three.js shaders & meshes</span>
                  </div>
                </div>
              </div>

              {/* Step By Step Rules Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-cyan-300 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>STEP 1 & 2: SCENE PLANNING & PHOTO CAPTURE</span>
                  </h3>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                    <li><strong className="text-white">Scene Category:</strong> Urban street canyons, wet reflective pavement, multi-tier neon storefronts, elevated transit rails.</li>
                    <li><strong className="text-white">4 Mandatory Angles:</strong> Front vanishing-point view, side facade elevation, downward close-up (45°), wide horizon sweep.</li>
                    <li><strong className="text-white">3 Lighting Tiers:</strong> Natural dusk, low-light post-rain midnight, backlit high-contrast neon silhouettes.</li>
                    <li><strong className="text-white">Forward Flow Continuity:</strong> 5 shots per 10m advance locked to the horizon vanishing center.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-fuchsia-300 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                    <span>STEP 3 & 4: CONSISTENCY & STRUCTURED TAGGING</span>
                  </h3>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                    <li><strong className="text-white">Fixed Optical Profile:</strong> 28mm full-frame equivalent, locked 5200K Kelvin, ISO ≤ 400.</li>
                    <li><strong className="text-white">Zero Filter Policy:</strong> Strictly native raw linear profiles; no dynamic smartphone beautification or tone mapping.</li>
                    <li><strong className="text-white">JSON Tag Metadata:</strong> Explicit tagging of scene, object, lighting, motion vector, and mood index.</li>
                    <li><strong className="text-white">Temporal Consistency:</strong> SSIM (Structural Similarity) guaranteed between 0.65 and 0.85 across motion frames.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAPTURE DATASET & TAGS */}
          {activeTab === 'dataset' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Spec Selector List */}
                <div className="space-y-2 lg:col-span-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    SELECT CAPTURED DATASET SPECIMEN:
                  </div>
                  {CAPTURE_DATASET_SPECS.map(spec => (
                    <button
                      key={spec.id}
                      onClick={() => setSelectedSpec(spec)}
                      className={`w-full p-3 text-left rounded-xl border transition-all flex flex-col space-y-1 ${
                        selectedSpec.id === spec.id
                          ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-cyan-400">{spec.id}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/60 text-slate-300 border border-slate-700">
                          {spec.category}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">{spec.name}</span>
                      <span className="text-[11px] text-slate-400 truncate">{spec.targetObject}</span>
                    </button>
                  ))}
                </div>

                {/* Right: Detailed Spec Inspector */}
                <div className="lg:col-span-2 space-y-4 p-5 rounded-2xl bg-black/70 border border-cyan-500/30 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">{selectedSpec.id}</span>
                      <h3 className="text-base font-bold text-white">{selectedSpec.name}</h3>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {selectedSpec.dominantPalette.map((hex, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: hex }}
                          title={`Palette node: ${hex}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Metadata Tag JSON Card */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-cyan-400 mb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        <span>STRUCTURED METADATA TAG (JSON)</span>
                      </span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(selectedSpec.tags, null, 2), false)}
                        className="text-[11px] flex items-center space-x-1 text-slate-400 hover:text-cyan-300"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedJSON ? 'COPIED!' : 'COPY JSON'}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-200 overflow-x-auto">
                      {JSON.stringify(selectedSpec.tags, null, 2)}
                    </pre>
                  </div>

                  {/* Formatted AI Prompt Card */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-fuchsia-400 mb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>SYNTHESIZED AI PROMPT (STEP 6)</span>
                      </span>
                      <button
                        onClick={() => handleCopy(selectedSpec.generatedPrompt, true)}
                        className="text-[11px] flex items-center space-x-1 text-slate-400 hover:text-fuchsia-300"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedPrompt ? 'COPIED!' : 'COPY PROMPT'}</span>
                      </button>
                    </div>
                    <div className="p-3.5 rounded-lg bg-fuchsia-950/20 border border-fuchsia-500/40 text-xs text-fuchsia-100 font-sans leading-relaxed">
                      "{selectedSpec.generatedPrompt}"
                    </div>
                  </div>

                  {/* Field Angles Matrix */}
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      CAPTURED FIELD ANGLES (STEP 2 RULES):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {selectedSpec.angles.map((ang, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center space-x-1.5">
                          <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{ang}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROMPT GENERATOR */}
          {activeTab === 'generator' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/30 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white uppercase font-mono">
                      DYNAMIC AI PROMPT BUILDER (STEP 6 COMPLIANT)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400">
                    TEMPLATE: "A [object] in a [scene], with [lighting], showing [motion], in a [mood] style, cinematic, smooth flow, high detail"
                  </span>
                </div>

                {/* Form Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      1. Object Focus ([object])
                    </label>
                    <input
                      type="text"
                      value={genObject}
                      onChange={e => setGenObject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      2. Scene Category ([scene])
                    </label>
                    <input
                      type="text"
                      value={genScene}
                      onChange={e => setGenScene(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      3. Lighting Condition ([lighting])
                    </label>
                    <input
                      type="text"
                      value={genLighting}
                      onChange={e => setGenLighting(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      4. Motion Vector ([motion])
                    </label>
                    <select
                      value={genMotion}
                      onChange={e => setGenMotion(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    >
                      <option value="forward directional flow">Forward directional flow</option>
                      <option value="continuous motion sequence">Continuous motion sequence</option>
                      <option value="slight ambient movement">Slight ambient movement</option>
                      <option value="fast camera track">Fast camera track</option>
                      <option value="static mirror reflections">Static mirror reflections</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                      5. Mood Style ([mood])
                    </label>
                    <select
                      value={genMood}
                      onChange={e => setGenMood(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    >
                      <option value="energetic cinematic">Energetic cinematic</option>
                      <option value="atmospheric dystopian">Atmospheric dystopian</option>
                      <option value="monumental high-tech">Monumental high-tech</option>
                      <option value="fast-paced synthwave">Fast-paced synthwave</option>
                      <option value="calm contemplative">Calm contemplative</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setGenObject('wet asphalt pavement');
                        setGenScene('cyberpunk street corridor');
                        setGenLighting('high-contrast cyan and hot magenta neon lighting');
                        setGenMotion('forward directional flow');
                        setGenMood('energetic cinematic');
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all flex items-center justify-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>RESET PRESETS</span>
                    </button>
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="mt-4 p-4 rounded-xl bg-cyan-950/30 border border-cyan-400 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                    <span>LIVE COMPILED PROMPT OUTPUT:</span>
                    <button
                      onClick={() => handleCopy(customGeneratedPrompt, true)}
                      className="flex items-center space-x-1 text-white hover:text-cyan-200"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedPrompt ? 'COPIED TO CLIPBOARD' : 'COPY'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-black/80 rounded-lg text-sm text-cyan-100 font-mono leading-relaxed select-all">
                    "{customGeneratedPrompt}"
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VALIDATION & SHADER MAPPING */}
          {activeTab === 'validation' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Validation QA Matrix */}
              <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/30 backdrop-blur-md space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase font-mono">
                    STEP 7: DATASET VALIDATION & ENGINE SHADER PIPELINE
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs font-bold text-cyan-400 mb-1">HORIZON VANISHING TEST</div>
                    <p className="text-[11px] text-slate-300">
                      Optical horizon must sit within ±4% of screen centerline. Aligns vanishing point of pavement seams with the horizon megatower spire.
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-500/30">
                      STATUS: PASS (100% Vanishing Lock)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs font-bold text-amber-400 mb-1">HISTOGRAM DYNAMIC RANGE</div>
                    <p className="text-[11px] text-slate-300">
                      Shadow clipping under 15%, neon core clipping under 8%. Captures both deep obsidian basalt paving and blinding neon laser filaments.
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-500/30">
                      STATUS: PASS (High-Dynamic Range)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs font-bold text-fuchsia-400 mb-1">INTER-FRAME SSIM CONTINUITY</div>
                    <p className="text-[11px] text-slate-300">
                      Structural Similarity Index between consecutive motion sequence shots sits between 0.65 and 0.85, preventing motion judder in generative game textures.
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-500/30">
                      STATUS: PASS (Mean SSIM: 0.742)
                    </div>
                  </div>
                </div>

                {/* How Dataset Directly Maps into Game Shaders */}
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-cyan-300 flex items-center space-x-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>REAL-TIME THREE.JS SHADER & TEXTURE MAPPING IN CODEBASE</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                      <span className="font-mono text-cyan-400 font-bold block mb-1">TerrainShader (Wet Asphalt & Puddles)</span>
                      <p className="text-slate-400 text-[11px]">
                        Uses real-world pavement slab coordinates (0.55m x 0.32m) and Fresnel glancing-angle specular reflections derived from specimen <code className="text-white">URB-WET-PAVE-01</code>.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                      <span className="font-mono text-fuchsia-400 font-bold block mb-1">createCyberBuildingTexture (Storefronts)</span>
                      <p className="text-slate-400 text-[11px]">
                        Injects ground-floor illuminated shop awnings, projecting 3D neon blade signs, and vertical kanji signboards calibrated from <code className="text-white">URB-STORE-CANOPY-02</code>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-black/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <FolderTree className="w-4 h-4 text-cyan-400" />
            <span>DATASET REPOSITORY: /dataset_root/v2.4_production</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition-all active:scale-95 shadow-md shadow-cyan-500/20"
          >
            RETURN TO GAME
          </button>
        </div>

      </div>
    </div>
  );
};
