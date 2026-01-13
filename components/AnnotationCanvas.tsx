import React, { useRef, useState, useEffect } from 'react';
import { Annotation } from '../types';
import { Pencil, Trash2, X, Move, Maximize, ZoomIn, ZoomOut, RotateCcw, MessageSquare } from 'lucide-react';

interface AnnotationCanvasProps {
  imageUrl: string;
  initialAnnotations: Annotation[];
  readOnly: boolean;
  onSave: (annotations: Annotation[]) => void;
  onClose: () => void;
}

const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({ 
  imageUrl, 
  initialAnnotations, 
  readOnly, 
  onSave,
  onClose
}) => {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  
  // Transform State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'PAN' | 'ANNOTATE'>(readOnly ? 'PAN' : 'ANNOTATE');
  const [activeId, setActiveId] = useState<string | null>(null); // For highlighting note/marker
  
  // Refs for Dragging
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [color, setColor] = useState('#EF4444');

  // ZOOM LOGIC
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, scale + delta), 5);
    setScale(newScale);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.1));
  const handleReset = () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
  };
  const handleFit = () => {
     setScale(0.8);
     setPosition({ x: 0, y: 0 });
  };

  // PAN / CLICK LOGIC
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode === 'PAN') {
        isDragging.current = true;
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    } else {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        const relX = (e.clientX - rect.left) / scale;
        const relY = (e.clientY - rect.top) / scale;
        
        const percentX = (relX / (rect.width / scale)) * 100;
        const percentY = (relY / (rect.height / scale)) * 100;

        if (percentX >= 0 && percentX <= 100 && percentY >= 0 && percentY <= 100) {
            const newId = Date.now().toString();
            const newAnnotation: Annotation = {
                id: newId,
                x: percentX,
                y: percentY,
                color,
                text: ''
            };
            setAnnotations([...annotations, newAnnotation]);
            setActiveId(newId); // Auto-focus the new note
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current && mode === 'PAN') {
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const removeAnnotation = (id: string) => {
    if (readOnly) return;
    setAnnotations(annotations.filter(a => a.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const updateAnnotationText = (id: string, text: string) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, text } : a));
  };

  const saveAndExit = () => {
    onSave(annotations);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex h-screen w-screen overflow-hidden animate-in fade-in duration-200">
        
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 z-20 shrink-0">
                <div className="flex items-center gap-4 text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {readOnly ? 'Viewer' : 'Annotation Editor'}
                    </h3>
                    <div className="h-6 w-px bg-gray-700 mx-2"></div>
                    
                    {/* View Controls */}
                    <div className="flex items-center bg-gray-800 rounded-lg p-1 gap-1">
                        <button onClick={handleZoomOut} className="p-2 hover:bg-gray-700 rounded text-gray-300" title="Zoom Out"><ZoomOut size={16}/></button>
                        <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={handleZoomIn} className="p-2 hover:bg-gray-700 rounded text-gray-300" title="Zoom In"><ZoomIn size={16}/></button>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button onClick={handleFit} className="p-2 hover:bg-gray-700 rounded text-gray-300" title="Fit Screen"><Maximize size={16}/></button>
                        <button onClick={handleReset} className="p-2 hover:bg-gray-700 rounded text-gray-300" title="Reset"><RotateCcw size={16}/></button>
                    </div>

                    {/* Mode Switcher for Instructor */}
                    {!readOnly && (
                        <div className="flex items-center bg-gray-800 rounded-lg p-1 gap-1 ml-4">
                            <button 
                                onClick={() => setMode('PAN')} 
                                className={`p-2 rounded flex items-center gap-2 text-xs font-bold ${mode === 'PAN' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Move size={16} /> Pan
                            </button>
                            <button 
                                onClick={() => setMode('ANNOTATE')} 
                                className={`p-2 rounded flex items-center gap-2 text-xs font-bold ${mode === 'ANNOTATE' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Pencil size={16} /> Annotate
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {!readOnly && (
                    <div className="flex gap-2">
                        {['#EF4444', '#3B82F6', '#10B981', '#F59E0B'].map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                        ))}
                    </div>
                    )}
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">Close</button>
                    <button 
                    onClick={saveAndExit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                    >
                    Done
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div 
                className={`flex-1 overflow-hidden relative bg-[#1a1a1a] ${mode === 'PAN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div 
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
                    }}
                    className="inline-block relative origin-top-left p-20"
                >
                    <div ref={containerRef} className="relative shadow-2xl inline-block">
                        <img 
                            src={imageUrl} 
                            alt="Asset" 
                            className="max-w-none block pointer-events-none select-none"
                            style={{ maxHeight: 'none', maxWidth: 'none' }}
                            draggable={false}
                        />
                        
                        {annotations.map((ann, i) => (
                            <div
                                key={ann.id}
                                onClick={(e) => { e.stopPropagation(); setActiveId(ann.id); }}
                                className={`absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center rounded-full shadow-md text-white font-bold text-sm border-2 transition-transform z-10 cursor-pointer ${activeId === ann.id ? 'scale-125 border-white ring-2 ring-white ring-offset-2 ring-offset-black' : 'border-white hover:scale-110'}`}
                                style={{ left: `${ann.x}%`, top: `${ann.y}%`, backgroundColor: ann.color, transform: `scale(${1/scale})` }}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="absolute bottom-4 left-4 bg-black/50 text-white/50 text-xs p-2 rounded pointer-events-none">
                    Scroll to zoom • Drag to pan • {readOnly ? 'View Only' : mode === 'ANNOTATE' ? 'Click to add marker' : 'Switch to Annotate to add markers'}
                </div>
            </div>
        </div>

        {/* Sidebar Notes Panel */}
        <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-800 bg-gray-900 z-10">
                <h4 className="text-white font-bold flex items-center gap-2">
                    <MessageSquare size={16} /> Feedback Notes
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                    {readOnly ? "View instructor comments below." : "Add markers on the image to create feedback notes."}
                </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {annotations.length === 0 && (
                    <div className="text-center text-gray-600 italic py-10">
                        No notes added yet.
                    </div>
                )}
                
                {annotations.map((ann, i) => (
                    <div 
                        key={ann.id} 
                        className={`bg-gray-800 rounded-lg border-l-4 p-3 transition-all ${activeId === ann.id ? 'ring-1 ring-white/30 bg-gray-700' : 'border-gray-700'}`}
                        style={{ borderLeftColor: ann.color }}
                        onClick={() => setActiveId(ann.id)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span 
                                className="font-bold text-xs px-2 py-0.5 rounded text-white" 
                                style={{backgroundColor: ann.color}}
                            >
                                Marker #{i + 1}
                            </span>
                            {!readOnly && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
                                    className="text-gray-500 hover:text-red-400 p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                        
                        {readOnly ? (
                            <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                {ann.text || <span className="text-gray-500 italic">No description provided.</span>}
                            </p>
                        ) : (
                            <textarea 
                                value={ann.text || ''}
                                onChange={(e) => updateAnnotationText(ann.id, e.target.value)}
                                placeholder="Explain the issue here..."
                                className="w-full bg-gray-900 text-white text-sm p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none min-h-[80px]"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default AnnotationCanvas;