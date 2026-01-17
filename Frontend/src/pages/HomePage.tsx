import { useState, useEffect } from "react"; // React 不需要显式 import React in newer versions
import { Sun, ArrowRight, ShieldCheck, Zap, Cpu, Menu, X } from "lucide-react";
//import HomePage from "./pages/HomePage";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

  function goToCustomization() {
    navigate("/customization");
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden selection:bg-blue-500 selection:text-white">
      {/* --- Navbar --- */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-black/80 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
            <Sun className="text-blue-400" /> HELIOS{" "}
            <span className="text-gray-400">AI</span>
          </div>

          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-300">
            <a href="#" className="hover:text-white transition-colors">
              Solar Roof
            </a>
            <a href="#" className="hover:text-white transition-colors">
              AI Analysis
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Powerwall
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Commercial
            </a>
          </div>

          <button className="hidden md:block bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition-all">
            Start Project
          </button>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-hero-pattern bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

        <div className="relative z-10 text-center px-4 mt-20">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            Power Your Future.
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-10 font-light">
            The world's first end-to-end AI solar solution. <br />
            From pixel-perfect design to grid activation.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={goToCustomization}
              className="bg-white/10 backdrop-blur-lg border border-white/20 text-white px-8 py-3 rounded-full font-medium hover:bg-white hover:text-black transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              Design My Roof{" "}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="bg-transparent border border-white/20 text-white px-8 py-3 rounded-full font-medium hover:bg-white/10 transition-all duration-300">
              View Specs
            </button>
          </div>
        </div>
      </section>

      {/* --- Bento Grid Section --- */}
      <section className="py-24 bg-black px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Intelligent Energy.
            </h2>
            <p className="text-gray-400 text-lg">
              Powered by advanced computer vision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="col-span-1 md:col-span-2 bg-zinc-900/50 border border-white/5 rounded-3xl p-8 hover:border-blue-500/30 transition-colors duration-500 group overflow-hidden relative">
              <div className="absolute top-0 right-0 p-10 opacity-20 group-hover:opacity-40 transition-opacity">
                <Cpu size={120} />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
                  <Zap className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-semibold mb-2">
                  AI-Driven Customization
                </h3>
                <p className="text-gray-400 max-w-md">
                  Our algorithm analyzes your roof's satellite imagery to
                  calculate optimal panel placement.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 flex flex-col justify-between hover:border-purple-500/30 transition-colors duration-500">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">
                  Verified Installers
                </h3>
                <p className="text-gray-400">
                  Top-tier local experts handle the hardware.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 hover:border-green-500/30 transition-colors duration-500">
              <div className="h-40 flex items-center justify-center bg-black/40 rounded-xl mb-6 border border-white/5">
                <span className="text-4xl font-mono text-green-400">
                  4.2 kW
                </span>
              </div>
              <h3 className="text-2xl font-semibold mb-2">
                Real-time Monitoring
              </h3>
              <p className="text-gray-400">Track production via our app.</p>
            </div>

            {/* Card 4 */}
            <div className="col-span-1 md:col-span-2 bg-zinc-900/50 border border-white/5 rounded-3xl p-8 relative overflow-hidden group min-h-[300px]">
              <img
                src="https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?q=80&w=2574&auto=format&fit=crop"
                alt="Modern Architecture"
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
              <div className="relative z-10 h-full flex flex-col justify-center">
                <h3 className="text-3xl font-bold mb-2">
                  Designed for the Modern Home.
                </h3>
                <p className="text-gray-300">Sleek. Invisible. Powerful.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-black border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
          <p>© 2026 Helios AI.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white">
              Privacy
            </a>
            <a href="#" className="hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

//export default HomePage;
