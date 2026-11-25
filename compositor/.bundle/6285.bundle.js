"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[6285],{

/***/ 6285
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  cornerPin: () => (/* reexport */ cornerPin2)
});

// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4svzhprm.mjs
var index_4svzhprm = __webpack_require__(9728);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-gnsce796.mjs
var index_gnsce796 = __webpack_require__(8060);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4fvp93ps.mjs
var index_4fvp93ps = __webpack_require__(4075);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/index.mjs
var esm = __webpack_require__(3947);
;// ./node_modules/@remotion/effects/dist/esm/preview/index-mg80c5jd.mjs




// src/corner-pin/index.ts


// src/corner-pin/corner-pin-runtime.ts


// src/corner-pin/corner-pin-shaders.ts
var CORNER_PIN_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var CORNER_PIN_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uTopLeft;
uniform vec2 uTopRight;
uniform vec2 uBottomRight;
uniform vec2 uBottomLeft;

bool solveProjectiveInverse(vec2 p, out vec2 uv) {
	vec2 p0 = uBottomLeft;
	vec2 p1 = uBottomRight;
	vec2 p2 = uTopRight;
	vec2 p3 = uTopLeft;

	vec2 dx1 = p1 - p2;
	vec2 dx2 = p3 - p2;
	vec2 dx3 = p0 - p1 + p2 - p3;

	float g = 0.0;
	float h = 0.0;

	if (abs(dx3.x) > 0.000001 || abs(dx3.y) > 0.000001) {
		float denominator = dx1.x * dx2.y - dx2.x * dx1.y;
		if (abs(denominator) < 0.000001) {
			return false;
		}

		g = (dx3.x * dx2.y - dx2.x * dx3.y) / denominator;
		h = (dx1.x * dx3.y - dx3.x * dx1.y) / denominator;
	}

	float a = p1.x - p0.x + g * p1.x;
	float b = p3.x - p0.x + h * p3.x;
	float c = p0.x;
	float d = p1.y - p0.y + g * p1.y;
	float e = p3.y - p0.y + h * p3.y;
	float f = p0.y;

	float inverseX =
		(e - f * h) * p.x +
		(c * h - b) * p.y +
		(b * f - c * e);
	float inverseY =
		(f * g - d) * p.x +
		(a - c * g) * p.y +
		(c * d - a * f);
	float inverseW =
		(d * h - e * g) * p.x +
		(b * g - a * h) * p.y +
		(a * e - b * d);

	if (abs(inverseW) < 0.000001) {
		return false;
	}

	uv = vec2(inverseX / inverseW, inverseY / inverseW);
	return true;
}

void main() {
	vec2 sourceUv;
	if (!solveProjectiveInverse(vUv, sourceUv)) {
		fragColor = vec4(0.0);
		return;
	}

	if (
		sourceUv.x < 0.0 ||
		sourceUv.x > 1.0 ||
		sourceUv.y < 0.0 ||
		sourceUv.y > 1.0
	) {
		fragColor = vec4(0.0);
		return;
	}

	fragColor = texture(uSource, sourceUv);
}
`;

// src/corner-pin/corner-pin-runtime.ts
var { createWebGL2ContextError } = esm.Internals;
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
    throw new Error(`Shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createProgram = (gl, vertexSource, fragmentSource) => {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = linkProgram(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
};
var createRgbaTexture = (gl) => {
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
var setupCornerPin = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("corner pin effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = createProgram(gl, CORNER_PIN_VS, CORNER_PIN_FS);
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
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  const textureSource = createRgbaTexture(gl);
  return {
    gl,
    program,
    vao,
    vbo,
    textureSource,
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uTopLeft: gl.getUniformLocation(program, "uTopLeft"),
      uTopRight: gl.getUniformLocation(program, "uTopRight"),
      uBottomRight: gl.getUniformLocation(program, "uBottomRight"),
      uBottomLeft: gl.getUniformLocation(program, "uBottomLeft")
    }
  };
};
var cleanupCornerPin = (state) => {
  const { gl, program, vao, vbo, textureSource } = state;
  gl.deleteTexture(textureSource);
  gl.deleteBuffer(vbo);
  gl.deleteProgram(program);
  gl.deleteVertexArray(vao);
};
var drawFullscreenQuad = (state) => {
  const { gl, vao } = state;
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
};
var setUvUniform = (gl, location, uv) => {
  if (!location) {
    return;
  }
  const shaderUv = (0,index_gnsce796/* publicUvToShaderUv */.S)(uv);
  gl.uniform2f(location, shaderUv[0], shaderUv[1]);
};
var applyCornerPin = ({
  state,
  source,
  width,
  height,
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
  flipSourceY
}) => {
  const { gl, program, textureSource, uniforms } = state;
  gl.viewport(0, 0, width, height);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.bindTexture(gl.TEXTURE_2D, textureSource);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  if (uniforms.uSource)
    gl.uniform1i(uniforms.uSource, 0);
  setUvUniform(gl, uniforms.uTopLeft, topLeft);
  setUvUniform(gl, uniforms.uTopRight, topRight);
  setUvUniform(gl, uniforms.uBottomRight, bottomRight);
  setUvUniform(gl, uniforms.uBottomLeft, bottomLeft);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textureSource);
  drawFullscreenQuad(state);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
};

// src/corner-pin/webgpu-shader.ts
var CORNER_PIN_WEBGPU_SHADER = `
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {top: vec4f, bottom: vec4f,}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let p0 = params.bottom.zw; let p1 = params.bottom.xy;
 let p2 = params.top.zw; let p3 = params.top.xy;
 let dx1 = p1 - p2; let dx2 = p3 - p2; let dx3 = p0 - p1 + p2 - p3;
 var g = 0.0; var h = 0.0;
 if (abs(dx3.x) > 0.000001 || abs(dx3.y) > 0.000001) {
  let denominator = dx1.x * dx2.y - dx2.x * dx1.y;
  if (abs(denominator) < 0.000001) {return vec4f(0);}
  g = (dx3.x * dx2.y - dx2.x * dx3.y) / denominator;
  h = (dx1.x * dx3.y - dx3.x * dx1.y) / denominator;
 }
 let a = p1.x - p0.x + g * p1.x; let b = p3.x - p0.x + h * p3.x; let c = p0.x;
 let d = p1.y - p0.y + g * p1.y; let e = p3.y - p0.y + h * p3.y; let f = p0.y;
 let p = input.uv;
 let x = (e-f*h)*p.x + (c*h-b)*p.y + (b*f-c*e);
 let y = (f*g-d)*p.x + (a-c*g)*p.y + (c*d-a*f);
 let w = (d*h-e*g)*p.x + (b*g-a*h)*p.y + (a*e-b*d);
 if (abs(w) < 0.000001) {return vec4f(0);}
 let uv = vec2f(x/w, 1.0-y/w);
 if (any(uv < vec2f(0)) || any(uv > vec2f(1))) {return vec4f(0);}
 return textureSampleLevel(source, sourceSampler, uv, 0);
}
`;

// src/corner-pin/index.ts
var { createEffect } = esm.Internals;
var DEFAULT_TOP_LEFT = [0, 0];
var DEFAULT_TOP_RIGHT = [1, 0];
var DEFAULT_BOTTOM_RIGHT = [1, 1];
var DEFAULT_BOTTOM_LEFT = [0, 1];
var cornerSchema = (defaultValue) => ({
  type: "uv-coordinate",
  min: -1,
  max: 2,
  step: 0.01,
  default: defaultValue,
  description: "Corner"
});
var cornerPinSchema = {
  topLeft: {
    ...cornerSchema(DEFAULT_TOP_LEFT),
    description: "Top left"
  },
  topRight: {
    ...cornerSchema(DEFAULT_TOP_RIGHT),
    description: "Top right"
  },
  bottomRight: {
    ...cornerSchema(DEFAULT_BOTTOM_RIGHT),
    description: "Bottom right"
  },
  bottomLeft: {
    ...cornerSchema(DEFAULT_BOTTOM_LEFT),
    description: "Bottom left"
  }
};
var resolve = (p) => ({
  topLeft: [...p.topLeft ?? DEFAULT_TOP_LEFT],
  topRight: [...p.topRight ?? DEFAULT_TOP_RIGHT],
  bottomRight: [
    ...p.bottomRight ?? DEFAULT_BOTTOM_RIGHT
  ],
  bottomLeft: [
    ...p.bottomLeft ?? DEFAULT_BOTTOM_LEFT
  ]
});
var assertOptionalUvCoordinate = (value, name) => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new TypeError(`"${name}" must be a [number, number] tuple`);
  }
};
var validateCornerPinParams = (params) => {
  (0,index_4fvp93ps/* assertEffectParamsObject */.db)(params, "Corner pin");
  assertOptionalUvCoordinate(params.topLeft, "topLeft");
  assertOptionalUvCoordinate(params.topRight, "topRight");
  assertOptionalUvCoordinate(params.bottomRight, "bottomRight");
  assertOptionalUvCoordinate(params.bottomLeft, "bottomLeft");
};
var cornerPin2 = createEffect({
  type: "dev.remotion.effects.cornerPin",
  label: "cornerPin()",
  documentationLink: "https://www.remotion.dev/docs/effects/corner-pin",
  calculateKey: (params) => {
    const r = resolve(params);
    return `corner-pin-${r.topLeft.join(":")}-${r.topRight.join(":")}-${r.bottomRight.join(":")}-${r.bottomLeft.join(":")}`;
  },
  implementations: {
    webgpu: esm.Internals.createEffectImplementation({
      setup: (target) => (0,index_4svzhprm/* setupWebGpuSinglePass */.DS)(target, "corner-pin"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for this effect");
        const r = resolve(params);
        (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: CORNER_PIN_WEBGPU_SHADER,
          uniformData: new Float32Array([
            ...r.topLeft,
            ...r.topRight,
            ...r.bottomRight,
            ...r.bottomLeft
          ])
        });
      },
      cleanup: index_4svzhprm/* cleanupWebGpuSinglePass */.Gl
    }),
    webgl2: esm.Internals.createEffectImplementation({
      setup: (target) => setupCornerPin(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        applyCornerPin({
          state,
          source,
          width,
          height,
          topLeft: r.topLeft,
          topRight: r.topRight,
          bottomRight: r.bottomRight,
          bottomLeft: r.bottomLeft,
          flipSourceY
        });
      },
      cleanup: (state) => cleanupCornerPin(state)
    })
  },
  schema: cornerPinSchema,
  validateParams: validateCornerPinParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/corner-pin.mjs





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

/***/ 8060
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   S: () => (/* binding */ publicUvToShaderUv)
/* harmony export */ });
// src/uv-coordinate.ts
var publicUvToShaderUv = (uv) => {
  return [uv[0], 1 - uv[1]];
};




/***/ }

}]);
//# sourceMappingURL=6285.bundle.js.map