import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CustomizationPage from "./pages/CustomizationPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/customization" element={<CustomizationPage />} />
    </Routes>
  );
}

export default App;
