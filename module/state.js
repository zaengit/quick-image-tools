export const state = {
	originalImage: null, 
	img: new Image(),
	imgLoaded: false,
	naturalW: 0,
	naturalH: 0,
	currentW: 0,
	currentH: 0,
	crop: {
		active: false,
		rect: null, // {x, y, w, h} in canvas coordinates
		dragHandle: null,
		offsetX: 0,
		offsetY: 0
	},
	isApplyingCrop: false,
};