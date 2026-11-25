"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[7599],{

/***/ 4075
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   b3: () => (/* binding */ assertRequiredColor),
/* harmony export */   c1: () => (/* binding */ assertRequiredFiniteNumber),
/* harmony export */   db: () => (/* binding */ assertEffectParamsObject),
/* harmony export */   fX: () => (/* binding */ assertOptionalBoolean),
/* harmony export */   gu: () => (/* binding */ assertOptionalColor)
/* harmony export */ });
// src/validate-effect-param.ts
var assertEffectParamsObject = (params, effectLabel) => {
  if (params === null || typeof params !== "object") {
    throw new TypeError(`${effectLabel} effect requires a parameters object, but got ${JSON.stringify(params)}`);
  }
};
var assertRequiredFiniteNumber = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`"${name}" must be a finite number, but got ${JSON.stringify(value)}`);
  }
};
var assertRequiredColor = (value, name) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`"${name}" must be a non-empty string, but got ${JSON.stringify(value)}`);
  }
};
var assertOptionalColor = (value, name) => {
  if (value === undefined) {
    return;
  }
  assertRequiredColor(value, name);
};
var assertOptionalBoolean = (value, name) => {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "boolean") {
    throw new TypeError(`"${name}" must be a boolean, but got ${JSON.stringify(value)}`);
  }
};




/***/ },

/***/ 9728
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DS: () => (/* binding */ setupWebGpuSinglePass),
/* harmony export */   Gl: () => (/* binding */ cleanupWebGpuSinglePass),
/* harmony export */   JR: () => (/* binding */ getSharedWebGpuResources),
/* harmony export */   UI: () => (/* binding */ applyWebGpuSinglePass),
/* harmony export */   fH: () => (/* binding */ WEBGPU_SINGLE_PASS_VERTEX)
/* harmony export */ });
// src/shared-webgpu-resources.ts
var deviceResources = new WeakMap;
var lostDevices = new WeakSet;
var getSharedWebGpuResources = ({
  device,
  key,
  create
}) => {
  if (lostDevices.has(device)) {
    throw new Error("Cannot create WebGPU resources with a lost device");
  }
  let resources = deviceResources.get(device);
  if (!resources) {
    resources = new Map;
    deviceResources.set(device, resources);
    const cached = resources;
    device.lost.then(() => {
      lostDevices.add(device);
      cached.clear();
      deviceResources.delete(device);
    });
  }
  if (resources.has(key)) {
    return resources.get(key);
  }
  const shared = create();
  resources.set(key, shared);
  return shared;
};

// src/webgpu-single-pass-runtime.ts
var WEBGPU_SINGLE_PASS_VERTEX = `
struct VertexOutput {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
}

@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
	let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
	let position = positions[index];
	var output: VertexOutput;
	output.position = vec4f(position, 0, 1);
	output.uv = vec2f(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
	return output;
}
`;
var setupWebGpuSinglePass = (target, label) => {
  const context = target.getContext("webgpu");
  if (!context) {
    throw new Error(`WebGPU is not available for the ${label} effect`);
  }
  return { context, label, resources: null };
};
var cleanupWebGpuSinglePass = (state) => {
  state.resources?.source?.texture.destroy();
  state.resources?.uniforms.destroy();
  state.resources?.auxiliary?.texture.destroy();
  state.resources = null;
  state.context.unconfigure();
};
var applyWebGpuSinglePass = ({
  state,
  source,
  device,
  shader,
  uniformData
}, options = null) => {
  const sourceFilter = options?.sourceFilter ?? "linear";
  const auxiliaryTexture = options?.auxiliaryTexture ?? null;
  const width = "displayWidth" in source ? source.displayWidth : ("videoWidth" in source) ? source.videoWidth : ("naturalWidth" in source) ? source.naturalWidth : typeof source.width === "number" ? source.width : source.width.baseVal.value;
  const height = "displayHeight" in source ? source.displayHeight : ("videoHeight" in source) ? source.videoHeight : ("naturalHeight" in source) ? source.naturalHeight : typeof source.height === "number" ? source.height : source.height.baseVal.value;
  const uniformBufferSize = Math.max(16, Math.ceil(uniformData.byteLength / 16) * 16);
  if (state.resources && (state.resources.device !== device || state.resources.shader !== shader || state.resources.uniformBufferSize !== uniformBufferSize || state.resources.sourceFilter !== sourceFilter || (state.resources.auxiliary?.width ?? null) !== (auxiliaryTexture?.width ?? null) || (state.resources.auxiliary?.height ?? null) !== (auxiliaryTexture?.height ?? null) || (state.resources.auxiliary?.format ?? null) !== (auxiliaryTexture?.format ?? null))) {
    cleanupWebGpuSinglePass(state);
  }
  if (!state.resources) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    state.context.configure({ device, format, alphaMode: "premultiplied" });
    const shared = getSharedWebGpuResources({
      device,
      key: JSON.stringify([
        "single-pass",
        shader,
        format,
        sourceFilter,
        auxiliaryTexture?.format ?? null
      ]),
      create: () => {
        const module = device.createShaderModule({
          code: shader,
          label: state.label
        });
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            ...auxiliaryTexture ? [
              {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                  sampleType: auxiliaryTexture.format === "rgba32float" ? "unfilterable-float" : "float"
                }
              }
            ] : [],
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: "uniform" }
            }
          ]
        });
        const pipeline = device.createRenderPipeline({
          label: state.label,
          layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
          }),
          vertex: { module, entryPoint: "vertex" },
          fragment: { module, entryPoint: "fragment", targets: [{ format }] },
          primitive: { topology: "triangle-list" }
        });
        const sampler = device.createSampler({
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          magFilter: sourceFilter,
          minFilter: sourceFilter
        });
        return { pipeline, sampler, bindGroupLayout };
      }
    });
    const uniforms = device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const auxiliary = auxiliaryTexture ? {
      texture: device.createTexture({
        size: [auxiliaryTexture.width, auxiliaryTexture.height],
        format: auxiliaryTexture.format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      }),
      width: auxiliaryTexture.width,
      height: auxiliaryTexture.height,
      format: auxiliaryTexture.format,
      uploadedData: null
    } : null;
    state.resources = {
      device,
      shader,
      uniformBufferSize,
      sourceFilter,
      auxiliary,
      pipeline: shared.pipeline,
      uniforms,
      sampler: shared.sampler,
      bindGroupLayout: shared.bindGroupLayout,
      source: null
    };
  }
  const { resources } = state;
  if (resources.source && (resources.source.width !== width || resources.source.height !== height)) {
    resources.source.texture.destroy();
    resources.source = null;
  }
  if (!resources.source) {
    const texture = device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const bindGroup = device.createBindGroup({
      layout: resources.bindGroupLayout,
      entries: [
        ...resources.auxiliary ? [{ binding: 3, resource: resources.auxiliary.texture.createView() }] : [],
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: resources.sampler },
        { binding: 2, resource: { buffer: resources.uniforms } }
      ]
    });
    resources.source = { texture, bindGroup, width, height };
  }
  if (auxiliaryTexture && resources.auxiliary && resources.auxiliary.uploadedData !== auxiliaryTexture.data) {
    device.queue.writeTexture({ texture: resources.auxiliary.texture }, auxiliaryTexture.data, {
      bytesPerRow: auxiliaryTexture.width * 4 * auxiliaryTexture.data.BYTES_PER_ELEMENT
    }, [auxiliaryTexture.width, auxiliaryTexture.height]);
    resources.auxiliary.uploadedData = auxiliaryTexture.data;
  }
  device.queue.copyExternalImageToTexture({ source }, { texture: resources.source.texture, premultipliedAlpha: true }, [width, height]);
  device.queue.writeBuffer(resources.uniforms, 0, uniformData);
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: state.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  pass.setPipeline(resources.pipeline);
  pass.setBindGroup(0, resources.source.bindGroup);
  pass.draw(3);
  pass.end();
  device.queue.submit([encoder.finish()]);
};




/***/ },

/***/ 8197
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $j: () => (/* binding */ DEFAULT_BRIGHTNESS_AMOUNT),
/* harmony export */   FC: () => (/* binding */ assertOptionalFiniteNumber),
/* harmony export */   HQ: () => (/* binding */ colorAmountSchema),
/* harmony export */   J: () => (/* binding */ brightnessAmountSchema),
/* harmony export */   Oj: () => (/* binding */ clampColorChannel),
/* harmony export */   PQ: () => (/* binding */ DEFAULT_AMOUNT),
/* harmony export */   XP: () => (/* binding */ validateNonNegative),
/* harmony export */   Xb: () => (/* binding */ hueDegreesSchema),
/* harmony export */   cz: () => (/* binding */ validateSignedUnitInterval),
/* harmony export */   n7: () => (/* binding */ DEFAULT_HUE_DEGREES),
/* harmony export */   y0: () => (/* binding */ colorMultiplierSchema),
/* harmony export */   yk: () => (/* binding */ validateUnitInterval),
/* harmony export */   zp: () => (/* binding */ parseColorRgba)
/* harmony export */ });
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4075);


// src/color-utils.ts
var DEFAULT_AMOUNT = 1;
var DEFAULT_BRIGHTNESS_AMOUNT = 0;
var DEFAULT_HUE_DEGREES = 0;
var colorAmountSchema = {
  type: "number",
  min: 0,
  max: 1,
  step: 0.01,
  default: DEFAULT_AMOUNT,
  description: "Amount",
  hiddenFromList: false
};
var colorMultiplierSchema = {
  type: "number",
  min: 0,
  step: 0.01,
  default: DEFAULT_AMOUNT,
  description: "Amount",
  hiddenFromList: false
};
var brightnessAmountSchema = {
  type: "number",
  min: -1,
  max: 1,
  step: 0.01,
  default: DEFAULT_BRIGHTNESS_AMOUNT,
  description: "Amount",
  hiddenFromList: false
};
var hueDegreesSchema = {
  type: "rotation-degrees",
  step: 1,
  default: DEFAULT_HUE_DEGREES,
  description: "Degrees"
};
var assertOptionalFiniteNumber = (value, name) => {
  if (value === undefined) {
    return;
  }
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_0__/* .assertRequiredFiniteNumber */ .c1)(value, name);
};
var validateUnitInterval = (value, name) => {
  if (value < 0) {
    throw new TypeError(`"${name}" must be >= 0, but got ${JSON.stringify(value)}`);
  }
  if (value > 1) {
    throw new TypeError(`"${name}" must be <= 1, but got ${JSON.stringify(value)}`);
  }
};
var validateNonNegative = (value, name) => {
  if (value < 0) {
    throw new TypeError(`"${name}" must be >= 0, but got ${JSON.stringify(value)}`);
  }
};
var validateSignedUnitInterval = (value, name) => {
  if (value < -1) {
    throw new TypeError(`"${name}" must be >= -1, but got ${JSON.stringify(value)}`);
  }
  if (value > 1) {
    throw new TypeError(`"${name}" must be <= 1, but got ${JSON.stringify(value)}`);
  }
};
var clampColorChannel = (value) => {
  return Math.max(0, Math.min(255, value));
};
var parseColorRgba = (ctx, color) => {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const { data } = ctx.getImageData(0, 0, 1, 1);
  return [data[0], data[1], data[2], data[3]];
};




/***/ },

/***/ 7599
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  pattern: () => (/* reexport */ pattern2)
});

// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4svzhprm.mjs
var index_4svzhprm = __webpack_require__(9728);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-wxhvgv2s.mjs
var index_wxhvgv2s = __webpack_require__(8197);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4fvp93ps.mjs
var index_4fvp93ps = __webpack_require__(4075);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/index.mjs
var esm = __webpack_require__(3947);
;// ./node_modules/@remotion/effects/dist/esm/preview/index-cbdbfedm.mjs




// src/pattern.ts


// src/pattern-webgpu-shader.ts
var PATTERN_WEBGPU_SHADER = `
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {
 geometry: vec4f,
 crop: vec4f,
 gapOffset: vec4f,
 stagger: vec4f,
 origin: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}
fn glslModulo(value: f32, divisor: f32) -> f32 { return value - divisor * floor(value / divisor); }

fn getPhase(index: f32, every: f32) -> f32 {
 if (every == 0.0) { return index; }
 return glslModulo(glslModulo(index, every) + every, every);
}
struct CellSample {valid: bool, color: vec4f,}
fn sampleCell(cell: vec2f, fragPx: vec2f, cropStart: vec2f, tileSize: vec2f, pitch: vec2f, originPx: vec2f) -> CellSample {
 if (params.geometry.w == 0.0 && (cell.x < 0.0 || cell.y < 0.0)) { return CellSample(false, vec4f(0)); }
 let rowPhase = getPhase(cell.y, params.stagger.y);
 let columnPhase = getPhase(cell.x, params.stagger.w);
 let stagger = vec2f(rowPhase * params.stagger.x, columnPhase * params.stagger.z);
 let localPx = fragPx - originPx - stagger - cell * pitch;
 if (localPx.x < 0.0 || localPx.y < 0.0 || localPx.x >= tileSize.x || localPx.y >= tileSize.y) { return CellSample(false, vec4f(0)); }
 let sourcePx = cropStart + localPx / params.geometry.z;
 let sourceUv = vec2f(sourcePx.x / params.geometry.x, 1.0 - sourcePx.y / params.geometry.y);
 if (sourceUv.x < 0.0 || sourceUv.y < 0.0 || sourceUv.x > 1.0 || sourceUv.y > 1.0) { return CellSample(false, vec4f(0)); }
 return CellSample(true, sampleSource(sourceUv));
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 let cropStart = params.crop.xy;
 let cropEnd = params.geometry.xy - params.crop.zw;
 let cropSize = max(cropEnd - cropStart, vec2f(0.001));
 let tileSize = max(cropSize * params.geometry.z, vec2f(0.001));
 let pitch = max(tileSize + params.gapOffset.xy, vec2f(0.001));
 let originPx = (params.origin.xy + params.gapOffset.zw) * params.geometry.xy;
 let fragPx = input.position.xy;
 var cell = floor((fragPx - originPx) / pitch);
 for (var i = 0; i < 4; i++) {
  let rowPhase = getPhase(cell.y, params.stagger.y);
  let columnPhase = getPhase(cell.x, params.stagger.w);
  let stagger = vec2f(rowPhase * params.stagger.x, columnPhase * params.stagger.z);
  let nextCell = floor((fragPx - originPx - stagger) / pitch);
  if (all(nextCell == cell)) { break; }
  cell = nextCell;
 }
 for (var y = -4; y <= 4; y++) {
  for (var x = -4; x <= 4; x++) {
   let result = sampleCell(cell + vec2f(f32(x), f32(y)), fragPx, cropStart, tileSize, pitch, originPx);
   if (result.valid) { return result.color; }
  }
 }
 return vec4f(0);

}
`;

// src/pattern.ts
var { createEffect, createWebGL2ContextError } = esm.Internals;
var DEFAULT_SCALE = 0.1;
var DEFAULT_CROP = 0;
var DEFAULT_GAP = 0;
var DEFAULT_OFFSET = 0;
var DEFAULT_OFFSET_EVERY = 0;
var DEFAULT_ORIGIN = [0, 0];
var DEFAULT_WRAP = true;
var patternSchema = {
  scale: {
    type: "number",
    min: 0.001,
    max: 2,
    step: 0.01,
    default: DEFAULT_SCALE,
    description: "Scale",
    hiddenFromList: false
  },
  cropLeft: {
    type: "number",
    step: 1,
    default: DEFAULT_CROP,
    description: "Crop left",
    hiddenFromList: false
  },
  cropTop: {
    type: "number",
    step: 1,
    default: DEFAULT_CROP,
    description: "Crop top",
    hiddenFromList: false
  },
  cropRight: {
    type: "number",
    step: 1,
    default: DEFAULT_CROP,
    description: "Crop right",
    hiddenFromList: false
  },
  cropBottom: {
    type: "number",
    step: 1,
    default: DEFAULT_CROP,
    description: "Crop bottom",
    hiddenFromList: false
  },
  gapX: {
    type: "number",
    step: 1,
    default: DEFAULT_GAP,
    description: "Gap X",
    hiddenFromList: false
  },
  gapY: {
    type: "number",
    step: 1,
    default: DEFAULT_GAP,
    description: "Gap Y",
    hiddenFromList: false
  },
  offsetU: {
    type: "number",
    step: 0.01,
    default: DEFAULT_OFFSET,
    description: "Offset U",
    hiddenFromList: false
  },
  offsetV: {
    type: "number",
    step: 0.01,
    default: DEFAULT_OFFSET,
    description: "Offset V",
    hiddenFromList: false
  },
  rowOffset: {
    type: "number",
    step: 1,
    default: DEFAULT_OFFSET,
    description: "Row offset",
    hiddenFromList: false
  },
  rowOffsetEvery: {
    type: "number",
    min: 0,
    step: 1,
    integer: true,
    default: DEFAULT_OFFSET_EVERY,
    description: "Row offset every",
    hiddenFromList: false
  },
  columnOffset: {
    type: "number",
    step: 1,
    default: DEFAULT_OFFSET,
    description: "Column offset",
    hiddenFromList: false
  },
  columnOffsetEvery: {
    type: "number",
    min: 0,
    step: 1,
    integer: true,
    default: DEFAULT_OFFSET_EVERY,
    description: "Column offset every",
    hiddenFromList: false
  },
  origin: {
    type: "uv-coordinate",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_ORIGIN,
    description: "Origin"
  },
  wrap: {
    type: "boolean",
    default: DEFAULT_WRAP,
    description: "Wrap"
  }
};
var resolve = (p) => ({
  scale: p.scale ?? DEFAULT_SCALE,
  cropLeft: p.cropLeft ?? DEFAULT_CROP,
  cropTop: p.cropTop ?? DEFAULT_CROP,
  cropRight: p.cropRight ?? DEFAULT_CROP,
  cropBottom: p.cropBottom ?? DEFAULT_CROP,
  gapX: p.gapX ?? DEFAULT_GAP,
  gapY: p.gapY ?? DEFAULT_GAP,
  offsetU: p.offsetU ?? DEFAULT_OFFSET,
  offsetV: p.offsetV ?? DEFAULT_OFFSET,
  rowOffset: p.rowOffset ?? DEFAULT_OFFSET,
  rowOffsetEvery: p.rowOffsetEvery ?? DEFAULT_OFFSET_EVERY,
  columnOffset: p.columnOffset ?? DEFAULT_OFFSET,
  columnOffsetEvery: p.columnOffsetEvery ?? DEFAULT_OFFSET_EVERY,
  origin: [...p.origin ?? DEFAULT_ORIGIN],
  wrap: p.wrap ?? DEFAULT_WRAP
});
var assertOptionalUvCoordinate = (value, name) => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new TypeError(`"${name}" must be a [number, number] tuple`);
  }
};
var assertOptionalInteger = (value, name) => {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value)) {
    throw new TypeError(`"${name}" must be an integer, but got ${JSON.stringify(value)}`);
  }
};
var validatePositive = (value, name) => {
  if (value <= 0) {
    throw new TypeError(`"${name}" must be > 0`);
  }
};
var validateAtLeast = (value, min, name) => {
  if (value < min) {
    throw new TypeError(`"${name}" must be >= ${min}, but got ${JSON.stringify(value)}`);
  }
};
var validatePatternParams = (params) => {
  (0,index_4fvp93ps/* assertEffectParamsObject */.db)(params, "Pattern");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.scale, "scale");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.cropLeft, "cropLeft");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.cropTop, "cropTop");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.cropRight, "cropRight");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.cropBottom, "cropBottom");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.gapX, "gapX");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.gapY, "gapY");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.offsetU, "offsetU");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.offsetV, "offsetV");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.rowOffset, "rowOffset");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.rowOffsetEvery, "rowOffsetEvery");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.columnOffset, "columnOffset");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.columnOffsetEvery, "columnOffsetEvery");
  assertOptionalUvCoordinate(params.origin, "origin");
  (0,index_4fvp93ps/* assertOptionalBoolean */.fX)(params.wrap, "wrap");
  assertOptionalInteger(params.rowOffsetEvery, "rowOffsetEvery");
  assertOptionalInteger(params.columnOffsetEvery, "columnOffsetEvery");
  const r = resolve(params);
  validatePositive(r.scale, "scale");
  validateAtLeast(r.rowOffsetEvery, 0, "rowOffsetEvery");
  validateAtLeast(r.columnOffsetEvery, 0, "columnOffsetEvery");
  (0,index_wxhvgv2s/* validateUnitInterval */.yk)(r.origin[0], "origin[0]");
  (0,index_wxhvgv2s/* validateUnitInterval */.yk)(r.origin[1], "origin[1]");
};
var PATTERN_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var PATTERN_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uScale;
uniform vec4 uCrop;
uniform vec2 uGap;
uniform vec2 uOffset;
uniform vec2 uRowOffset;
uniform vec2 uColumnOffset;
uniform vec2 uOrigin;
uniform bool uWrap;

float positiveModulo(float value, float modulo) {
	return mod(mod(value, modulo) + modulo, modulo);
}

float getPhase(float index, float every) {
	if (every == 0.0) {
		return index;
	}

	return positiveModulo(index, every);
}

bool sampleCell(vec2 cell, vec2 fragPx, vec2 cropStart, vec2 tileSize, vec2 pitch, vec2 originPx, out vec4 color) {
	if (!uWrap && (cell.x < 0.0 || cell.y < 0.0)) {
		return false;
	}

	float rowPhase = getPhase(cell.y, uRowOffset.y);
	float columnPhase = getPhase(cell.x, uColumnOffset.y);
	vec2 stagger = vec2(rowPhase * uRowOffset.x, columnPhase * uColumnOffset.x);
	vec2 localPx = fragPx - originPx - stagger - cell * pitch;

	if (localPx.x < 0.0 || localPx.y < 0.0 || localPx.x >= tileSize.x || localPx.y >= tileSize.y) {
		return false;
	}

	vec2 sourcePx = cropStart + localPx / uScale;
	vec2 sourceUv = vec2(sourcePx.x / uResolution.x, 1.0 - sourcePx.y / uResolution.y);

	if (sourceUv.x < 0.0 || sourceUv.y < 0.0 || sourceUv.x > 1.0 || sourceUv.y > 1.0) {
		return false;
	}

	color = texture(uSource, sourceUv);
	return true;
}

void main() {
	vec2 cropStart = uCrop.xy;
	vec2 cropEnd = uResolution - uCrop.zw;
	vec2 cropSize = max(cropEnd - cropStart, vec2(0.001));
	vec2 tileSize = max(cropSize * uScale, vec2(0.001));
	vec2 pitch = max(tileSize + uGap, vec2(0.001));
	vec2 originPx = (uOrigin + uOffset) * uResolution;
	vec2 fragPx = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);

	vec2 gridPx = fragPx - originPx;
	vec2 cell = floor(gridPx / pitch);

	for (int i = 0; i < 4; i++) {
		float rowPhase = getPhase(cell.y, uRowOffset.y);
		float columnPhase = getPhase(cell.x, uColumnOffset.y);
		vec2 stagger = vec2(rowPhase * uRowOffset.x, columnPhase * uColumnOffset.x);
		vec2 adjustedGridPx = fragPx - originPx - stagger;
		vec2 nextCell = floor(adjustedGridPx / pitch);

		if (all(equal(nextCell, cell))) {
			break;
		}

		cell = nextCell;
	}

	vec4 color = vec4(0.0);
	for (int y = -4; y <= 4; y++) {
		for (int x = -4; x <= 4; x++) {
			if (sampleCell(cell + vec2(float(x), float(y)), fragPx, cropStart, tileSize, pitch, originPx, color)) {
				fragColor = color;
				return;
			}
		}
	}

	fragColor = vec4(0.0);
}
`;
var compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create WebGL shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Pattern shader compile failed: ${log ?? "(no log)"}`);
  }
  return shader;
};
var linkProgram = (gl, vs, fs) => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create WebGL program");
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Pattern program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var pattern2 = createEffect({
  type: "dev.remotion.effects.pattern",
  label: "pattern()",
  documentationLink: "https://www.remotion.dev/docs/effects/pattern",
  calculateKey: (params) => {
    const r = resolve(params);
    return `pattern-${r.scale}-${r.cropLeft}-${r.cropTop}-${r.cropRight}-${r.cropBottom}-${r.gapX}-${r.gapY}-${r.offsetU}-${r.offsetV}-${r.rowOffset}-${r.rowOffsetEvery}-${r.columnOffset}-${r.columnOffsetEvery}-${r.origin[0]}-${r.origin[1]}-${r.wrap ? 1 : 0}`;
  },
  implementations: {
    webgpu: esm.Internals.createEffectImplementation({
      setup: (target) => (0,index_4svzhprm/* setupWebGpuSinglePass */.DS)(target, "pattern"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the pattern effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          width,
          height,
          r.scale,
          r.wrap ? 1 : 0,
          r.cropLeft,
          r.cropTop,
          r.cropRight,
          r.cropBottom,
          r.gapX,
          r.gapY,
          r.offsetU,
          r.offsetV,
          r.rowOffset,
          r.rowOffsetEvery,
          r.columnOffset,
          r.columnOffsetEvery,
          r.origin[0],
          r.origin[1],
          0,
          0
        ]);
        (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: PATTERN_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: index_4svzhprm/* cleanupWebGpuSinglePass */.Gl
    }),
    webgl2: esm.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("pattern effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, PATTERN_VS);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, PATTERN_FS);
        const program = linkProgram(gl, vs, fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        const vao = gl.createVertexArray();
        if (!vao) {
          throw new Error("Failed to create WebGL vertex array");
        }
        gl.bindVertexArray(vao);
        const data = new Float32Array([
          -1,
          -1,
          0,
          0,
          1,
          -1,
          1,
          0,
          -1,
          1,
          0,
          1,
          1,
          1,
          1,
          1
        ]);
        const vbo = gl.createBuffer();
        if (!vbo) {
          throw new Error("Failed to create WebGL buffer");
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, "aPos");
        const aUv = gl.getAttribLocation(program, "aUv");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
        gl.bindVertexArray(null);
        const texture = gl.createTexture();
        if (!texture) {
          throw new Error("Failed to create WebGL texture");
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return {
          gl,
          program,
          vao,
          vbo,
          texture,
          uniforms: {
            uSource: gl.getUniformLocation(program, "uSource"),
            uResolution: gl.getUniformLocation(program, "uResolution"),
            uScale: gl.getUniformLocation(program, "uScale"),
            uCrop: gl.getUniformLocation(program, "uCrop"),
            uGap: gl.getUniformLocation(program, "uGap"),
            uOffset: gl.getUniformLocation(program, "uOffset"),
            uRowOffset: gl.getUniformLocation(program, "uRowOffset"),
            uColumnOffset: gl.getUniformLocation(program, "uColumnOffset"),
            uOrigin: gl.getUniformLocation(program, "uOrigin"),
            uWrap: gl.getUniformLocation(program, "uWrap")
          }
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, texture, uniforms } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uResolution)
          gl.uniform2f(uniforms.uResolution, width, height);
        if (uniforms.uScale)
          gl.uniform1f(uniforms.uScale, r.scale);
        if (uniforms.uCrop)
          gl.uniform4f(uniforms.uCrop, r.cropLeft, r.cropTop, r.cropRight, r.cropBottom);
        if (uniforms.uGap)
          gl.uniform2f(uniforms.uGap, r.gapX, r.gapY);
        if (uniforms.uOffset)
          gl.uniform2f(uniforms.uOffset, r.offsetU, r.offsetV);
        if (uniforms.uRowOffset)
          gl.uniform2f(uniforms.uRowOffset, r.rowOffset, r.rowOffsetEvery);
        if (uniforms.uColumnOffset)
          gl.uniform2f(uniforms.uColumnOffset, r.columnOffset, r.columnOffsetEvery);
        if (uniforms.uOrigin)
          gl.uniform2f(uniforms.uOrigin, r.origin[0], r.origin[1]);
        if (uniforms.uWrap)
          gl.uniform1i(uniforms.uWrap, r.wrap ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
        gl.deleteTexture(texture);
      }
    })
  },
  schema: patternSchema,
  validateParams: validatePatternParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/pattern.mjs





/***/ }

}]);
//# sourceMappingURL=7599.bundle.js.map