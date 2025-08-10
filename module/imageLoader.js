import * as dom from './dom.js';
import { state } from './state.js';
import { setInfo, updateResizeInputs } from './ui.js';
import { redraw } from './canvas.js';
import { resetCrop } from './crop.js';

export function loadImageFromURL(url) {
	const newImg = new Image();
	
    newImg.crossOrigin = 'anonymous';
	newImg.onload = () => {
		if (!url.startsWith('data:image')) {
			state.originalImage = newImg;
		}

        state.img = newImg;
        state.imgLoaded = true;
        state.naturalW = newImg.naturalWidth;
        state.naturalH = newImg.naturalHeight;
        state.currentW = newImg.naturalWidth;
        state.currentH = newImg.naturalHeight;

        updateResizeInputs(state.currentW, state.currentH);
        setInfo(`Loaded ${state.naturalW}×${state.naturalH}`);
        resetCrop(true);
        redraw();
    };

    newImg.onerror = () => setInfo('Failed to load image (CORS or format error).');
    newImg.src = url;
}

function checkQueryImage() {
    const params = new URLSearchParams(location.search);
    const imgUrl = params.get('img');
    if (imgUrl) {
        loadImageFromURL(imgUrl);
    }
}

function setupCanvasDragAndDrop(canvasEl) {
    canvasEl.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        canvasEl.style.border = '2px dashed #0078d7';
    });

    canvasEl.addEventListener('dragleave', (ev) => {
        ev.preventDefault();
        canvasEl.style.border = '';
    });

    canvasEl.addEventListener('drop', (ev) => {
        ev.preventDefault();
        canvasEl.style.border = '';
        if (ev.dataTransfer.files.length > 0) {
            const file = ev.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                loadImageFromURL(url);
            } else {
                setInfo('Please drop an image file.');
            }
        }
    });

    canvasEl.addEventListener('click', () => {
        if (state.isApplyingCrop) return;
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            if (input.files.length > 0) {
                const url = URL.createObjectURL(input.files[0]);
                loadImageFromURL(url);
            }
        };
        input.click();
    });
}

export function initImageLoader() {
    const canvas = dom.canvas;
    setupCanvasDragAndDrop(canvas);

    checkQueryImage();
}
