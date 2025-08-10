import * as dom from './dom.js';
import { state } from './state.js';
import { setInfo } from './ui.js';
import { redraw } from './canvas.js';

export function updateCanvasPreview() {
    if (!state.imgLoaded) return;

    const mime = dom.formatSelect.value;
    const quality = parseFloat(dom.qualityRange.value);
    
    const { naturalW, naturalH, img } = state;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = naturalW;
    tempCanvas.height = naturalH;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(img, 0, 0, naturalW, naturalH);

    tempCanvas.toBlob(blob => {
        if (!blob) {
            tempCanvas.toBlob(fallbackBlob => {
                if (!fallbackBlob) {
                    redraw();
                    return;
                }
                showCompressedPreview(fallbackBlob);
            }, mime);
            return;
        }
        showCompressedPreview(blob);
        showFileSize(blob);
    }, mime, quality);
}

function showCompressedPreview(blob) {
    const compressedImg = new Image();
    compressedImg.onload = () => {
        const originalImg = state.img;
        
        state.img = compressedImg;
        
        redraw();
        
        URL.revokeObjectURL(compressedImg.src);
        
        setTimeout(() => {
            state.img = originalImg;
        }, 0);
    };
    compressedImg.src = URL.createObjectURL(blob);
}

export function resetCanvasPreview() {
    if (!state.imgLoaded) return;
    redraw();
}

async function downloadImage() {
    if (!state.imgLoaded) return setInfo('Load an image first.');

    const mime = dom.formatSelect.value;
    const quality = parseFloat(dom.qualityRange.value);

    const out = document.createElement('canvas');
    out.width = state.currentW;
    out.height = state.currentH;
    const outCtx = out.getContext('2d');

    outCtx.drawImage(state.img, 0, 0, state.naturalW, state.naturalH, 0, 0, out.width, out.height);

    const supportsQuality = ['image/jpeg', 'image/webp', 'image/avif'].includes(mime);

    out.toBlob(blob => {
        if (!blob) {
            if (supportsQuality) {
                out.toBlob(fallbackBlob => {
                    if (!fallbackBlob) return setInfo('Failed to generate file.');
                    downloadBlob(fallbackBlob, mime);
                }, mime);
            } else {
                return setInfo('Failed to generate file.');
            }
            return;
        }
        downloadBlob(blob, mime);
    }, mime, supportsQuality ? quality : undefined);
}

function showFileSize(blob) {
    const sizeKB = (blob.size / 1024).toFixed(2);
    setInfo(`Preview size: ${sizeKB} KB`);
}

function downloadBlob(blob, mime) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ext = mime.split('/')[1];
    a.href = url;
    a.download = `image-edited.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setInfo('Download started.');
}

export function initExporter() {
    dom.downloadBtn.addEventListener('click', downloadImage);
    
    dom.qualityRange.addEventListener('input', () => {
        // dom.qualityVal.textContent = dom.qualityRange.value;
        const percent = Math.round(dom.qualityRange.value * 100);
        dom.qualityVal.textContent = `${percent}%`;

        updateCanvasPreview();
    });
    
    dom.formatSelect.dispatchEvent(new Event('change'));
}