import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  CameraController,
  SelectionExtension,
  FilteringExtension
} from "@speckle/viewer";

// Global variables for viewer
let viewer: Viewer | null = null;
let filteringExtension: FilteringExtension | null = null;

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
    filteringExtension = viewer.createExtension(FilteringExtension);

    // Hide loading indicator
    if (loadingElement) {
      loadingElement.style.display = "none";
    }

    // Check for model URL in query parameters
    const queryModelUrl = getModelUrlFromQuery();
    if (queryModelUrl) {
      await loadModel(queryModelUrl);
    } else {
      // Show URL input form when no URL is provided
      showUrlInputForm();
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
    
    console.log("Model loaded successfully!");
    
    // Send success message back to Qlik extension
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "SPECKLE_VIEWER_READY",
        source: "speckle-viewer",
        modelUrl: modelUrl
      }, "*");
    }
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
    
    // Send error message back to Qlik extension
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "SPECKLE_VIEWER_ERROR",
        source: "speckle-viewer",
        error: (error as Error).message || String(error)
      }, "*");
    }
  }
}

// Get model URL from query parameters
function getModelUrlFromQuery(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('model') || urlParams.get('url');
}

// Validate Speckle URL
function isValidSpeckleUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  
  // Basic validation for Speckle URLs
  return url.includes('speckle.') && (url.includes('/models/') || url.includes('/streams/'));
}

// Show URL input form
function showUrlInputForm(): void {
  const urlInputContainer = document.getElementById('url-input-container');
  const urlInput = document.getElementById('url-input') as HTMLInputElement;
  
  if (urlInputContainer) {
    urlInputContainer.style.display = 'block';
  }
  
  // Add Enter key support
  if (urlInput) {
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadModelFromInput();
      }
    });
  }
}

// Hide URL input form
function hideUrlInputForm(): void {
  const urlInputContainer = document.getElementById('url-input-container');
  if (urlInputContainer) {
    urlInputContainer.style.display = 'none';
  }
}

// Show error message
function showErrorMessage(message: string): void {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

// Hide error message
function hideErrorMessage(): void {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
}

// Load model from URL input (called from HTML button)
async function loadModelFromInput(): Promise<void> {
  const urlInput = document.getElementById('url-input') as HTMLInputElement;
  const loadButton = document.getElementById('load-button') as HTMLButtonElement;
  
  if (!urlInput || !loadButton) return;
  
  const modelUrl = urlInput.value.trim();
  
  // Validate URL
  if (!isValidSpeckleUrl(modelUrl)) {
    showErrorMessage('Please enter a valid Speckle model URL (e.g., https://app.speckle.systems/projects/.../models/...)');
    return;
  }
  
  // Disable button and show loading
  loadButton.disabled = true;
  loadButton.textContent = 'Loading...';
  hideErrorMessage();
  
  try {
    await loadModel(modelUrl);
    hideUrlInputForm();
  } catch (error) {
    showErrorMessage(`Failed to load model: ${(error as Error).message || String(error)}`);
  } finally {
    // Re-enable button
    loadButton.disabled = false;
    loadButton.textContent = 'Load Model';
  }
}


// Filter objects by IFC GUID using Speckle FilteringExtension
function filterByGuid(guid: string): void {
  if (!viewer || !filteringExtension) {
    console.error("Viewer or FilteringExtension not initialized");
    return;
  }

  try {
    console.log(`Filtering objects by GUID: ${guid}`);
    
    // Get all objects from the world tree to find matching GUIDs
    const worldTree = viewer.getWorldTree();
    if (!worldTree || !worldTree.root) {
      console.error("World tree not available");
      return;
    }

    // Collect object IDs that match the GUID
    const matchingObjectIds: string[] = [];

    function traverseNode(node: any) {
      if (node.model && node.model.raw) {
        const raw = node.model.raw;
        
        // Check if this object has the target GUID
        if (raw.GlobalId === guid || raw.id === guid) {
          matchingObjectIds.push(node.model.id);
          console.log(`Found matching object: ${raw.Name || raw.id} (ID: ${node.model.id})`);
        }
      }

      // Recursively check children
      if (node.children) {
        node.children.forEach((child: any) => traverseNode(child));
      }
    }

    // Start traversal from root
    if (worldTree.root.children) {
      worldTree.root.children.forEach((child: any) => traverseNode(child));
    }

    if (matchingObjectIds.length > 0) {
      // Use Speckle's isolateObjects method to show only matching objects
      const filteringState = filteringExtension.isolateObjects(
        matchingObjectIds,
        "guid-filter", // stateKey for this filter
        true, // includeDescendants
        true  // ghost other objects
      );

      console.log(`Filtered: ${matchingObjectIds.length} objects isolated using Speckle FilteringExtension`);
      console.log("Filtering state:", filteringState);

      // Send feedback to Qlik extension
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "SPECKLE_FILTER_APPLIED",
          source: "speckle-viewer",
          guid: guid,
          visibleCount: matchingObjectIds.length,
          hiddenCount: filteringState.hiddenObjects?.length || 0,
          filteringState: filteringState
        }, "*");
      }
    } else {
      console.log(`No objects found with GUID: ${guid}`);
      
      // Send feedback to Qlik extension
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "SPECKLE_VIEWER_ERROR",
          source: "speckle-viewer",
          error: `No objects found with GUID: ${guid}`
        }, "*");
      }
    }

  } catch (error) {
    console.error("Error filtering by GUID:", error);
    
    // Send error message back to Qlik extension
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "SPECKLE_VIEWER_ERROR",
        source: "speckle-viewer",
        error: `Filtering failed: ${(error as Error).message || String(error)}`
      }, "*");
    }
  }
}

// Clear all filters and show all objects using Speckle FilteringExtension
function clearFilter(): void {
  if (!viewer || !filteringExtension) {
    console.error("Viewer or FilteringExtension not initialized");
    return;
  }

  try {
    console.log("Clearing all filters using Speckle FilteringExtension");
    
    // Use Speckle's resetFilters method to clear all filters
    const filteringState = filteringExtension.resetFilters();

    console.log("All filters cleared using Speckle FilteringExtension");
    console.log("Filtering state:", filteringState);

    // Send feedback to Qlik extension
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "SPECKLE_FILTER_CLEARED",
        source: "speckle-viewer",
        filteringState: filteringState
      }, "*");
    }

  } catch (error) {
    console.error("Error clearing filter:", error);
    
    // Send error message back to Qlik extension
    if (window.parent !== window) {
      window.parent.postMessage({
        type: "SPECKLE_VIEWER_ERROR",
        source: "speckle-viewer",
        error: `Clear filter failed: ${(error as Error).message || String(error)}`
      }, "*");
    }
  }
}

// Make functions globally accessible
(window as any).loadModelFromInput = loadModelFromInput;
(window as any).filterByGuid = filterByGuid;
(window as any).clearFilter = clearFilter;

// Listen for messages from Qlik extension
window.addEventListener("message", (event) => {
  console.log("Received message:", event.data);
  
  if (event.data && event.data.type === "SPECKLE_URL_UPDATE" && event.data.modelUrl) {
    console.log("Received URL update from Qlik extension:", event.data.modelUrl);
    loadModel(event.data.modelUrl);
  }
  
  if (event.data && event.data.type === "SPECKLE_FILTER_BY_GUID" && event.data.guid) {
    console.log("Received filter request for GUID:", event.data.guid);
    filterByGuid(event.data.guid);
  }
  
  if (event.data && event.data.type === "SPECKLE_CLEAR_FILTER") {
    console.log("Received clear filter request");
    clearFilter();
  }
});

// Initialize the viewer when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Starting Speckle Viewer initialization...");
  initViewer();
});

