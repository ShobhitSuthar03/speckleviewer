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
    } else {
      // Show "Please Select Project" message when no URL is provided
      showSelectProjectPrompt();
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

  if (!modelUrl || modelUrl.trim() === '') {
    console.log("No model URL provided - showing select project prompt");
    showSelectProjectPrompt();
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
    
    console.log("Model loaded successfully!");
    // Clear any existing select project prompt
    clearSelectProjectPrompt();
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

// Show "Please Select Project" prompt when no URL is available
function showSelectProjectPrompt(): void {
  const container = document.getElementById("speckle");
  if (!container) return;

  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #ffffff;
      font-family: Arial, sans-serif;
      text-align: center;
      background: linear-gradient(135deg, #2c3e50, #34495e);
    ">
      <div style="
        background: rgba(0, 0, 0, 0.7);
        padding: 40px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        margin: 20px;
      ">
        <div style="
          font-size: 48px;
          margin-bottom: 20px;
          opacity: 0.8;
        ">📊</div>
        <h2 style="
          margin: 0 0 15px 0;
          font-size: 24px;
          font-weight: 300;
          color: #ecf0f1;
        ">Please Select Project</h2>
        <p style="
          margin: 0;
          font-size: 16px;
          color: #bdc3c7;
          line-height: 1.5;
        ">Select a project in Qlik to view the 3D model here</p>
      </div>
    </div>
  `;
}

// Clear the select project prompt (called when model loads successfully)
function clearSelectProjectPrompt(): void {
  const container = document.getElementById("speckle");
  if (!container) return;
  
  // Reset container to empty state for the viewer
  container.innerHTML = '';
}


// Initialize the viewer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Starting Speckle Viewer initialization...");
  initViewer();
});

