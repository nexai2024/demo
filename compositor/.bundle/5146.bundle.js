"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5146],{

/***/ 5146
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   snowFall: () => (/* binding */ snowFall),
/* harmony export */   snowFallSchema: () => (/* binding */ snowFallSchema)
/* harmony export */ });
/* harmony import */ var _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(5639);
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9728);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3947);



// src/snow-fall.ts

var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_2__.Internals;
var DEFAULTS = {
  ..._index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .COMMON_WEATHER_DEFAULTS */ .I_,
  size: 3,
  speed: 100,
  wind: 25,
  windVariation: 0.5,
  color: "#ffffff",
  opacity: 1,
  transferMode: "composite",
  flakes: 1e4,
  sizeVariation: 0.5,
  speedVariation: 0.5,
  wiggleAmount: 2,
  wiggleAmountVariation: 0.5,
  wiggleFrequency: 1,
  wiggleFrequencyVariation: 0.5
};
var snowFallSchema = {
  flakes: {
    type: "number",
    min: 0,
    max: 200000,
    step: 1,
    integer: true,
    default: DEFAULTS.flakes,
    description: "Flakes",
    hiddenFromList: false
  },
  sizeVariation: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.sizeVariation,
    description: "Size variation",
    hiddenFromList: false
  },
  speedVariation: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.speedVariation,
    description: "Speed variation",
    hiddenFromList: false
  },
  wiggleAmount: {
    type: "number",
    min: 0,
    max: 100,
    step: 0.01,
    default: DEFAULTS.wiggleAmount,
    description: "Wiggle amount",
    hiddenFromList: false
  },
  wiggleAmountVariation: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.wiggleAmountVariation,
    description: "Wiggle amount variation",
    hiddenFromList: false
  },
  wiggleFrequency: {
    type: "number",
    min: 0,
    max: 20,
    step: 0.01,
    default: DEFAULTS.wiggleFrequency,
    description: "Wiggle frequency",
    hiddenFromList: false
  },
  wiggleFrequencyVariation: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULTS.wiggleFrequencyVariation,
    description: "Wiggle frequency variation",
    hiddenFromList: false
  },
  ...(0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .createWeatherSchema */ .UX)(DEFAULTS, 5000, 5000)
};
var resolve = (params) => ({
  ...(0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .resolveWeatherParams */ .r8)(params, DEFAULTS),
  count: params.flakes ?? DEFAULTS.flakes,
  sizeVariation: params.sizeVariation ?? DEFAULTS.sizeVariation,
  speedVariation: params.speedVariation ?? DEFAULTS.speedVariation,
  wiggleAmount: params.wiggleAmount ?? DEFAULTS.wiggleAmount,
  wiggleAmountVariation: params.wiggleAmountVariation ?? DEFAULTS.wiggleAmountVariation,
  wiggleFrequency: params.wiggleFrequency ?? DEFAULTS.wiggleFrequency,
  wiggleFrequencyVariation: params.wiggleFrequencyVariation ?? DEFAULTS.wiggleFrequencyVariation,
  appearance: "soft-solid"
});
var snowFall = createEffect({
  type: "remotion/snow-fall",
  label: "snowFall()",
  documentationLink: "https://www.remotion.dev/docs/effects/snow-fall",
  calculateKey: (params) => `snow-fall-${JSON.stringify(resolve(params))}`,
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_2__.Internals.createEffectImplementation({
      setup: _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWeatherWebGpu */ .Kf,
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the snow fall effect");
        (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .drawWeatherWebGpu */ .Tf)({
          source,
          width,
          height,
          params: resolve(params),
          state,
          device: gpuDevice,
          type: "snow"
        });
      },
      cleanup: _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWeatherWebGpu */ .Tv
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_2__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWeather */ .yB)(target, "snow fall"),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .drawWeather */ .tY)({
          state,
          source,
          width,
          height,
          flipSourceY,
          params: resolve(params),
          type: "snow"
        });
      },
      cleanup: _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWeather */ .H9
    })
  },
  schema: snowFallSchema,
  validateParams: (params) => {
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherParams */ .zC)(params, "Snow fall", 5000, 5000);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.flakes, "flakes", 0, 200000);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.sizeVariation, "sizeVariation", 0, 1);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.speedVariation, "speedVariation", 0, 1);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.wiggleAmount, "wiggleAmount", 0, 100);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.wiggleAmountVariation, "wiggleAmountVariation", 0, 1);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.wiggleFrequency, "wiggleFrequency", 0, 20);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.wiggleFrequencyVariation, "wiggleFrequencyVariation", 0, 1);
    if (params.flakes !== undefined && !Number.isInteger(params.flakes)) {
      throw new TypeError('"flakes" must be an integer');
    }
  }
});



/***/ }

}]);
//# sourceMappingURL=5146.bundle.js.map