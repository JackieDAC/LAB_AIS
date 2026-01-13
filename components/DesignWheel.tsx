import React from 'react';
import { StageType } from '../types';
import { STAGE_CONFIG } from '../constants';
import { CheckCircle, Lock, AlertCircle } from 'lucide-react';

interface DesignWheelProps {
  currentStage: StageType;
  stagesStatus: Record<StageType, { status: string; score: number }>;
  onStageSelect: (stage: StageType) => void;
}

const DesignWheel: React.FC<DesignWheelProps> = ({ currentStage, stagesStatus, onStageSelect }) => {
  // Ordered sequence for the wheel
  const sequence = [
    StageType.EMPATHIZE,
    StageType.DEFINE,
    StageType.IDEATE,
    StageType.PROTOTYPE,
    StageType.TEST,
    StageType.IMPLEMENT
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto p-4 flex flex-col items-center">
      {/* Mobile / List View */}
      <div className="md:hidden w-full space-y-3">
        {sequence.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const status = stagesStatus[stage].status;
          const isLocked = status === 'LOCKED';
          
          return (
            <button
              key={stage}
              onClick={() => !isLocked && onStageSelect(stage)}
              disabled={isLocked}
              className={`w-full p-4 rounded-xl flex items-center justify-between border-2 transition-all ${
                currentStage === stage ? `${config.borderColor} ${config.bgLight}` : 'border-gray-200 bg-white'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`${config.color}`}>{config.icon}</div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-800">{config.label}</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{status.replace('_', ' ')}</p>
                </div>
              </div>
              {status === 'APPROVED' && <CheckCircle className="text-green-500 w-5 h-5" />}
              {status === 'REJECTED' && <AlertCircle className="text-red-500 w-5 h-5" />}
              {status === 'LOCKED' && <Lock className="text-gray-400 w-5 h-5" />}
            </button>
          );
        })}
      </div>

      {/* Desktop / Circular View - Conceptualized as Cards in a Grid for better responsiveness than pure SVG complex paths, 
          but arranged to imply a cycle */}
      <div className="hidden md:grid grid-cols-3 gap-6 w-full">
        {sequence.map((stage, index) => {
          const config = STAGE_CONFIG[stage];
          const status = stagesStatus[stage].status;
          const isLocked = status === 'LOCKED';
          const isCurrent = currentStage === stage;

          return (
            <div 
              key={stage}
              onClick={() => !isLocked && onStageSelect(stage)}
              className={`relative group cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 ${
                isCurrent 
                  ? `${config.borderColor} ${config.bgLight} scale-105 shadow-lg` 
                  : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-md'
              } ${isLocked ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-full ${isCurrent ? 'bg-white' : config.bgLight} ${config.color}`}>
                  {config.icon}
                </div>
                {status === 'APPROVED' && <CheckCircle className="text-green-500" />}
                {status === 'REJECTED' && <AlertCircle className="text-red-500" />}
                {status === 'LOCKED' && <Lock className="text-gray-300" />}
              </div>
              
              <h3 className={`text-lg font-bold mb-1 ${isCurrent ? config.color : 'text-gray-700'}`}>
                {config.label}
              </h3>
              <p className="text-xs text-gray-500 mb-3">{config.description}</p>
              
              <div className="flex items-center justify-between mt-auto">
                 <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                   status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                   status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                   status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                   'bg-gray-100 text-gray-600'
                 }`}>
                   {status.replace('_', ' ')}
                 </span>
                 {stagesStatus[stage].score > 0 && (
                   <span className="text-sm font-bold text-gray-900">
                     {stagesStatus[stage].score}/10
                   </span>
                 )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="hidden md:flex items-center justify-center mt-8 space-x-2 text-gray-400">
        <div className="h-1 w-12 bg-gray-300 rounded-full"></div>
        <span className="text-xs uppercase tracking-widest font-semibold">Workflow Process</span>
        <div className="h-1 w-12 bg-gray-300 rounded-full"></div>
      </div>
    </div>
  );
};

export default DesignWheel;