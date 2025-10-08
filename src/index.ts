import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  CameraController,
  SelectionExtension
} from "@speckle/viewer";

// Global variables for viewer
let viewer: Viewer | null = null;
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
    params.showStats = false; // Disable stats by default
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
    alert("Viewer not initialized. Please refresh the page and try again.");
    return;
  }

  try {
    console.log("Loading model:", modelUrl);
    
    // Show loading indicator
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "block";
      loadingElement.textContent = "Loading model...";
    }
    
    const urls = await UrlHelper.getResourceUrls(modelUrl);
    console.log("Found", urls.length, "resource URLs");
    
    if (urls.length === 0) {
      throw new Error("No resource URLs found for this model");
    }
    
    // Clear existing models first (if any)
    try {
      const worldTree = viewer.getWorldTree();
      if (worldTree && worldTree.root && worldTree.root.children.length > 0) {
        // Remove all existing children
        const children = [...worldTree.root.children];
        children.forEach(child => {
          if (worldTree.removeNode) {
            worldTree.removeNode(child, true);
          }
        });
      }
    } catch (clearError) {
      console.warn("Could not clear existing models:", clearError);
      // Continue with loading new model
    }
    
    for (const url of urls) {
      console.log("Loading resource:", url);
      const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
      await viewer.loadObject(loader, true);
      console.log("Resource loaded successfully");
    }
    
    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = "none";
    }
    
    currentModelUrl = modelUrl;
    console.log("Model loaded successfully!");
  } catch (error) {
    console.error("Failed to load model:", error);
    
    // Hide loading indicator and show error
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "block";
      loadingElement.textContent = "Failed to load model. Check console for details.";
      loadingElement.style.color = "#e74c3c";
    }
    
    alert(`Failed to load model: ${(error as Error).message || String(error)}. Please check the URL and try again.`);
  }
}

// Get model URL from query parameters
function getModelUrlFromQuery(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('model') || urlParams.get('url');
}

// Validate Speckle URL
function isValidSpeckleUrl(url: string): boolean {
  // Basic validation for Speckle URLs
  return url.includes('speckle.') && (url.includes('/models/') || url.includes('/streams/'));
}

// Initialize the viewer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Starting Speckle Viewer initialization...");
  initViewer();
});

