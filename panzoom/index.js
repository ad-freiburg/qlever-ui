import Panzoom from '@panzoom/panzoom';

let panzoomInstance = null;

function initializePanzoom() {
  const treeViewport = document.getElementById('tree-viewport');
  const resultTree = document.getElementById('result-tree');
  
  if (treeViewport && resultTree && !panzoomInstance) {
    console.log('Initializing panzoom on tree-viewport:', treeViewport);
    
    panzoomInstance = Panzoom(resultTree, {
      maxScale: 5,
      minScale: 0.1,
      cursor: 'grab',
      step: 0.1,
      // Allow free panning for unrestricted scrolling
      contain: false
    });
    
    // Enable zooming with mouse wheel on the viewport
    treeViewport.addEventListener('wheel', panzoomInstance.zoomWithWheel);
    
    // Reset zoom when double-clicking on the viewport
    treeViewport.addEventListener('dblclick', () => {
      panzoomInstance.reset();
    });
    
    console.log('Panzoom initialized successfully');
  }
}

function destroyPanzoom() {
  if (panzoomInstance) {
    const treeViewport = document.getElementById('tree-viewport');
    if (treeViewport) {
      treeViewport.removeEventListener('wheel', panzoomInstance.zoomWithWheel);
      treeViewport.removeEventListener('dblclick', panzoomInstance.reset);
    }
    panzoomInstance.destroy();
    panzoomInstance = null;
    console.log('Panzoom destroyed');
  }
}

function resetPanzoom() {
  if (panzoomInstance) {
    panzoomInstance.reset();
  }
}

function centerTree() {
  if (panzoomInstance) {
    const treeViewport = document.getElementById('tree-viewport');
    const resultTree = document.getElementById('result-tree');
    
    if (treeViewport && resultTree) {
      // Zoom out to minimum scale first
      panzoomInstance.zoom(0.1);
      
      // Get the actual tree content (Treant container)
      const treantContainer = resultTree.querySelector('.Treant');
      if (treantContainer) {
        // Get dimensions
        const viewportRect = treeViewport.getBoundingClientRect();
        const treeRect = treantContainer.getBoundingClientRect();
        
        // Calculate center position
        const centerX = (viewportRect.width - treeRect.width) / 2;
        const centerY = Math.max(20, (viewportRect.height - treeRect.height) / 2); // Min 20px from top
        
        // Pan to center the tree
        panzoomInstance.pan(centerX, centerY);
      }
    }
  }
}

export { initializePanzoom, destroyPanzoom, resetPanzoom, centerTree };