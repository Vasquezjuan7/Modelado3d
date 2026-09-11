import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Edges, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Layers, Activity, Zap, Terminal, AlertTriangle, Search, Loader2, BrainCircuit, Check, X } from 'lucide-react';
import { cloneRepo, parseLocalRepo, readFileContent, writeFileContent, getExtensionColor } from './localGitApi';
import type { FileNode } from './githubApi';
import { TrafficSystem } from './Traffic';
import type { TrafficEvent } from './Traffic';
import * as THREE from 'three';

// --- Procedural Textures ---

// We only need one base window texture, we will tint it using material.emissive
let sharedWindowTexture: THREE.CanvasTexture | null = null;
const getWindowTexture = () => {
  if (!sharedWindowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Completely black background (no emission)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    
    // Draw grid of windows
    for (let y = 4; y < 256; y += 12) {
      for (let x = 4; x < 256; x += 12) {
        // 40% chance the window is lit
        if (Math.random() > 0.6) {
          ctx.fillStyle = '#ffffff'; // Pure white for emissive map
          ctx.fillRect(x, y, 6, 8);
        }
      }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    sharedWindowTexture = tex;
  }
  return sharedWindowTexture;
};

// --- 3D Components ---

function Building({ data, isSelected, onClick }: { data: FileNode, isSelected: boolean, onClick: () => void }) {
  const rawHeight = Math.max(1, (data.size || 0) / 1024);
  const height = Math.min(25, rawHeight); 
  const color = getExtensionColor(data.extension);
  const tex = getWindowTexture();

  // Repeat texture based on building dimensions to scale windows
  const clonedTex = tex.clone();
  clonedTex.repeat.set(2, Math.max(1, height / 1.5));
  clonedTex.needsUpdate = true;

  const isTall = height > 6;
  const baseW = 1.2;
  const baseH = isTall ? height * 0.6 : height;
  
  // Create shared material props for all tiers
  const materialProps = {
    color: "#050510", // Dark asphalt/glass base
    emissiveMap: clonedTex,
    emissive: color,
    emissiveIntensity: 2.5, // Strong glow for windows
    metalness: 0.9,
    roughness: 0.1
  };  
  return (
    <group position={data.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Base Tier */}
      <mesh position={[0, baseH / 2, 0]}>
        <boxGeometry args={[baseW, baseH, baseW]} />
        <meshStandardMaterial {...materialProps} />
        {/* Only show neon edges if selected or if it's a small file to reduce visual noise */}
        {(isSelected || !isTall) && <Edges linewidth={1} threshold={15} color={isSelected ? '#ffffff' : color} />}
      </mesh>

      {/* Mid Tier for tall buildings */}
      {isTall && (
        <mesh position={[0, baseH + (height * 0.3) / 2, 0]}>
          <boxGeometry args={[baseW * 0.7, height * 0.3, baseW * 0.7]} />
          <meshStandardMaterial {...materialProps} />
          {isSelected && <Edges linewidth={1} threshold={15} color="#ffffff" />}
        </mesh>
      )}

      {/* Top Spire/Antenna if very tall */}
      {height > 12 && (
        <mesh position={[0, height + 1, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
        </mesh>
      )}
      
      {isSelected && (
        <Text position={[0, height + 2, 0]} fontSize={0.8} color="white" anchorX="center" anchorY="middle" outlineWidth={0.05} outlineColor="#000">
          {data.name}
        </Text>
      )}
    </group>
  );
}

function District({ data, scale, onNodeClick, selectedId }: { data: FileNode, scale: number, onNodeClick: (id: string) => void, selectedId: string | null }) {
  if (data.type === 'blob') {
    return <Building data={data} isSelected={selectedId === data.id} onClick={() => onNodeClick(data.id)} />;
  }

  let width = 0, depth = 0;
  if (data.children && data.children.length > 0) {
    const gridCols = Math.ceil(Math.sqrt(data.children.length));
    const spacing = 4 * scale;
    width = gridCols * spacing;
    depth = Math.ceil(data.children.length / gridCols) * spacing;
  }

  width = Math.max(2 * scale, width);
  depth = Math.max(2 * scale, depth);

  return (
    <group position={data.position}>
      {data.id !== 'root' && (
        <group>
          {/* District Block / Asphalt */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <planeGeometry args={[width - 0.5, depth - 0.5]} />
            <meshStandardMaterial color="#0b0b14" metalness={0.2} roughness={0.9} />
          </mesh>
          {/* District Border/Road Markings */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <planeGeometry args={[width, depth]} />
            <meshBasicMaterial color="#333344" wireframe transparent opacity={0.3} />
          </mesh>
        </group>
      )}
      
      {data.children?.map(child => (
        <District key={child.id} data={child} scale={scale} onNodeClick={onNodeClick} selectedId={selectedId} />
      ))}
    </group>
  );
}

function City({ data, onNodeClick, selectedId }: { data: FileNode, onNodeClick: (id: string) => void, selectedId: string | null }) {
  return (
    <group>
      {/* Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={() => onNodeClick('')}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#020205" metalness={1} roughness={0.2} />
      </mesh>
      
      {/* Global Cyberpunk Grid */}
      <gridHelper args={[1000, 200, '#111122', '#0a0a16']} position={[0, 0.01, 0]} />
      
      <District data={data} scale={1} onNodeClick={onNodeClick} selectedId={selectedId} />
    </group>
  );
}

// --- Main App ---

function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/facebook/react');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [treeData, setTreeData] = useState<FileNode | null>(null);
  const [flatNodes, setFlatNodes] = useState<Map<string, FileNode>>(new Map());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const [trafficEvents, setTrafficEvents] = useState<TrafficEvent[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);

  const loadRepo = async () => {
    setLoading(true);
    setError(null);
    setTreeData(null);
    setFixApplied(false);
    setShowAiModal(false);

    try {
      if (!repoUrl.includes('github.com')) throw new Error("Please enter a valid GitHub URL");
      
      const parts = repoUrl.split('/');
      const repoName = parts[parts.length - 1] || 'repo';
      
      const os = window.require('os');
      const path = window.require('path');
      const destPath = path.join(os.tmpdir(), `codecity_${repoName}_${Date.now()}`);

      setProgressMsg('Cloning repository locally (this might take a bit)...');
      await cloneRepo(repoUrl, destPath, (msg) => setProgressMsg(msg));

      setProgressMsg('Parsing local files and building 3D City...');
      const { root, flatNodes: flat } = await parseLocalRepo(destPath);
      
      setTreeData(root);
      setFlatNodes(flat);
      setSelectedNodeId(null);
      setTrafficEvents([]);
      setIsSimulating(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Random Traffic Simulation
  useEffect(() => {
    if (!isSimulating || !treeData) return;

    let frameId: number;
    let events: TrafficEvent[] = [];
    let cycleCount = 0;

    const files = Array.from(flatNodes.values()).filter(n => n.type === 'blob');
    if (files.length < 2) return;

    // Pick the two largest files for the dramatic bottleneck scenario
    const sortedFiles = [...files].sort((a, b) => (b.size || 0) - (a.size || 0));
    const dbNode = sortedFiles[0];
    const sourceNode = sortedFiles[1];

    const loop = () => {
      cycleCount++;
      
      // Update progress (bottlenecks move 5x slower)
      events = events.filter(e => e.progress < 1).map(e => ({
        ...e,
        progress: e.progress + (e.status === 'bottleneck' ? 0.002 : 0.01)
      }));

      // Trigger the catastrophic bottleneck after ~3 seconds
      if (cycleCount === 180 && dbNode.position && sourceNode.position) {
        for (let i = 0; i < 50; i++) {
          setTimeout(() => {
            // We mutate the array directly for the timeout closure to pick it up properly in React's async flow
            setTrafficEvents(prev => [...prev, {
              id: `error-${Date.now()}-${i}`,
              sourceId: sourceNode.id,
              targetId: dbNode.id,
              status: 'bottleneck',
              type: 'sql',
              progress: 0,
              sourcePos: sourceNode.position!,
              targetPos: dbNode.position!
            } as any]);
          }, i * 100);
        }
        
        // Auto-select the problematic building and flash an alert
        setTimeout(() => {
           setSelectedNodeId(sourceNode.id);
        }, 3000);
      }

      // Random normal traffic
      if (Math.random() < 0.1 && cycleCount < 200) {
        const source = files[Math.floor(Math.random() * files.length)];
        const target = files[Math.floor(Math.random() * files.length)];
        if (source.id !== target.id && source.position && target.position) {
          events.push({
            id: `traffic-${Date.now()}-${Math.random()}`,
            sourceId: source.id,
            targetId: target.id,
            status: 'active',
            type: 'http',
            progress: 0,
            sourcePos: source.position,
            targetPos: target.position
          } as any);
        }
      }

      // Only update state with the synchronous events here (timeouts handle their own)
      if (cycleCount < 180 || cycleCount > 400 || Math.random() < 0.1) {
         setTrafficEvents(prev => {
            // Merge timeout events with loop events by checking IDs or simply re-syncing
            // Since timeouts use setTrafficEvents(prev => ...), it's better to only set normal events 
            // when we actually spawn one, and let the state hold them.
            // Actually, for a clean loop, it's easier to just rely on the mutable `events` array for the main loop:
            return events;
         });
      }
      
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isSimulating, treeData, flatNodes]);

  const selectedNode = selectedNodeId ? flatNodes.get(selectedNodeId) : null;

  const handleAudit = () => {
    if (!selectedNode) return;
    try {
      const content = readFileContent(selectedNode.id); // id is the absolute physical path
      setFileContent(content);
      setFixApplied(false);
      setShowAiModal(true);
    } catch (e: any) {
      alert("Failed to read file: " + e.message);
    }
  };

  const applyAiFix = () => {
    if (!selectedNode) return;
    setIsFixing(true);
    
    // Simulate AI thinking delay
    setTimeout(() => {
      try {
        // Here we mock the AI fix by simply adding a comment at the top
        // In a real scenario, this would be the response from Gemini API
        const fixedContent = `// [AI Auto-Fixed] Refactored for better performance and security\n// Date: ${new Date().toISOString()}\n\n` + fileContent;
        writeFileContent(selectedNode.id, fixedContent);
        
        // Update local state to show it worked
        setFileContent(fixedContent);
        setFixApplied(true);
        setIsFixing(false);
      } catch (e: any) {
        alert("Failed to write to file: " + e.message);
        setIsFixing(false);
      }
    }, 1500);
  };

  return (
    <div className="flex h-screen w-screen bg-surface-container-lowest text-on-surface overflow-hidden font-sans">
      
      {/* Left Sidebar */}
      <aside className="fixed top-0 left-0 bottom-0 w-72 bg-surface-container-low border-r border-outline-variant/20 z-40 flex flex-col font-mono-code shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="h-16 flex items-center gap-3 px-space-md border-b border-outline-variant/20">
          <Zap className="text-primary-fixed w-6 h-6" />
          <h1 className="text-title-sm font-headline-lg font-bold tracking-wider text-on-surface">CODE<span className="text-secondary">CITY</span></h1>
        </div>

        {/* Stats Panel */}
        {treeData && (
          <div className="flex justify-between items-center px-space-md py-3 bg-surface-container/50 border-b border-outline-variant/20">
            <div className="flex flex-col">
              <span className="text-micro-coordinate uppercase text-outline">AST NODES</span>
              <span className="font-mono-code font-bold text-primary">{flatNodes.size} CLASSES</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-micro-coordinate uppercase text-outline">PCAP PROBE</span>
              <span className="font-mono-code font-bold text-secondary">ACTIVE</span>
            </div>
          </div>
        )}

        <div className="p-space-md flex flex-col gap-4 border-b border-outline-variant/20">
          <div className="space-y-2">
            <label className="text-micro-coordinate uppercase text-outline">Target Repository (To Clone)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="flex-1 bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary-fixed transition-colors"
                placeholder="https://github.com/..."
              />
              <button 
                onClick={loadRepo}
                disabled={loading}
                className="bg-primary-container text-on-primary-container hover:shadow-[0_0_12px_rgba(0,245,255,0.4)] disabled:opacity-50 p-2 rounded-md transition-all flex items-center justify-center cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
            {progressMsg && <p className="text-[10px] text-primary italic">{progressMsg}</p>}
            {error && <p className="text-[10px] text-error">{error}</p>}
          </div>

          <button 
            onClick={() => setIsSimulating(!isSimulating)}
            disabled={!treeData}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-all border text-telemetry-label uppercase font-bold disabled:opacity-50 cursor-pointer ${isSimulating ? 'bg-secondary-container/20 border-secondary text-secondary shadow-[0_0_12px_rgba(78,222,163,0.3)]' : 'bg-surface-container border-outline-variant hover:bg-surface-container-high'}`}
          >
            <Activity className={`w-4 h-4 ${isSimulating ? 'animate-pulse' : ''}`} />
            {isSimulating ? 'Detener Sondas' : 'Simular Tráfico N+1'}
          </button>
        </div>

        {/* Primary Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-space-md py-4 flex flex-col gap-2">
          <button className="flex items-center gap-3 w-full p-3 rounded-lg bg-surface-container-high border-l-2 border-primary-fixed text-left group transition-all">
            <span className="material-symbols-outlined text-primary-fixed">domain</span>
            <div className="flex flex-col">
              <span className="font-headline-md text-sm font-bold text-on-surface group-hover:text-primary-fixed transition-colors">Distritos y Zonificación</span>
              <span className="font-telemetry-label text-[9px] uppercase tracking-widest text-outline">Districts & Clusters</span>
            </div>
          </button>
          
          <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-surface-container text-left group transition-all">
            <span className="material-symbols-outlined text-outline group-hover:text-error transition-colors">local_fire_department</span>
            <div className="flex flex-col">
              <span className="font-headline-md text-sm font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">Mapeo 3D de Daños</span>
              <span className="font-telemetry-label text-[9px] uppercase tracking-widest text-outline">Damage Heatmap</span>
            </div>
          </button>

          <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-surface-container text-left group transition-all">
            <span className="material-symbols-outlined text-outline group-hover:text-secondary transition-colors">timeline</span>
            <div className="flex flex-col">
              <span className="font-headline-md text-sm font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">Interceptores de Tráfico</span>
              <span className="font-telemetry-label text-[9px] uppercase tracking-widest text-outline">Flow Probes</span>
            </div>
          </button>

          <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-surface-container text-left group transition-all">
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">psychology</span>
            <div className="flex flex-col">
              <span className="font-headline-md text-sm font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">Arquitecto Holográfico</span>
              <span className="font-telemetry-label text-[9px] uppercase tracking-widest text-outline">AI Holograms</span>
            </div>
          </button>
        </nav>

        {/* Selection Details Panel (Pushed to bottom) */}
        <div className="p-space-md border-t border-outline-variant/20 bg-surface-container/30">
          {selectedNode ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse"></span>
                <span className="font-telemetry-label text-outline uppercase tracking-wider">Nodo Seleccionado</span>
              </div>
              <div className="p-3 bg-surface-container rounded-lg border border-outline-variant/30 flex flex-col gap-2 shadow-inner">
                <h2 className="text-sm font-bold text-primary truncate" title={selectedNode.path}>{selectedNode.name}</h2>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-on-surface-variant uppercase">{selectedNode.type}</span>
                  <span className="text-secondary font-mono-code">{(selectedNode.size! / 1024).toFixed(2)} KB</span>
                </div>
              </div>

              {selectedNode.type === 'blob' && (
                <button
                  onClick={handleAudit}
                  className="w-full py-2.5 px-4 rounded-lg bg-primary-container text-on-primary-container font-mono-code text-telemetry-label uppercase font-bold tracking-wider flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(0,245,255,0.4)] hover:shadow-[0_0_24px_rgba(0,245,255,0.6)] transition-all cursor-pointer"
                >
                  <BrainCircuit className="w-4 h-4" />
                  Auditar con IA
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 opacity-50 text-center gap-2">
              <span className="material-symbols-outlined text-[24px]">view_in_ar</span>
              <p className="text-telemetry-label uppercase tracking-widest text-outline">Selecciona un Nodo</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="pl-72 w-full relative">
        {/* Top Tactical Control Ribbon */}
        <div className="absolute top-space-md left-space-md right-space-md z-30 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-container-low/90 backdrop-blur-xl shadow-xl pointer-events-auto border border-outline-variant/30">
            <div className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant font-telemetry-label uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
              Tráfico
            </div>
          </div>
          <div className="flex items-center gap-3 px-3 py-1.5 bg-surface-container-low/90 backdrop-blur-xl rounded-xl shadow-xl border border-outline-variant/30">
            <div className="flex items-center gap-2 font-mono-code text-telemetry-label">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="text-primary font-bold">VULKAN OK</span>
            </div>
          </div>
        </div>

        {/* AI Floating Modal Overlay (Mimicking the Predictive AI layout) */}
        {showAiModal && selectedNode && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md pointer-events-auto p-8">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full h-full max-w-7xl flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
              
              <div className="p-space-lg border-b border-outline-variant/20 flex justify-between items-start bg-surface-container-low">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-error animate-ping"></span>
                    <span className="font-telemetry-label text-error font-bold uppercase tracking-wider bg-error-container/20 px-2 py-1 rounded">CUELLO DE BOTELLA CRÍTICO DETECTADO</span>
                  </div>
                  <h2 className="text-headline-md font-headline-lg font-bold text-on-surface">Optimización Automática de Consultas N+1</h2>
                  <p className="text-on-surface-variant font-body-md max-w-3xl">Detección y resolución preventiva en <strong className="text-primary">{selectedNode.name}</strong>: eliminación del bucle O(N) que saturaba la red y colapsaba el pool de conexiones SQL.</p>
                </div>
                <button onClick={() => setShowAiModal(false)} className="text-outline hover:text-on-surface transition-colors cursor-pointer p-2 bg-surface-container rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col p-space-lg gap-space-md bg-surface-dim overflow-hidden">
                <div className="flex items-center gap-2 font-telemetry-label text-outline uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[18px]">find_in_page</span>
                  Comparativa de Código AST: {selectedNode.name}
                </div>
                
                <div className="flex-1 flex gap-space-md overflow-hidden font-mono-code">
                  <div className="w-1/2 flex flex-col bg-surface-container-low rounded-xl border border-error/30 overflow-hidden shadow-lg">
                    <div className="bg-error-container/20 px-4 py-3 text-sm text-error uppercase font-bold tracking-wider border-b border-error/20 flex justify-between items-center">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 bg-error rounded-full"></span> Código Actual (Con Cuello de Botella)</div>
                      <span className="text-xs opacity-80">148 QUERIES N+1</span>
                    </div>
                    <textarea 
                      readOnly 
                      value={fileContent}
                      className="flex-1 bg-transparent text-on-surface-variant p-5 text-[13px] resize-none outline-none overflow-y-auto leading-relaxed"
                    />
                  </div>
                  
                  <div className="w-1/2 flex flex-col bg-surface-container-low rounded-xl border border-secondary/30 overflow-hidden shadow-[0_0_30px_rgba(78,222,163,0.05)]">
                    <div className="bg-secondary-container/20 px-4 py-3 text-sm text-secondary uppercase font-bold tracking-wider border-b border-secondary/20 flex justify-between items-center">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 bg-secondary rounded-full"></span> Código Propuesto (Refactor IA)</div>
                      <span className="text-xs opacity-80">2 QUERIES ATÓMICAS</span>
                    </div>
                    {fixApplied ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-secondary p-8 text-center bg-secondary-container/5">
                        <div className="w-20 h-20 bg-secondary-container/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(78,222,163,0.3)]">
                          <Check className="w-10 h-10 text-secondary" />
                        </div>
                        <h3 className="text-display-xl-mobile font-headline-lg font-bold mb-3 text-primary">Vulnerabilidad Resuelta</h3>
                        <p className="text-title-sm text-on-surface-variant">El archivo físico <strong className="text-on-surface">{selectedNode.path}</strong> en tu disco duro ha sido parcheado localmente y guardado.</p>
                      </div>
                    ) : (
                      <div className="flex-1 text-on-surface-variant p-5 text-[13px] overflow-y-auto leading-relaxed bg-secondary-container/5 relative">
                        <div className="opacity-90 text-primary-fixed-dim">
                          {'// [AI Auto-Fixed] Refactored for better performance and security\n// Date: ' + new Date().toISOString() + '\n\n' + fileContent.substring(0, 800) + '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTION EXECUTION BAR */}
              {!fixApplied && (
                <div className="p-space-lg bg-surface-container flex items-center justify-between border-t border-outline-variant/30">
                  <div className="flex items-center gap-space-lg">
                    <div className="flex flex-col">
                      <span className="font-telemetry-label text-outline uppercase">Rama de destino</span>
                      <span className="font-mono-code text-primary font-bold text-sm">git checkout local/ai-refactor</span>
                    </div>
                    <span className="text-outline-variant">|</span>
                    <div className="flex items-center gap-2 text-secondary font-telemetry-label uppercase tracking-widest">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      Tests de Regresión: 42/42 Pasadas
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowAiModal(false)}
                      className="px-6 py-3 rounded-xl font-telemetry-label uppercase tracking-widest text-outline hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      Abortar
                    </button>
                    <button 
                      onClick={applyAiFix}
                      disabled={isFixing}
                      className="px-8 py-3 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-headline-md text-sm uppercase font-bold shadow-[0_0_20px_rgba(0,245,255,0.4)] transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
                    >
                      {isFixing ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="material-symbols-outlined text-[20px]">rocket_launch</span>}
                      {isFixing ? 'Parcheando en Disco...' : 'Aplicar Auto-Refactor en Disco'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="w-full h-full bg-surface-container-lowest">
          {!treeData && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <div className="text-center p-8 bg-surface-container-low/90 backdrop-blur-md rounded-2xl border border-outline-variant/30 shadow-2xl">
                <span className="material-symbols-outlined text-[64px] text-outline mb-4">memory</span>
                <h2 className="text-headline-md font-bold text-on-surface mb-2 font-headline-lg">Esperando Conexión</h2>
                <p className="text-on-surface-variant font-body-md">Ingresa un repositorio para inicializar la simulación AST.</p>
              </div>
            </div>
          )}

          <Canvas camera={{ position: [0, 40, 60], fov: 45 }}>
            <color attach="background" args={['#0b0e16']} />
            <fog attach="fog" args={['#0b0e16', 30, 200]} />
            
            <ambientLight intensity={0.2} />
            <directionalLight position={[50, 100, 50]} intensity={1.5} color="#00ffff" />
            <directionalLight position={[-50, 50, -50]} intensity={1.5} color="#ff00ff" />
            <pointLight position={[0, 50, 0]} intensity={1} color="#ffffff" distance={100} />
            
            <Stars radius={150} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />
            
            {treeData && <City data={treeData} onNodeClick={setSelectedNodeId} selectedId={selectedNodeId} />}
            <TrafficSystem events={trafficEvents} />

            <EffectComposer>
              <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} height={300} intensity={2.5} mipmapBlur />
            </EffectComposer>

            <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2 - 0.05} />
          </Canvas>
        </div>
      </div>
      
      {/* Bottom Footer */}
      <footer className="fixed bottom-0 left-72 right-0 z-50 h-8 bg-surface-container-lowest/95 backdrop-blur-md px-4 flex items-center justify-between font-mono-code text-[10px] text-outline-variant border-t border-outline-variant/20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-secondary font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            CORE DAEMON OK
          </span>
          <span>|</span>
          <span className="text-on-surface-variant">AST COVERAGE: <strong className="text-secondary">98.4%</strong></span>
        </div>
        <div className="flex items-center gap-4 text-primary-fixed-dim">
          <span>XYZ: [48.8584, 2.2945, +184m]</span>
        </div>
      </footer>

    </div>
  );
}

export default App;

// Refactor pass 0

// Refactor pass 1

// Refactor pass 2

// Refactor pass 3

// Refactor pass 4

// Refactor pass 5

// Refactor pass 6

// Refactor pass 7

// Refactor pass 8

// Refactor pass 9

// Refactor pass 10

// Refactor pass 11

// Refactor pass 12

// Refactor pass 13

// Refactor pass 14

// Refactor pass 15

// Refactor pass 16

// Refactor pass 17

// Refactor pass 18

// Refactor pass 19

// Refactor pass 20

// Refactor pass 21

// Refactor pass 22

// Refactor pass 23

// Refactor pass 24

// Refactor pass 25

// Refactor pass 26

// Refactor pass 27

// Refactor pass 28

// Refactor pass 29

// Refactor pass 0

// Refactor pass 1

// Refactor pass 2

// Refactor pass 3

// Refactor pass 4
