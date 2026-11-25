"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[1037],{

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

/***/ 1037
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pixelDissolve: () => (/* binding */ pixelDissolve)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/pixel-dissolve.ts


// src/pixel-dissolve-webgpu-shader.ts
var PIXEL_DISSOLVE_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

struct Params { progress: f32, columns: f32, rows: f32, seed: f32, feather: f32, }

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(p.xyx * vec3f(443.8975, 397.2973, 491.1871));
  p3 += vec3f(dot(p3, p3.yzx + vec3f(19.19)));
  return fract((p3.x + p3.y) * p3.z);
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let divisions = max(vec2f(params.columns, params.rows), vec2f(1));
  let uv = vec2f(input.uv.x, 1.0 - input.uv.y);
  let cell = floor(min(uv, vec2f(1.0 - 0.000001)) * divisions + vec2f(0.00001));
  let color = textureSampleLevel(source, sourceSampler, input.uv, 0);
  let noise = hash21(cell + vec2f(params.seed, params.seed * 1.618));
  let edge = max(params.feather, 0.0);
  let threshold = 1.0 - clamp(params.progress, 0.0, 1.0) * (1.0 + edge);
  var mask: f32;
  if (edge <= 0.0001) { mask = 1.0 - step(threshold, noise); }
  else { mask = 1.0 - smoothstep(threshold, threshold + edge, noise); }
  return color * mask;
}

`;

// src/pixel-dissolve.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals;
var DEFAULT_PROGRESS = 0.5;
var DEFAULT_COLUMNS = 10;
var DEFAULT_ROWS = 10;
var DEFAULT_SEED = 0;
var DEFAULT_FEATHER = 0.15;
var pixelDissolveSchema = {
  progress: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_PROGRESS,
    description: "Progress",
    hiddenFromList: false
  },
  columns: {
    type: "number",
    min: 1,
    max: 400,
    step: 1,
    integer: true,
    default: DEFAULT_COLUMNS,
    description: "Columns",
    hiddenFromList: false
  },
  rows: {
    type: "number",
    min: 1,
    max: 400,
    step: 1,
    integer: true,
    default: DEFAULT_ROWS,
    description: "Rows",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    step: 1,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  },
  feather: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_FEATHER,
    description: "Feather",
    hiddenFromList: false
  }
};
var resolve = (params) => ({
  progress: params.progress ?? DEFAULT_PROGRESS,
  columns: params.columns ?? DEFAULT_COLUMNS,
  rows: params.rows ?? DEFAULT_ROWS,
  seed: params.seed ?? DEFAULT_SEED,
  feather: params.feather ?? DEFAULT_FEATHER
});
var assertOptionalIntegerNumber = (value, name) => {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value)) {
    throw new TypeError(`"${name}" must be an integer, but got ${JSON.stringify(value)}`);
  }
};
var validatePixelDissolveParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Pixel Dissolve");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.progress, "progress");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.columns, "columns");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.rows, "rows");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.feather, "feather");
  assertOptionalIntegerNumber(params.columns, "columns");
  assertOptionalIntegerNumber(params.rows, "rows");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.progress, "progress");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.feather, "feather");
  if (r.columns < 1) {
    throw new TypeError(`"columns" must be >= 1, but got ${JSON.stringify(r.columns)}`);
  }
  if (r.rows < 1) {
    throw new TypeError(`"rows" must be >= 1, but got ${JSON.stringify(r.rows)}`);
  }
};
var VERTEX_SHADER = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uProgress;
uniform float uColumns;
uniform float uRows;
uniform float uSeed;
uniform float uFeather;

float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
	p3 += dot(p3, p3.yzx + 19.19);
	return fract((p3.x + p3.y) * p3.z);
}

float dissolveMask(float noise, float progress, float feather) {
	float edge = max(feather, 0.0);
	float threshold = 1.0 - clamp(progress, 0.0, 1.0) * (1.0 + edge);

	if (edge <= 0.0001) {
		return 1.0 - step(threshold, noise);
	}

	return 1.0 - smoothstep(threshold, threshold + edge, noise);
}

void main() {
	vec2 divisions = max(vec2(uColumns, uRows), vec2(1.0));
	vec2 gridUv = min(vUv, vec2(1.0) - vec2(0.000001));
	// Stabilize cells when a pixel center falls exactly on a grid boundary.
	vec2 cell = floor(gridUv * divisions + vec2(0.00001));
	vec4 color = texture(uSource, vUv);

	float noise = hash21(cell + vec2(uSeed, uSeed * 1.618));
	float mask = dissolveMask(noise, uProgress, uFeather);

	fragColor = vec4(color.rgb * mask, color.a * mask);
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
    throw new Error(`Pixel Dissolve shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Pixel Dissolve program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createFullscreenQuad = (gl) => {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create WebGL vertex array");
  }
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  if (!vbo) {
    throw new Error("Failed to create WebGL buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  return { vao, vbo };
};
var pixelDissolve = createEffect({
  type: "dev.remotion.effects.pixelDissolve",
  label: "pixelDissolve()",
  documentationLink: "https://www.remotion.dev/docs/effects/pixel-dissolve",
  calculateKey: (params) => {
    const r = resolve(params);
    return `pixel-dissolve-${r.progress}-${r.columns}-${r.rows}-${r.seed}-${r.feather}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "pixel-dissolve"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the pixel-dissolve effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          r.progress,
          r.columns,
          r.rows,
          r.seed,
          r.feather,
          0,
          0,
          0
        ]);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: PIXEL_DISSOLVE_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("pixel dissolve effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        const program = linkProgram(gl, vs, fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        const { vao, vbo } = createFullscreenQuad(gl);
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return {
          gl,
          program,
          vao,
          vbo,
          texture,
          uSource: gl.getUniformLocation(program, "uSource"),
          uProgress: gl.getUniformLocation(program, "uProgress"),
          uColumns: gl.getUniformLocation(program, "uColumns"),
          uRows: gl.getUniformLocation(program, "uRows"),
          uSeed: gl.getUniformLocation(program, "uSeed"),
          uFeather: gl.getUniformLocation(program, "uFeather")
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        state.gl.viewport(0, 0, width, height);
        state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, null);
        state.gl.clearColor(0, 0, 0, 0);
        state.gl.clear(state.gl.COLOR_BUFFER_BIT);
        state.gl.useProgram(state.program);
        state.gl.bindVertexArray(state.vao);
        state.gl.activeTexture(state.gl.TEXTURE0);
        state.gl.bindTexture(state.gl.TEXTURE_2D, state.texture);
        state.gl.pixelStorei(state.gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        state.gl.texImage2D(state.gl.TEXTURE_2D, 0, state.gl.RGBA, state.gl.RGBA, state.gl.UNSIGNED_BYTE, source);
        if (state.uSource)
          state.gl.uniform1i(state.uSource, 0);
        if (state.uProgress)
          state.gl.uniform1f(state.uProgress, r.progress);
        if (state.uColumns)
          state.gl.uniform1f(state.uColumns, r.columns);
        if (state.uRows)
          state.gl.uniform1f(state.uRows, r.rows);
        if (state.uSeed)
          state.gl.uniform1f(state.uSeed, r.seed);
        if (state.uFeather)
          state.gl.uniform1f(state.uFeather, r.feather);
        state.gl.drawArrays(state.gl.TRIANGLE_STRIP, 0, 4);
        state.gl.bindVertexArray(null);
        state.gl.bindTexture(state.gl.TEXTURE_2D, null);
        state.gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteTexture(texture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: pixelDissolveSchema,
  validateParams: validatePixelDissolveParams
});



/***/ }

}]);
//# sourceMappingURL=1037.bundle.js.map