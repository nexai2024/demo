"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[3240],{

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

/***/ 7525
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   B: () => (/* binding */ getWebGpuColors),
/* harmony export */   o: () => (/* binding */ setupWebGpuColors)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);



// src/webgpu-color-state.ts
var setupWebGpuColors = (target, label) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const colorContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!colorContext)
    throw new Error("Failed to acquire 2D context for color parsing");
  return { ...(0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, label), colorContext, colors: null };
};
var getWebGpuColors = (state, colors) => {
  const key = JSON.stringify(colors);
  if (state.colors?.key === key)
    return state.colors.data;
  const data = new Uint8Array(colors.length * 4);
  for (let i = 0;i < colors.length; i++)
    data.set((0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorContext, colors[i]), i * 4);
  state.colors = { key, data };
  return data;
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

/***/ 3240
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  starburst: () => (/* reexport */ starburst2),
  starburstEffectSchema: () => (/* reexport */ starburstEffectSchema2)
});

// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4svzhprm.mjs
var index_4svzhprm = __webpack_require__(9728);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-dbd2m8bp.mjs
var index_dbd2m8bp = __webpack_require__(7525);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/index.mjs
var esm = __webpack_require__(3947);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/no-react.mjs
var no_react = __webpack_require__(9382);
;// ./node_modules/@remotion/effects/dist/esm/preview/index-v5818yqm.mjs



// src/starburst.ts



// src/starburst-webgpu-shader.ts
var STARBURST_WEBGPU_SHADER = `
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var palette: texture_2d<f32>;
struct Params {
 geometry: vec4f,
 values: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}
fn glslModulo(value: f32, divisor: f32) -> f32 { return value - divisor * floor(value / divisor); }
fn paletteColor(index: f32) -> vec4f { return textureLoad(palette, vec2i(i32(index), 0), 0); }

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 var center = vec2f(input.position.x, params.geometry.y - input.position.y) / params.geometry.xy - params.values.zw;
 center.x *= params.geometry.x / params.geometry.y;
 let angle = atan2(center.y, center.x) + params.values.x;
 let normalizedAngle = (angle + 3.14159265359) / (2.0 * 3.14159265359);
 let sector = normalizedAngle * params.geometry.z;
 let rayIndex = glslModulo(floor(sector), params.geometry.z);
 let colorIndex = glslModulo(rayIndex, params.geometry.w);
 var col = paletteColor(colorIndex).rgb;
 let fractSector = fract(sector);
 let edgeSmooth = params.values.y * 0.5;
 let nextColorIndex = glslModulo(rayIndex + 1.0, params.geometry.w);
 let nextCol = paletteColor(nextColorIndex).rgb;
 let blend = smoothstep(1.0 - edgeSmooth, 1.0, fractSector);
 col = mix(col, nextCol, blend);
 let blendStart = smoothstep(edgeSmooth, 0.0, fractSector);
 let prevColorIndex = glslModulo(rayIndex - 1.0 + params.geometry.w, params.geometry.w);
 let prevCol = paletteColor(prevColorIndex).rgb;
 col = mix(col, prevCol, blendStart);
 return vec4f(col, 1.0);

}
`;

// src/starburst.ts
var { createEffect, createWebGL2ContextError } = esm.Internals;
var colorToRgb = (color) => {
  const packed = no_react/* NoReactInternals */.JC.processColor(color);
  return [packed >>> 16 & 255, packed >>> 8 & 255, packed & 255];
};
var DEFAULT_ORIGIN = [0.5, 0.5];
var starburstEffectSchema2 = {
  rays: {
    type: "number",
    min: 2,
    max: 100,
    step: 1,
    default: undefined,
    description: "Number of Rays",
    hiddenFromList: false
  },
  colors: {
    type: "array",
    item: {
      type: "color"
    },
    default: undefined,
    minLength: 2,
    newItemDefault: "#ff0000",
    description: "Colors",
    keyframable: false
  },
  rotation: {
    type: "number",
    min: 0,
    max: 360,
    step: 1,
    default: 0,
    description: "Rotation",
    hiddenFromList: false
  },
  smoothness: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
    description: "Edge Smoothness",
    hiddenFromList: false
  },
  origin: {
    type: "uv-coordinate",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_ORIGIN,
    description: "Origin"
  }
};
var resolve = (p) => ({
  rays: p.rays,
  colors: p.colors,
  rotation: p.rotation ?? 0,
  smoothness: p.smoothness ?? 0,
  origin: p.origin ?? DEFAULT_ORIGIN
});
var validateStarburstEffectParams = (params) => {
  if (params === null || typeof params !== "object") {
    throw new TypeError(`Starburst effect requires a parameters object, but got ${JSON.stringify(params)}`);
  }
  const { rays, colors } = params;
  if (typeof rays !== "number" || !Number.isFinite(rays)) {
    throw new TypeError(`"rays" must be a finite number, but got ${JSON.stringify(rays)}`);
  }
  if (rays < 2 || rays > 100) {
    throw new RangeError(`"rays" must be between 2 and 100, but got ${rays}`);
  }
  if (!Array.isArray(colors) || colors.length < 2) {
    throw new TypeError(`"colors" must be an array with at least 2 colors, but got ${JSON.stringify(colors)}`);
  }
  const r = resolve(params);
  if (typeof r.rotation !== "number" || !Number.isFinite(r.rotation)) {
    throw new TypeError(`"rotation" must be a finite number, but got ${JSON.stringify(params.rotation)}`);
  }
  if (typeof r.smoothness !== "number" || !Number.isFinite(r.smoothness)) {
    throw new TypeError(`"smoothness" must be a finite number, but got ${JSON.stringify(params.smoothness)}`);
  }
  if (r.smoothness < 0 || r.smoothness > 1) {
    throw new RangeError(`"smoothness" must be between 0 and 1, but got ${r.smoothness}`);
  }
  if (!Array.isArray(r.origin) || r.origin.length !== 2 || r.origin.some((coordinate) => {
    return typeof coordinate !== "number" || !Number.isFinite(coordinate);
  })) {
    throw new TypeError('"origin" must be a [number, number] tuple');
  }
  if (r.origin.some((coordinate) => coordinate < 0 || coordinate > 1)) {
    throw new RangeError(`"origin" must contain coordinates between 0 and 1, but got ${JSON.stringify(r.origin)}`);
  }
  for (const c of r.colors) {
    colorToRgb(c);
  }
};
var STARBURST_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;
void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var STARBURST_FS = `#version 300 es
precision highp float;

uniform sampler2D colorPalette;
uniform float numRays;
uniform float rotationOffset;
uniform float smoothEdge;
uniform vec2 resolution;
uniform float numColors;
uniform vec2 origin;

in vec2 vUv;
out vec4 fragColor;

const float Pi = 3.14159265359;

void main() {
	vec2 uv = gl_FragCoord.xy / resolution;
	vec2 center = uv - origin;
	center.x *= resolution.x / resolution.y;

	float angle = atan(center.y, center.x) + rotationOffset;
	float normalizedAngle = (angle + Pi) / (2.0 * Pi);
	float sector = normalizedAngle * numRays;
	float rayIndex = mod(floor(sector), numRays);

	float colorIndex = mod(rayIndex, numColors);
	float texCoord = (colorIndex + 0.5) / numColors;
	vec3 col = texture(colorPalette, vec2(texCoord, 0.5)).rgb;

	float fractSector = fract(sector);
	float edgeSmooth = smoothEdge * 0.5;
	float nextColorIndex = mod(rayIndex + 1.0, numColors);
	float nextTexCoord = (nextColorIndex + 0.5) / numColors;
	vec3 nextCol = texture(colorPalette, vec2(nextTexCoord, 0.5)).rgb;

	float blend = smoothstep(1.0 - edgeSmooth, 1.0, fractSector);
	col = mix(col, nextCol, blend);
	float blendStart = smoothstep(edgeSmooth, 0.0, fractSector);
	float prevColorIndex = mod(rayIndex - 1.0 + numColors, numColors);
	float prevTexCoord = (prevColorIndex + 0.5) / numColors;
	vec3 prevCol = texture(colorPalette, vec2(prevTexCoord, 0.5)).rgb;
	col = mix(col, prevCol, blendStart);

	fragColor = vec4(col, 1.0);
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
    throw new Error(`Starburst shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Starburst program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var starburst2 = createEffect({
  type: "remotion/starburst",
  label: "starburst()",
  documentationLink: "https://www.remotion.dev/docs/effects/starburst",
  calculateKey: (params) => {
    const r = resolve(params);
    return `starburst-${r.rays}-${r.colors.join("|")}-${r.rotation}-${r.smoothness}-${r.origin.join(":")}`;
  },
  implementations: {
    webgpu: esm.Internals.createEffectImplementation({
      setup: (target) => (0,index_dbd2m8bp/* setupWebGpuColors */.o)(target, "starburst"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the starburst effect");
        const r = resolve(params);
        const colors = new Uint8Array(r.colors.flatMap((color) => [...colorToRgb(color), 255]));
        const uniformData = new Float32Array([
          width,
          height,
          r.rays,
          r.colors.length,
          r.rotation * Math.PI / 180,
          r.smoothness,
          r.origin[0],
          1 - r.origin[1]
        ]);
        (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: STARBURST_WEBGPU_SHADER,
          uniformData
        }, {
          sourceFilter: null,
          auxiliaryTexture: {
            data: colors,
            width: r.colors.length,
            height: 1,
            format: "rgba8unorm"
          }
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
          throw createWebGL2ContextError("starburst effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, STARBURST_VS);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, STARBURST_FS);
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
        const paletteTexture = gl.createTexture();
        if (!paletteTexture) {
          throw new Error("Failed to create WebGL palette texture");
        }
        gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return {
          gl,
          program,
          vao,
          vbo,
          paletteTexture,
          uColorPalette: gl.getUniformLocation(program, "colorPalette"),
          uNumRays: gl.getUniformLocation(program, "numRays"),
          uRotationOffset: gl.getUniformLocation(program, "rotationOffset"),
          uSmoothEdge: gl.getUniformLocation(program, "smoothEdge"),
          uResolution: gl.getUniformLocation(program, "resolution"),
          uNumColors: gl.getUniformLocation(program, "numColors"),
          uOrigin: gl.getUniformLocation(program, "origin"),
          cachedPaletteKey: "",
          palettePixelData: new Uint8Array(0)
        };
      },
      apply: ({ width, height, params, state }) => {
        const r = resolve(params);
        const {
          gl,
          program,
          vao,
          paletteTexture,
          uColorPalette,
          uNumRays,
          uRotationOffset,
          uSmoothEdge,
          uResolution,
          uNumColors,
          uOrigin
        } = state;
        const rotationRad = r.rotation * Math.PI / 180;
        const paletteKey = r.colors.join("|");
        const paletteDirty = state.cachedPaletteKey !== paletteKey;
        if (paletteDirty) {
          state.cachedPaletteKey = paletteKey;
          const len = r.colors.length * 4;
          if (state.palettePixelData.length !== len) {
            state.palettePixelData = new Uint8Array(len);
          }
          const { palettePixelData } = state;
          for (let i = 0;i < r.colors.length; i++) {
            const rgb = colorToRgb(r.colors[i]);
            palettePixelData[i * 4] = rgb[0];
            palettePixelData[i * 4 + 1] = rgb[1];
            palettePixelData[i * 4 + 2] = rgb[2];
            palettePixelData[i * 4 + 3] = 255;
          }
        }
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
        if (paletteDirty) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.colors.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, state.palettePixelData);
        }
        if (uColorPalette)
          gl.uniform1i(uColorPalette, 0);
        if (uNumRays)
          gl.uniform1f(uNumRays, r.rays);
        if (uNumColors)
          gl.uniform1f(uNumColors, r.colors.length);
        if (uRotationOffset)
          gl.uniform1f(uRotationOffset, rotationRad);
        if (uSmoothEdge)
          gl.uniform1f(uSmoothEdge, r.smoothness);
        if (uOrigin)
          gl.uniform2f(uOrigin, r.origin[0], 1 - r.origin[1]);
        if (uResolution)
          gl.uniform2f(uResolution, width, height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, paletteTexture }) => {
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
        gl.deleteTexture(paletteTexture);
      }
    })
  },
  schema: starburstEffectSchema2,
  validateParams: validateStarburstEffectParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/starburst.mjs






/***/ }

}]);
//# sourceMappingURL=3240.bundle.js.map