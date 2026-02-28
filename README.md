# Helios Protocol - The Decentralized Solar FinTech Platform ☀️

**Helios** transforms rooftop solar from a static, depreciating hardware expense into a liquid, appreciating Real World Asset (RWA).

## 🌍 The Problem

Solar energy is often treated as a "Blind Bet." Homeowners invest five figures upfront while facing uncertain futures:

- Shrinking household size
- Lifestyle changes
- Relocation
- Energy demand reduction

When electricity demand drops, excess solar generation becomes underutilized — turning long-term investment into hidden inefficiency. The core issue is not installation; it is **uncertainty management**.

---

## 💡 Our Solution

Helios AI introduces the concept of the "Financial Battery":
Instead of buying expensive physical batteries to store electricity, we use a DeFi-inspired Liquidity Pool to store value.

1. **Hardware as Mining Rig**: Your solar panels are the "miners."
2. **Surplus as Revenue**: Excess energy sold to the grid (TNB) generates cash that flows into a community Liquidity Pool
3. **Helios Token as Stock**: Users hold Tokens backed by this real cash flow. As the pool grows, the Token price appreciates

We shift the question from "How much money can I save?" to "How much is my solar asset worth today?

Solar is no longer static infrastructure—it becomes an **adaptive financial instrument**.

---

## 🧠 System Architecture

Helios operates via three core protocols:

### Step 1: AI Financial Oracle (Risk Assessment)

Instead of talking to salesmen, users input their location and budget. Our Gemini 2.5 Engine cross-references the data with the Google Solar API to calculate the "Fully Installed Blended Cost" and strictly validates ROI viability. If a budget is too low to yield economic sense, the Oracle recommends purchasing liquid ERUs instead of physical hardware.

### Step 2: 3D Digital Twin (Verification)

Before a single panel is mounted, users explore a 1:1 immersive 3D spatial blueprint of their future asset. This is rendered in real-time using Google Photorealistic 3D Tiles and CesiumJS, allowing users to verify layout feasibility (View, Edit, Simulate) and build ultimate trust before dispatching contractors.

### Step 3: ERU Assetization Ledger (DeFi Engine)

The core Web3/FinTech dashboard. Your hardware becomes a mining rig, minting Energy Revenue Units (ERUs) for every kWh generated. Users can consult the Gemini AI Robo-Advisor for future uncertainties (e.g., "I am buying an EV next month"). The AI instantly recalculates their 12-month trajectory and provides actionable hedging strategies, securely recorded on our Firebase Immutable Ledger.

---

## 🚀 Key Differentiator

Helios is **not just a solar calculator or a simulation tool**—it is a Decentralized FinTech Protocol designed to:

- **Eliminate the "Sunk Cost" fear**: Transitioning physical hardware into liquid assets.
- **Provide AI-Driven Hedging**: Gemini acts as a personal energy hedge fund manager.
- **Democratize the Grid**: Allowing anyone, even those without roofs, to hold ERUs.

**We shift the paradigm from:**

> "Should I install solar panels?"
> **to:**
> "How do I manage my solar asset portfolio?"

---

## 🛠 Tech Stack

| Component           | Technology                                       |
| ------------------- | ------------------------------------------------ |
| **Frontend**        | React + TypeScript, Vite, Tailwind CSS           |
| **Backend**         | Firebase Cloud Functions, Firestore              |
| **3D & Geospatial** | CesiumJS, Google Maps API, Google Photorealistic |
| **Solar Data**      | Google Solar API                                 |
| **AI Engine**       | Gemini API                                       |
| **Hosting**         | Firebase                                         |

---

## 🧩 Why This Matters

Residential solar adoption is not blocked by technology—it's blocked by **uncertainty**.

Helios AI introduces:

- Dynamic simulation
- Risk modeling
- Lifecycle flexibility

Turning solar into a manageable long-term decision rather than a fixed gamble.

---

## Prerequisites

Before getting started, ensure you have:

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn** package manager
- **Firebase CLI** — install with: `npm install -g firebase-tools`
- **Google Cloud account** with the following APIs enabled:
  - Solar API
  - Map Tiles API
  - Maps JavaScript API
  - Places API
  - Geocoding API
  - Gemini API (via Google AI Studio)

---

## Getting Started

First, clone the repository and install the required packages for both the frontend and backend

### 1. Clone & Install Dependencies

```bash
# Install frontend dependencies
cd Frontend
npm install

# Install backend dependencies
cd ../functions
npm install
```

### 2. Set Up Firebase & Environment Variables

Create a `.env` file in the `functions/` directory (for backend/Firebase functions) and/or the Frontend/ directory (if your React app needs direct API access via Vite).

```env
# For Backend (functions/.env)
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_maps_api_key_here

# For Frontend (Frontend/.env)
VITE_GOOGLE_MAPS_API_KEY=your_maps_api_key_here
VITE_FIREBASE_CONFIG="..."
```

### 3. Run Development Environment

Open two terminal windows to run the emulators and the frontend server simultaneously:

**Terminal 1 — Start Firebase Emulators:**

```bash
npm run build --prefix functions
firebase emulators:start
```

**Terminal 2 — Start Frontend Dev Server:**

```bash
cd Frontend
npm run dev
```

The app will be available at `http://localhost:5173`

---

## API Integration Map

| API                 | Purpose within Helios Protocol                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Solar API**       | Calculates solar potential, irradiance, and panel generation for any location                           |
| **Google Maps API** | Provides the interactive map interface and geospatial context                                           |
| **Places API**      | Enables autocomplete functionality for users searching for their property addresses                     |
| **Geocoding API**   | Converts user-inputted addresses into precise latitude/longitude coordinates                            |
| **Gemini API**      | Powers the "Smart Liquidity Advisor," processing user events to generate AI-driven financial strategies |

---

## Building & Deployment

### Deploy Backend (Cloud Functions)

```bash
firebase deploy --only functions
```

### Build & Deploy Frontend (Firebase Hosting)

```bash
cd Frontend
npm run build
cd ..
firebase deploy --only hosting
```

### Deploy Full Application

```bash
firebase deploy
```

## Development Workflow

- **Frontend Development** — Changes auto-reload via Vite's Hot Module Replacement (HMR)
- **Backend/Database** — Test Cloud Functions and Firestore locally using the Firebase Emulator Suite (usually accessible at http://localhost:4000).

---

## Common Issues & Troubleshooting

| Issue                                 | Solution                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `CORS error when calling Google APIs` | Ensure your Google Cloud API keys have proper domain restrictions set   |
| `Firestore emulator not starting`     | Run `firebase emulators:start` with `--inspect-functions` flag to debug |
| `Cesium models not loading`           | Verify that `public/models/` contains all required 3D model files       |

---

## Acknowledgments

Special thanks to Ms. Noor Zuhaili Md Yasin (Lecturer, INTI International University) for the academic guidance and support throughout this project

---

## License

This project was developed for the KITA Hackathon 2026 Initiative.
