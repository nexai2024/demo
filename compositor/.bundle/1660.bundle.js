"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[1660],{

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

/***/ 1660
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   roughenEdges: () => (/* binding */ roughenEdges)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/roughen-edges.ts


// src/roughen-edges-webgpu-shader.ts
var ROUGHEN_EDGES_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

struct Params { size: vec2f, amount: f32, border: f32, scale: f32, seed: f32, }
@group(0) @binding(3) var noiseTexture: texture_2d<f32>;
fn sampleSource(uv: vec2f) -> vec4f { return textureSampleLevel(source,sourceSampler,clamp(vec2f(uv.x,1.0-uv.y),vec2f(0),vec2f(1)),0); }
fn sampleAlpha(uv: vec2f) -> f32 { return sampleSource(uv).a; }
fn seedOffset(salt: f32) -> vec2f {
  let seeded=params.seed+salt;
  return fract(sin(vec2f(seeded*12.9898+78.233,seeded*39.3468+11.135))*43758.5453);
}
fn randomR(p: vec2f) -> f32 {
  let uv=fract(floor(p)/100.0+vec2f(0.5));
  return textureLoad(noiseTexture,vec2i(floor(uv*vec2f(textureDimensions(noiseTexture)))),0).r;
}
fn valueNoise(st: vec2f) -> f32 {
  let i=floor(st); let f=fract(st); let u=f*f*(vec2f(3.0)-2.0*f);
  let a=randomR(i);let b=randomR(i+vec2f(1,0));let c=randomR(i+vec2f(0,1));let d=randomR(i+vec2f(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
fn fbm(point: vec2f) -> f32 {
  var n=point; var total=0.0; var amplitude=0.5;
  for(var i=0;i<4;i++) { total += valueNoise(n)*amplitude; n *= 2.03; amplitude *= 0.55; }
  return total;
}
fn edgeProximity(uv: vec2f,alpha: f32) -> f32 {
  if(params.border<=0.0) { return 0.0; }
  let reach=vec2f(max(params.border,1.0))/params.size;
  var minAlpha=alpha;var maxAlpha=alpha;
  for(var y=-1;y<=1;y++) { for(var x=-1;x<=1;x++) {
    let a=sampleAlpha(uv+vec2f(f32(x),f32(y))*reach);minAlpha=min(minAlpha,a);maxAlpha=max(maxAlpha,a);
  } }
  return smoothstep(0.02,0.35,maxAlpha-minAlpha);
}
fn alphaGradient(uv: vec2f) -> vec2f {
  let reach=vec2f(max(params.border*0.25,1.0))/params.size;
  return vec2f(sampleAlpha(uv+vec2f(reach.x,0))-sampleAlpha(uv-vec2f(reach.x,0)),sampleAlpha(uv+vec2f(0,reach.y))-sampleAlpha(uv-vec2f(0,reach.y)));
}
fn edgeNoise(uv: vec2f,salt: f32) -> f32 {
  var patternUV=uv-vec2f(0.5);
  patternUV *= vec2f(params.size.x/max(params.size.y,1.0),1.0);
  patternUV *= 7.0/max(params.scale,0.001);
  patternUV += 64.0*seedOffset(salt);
  return fbm(patternUV);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let uv=vec2f(input.uv.x,1.0-input.uv.y);
  let color=sampleSource(uv);
  if(params.amount<=0.0 || params.border<=0.0) { return color; }
  let proximity=edgeProximity(uv,color.a);
  if(proximity<=0.001) { return color; }
  let gradient=alphaGradient(uv);
  let noiseVector=vec2f(edgeNoise(uv+vec2f(0.17,0),2.0),edgeNoise(uv+vec2f(0,0.31),3.0))*2.0-vec2f(1.0);
  var direction=gradient+0.7*noiseVector;
  if(length(direction)<=0.0001) { direction=select(noiseVector,vec2f(1,0),length(noiseVector)<=0.0001); }
  direction=normalize(direction);
  let scalar=edgeNoise(uv,4.0)*2.0-1.0;
  let offset=direction*scalar*params.border/params.size;
  return mix(color,sampleSource(uv+offset),clamp(proximity*params.amount,0.0,1.0));
}

`;

// src/roughen-edges.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals;
var DEFAULT_AMOUNT = 1;
var DEFAULT_BORDER = 26.5;
var DEFAULT_SCALE = 0.07;
var DEFAULT_SEED = 231.2;
var MAX_BORDER = 200;
var MAX_SEED = 1000;
var NOISE_TEXTURE_SIZE = 256;
var roughenEdgesSchema = {
  amount: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_AMOUNT,
    description: "Amount",
    hiddenFromList: false
  },
  border: {
    type: "number",
    min: 0,
    max: MAX_BORDER,
    step: 0.1,
    default: DEFAULT_BORDER,
    description: "Border",
    hiddenFromList: false
  },
  scale: {
    type: "number",
    min: 0.01,
    max: 4,
    step: 0.01,
    default: DEFAULT_SCALE,
    description: "Scale",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    min: 0,
    max: MAX_SEED,
    step: 0.01,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  amount: p.amount ?? DEFAULT_AMOUNT,
  border: p.border ?? DEFAULT_BORDER,
  scale: p.scale ?? DEFAULT_SCALE,
  seed: p.seed ?? DEFAULT_SEED
});
var validateAtMost = (value, max, name) => {
  if (value > max) {
    throw new TypeError(`"${name}" must be <= ${max}, but got ${JSON.stringify(value)}`);
  }
};
var validateRoughenEdgesParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Roughen edges");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.border, "border");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.scale, "scale");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.border, "border");
  validateAtMost(r.border, MAX_BORDER, "border");
  if (r.scale <= 0) {
    throw new TypeError(`"scale" must be greater than 0, but got ${JSON.stringify(r.scale)}`);
  }
  validateAtMost(r.scale, 4, "scale");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.seed, "seed");
  validateAtMost(r.seed, MAX_SEED, "seed");
};
var ROUGHEN_EDGES_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var ROUGHEN_EDGES_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uBorder;
uniform float uScale;
uniform float uSeed;
uniform sampler2D uNoiseTexture;

float sampleAlpha(vec2 uv) {
	return texture(uSource, clamp(uv, vec2(0.0), vec2(1.0))).a;
}

vec2 seedOffset(float salt) {
	float seeded = uSeed + salt;
	return fract(
		sin(
			vec2(
				seeded * 12.9898 + 78.233,
				seeded * 39.3468 + 11.135
			)
		) * 43758.5453
	);
}

float randomR(vec2 p) {
	vec2 uv = floor(p) / 100.0 + 0.5;
	return texture(uNoiseTexture, fract(uv)).r;
}

float valueNoise(vec2 st) {
	vec2 i = floor(st);
	vec2 f = fract(st);
	float a = randomR(i);
	float b = randomR(i + vec2(1.0, 0.0));
	float c = randomR(i + vec2(0.0, 1.0));
	float d = randomR(i + vec2(1.0, 1.0));
	vec2 u = f * f * (3.0 - 2.0 * f);
	float x1 = mix(a, b, u.x);
	float x2 = mix(c, d, u.x);
	return mix(x1, x2, u.y);
}

float fbm(vec2 n) {
	float total = 0.0;
	float amplitude = 0.5;
	for (int i = 0; i < 4; i++) {
		total += valueNoise(n) * amplitude;
		n *= 2.03;
		amplitude *= 0.55;
	}
	return total;
}

void addAlphaSample(
	vec2 uv,
	vec2 offset,
	inout float minAlpha,
	inout float maxAlpha
) {
	float alpha = sampleAlpha(uv + offset);
	minAlpha = min(minAlpha, alpha);
	maxAlpha = max(maxAlpha, alpha);
}

float edgeProximity(vec2 uv, float alpha) {
	if (uBorder <= 0.0) {
		return 0.0;
	}

	vec2 reach = max(uBorder, 1.0) / uResolution;
	float minAlpha = alpha;
	float maxAlpha = alpha;

	addAlphaSample(uv, vec2(reach.x, 0.0), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(-reach.x, 0.0), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(0.0, reach.y), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(0.0, -reach.y), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(reach.x, reach.y), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(-reach.x, reach.y), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(reach.x, -reach.y), minAlpha, maxAlpha);
	addAlphaSample(uv, vec2(-reach.x, -reach.y), minAlpha, maxAlpha);

	return smoothstep(0.02, 0.35, maxAlpha - minAlpha);
}

vec2 alphaGradient(vec2 uv) {
	vec2 reach = max(uBorder * 0.25, 1.0) / uResolution;
	return vec2(
		sampleAlpha(uv + vec2(reach.x, 0.0)) -
			sampleAlpha(uv - vec2(reach.x, 0.0)),
		sampleAlpha(uv + vec2(0.0, reach.y)) -
			sampleAlpha(uv - vec2(0.0, reach.y))
	);
}

float edgeNoise(vec2 uv, float salt) {
	vec2 patternUV = uv - 0.5;
	patternUV *= vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
	patternUV *= 7.0 / max(uScale, 0.001);
	patternUV += 64.0 * seedOffset(salt);
	return fbm(patternUV);
}

void main() {
	vec4 source = texture(uSource, vUv);

	if (uAmount <= 0.0 || uBorder <= 0.0) {
		fragColor = source;
		return;
	}

	float alpha = source.a;
	float proximity = edgeProximity(vUv, alpha);

	if (proximity <= 0.001) {
		fragColor = source;
		return;
	}

	vec2 gradient = alphaGradient(vUv);
	vec2 noiseVector = vec2(
		edgeNoise(vUv + vec2(0.17, 0.0), 2.0),
		edgeNoise(vUv + vec2(0.0, 0.31), 3.0)
	) * 2.0 - 1.0;
	vec2 direction = gradient + 0.7 * noiseVector;
	if (length(direction) <= 0.0001) {
		direction = length(noiseVector) <= 0.0001 ? vec2(1.0, 0.0) : noiseVector;
	}

	direction = normalize(direction);

	float scalar = edgeNoise(vUv, 4.0) * 2.0 - 1.0;
	vec2 offset = direction * scalar * uBorder / uResolution;
	vec4 roughened = texture(
		uSource,
		clamp(vUv + offset, vec2(0.0), vec2(1.0))
	);
	float blend = clamp(proximity * uAmount, 0.0, 1.0);

	fragColor = mix(source, roughened, blend);
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
    throw new Error(`Roughen edges shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Roughen edges program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createSourceTexture = (gl) => {
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
  return texture;
};
var initialNoiseState = (seed) => {
  const scaledSeed = Math.round(seed * 1000);
  const mixedState = (2654435769 ^ Math.imul(scaledSeed, 2246822507)) >>> 0;
  return mixedState === 0 ? 2654435769 : mixedState;
};
var nextNoiseState = (state) => {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
};
var createNoiseData = (seed) => {
  const data = new Uint8Array(NOISE_TEXTURE_SIZE * NOISE_TEXTURE_SIZE * 4);
  let state = initialNoiseState(seed);
  for (let i = 0;i < data.length; i += 4) {
    state = nextNoiseState(state);
    data[i] = state & 255;
    state = nextNoiseState(state);
    data[i + 1] = state & 255;
    state = nextNoiseState(state);
    data[i + 2] = state & 255;
    data[i + 3] = 255;
  }
  return data;
};
var uploadNoiseTexture = (gl, texture, seed) => {
  const data = createNoiseData(seed);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE_TEXTURE_SIZE, NOISE_TEXTURE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
};
var createNoiseTexture = (gl) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create WebGL noise texture");
  }
  uploadNoiseTexture(gl, texture, DEFAULT_SEED);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
};
var setupRoughenEdges = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("roughen edges effect");
  }
  const vs = compileShader(gl, gl.VERTEX_SHADER, ROUGHEN_EDGES_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, ROUGHEN_EDGES_FS);
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
  const sourceTexture = createSourceTexture(gl);
  const noiseTexture = createNoiseTexture(gl);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  return {
    gl,
    program,
    vao,
    vbo,
    sourceTexture,
    noiseTexture,
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uAmount: gl.getUniformLocation(program, "uAmount"),
      uBorder: gl.getUniformLocation(program, "uBorder"),
      uScale: gl.getUniformLocation(program, "uScale"),
      uSeed: gl.getUniformLocation(program, "uSeed"),
      uNoiseTexture: gl.getUniformLocation(program, "uNoiseTexture")
    },
    cachedNoiseSeed: DEFAULT_SEED
  };
};
var roughenEdges = createEffect({
  type: "dev.remotion.effects.roughen-edges",
  label: "roughenEdges()",
  documentationLink: "https://www.remotion.dev/docs/effects/roughen-edges",
  calculateKey: (params) => {
    const r = resolve(params);
    return `roughen-edges-${r.amount}-${r.border}-${r.scale}-${r.seed}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => ({
        ...(0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "roughen-edges"),
        noiseData: new Uint8Array(0),
        noiseSeed: null
      }),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the roughen-edges effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          width,
          height,
          r.amount,
          r.border,
          r.scale,
          r.seed,
          0,
          0
        ]);
        if (state.noiseSeed !== r.seed) {
          state.noiseData = createNoiseData(r.seed);
          state.noiseSeed = r.seed;
        }
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: ROUGHEN_EDGES_WEBGPU_SHADER,
          uniformData
        }, {
          sourceFilter: null,
          auxiliaryTexture: {
            data: state.noiseData,
            width: NOISE_TEXTURE_SIZE,
            height: NOISE_TEXTURE_SIZE,
            format: "rgba8unorm"
          }
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => setupRoughenEdges(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, sourceTexture, noiseTexture, uniforms } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
        if (state.cachedNoiseSeed !== r.seed) {
          uploadNoiseTexture(gl, noiseTexture, r.seed);
          state.cachedNoiseSeed = r.seed;
        }
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uResolution)
          gl.uniform2f(uniforms.uResolution, width, height);
        if (uniforms.uAmount)
          gl.uniform1f(uniforms.uAmount, r.amount);
        if (uniforms.uBorder)
          gl.uniform1f(uniforms.uBorder, r.border);
        if (uniforms.uScale)
          gl.uniform1f(uniforms.uScale, r.scale);
        if (uniforms.uSeed)
          gl.uniform1f(uniforms.uSeed, r.seed);
        if (uniforms.uNoiseTexture)
          gl.uniform1i(uniforms.uNoiseTexture, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, sourceTexture, noiseTexture }) => {
        gl.deleteTexture(sourceTexture);
        gl.deleteTexture(noiseTexture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: roughenEdgesSchema,
  validateParams: validateRoughenEdgesParams
});



/***/ }

}]);
//# sourceMappingURL=1660.bundle.js.map