import * as dom from './dom.js';
import { state } from './state.js';
import { redraw, getCanvasImagePosition } from './canvas.js';
import { setInfo } from './ui.js';
import { loadImageFromURL } from './imageLoader.js';

let isPointerDown = false;

function getHandles(rect) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    return [
        { name: 'nw', x: rect.x, y: rect.y }, 
        { name: 'n', x: cx, y: rect.y },
        { name: 'ne', x: rect.x + rect.w, y: rect.y }, 
        { name: 'e', x: rect.x + rect.w, y: cy },
        { name: 'se', x: rect.x + rect.w, y: rect.y + rect.h }, 
        { name: 's', x: cx, y: rect.y + rect.h },
        { name: 'sw', x: rect.x, y: rect.y + rect.h }, 
        { name: 'w', x: rect.x, y: cy }
    ];
}

function canvasPointFromEvent(ev) {
    const r = dom.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function onPointerDown(ev) {
    if (!state.crop.active) return;
    
    ev.preventDefault();
    dom.canvas.setPointerCapture(ev.pointerId);
    isPointerDown = true;
    const pt = canvasPointFromEvent(ev);

    if (!state.crop.rect) {
        state.crop.dragHandle = 'se';
        state.crop.rect = { x: pt.x, y: pt.y, w: 1, h: 1 };
        state.crop.startPoint = { x: pt.x, y: pt.y };
        return;
    }

    const handles = getHandles(state.crop.rect);
    let foundHandle = false;
    
    for (const h of handles) {
        if (Math.hypot(pt.x - h.x, pt.y - h.y) <= 8) {
            state.crop.dragHandle = h.name;
            state.crop.startPoint = { x: pt.x, y: pt.y };
            foundHandle = true;
            break;
        }
    }
    
    if (!foundHandle) {
        const { x, y, w, h } = state.crop.rect;
        if (pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h) {
            state.crop.dragHandle = 'move';
            state.crop.offsetX = pt.x - x;
            state.crop.offsetY = pt.y - y;
        } else {
            state.crop.dragHandle = 'se';
            state.crop.rect = { x: pt.x, y: pt.y, w: 1, h: 1 };
            state.crop.startPoint = { x: pt.x, y: pt.y };
        }
    }
}

function onPointerMove(ev) {
    if (!isPointerDown || !state.crop.rect) {
        onPointerHover(ev);
        return;
    }

    ev.preventDefault();
    const pt = canvasPointFromEvent(ev);
    const r = state.crop.rect;
    const canvasW = dom.canvas.width;
    const canvasH = dom.canvas.height;

    if (state.crop.dragHandle === 'move') {
        const newX = pt.x - state.crop.offsetX;
        const newY = pt.y - state.crop.offsetY;
        
        r.x = Math.max(0, Math.min(newX, canvasW - r.w));
        r.y = Math.max(0, Math.min(newY, canvasH - r.h));
    } else {
        const startPoint = state.crop.startPoint;
        let newRect = { ...r };
        
        switch (state.crop.dragHandle) {
            case 'n':
                newRect.y = Math.max(0, Math.min(pt.y, r.y + r.h - 1));
                newRect.h = r.y + r.h - newRect.y;
                break;
            case 's':
                newRect.h = Math.max(1, Math.min(pt.y - r.y, canvasH - r.y));
                break;
            case 'w':
                newRect.x = Math.max(0, Math.min(pt.x, r.x + r.w - 1));
                newRect.w = r.x + r.w - newRect.x;
                break;
            case 'e':
                newRect.w = Math.max(1, Math.min(pt.x - r.x, canvasW - r.x));
                break;
            case 'nw':
                newRect.x = Math.max(0, Math.min(pt.x, r.x + r.w - 1));
                newRect.y = Math.max(0, Math.min(pt.y, r.y + r.h - 1));
                newRect.w = r.x + r.w - newRect.x;
                newRect.h = r.y + r.h - newRect.y;
                break;
            case 'ne':
                newRect.y = Math.max(0, Math.min(pt.y, r.y + r.h - 1));
                newRect.w = Math.max(1, Math.min(pt.x - r.x, canvasW - r.x));
                newRect.h = r.y + r.h - newRect.y;
                break;
            case 'sw':
                newRect.x = Math.max(0, Math.min(pt.x, r.x + r.w - 1));
                newRect.w = r.x + r.w - newRect.x;
                newRect.h = Math.max(1, Math.min(pt.y - r.y, canvasH - r.y));
                break;
            case 'se':
                newRect.w = Math.max(1, Math.min(pt.x - r.x, canvasW - r.x));
                newRect.h = Math.max(1, Math.min(pt.y - r.y, canvasH - r.y));
                break;
        }
        
        if (newRect.w >= 1 && newRect.h >= 1) {
            Object.assign(r, newRect);
        }
    }

    r.x = Math.max(0, Math.min(r.x, canvasW - r.w));
    r.y = Math.max(0, Math.min(r.y, canvasH - r.h));
    r.w = Math.max(1, Math.min(r.w, canvasW - r.x));
    r.h = Math.max(1, Math.min(r.h, canvasH - r.y));

    if (dom.cropW) dom.cropW.value = Math.round(r.w);
    if (dom.cropH) dom.cropH.value = Math.round(r.h);

    dom.canvas.style.cursor = getCursorForHandle(state.crop.dragHandle);
    redraw();
}

function onPointerUp(ev) {
    if (!isPointerDown) return;
    
    ev.preventDefault();
    isPointerDown = false;
    state.crop.dragHandle = null;
    state.crop.startPoint = null;
    state.crop.offsetX = 0;
    state.crop.offsetY = 0;
    
    if (dom.canvas.hasPointerCapture && dom.canvas.hasPointerCapture(ev.pointerId)) {
        dom.canvas.releasePointerCapture(ev.pointerId);
    }
    
    onPointerHover(ev);
}

function startCropMode() {
    state.isApplyingCrop = true;
    state.crop.active = true;
    
    if (dom.toggleCropBtn) {
        dom.toggleCropBtn.textContent = 'Exit Crop Mode';
    }
    if (dom.applyCropBtn) {
        dom.applyCropBtn.disabled = false;
    }
    
    if (!state.crop.rect && dom.canvas.width && dom.canvas.height) {
        const w = Math.round(dom.canvas.width * 0.6);
        const h = Math.round(dom.canvas.height * 0.6);
        state.crop.rect = {
            x: Math.round((dom.canvas.width - w) / 2),
            y: Math.round((dom.canvas.height - h) / 2),
            w, h
        };
    }
    
    if (state.crop.rect) {
        if (dom.cropW) dom.cropW.value = Math.round(state.crop.rect.w);
        if (dom.cropH) dom.cropH.value = Math.round(state.crop.rect.h);
    }
    
    redraw();
}

function exitCropMode() {
    state.isApplyingCrop = false;
    state.crop.active = false;
    
    if (dom.toggleCropBtn) {
        dom.toggleCropBtn.textContent = 'Start Crop';
    }
    if (dom.applyCropBtn) {
        dom.applyCropBtn.disabled = true;
    }
    
    dom.canvas.style.cursor = 'default';
    redraw();
}

export function resetCrop(fullReset = false) {
    if (fullReset) {
        state.crop.rect = null;
    }
    if (state.crop.active) {
        exitCropMode();
    }
}

function applyCrop() {
    if (!state.crop.rect || !state.imgLoaded || !state.img) {
        setInfo('Cannot apply crop: no crop area or image loaded');
        return;
    }
    
    try {
        const { x: dx, y: dy, scale } = getCanvasImagePosition();
        const { naturalW, naturalH, currentW, currentH, img } = state;
        const r = state.crop.rect;

        const scaleToNatural = (naturalW / currentW) / scale;
        
        const naturalSX = Math.max(0, (r.x - dx) * scaleToNatural);
        const naturalSY = Math.max(0, (r.y - dy) * scaleToNatural);
        const naturalSW = r.w * scaleToNatural;
        const naturalSH = r.h * scaleToNatural;

        const clampedSX = Math.max(0, Math.min(naturalSX, naturalW - 1));
        const clampedSY = Math.max(0, Math.min(naturalSY, naturalH - 1));
        const clampedSW = Math.max(1, Math.min(naturalSW, naturalW - clampedSX));
        const clampedSH = Math.max(1, Math.min(naturalSH, naturalH - clampedSY));

        const targetW = parseInt(dom.cropW.value) || Math.round(clampedSW);
        const targetH = parseInt(dom.cropH.value) || Math.round(clampedSH);

        const off = document.createElement('canvas');
        off.width = targetW;
        off.height = targetH;
        const offCtx = off.getContext('2d');
        
        if (!offCtx) {
            throw new Error('Failed to create canvas context');
        }
        
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        
        offCtx.drawImage(img, 
            clampedSX, clampedSY, clampedSW, clampedSH, 
            0, 0, targetW, targetH                      
        );

        loadImageFromURL(off.toDataURL('image/png'));
        setInfo(`Crop applied: ${targetW}×${targetH} (exact size)`);
        
        exitCropMode();
        
    } catch (error) {
        console.error('Error applying crop:', error);
        setInfo('Error applying crop: ' + error.message);
    }
}

function updateCropInputs() {
    if (!state.crop.rect) return;
    
    const r = state.crop.rect;
    if (dom.cropW) dom.cropW.value = Math.round(r.w);
    if (dom.cropH) dom.cropH.value = Math.round(r.h);
}

function setupCropInputs() {
    if (dom.cropW) {
        dom.cropW.addEventListener('input', () => {
            if (state.crop.rect) {
                const w = parseInt(dom.cropW.value);
                if (!isNaN(w) && w > 0) {
                    const maxW = dom.canvas.width - state.crop.rect.x;
                    state.crop.rect.w = Math.min(w, maxW);
                    dom.cropW.value = state.crop.rect.w;
                    redraw();
                }
            }
        });
        
        dom.cropW.addEventListener('blur', () => {
            if (state.crop.rect && dom.cropW.value !== state.crop.rect.w.toString()) {
                dom.cropW.value = Math.round(state.crop.rect.w);
            }
        });
    }
    
    if (dom.cropH) {
        dom.cropH.addEventListener('input', () => {
            if (state.crop.rect) {
                const h = parseInt(dom.cropH.value);
                if (!isNaN(h) && h > 0) {
                    const maxH = dom.canvas.height - state.crop.rect.y;
                    state.crop.rect.h = Math.min(h, maxH);
                    dom.cropH.value = state.crop.rect.h;
                    redraw();
                }
            }
        });
        
        dom.cropH.addEventListener('blur', () => {
            if (state.crop.rect && dom.cropH.value !== state.crop.rect.h.toString()) {
                dom.cropH.value = Math.round(state.crop.rect.h);
            }
        });
    }
}

export function drawCropOverlay(ctx) {
    const rect = state.crop.rect;
    if (!rect || !state.crop.active) return;

    ctx.save();
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.rect(0, 0, dom.canvas.width, dom.canvas.height);
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.fill('evenodd');
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    
    if (dom.showGuides && dom.showGuides.checked) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let i = 1; i < 3; i++) {
            const x = rect.x + rect.w * i / 3;
            const y = rect.y + rect.h * i / 3;
            
            ctx.moveTo(x, rect.y);
            ctx.lineTo(x, rect.y + rect.h);
            
            ctx.moveTo(rect.x, y);
            ctx.lineTo(rect.x + rect.w, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    ctx.restore();
    
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    const handles = getHandles(rect);
    handles.forEach(h => {
        ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
        ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
    });
}

export function initCrop() {
    if (!state.crop) {
        state.crop = {
            active: false,
            rect: null,
            dragHandle: null,
            startPoint: null,
            offsetX: 0,
            offsetY: 0
        };
    }

    if (dom.toggleCropBtn) {
        dom.toggleCropBtn.addEventListener('click', () => {
            if (!state.imgLoaded) {
                setInfo('Load an image first.');
                return;
            }
            state.crop.active ? exitCropMode() : startCropMode();
        });
    }
    
    if (dom.applyCropBtn) {
        dom.applyCropBtn.addEventListener('click', applyCrop);
    }
    
    if (dom.showGuides) {
        dom.showGuides.addEventListener('change', redraw);
    }

    if (dom.cropW) {
        dom.cropW.addEventListener('input', () => {
            if (state.crop.rect) {
                const w = parseInt(dom.cropW.value);
                if (!isNaN(w) && w > 0) {
                    state.crop.rect.w = Math.min(w, dom.canvas.width - state.crop.rect.x);
                    redraw();
                }
            }
        });
    }
    
    if (dom.cropH) {
        dom.cropH.addEventListener('input', () => {
            if (state.crop.rect) {
                const h = parseInt(dom.cropH.value);
                if (!isNaN(h) && h > 0) {
                    state.crop.rect.h = Math.min(h, dom.canvas.height - state.crop.rect.y);
                    redraw();
                }
            }
        });
    }
    
    dom.canvas.addEventListener('pointerdown', onPointerDown);
    dom.canvas.addEventListener('pointermove', onPointerMove);
    dom.canvas.addEventListener('pointerup', onPointerUp);
    
    dom.canvas.addEventListener('mousemove', onPointerHover);
}

function getCursorForHandle(handleName) {
    switch (handleName) {
        case 'n': 
        case 's': 
            return 'ns-resize';
        case 'e': 
        case 'w': 
            return 'ew-resize';
        case 'ne': 
        case 'sw': 
            return 'nesw-resize';
        case 'nw': 
        case 'se': 
            return 'nwse-resize';
        case 'move': 
            return 'move';
        default: 
            return 'default';
    }
}

function onPointerHover(ev) {
    if (!state.crop.active || !state.crop.rect || isPointerDown) {
        if (!isPointerDown) {
            dom.canvas.style.cursor = 'default';
        }
        return;
    }
    
    const pt = canvasPointFromEvent(ev);
    const handles = getHandles(state.crop.rect);
    
    for (const h of handles) {
        if (Math.hypot(pt.x - h.x, pt.y - h.y) <= 8) {
            dom.canvas.style.cursor = getCursorForHandle(h.name);
            return;
        }
    }
    
    const { x, y, w, h } = state.crop.rect;
    if (pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h) {
        dom.canvas.style.cursor = 'move';
    } else {
        dom.canvas.style.cursor = 'crosshair';
    }
}