import React, { useState, useEffect } from "react";
import { 
  Send, 
  CheckCircle2, 
  FileText, 
  ShieldCheck, 
  ArrowLeft,
  ChevronRight,
  Zap,
  Globe,
  Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ImplementationPage = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [blueprint, setBlueprint] = useState<any>(null);

  // 从 LocalStorage 读取 Step 1 & 2 保存的数据
  useEffect(() => {
    const savedData = localStorage.getItem("step2_solar_blueprint");
    if (savedData) {
      setBlueprint(JSON.parse(savedData));
    }
  }, []);

  const handleFinalOrder = () => {
    setIsProcessing(true);
    // 模拟下单过程：生成PDF、发送Email
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
      {/* 顶部导航 - 保持极简 */}
      <nav className="p-6 flex justify-between items-center border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-30">
        <button 
          onClick={() => navigate("/simulation")}
          className="group flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Simulation
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-mono tracking-widest uppercase text-zinc-500">System Ready</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* 左侧：方案回顾 (Summary) */}
          <div className="lg:col-span-7 space-y-10">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tighter mb-4 text-white">
                FINAL <br /> <span className="text-zinc-500">BLUEPRINT.</span>
              </h1>
              <p className="text-zinc-400 max-w-md leading-relaxed">
                Review your customized solar energy strategy. Our AI has optimized every panel for maximum efficiency based on your rooftop's geometry.
              </p>
            </div>

            {/* 数据网格 - 延续 Step 1 的精致感 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {[
                { label: "Total Panels", value: blueprint?.technical?.panel_count || "--", unit: "Units" },
                { label: "System Size", value: "7.2", unit: "kWp" },
                { label: "Annual Savings", value: "RM 5,200", unit: "/yr", color: "text-green-400" },
              ].map((item, i) => (
                <div key={i} className="border-l border-zinc-800 pl-4 py-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{item.label}</p>
                  <p className={`text-2xl font-light ${item.color || "text-white"}`}>
                    {item.value} <span className="text-xs text-zinc-600 tracking-normal font-normal">{item.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* AI 生成的文件预览卡片 */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm flex items-center justify-between group hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-white">Solar_Installation_Plan.pdf</h3>
                  <p className="text-xs text-zinc-500">AI-Generated Technical Specification • 4.2MB</p>
                </div>
              </div>
              <button className="p-2 text-zinc-500 hover:text-white transition-colors">
                <Download size={20} />
              </button>
            </div>
          </div>

          {/* 右侧：操作区 (CTA) */}
          <div className="lg:col-span-5 relative">
            {!isComplete ? (
              <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl">
                <div className="mb-8">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Zap size={16} fill="currentColor" />
                    <span className="text-xs font-bold uppercase tracking-wider">Ready for Deployment</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-white italic font-serif">Confirm your transition to clean energy.</h2>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-zinc-500">Installation Partner</span>
                    <span className="text-zinc-200">Helios Certified™</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                    <span className="text-zinc-500">Deployment Location</span>
                    <span className="text-zinc-200 truncate ml-4">Current Address</span>
                  </div>
                </div>

                <button
                  onClick={handleFinalOrder}
                  disabled={isProcessing}
                  className="w-full group relative py-5 bg-white text-black font-bold uppercase tracking-widest rounded-xl overflow-hidden transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isProcessing ? (
                      <>Processing <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /></>
                    ) : (
                      <>Deploy System <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </span>
                </button>

                <p className="mt-6 text-[10px] text-zinc-500 text-center leading-relaxed">
                  By clicking deploy, your technical blueprint will be sent to our installation partners. This is a simulated action.
                </p>
              </div>
            ) : (
              <div className="text-center py-12 px-6 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="text-green-500" size={40} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">System Deployed.</h2>
                <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                  Your project has been successfully initialized. The installation team will review your AI blueprint shortly.
                </p>
                <button 
                  onClick={() => navigate("/")}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full text-sm transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
            
            {/* 装饰性元素 */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -z-10" />
          </div>
        </div>
      </main>

      {/* 底部 Footer - 类似 Tesla */}
      <footer className="border-t border-white/5 py-10 mt-20">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-8 text-[10px] uppercase tracking-widest text-zinc-600">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Legal</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2 text-zinc-700">
            <Globe size={14} />
            <span className="text-[10px] uppercase tracking-widest">Global Solar Network</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ImplementationPage;