import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CustomizationPage from "./pages/CustomizationPage";
import VirtualRoomPage from "./pages/VirtualRoomPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/customization" element={<CustomizationPage />} />
      <Route path="/simulation" element={<VirtualRoomPage />} />
    </Routes>
  );
}

export default App;
