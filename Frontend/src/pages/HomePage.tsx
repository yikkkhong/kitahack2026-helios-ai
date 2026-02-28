import { useState, useEffect } from 'react';
import {
  CloudSun,
  ArrowRight,
  Coins,
  Globe,
  Cpu,
  Menu,
  X,
  Sparkles,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

  const [showWhitepaper, setShowWhitepaper] = useState(false);

  function goToCustomization() {
    navigate('/customization');
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden selection:bg-cyan-500 selection:text-white font-sans">
      {/* --- Minimalist glassy state Navbar --- */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-black/60 backdrop-blur-xl border-b border-white/10 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-2xl tracking-tighter drop-shadow-lg">
            <CloudSun className="text-cyan-400" size={28} />
            HELIOS{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              AI
            </span>
          </div>

          <div className="hidden md:flex gap-8 text-xs font-bold uppercase tracking-widest text-gray-400">
            <a href="#" className="hover:text-cyan-400 transition-colors">
              The Protocol
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              3D Digital Twin
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              ERU Tokenomics
            </a>
          </div>

          <button
            onClick={goToCustomization}
            className="hidden md:flex items-center gap-2 bg-white/10 border border-white/20 text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all"
          >
            Launch dApp
          </button>

          <button
            className="md:hidden text-gray-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* --- Cyberpunk style Hero Section --- */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background halo effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent z-0"></div>

        <div className="relative z-10 text-center px-4 mt-16 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4">
            <Sparkles size={14} /> The Future of Solar Assets
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-gray-400 animate-in fade-in slide-in-from-bottom-6 duration-700 leading-tight">
            Turn Your Roof Into a <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
              Liquid Asset.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000">
            The first RWA-backed solar tokenization platform. Hedge against
            inflation, eliminate sunk costs, and trade your energy yield in
            real-time.
          </p>

          <div className="flex flex-col md:flex-row gap-5 justify-center items-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
            {/* Illuminated start button */}
            <button
              onClick={goToCustomization}
              className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 font-bold text-white shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:scale-105 transition-all duration-300 uppercase tracking-widest text-sm"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-white/20" />
              </div>
              <span className="flex items-center gap-2 relative z-10">
                Start AI Assessment{' '}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <button
              onClick={() => setShowWhitepaper(true)}
              className="bg-transparent border border-white/20 text-gray-300 px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all duration-300"
            >
              Read Whitepaper
            </button>
          </div>
        </div>
      </section>

      {/* --- Bento Grid (Strictly align the 3 core steps) --- */}
      <section className="py-24 bg-black px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center md:text-left">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
              An End-to-End <br />{' '}
              <span className="text-cyan-400">Financial Engine.</span>
            </h2>
            <p className="text-gray-400 text-lg">
              Powered by Gemini 2.5 and Google 3D Spatial Computing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1: AI Oracle */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 hover:border-cyan-500/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cpu className="text-cyan-400" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">
                Step 1: AI Financial Oracle
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Our Gemini-powered engine analyzes your constraints, forecasts
                10-year yields, and structures your optimal ERU tokenomics
                before a single panel is mounted.
              </p>
            </div>

            {/* Step 2: Digital Twin */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 hover:border-blue-500/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="text-blue-400" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">
                Step 2: 3D Digital Twin
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Experience your physical asset in a 1:1 immersive 3D space.
                Validated by Google Maps Photorealistic 3D Tiles and Cesium
                architecture.
              </p>
            </div>

            {/* Step 3: Assetization */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 hover:border-purple-500/30 transition-all duration-500 group">
              <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Coins className="text-purple-400" size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">
                Step 3: ERU Assetization
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your solar output is minted into Energy Revenue Units (ERU).
                Liquidate for emergency cash, or hold to hedge against rising
                utility rates.
              </p>
            </div>

            {/* Large banner display area */}
            <div className="col-span-1 md:col-span-3 bg-gradient-to-br from-zinc-900/80 to-black border border-white/5 rounded-[2rem] p-8 md:p-12 relative overflow-hidden group flex flex-col md:flex-row items-center justify-between min-h-[250px]">
              <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

              <div className="relative z-10 max-w-xl mb-8 md:mb-0">
                <h3 className="text-3xl font-bold mb-4">
                  Stop Buying Hardware.
                  <br />
                  Start Mining Assets.
                </h3>
                <p className="text-gray-400">
                  Join the decentralized energy grid. Manage your portfolio
                  directly from your personalized Helios Dashboard.
                </p>
              </div>

              <div className="relative z-10">
                <button
                  onClick={goToCustomization}
                  className="bg-white text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-2"
                >
                  Enter the App <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-black border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-600 text-xs font-medium uppercase tracking-widest">
          <p className="flex items-center gap-2">
            <Activity size={14} className="text-cyan-500" />
            Built for KitaHack 2026 • Bohemian Hacker
          </p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-cyan-400 transition-colors">
              Manifesto
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              Smart Contract
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* 🌟 WHITEPAPER / MANIFESTO MODAL                             */}
      {/* ========================================================= */}
      {showWhitepaper && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_0_80px_rgba(6,182,212,0.15)] relative animate-in zoom-in-95 scrollbar-none">
            {/* close button */}
            <button
              onClick={() => setShowWhitepaper(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors z-10"
            >
              <X size={24} />
            </button>

            {/* content area */}
            <div className="p-8 md:p-16 relative">
              {/* decorative halo */}
              <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none"></div>

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                  KitaHack 2026 Vision Document
                </div>

                <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12 tracking-tight">
                  The Helios Protocol.
                </h2>

                <div className="space-y-12">
                  {/* Problem Statement */}
                  <section>
                    <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                      <span className="w-8 h-[1px] bg-cyan-500/50"></span> THE
                      PROBLEM
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed font-light">
                      Homeowners face a "Blind Gamble" when adopting solar
                      energy. Traditional installations are treated as{' '}
                      <strong>sunk costs</strong> (hardware purchases) rather
                      than <strong>liquid investments</strong>. Furthermore,
                      unpredictable life events (moving, having kids, EV
                      purchases) create financial anxiety, locking users into
                      inflexible 10-20 year grid constraints.
                    </p>
                  </section>

                  {/* The Solution */}
                  <section>
                    <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                      <span className="w-8 h-[1px] bg-blue-500/50"></span> OUR
                      SOLUTION
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed font-light mb-6">
                      Helios transitions solar from a{' '}
                      <strong className="text-white">Hardware Expense</strong>{' '}
                      to a <strong className="text-white">Digital Asset</strong>
                      . We built an end-to-end FinTech engine powered by spatial
                      computing and AI.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                        <h4 className="text-white font-bold mb-2">
                          1. AI Spatial Discovery
                        </h4>
                        <p className="text-gray-400 text-sm">
                          Gemini 2.5 cross-references life events with Google
                          Maps 3D data to calculate hardware feasibility and
                          10-year yield projections.
                        </p>
                      </div>
                      <div className="bg-white/5 border border-white/5 p-6 rounded-2xl">
                        <h4 className="text-white font-bold mb-2">
                          2. ERU Assetization
                        </h4>
                        <p className="text-gray-400 text-sm">
                          Every kWh generated mints an Energy Revenue Unit
                          (ERU). A fully liquid token that can be held as an
                          inflation hedge or liquidated instantly for fiat cash.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* The Future */}
                  <section>
                    <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                      <span className="w-8 h-[1px] bg-purple-500/50"></span> THE
                      IMPACT
                    </h3>
                    <p className="text-gray-300 text-lg leading-relaxed font-light">
                      By democratizing energy and providing real-time liquidity,
                      Helios eliminates the barrier to entry for green energy.
                      We are building the backbone of the decentralized,
                      homeowner-owned electrical grid.
                    </p>
                  </section>
                </div>

                <div className="mt-16 pt-8 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => {
                      setShowWhitepaper(false);
                      goToCustomization();
                    }}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  >
                    Experience the dApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
