function requireAll(req) {
	req.keys().forEach(req);
}

console.time = () => {};
console.timeEnd = () => {};

//global.THREE = require('three');

require('../vendor/BufferGeometryUtils');

require('aframe-aabb-collider-component');
require('aframe-atlas-uvs-component');
require('aframe-event-set-component');
require('aframe-geometry-merger-component');
require('aframe-layout-component');
require('aframe-orbit-controls');
require('aframe-proxy-event-component');
require('aframe-ring-shader');
require('aframe-state-component');
require('aframe-slice9-component');
require('aframe-render-order-component');

requireAll(require.context('./components/', true, /\.js$/));
requireAll(require.context('./state/', true, /\.js$/));

require('./index.styl');
