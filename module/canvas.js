import * as dom from './dom.js';
import { state } from './state.js';

export const ctx = dom.canvas.getContext('2d', { willReadFrequently: true });
let drawCropOverlayCallback = () => {};

export function registerCropDrawer(drawer) {
    drawCropOverlayCallback = drawer;
}

export function setInfo(text) {
    document.getElementById('info').textContent = text;
  }
  

export function redraw() {
    ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    if (!state.imgLoaded) {
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Drag and drop an image', dom.canvas.width / 2, dom.canvas.height / 2);
        return;
    }

    const { currentW, currentH, naturalW, naturalH, img } = state;
    const cw = dom.canvas.width, ch = dom.canvas.height;
    const scale = Math.min(cw / currentW, ch / currentH);
    const dw = currentW * scale, dh = currentH * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;

    ctx.drawImage(img, 0, 0, naturalW, naturalH, dx, dy, dw, dh);

    if (state.crop.active) {
        drawCropOverlayCallback(ctx);
    }
}

export function fitCanvasToWrap() {
    const rect = dom.canvasWrap.getBoundingClientRect();
    dom.canvas.width = rect.width;
    dom.canvas.height = rect.height;
    redraw();
}

export function getCanvasImagePosition() {
    const { currentW, currentH } = state;
    const cw = dom.canvas.width, ch = dom.canvas.height;
    const scale = Math.min(cw / currentW, ch / currentH);
    return {
        x: (cw - (currentW * scale)) / 2,
        y: (ch - (currentH * scale)) / 2,
        scale: scale
    };
}

export function initCanvas() {
    window.addEventListener('resize', fitCanvasToWrap);
    fitCanvasToWrap();
}