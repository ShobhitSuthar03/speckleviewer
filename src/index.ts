import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  CameraController,
  SelectionExtension
} from "@speckle/viewer";

// Global variables for viewer and controls
let viewer: Viewer | null = null;
let showStats = true;
let currentModelUrl: string | null = null;

// Initialize the Speckle Viewer
async function initViewer(): Promise<void> {
  try {
    // Get the HTML container
    const container = document.getElementById("speckle");
    const loadingElement = document.getElementById("loading");
    
    if (!container) {
      throw new Error("Container element not found");
    }

    // Configure the viewer parameters
    const params = { ...DefaultViewerParams };
    params.showStats = showStats;
    params.verbose = true;

    // Create and initialize the viewer
    viewer = new Viewer(container, params);
    await viewer.init();

    // Add extensions
    viewer.createExtension(CameraController);
    viewer.createExtension(SelectionExtension);

    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = "none";
    }

    // Check for model URL in query parameters
    const queryModelUrl = getModelUrlFromQuery();
    if (queryModelUrl) {
      // Pre-fill the input and load the model
      const urlInput = document.getElementById("modelUrl") as HTMLInputElement;
      if (urlInput) {
        urlInput.value = queryModelUrl;
      }
      await loadModel(queryModelUrl);
    }

    console.log("Speckle Viewer initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize Speckle Viewer:", error);
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.textContent = "Failed to load Speckle Viewer. Check console for details.";
      loadingElement.style.color = "#e74c3c";
    }
  }
}

// Load a Speckle model by URL
async function loadModel(modelUrl: string): Promise<void> {
  if (!viewer) {
    console.error("Viewer not initialized");
    return;
  }

  try {
    console.log("Loading model:", modelUrl);
    
    const urls = await UrlHelper.getResourceUrls(modelUrl);
    console.log("Found", urls.length, "resource URLs");
    
    // Clear existing models first
    viewer.getWorldTree().clear();
    
    for (const url of urls) {
      const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
      await viewer.loadObject(loader, true);
    }
    
    currentModelUrl = modelUrl;
    console.log("Model loaded successfully!");
  } catch (error) {
    console.error("Failed to load model:", error);
    alert("Failed to load model. Please check the URL and try again.");
  }
}

// Get model URL from query parameters
function getModelUrlFromQuery(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('model') || urlParams.get('url');
}

// Load custom model from user input
function loadCustomModel(): void {
  const urlInput = document.getElementById("modelUrl") as HTMLInputElement;
  const modelUrl = urlInput.value.trim();
  
  if (!modelUrl) {
    alert("Please enter a model URL");
    return;
  }
  
  if (!isValidSpeckleUrl(modelUrl)) {
    alert("Please enter a valid Speckle model URL");
    return;
  }
  
  loadModel(modelUrl);
}

// Validate Speckle URL
function isValidSpeckleUrl(url: string): boolean {
  // Basic validation for Speckle URLs
  return url.includes('speckle.') && (url.includes('/models/') || url.includes('/streams/'));
}

// Global functions for HTML controls
function resetCamera(): void {
  if (viewer) {
    // Get the CameraController extension and call its default() method
    const cameraController = viewer.getExtension(CameraController);
    if (cameraController) {
      cameraController.default();
      console.log("Camera reset");
    }
  }
}

function toggleStats(): void {
  if (viewer) {
    showStats = !showStats;
    // Access the stats through the viewer's internal stats property
    const stats = (viewer as any).stats;
    if (stats) {
      stats.domElement.style.display = showStats ? "block" : "none";
    }
    console.log("Stats visibility:", showStats ? "on" : "off");
  }
}

// Initialize the viewer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Starting Speckle Viewer initialization...");
  initViewer();
});

// Make functions globally available for HTML buttons
(window as any).loadCustomModel = loadCustomModel;
(window as any).resetCamera = resetCamera;
(window as any).toggleStats = toggleStats;
