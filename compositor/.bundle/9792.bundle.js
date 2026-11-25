"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[9792],{

/***/ 9792
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   emboss: () => (/* binding */ emboss),
/* harmony export */   embossSchema: () => (/* binding */ embossSchema)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/emboss.ts


// src/emboss-webgpu-shader.ts
var EMBOSS_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
struct Params {
  resolution: vec2f, amount: f32, size: f32,
  lineWidth: f32, depth: f32, angle: f32, lightAngle: f32,
  offset: f32, padding1: f32, padding2: f32, padding3: f32,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

fn rotation(angle: f32) -> mat2x2f {
  let c = cos(angle);
  let s = sin(angle);
  return mat2x2f(vec2f(c, -s), vec2f(s, c));
}
fn roundedBoxSdf(p: vec2f, halfSize: vec2f, radius: f32) -> f32 {
  let q = abs(p) - halfSize + vec2f(radius);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}
fn reliefHeight(fragPos: vec2f) -> f32 {
  let size = max(params.size, 0.001);
  let lineWidth = clamp(params.lineWidth, 0.001, size * 0.85);
  var pos = rotation(params.angle) * (fragPos - params.resolution * 0.5);
  pos.x += params.offset;
  let cell = floor(pos / size);
  let local = (fract(pos / size) - vec2f(0.5)) * size;
  let cellSum = cell.x + cell.y;
  let alternate = cellSum - 2.0 * floor(cellSum / 2.0);
  let dashAngle = mix(0.78539816339, -0.78539816339, step(0.5, alternate));
  let dash = rotation(dashAngle) * local;
  let sdf = roundedBoxSdf(dash, vec2f(size * 0.36, lineWidth * 0.5), lineWidth * 0.5);
  return 1.0 - smoothstep(-1.0, 1.0, sdf);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSampleLevel(source, sourceSampler, input.uv, 0.0);
  let alpha = color.a;
  if (alpha <= 0.001) { return vec4f(0.0); }
  if (params.amount <= 0.0 || params.depth <= 0.0) { return color; }
  let fragPos = vec2f(input.uv.x, 1.0 - input.uv.y) * params.resolution;
  let h = reliefHeight(fragPos);
  let hLeft = reliefHeight(fragPos - vec2f(1.0, 0.0));
  let hRight = reliefHeight(fragPos + vec2f(1.0, 0.0));
  let hDown = reliefHeight(fragPos - vec2f(0.0, 1.0));
  let hUp = reliefHeight(fragPos + vec2f(0.0, 1.0));
  let normal = normalize(vec3f((hLeft - hRight) * params.depth * 3.8, (hDown - hUp) * params.depth * 3.8, 1.0));
  let light = normalize(vec3f(cos(params.lightAngle), sin(params.lightAngle), 0.7));
  let lit = dot(normal, light);
  let bevel = (lit - 0.64) * 0.72 * params.depth;
  let plateau = (h - 0.5) * 0.08 * params.depth;
  let edge = min(abs(hRight - hLeft) + abs(hUp - hDown), 1.0);
  let rgb = color.rgb / alpha;
  let shaded = clamp(rgb + vec3f(bevel + plateau - edge * 0.035 * params.depth), vec3f(0.0), vec3f(1.0));
  return vec4f(mix(rgb, shaded, params.amount) * alpha, alpha);
}
`;

// src/emboss.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals;
var DEFAULT_AMOUNT = 0.7;
var DEFAULT_SIZE = 26;
var DEFAULT_LINE_WIDTH = 7;
var DEFAULT_DEPTH = 0.75;
var DEFAULT_ANGLE = 0;
var DEFAULT_LIGHT_ANGLE = 135;
var DEFAULT_OFFSET = 0;
var embossSchema = {
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
    min: 1,
    max: 200,
    step: 1,
    default: DEFAULT_SIZE,
    description: "Size",
    hiddenFromList: false
  },
  lineWidth: {
    type: "number",
    min: 0.1,
    max: 100,
    step: 0.1,
    default: DEFAULT_LINE_WIDTH,
    description: "Line width",
    hiddenFromList: false
  },
  depth: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_DEPTH,
    description: "Depth",
    hiddenFromList: false
  },
  angle: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_ANGLE,
    description: "Angle"
  },
  lightAngle: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_LIGHT_ANGLE,
    description: "Light angle"
  },
  offset: {
    type: "number",
    step: 0.1,
    default: DEFAULT_OFFSET,
    description: "Offset",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  amount: p.amount ?? DEFAULT_AMOUNT,
  size: p.size ?? DEFAULT_SIZE,
  lineWidth: p.lineWidth ?? DEFAULT_LINE_WIDTH,
  depth: p.depth ?? DEFAULT_DEPTH,
  angle: p.angle ?? DEFAULT_ANGLE,
  lightAngle: p.lightAngle ?? DEFAULT_LIGHT_ANGLE,
  offset: p.offset ?? DEFAULT_OFFSET
});
var validatePositive = (value, name) => {
  if (value <= 0) {
    throw new TypeError(`"${name}" must be greater than 0, but got ${JSON.stringify(value)}`);
  }
};
var validateEmbossParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Emboss");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.size, "size");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.lineWidth, "lineWidth");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.depth, "depth");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.angle, "angle");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.lightAngle, "lightAngle");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.offset, "offset");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.amount, "amount");
  validatePositive(r.size, "size");
  validatePositive(r.lineWidth, "lineWidth");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.depth, "depth");
};
var EMBOSS_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var EMBOSS_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uSize;
uniform float uLineWidth;
uniform float uDepth;
uniform float uAngle;
uniform float uLightAngle;
uniform float uOffset;

mat2 rotation(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat2(c, -s, s, c);
}

float roundedBoxSdf(vec2 p, vec2 halfSize, float radius) {
	vec2 q = abs(p) - halfSize + vec2(radius);
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

float reliefHeight(vec2 fragPos) {
	float size = max(uSize, 0.001);
	float lineWidth = clamp(uLineWidth, 0.001, size * 0.85);
	vec2 pos = rotation(uAngle) * (fragPos - uResolution * 0.5);
	pos.x += uOffset;

	vec2 cell = floor(pos / size);
	vec2 local = (fract(pos / size) - 0.5) * size;
	float alternate = mod(cell.x + cell.y, 2.0);
	float dashAngle = mix(0.78539816339, -0.78539816339, step(0.5, alternate));
	vec2 dash = rotation(dashAngle) * local;

	float sdf = roundedBoxSdf(
		dash,
		vec2(size * 0.36, lineWidth * 0.5),
		lineWidth * 0.5
	);

	return 1.0 - smoothstep(-1.0, 1.0, sdf);
}

void main() {
	vec4 texColor = texture(uSource, vUv);
	float alpha = texColor.a;

	if (alpha <= 0.001) {
		fragColor = vec4(0.0);
		return;
	}

	if (uAmount <= 0.0 || uDepth <= 0.0) {
		fragColor = texColor;
		return;
	}

	vec2 fragPos = vUv * uResolution;
	float h = reliefHeight(fragPos);
	float hLeft = reliefHeight(fragPos - vec2(1.0, 0.0));
	float hRight = reliefHeight(fragPos + vec2(1.0, 0.0));
	float hDown = reliefHeight(fragPos - vec2(0.0, 1.0));
	float hUp = reliefHeight(fragPos + vec2(0.0, 1.0));

	vec3 normal = normalize(vec3(
		(hLeft - hRight) * uDepth * 3.8,
		(hDown - hUp) * uDepth * 3.8,
		1.0
	));
	vec3 light = normalize(vec3(cos(uLightAngle), sin(uLightAngle), 0.7));
	float lit = dot(normal, light);

	float bevel = (lit - 0.64) * 0.72 * uDepth;
	float plateau = (h - 0.5) * 0.08 * uDepth;
	float edge = min(
		abs(hRight - hLeft) + abs(hUp - hDown),
		1.0
	);

	vec3 rgb = texColor.rgb / alpha;
	vec3 shaded = clamp(rgb + bevel + plateau - edge * 0.035 * uDepth, 0.0, 1.0);
	rgb = mix(rgb, shaded, uAmount);

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
    throw new Error(`Emboss shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Emboss program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var setupEmboss = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("emboss effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const vs = compileShader(gl, gl.VERTEX_SHADER, EMBOSS_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, EMBOSS_FS);
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
  return {
    gl,
    program,
    vao,
    vbo,
    texture,
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uAmount: gl.getUniformLocation(program, "uAmount"),
      uSize: gl.getUniformLocation(program, "uSize"),
      uLineWidth: gl.getUniformLocation(program, "uLineWidth"),
      uDepth: gl.getUniformLocation(program, "uDepth"),
      uAngle: gl.getUniformLocation(program, "uAngle"),
      uLightAngle: gl.getUniformLocation(program, "uLightAngle"),
      uOffset: gl.getUniformLocation(program, "uOffset")
    }
  };
};
var degreesToRadians = (degrees) => {
  return degrees * Math.PI / 180;
};
var emboss = createEffect({
  type: "dev.remotion.effects.emboss",
  label: "emboss()",
  documentationLink: "https://www.remotion.dev/docs/effects/emboss",
  calculateKey: (params) => {
    const r = resolve(params);
    return `emboss-${r.amount}-${r.size}-${r.lineWidth}-${r.depth}-${r.angle}-${r.lightAngle}-${r.offset}`;
  },
  implementations: {
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => setupEmboss(target),
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
        if (uniforms.uAmount)
          gl.uniform1f(uniforms.uAmount, r.amount);
        if (uniforms.uSize)
          gl.uniform1f(uniforms.uSize, r.size);
        if (uniforms.uLineWidth)
          gl.uniform1f(uniforms.uLineWidth, r.lineWidth);
        if (uniforms.uDepth)
          gl.uniform1f(uniforms.uDepth, r.depth);
        if (uniforms.uAngle) {
          gl.uniform1f(uniforms.uAngle, degreesToRadians(r.angle));
        }
        if (uniforms.uLightAngle) {
          gl.uniform1f(uniforms.uLightAngle, degreesToRadians(r.lightAngle));
        }
        if (uniforms.uOffset)
          gl.uniform1f(uniforms.uOffset, r.offset);
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
    }),
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "emboss"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice) {
          throw new Error("A WebGPU device is required for the emboss effect");
        }
        const r = resolve(params);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: EMBOSS_WEBGPU_SHADER,
          uniformData: new Float32Array([
            width,
            height,
            r.amount,
            r.size,
            r.lineWidth,
            r.depth,
            degreesToRadians(r.angle),
            degreesToRadians(r.lightAngle),
            r.offset,
            0,
            0,
            0
          ])
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    })
  },
  schema: embossSchema,
  validateParams: validateEmbossParams
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
//# sourceMappingURL=9792.bundle.js.map