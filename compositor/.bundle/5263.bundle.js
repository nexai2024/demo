"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5263],{

/***/ 5263
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   rainFall: () => (/* binding */ rainFall),
/* harmony export */   rainFallSchema: () => (/* binding */ rainFallSchema)
/* harmony export */ });
/* harmony import */ var _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(5639);
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9728);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3947);



// src/rain-fall.ts

var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_2__.Internals;
var DEFAULTS = {
  ..._index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .COMMON_WEATHER_DEFAULTS */ .I_,
  size: 1,
  speed: 4000,
  wind: 0,
  windVariation: 0,
  color: "#cccccc",
  opacity: 0.25,
  transferMode: "lighten",
  drops: 1e5,
  appearance: "refracting"
};
var rainFallSchema = {
  drops: {
    type: "number",
    min: 0,
    max: 1e5,
    step: 1,
    integer: true,
    default: DEFAULTS.drops,
    description: "Drops",
    hiddenFromList: false
  },
  ...(0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .createWeatherSchema */ .UX)(DEFAULTS, 20000, 1e4),
  appearance: {
    type: "enum",
    variants: { refracting: {}, "soft-solid": {} },
    default: DEFAULTS.appearance,
    description: "Appearance"
  }
};
var resolve = (params) => ({
  ...(0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .resolveWeatherParams */ .r8)(params, DEFAULTS),
  count: params.drops ?? DEFAULTS.drops,
  sizeVariation: 0,
  speedVariation: 0,
  wiggleAmount: 0,
  wiggleAmountVariation: 0,
  wiggleFrequency: 0,
  wiggleFrequencyVariation: 0,
  appearance: params.appearance ?? DEFAULTS.appearance
});
var rainFall = createEffect({
  type: "remotion/rain-fall",
  label: "rainFall()",
  documentationLink: "https://www.remotion.dev/docs/effects/rain-fall",
  calculateKey: (params) => `rain-fall-${JSON.stringify(resolve(params))}`,
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_2__.Internals.createEffectImplementation({
      setup: _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWeatherWebGpu */ .Kf,
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the rain fall effect");
        (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .drawWeatherWebGpu */ .Tf)({
          source,
          width,
          height,
          params: resolve(params),
          state,
          device: gpuDevice,
          type: "rain"
        });
      },
      cleanup: _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWeatherWebGpu */ .Tv
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_2__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWeather */ .yB)(target, "rain fall"),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .drawWeather */ .tY)({
          state,
          source,
          width,
          height,
          flipSourceY,
          params: resolve(params),
          type: "rain"
        });
      },
      cleanup: _index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWeather */ .H9
    })
  },
  schema: rainFallSchema,
  validateParams: (params) => {
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherParams */ .zC)(params, "Rain fall", 20000, 1e4);
    (0,_index_2n7k8m6z_mjs__WEBPACK_IMPORTED_MODULE_0__/* .validateWeatherRange */ .Sl)(params.drops, "drops", 0, 1e5);
    if (params.drops !== undefined && !Number.isInteger(params.drops)) {
      throw new TypeError('"drops" must be an integer');
    }
    if (params.appearance !== undefined && params.appearance !== "refracting" && params.appearance !== "soft-solid") {
      throw new TypeError('"appearance" must be "refracting" or "soft-solid"');
    }
  }
});



/***/ }

}]);
//# sourceMappingURL=5263.bundle.js.map