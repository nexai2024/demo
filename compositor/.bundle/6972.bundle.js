"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[6972],{

/***/ 6972
(__webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   effectPreviewLoaders: () => (/* binding */ effectPreviewLoaders)
/* harmony export */ });
// src/components/effect-preview-loaders.ts
var effectPreviewLoaders = {
  "@remotion/effects/brightness": () => __webpack_require__.e(/* import() */ 6300).then(__webpack_require__.bind(__webpack_require__, 6300)),
  "@remotion/effects/contrast": () => __webpack_require__.e(/* import() */ 2315).then(__webpack_require__.bind(__webpack_require__, 2315)),
  "@remotion/effects/color-correction": () => __webpack_require__.e(/* import() */ 8503).then(__webpack_require__.bind(__webpack_require__, 8503)),
  "@remotion/effects/color-key": () => __webpack_require__.e(/* import() */ 8336).then(__webpack_require__.bind(__webpack_require__, 8336)),
  "@remotion/effects/curves": () => __webpack_require__.e(/* import() */ 5165).then(__webpack_require__.bind(__webpack_require__, 7546)),
  "@remotion/effects/duotone": () => __webpack_require__.e(/* import() */ 651).then(__webpack_require__.bind(__webpack_require__, 651)),
  "@remotion/effects/exposure": () => __webpack_require__.e(/* import() */ 338).then(__webpack_require__.bind(__webpack_require__, 338)),
  "@remotion/effects/grayscale": () => __webpack_require__.e(/* import() */ 8802).then(__webpack_require__.bind(__webpack_require__, 8802)),
  "@remotion/effects/hue": () => __webpack_require__.e(/* import() */ 1078).then(__webpack_require__.bind(__webpack_require__, 8697)),
  "@remotion/effects/invert": () => __webpack_require__.e(/* import() */ 4489).then(__webpack_require__.bind(__webpack_require__, 4489)),
  "@remotion/effects/levels": () => __webpack_require__.e(/* import() */ 2564).then(__webpack_require__.bind(__webpack_require__, 2564)),
  "@remotion/effects/lut": () => __webpack_require__.e(/* import() */ 1868).then(__webpack_require__.bind(__webpack_require__, 1868)),
  "@remotion/effects/saturation": () => __webpack_require__.e(/* import() */ 7305).then(__webpack_require__.bind(__webpack_require__, 7305)),
  "@remotion/effects/shadows-highlights": () => __webpack_require__.e(/* import() */ 8938).then(__webpack_require__.bind(__webpack_require__, 8938)),
  "@remotion/effects/tint": () => __webpack_require__.e(/* import() */ 2510).then(__webpack_require__.bind(__webpack_require__, 2510)),
  "@remotion/effects/white-balance": () => __webpack_require__.e(/* import() */ 7463).then(__webpack_require__.bind(__webpack_require__, 7463)),
  "@remotion/effects/vibrance": () => __webpack_require__.e(/* import() */ 1023).then(__webpack_require__.bind(__webpack_require__, 1023)),
  "@remotion/effects/linear-gradient": () => __webpack_require__.e(/* import() */ 5511).then(__webpack_require__.bind(__webpack_require__, 5511)),
  "@remotion/effects/linear-gradient-tint": () => __webpack_require__.e(/* import() */ 9014).then(__webpack_require__.bind(__webpack_require__, 9014)),
  "@remotion/effects/thermal-vision": () => __webpack_require__.e(/* import() */ 8139).then(__webpack_require__.bind(__webpack_require__, 8139)),
  "@remotion/effects/blur": () => Promise.all(/* import() */[__webpack_require__.e(7891), __webpack_require__.e(490)]).then(__webpack_require__.bind(__webpack_require__, 490)),
  "@remotion/effects/lens-blur": () => __webpack_require__.e(/* import() */ 8697).then(__webpack_require__.bind(__webpack_require__, 1078)),
  "@remotion/effects/linear-progressive-blur": () => __webpack_require__.e(/* import() */ 2334).then(__webpack_require__.bind(__webpack_require__, 2334)),
  "@remotion/effects/radial-progressive-blur": () => __webpack_require__.e(/* import() */ 8564).then(__webpack_require__.bind(__webpack_require__, 8564)),
  "@remotion/effects/region-blur": () => Promise.all(/* import() */[__webpack_require__.e(7891), __webpack_require__.e(3313)]).then(__webpack_require__.bind(__webpack_require__, 3313)),
  "@remotion/effects/zoom-blur": () => __webpack_require__.e(/* import() */ 6586).then(__webpack_require__.bind(__webpack_require__, 6586)),
  "@remotion/effects/drop-shadow": () => Promise.all(/* import() */[__webpack_require__.e(7891), __webpack_require__.e(4851)]).then(__webpack_require__.bind(__webpack_require__, 4851)),
  "@remotion/effects/long-shadows": () => __webpack_require__.e(/* import() */ 9307).then(__webpack_require__.bind(__webpack_require__, 9307)),
  "@remotion/effects/glow": () => Promise.all(/* import() */[__webpack_require__.e(7891), __webpack_require__.e(9750)]).then(__webpack_require__.bind(__webpack_require__, 9750)),
  "@remotion/effects/outline": () => __webpack_require__.e(/* import() */ 8261).then(__webpack_require__.bind(__webpack_require__, 8261)),
  "@remotion/effects/light-trail": () => __webpack_require__.e(/* import() */ 7084).then(__webpack_require__.bind(__webpack_require__, 7084)),
  "@remotion/effects/evolve": () => __webpack_require__.e(/* import() */ 6418).then(__webpack_require__.bind(__webpack_require__, 6418)),
  "@remotion/effects/tear": () => __webpack_require__.e(/* import() */ 5641).then(__webpack_require__.bind(__webpack_require__, 5641)),
  "@remotion/effects/film-burn": () => __webpack_require__.e(/* import() */ 123).then(__webpack_require__.bind(__webpack_require__, 123)),
  "@remotion/effects/radial-wipe": () => __webpack_require__.e(/* import() */ 1788).then(__webpack_require__.bind(__webpack_require__, 1788)),
  "@remotion/effects/iris-wipe": () => __webpack_require__.e(/* import() */ 9028).then(__webpack_require__.bind(__webpack_require__, 6647)),
  "@remotion/effects/venetian-blinds": () => __webpack_require__.e(/* import() */ 6270).then(__webpack_require__.bind(__webpack_require__, 6270)),
  "@remotion/effects/mirror": () => __webpack_require__.e(/* import() */ 9988).then(__webpack_require__.bind(__webpack_require__, 9988)),
  "@remotion/effects/scale": () => __webpack_require__.e(/* import() */ 9521).then(__webpack_require__.bind(__webpack_require__, 9521)),
  "@remotion/effects/tile": () => __webpack_require__.e(/* import() */ 7005).then(__webpack_require__.bind(__webpack_require__, 7005)),
  "@remotion/effects/translate": () => __webpack_require__.e(/* import() */ 1685).then(__webpack_require__.bind(__webpack_require__, 1685)),
  "@remotion/effects/barrel-distortion": () => __webpack_require__.e(/* import() */ 6251).then(__webpack_require__.bind(__webpack_require__, 6251)),
  "@remotion/effects/chromatic-aberration": () => __webpack_require__.e(/* import() */ 2531).then(__webpack_require__.bind(__webpack_require__, 2531)),
  "@remotion/effects/magnify": () => __webpack_require__.e(/* import() */ 6330).then(__webpack_require__.bind(__webpack_require__, 6330)),
  "@remotion/effects/fisheye": () => __webpack_require__.e(/* import() */ 5446).then(__webpack_require__.bind(__webpack_require__, 3065)),
  "@remotion/effects/corner-pin": () => __webpack_require__.e(/* import() */ 6285).then(__webpack_require__.bind(__webpack_require__, 6285)),
  "@remotion/effects/page-turn": () => __webpack_require__.e(/* import() */ 336).then(__webpack_require__.bind(__webpack_require__, 336)),
  "@remotion/effects/sphere": () => __webpack_require__.e(/* import() */ 4970).then(__webpack_require__.bind(__webpack_require__, 4970)),
  "@remotion/effects/cylinder": () => __webpack_require__.e(/* import() */ 5551).then(__webpack_require__.bind(__webpack_require__, 5551)),
  "@remotion/effects/wave": () => __webpack_require__.e(/* import() */ 7462).then(__webpack_require__.bind(__webpack_require__, 7462)),
  "@remotion/effects/skew": () => __webpack_require__.e(/* import() */ 8439).then(__webpack_require__.bind(__webpack_require__, 8439)),
  "@remotion/effects/turbulent-displace": () => __webpack_require__.e(/* import() */ 2158).then(__webpack_require__.bind(__webpack_require__, 2158)),
  "@remotion/effects/burlap": () => __webpack_require__.e(/* import() */ 5223).then(__webpack_require__.bind(__webpack_require__, 5223)),
  "@remotion/effects/bevel-alpha": () => __webpack_require__.e(/* import() */ 5300).then(__webpack_require__.bind(__webpack_require__, 5300)),
  "@remotion/effects/emboss": () => __webpack_require__.e(/* import() */ 9792).then(__webpack_require__.bind(__webpack_require__, 9792)),
  "@remotion/effects/dot-grid": () => __webpack_require__.e(/* import() */ 2339).then(__webpack_require__.bind(__webpack_require__, 2339)),
  "@remotion/effects/halftone": () => __webpack_require__.e(/* import() */ 3710).then(__webpack_require__.bind(__webpack_require__, 3710)),
  "@remotion/effects/noise": () => __webpack_require__.e(/* import() */ 8233).then(__webpack_require__.bind(__webpack_require__, 8233)),
  "@remotion/effects/noise-displacement": () => __webpack_require__.e(/* import() */ 503).then(__webpack_require__.bind(__webpack_require__, 503)),
  "@remotion/effects/paper": () => __webpack_require__.e(/* import() */ 5889).then(__webpack_require__.bind(__webpack_require__, 5889)),
  "@remotion/effects/roughen-edges": () => __webpack_require__.e(/* import() */ 1660).then(__webpack_require__.bind(__webpack_require__, 1660)),
  "@remotion/effects/pattern": () => __webpack_require__.e(/* import() */ 7599).then(__webpack_require__.bind(__webpack_require__, 7599)),
  "@remotion/effects/pixel-dissolve": () => __webpack_require__.e(/* import() */ 1037).then(__webpack_require__.bind(__webpack_require__, 1037)),
  "@remotion/effects/pixelate": () => __webpack_require__.e(/* import() */ 3573).then(__webpack_require__.bind(__webpack_require__, 3573)),
  "@remotion/effects/linear-progressive-pixelate": () => Promise.all(/* import() */[__webpack_require__.e(9566), __webpack_require__.e(3481)]).then(__webpack_require__.bind(__webpack_require__, 3481)),
  "@remotion/effects/radial-progressive-pixelate": () => Promise.all(/* import() */[__webpack_require__.e(9566), __webpack_require__.e(4207)]).then(__webpack_require__.bind(__webpack_require__, 4207)),
  "@remotion/effects/scanlines": () => __webpack_require__.e(/* import() */ 2947).then(__webpack_require__.bind(__webpack_require__, 2947)),
  "@remotion/effects/speckle": () => __webpack_require__.e(/* import() */ 1262).then(__webpack_require__.bind(__webpack_require__, 1262)),
  "@remotion/effects/shatter": () => __webpack_require__.e(/* import() */ 7304).then(__webpack_require__.bind(__webpack_require__, 7304)),
  "@remotion/effects/shine": () => __webpack_require__.e(/* import() */ 2014).then(__webpack_require__.bind(__webpack_require__, 2014)),
  "@remotion/effects/shrinkwrap": () => __webpack_require__.e(/* import() */ 8174).then(__webpack_require__.bind(__webpack_require__, 8174)),
  "@remotion/effects/vignette": () => __webpack_require__.e(/* import() */ 5235).then(__webpack_require__.bind(__webpack_require__, 5235)),
  "@remotion/effects/lightning": () => __webpack_require__.e(/* import() */ 7917).then(__webpack_require__.bind(__webpack_require__, 7917)),
  "@remotion/effects/rain-fall": () => Promise.all(/* import() */[__webpack_require__.e(5639), __webpack_require__.e(5263)]).then(__webpack_require__.bind(__webpack_require__, 5263)),
  "@remotion/effects/snow-fall": () => Promise.all(/* import() */[__webpack_require__.e(5639), __webpack_require__.e(5146)]).then(__webpack_require__.bind(__webpack_require__, 5146)),
  "@remotion/effects/fractal-noise": () => __webpack_require__.e(/* import() */ 5065).then(__webpack_require__.bind(__webpack_require__, 5065)),
  "@remotion/effects/contour-lines": () => __webpack_require__.e(/* import() */ 2287).then(__webpack_require__.bind(__webpack_require__, 2287)),
  "@remotion/effects/liquid-contours": () => __webpack_require__.e(/* import() */ 4407).then(__webpack_require__.bind(__webpack_require__, 4407)),
  "@remotion/effects/checkerboard": () => __webpack_require__.e(/* import() */ 9901).then(__webpack_require__.bind(__webpack_require__, 9901)),
  "@remotion/effects/flannel": () => __webpack_require__.e(/* import() */ 1927).then(__webpack_require__.bind(__webpack_require__, 1927)),
  "@remotion/effects/halftone-linear-gradient": () => __webpack_require__.e(/* import() */ 305).then(__webpack_require__.bind(__webpack_require__, 305)),
  "@remotion/effects/gridlines": () => __webpack_require__.e(/* import() */ 5953).then(__webpack_require__.bind(__webpack_require__, 5953)),
  "@remotion/effects/white-noise": () => __webpack_require__.e(/* import() */ 5245).then(__webpack_require__.bind(__webpack_require__, 5245)),
  "@remotion/effects/tv-signal-off": () => __webpack_require__.e(/* import() */ 8768).then(__webpack_require__.bind(__webpack_require__, 8768)),
  "@remotion/effects/lines": () => __webpack_require__.e(/* import() */ 7750).then(__webpack_require__.bind(__webpack_require__, 7750)),
  "@remotion/effects/rings": () => __webpack_require__.e(/* import() */ 1936).then(__webpack_require__.bind(__webpack_require__, 1936)),
  "@remotion/effects/waves": () => __webpack_require__.e(/* import() */ 8485).then(__webpack_require__.bind(__webpack_require__, 8485)),
  "@remotion/effects/zigzag": () => __webpack_require__.e(/* import() */ 502).then(__webpack_require__.bind(__webpack_require__, 502)),
  "@remotion/effects/light-leak": () => __webpack_require__.e(/* import() */ 4642).then(__webpack_require__.bind(__webpack_require__, 4642)),
  "@remotion/effects/starburst": () => __webpack_require__.e(/* import() */ 3240).then(__webpack_require__.bind(__webpack_require__, 3240))
};
if ( true && typeof __webpack_module__.hot?.accept === "function") {
  __webpack_module__.hot.accept();
}



/***/ }

}]);
//# sourceMappingURL=6972.bundle.js.map