import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Zap, DollarSign, Activity, Lock, Unlock, Bot, Send, Loader2, Cpu, PlusCircle, FastForward, TrendingUp, TrendingDown, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import GlobalStepper from '../components/GlobalStepper';
import { X, History, ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';

// --- Types ---
type MarketLog = {
  month: number;
  message: string;
  type: 'gain' | 'loss' | 'neutral';
};

const AssetizationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // --- 1. SYSTEM & ASSET CONFIGURATION ---
  const blueprint = location.state?.blueprintData || JSON.parse(localStorage.getItem("step2_solar_blueprint") || "{}");
  
  const [panelCount, setPanelCount] = useState<number>(Number(blueprint?.technical_config?.panel_count) || 10);
  
  // Transform into a State: This makes it easier for us to simulate real-world electricity price spikes!
  const [electricityRate, setElectricityRate] = useState<number>(Number(blueprint?.asset_potential?.eru_peg_rate_rm) || 0.50); 
  
  const monthlyProductionKwh = panelCount * 45; 
  const [monthlyConsumptionKwh, setMonthlyConsumptionKwh] = useState<number>(Math.floor(monthlyProductionKwh * 0.5)); 

  const [totalCapTokens, setTotalCapTokens] = useState<number>(monthlyProductionKwh * 120);
  const INITIAL_GRANT = Number(blueprint?.asset_potential?.initial_grant_eru) || (totalCapTokens * 0.1); 

  // --- 2. WALLET & VAULT STATES ---
  const [unlockedTokens, setUnlockedTokens] = useState<number>(INITIAL_GRANT);
  const [lockedTokens, setLockedTokens] = useState<number>(totalCapTokens - INITIAL_GRANT);
  const [walletCash, setWalletCash] = useState<number>(1000); 

  // Added: Transaction quantity status and historical record expansion status
  const [tradeAmount, setTradeAmount] = useState<number>(1000); 
  const [showAllLogs, setShowAllLogs] = useState<boolean>(false);
  
  // Timeline & Logs
  const [currentMonth, setCurrentMonth] = useState<number>(1);
  const [logs, setLogs] = useState<MarketLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // AI Robo-Advisor
  const [scenarioInput, setScenarioInput] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [scenarioChangeKwh, setScenarioChangeKwh] = useState<number>(0); 
  const [aiResponse, setAiResponse] = useState<{message: string, impact: number, uiAction: any} | null>(null);

  // Add a few nice-looking tags for everyday events
  const QUICK_SCENARIOS = [
      "🚗 Buy an EV next year", 
      "👶 Having a baby soon", 
      "📉 Need emergency cash", 
      "✈️ 3-month vacation"
  ];

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, type: 'gain' | 'loss' | 'neutral' = 'neutral') => {
    setLogs((prev: MarketLog[]) => [...prev, { month: currentMonth, message, type }]);
  };

  const visibleLogs = showAllLogs ? logs : logs.slice(-3);

  // --- 3. DEMO CONTROLS (Floating Console Actions) ---
  // Demo Action 1: Fast Forward 1 Month
  const handleFastForwardMonth = () => {
    const surplusKwh = Math.max(0, (panelCount * 45) - monthlyConsumptionKwh);
    if (surplusKwh > 0) {
      const tokensToUnlock = Math.min(surplusKwh, lockedTokens);
      if (tokensToUnlock > 0) {
        setLockedTokens((prev: number) => prev - tokensToUnlock);
        setUnlockedTokens((prev: number) => prev + tokensToUnlock);
        addLog(`☀️ M${currentMonth}: Generated ${surplusKwh} kWh surplus. Unlocked ${tokensToUnlock} ERU.`, 'gain');
      } else {
        addLog(`☀️ M${currentMonth}: ${surplusKwh} kWh surplus, but 10-Yr Cap is fully unlocked!`, 'neutral');
      }
    } else {
      addLog(`☁️ M${currentMonth}: High consumption. No surplus to unlock.`, 'loss');
    }
    setCurrentMonth((prev: number) => prev + 1);
  };

  // Demo Action 2: Install Panels (Fixed Logic)
  const handleAddPanels = () => {
    const panelsToAdd = 2;
    const additionalProductionPerMonth = panelsToAdd * 45;
    const additionalTokens10Years = additionalProductionPerMonth * 120; 
    
    const immediateGrant = additionalTokens10Years * 0.1;

    setPanelCount((prev: number) => prev + panelsToAdd);
    setTotalCapTokens((prev: number) => prev + additionalTokens10Years);
    setUnlockedTokens((prev: number) => prev + immediateGrant);
    setLockedTokens((prev: number) => prev + (additionalTokens10Years - immediateGrant));
    
    addLog(`🔧 Installed ${panelsToAdd} panels. Cap increased. Unlocked ${immediateGrant} ERU immediately.`, 'neutral');
  };

  // 🟢 Demo Action 3: Simulate Grid Price Hike
  const handlePriceHike = () => {
    setElectricityRate((prev: number) => prev + 0.05);
    addLog(`📈 ALERT: National grid rate increased by RM 0.05. ERU value naturally appreciated!`, 'gain');
  };

  // 🟢 Demo Action 4: Simulate Grid Price Drop
  const handlePriceDrop = () => {
    // Set a bottom line to prevent electricity bills from falling into negative territory (e.g., dropping as low as RM 0.10).
    setElectricityRate((prev: number) => Math.max(0.10, prev - 0.05));
    addLog(`📉 ALERT: National grid rate decreased by RM 0.05. ERU pegged value adjusted.`, 'loss');
  };

  // --- 4. USER TRADING ACTIONS ---
  const handleBuy = (amount: number) => {
    const cost = amount * electricityRate;
    if (cost > walletCash) return alert("Insufficient Fiat Cash!");
    setWalletCash((prev: number) => prev - cost);
    setUnlockedTokens((prev: number) => prev + amount);
    addLog(`🛒 Bought ${amount} ERU for RM ${cost.toFixed(2)}`, 'neutral');
  };

  const handleSell = (amount: number) => {
    if (amount > unlockedTokens) return alert("Insufficient Unlocked ERU!");
    const revenue = amount * electricityRate;
    setUnlockedTokens((prev: number) => prev - amount);
    setWalletCash((prev: number) => prev + revenue);
    addLog(`💰 Liquidated ${amount} ERU for RM ${revenue.toFixed(2)}`, 'neutral');
  };

  // --- 5. CHART DATA GENERATOR ---
  const generateChartData = () => {
    const data = [];
    let simUnlocked = unlockedTokens;
    let simLocked = lockedTokens;

    let aiUnlocked = unlockedTokens;
    let aiLocked = lockedTokens;
    
    const currentProd = panelCount * 45;

    for (let m = 1; m <= 12; m++) {
      const baseSurplus = Math.max(0, currentProd - monthlyConsumptionKwh);
      const baseUnlock = Math.min(baseSurplus, simLocked);
      simUnlocked += baseUnlock;
      simLocked -= baseUnlock;

      const aiSurplus = Math.max(0, currentProd - (monthlyConsumptionKwh + scenarioChangeKwh));
      const aiUnlock = Math.min(aiSurplus, aiLocked);
      aiUnlocked += aiUnlock;
      aiLocked -= aiUnlock;

      data.push({
        name: `M${currentMonth + m - 1}`,
        // Data is dynamically reacting to the electricityRate state!
        BaselineValue: Math.round(simUnlocked * electricityRate), 
        ScenarioValue: Math.round(aiUnlocked * electricityRate)
      });
    }
    return data;
  };

  const chartData = generateChartData();
  const currentNetWorth = walletCash + (unlockedTokens * electricityRate);

  // --- 6. AI FINANCIAL ORACLE ---
const handleAskAI = async (overrideInput?: string) => {
    const textToAnalyze = overrideInput || scenarioInput;
    if (!textToAnalyze.trim()) return;
    
    setIsSimulating(true);
    setScenarioInput(textToAnalyze); // Ensure the text clicked is displayed in the input box.
    
    try {
      const analyze = httpsCallable(functions, 'analyzeScenario');
      const result: any = await analyze({
          userInput: textToAnalyze,
          baseProduction: panelCount * 45,
          baseConsumption: monthlyConsumptionKwh,
          walletCash: walletCash,
          unlockedEru: unlockedTokens,
          lockedEru: lockedTokens,
          eruRate: electricityRate
      });
      
      const aiData = result.data.data;
      setScenarioChangeKwh(aiData.kwh_change);
      setAiResponse({ 
          message: aiData.advisor_message, 
          impact: aiData.financial_impact_rm,
          uiAction: aiData.ui_action // Receive button commands from AI
      });
    } catch (e) {
      console.error(e);
      // ...Ignore the error message; the backend already has a good fallback mechanism.
    } finally {
      setIsSimulating(false);
      setScenarioInput(""); 
    }
  };

  // Execute AI-recommended trading operations with a single click!
  const executeAiAction = () => {
      if (!aiResponse?.uiAction) return;
      
      const { type, amount } = aiResponse.uiAction;
      if (type === 'BUY' && amount > 0) handleBuy(amount);
      if (type === 'LIQUIDATE' && amount > 0) handleSell(amount);
      
      // Close panel after execution
      setAiResponse(null);
      setScenarioChangeKwh(0); // Chart restored to original state
  };

  return (
    // Lock the height and force no scrolling: h-screen & overflow-hidden
    <div className="h-screen w-full bg-black text-white font-sans selection:bg-cyan-500/30 overflow-hidden relative flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/30 via-black to-black -z-10"></div>
      
      {/* Header (Fixed Height) */}
      <header className="h-[80px] shrink-0 p-6 flex justify-between items-center border-b border-white/10 bg-black/60 backdrop-blur-xl z-10">
        <GlobalStepper currentStep={3} onBack={() => navigate(-1)} />
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Liquid Fiat (RM)</div>
            <div className="text-xl font-bold text-green-400 font-mono">RM {walletCash.toFixed(2)}</div>
          </div>
          <div className="w-px h-8 bg-white/20"></div>
          <div className="text-right">
            <div className="text-[10px] text-cyan-500 uppercase tracking-widest mb-1 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">Total Net Worth</div>
            <div className="text-2xl font-bold text-white font-mono">RM {currentNetWorth.toFixed(2)}</div>
          </div>
        </div>
      </header>

      {/* Main Content Area (Calculated remaining height, flex-row) */}
      <div className="flex-1 flex gap-6 p-6 overflow-hidden z-10 max-w-[1600px] w-full mx-auto pb-24">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: Vault & Logs (30% width)        */}
        {/* ========================================== */}
        <div className="w-[30%] flex flex-col gap-4 h-full">
          
          {/* Rate Card (Super Compact) */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex justify-between items-center shrink-0">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <DollarSign size={12} className="text-cyan-500" /> Utility Peg Rate
              </div>
              <span className="text-3xl font-black font-mono">RM {electricityRate.toFixed(2)}</span>
            </div>
            <div className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-1 rounded">FIXED RWA</div>
          </div>

          {/* Vault Controls (Compact) */}
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/10 border border-blue-500/30 p-5 rounded-2xl shrink-0 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">ERU Vault</span>
              <span className="text-[10px] text-gray-400">10-Yr Cap: {Math.round(totalCapTokens).toLocaleString()}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-black/40 p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-1 text-gray-400 text-[10px] mb-1"><Unlock size={12}/> Unlocked</div>
                <div className="text-xl font-bold font-mono text-white">{Math.round(unlockedTokens).toLocaleString()}</div>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-1 text-gray-400 text-[10px] mb-1"><Lock size={12}/> Locked</div>
                <div className="text-xl font-bold font-mono text-gray-500">{Math.round(lockedTokens).toLocaleString()}</div>
              </div>
            </div>

            {/* Trading Actions */}
            <div className="mb-3">
              <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 mb-3">
                 <span className="text-[10px] text-gray-500 uppercase tracking-widest">Amount</span>
                 <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={tradeAmount} 
                      onChange={(e) => setTradeAmount(Number(e.target.value))}
                      className="bg-transparent text-right text-white font-mono font-bold w-20 focus:outline-none selection:bg-cyan-500/30"
                      step="100"
                      min="100"
                    />
                    <span className="text-[10px] text-cyan-500 font-bold">ERU</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleBuy(tradeAmount)} className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-xs transition shadow-[0_0_15px_rgba(37,130,246,0.3)]">
                  Buy
                </button>
                <button onClick={() => handleSell(tradeAmount)} className="bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white py-2 rounded-lg font-bold text-xs transition">
                  Liquidate
                </button>
              </div>
            </div>  
          </div>

          {/* Logs (Fills remaining left column space) */}
          <div className="bg-zinc-900/60 border border-white/10 p-4 rounded-2xl flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recent Activity</div>
            </div>
            
            {/* Only display the 3 most recent records on the panel. */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 scrollbar-none mb-2">
              {logs.length === 0 ? (
                 <div className="text-xs text-gray-500 text-center mt-4">No recent activity.</div>
              ) : (
                 // Take the last 3 entries and reverse their order (newest on top).
                 logs.slice(-3).reverse().map((log: any, index: number) => {
                    // Securely extract text content
                    const logText = typeof log === 'string' ? log : (log.message || log.text || "");
                    return (
                      <div key={index} className="text-[11px] text-gray-300 bg-black/40 border border-white/5 p-2.5 rounded-lg leading-relaxed">
                        {logText}
                      </div>
                    );
                 })
              )}
            </div>

            {/* Bottom operation area: One-click to open history pop-up window */}
            <div className="shrink-0 flex items-center justify-between border-t border-white/10 pt-3 mt-2">
              <span className="text-gray-500 text-[10px]">{logs.length} records total</span>
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="px-4 py-1.5 bg-cyan-900/20 hover:bg-cyan-800/40 border border-cyan-500/30 rounded-full text-[10px] font-bold uppercase tracking-widest text-cyan-400 transition-colors"
              >
                View All Ledger
              </button>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN: AI Chart & Chat (70% width)  */}
        {/* ========================================== */}
        <div className="w-[70%] bg-zinc-900/60 backdrop-blur-xl border border-cyan-500/20 p-6 rounded-3xl shadow-2xl flex flex-col h-full relative">
          
          <div className="flex justify-between items-center shrink-0 mb-4">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white">
              <Cpu className="text-cyan-400" size={24} /> AI Life Event Strategy
            </h2>
            <div className="text-[10px] text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full uppercase tracking-widest">
              12-Month Projection
            </div>
          </div>

          {/* Chart area: With flex-1, it takes up all the remaining space and will definitely not be squeezed. */}
          <div className="flex-1 w-full bg-black/40 rounded-2xl p-4 border border-white/5 relative min-h-0 mb-4">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorScenario" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `RM ${val}`} width={60} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: 'rgba(34,211,238,0.4)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  formatter={(value: any, name: any) => [`RM ${value}`, name === 'BaselineValue' ? 'Current Reality' : 'Event Impact']}
                />
                <Area type="monotone" dataKey="BaselineValue" name="BaselineValue" stroke="#9ca3af" strokeWidth={2} fill="url(#colorBase)" />
                {scenarioChangeKwh !== 0 && (
                  <Area type="monotone" dataKey="ScenarioValue" name="ScenarioValue" stroke="#22d3ee" strokeWidth={3} fill="url(#colorScenario)" animationDuration={1000} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Operation Center (Swap & Lock Layout): Fixed height of 140px, content inside can be switched between each other, and the outer frame height never changes. */}
          <div className="shrink-0 h-[140px] relative w-full">
             
             {!aiResponse ? (
                // Status A: Default input status
                <div className="absolute inset-0 flex flex-col justify-end animate-in fade-in duration-300">
                    <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none">
                        {QUICK_SCENARIOS.map((chip, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => handleAskAI(chip)}
                                className="whitespace-nowrap bg-cyan-900/20 hover:bg-cyan-800/40 border border-cyan-500/30 text-cyan-200 px-4 py-1.5 rounded-full text-xs transition-colors"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <input 
                          type="text" 
                          value={scenarioInput}
                          onChange={(e) => setScenarioInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                          placeholder="Or type your own life event here..." 
                          className="w-full bg-black/80 border border-white/20 rounded-full py-4 pl-6 pr-16 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <button 
                          onClick={() => handleAskAI()}
                          disabled={isSimulating || (!scenarioInput && !isSimulating)}
                          className="absolute right-2 top-2 bottom-2 bg-cyan-600 hover:bg-cyan-500 w-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                        >
                          {isSimulating ? <Loader2 size={16} className="animate-spin text-white"/> : <Send size={16} className="text-white ml-0.5" />}
                        </button>
                    </div>
                </div>
             ) : (
                // Status B: AI response and one-click execution status
                <div className="absolute inset-0 bg-cyan-950/40 border border-cyan-500/40 rounded-2xl p-4 animate-in slide-in-from-bottom-2 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full bg-black border border-cyan-500/50 flex items-center justify-center shrink-0">
                      <Bot size={24} className="text-cyan-400" />
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-sm text-gray-200 mb-2 leading-relaxed">
                        {aiResponse.message}
                      </p>
                      {/* AI-generated execution button */}
                      <div className="flex items-center gap-3">
                          <button 
                             onClick={executeAiAction}
                             className={`flex-1 py-2 rounded-lg font-bold text-xs shadow-lg transition-transform hover:scale-[1.02] active:scale-95 ${
                                aiResponse.uiAction.type === 'BUY' ? 'bg-blue-600 text-white' :
                                aiResponse.uiAction.type === 'LIQUIDATE' ? 'bg-red-600 text-white' :
                                'bg-gray-600 text-white'
                             }`}
                          >
                             {aiResponse.uiAction.button_label}
                          </button>
                          
                          <button 
                             onClick={() => { setAiResponse(null); setScenarioChangeKwh(0); }}
                             className="px-4 py-2 border border-white/20 rounded-lg text-gray-400 text-xs hover:bg-white/10 transition-colors"
                          >
                             Dismiss
                          </button>
                      </div>
                    </div>
                </div>
             )}

          </div>

        </div>
      </div>

      {/* ============================================ */}
      {/* 🔴 THE DEMO DIRECTOR CONSOLE (Floating Dock) */}
      {/* ============================================ */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10">
          <div className="bg-black/90 backdrop-blur-2xl border border-white/20 p-2 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center gap-2">
              
              <div className="px-4 py-1 flex items-center gap-2 border-r border-white/10 mr-2">
                  <Terminal size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Demo Tools</span>
              </div>

              <button onClick={handleFastForwardMonth} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-full text-xs font-bold transition">
                  <FastForward size={14} /> Simulate 1 Month
              </button>

              <button onClick={handleAddPanels} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-full text-xs font-bold transition">
                  <PlusCircle size={14} /> Add 2 Panels
              </button>

              <button onClick={handlePriceHike} className="flex items-center gap-2 bg-red-900/60 hover:bg-red-800/80 border border-red-500/50 text-red-200 px-4 py-2.5 rounded-full text-xs font-bold transition shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  <TrendingUp size={14} className="text-red-400"/> Trigger Grid Price Hike
              </button>

              <button onClick={handlePriceDrop} className="flex items-center gap-2 bg-blue-900/60 hover:bg-blue-800/80 border border-blue-500/50 text-blue-200 px-4 py-2.5 rounded-full text-xs font-bold transition shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                  <TrendingDown size={14} className="text-blue-400"/> Price Drop (-)
              </button>
              
          </div>
      </div>

      {/* ========================================================= */}
      {/* 🌟 Exchange-level: Full-screen transparent history pop-up */}
      {/* ========================================================= */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95">
            
            {/* Pop-up Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-gradient-to-r from-zinc-900 to-black">
              <div className="flex items-center gap-3">
                <History className="text-cyan-400" size={24} />
                <h3 className="text-lg font-bold text-white uppercase tracking-widest">Asset Ledger</h3>
              </div>
              <button 
                onClick={() => setIsHistoryOpen(false)} 
                className="text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Pop-up window Content: Log list */}
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2 scrollbar-none bg-black/40">
                {logs.length === 0 ? (
                <div className="text-center text-gray-500 py-10 text-sm">No transactions yet.</div>
              ) : (
                logs.slice().reverse().map((log: any, index: number) => {
                  
                  // Resolve MarketLog errors! Automatically identify and extract text from objects.
                  const logText = typeof log === 'string' ? log : (log.message || log.text || log.action || "");
                  
                  // 🎨 Pure visual intelligent classification logic: Analyze the extracted text.
                  const isBuy = logText.toLowerCase().includes('buy') || logText.toLowerCase().includes('bought');
                  const isSell = logText.toLowerCase().includes('liquidate') || logText.toLowerCase().includes('sell');
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    >
                      {/* Dynamic icons and colors */}
                      <div className={`p-3 rounded-full shrink-0 ${
                        isBuy ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                        isSell ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {isBuy ? <ArrowDownRight size={20} /> : isSell ? <ArrowUpRight size={20} /> : <Info size={20} />}
                      </div>
                      
                      {/* Log content (note that logText is used here) */}
                      <div className="flex-1">
                        <p className="text-gray-200 text-sm font-medium leading-relaxed">
                          {logText} 
                        </p>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mt-1 font-mono">
                          Verified on Helios Network
                        </p>
                      </div>
                      
                      {/* Dynamic trading tags */}
                      <div className="shrink-0">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                          isBuy ? 'text-green-400 bg-green-500/10' : 
                          isSell ? 'text-red-400 bg-red-500/10' : 
                          'text-blue-400 bg-blue-500/10'
                        }`}>
                          {isBuy ? 'IN' : isSell ? 'OUT' : 'SYS'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AssetizationPage;