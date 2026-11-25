"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[123],{

/***/ 123
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   filmBurn: () => (/* binding */ filmBurn),
/* harmony export */   filmBurnSchema: () => (/* binding */ filmBurnSchema)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6359);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/film-burn.ts


// src/film-burn-webgpu-shader.ts
var FILM_BURN_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

struct Params { size: vec2f, progress: f32, seed: u32, center: vec2f, }
fn lattice(point: vec3i, seed: u32) -> f32 {
  let p = bitcast<vec3u>(point);
  var h = (p.x * 0x27d4eb2du) ^ (p.y * 0x165667b1u) ^ (p.z * 0x9e3779b9u) ^ (seed * 0x85ebca6bu);
  h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u;
  return f32(h & 65535u) / 65535.0;
}
fn valueNoise(point: vec3f, seed: u32) -> f32 {
  let cell = vec3i(floor(point));
  let t = fract(point);
  let fade = t * t * t * (t * (t * 6.0 - vec3f(15.0)) + vec3f(10.0));
  let lower = mix(mix(lattice(cell,seed),lattice(cell+vec3i(1,0,0),seed),fade.x),mix(lattice(cell+vec3i(0,1,0),seed),lattice(cell+vec3i(1,1,0),seed),fade.x),fade.y);
  let upper = mix(mix(lattice(cell+vec3i(0,0,1),seed),lattice(cell+vec3i(1,0,1),seed),fade.x),mix(lattice(cell+vec3i(0,1,1),seed),lattice(cell+vec3i(1,1,1),seed),fade.x),fade.y);
  return mix(lower,upper,fade.z);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSampleLevel(source,sourceSampler,input.uv,0);
  if (params.progress <= 0.0 || color.a == 0.0) { return color; }
  if (params.progress >= 1.0) { return vec4f(0); }
  let pixel = input.uv * params.size;
  let distanceFromCenter = length(pixel-params.center*params.size)/max(length(params.size),1.0);
  var noise = 0.0; var amplitude = 1.0; var frequency = 1.0;
  for(var octave=0;octave<4;octave++) {
    noise += valueNoise(vec3f(pixel/60.0*frequency,f32(octave)*7.31),params.seed+17u+u32(octave))*amplitude;
    amplitude *= 0.5; frequency *= 2.0;
  }
  noise /= 1.875;
  let field = noise*0.65+(1.0-min(distanceFromCenter,1.0))*0.35;
  let threshold = 1.0-params.progress*1.25;
  let band = 0.12*min(params.progress*10.0,1.0);
  if(field>threshold+band) { return vec4f(0); }
  if(field<=threshold-band*2.0) { return color; }
  let scorch = smoothstep(threshold-band*2.0,threshold,field);
  let hot = smoothstep(threshold,threshold+band,field);
  var rgb = color.rgb/color.a*(1.0-scorch*0.85);
  rgb = vec3f(rgb.r+(1.0-rgb.r)*hot*0.9,rgb.g+(0.45-rgb.g)*hot*0.9,rgb.b*(1.0-hot));
  let alpha = color.a*(1.0-hot*0.6);
  return vec4f(rgb*alpha,alpha);
}

`;

// src/film-burn.ts
var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_PROGRESS = 0;
var DEFAULT_CENTER = [0.5, 0.5];
var DEFAULT_SEED = 0;
var filmBurnSchema = {
  progress: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_PROGRESS,
    description: "Progress",
    hiddenFromList: false
  },
  center: {
    type: "uv-coordinate",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_CENTER,
    description: "Center"
  },
  seed: {
    type: "number",
    min: 0,
    max: 4294967295,
    step: 1,
    integer: true,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  }
};
var resolve = (params) => ({
  progress: params.progress ?? DEFAULT_PROGRESS,
  center: params.center ?? DEFAULT_CENTER,
  seed: params.seed ?? DEFAULT_SEED
});
var validateFilmBurnParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Film burn");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.progress, "progress");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  if (params.center !== undefined) {
    if (!Array.isArray(params.center) || params.center.length !== 2) {
      throw new TypeError('"center" must be a [number, number] tuple');
    }
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(params.center[0], "center[0]");
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(params.center[1], "center[1]");
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(params.center[0], "center[0]");
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(params.center[1], "center[1]");
  }
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.progress, "progress");
  if (!Number.isInteger(r.seed) || r.seed < 0 || r.seed > 4294967295) {
    throw new TypeError('"seed" must be an unsigned 32-bit integer');
  }
};
var FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uProgress;
uniform vec2 uCenter;
uniform uint uSeed;

float lattice(ivec3 point, uint seed) {
	uvec3 p = uvec3(point);
	uint h = p.x * 0x27d4eb2du ^ p.y * 0x165667b1u
		^ p.z * 0x9e3779b9u ^ seed * 0x85ebca6bu;
	h ^= h >> 15;
	h *= 0x2c1b3c6du;
	h ^= h >> 12;
	h *= 0x297a2d39u;
	h ^= h >> 15;
	return float(h & 65535u) / 65535.0;
}

float valueNoise(vec3 point, uint seed) {
	ivec3 cell = ivec3(floor(point));
	vec3 t = fract(point);
	vec3 fade = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
	float lower = mix(
		mix(lattice(cell, seed), lattice(cell + ivec3(1, 0, 0), seed), fade.x),
		mix(lattice(cell + ivec3(0, 1, 0), seed), lattice(cell + ivec3(1, 1, 0), seed), fade.x),
		fade.y
	);
	float upper = mix(
		mix(lattice(cell + ivec3(0, 0, 1), seed), lattice(cell + ivec3(1, 0, 1), seed), fade.x),
		mix(lattice(cell + ivec3(0, 1, 1), seed), lattice(cell + ivec3(1, 1, 1), seed), fade.x),
		fade.y
	);
	return mix(lower, upper, fade.z);
}

void main() {
	vec4 source = texture(uSource, vUv);
	if (uProgress <= 0.0 || source.a == 0.0) {
		fragColor = source;
		return;
	}
	if (uProgress >= 1.0) {
		fragColor = vec4(0.0);
		return;
	}

	vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
	float distanceFromCenter = length(pixel - uCenter * uResolution)
		/ max(length(uResolution), 1.0);
	float noise = 0.0;
	float amplitude = 1.0;
	float frequency = 1.0;
	for (int octave = 0; octave < 4; octave++) {
		noise += valueNoise(
			vec3(pixel / 60.0 * frequency, float(octave) * 7.31),
			uSeed + 17u + uint(octave)
		) * amplitude;
		amplitude *= 0.5;
		frequency *= 2.0;
	}
	noise /= 1.875;
	float field = noise * 0.65 + (1.0 - min(distanceFromCenter, 1.0)) * 0.35;
	float threshold = 1.0 - uProgress * 1.25;
	float band = 0.12 * min(uProgress * 10.0, 1.0);
	if (field > threshold + band) {
		fragColor = vec4(0.0);
		return;
	}
	if (field <= threshold - band * 2.0) {
		fragColor = source;
		return;
	}

	float scorch = smoothstep(threshold - band * 2.0, threshold, field);
	float hot = smoothstep(threshold, threshold + band, field);
	vec3 color = source.rgb / source.a * (1.0 - scorch * 0.85);
	color = vec3(
		color.r + (1.0 - color.r) * hot * 0.9,
		color.g + (0.45 - color.g) * hot * 0.9,
		color.b * (1.0 - hot)
	);
	float alpha = source.a * (1.0 - hot * 0.6);
	fragColor = vec4(color * alpha, alpha);
}
`;
var filmBurn = createEffect({
  type: "remotion/film-burn",
  label: "filmBurn()",
  documentationLink: "https://www.remotion.dev/docs/effects/film-burn",
  calculateKey: (params) => {
    const r = resolve(params);
    return `film-burn-${r.progress}-${r.center.join(":")}-${r.seed}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "film-burn"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the film-burn effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          width,
          height,
          r.progress,
          0,
          r.center[0],
          r.center[1],
          0,
          0
        ]);
        new Uint32Array(uniformData.buffer)[3] = r.seed;
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: FILM_BURN_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupSinglePass */ .zE)(target, FRAGMENT_SHADER, "film burn", [
        "uResolution",
        "uProgress",
        "uCenter",
        "uSeed"
      ]),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, uniforms } = state;
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .prepareSinglePassSource */ .yc)({
          state,
          source,
          width,
          height,
          flipSourceY
        });
        if (uniforms.uResolution)
          gl.uniform2f(uniforms.uResolution, width, height);
        if (uniforms.uProgress)
          gl.uniform1f(uniforms.uProgress, r.progress);
        if (uniforms.uCenter)
          gl.uniform2f(uniforms.uCenter, r.center[0], r.center[1]);
        if (uniforms.uSeed)
          gl.uniform1ui(uniforms.uSeed, r.seed);
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .drawSinglePass */ .CT)(state);
      },
      cleanup: _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupSinglePass */ .ww
    })
  },
  schema: filmBurnSchema,
  validateParams: validateFilmBurnParams
});



/***/ },

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

/***/ 6359
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CT: () => (/* binding */ drawSinglePass),
/* harmony export */   ww: () => (/* binding */ cleanupSinglePass),
/* harmony export */   yc: () => (/* binding */ prepareSinglePassSource),
/* harmony export */   zE: () => (/* binding */ setupSinglePass)
/* harmony export */ });
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3947);
// src/single-pass-runtime.ts

var VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var setupSinglePass = (target, fragmentShader, effectName, uniformNames) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl)
    throw remotion__WEBPACK_IMPORTED_MODULE_0__.Internals.createWebGL2ContextError(`${effectName} effect`);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const shaders = [];
  const program = gl.createProgram();
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const texture = gl.createTexture();
  try {
    if (!program || !vao || !vbo || !texture) {
      throw new Error(`Could not allocate ${effectName} WebGL resources`);
    }
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX_SHADER],
      [gl.FRAGMENT_SHADER, fragmentShader]
    ]) {
      const shader = gl.createShader(type);
      if (!shader)
        throw new Error(`Could not create ${effectName} shader`);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`${effectName} shader compile failed: ${gl.getShaderInfoLog(shader)}`);
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`${effectName} program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
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
      uniforms: Object.fromEntries(["uSource", ...uniformNames].map((name) => [
        name,
        gl.getUniformLocation(program, name)
      ]))
    };
  } catch (error) {
    gl.deleteTexture(texture);
    gl.deleteBuffer(vbo);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders)
      gl.deleteShader(shader);
  }
};
var prepareSinglePassSource = ({
  state,
  source,
  width,
  height,
  flipSourceY
}) => {
  const { gl, program, texture, vao, uniforms } = state;
  gl.viewport(0, 0, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.useProgram(program);
  gl.uniform1i(uniforms.uSource, 0);
  gl.bindVertexArray(vao);
};
var drawSinglePass = ({ gl }) => {
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
};
var cleanupSinglePass = ({
  gl,
  program,
  vao,
  vbo,
  texture
}) => {
  gl.deleteTexture(texture);
  gl.deleteBuffer(vbo);
  gl.deleteProgram(program);
  gl.deleteVertexArray(vao);
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




/***/ }

}]);
//# sourceMappingURL=123.bundle.js.map