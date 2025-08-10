import * as dom from './dom.js';

export function setInfo(text) {
	dom.info.textContent = text;
}

export function updateResizeInputs(w, h) {
	dom.resizeW.value = w;
	dom.resizeH.value = h;
}