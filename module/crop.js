import * as dom from './dom.js';
import { state } from './state.js';
import { redraw, getCanvasImagePosition } from './canvas.js';
import { setInfo } from './ui.js';
import { loadImageFromURL } from './imageLoader.js';

let isPointerDown = false;

// Convert canvas coordinates to image coordinates
function canvasToImageCoords(canvasX, canvasY) {
    if (!state.imgLoaded) return { x: canvasX, y: canvasY };
    
    const { x: imageX, y: imageY, scale } = getCanvasImagePosition();
    const imagePixelX = (canvasX - imageX) / scale;
    const imagePixelY = (canvasY - imageY) / scale;
    
    return {
        x: Math.max(0, Math.min(imagePixelX, state.currentW)),
        y: Math.max(0, Math.min(imagePixelY, state.currentH))
    };
}

// Convert image coordinates to canvas coordinates
function imageToCanvasCoords(imageX, imageY) {
    if (!state.imgLoaded) return { x: imageX, y: imageY };
    
    const { x: offsetX, y: offsetY, scale } = getCanvasImagePosition();
    return {
        x: imageX * scale + offsetX,
        y: imageY * scale + offsetY
    };
}

// Get handles in canvas coordinates for display
function getHandles(imageRect) {
    const { x: canvasX, y: canvasY } = imageToCanvasCoords(imageRect.x, imageRect.y);
    const { x: canvasX2, y: canvasY2 } = imageToCanvasCoords(imageRect.x + imageRect.w, imageRect.y + imageRect.h);
    
    const cx = (canvasX + canvasX2) / 2;
    const cy = (canvasY + canvasY2) / 2;
    
    return [
        { name: 'nw', x: canvasX, y: canvasY }, 
        { name: 'n', x: cx, y: canvasY },
        { name: 'ne', x: canvasX2, y: canvasY }, 
        { name: 'e', x: canvasX2, y: cy },
        { name: 'se', x: canvasX2, y: canvasY2 }, 
        { name: 's', x: cx, y: canvasY2 },
        { name: 'sw', x: canvasX, y: canvasY2 }, 
        { name: 'w', x: canvasX, y: cy }
    ];
}

function canvasPointFromEvent(ev) {
    const r = dom.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function onPointerDown(ev) {
    if (!state.crop.active || !state.imgLoaded) return;
    
    ev.preventDefault();
    dom.canvas.setPointerCapture(ev.pointerId);
    isPointerDown = true;
    const canvasPt = canvasPointFromEvent(ev);

    if (!state.crop.rect) {
        // Start new crop rectangle in image coordinates
        const imagePt = canvasToImageCoords(canvasPt.x, canvasPt.y);
        state.crop.dragHandle = 'se';
        state.crop.rect = { x: imagePt.x, y: imagePt.y, w: 1, h: 1 };
        state.crop.startPoint = imagePt;
        return;
    }

    const handles = getHandles(state.crop.rect);
    let foundHandle = false;
    
    for (const h of handles) {
        if (Math.hypot(canvasPt.x - h.x, canvasPt.y - h.y) <= 8) {
            state.crop.dragHandle = h.name;
            state.crop.startPoint = canvasToImageCoords(canvasPt.x, canvasPt.y);
            foundHandle = true;
            break;
        }
    }
    
    if (!foundHandle) {
        // Check if clicking inside crop area (convert to canvas coords for hit test)
        const { x: canvasRectX, y: canvasRectY } = imageToCanvasCoords(state.crop.rect.x, state.crop.rect.y);
        const { x: canvasRectX2, y: canvasRectY2 } = imageToCanvasCoords(
            state.crop.rect.x + state.crop.rect.w, 
            state.crop.rect.y + state.crop.rect.h
        );
        
        if (canvasPt.x >= canvasRectX && canvasPt.x <= canvasRectX2 && 
            canvasPt.y >= canvasRectY && canvasPt.y <= canvasRectY2) {
            // Move existing rectangle
            state.crop.dragHandle = 'move';
            const imagePt = canvasToImageCoords(canvasPt.x, canvasPt.y);
            state.crop.offsetX = imagePt.x - state.crop.rect.x;
            state.crop.offsetY = imagePt.y - state.crop.rect.y;
        } else {
            // Start new rectangle
            const imagePt = canvasToImageCoords(canvasPt.x, canvasPt.y);
            state.crop.dragHandle = 'se';
            state.crop.rect = { x: imagePt.x, y: imagePt.y, w: 1, h: 1 };
            state.crop.startPoint = imagePt;
        }
    }
}

function onPointerMove(ev) {
    if (!isPointerDown || !state.crop.rect || !state.imgLoaded) {
        onPointerHover(ev);
        return;
    }

    ev.preventDefault();
    const canvasPt = canvasPointFromEvent(ev);
    const imagePt = canvasToImageCoords(canvasPt.x, canvasPt.y);
    const r = state.crop.rect;
    const maxW = state.currentW;
    const maxH = state.currentH;

    if (state.crop.dragHandle === 'move') {
        const newX = imagePt.x - state.crop.offsetX;
        const newY = imagePt.y - state.crop.offsetY;
        
        r.x = Math.max(0, Math.min(newX, maxW - r.w));
        r.y = Math.max(0, Math.min(newY, maxH - r.h));
    } else {
        let newRect = { ...r };
        
        switch (state.crop.dragHandle) {
            case 'n':
                newRect.y = Math.max(0, Math.min(imagePt.y, r.y + r.h - 1));
                newRect.h = r.y + r.h - newRect.y;
                break;
            case 's':
                newRect.h = Math.max(1, Math.min(imagePt.y - r.y, maxH - r.y));
                break;
            case 'w':
                newRect.x = Math.max(0, Math.min(imagePt.x, r.x + r.w - 1));
                newRect.w = r.x + r.w - newRect.x;
                break;
            case 'e':
                newRect.w = Math.max(1, Math.min(imagePt.x - r.x, maxW - r.x));
                break;
            case 'nw':
                newRect.x = Math.max(0, Math.min(imagePt.x, r.x + r.w - 1));
                newRect.y = Math.max(0, Math.min(imagePt.y, r.y + r.h - 1));
                newRect.w = r.x + r.w - newRect.x;
                newRect.h = r.y + r.h - newRect.y;
                break;
            case 'ne':
                newRect.y = Math.max(0, Math.min(imagePt.y, r.y + r.h - 1));
                newRect.w = Math.max(1, Math.min(imagePt.x - r.x, maxW - r.x));
                newRect.h = r.y + r.h - newRect.y;
                break;
            case 'sw':
                newRect.x = Math.max(0, Math.min(imagePt.x, r.x + r.w - 1));
                newRect.w = r.x + r.w - newRect.x;
                newRect.h = Math.max(1, Math.min(imagePt.y - r.y, maxH - r.y));
                break;
            case 'se':
                newRect.w = Math.max(1, Math.min(imagePt.x - r.x, maxW - r.x));
                newRect.h = Math.max(1, Math.min(imagePt.y - r.y, maxH - r.y));
                break;
        }
        
        if (newRect.w >= 1 && newRect.h >= 1) {
            Object.assign(r, newRect);
        }
    }

    // Final bounds checking in image space
    r.x = Math.max(0, Math.min(r.x, maxW - r.w));
    r.y = Math.max(0, Math.min(r.y, maxH - r.h));
    r.w = Math.max(1, Math.min(r.w, maxW - r.x));
    r.h = Math.max(1, Math.min(r.h, maxH - r.y));

    // Update input fields with image pixel values
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
    if (!state.imgLoaded) {
        setInfo('Load an image first.');
        return;
    }
    
    state.isApplyingCrop = true;
    state.crop.active = true;
    
    if (dom.toggleCropBtn) {
        dom.toggleCropBtn.textContent = 'Exit Crop Mode';
    }
    if (dom.applyCropBtn) {
        dom.applyCropBtn.disabled = false;
    }
    
    // Create initial crop rectangle in image coordinates (60% of image size)
    if (!state.crop.rect && state.currentW && state.currentH) {
        const w = Math.round(state.currentW * 0.6);
        const h = Math.round(state.currentH * 0.6);
        state.crop.rect = {
            x: Math.round((state.currentW - w) / 2),
            y: Math.round((state.currentH - h) / 2),
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
        const { naturalW, naturalH, currentW, currentH, img } = state;
        const r = state.crop.rect;

        // Convert from displayed image coordinates to natural image coordinates
        const scaleToNatural = naturalW / currentW;
        
        const naturalSX = r.x * scaleToNatural;
        const naturalSY = r.y * scaleToNatural;
        const naturalSW = r.w * scaleToNatural;
        const naturalSH = r.h * scaleToNatural;

        // Clamp to natural image bounds
        const clampedSX = Math.max(0, Math.min(naturalSX, naturalW - 1));
        const clampedSY = Math.max(0, Math.min(naturalSY, naturalH - 1));
        const clampedSW = Math.max(1, Math.min(naturalSW, naturalW - clampedSX));
        const clampedSH = Math.max(1, Math.min(naturalSH, naturalH - clampedSY));

        // Use input values or default to crop area size
        const targetW = parseInt(dom.cropW?.value) || Math.round(clampedSW);
        const targetH = parseInt(dom.cropH?.value) || Math.round(clampedSH);

        const off = document.createElement('canvas');
        off.width = targetW;
        off.height = targetH;
        const offCtx = off.getContext('2d');
        
        if (!offCtx) {
            throw new Error('Failed to create canvas context');
        }
        
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        
        // Draw cropped portion
        offCtx.drawImage(img, 
            clampedSX, clampedSY, clampedSW, clampedSH, 
            0, 0, targetW, targetH                      
        );

        loadImageFromURL(off.toDataURL('image/png'));
        setInfo(`Crop applied: ${targetW}×${targetH} (from ${Math.round(clampedSW)}×${Math.round(clampedSH)} source area)`);
        
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

export function drawCropOverlay(ctx) {
    const rect = state.crop.rect;
    if (!rect || !state.crop.active || !state.imgLoaded) return;

    // Convert image coordinates to canvas coordinates for drawing
    const { x: canvasX, y: canvasY } = imageToCanvasCoords(rect.x, rect.y);
    const { x: canvasX2, y: canvasY2 } = imageToCanvasCoords(rect.x + rect.w, rect.y + rect.h);
    const canvasW = canvasX2 - canvasX;
    const canvasH = canvasY2 - canvasY;

    ctx.save();
    
    // Draw overlay (darken area outside crop)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.rect(0, 0, dom.canvas.width, dom.canvas.height);
    ctx.rect(canvasX, canvasY, canvasW, canvasH);
    ctx.fill('evenodd');
    
    // Draw crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(canvasX, canvasY, canvasW, canvasH);
    
    // Draw guide lines if enabled
    if (dom.showGuides && dom.showGuides.checked) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Rule of thirds lines
        for (let i = 1; i < 3; i++) {
            const x = canvasX + canvasW * i / 3;
            const y = canvasY + canvasH * i / 3;
            
            ctx.moveTo(x, canvasY);
            ctx.lineTo(x, canvasY + canvasH);
            
            ctx.moveTo(canvasX, y);
            ctx.lineTo(canvasX + canvasW, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    ctx.restore();
    
    // Draw resize handles
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

    // Width input handler
    if (dom.cropW) {
        dom.cropW.addEventListener('input', () => {
            if (state.crop.rect) {
                const w = parseInt(dom.cropW.value);
                if (!isNaN(w) && w > 0) {
                    const maxW = state.currentW - state.crop.rect.x;
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
    
    // Height input handler
    if (dom.cropH) {
        dom.cropH.addEventListener('input', () => {
            if (state.crop.rect) {
                const h = parseInt(dom.cropH.value);
                if (!isNaN(h) && h > 0) {
                    const maxH = state.currentH - state.crop.rect.y;
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
    
    // Mouse/pointer event listeners
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
    if (!state.crop.active || !state.crop.rect || isPointerDown || !state.imgLoaded) {
        if (!isPointerDown) {
            dom.canvas.style.cursor = 'default';
        }
        return;
    }
    
    const canvasPt = canvasPointFromEvent(ev);
    const handles = getHandles(state.crop.rect);
    
    // Check if hovering over a handle
    for (const h of handles) {
        if (Math.hypot(canvasPt.x - h.x, canvasPt.y - h.y) <= 8) {
            dom.canvas.style.cursor = getCursorForHandle(h.name);
            return;
        }
    }
    
    // Check if hovering inside crop area
    const { x: canvasRectX, y: canvasRectY } = imageToCanvasCoords(state.crop.rect.x, state.crop.rect.y);
    const { x: canvasRectX2, y: canvasRectY2 } = imageToCanvasCoords(
        state.crop.rect.x + state.crop.rect.w, 
        state.crop.rect.y + state.crop.rect.h
    );
    
    if (canvasPt.x >= canvasRectX && canvasPt.x <= canvasRectX2 && 
        canvasPt.y >= canvasRectY && canvasPt.y <= canvasRectY2) {
        dom.canvas.style.cursor = 'move';
    } else {
        dom.canvas.style.cursor = 'crosshair';
    }
}