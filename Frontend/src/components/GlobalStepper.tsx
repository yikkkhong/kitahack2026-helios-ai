import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface GlobalStepperProps {
  currentStep: 1 | 2 | 3;
  onBack: () => void;
  className?: string;
}

const GlobalStepper: React.FC<GlobalStepperProps> = ({ currentStep, onBack, className = "" }) => {
  const steps = [
    { num: 1, label: "AI Discovery" },
    { num: 2, label: "3D Digital Twin" },
    { num: 3, label: "Assetization" }
  ];

  return (
    <div className={`flex items-center gap-3 pointer-events-auto ${className}`}>
      {/* 统一的科幻风 Back 按钮 */}
      <button 
        onClick={onBack} 
        className="group flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 text-gray-300 px-4 py-2 rounded-full hover:bg-white/20 hover:text-white transition-all shadow-lg"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Back</span>
      </button>

      {/* 极简的面包屑进度条 (只有在中等以上屏幕显示，防止手机端拥挤) */}
      <div className="hidden md:flex items-center bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-2 rounded-full shadow-lg">
        {steps.map((step, index) => {
          const isActive = currentStep === step.num;
          const isPast = currentStep > step.num;
          
          return (
            <React.Fragment key={step.num}>
              {/* 单个 Step */}
              <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 
                isPast ? 'text-gray-300' : 'text-gray-600'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] ${
                  isActive ? 'border-cyan-400 bg-cyan-400/20' : 
                  isPast ? 'border-gray-400 bg-gray-400/20' : 
                  'border-gray-700 bg-transparent'
                }`}>
                  {step.num}
                </span>
                {step.label}
              </div>
              
              {/* 连接线 */}
              {index < steps.length - 1 && (
                <div className={`w-4 h-[1px] mx-2 ${isPast ? 'bg-gray-400' : 'bg-gray-700'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default GlobalStepper;