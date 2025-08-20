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
      // Don't constrain panning - let users see all content
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

export { initializePanzoom, destroyPanzoom, resetPanzoom };