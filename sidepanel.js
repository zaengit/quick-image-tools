import * as dom from './module/dom.js';
import { state } from './module/state.js';
import { setInfo, updateResizeInputs } from './module/ui.js';
import { initCanvas, redraw, registerCropDrawer } from './module/canvas.js';
import { initImageLoader } from './module/imageLoader.js';
import { initCrop, resetCrop, drawCropOverlay } from './module/crop.js';
import { initResize } from './module/resize.js';
import { initExporter } from './module/export.js';

function handleReset() {
    if (!state.imgLoaded || !state.originalImage) return;

    state.img = state.originalImage;
    state.naturalW = state.originalImage.naturalWidth;
    state.naturalH = state.originalImage.naturalHeight;
    state.currentW = state.originalImage.naturalWidth;
    state.currentH = state.originalImage.naturalHeight;
    
    updateResizeInputs(state.currentW, state.currentH);
    resetCrop(true);
    setInfo('Image has been reset to original.');
    redraw();
}

function initialize() {
    registerCropDrawer(drawCropOverlay);

    initCanvas();
    initImageLoader();
    initCrop();
    initResize();
    initExporter();
    
    dom.resetBtn.addEventListener('click', handleReset);
    
    setInfo('Ready. drag and drop an image');
    redraw();

    dom.cropTabBtn.addEventListener('click', () => {
        dom.cropTabBtn.classList.add('active');
        dom.resizeTabBtn.classList.remove('active');
        dom.cropTabContent.classList.remove('hidden');
        dom.resizeTabContent.classList.add('hidden');
    });

    dom.resizeTabBtn.addEventListener('click', () => {
        dom.cropTabBtn.classList.remove('active');
        dom.resizeTabBtn.classList.add('active');
        dom.cropTabContent.classList.add('hidden');
        dom.resizeTabContent.classList.remove('hidden');
    });
}

// Start the application once the DOM is ready
document.addEventListener('DOMContentLoaded', initialize);