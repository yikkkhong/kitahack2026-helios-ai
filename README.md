# Solar Lifecycle Management System ☀️

Helios AI transforms rooftop solar from a static depreciating hardware into a liquid, appreciating Real World Asset (RWA)

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

Helios AI operates in **three core stages**:

### Step 1: Asset Creation (Customization)

Users establish their "Mining Rig" capacity.
Instead of complex lifestyle surveys, users select their physical hardware setup to determine their Total Token Cap (Mining Potential):

- Roof Mount (High Cap): For landed properties, maximizing asset potential
- Balcony/Plug & Play (Low Cap): For apartments, lowering the entry barrier
- System Output: Calculates the Total Token Allocation and Base Monthly Yield

### Step 2: Simulation Engine

Interactive simulation allows users to:
- Adjust future timelines via slider
- Simulate demand reduction scenarios
- Model ROI volatility
- View Solar Portfolio valuation changes
- Compare system configurations

This engine dynamically recalculates projected returns using:
- Solar irradiance data
- Energy pricing assumptions
- Household demand models
- Risk-adjusted modifiers

### Step 3: Implementation Logic

Users explore:
- System reconfiguration possibilities
- Panel removal or scaling
- Conceptual asset transfer scenarios
- Subscription model adjustments

The platform demonstrates how solar systems adapt under real-life changes.

---

## 🚀 Key Differentiator

Helios AI is **not just a solar calculator**—it's a Solar Lifecycle Management System designed to:

- Reduce adoption anxiety
- Increase long-term flexibility
- Introduce liquidity thinking into residential solar

**We shift the question from:**
> "Should I install solar?"

**to:**
> "How should I manage solar as an adaptive asset?"

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React + TypeScript, Vite, Tailwind CSS |
| **Backend** | Firebase Cloud Functions, Firestore |
| **3D & Geospatial** | CesiumJS, Google Maps API, Google Photorealistic |
| **Solar Data** | Google Solar API |
| **AI Engine** | Gemini API |
| **Hosting** | Firebase |

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

- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **Firebase CLI** — install with: `npm install -g firebase-tools`
- **Google Cloud account** with the following APIs enabled:
  - Solar API
  - Maps JavaScript API
  - Places API
  - Geocoding API
  - Gemini API

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

Open two terminal windows:

**Terminal 1 — Firebase Emulators:**
```bash
npm run build --prefix functions
firebase emulators:start
```

**Terminal 2 — Frontend Dev Server:**
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

## Development Workflow

- **Frontend Development** — Changes auto-reload via Vite's Hot Module Replacement (HMR)
- **Backend Development** — Use Firebase emulator for local testing
- **Database** — Access Firestore via emulator at `http://localhost:4000`

---

## Common Issues & Troubleshooting

| Issue | Solution |
|-------|----------|
| `CORS error when calling Google APIs` | Ensure your Google Cloud API keys have proper domain restrictions set |
| `Firestore emulator not starting` | Run `firebase emulators:start` with `--inspect-functions` flag to debug |
| `Cesium models not loading` | Verify that `public/models/` contains all required 3D model files |

---

## Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Commit your changes: `git commit -m 'Add amazing feature'`
3. Push to the branch: `git push origin feature/amazing-feature`
4. Open a pull request

---

## License

This project is part of the **KITA Hackathon 2026** Initiative.

---

## Support

For issues, questions, or feedback:
- Open an issue on GitHub
- Review the [Firebase documentation](https://firebase.google.com/docs)
- Check the [Google Solar API guide](https://developers.google.com/maps/documentation/solar)
