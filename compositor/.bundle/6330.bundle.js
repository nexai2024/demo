"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[6330],{

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

/***/ 6330
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   magnify: () => (/* binding */ magnify)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6359);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/magnify.ts


// src/magnify/shader.ts
var MAGNIFY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uMagnification;
uniform float uSize;
uniform float uFeather;
uniform float uOpacity;
uniform bool uSquare;
uniform int uScaling;
uniform bool uIsolated;

vec4 pixelAt(ivec2 p) {
	if (any(lessThan(p, ivec2(0))) || any(greaterThanEqual(p, textureSize(uSource, 0)))) {
		return vec4(0.0);
	}
	return texelFetch(uSource, p, 0);
}

vec4 cubicWeights(float t) {
	float t2 = t * t;
	float t3 = t2 * t;
	return vec4(-0.5 * t3 + t2 - 0.5 * t,
		1.5 * t3 - 2.5 * t2 + 1.0,
		-1.5 * t3 + 2.0 * t2 + 0.5 * t,
		0.5 * t3 - 0.5 * t2);
}

vec4 sampleMagnified(vec2 uv, vec2 position) {
	vec2 dimensions = vec2(textureSize(uSource, 0));
	vec2 p = uv * dimensions;
	if (uScaling == 0) return pixelAt(ivec2(floor(p)));
	if (uScaling == 2) {
		uvec2 xy = uvec2(floor(position));
		uvec2 h = (xy.x ^ (xy.y + uvec2(1048576u, 2097152u))) * 1664525u + 1013904223u;
		h = (h ^ (h >> 16u)) * 2246822519u;
		vec2 jitter = (vec2(h ^ (h >> 13u)) / 4294967295.0 - 0.5) * max(1.0 - 1.0 / uMagnification, 0.0);
		jitter.y = -jitter.y;
		vec2 q = floor(p) + jitter;
		ivec2 base = ivec2(floor(q));
		vec2 f = fract(q);
		return mix(mix(pixelAt(base), pixelAt(base + ivec2(1, 0)), f.x),
			mix(pixelAt(base + ivec2(0, 1)), pixelAt(base + ivec2(1, 1)), f.x), f.y);
	}
	vec2 q = p - 0.5;
	ivec2 base = ivec2(floor(q));
	vec4 wx = cubicWeights(fract(q.x));
	vec4 wy = cubicWeights(fract(q.y));
	vec4 color = vec4(0.0);
	for (int y = 0; y < 4; y++) {
		for (int x = 0; x < 4; x++) {
			color += pixelAt(base + ivec2(x - 1, y - 1)) * wx[x] * wy[y];
		}
	}
	float alpha = clamp(color.a, 0.0, 1.0);
	return vec4(clamp(color.rgb, vec3(0.0), vec3(alpha)), alpha);
}

void main() {
	vec4 original = texture(uSource, vUv);
	vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
	vec2 offset = (uv - uCenter) * uResolution;
	float distance = uSquare ? max(abs(offset.x), abs(offset.y)) : length(offset);
	float weight = 0.0;
	if (uSize > 0.0) {
		weight = uFeather > 0.0
			? 1.0 - smoothstep(uSize - uFeather, uSize, distance)
			: clamp(uSize - distance + 0.5, 0.0, 1.0);
	}
	weight *= uOpacity;
	if (weight <= 0.0) {
		fragColor = uIsolated ? vec4(0.0) : original;
		return;
	}
	vec2 sourceUv = uCenter + offset / (uResolution * uMagnification);
	vec4 magnified = uMagnification == 1.0 ? original
		: sampleMagnified(vec2(sourceUv.x, 1.0 - sourceUv.y), uv * uResolution);
	fragColor = uIsolated ? magnified * weight : mix(original, magnified, weight);
}
`;

// src/magnify/webgpu-shader.ts
var MAGNIFY_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {
	resolutionAndCenter: vec4f,
	lens: vec4f,
	modes: vec4f,
}

fn pixelAt(p: vec2i) -> vec4f {
	if (any(p < vec2i(0)) || any(p >= vec2i(textureDimensions(source)))) {
		return vec4f(0);
	}
	return textureLoad(source, p, 0);
}

fn cubicWeights(t: f32) -> vec4f {
	let t2 = t * t;
	let t3 = t2 * t;
	return vec4f(-0.5 * t3 + t2 - 0.5 * t,
		1.5 * t3 - 2.5 * t2 + 1.0,
		-1.5 * t3 + 2.0 * t2 + 0.5 * t,
		0.5 * t3 - 0.5 * t2);
}

fn sampleMagnified(uv: vec2f, position: vec2f) -> vec4f {
	let p = uv * vec2f(textureDimensions(source));
	if (params.modes.y == 0) { return pixelAt(vec2i(floor(p))); }
	if (params.modes.y == 2) {
		let xy = vec2u(floor(position));
		var h = (vec2u(xy.x) ^ (vec2u(xy.y) + vec2u(1048576u, 2097152u))) * 1664525u + 1013904223u;
		h = (h ^ (h >> vec2u(16u))) * 2246822519u;
		let jitter = (vec2f(h ^ (h >> vec2u(13u))) / 4294967295.0 - 0.5) * max(1.0 - 1.0 / params.lens.x, 0.0);
		let q = floor(p) + jitter;
		let base = vec2i(floor(q));
		let f = fract(q);
		return mix(mix(pixelAt(base), pixelAt(base + vec2i(1, 0)), f.x),
			mix(pixelAt(base + vec2i(0, 1)), pixelAt(base + vec2i(1, 1)), f.x), f.y);
	}
	let q = p - 0.5;
	let base = vec2i(floor(q));
	let wx = cubicWeights(fract(q.x));
	let wy = cubicWeights(fract(q.y));
	var color = vec4f(0);
	for (var y = 0; y < 4; y++) {
		for (var x = 0; x < 4; x++) {
			color += pixelAt(base + vec2i(x - 1, y - 1)) * wx[x] * wy[y];
		}
	}
	let alpha = clamp(color.a, 0.0, 1.0);
	return vec4f(clamp(color.rgb, vec3f(0), vec3f(alpha)), alpha);
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
	let original = textureSampleLevel(source, sourceSampler, input.uv, 0);
	let resolution = params.resolutionAndCenter.xy;
	let center = params.resolutionAndCenter.zw;
	let offset = (input.uv - center) * resolution;
	let distance = select(length(offset), max(abs(offset.x), abs(offset.y)), params.modes.x == 1);
	let size = params.lens.y;
	let feather = params.lens.z;
	var weight = 0.0;
	if (size > 0) {
		if (feather > 0) {
			weight = 1.0 - smoothstep(size - feather, size, distance);
		} else {
			weight = clamp(size - distance + 0.5, 0.0, 1.0);
		}
	}
	weight *= params.lens.w;
	if (weight <= 0) {
		return select(original, vec4f(0), params.modes.z == 1);
	}
	var magnified = original;
	if (params.lens.x != 1) {
		magnified = sampleMagnified(center + offset / (resolution * params.lens.x), input.uv * resolution);
	}
	return select(mix(original, magnified, weight), magnified * weight, params.modes.z == 1);
}
`;

// src/magnify.ts
var DEFAULT_SHAPE = "circle";
var DEFAULT_CENTER = [0.5, 0.5];
var DEFAULT_MAGNIFICATION = 200;
var DEFAULT_LINK = "none";
var DEFAULT_SIZE = 100;
var DEFAULT_FEATHER = 0;
var DEFAULT_OPACITY = 1;
var DEFAULT_SCALING = "standard";
var DEFAULT_BLENDING_MODE = "normal";
var magnifySchema = {
  shape: {
    type: "enum",
    variants: { circle: {}, square: {} },
    default: DEFAULT_SHAPE,
    description: "Shape"
  },
  center: {
    type: "uv-coordinate",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_CENTER,
    description: "Center"
  },
  magnification: {
    type: "number",
    min: 1,
    max: 1e4,
    step: 1,
    default: DEFAULT_MAGNIFICATION,
    description: "Magnification (%)",
    hiddenFromList: false
  },
  link: {
    type: "enum",
    variants: { none: {}, size: {}, "size-and-feather": {} },
    default: DEFAULT_LINK,
    description: "Link"
  },
  size: {
    type: "number",
    min: 0,
    max: 4000,
    step: 1,
    default: DEFAULT_SIZE,
    description: "Size",
    hiddenFromList: false
  },
  feather: {
    type: "number",
    min: 0,
    max: 4000,
    step: 1,
    default: DEFAULT_FEATHER,
    description: "Feather",
    hiddenFromList: false
  },
  opacity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_OPACITY,
    description: "Opacity",
    hiddenFromList: false
  },
  scaling: {
    type: "enum",
    variants: { standard: {}, soft: {}, scatter: {} },
    default: DEFAULT_SCALING,
    description: "Scaling"
  },
  blendingMode: {
    type: "enum",
    variants: { normal: {}, none: {} },
    default: DEFAULT_BLENDING_MODE,
    description: "Blending mode"
  }
};
var resolve = (params) => ({
  shape: params.shape ?? DEFAULT_SHAPE,
  center: params.center ?? DEFAULT_CENTER,
  magnification: params.magnification ?? DEFAULT_MAGNIFICATION,
  link: params.link ?? DEFAULT_LINK,
  size: params.size ?? DEFAULT_SIZE,
  feather: params.feather ?? DEFAULT_FEATHER,
  opacity: params.opacity ?? DEFAULT_OPACITY,
  scaling: params.scaling ?? DEFAULT_SCALING,
  blendingMode: params.blendingMode ?? DEFAULT_BLENDING_MODE
});
var magnify = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffect({
  type: "dev.remotion.effects.magnify",
  label: "magnify()",
  documentationLink: "https://www.remotion.dev/docs/effects/magnify",
  calculateKey: (params) => {
    const r = resolve(params);
    return `magnify-${r.shape}-${r.center.join(":")}-${r.magnification}-${r.link}-${r.size}-${r.feather}-${r.opacity}-${r.scaling}-${r.blendingMode}`;
  },
  implementations: {
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupSinglePass */ .zE)(target, MAGNIFY_FRAGMENT_SHADER, "magnify", [
        "uResolution",
        "uCenter",
        "uMagnification",
        "uSize",
        "uFeather",
        "uOpacity",
        "uSquare",
        "uScaling",
        "uIsolated"
      ]),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const scale = r.magnification / 100;
        const { gl, uniforms } = state;
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .prepareSinglePassSource */ .yc)({
          state,
          source,
          width,
          height,
          flipSourceY
        });
        gl.uniform2f(uniforms.uResolution, width, height);
        gl.uniform2f(uniforms.uCenter, r.center[0], r.center[1]);
        gl.uniform1f(uniforms.uMagnification, scale);
        gl.uniform1f(uniforms.uSize, r.size * (r.link === "none" ? 1 : scale));
        gl.uniform1f(uniforms.uFeather, r.feather * (r.link === "size-and-feather" ? scale : 1));
        gl.uniform1f(uniforms.uOpacity, r.opacity);
        gl.uniform1i(uniforms.uSquare, r.shape === "square" ? 1 : 0);
        gl.uniform1i(uniforms.uScaling, ["standard", "soft", "scatter"].indexOf(r.scaling));
        gl.uniform1i(uniforms.uIsolated, r.blendingMode === "none" ? 1 : 0);
        (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .drawSinglePass */ .CT)(state);
      },
      cleanup: _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupSinglePass */ .ww
    }),
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "magnify"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice) {
          throw new Error("A WebGPU device is required for the magnify effect");
        }
        const r = resolve(params);
        const scale = r.magnification / 100;
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: MAGNIFY_WEBGPU_SHADER,
          uniformData: new Float32Array([
            width,
            height,
            r.center[0],
            r.center[1],
            scale,
            r.size * (r.link === "none" ? 1 : scale),
            r.feather * (r.link === "size-and-feather" ? scale : 1),
            r.opacity,
            r.shape === "square" ? 1 : 0,
            ["standard", "soft", "scatter"].indexOf(r.scaling),
            r.blendingMode === "none" ? 1 : 0,
            0
          ])
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    })
  },
  schema: magnifySchema,
  validateParams: (params) => {
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Magnify");
    for (const name of [
      "magnification",
      "size",
      "feather",
      "opacity"
    ]) {
      (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params[name], name);
    }
    if (params.center !== undefined) {
      if (!Array.isArray(params.center) || params.center.length !== 2) {
        throw new TypeError('"center" must be a [number, number] tuple');
      }
      (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(params.center[0], "center[0]");
      (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(params.center[1], "center[1]");
    }
    const r = resolve(params);
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.center[0], "center[0]");
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.center[1], "center[1]");
    if (r.magnification < 1 || r.magnification > 1e4) {
      throw new TypeError('"magnification" must be between 1 and 10000');
    }
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(r.size, "size");
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(r.feather, "feather");
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.opacity, "opacity");
    for (const name of ["shape", "link", "scaling", "blendingMode"]) {
      if (!Object.hasOwn(magnifySchema[name].variants, r[name])) {
        throw new TypeError(`Invalid "${name}": ${JSON.stringify(r[name])}`);
      }
    }
  }
});



/***/ }

}]);
//# sourceMappingURL=6330.bundle.js.map