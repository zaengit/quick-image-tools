import * as dom from './dom.js';
import { state } from './state.js';
import { setInfo } from './ui.js';
import { loadImageFromURL } from './imageLoader.js';

function applyResize() {
	if (!state.imgLoaded) return setInfo('Load an image first.');
	
	const w = parseInt(dom.resizeW.value, 10);
	const h = parseInt(dom.resizeH.value, 10);
	
	if (!w || !h || w < 1 || h < 1) {
		return setInfo('Enter valid width and height (minimum 1px).');
	}

	if (w > 10000 || h > 10000) {
		return setInfo('Maximum dimensions are 10,000px to prevent memory issues.');
	}

	try {
		const off = document.createElement('canvas');
		off.width = w;
		off.height = h;
		const offCtx = off.getContext('2d');
		
		if (!offCtx) {
			return setInfo('Failed to create canvas context.');
		}
		
		offCtx.imageSmoothingEnabled = true;
		offCtx.imageSmoothingQuality = 'high';
		
		offCtx.clearRect(0, 0, w, h);
		
		offCtx.drawImage(state.img, 0, 0, state.naturalW, state.naturalH, 0, 0, w, h);
		
		const quality = w * h > 1000000 ? 0.9 : 1.0;
		const dataURL = off.toDataURL('image/png');
		
		loadImageFromURL(dataURL);
		setInfo(`Resize applied: ${w}×${h} pixels`);
		
	} catch (error) {
		console.error('Resize error:', error);
		setInfo('Failed to resize image. Try smaller dimensions.');
	}
}

function handleAspectRatio(e) {
	if (!dom.keepAspect.checked || !state.imgLoaded) return;
	
	if (e.target.dataset.updating) return;
	
	const w = parseFloat(dom.resizeW.value) || 0;
	const h = parseFloat(dom.resizeH.value) || 0;
	
	const ratio = state.naturalW / state.naturalH;
	
	const otherInput = e.target === dom.resizeW ? dom.resizeH : dom.resizeW;
	otherInput.dataset.updating = 'true';
	
	if (e.target === dom.resizeW && w > 0) {
		dom.resizeH.value = Math.round(w / ratio);
	} else if (e.target === dom.resizeH && h > 0) {
		dom.resizeW.value = Math.round(h * ratio);
	}
	
	setTimeout(() => {
		delete otherInput.dataset.updating;
	}, 0);
}

function setDimensionsWithAspect(width, height) {
	if (!state.imgLoaded) return;
	
	const ratio = state.naturalW / state.naturalH;
	
	if (width && !height) {
		dom.resizeW.value = Math.round(width);
		dom.resizeH.value = Math.round(width / ratio);
	} else if (height && !width) {
		dom.resizeH.value = Math.round(height);
		dom.resizeW.value = Math.round(height * ratio);
	} else {
		dom.resizeW.value = Math.round(width || state.naturalW);
		dom.resizeH.value = Math.round(height || state.naturalH);
	}
}

function resetToOriginal() {
	if (!state.imgLoaded) return setInfo('Load an image first.');
	
	dom.resizeW.value = state.naturalW;
	dom.resizeH.value = state.naturalH;
	setInfo(`Reset to original size: ${state.naturalW}×${state.naturalH}`);
}

function applyPreset(preset) {
	if (!state.imgLoaded) return setInfo('Load an image first.');
	
	const ratio = state.naturalW / state.naturalH;
	let w, h;
	
	switch (preset) {
		case 'hd':
			w = 1920;
			h = Math.round(w / ratio);
			break;
		case '4k':
			w = 3840;
			h = Math.round(w / ratio);
			break;
		case 'square':
			w = h = Math.min(state.naturalW, state.naturalH);
			break;
		case 'half':
			w = Math.round(state.naturalW / 2);
			h = Math.round(state.naturalH / 2);
			break;
		case 'double':
			w = state.naturalW * 2;
			h = state.naturalH * 2;
			break;
		default:
			return setInfo('Unknown preset.');
	}
	
	dom.resizeW.value = w;
	dom.resizeH.value = h;
	setInfo(`Applied ${preset} preset: ${w}×${h}`);
}

export function initResize() {
	dom.applyResizeBtn.addEventListener('click', applyResize);
	dom.resizeW.addEventListener('input', handleAspectRatio);
	dom.resizeH.addEventListener('input', handleAspectRatio);
	
	dom.resizeW.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') applyResize();
	});
	
	dom.resizeH.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') applyResize();
	});
	
	if (state.imgLoaded) {
		dom.resizeW.value = state.naturalW;
		dom.resizeH.value = state.naturalH;
	}
}

export { setDimensionsWithAspect, resetToOriginal, applyPreset };