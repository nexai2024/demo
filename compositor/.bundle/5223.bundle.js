"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5223],{

/***/ 5223
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   burlap: () => (/* binding */ burlap)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(7525);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/burlap.ts


// src/burlap-webgpu-shader.ts
var BURLAP_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {
 geometry: vec4f,
 values: vec4f,
 color: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}
fn glslModulo(value: f32, divisor: f32) -> f32 { return value - divisor * floor(value / divisor); }

fn hash21(p: vec2f) -> f32 {
 var p3 = fract(p.xyx * vec3f(443.8975, 397.2973, 491.1871));
 p3 += vec3f(dot(p3, p3.yzx + vec3f(19.19) + vec3f(params.values.y * 0.137)));
 return fract((p3.x + p3.y) * p3.z);
}
fn valueNoise(p: vec2f) -> f32 {
 let i = floor(p);
 var f = fract(p);
 f = f * f * (vec2f(3.0) - 2.0 * f);
 let a = hash21(i);
 let b = hash21(i + vec2f(1, 0));
 let c = hash21(i + vec2f(0, 1));
 let d = hash21(i + vec2f(1, 1));
 return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
fn strand(value: f32) -> f32 {
 let centered = abs(fract(value) - 0.5);
 return 1.0 - smoothstep(0.2, 0.5, centered);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 let texColor = sampleSource(vUv);
 let alpha = texColor.a;
 if (alpha <= 0.001) { return vec4f(0); }
 if (params.geometry.z <= 0.0) { return texColor; }
 // Match WebGL pixel centers without interpolated-UV rounding.
 let fragPos = vec2f(input.position.x, params.geometry.y - input.position.y);
 let strandSize = max(params.geometry.w, 0.001);
 let weave = fragPos / strandSize;
 let roughness = params.values.x;
 let seed = params.values.y;
 let rowJitter = (hash21(vec2f(floor(weave.y), 13.17)) - 0.5) * roughness * 0.28;
 let columnJitter = (hash21(vec2f(71.43, floor(weave.x))) - 0.5) * roughness * 0.28;
 let vertical = strand(weave.x + rowJitter);
 let horizontal = strand(weave.y + columnJitter);
 let cellParity = glslModulo(floor(weave.x) + floor(weave.y), 2.0);
 let overUnder = mix(vertical, horizontal, cellParity);
 let ridge = max(max(vertical, horizontal) * 0.45, overUnder * 0.75);
 let gaps = (1.0 - vertical) * (1.0 - horizontal);
 let coarse = valueNoise(fragPos / (strandSize * 7.0) + vec2f(seed * 1.7, seed * 0.6));
 let fine = valueNoise(fragPos / max(strandSize * 0.55, 0.5) + vec2f(seed * 3.1, 4.7));
 let dashH = smoothstep(0.64, 0.98, hash21(floor(vec2f(weave.x * 2.0, weave.y)) + vec2f(23.9))) * horizontal;
 let dashV = smoothstep(0.64, 0.98, hash21(floor(vec2f(weave.x, weave.y * 2.0)) + vec2f(91.4))) * vertical;
 var texture = 0.0;
 texture += (ridge - 0.42) * 0.22;
 texture -= gaps * 0.18;
 texture += (coarse - 0.5) * 0.18 * roughness;
 texture += (fine - 0.5) * 0.16 * roughness;
 texture -= (dashH + dashV) * 0.08 * roughness;
 var rgb = texColor.rgb / alpha;
 let darkFiber = clamp(-texture * 3.2 + gaps * 0.12 + (dashH + dashV) * 0.18, 0.0, 1.0);
 let shaded = mix(rgb, params.color.rgb, darkFiber * params.color.a);
 let textured = clamp(shaded * (1.0 + max(texture, 0.0) * 0.45), vec3f(0), vec3f(1));
 rgb = mix(rgb, textured, params.geometry.z);
 return vec4f(rgb * alpha, alpha);

}
`;

// src/burlap.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_AMOUNT = 0.55;
var DEFAULT_SIZE = 5;
var DEFAULT_ROUGHNESS = 0.7;
var DEFAULT_SEED = 0;
var DEFAULT_COLOR = "#000000";
var burlapSchema = {
  amount: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_AMOUNT,
    description: "Amount",
    hiddenFromList: false
  },
  size: {
    type: "number",
    min: 0.1,
    max: 80,
    step: 0.1,
    default: DEFAULT_SIZE,
    description: "Size",
    hiddenFromList: false
  },
  roughness: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_ROUGHNESS,
    description: "Roughness",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    step: 1,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  },
  color: {
    type: "color",
    default: DEFAULT_COLOR,
    description: "Color"
  }
};
var resolve = (p) => ({
  amount: p.amount ?? DEFAULT_AMOUNT,
  size: p.size ?? DEFAULT_SIZE,
  roughness: p.roughness ?? DEFAULT_ROUGHNESS,
  seed: p.seed ?? DEFAULT_SEED,
  color: p.color ?? DEFAULT_COLOR
});
var validatePositive = (value, name) => {
  if (value <= 0) {
    throw new TypeError(`"${name}" must be greater than 0, but got ${JSON.stringify(value)}`);
  }
};
var validateBurlapParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Burlap");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.size, "size");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.roughness, "roughness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)(params.color, "color");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.amount, "amount");
  validatePositive(r.size, "size");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.roughness, "roughness");
};
var BURLAP_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var BURLAP_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uSize;
uniform float uRoughness;
uniform float uSeed;
uniform vec4 uColor;

float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
	p3 += dot(p3, p3.yzx + 19.19 + uSeed * 0.137);
	return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));

	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float strand(float value) {
	float centered = abs(fract(value) - 0.5);
	return 1.0 - smoothstep(0.2, 0.5, centered);
}

void main() {
	vec4 texColor = texture(uSource, vUv);
	float alpha = texColor.a;

	if (alpha <= 0.001) {
		fragColor = vec4(0.0);
		return;
	}

	if (uAmount <= 0.0) {
		fragColor = texColor;
		return;
	}

	// Use pixel centers so weave-cell boundaries do not depend on UV interpolation.
	vec2 fragPos = gl_FragCoord.xy;
	float strandSize = max(uSize, 0.001);
	vec2 weave = fragPos / strandSize;

	float rowJitter = (hash21(vec2(floor(weave.y), 13.17)) - 0.5) * uRoughness * 0.28;
	float columnJitter = (hash21(vec2(71.43, floor(weave.x))) - 0.5) * uRoughness * 0.28;
	float vertical = strand(weave.x + rowJitter);
	float horizontal = strand(weave.y + columnJitter);

	float cellParity = mod(floor(weave.x) + floor(weave.y), 2.0);
	float overUnder = mix(vertical, horizontal, cellParity);
	float ridge = max(max(vertical, horizontal) * 0.45, overUnder * 0.75);
	float gaps = (1.0 - vertical) * (1.0 - horizontal);

	float coarse = valueNoise(fragPos / (strandSize * 7.0) + vec2(uSeed * 1.7, uSeed * 0.6));
	float fine = valueNoise(fragPos / max(strandSize * 0.55, 0.5) + vec2(uSeed * 3.1, 4.7));
	float dashH = smoothstep(0.64, 0.98, hash21(floor(vec2(weave.x * 2.0, weave.y)) + 23.9)) * horizontal;
	float dashV = smoothstep(0.64, 0.98, hash21(floor(vec2(weave.x, weave.y * 2.0)) + 91.4)) * vertical;

	float texture = 0.0;
	texture += (ridge - 0.42) * 0.22;
	texture -= gaps * 0.18;
	texture += (coarse - 0.5) * 0.18 * uRoughness;
	texture += (fine - 0.5) * 0.16 * uRoughness;
	texture -= (dashH + dashV) * 0.08 * uRoughness;

	vec3 rgb = texColor.rgb / alpha;
	float darkFiber = clamp(-texture * 3.2 + gaps * 0.12 + (dashH + dashV) * 0.18, 0.0, 1.0);
	vec3 shaded = mix(rgb, uColor.rgb, darkFiber * uColor.a);
	vec3 textured = clamp(shaded * (1.0 + max(texture, 0.0) * 0.45), 0.0, 1.0);
	rgb = mix(rgb, textured, uAmount);

	fragColor = vec4(rgb * alpha, alpha);
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
    throw new Error(`Burlap shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Burlap program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var setupBurlap = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("burlap effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const vs = compileShader(gl, gl.VERTEX_SHADER, BURLAP_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, BURLAP_FS);
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!colorCtx) {
    throw new Error("Failed to acquire 2D context for color parsing");
  }
  return {
    gl,
    program,
    vao,
    vbo,
    texture,
    uSource: gl.getUniformLocation(program, "uSource"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uAmount: gl.getUniformLocation(program, "uAmount"),
    uSize: gl.getUniformLocation(program, "uSize"),
    uRoughness: gl.getUniformLocation(program, "uRoughness"),
    uSeed: gl.getUniformLocation(program, "uSeed"),
    uColor: gl.getUniformLocation(program, "uColor"),
    colorCtx,
    cachedColor: "",
    cachedColorRgba: [0, 0, 0, 255]
  };
};
var normalizedRgba = (color) => {
  return [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255];
};
var burlap = createEffect({
  type: "dev.remotion.effects.burlap",
  label: "burlap()",
  documentationLink: "https://www.remotion.dev/docs/effects/burlap",
  calculateKey: (params) => {
    const r = resolve(params);
    return `burlap-${r.amount}-${r.size}-${r.roughness}-${r.seed}-${r.color}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuColors */ .o)(target, "burlap"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the burlap effect");
        const r = resolve(params);
        const colors = (0,_index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__/* .getWebGpuColors */ .B)(state, [r.color]);
        const uniformData = new Float32Array([
          width,
          height,
          r.amount,
          r.size,
          r.roughness,
          r.seed,
          0,
          0,
          colors[0] / 255,
          colors[1] / 255,
          colors[2] / 255,
          colors[3] / 255
        ]);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: BURLAP_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => setupBurlap(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, texture } = state;
        if (state.cachedColor !== r.color) {
          state.cachedColor = r.color;
          state.cachedColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, r.color);
        }
        const [red, green, blue, alpha] = normalizedRgba(state.cachedColorRgba);
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
        if (state.uSource)
          gl.uniform1i(state.uSource, 0);
        if (state.uResolution)
          gl.uniform2f(state.uResolution, width, height);
        if (state.uAmount)
          gl.uniform1f(state.uAmount, r.amount);
        if (state.uSize)
          gl.uniform1f(state.uSize, r.size);
        if (state.uRoughness)
          gl.uniform1f(state.uRoughness, r.roughness);
        if (state.uSeed)
          gl.uniform1f(state.uSeed, r.seed);
        if (state.uColor)
          gl.uniform4f(state.uColor, red, green, blue, alpha);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteTexture(texture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: burlapSchema,
  validateParams: validateBurlapParams
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




/***/ }

}]);
//# sourceMappingURL=5223.bundle.js.map