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
let isModelLoading = false;
let pendingFilterGuid: string | null = null;
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
    const selectionExtension = viewer.createExtension(SelectionExtension);
    filteringExtension = viewer.createExtension(FilteringExtension);

    // Set up selection event listener for reverse filtering
    setupSelectionListener(selectionExtension);
    
    // Also set up direct click detection on the viewer container
    setupDirectClickDetection(container);

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
    isModelLoading = true; // Set loading flag
    currentModelUrl = modelUrl; // Store current model URL
    
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
    isModelLoading = false; // Clear loading flag
    
    // Apply any pending filter after model is loaded
    if (pendingFilterGuid) {
      console.log("Applying pending filter for GUID:", pendingFilterGuid);
      filterByGuid(pendingFilterGuid);
      pendingFilterGuid = null; // Clear pending filter
    }
    
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
    isModelLoading = false; // Clear loading flag on error
    pendingFilterGuid = null; // Clear pending filter on error
    
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

// Set up selection listener for reverse filtering (3D → Qlik)
function setupSelectionListener(selectionExtension: any): void {
  if (!selectionExtension) {
    console.error("SelectionExtension not available");
    return;
  }

  console.log("Setting up selection listener for reverse filtering");
  console.log("SelectionExtension object:", selectionExtension);

  // Try multiple event approaches
  const eventNames = [
    "selection",
    "select", 
    "objectSelected",
    "onSelection",
    "onSelect",
    "change",
    "update"
  ];

  // Method 1: Try different event names
  eventNames.forEach(eventName => {
    try {
      selectionExtension.on(eventName, (data: any) => {
        console.log(`Selection event '${eventName}' triggered:`, data);
        handleSelectionEvent(data, eventName);
      });
      console.log(`Registered listener for event: ${eventName}`);
    } catch (error) {
      console.log(`Failed to register listener for event: ${eventName}`, error);
    }
  });

  // Method 2: Try direct property access
  if (selectionExtension.selection) {
    console.log("SelectionExtension has selection property:", selectionExtension.selection);
  }

  // Method 3: Try to access the viewer's selection directly
  if (viewer) {
    console.log("Trying to access viewer selection directly");
    
    // Check if viewer has selection methods
    console.log("Checking viewer selection capabilities");
    
    // Try to set up a polling mechanism as fallback
    let lastSelection: any = null;
    setInterval(() => {
      try {
        if (viewer && selectionExtension) {
          // Try different ways to get current selection
          let currentSelection = null;
          
          if (selectionExtension.selection) {
            currentSelection = selectionExtension.selection;
          } else if (typeof selectionExtension.getSelection === 'function') {
            currentSelection = selectionExtension.getSelection();
          } else {
            // Viewer.getSelection() is not available in the type definition
            // Skip trying to access it to avoid TypeScript errors
          }
          
          if (currentSelection && JSON.stringify(currentSelection) !== JSON.stringify(lastSelection)) {
            console.log("Selection changed via polling:", currentSelection);
            handleSelectionEvent(currentSelection, "polling");
            lastSelection = currentSelection;
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    }, 1000); // Poll every second
  }
}

// Set up direct click detection on the viewer container
function setupDirectClickDetection(container: HTMLElement): void {
  console.log("Setting up direct click detection on viewer container");
  
  // Add click event listener to the container
  container.addEventListener('click', (event: MouseEvent) => {
    console.log("Click detected on viewer container:", event);
    
    // Get the click coordinates
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log(`Click coordinates: (${x}, ${y})`);
    
    // Try to get the object at the click position
    if (viewer) {
      try {
        // Use the viewer's raycasting to find objects at click position
        const objects = (viewer as any).getObjectsAt?.(x, y);
        console.log("Objects at click position:", objects);
        
        if (objects && objects.length > 0) {
          const clickedObject = objects[0];
          console.log("Clicked object:", clickedObject);
          
          // Extract GUID from the clicked object
          const guid = extractGuidFromObject(clickedObject);
          
          if (guid) {
            console.log("Extracted GUID from clicked object:", guid);
            
            // Send selection message to Qlik extension
            if (window.parent !== window) {
              window.parent.postMessage({
                type: "SPECKLE_OBJECT_SELECTED",
                source: "speckle-viewer",
                guid: guid,
                objectName: clickedObject.name || clickedObject.Name || "Unknown",
                objectId: clickedObject.id
              }, "*");
            }
          } else {
            console.log("No GUID found in clicked object");
          }
        } else {
          console.log("No objects found at click position");
        }
      } catch (error) {
        console.error("Error getting objects at click position:", error);
        
        // Fallback: try to access the selection extension directly
        try {
          const extensions = (viewer as any).getExtensions?.();
          const selectionExt = extensions.find((ext: any) => ext.constructor.name === 'SelectionExtension');
          if (selectionExt) {
            console.log("Trying to access selection extension directly");
            const currentSelection = selectionExt.selection || selectionExt.getSelection?.();
            if (currentSelection) {
              console.log("Current selection from extension:", currentSelection);
              handleSelectionEvent(currentSelection, "click-fallback");
            }
          }
        } catch (fallbackError) {
          console.error("Fallback selection access failed:", fallbackError);
        }
      }
    }
  });
  
  console.log("Direct click detection setup complete");
}

// Handle selection events from different sources
function handleSelectionEvent(selection: any, eventName: string): void {
  console.log(`Handling selection event '${eventName}':`, selection);
  
  // Handle different selection data formats
  let selectedObjects = [];
  
  if (Array.isArray(selection)) {
    selectedObjects = selection;
  } else if (selection && Array.isArray(selection.objects)) {
    selectedObjects = selection.objects;
  } else if (selection && selection.length !== undefined) {
    selectedObjects = [selection];
  } else if (selection) {
    selectedObjects = [selection];
  }
  
  if (selectedObjects.length > 0) {
    // Get the first selected object
    const selectedObject = selectedObjects[0];
    console.log("Selected object details:", selectedObject);
    
    // Extract IFC GUID from the selected object
    const guid = extractGuidFromObject(selectedObject);
    
    if (guid) {
      console.log("Extracted GUID from selected object:", guid);
      
      // Send selection message to Qlik extension
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "SPECKLE_OBJECT_SELECTED",
          source: "speckle-viewer",
          guid: guid,
          objectName: selectedObject.name || selectedObject.Name || "Unknown",
          objectId: selectedObject.id
        }, "*");
      }
    } else {
      console.log("No GUID found in selected object");
    }
  } else {
    console.log("No objects in selection");
  }
}

// Extract IFC GUID from a selected object
function extractGuidFromObject(object: any): string | null {
  try {
    console.log("Extracting GUID from object:", object);
    
    // Try to get GUID from object properties (matching IFC extractor structure)
    if (object && object.model && object.model.raw) {
      const raw = object.model.raw;
      console.log("Object raw data:", raw);
      
      // Priority 1: IFC GlobalId (primary identifier)
      if (raw.GlobalId && typeof raw.GlobalId === 'string' && raw.GlobalId.trim()) {
        console.log("Found GlobalId:", raw.GlobalId);
        return raw.GlobalId;
      }
      
      // Priority 2: IFC Tag (secondary identifier)
      if (raw.Tag && typeof raw.Tag === 'string' && raw.Tag.trim()) {
        console.log("Found Tag:", raw.Tag);
        return raw.Tag;
      }
      
      // Priority 3: IFC Name (human-readable identifier)
      if (raw.Name && typeof raw.Name === 'string' && raw.Name.trim()) {
        console.log("Found Name:", raw.Name);
        return raw.Name;
      }
      
      // Priority 4: ObjectType (IFC type classification)
      if (raw.ObjectType && typeof raw.ObjectType === 'string' && raw.ObjectType.trim()) {
        console.log("Found ObjectType:", raw.ObjectType);
        return raw.ObjectType;
      }
      
      // Priority 5: Speckle object ID (fallback)
      if (raw.id && typeof raw.id === 'string' && raw.id.length > 10) {
        console.log("Found Speckle ID:", raw.id);
        return raw.id;
      }
    }
    
    // Try to get GUID from object itself (direct properties)
    if (object) {
      // Check direct GlobalId property
      if (object.GlobalId && typeof object.GlobalId === 'string' && object.GlobalId.trim()) {
        console.log("Found direct GlobalId:", object.GlobalId);
        return object.GlobalId;
      }
      
      // Check direct Name property
      if (object.Name && typeof object.Name === 'string' && object.Name.trim()) {
        console.log("Found direct Name:", object.Name);
        return object.Name;
      }
      
      // Check direct id property
      if (object.id && typeof object.id === 'string' && object.id.trim()) {
        console.log("Found direct ID:", object.id);
        return object.id;
      }
    }
    
    console.log("No GUID found in object");
    return null;
  } catch (error) {
    console.error("Error extracting GUID from object:", error);
    return null;
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
    
    // Only reload if the URL is different from the current model
    if (currentModelUrl !== event.data.modelUrl) {
      console.log("URL changed, reloading model");
      loadModel(event.data.modelUrl);
    } else {
      console.log("URL is the same as current model, skipping reload");
    }
  }
  
  if (event.data && event.data.type === "SPECKLE_FILTER_BY_GUID" && event.data.guid) {
    console.log("Received filter request for GUID:", event.data.guid);
    
    if (isModelLoading) {
      console.log("Model is still loading, storing filter for later application:", event.data.guid);
      pendingFilterGuid = event.data.guid;
    } else {
      filterByGuid(event.data.guid);
    }
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

