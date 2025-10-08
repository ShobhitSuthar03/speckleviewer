# Speckle Viewer Basic Setup

A basic implementation of the Speckle Viewer for 3D model visualization.

## Features

- 3D model viewing with Speckle Viewer
- Camera controls (orbit, zoom, pan)
- Object selection
- Responsive design

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

3. **Start the Development Server**
   ```bash
   npm start
   ```

4. **Open in Browser**
   Navigate to `http://localhost:8080` in your web browser.

## Development

- **Watch Mode**: Run `npm run dev` to automatically rebuild on file changes
- **Serve Only**: Run `npm run serve` to serve files without building

## Project Structure

```
├── src/
│   └── index.ts          # Main TypeScript file
├── dist/                 # Compiled JavaScript (generated)
├── index.html           # HTML container
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Customization

To load your own Speckle model, modify the `modelUrl` variable in `src/index.ts`:

```typescript
const modelUrl = "YOUR_SPECKLE_MODEL_URL_HERE";
```

## Controls

- **Mouse**: Orbit around the model
- **Scroll**: Zoom in/out
- **Right-click + drag**: Pan the view

## Requirements

- Node.js 16+ 
- Modern web browser with WebGL support
- Internet connection (for loading Speckle models)
