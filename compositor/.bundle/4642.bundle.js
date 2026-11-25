"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[4642],{

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

/***/ 4642
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  lightLeak: () => (/* reexport */ lightLeak2),
  lightLeakEffectSchema: () => (/* reexport */ lightLeakEffectSchema2)
});

// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4svzhprm.mjs
var index_4svzhprm = __webpack_require__(9728);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-wxhvgv2s.mjs
var index_wxhvgv2s = __webpack_require__(8197);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4fvp93ps.mjs
var index_4fvp93ps = __webpack_require__(4075);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/index.mjs
var esm = __webpack_require__(3947);
;// ./node_modules/@remotion/effects/dist/esm/preview/index-g0fjkbyr.mjs




// src/light-leak.ts


// src/light-leak-webgpu-shader.ts
var LIGHT_LEAK_WEBGPU_SHADER = `
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

struct Params { size: vec2f, progress: f32, seed: f32, hue: f32, }
fn computePattern(uv: vec2f, s: f32, t: f32) -> vec3f {
  var p = uv * 0.8 + vec2f(sin(s * 1.61803) * 5.0, cos(s * 2.71828) * 5.0);
  for (var i = 1; i < 5; i++) {
    var newp = p;
    let fi = f32(i);
    let phase = s * 0.7 * fi;
    newp.x += 0.6 / fi * cos(fi * p.y + t * 0.7 + 0.3 * fi + phase) + 20.0;
    newp.y += 0.6 / fi * cos(fi * p.x + t * 0.7 + 0.3 * f32(i + 10) + phase) - 20.0 + 15.0;
    p = newp;
  }
  let v1 = 0.5 * sin(2.0 * p.x) + 0.5;
  let v2 = 0.5 * sin(2.0 * p.y) + 0.5;
  let blend = sin(p.x + p.y) * 0.5 + 0.5;
  let brightness = v1 * 0.5 + v2 * 0.5;
  return vec3f(brightness, blend, brightness * 0.6 + blend * 0.4);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let evolveProgress = min(1.0, params.progress * 2.0);
  let retractProgress = max(0.0, params.progress * 2.0 - 1.0);
  let refScale = 1.92;
  let uv = (vec2f(input.position.x, params.size.y - input.position.y) / params.size) * vec2f(refScale, refScale * params.size.y / params.size.x);
  let patA = computePattern(uv, params.seed, evolveProgress * 3.14159);
  let threshA = 1.0 - evolveProgress;
  let revealAlpha = smoothstep(threshA, threshA + 0.3, patA.z);
  let maxUv = vec2f(refScale, refScale * params.size.y / params.size.x);
  let patB = computePattern(maxUv - uv, params.seed + 42.0, retractProgress * 3.14159);
  let threshB = 1.0 - retractProgress;
  let eraseAlpha = smoothstep(threshB, threshB + 0.3, patB.z);
  let alpha = revealAlpha * (1.0 - eraseAlpha);
  var col = mix(vec3f(1.0, 0.85, 0.2), vec3f(1.0, 0.5, 0.05), patA.y) * (0.6 + 0.6 * patA.x);
  let angle = params.hue * 3.14159 / 180.0;
  let a = cos(angle);
  let b = sin(angle) * 0.57735;
  let c = (1.0 - a) / 3.0;
  let hueRot = mat3x3f(vec3f(a+c,c-b,c+b),vec3f(c+b,a+c,c-b),vec3f(c-b,c+b,a+c));
  col = clamp(hueRot * col, vec3f(0), vec3f(1));
  let color = textureSampleLevel(source, sourceSampler, input.uv, 0);
  return vec4f(col * alpha, alpha) + color * (1.0 - alpha);
}

`;

// src/light-leak.ts
var { createEffect, createWebGL2ContextError } = esm.Internals;
var DEFAULT_SEED = 0;
var DEFAULT_HUE_SHIFT = 0;
var DEFAULT_PROGRESS = 0.5;
var lightLeakEffectSchema2 = {
  seed: {
    type: "number",
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  },
  hueShift: {
    type: "number",
    min: 0,
    max: 360,
    default: DEFAULT_HUE_SHIFT,
    description: "Hue Shift",
    hiddenFromList: false
  },
  progress: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_PROGRESS,
    description: "Progress",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  seed: p.seed ?? DEFAULT_SEED,
  hueShift: p.hueShift ?? DEFAULT_HUE_SHIFT,
  progress: p.progress ?? DEFAULT_PROGRESS
});
var validateLightLeakParams = (params) => {
  (0,index_4fvp93ps/* assertEffectParamsObject */.db)(params, "lightLeak()");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.seed, "seed");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.hueShift, "hueShift");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.progress, "progress");
  const { hueShift, progress } = resolve(params);
  if (hueShift < 0) {
    throw new TypeError(`"hueShift" must be >= 0, but got ${hueShift}`);
  }
  if (hueShift > 360) {
    throw new TypeError(`"hueShift" must be <= 360, but got ${hueShift}`);
  }
  (0,index_wxhvgv2s/* validateUnitInterval */.yk)(progress, "progress");
};
var LIGHT_LEAK_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;
void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var LIGHT_LEAK_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float evolveProgress;
uniform float retractProgress;
uniform float seed;
uniform float retractSeed;
uniform float hueShift;
uniform vec2 resolution;

const float Pi = 3.14159;

vec3 computePattern(vec2 uv, float s, float t) {
	vec2 p = uv * 0.8;
	p += vec2(sin(s * 1.61803) * 5.0, cos(s * 2.71828) * 5.0);

	for (int i = 1; i < 5; i++) {
		vec2 newp = p;
		float fi = float(i);
		float phase = s * 0.7 * fi;
		newp.x += 0.6 / fi * cos(fi * p.y + t * 0.7 + 0.3 * fi + phase) + 20.0;
		newp.y += 0.6 / fi * cos(fi * p.x + t * 0.7 + 0.3 * float(i + 10) + phase) - 20.0 + 15.0;
		p = newp;
	}

	float v1 = 0.5 * sin(2.0 * p.x) + 0.5;
	float v2 = 0.5 * sin(2.0 * p.y) + 0.5;
	float blend = sin(p.x + p.y) * 0.5 + 0.5;
	float brightness = v1 * 0.5 + v2 * 0.5;
	float patternValue = brightness * 0.6 + blend * 0.4;

	return vec3(brightness, blend, patternValue);
}

void main() {
	float refScale = 1.92;
	vec2 uv = (gl_FragCoord.xy / resolution) * vec2(refScale, refScale * resolution.y / resolution.x);

	vec3 patA = computePattern(uv, seed, evolveProgress * Pi);
	float threshA = 1.0 - evolveProgress;
	float revealAlpha = smoothstep(threshA, threshA + 0.3, patA.z);

	vec2 maxUv = vec2(refScale, refScale * resolution.y / resolution.x);
	vec2 retractUv = maxUv - uv;
	vec3 patB = computePattern(retractUv, retractSeed, retractProgress * Pi);
	float threshB = 1.0 - retractProgress;
	float eraseAlpha = smoothstep(threshB, threshB + 0.3, patB.z);

	float alpha = revealAlpha * (1.0 - eraseAlpha);

	vec3 yellow = vec3(1.0, 0.85, 0.2);
	vec3 orange = vec3(1.0, 0.5, 0.05);
	vec3 col = mix(yellow, orange, patA.y);
	col *= 0.6 + 0.6 * patA.x;

	float angle = hueShift * Pi / 180.0;
	float cosA = cos(angle);
	float sinA = sin(angle);
	mat3 hueRot = mat3(
		cosA + (1.0 - cosA) / 3.0,
		(1.0 - cosA) / 3.0 - sinA * 0.57735,
		(1.0 - cosA) / 3.0 + sinA * 0.57735,
		(1.0 - cosA) / 3.0 + sinA * 0.57735,
		cosA + (1.0 - cosA) / 3.0,
		(1.0 - cosA) / 3.0 - sinA * 0.57735,
		(1.0 - cosA) / 3.0 - sinA * 0.57735,
		(1.0 - cosA) / 3.0 + sinA * 0.57735,
		cosA + (1.0 - cosA) / 3.0
	);
	col = clamp(hueRot * col, 0.0, 1.0);

	vec4 src = texture(uSource, vUv);
	vec4 leakPm = vec4(col * alpha, alpha);
	fragColor = leakPm + src * (1.0 - alpha);
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
    throw new Error(`Light leak shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Light leak program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var lightLeak2 = createEffect({
  type: "remotion/light-leak",
  label: "lightLeak()",
  documentationLink: "https://www.remotion.dev/docs/effects/light-leak",
  calculateKey: (params) => {
    const r = resolve(params);
    return `light-leak-${r.seed}-${r.hueShift}-${r.progress}`;
  },
  implementations: {
    webgpu: esm.Internals.createEffectImplementation({
      setup: (target) => (0,index_4svzhprm/* setupWebGpuSinglePass */.DS)(target, "light-leak"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the light-leak effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          width,
          height,
          r.progress,
          r.seed,
          r.hueShift,
          0,
          0,
          0
        ]);
        (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: LIGHT_LEAK_WEBGPU_SHADER,
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
          throw createWebGL2ContextError("light leak effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, LIGHT_LEAK_VS);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, LIGHT_LEAK_FS);
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return {
          gl,
          program,
          vao,
          vbo,
          texture,
          uSource: gl.getUniformLocation(program, "uSource"),
          uEvolveProgress: gl.getUniformLocation(program, "evolveProgress"),
          uRetractProgress: gl.getUniformLocation(program, "retractProgress"),
          uSeed: gl.getUniformLocation(program, "seed"),
          uRetractSeed: gl.getUniformLocation(program, "retractSeed"),
          uHueShift: gl.getUniformLocation(program, "hueShift"),
          uResolution: gl.getUniformLocation(program, "resolution")
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const evolveProgress = Math.min(1, r.progress * 2);
        const retractProgress = Math.max(0, r.progress * 2 - 1);
        const {
          gl,
          program,
          vao,
          texture,
          uSource,
          uEvolveProgress,
          uRetractProgress,
          uSeed,
          uRetractSeed,
          uHueShift,
          uResolution
        } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (uSource)
          gl.uniform1i(uSource, 0);
        if (uEvolveProgress)
          gl.uniform1f(uEvolveProgress, evolveProgress);
        if (uRetractProgress)
          gl.uniform1f(uRetractProgress, retractProgress);
        if (uSeed)
          gl.uniform1f(uSeed, r.seed);
        if (uRetractSeed)
          gl.uniform1f(uRetractSeed, r.seed + 42);
        if (uHueShift)
          gl.uniform1f(uHueShift, r.hueShift);
        if (uResolution)
          gl.uniform2f(uResolution, width, height);
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
  schema: lightLeakEffectSchema2,
  validateParams: validateLightLeakParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/light-leak.mjs





/***/ }

}]);
//# sourceMappingURL=4642.bundle.js.map