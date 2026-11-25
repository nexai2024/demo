"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[7917],{

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




/***/ },

/***/ 7917
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   lightning: () => (/* binding */ lightning)
/* harmony export */ });
/* harmony import */ var _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6359);
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/lightning/index.ts


// src/lightning/geometry.ts
var lightningSegments = (p, width, height, alpha) => {
  const seed = BigInt(Math.floor(p.conductivityState)) ^ BigInt(p.seed) << 32n;
  let state = BigInt.asUintN(64, seed * 0x9e3779b97f4a7c15n) ^ 0xd1b54a32d192ed03n | 1n;
  const random = () => {
    state ^= state >> 12n;
    state ^= BigInt.asUintN(64, state << 25n);
    state ^= state >> 27n;
    return Number(BigInt.asUintN(64, state * 0x2545f4914f6cdd1dn) >> 11n) / 2 ** 53;
  };
  const alphaAt = (x, y) => {
    if (!alpha)
      return 0;
    const px = Math.max(0, Math.min(width - 1, x - 0.5));
    const py = Math.max(0, Math.min(height - 1, y - 0.5));
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = px - x0;
    const ty = py - y0;
    const { data } = alpha;
    return ((data[(y0 * width + x0) * 4 + 3] * (1 - tx) + data[(y0 * width + x1) * 4 + 3] * tx) * (1 - ty) + (data[(y1 * width + x0) * 4 + 3] * (1 - tx) + data[(y1 * width + x1) * 4 + 3] * tx) * ty) / 255;
  };
  const origin = [p.origin[0] * width, p.origin[1] * height];
  const direction = [p.direction[0] * width, p.direction[1] * height];
  const dx = direction[0] - origin[0];
  const dy = direction[1] - origin[1];
  const distance = Math.hypot(dx, dy);
  const depth = p.complexity + Number(p.fractalType === "spline");
  const shape = { linear: 1, "semi-linear": 0.7, spline: 0.45 }[p.fractalType];
  const turbulence = p.turbulence * (p.lightningType === "bouncy" ? 1.6 : 1);
  const forking = p.lightningType === "breaking" ? Math.min(1, p.forking * (0.5 + distance / Math.max(width, height, 1))) : p.forking;
  const segments = [];
  const grow = (segment, remaining) => {
    const { start, end, intensity, main } = segment;
    if (segments.length > 20000)
      return;
    const vx = end[0] - start[0];
    const vy = end[1] - start[1];
    const length = Math.hypot(vx, vy);
    if (remaining === 0 || length < 1) {
      segments.push(segment);
      return;
    }
    const nx = -vy / length;
    const ny = vx / length;
    let offset = (random() * 2 - 1) * length * 0.22 * turbulence * shape;
    const mx = (start[0] + end[0]) / 2;
    const my = (start[1] + end[1]) / 2;
    if (alpha && (main || !p.mainCoreCollisionOnly)) {
      const delta = alphaAt(mx + nx * offset, my + ny * offset) - alphaAt(mx - nx * offset, my - ny * offset);
      if (delta * p.alphaObstacle > 0 && random() < Math.abs(p.alphaObstacle) / 10)
        offset = -offset;
    }
    const mid = [mx + nx * offset, my + ny * offset];
    if (!main && p.alphaObstacle > 0 && alphaAt(...mid) > 0.5 && random() < p.alphaObstacle / 10)
      return;
    grow({ start, end: mid, intensity, main }, remaining - 1);
    grow({ start: mid, end, intensity, main }, remaining - 1);
    if (random() < forking && intensity > p.terminationThreshold && length >= p.minForkDistance) {
      const angle = (random() * 2 - 1) * 0.7;
      const fx = mid[0] - start[0];
      const fy = mid[1] - start[1];
      const forkEnd = [
        mid[0] + 1.2 * (fx * Math.cos(angle) - fy * Math.sin(angle)),
        mid[1] + 1.2 * (fx * Math.sin(angle) + fy * Math.cos(angle))
      ];
      const variation = p.forkVariation > 0 ? 1 - p.forkVariation * random() : 1;
      grow({
        start: mid,
        end: forkEnd,
        intensity: Math.min(1, intensity * (1 - p.decay) * p.forkStrength * 2 * variation),
        main: false
      }, remaining - 1);
    }
  };
  const growMain = (start, end, subdivisions) => grow({ start, end, intensity: 1, main: true }, subdivisions);
  switch (p.lightningType) {
    case "direction":
      growMain(origin, [origin[0] + dx * 3, origin[1] + dy * 3], depth);
      break;
    case "vertical":
      growMain(origin, [origin[0], height], depth);
      break;
    case "two-way-strike": {
      const mid = [origin[0] + dx / 2, origin[1] + dy / 2];
      const halfDepth = Math.max(1, depth - 1);
      growMain(origin, mid, halfDepth);
      growMain(direction, mid, halfDepth);
      break;
    }
    case "omni":
    case "anywhere": {
      const radius = Math.max(distance, Math.min(width, height) * 0.25);
      for (let i = 0;i < 4; i++) {
        const angle = random() * 2 * Math.PI;
        const length = p.lightningType === "anywhere" ? radius * (0.3 + 0.7 * random()) : radius;
        growMain(origin, [
          origin[0] + Math.cos(angle) * length,
          origin[1] + Math.sin(angle) * length
        ], depth);
      }
      break;
    }
    default:
      growMain(origin, direction, depth);
  }
  if (p.decayMainCore || p.coreDrain > 0) {
    const distanceFromOrigin = (point) => Math.hypot(point[0] - origin[0], point[1] - origin[1]);
    const farthest = segments.reduce((max, segment) => Math.max(max, distanceFromOrigin(segment.end)), 0.000000001);
    for (const segment of segments) {
      const fraction = distanceFromOrigin(segment.start) / farthest;
      if (p.decayMainCore)
        segment.intensity *= Math.max(0, 1 - p.decay * fraction);
      if (segment.main)
        segment.intensity *= Math.max(0, 1 - p.coreDrain * fraction);
    }
  }
  return segments;
};

// src/lightning/mask.ts
var blurRows = (input, output, width, radius) => {
  const height = input.length / width;
  const weight = 1 / (2 * radius + 1);
  for (let y = 0;y < height; y++) {
    const row = y * width;
    let sum = input[row] * (radius + 1);
    for (let x = 1;x <= radius; x++)
      sum += input[row + Math.min(width - 1, x)];
    for (let x = 0;x < width; x++) {
      output[row + x] = sum * weight;
      sum += input[row + Math.min(width - 1, x + radius + 1)] - input[row + Math.max(0, x - radius)];
    }
  }
};
var transpose = (input, output, width, height) => {
  for (let x = 0;x < width; x++) {
    for (let y = 0;y < height; y++)
      output[x * height + y] = input[y * width + x];
  }
};
var makeLightningMask = (p, width, height, alpha) => {
  const segments = lightningSegments(p, width, height, alpha);
  const data = new Uint8Array(width * height * 4);
  const coreRadius = Math.max(0.3, p.coreRadius);
  const sigma = p.glowRadius / 3;
  const idealWidth = Math.sqrt(4 * sigma * sigma + 1);
  const lowerWidth = 2 * Math.floor((idealWidth - 1) / 2) + 1;
  const lowerPasses = Math.round((12 * sigma * sigma - 3 * lowerWidth ** 2 - 12 * lowerWidth - 9) / (-4 * lowerWidth - 4));
  const radii = p.glowRadius > 0.5 ? [0, 1, 2].map((pass) => (lowerWidth - 1) / 2 + Number(pass >= lowerPasses)) : [];
  const margin = coreRadius + 1 + radii.reduce((total, r) => total + r, 0);
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (const { start, end } of segments) {
    left = Math.min(left, Math.floor(Math.min(start[0], end[0]) - margin));
    right = Math.max(right, Math.ceil(Math.max(start[0], end[0]) + margin));
    top = Math.min(top, Math.floor(Math.min(start[1], end[1]) - margin));
    bottom = Math.max(bottom, Math.ceil(Math.max(start[1], end[1]) + margin));
  }
  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(width, right);
  bottom = Math.min(height, bottom);
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0)
    return data;
  let core = new Float32Array(w * h);
  for (const { start, end, intensity } of segments) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lengthSq = Math.max(0.000000000001, dx * dx + dy * dy);
    const x0 = Math.max(left, Math.floor(Math.min(start[0], end[0]) - coreRadius - 1));
    const y0 = Math.max(top, Math.floor(Math.min(start[1], end[1]) - coreRadius - 1));
    const x1 = Math.min(right, Math.ceil(Math.max(start[0], end[0]) + coreRadius + 1));
    const y1 = Math.min(bottom, Math.ceil(Math.max(start[1], end[1]) + coreRadius + 1));
    for (let y = y0;y < y1; y++) {
      const py = y + 0.5 - start[1];
      for (let x = x0;x < x1; x++) {
        const px = x + 0.5 - start[0];
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSq));
        const distance = Math.sqrt((px - dx * t) ** 2 + (py - dy * t) ** 2);
        const coverage = Math.min(1, coreRadius + 0.5 - distance) * intensity;
        const index = (y - top) * w + x - left;
        if (coverage > core[index])
          core[index] = coverage;
      }
    }
  }
  for (let y = 0;y < h; y++) {
    for (let x = 0;x < w; x++)
      data[((y + top) * width + x + left) * 4] = Math.round(core[y * w + x] * 255);
  }
  if (radii.length === 0)
    return data;
  let scratch = new Float32Array(w * h);
  for (const radius of radii) {
    if (radius === 0)
      continue;
    blurRows(core, scratch, w, radius);
    [core, scratch] = [scratch, core];
  }
  transpose(core, scratch, w, h);
  [core, scratch] = [scratch, core];
  for (const radius of radii) {
    if (radius === 0)
      continue;
    blurRows(core, scratch, h, radius);
    [core, scratch] = [scratch, core];
  }
  for (let x = 0;x < w; x++) {
    for (let y = 0;y < h; y++)
      data[((y + top) * width + x + left) * 4 + 1] = Math.round(Math.min(1, core[x * h + y] * 3) * 255);
  }
  return data;
};

// src/lightning/params.ts
var numberField = (description, defaultValue, [min, max], step) => ({
  type: "number",
  description,
  default: defaultValue,
  min,
  max,
  step,
  hiddenFromList: false
});
var uvCoordinateField = (description, defaultValue) => ({
  type: "uv-coordinate",
  description,
  default: defaultValue,
  min: 0,
  max: 1,
  step: 0.01
});
var lightningSchema = {
  lightningType: {
    type: "enum",
    description: "Lightning type",
    variants: {
      direction: {},
      strike: {},
      breaking: {},
      bouncy: {},
      omni: {},
      anywhere: {},
      vertical: {},
      "two-way-strike": {}
    },
    default: "strike"
  },
  origin: {
    ...uvCoordinateField("Origin", [0.5, 0]),
    visual: { type: "line", to: "direction" }
  },
  direction: uvCoordinateField("Direction", [0.5, 1]),
  conductivityState: numberField("Conductivity state", 10, [0, 1e5], 1),
  coreRadius: numberField("Core radius", 3, [0, 100], 0.1),
  coreOpacity: numberField("Core opacity", 0.75, [0, 1], 0.01),
  coreColor: { type: "color", description: "Core color", default: "#ffffff" },
  glowRadius: numberField("Glow radius", 50, [0, 1000], 0.1),
  glowOpacity: numberField("Glow opacity", 0.5, [0, 1], 0.01),
  glowColor: { type: "color", description: "Glow color", default: "#4059ff" },
  turbulence: numberField("Turbulence", 1, [0, 10], 0.01),
  forking: numberField("Forking", 0.25, [0, 1], 0.01),
  decay: numberField("Decay", 0.3, [0, 1], 0.01),
  decayMainCore: {
    type: "boolean",
    description: "Decay main core",
    default: false
  },
  alphaObstacle: numberField("Alpha obstacle", 0, [-10, 10], 0.1),
  compositeOnOriginal: {
    type: "boolean",
    description: "Composite on original",
    default: true
  },
  complexity: { ...numberField("Complexity", 6, [1, 12], 1), integer: true },
  minForkDistance: numberField("Min fork distance", 0, [0, 1000], 1),
  terminationThreshold: numberField("Termination threshold", 0.05, [0, 1], 0.01),
  mainCoreCollisionOnly: {
    type: "boolean",
    description: "Main core collision only",
    default: false
  },
  fractalType: {
    type: "enum",
    description: "Fractal type",
    variants: { linear: {}, "semi-linear": {}, spline: {} },
    default: "linear"
  },
  coreDrain: numberField("Core drain", 0, [0, 1], 0.01),
  forkStrength: numberField("Fork strength", 0.5, [0, 1], 0.01),
  forkVariation: numberField("Fork variation", 0, [0, 1], 0.01),
  seed: { ...numberField("Seed", 0, [0, 4294967295], 1), integer: true }
};
var resolve = (params) => ({
  lightningType: params.lightningType ?? lightningSchema.lightningType.default,
  origin: params.origin ?? lightningSchema.origin.default,
  direction: params.direction ?? lightningSchema.direction.default,
  conductivityState: params.conductivityState ?? lightningSchema.conductivityState.default,
  coreRadius: params.coreRadius ?? lightningSchema.coreRadius.default,
  coreOpacity: params.coreOpacity ?? lightningSchema.coreOpacity.default,
  coreColor: params.coreColor ?? lightningSchema.coreColor.default,
  glowRadius: params.glowRadius ?? lightningSchema.glowRadius.default,
  glowOpacity: params.glowOpacity ?? lightningSchema.glowOpacity.default,
  glowColor: params.glowColor ?? lightningSchema.glowColor.default,
  turbulence: params.turbulence ?? lightningSchema.turbulence.default,
  forking: params.forking ?? lightningSchema.forking.default,
  decay: params.decay ?? lightningSchema.decay.default,
  decayMainCore: params.decayMainCore ?? lightningSchema.decayMainCore.default,
  alphaObstacle: params.alphaObstacle ?? lightningSchema.alphaObstacle.default,
  compositeOnOriginal: params.compositeOnOriginal ?? lightningSchema.compositeOnOriginal.default,
  complexity: params.complexity ?? lightningSchema.complexity.default,
  minForkDistance: params.minForkDistance ?? lightningSchema.minForkDistance.default,
  terminationThreshold: params.terminationThreshold ?? lightningSchema.terminationThreshold.default,
  mainCoreCollisionOnly: params.mainCoreCollisionOnly ?? lightningSchema.mainCoreCollisionOnly.default,
  fractalType: params.fractalType ?? lightningSchema.fractalType.default,
  coreDrain: params.coreDrain ?? lightningSchema.coreDrain.default,
  forkStrength: params.forkStrength ?? lightningSchema.forkStrength.default,
  forkVariation: params.forkVariation ?? lightningSchema.forkVariation.default,
  seed: params.seed ?? lightningSchema.seed.default
});
var validateLightningParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Lightning");
  for (const [name, field] of Object.entries(lightningSchema)) {
    const value = params[name];
    if (value === undefined)
      continue;
    switch (field.type) {
      case "number":
        (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(value, name);
        if (typeof value !== "number" || value < field.min || value > field.max) {
          throw new TypeError(`"${name}" must be between ${field.min} and ${field.max}`);
        }
        if ("integer" in field && !Number.isInteger(value)) {
          throw new TypeError(`"${name}" must be an integer`);
        }
        break;
      case "uv-coordinate":
        if (!Array.isArray(value) || value.length !== 2)
          throw new TypeError(`"${name}" must be a [number, number] tuple`);
        for (const coordinate of value) {
          (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(coordinate, name);
          (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(coordinate, name);
        }
        break;
      case "boolean":
        (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalBoolean */ .fX)(value, name);
        break;
      case "color":
        (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)(value, name);
        break;
      case "enum":
        if (typeof value !== "string" || !Object.hasOwn(field.variants, value))
          throw new TypeError(`Invalid "${name}": ${JSON.stringify(value)}`);
        break;
      default:
        throw new TypeError(`Unknown lightning field "${name}"`);
    }
  }
};

// src/lightning/shaders.ts
var LIGHTNING_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uMask;
uniform vec4 uCore;
uniform vec4 uGlow;
uniform float uComposite;
in vec2 vUv;
out vec4 fragColor;

void main() {
	vec4 source = texture(uSource, vUv) * uComposite;
	vec2 mask = texture(uMask, vec2(vUv.x, 1.0 - vUv.y)).rg;
	float core = mask.r * uCore.a;
	float glow = mask.g * uGlow.a;
	float alpha = source.a + max(core, glow) * (1.0 - source.a);
	vec3 color = source.rgb + uCore.rgb * core + uGlow.rgb * glow;
	fragColor = vec4(min(color, vec3(alpha)), alpha);
}
`;
var LIGHTNING_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
struct Params { core: vec4f, glow: vec4f, composite: f32 }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var mask: texture_2d<f32>;

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
	let src = textureSampleLevel(source, sourceSampler, input.uv, 0) * params.composite;
	let coverage = textureLoad(mask, vec2i(input.position.xy), 0).rg;
	let core = coverage.r * params.core.a;
	let glow = coverage.g * params.glow.a;
	let alpha = src.a + max(core, glow) * (1.0 - src.a);
	let color = src.rgb + params.core.rgb * core + params.glow.rgb * glow;
	return vec4f(min(color, vec3f(alpha)), alpha);
}
`;

// src/lightning/index.ts
var setupLightning = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx)
    throw new Error("Could not acquire a 2D context for lightning");
  return { ctx, mask: null };
};
var prepareLightning = ({
  state,
  params,
  source,
  width,
  height,
  sourceIsFlipped
}) => {
  const p = resolve(params);
  const {
    coreColor,
    coreOpacity,
    glowColor,
    glowOpacity,
    compositeOnOriginal,
    ...shape
  } = p;
  const key = JSON.stringify([width, height, shape]);
  const { ctx } = state;
  if (state.mask?.key !== key || p.alphaObstacle !== 0) {
    let alpha = null;
    if (p.alphaObstacle !== 0) {
      if (ctx.canvas.width !== width)
        ctx.canvas.width = width;
      if (ctx.canvas.height !== height)
        ctx.canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      try {
        if (sourceIsFlipped) {
          ctx.translate(0, height);
          ctx.scale(1, -1);
        }
        ctx.drawImage(source, 0, 0, width, height);
      } finally {
        ctx.restore();
      }
      alpha = ctx.getImageData(0, 0, width, height);
    }
    state.mask = { key, data: makeLightningMask(p, width, height, alpha) };
  }
  const core = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(ctx, coreColor);
  const glow = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(ctx, glowColor);
  return {
    data: state.mask.data,
    uniforms: new Float32Array([
      core[0] / 255,
      core[1] / 255,
      core[2] / 255,
      core[3] / 255 * coreOpacity,
      glow[0] / 255,
      glow[1] / 255,
      glow[2] / 255,
      glow[3] / 255 * glowOpacity,
      Number(compositeOnOriginal),
      0,
      0,
      0
    ])
  };
};
var lightning = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffect({
  type: "remotion/lightning",
  label: "lightning()",
  documentationLink: "https://www.remotion.dev/docs/effects/lightning",
  calculateKey: (params) => `lightning-${JSON.stringify(resolve(params))}`,
  schema: lightningSchema,
  validateParams: validateLightningParams,
  implementations: {
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => {
        const shared = setupLightning();
        const pass = (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupSinglePass */ .zE)(target, LIGHTNING_FRAGMENT_SHADER, "lightning", ["uMask", "uCore", "uGlow", "uComposite"]);
        const { gl } = pass;
        const maskTexture = gl.createTexture();
        if (!maskTexture) {
          (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupSinglePass */ .ww)(pass);
          throw new Error("Could not allocate lightning mask texture");
        }
        gl.bindTexture(gl.TEXTURE_2D, maskTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return { ...shared, ...pass, maskTexture };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const previous = state.mask?.data;
        const { data, uniforms } = prepareLightning({
          state,
          params,
          source,
          width,
          height,
          sourceIsFlipped: !flipSourceY
        });
        const { gl } = state;
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .prepareSinglePassSource */ .yc)({
          state,
          source,
          width,
          height,
          flipSourceY
        });
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, state.maskTexture);
        if (previous !== data) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        }
        gl.uniform1i(state.uniforms.uMask, 1);
        gl.uniform4fv(state.uniforms.uCore, uniforms, 0, 4);
        gl.uniform4fv(state.uniforms.uGlow, uniforms, 4, 4);
        gl.uniform1f(state.uniforms.uComposite, uniforms[8]);
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .drawSinglePass */ .CT)(state);
        gl.activeTexture(gl.TEXTURE0);
      },
      cleanup: (state) => {
        state.gl.deleteTexture(state.maskTexture);
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupSinglePass */ .ww)(state);
      }
    }),
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => ({
        ...setupLightning(),
        ...(0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuSinglePass */ .DS)(target, "lightning")
      }),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for lightning");
        const { data, uniforms } = prepareLightning({
          state,
          params,
          source,
          width,
          height,
          sourceIsFlipped: false
        });
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: LIGHTNING_WEBGPU_SHADER,
          uniformData: uniforms
        }, {
          sourceFilter: null,
          auxiliaryTexture: { data, width, height, format: "rgba8unorm" }
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuSinglePass */ .Gl
    })
  }
});



/***/ }

}]);
//# sourceMappingURL=7917.bundle.js.map