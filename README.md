# End to End Solar Assistant ☀️

Democratizing solar energy for every household. **Helios AI** is an intelligent solar assessment platform that empowers homeowners to make informed decisions about solar energy adoption.

## The Problem

Most households don't know if solar energy is right for them:
- *Is my roof suitable for solar panels?*
- *How much can I save?*
- *What system should I install?*

Our AI-powered platform turns this uncertainty into clear, actionable insights tailored to your home and location.

---

## Features

- **🔍 Solar Potential Analysis** - Evaluate your location's solar viability using AI and geospatial data
- **📊 System Simulation** - Model solar system performance, efficiency, and energy production
- **⚙️ Smart Customization** - Design tailored solar systems based on your roof, energy needs, and budget
- **🗺️ Interactive Mapping** - Visualize solar radiation, grid analysis, and infrastructure on dynamic 3D maps

---

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS
- **Backend:** Firebase Cloud Functions (Node.js), Firestore
- **Mapping & 3D:** Cesium.js, Google Maps API, Google Photorealistic
- **AI:** Gemini API for solar analysis and recommendations
- **Hosting:** Firebase

---

## Project Structure

```
kitahack-helios-ai-2/
├── Frontend/              # React web application
│   ├── src/
│   │   ├── pages/        # Main application pages
│   │   ├── firebase.tsx  # Firebase configuration
│   │   └── App.tsx       # Root component
│   └── package.json
├── functions/            # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts     # Main function endpoints
│   │   └── gemini.ts    # Gemini API integration
│   └── package.json
├── firestore.rules       # Database security rules
└── firebase.json         # Firebase configuration
```

---

## Prerequisites

Before getting started, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Google Cloud account** with:
  - Solar API enabled
  - Maps JavaScript API enabled
  - Places API enabled
  - Geocoding API enabled
  - Gemini API enabled

---

## Getting Started

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd Frontend
npm install

# Install backend dependencies
cd ../functions
npm install
```

### 2. Set Up Firebase & Environment Variables

Create a `.env` file in the `functions/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_maps_api_key
```

### 3. Run Development Environment

**Terminal 1 - Firebase Emulators:**
```bash
npm run build --prefix functions
firebase emulators:start
```

**Terminal 2 - Frontend Dev Server:**
```bash
cd Frontend
npm run dev
```

The app will be available at `http://localhost:5173`

---

## API Integration

| API | Purpose |
|-----|---------|
| **Solar API** | Calculates solar potential, irradiance, and panel generation for any location |
| **Google Maps API** | Provides location context and routing |
| **Places API** | Geocoding and address autocomplete for location search |
| **Geocoding API** | Converts addresses to coordinates and vice versa |
| **Gemini API** | Generates AI-powered solar recommendations and analysis |

---

## Building & Deployment

### Deploy Backend Functions

```bash
firebase deploy --only functions
```

### Build Frontend for Production

```bash
cd Frontend
npm run build
```

### Deploy Full Application

```bash
firebase deploy
```

---

## Development Workflow

- **Frontend Development:** Changes auto-reload via Vite's HMR
- **Backend Development:** Use Firebase emulator for local testing
- **Database:** Access Firestore via emulator at `http://localhost:4000`

---

## Common Issues & Troubleshooting

**Issue:** `CORS error when calling Google APIs`
- *Solution:* Ensure your Google Cloud API keys have proper domain restrictions set

**Issue:** `Firestore emulator not starting`
- *Solution:* Run `firebase emulators:start` with `--inspect-functions` to debug

**Issue:** `Cesium models not loading`
- *Solution:* Check that `public/models/` contains required 3D model files

---

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

---

## License

This project is part of the KITA Hackathon 2026 Initiative.

---

## Support

For issues, questions, or feedback:
- Open an issue on GitHub
- Review Firebase setup guides
