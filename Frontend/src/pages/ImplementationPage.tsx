import React, { useState, useEffect, useRef } from 'react';
import { Sun, Battery, DollarSign, Activity, TrendingUp, TrendingDown, RefreshCw, Lock, Unlock } from 'lucide-react';

// --- Types ---
type MarketLog = {
  month: number;
  message: string;
  type: 'gain' | 'loss' | 'neutral';
};

const ImplementationPage: React.FC = () => {
  // --- 1. MOCK DATA & CONSTANTS (初始设定) ---
  const INITIAL_POOL_CASH = 1000; // 初始奖金池 (RM)
  const INITIAL_TOKEN_SUPPLY = 1000; // 初始流通 Token 数量
  const TOTAL_CAP_TOKENS = 10000; // 用户总共可以挖掘的 Token 上限
  const GRID_BUYBACK_RATE = 0.50; // 总部收购电价 (RM/kWh)
  const BASE_MONTHLY_PRODUCTION = 300; // 基础产能 (kWh)

  // --- 2. STATE MANAGEMENT (核心状态) ---
  
  // 市场状态
  const [liquidityPool, setLiquidityPool] = useState(INITIAL_POOL_CASH);
  const [circulatingSupply, setCirculatingSupply] = useState(INITIAL_TOKEN_SUPPLY);
  
  // 用户状态
  const [myTokens, setMyTokens] = useState(30); // 初始首付 (比如3%)
  const [myLockedTokens, setMyLockedTokens] = useState(TOTAL_CAP_TOKENS - 30); // 剩下的待解锁
  const [myCash, setMyCash] = useState(100); // 用户钱包里的现金
  
  // 模拟控制状态
  const [currentMonth, setCurrentMonth] = useState(1);
  const [consumptionRate, setConsumptionRate] = useState(50); // 家庭自用电比例 (Slider)
  const [logs, setLogs] = useState<MarketLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // --- 3. COMPUTED VALUES (实时计算) ---

  // 核心公式：当前 Token 价格 = 资金池 / 流通数量
  const tokenPrice = liquidityPool / circulatingSupply;
  
  // 用户总资产价值 (Token价值 + 现金)
  const myPortfolioValue = (myTokens * tokenPrice) + myCash;

  // 自动滚动日志
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- 4. CORE LOGIC FUNCTIONS (业务逻辑) ---

  const addLog = (message: string, type: 'gain' | 'loss' | 'neutral' = 'neutral') => {
    setLogs(prev => [...prev, { month: currentMonth, message, type }]);
  };

  // 核心功能 A: 模拟一个月过去 (Simulate Month)
  const handleSimulateMonth = () => {
    // 1. 模拟发电 (加入随机天气因素 0.8 ~ 1.2)
    const weatherFactor = 0.8 + Math.random() * 0.4;
    const production = Math.floor(BASE_MONTHLY_PRODUCTION * weatherFactor);
    
    // 2. 计算自用和多余 (Surplus)
    const consumption = Math.floor(production * (consumptionRate / 100));
    const surplus = Math.max(0, production - consumption);

    // 3. 结算逻辑
    if (surplus > 0) {
      // a. 总部打钱进池子
      const revenue = surplus * GRID_BUYBACK_RATE;
      setLiquidityPool(prev => prev + revenue);

      // b. 解锁用户的 Token (1 kWh surplus = 1 Token unlocked)
      // 注意：不能超过剩余锁定总数
      const tokensToUnlock = Math.min(surplus, myLockedTokens);
      
      if (tokensToUnlock > 0) {
        setMyLockedTokens(prev => prev - tokensToUnlock);
        setMyTokens(prev => prev + tokensToUnlock);
        setCirculatingSupply(prev => prev + tokensToUnlock); // 解锁出来的币进入了流通市场
        
        addLog(`☀️ Month ${currentMonth}: Surplus ${surplus}kWh. Pool +RM${revenue.toFixed(2)}. Unlocked ${tokensToUnlock} Tokens.`, 'gain');
      } else {
        addLog(`☀️ Month ${currentMonth}: Surplus ${surplus}kWh. Pool +RM${revenue.toFixed(2)}. No more tokens to unlock!`, 'gain');
      }
    } else {
      addLog(`☁️ Month ${currentMonth}: High consumption! No surplus energy sold.`, 'loss');
    }

    setCurrentMonth(prev => prev + 1);
  };

  // 核心功能 B: 卖币 (Sell)
  const handleSell = (amount: number) => {
    if (amount <= 0 || amount > myTokens) return;
    
    const value = amount * tokenPrice;
    
    // 更新状态
    setMyTokens(prev => prev - amount); // 用户币减少
    setMyCash(prev => prev + value);    // 用户钱增加
    setLiquidityPool(prev => prev - value); // 池子钱减少 (被提现了)
    setCirculatingSupply(prev => prev - amount); // 假设回流系统销毁/暂存，减少流通分母 (支撑价格)

    addLog(`💰 Sold ${amount} Tokens for RM${value.toFixed(2)}`, 'neutral');
  };

  // 核心功能 C: 买币 (Buy) - 模拟市场博弈
  const handleBuy = (amount: number) => {
    // 这里简化逻辑：用户花钱买币
    const cost = amount * tokenPrice;
    if (cost > myCash) {
      alert("Not enough cash!");
      return;
    }

    setMyTokens(prev => prev + amount);
    setMyCash(prev => prev - cost);
    setLiquidityPool(prev => prev + cost); // 钱进池子
    setCirculatingSupply(prev => prev + amount); // 假设系统增发/卖出库存

    addLog(`🛒 Bought ${amount} Tokens for RM${cost.toFixed(2)}`, 'neutral');
  };

  // --- 5. UI RENDER ---
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-8 font-sans">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Solar Asset Dashboard</h1>
          <p className="text-gray-500">Step 3: Assetization & Market Simulation</p>
        </div>
        <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200 flex gap-6">
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-semibold">Wallet Cash</p>
            <p className="text-xl font-bold text-green-600">RM {myCash.toFixed(2)}</p>
          </div>
          <div className="text-right border-l pl-6">
            <p className="text-xs text-gray-400 uppercase font-semibold">Total Net Worth</p>
            <p className="text-xl font-bold text-blue-600">RM {myPortfolioValue.toFixed(2)}</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Market Stats */}
        <div className="space-y-6">
          {/* Card 1: Token Price */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Solar Token Price</h2>
              <Activity className="text-blue-500 w-5 h-5" />
            </div>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-gray-900">RM {tokenPrice.toFixed(4)}</span>
              {tokenPrice > 1.0 ? (
                <span className="text-green-500 flex items-center text-sm mb-1"><TrendingUp className="w-4 h-4 mr-1"/> +{((tokenPrice-1)*100).toFixed(1)}%</span>
              ) : (
                <span className="text-gray-400 text-sm mb-1">Base Price</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Backed by Real World Energy Assets</p>
          </div>

          {/* Card 2: Liquidity Pool */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Market Liquidity</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600"><DollarSign className="w-4 h-4"/> Pool Balance</span>
                <span className="font-bold">RM {liquidityPool.toFixed(2)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (liquidityPool/2000)*100)}%` }}></div>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-gray-600"><Sun className="w-4 h-4"/> Circulating Supply</span>
                <span className="font-bold">{circulatingSupply.toFixed(0)} Tokens</span>
              </div>
            </div>
          </div>

          {/* Card 3: My Holdings */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 rounded-2xl shadow-lg">
            <h2 className="text-blue-100 font-medium mb-6">My Assets</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1 text-blue-200 text-sm"><Unlock className="w-3 h-3"/> Unlocked</div>
                <div className="text-2xl font-bold">{myTokens.toFixed(0)}</div>
                <div className="text-xs text-blue-200">Value: RM {(myTokens * tokenPrice).toFixed(0)}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1 text-blue-200 text-sm"><Lock className="w-3 h-3"/> Locked</div>
                <div className="text-2xl font-bold text-gray-300">{myLockedTokens.toFixed(0)}</div>
                <div className="text-xs text-gray-400">Future Potential</div>
              </div>
            </div>
            
            {/* Trading Actions */}
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => handleSell(10)}
                disabled={myTokens < 10}
                className="flex-1 bg-white text-blue-900 py-2 rounded-lg font-bold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Sell 10
              </button>
              <button 
                onClick={() => handleBuy(10)}
                disabled={myCash < (10 * tokenPrice)}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-bold hover:bg-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Buy 10
              </button>
            </div>
          </div>
        </div>

        {/* Center & Right Column: Simulation & Logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Simulation Controls */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Time Simulation</h2>
                <p className="text-gray-500 text-sm">Control the physical world variables to see market impact.</p>
              </div>
              <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <Sun className="w-3 h-3"/> Month {currentMonth}
              </div>
            </div>

            <div className="mb-8">
              <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center gap-2"><Battery className="w-4 h-4"/> Household Consumption Rate</span>
                <span>{consumptionRate}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={consumptionRate} 
                onChange={(e) => setConsumptionRate(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0% (All Surplus)</span>
                <span>100% (No Surplus)</span>
              </div>
            </div>

            <button 
              onClick={handleSimulateMonth}
              className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
            >
              <RefreshCw className="w-5 h-5" />
              Simulate 1 Month Passed
            </button>
          </div>

          {/* Market Logs */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Transaction & Market History</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {logs.length === 0 && (
                <div className="text-center text-gray-400 mt-10 text-sm">No activity yet. Start the simulation.</div>
              )}
              {logs.map((log, index) => (
                <div key={index} className={`text-sm p-3 rounded-lg border ${
                  log.type === 'gain' ? 'bg-green-50 border-green-100 text-green-800' :
                  log.type === 'loss' ? 'bg-red-50 border-red-100 text-red-800' :
                  'bg-gray-50 border-gray-100 text-gray-600'
                }`}>
                  <span className="font-bold opacity-50 mr-2">M{log.month}</span>
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ImplementationPage;