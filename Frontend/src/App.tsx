import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CustomizationPage from "./pages/CustomizationPage";
import SimulationPage from "./pages/SimulationPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/customization" element={<CustomizationPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
    </Routes>
  );
}

export default App;
