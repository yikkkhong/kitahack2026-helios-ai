# End to End Solar Assistant

**Goal:** Make solar energy more accessible to every users

## Features

- **Solar Potential Analysis** - Calculate solar potential for any location
- **System Simulation** - Simulate solar system performance and efficiency
- **Customization** - Customize solar system designs for your needs
- **Interactive Mapping** - Visualize solar data with interactive maps

# TO RUN

## Development Server

Start the Vite frontend server:

```bash
cd Frontend
npm run dev
```

## Firebase Setup

Build and start Firebase emulators:

```bash
npm run build --prefix functions
firebase emulators:start
```

## Deploy Updates

To deploy function updates to Firebase:

```bash
firebase deploy --only functions
```

## APIs

- Solar API
- Maps JavaScript API
- Places API
- Geocoding API

## Installation

Required dependencies:

```bash
npm install @react-google-maps/api lucide-react cesium
npm install vite-plugin-cesium -D
```
