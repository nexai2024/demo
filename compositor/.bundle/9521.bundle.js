"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[9521],{

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

/***/ 8835
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   y: () => (/* binding */ createRectTransformImplementations)
/* harmony export */ });
/* harmony import */ var _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6359);
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9728);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3947);



// src/rect-transform-runtime.ts

var WEBGL_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec4 uRect;
void main() {
	vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
	vec2 coverage = clamp(min(p + 0.5, uRect.xy + uRect.zw) - max(p - 0.5, uRect.xy), 0.0, 1.0);
	vec2 uv = (p - uRect.xy) / uRect.zw;
	if (any(lessThanEqual(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) { fragColor = vec4(0.0); return; }
	fragColor = texture(uSource, vec2(uv.x, 1.0 - uv.y)) * min(coverage.x, coverage.y);
}
`;
var WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
struct Params {
	resolution: vec2f,
	padding: vec2f,
	rect: vec4f,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
	let p = input.position.xy;
	let coverage = clamp(min(p + vec2f(0.5), params.rect.xy + params.rect.zw) - max(p - vec2f(0.5), params.rect.xy), vec2f(0), vec2f(1));
	let uv = (p - params.rect.xy) / params.rect.zw;
	if (any(uv <= vec2f(0)) || any(uv > vec2f(1))) { return vec4f(0); }
	return textureSampleLevel(source, sourceSampler, uv, 0) * min(coverage.x, coverage.y);
}
`;
var createRectTransformImplementations = (label, getRect) => ({
  webgl2: remotion__WEBPACK_IMPORTED_MODULE_2__.Internals.createEffectImplementation({
    setup: (target) => (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupSinglePass */ .zE)(target, WEBGL_SHADER, label, ["uResolution", "uRect"]),
    apply: ({ source, width, height, params, state, flipSourceY }) => {
      const rect = getRect(params, width, height);
      (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .prepareSinglePassSource */ .yc)({
        state,
        source,
        width,
        height,
        flipSourceY
      });
      state.gl.uniform2f(state.uniforms.uResolution, width, height);
      state.gl.uniform4f(state.uniforms.uRect, rect.x, rect.y, rect.width, rect.height);
      (0,_index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .drawSinglePass */ .CT)(state);
    },
    cleanup: _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupSinglePass */ .ww
  }),
  webgpu: remotion__WEBPACK_IMPORTED_MODULE_2__.Internals.createEffectImplementation({
    setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuSinglePass */ .DS)(target, label),
    apply: ({ source, width, height, params, state, gpuDevice }) => {
      if (!gpuDevice) {
        throw new Error(`A WebGPU device is required for the ${label} effect`);
      }
      const rect = getRect(params, width, height);
      (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuSinglePass */ .UI)({
        state,
        source,
        width,
        height,
        device: gpuDevice,
        shader: WEBGPU_SHADER,
        uniformData: new Float32Array([
          width,
          height,
          0,
          0,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        ])
      });
    },
    cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuSinglePass */ .Gl
  })
});




/***/ },

/***/ 9521
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scale: () => (/* binding */ scale)
/* harmony export */ });
/* harmony import */ var _index_8p04sssx_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6359);
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9728);
/* harmony import */ var _index_sb3x41jv_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8835);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/scale/index.ts

var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var scaleSchema = {
  scale: {
    type: "number",
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 1,
    description: "Factor",
    hiddenFromList: false,
    defaultKeyframeOutput: "perceptual-scale"
  },
  horizontal: {
    type: "boolean",
    default: true,
    description: "Horizontal"
  },
  vertical: {
    type: "boolean",
    default: true,
    description: "Vertical"
  }
};
var resolve = (p) => ({
  scale: p.scale,
  horizontal: p.horizontal ?? true,
  vertical: p.vertical ?? true
});
var validateScaleParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Scale");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertRequiredFiniteNumber */ .c1)(params.scale, "scale");
  if (typeof params.horizontal !== "undefined" && typeof params.horizontal !== "boolean") {
    throw new TypeError(`"horizontal" must be a boolean, but got ${JSON.stringify(params.horizontal)}`);
  }
  if (typeof params.vertical !== "undefined" && typeof params.vertical !== "boolean") {
    throw new TypeError(`"vertical" must be a boolean, but got ${JSON.stringify(params.vertical)}`);
  }
  const resolved = resolve(params);
  if (resolved.scale <= 0) {
    throw new TypeError(`"scale" must be greater than 0, but got ${JSON.stringify(resolved.scale)}`);
  }
};
var scale = createEffect({
  type: "dev.remotion.effects.scale",
  label: "scale()",
  documentationLink: "https://www.remotion.dev/docs/effects/scale",
  calculateKey: (params) => {
    const r = resolve(params);
    return `scale-${r.scale}-${r.horizontal}-${r.vertical}`;
  },
  implementations: {
    ...(0,_index_sb3x41jv_mjs__WEBPACK_IMPORTED_MODULE_2__/* .createRectTransformImplementations */ .y)("scale", (params, width, height) => {
      const r = resolve(params);
      const scaledWidth = width * (r.horizontal ? r.scale : 1);
      const scaledHeight = height * (r.vertical ? r.scale : 1);
      return {
        x: (width - scaledWidth) / 2,
        y: (height - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight
      };
    }),
    "2d": remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: () => null,
      apply: ({ source, target, width, height, params }) => {
        const ctx = target.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to acquire 2D context for scale effect. The canvas may have been assigned a different context type.");
        }
        const r = resolve(params);
        const scaleX = r.horizontal ? r.scale : 1;
        const scaleY = r.vertical ? r.scale : 1;
        if (scaleX === 1 && scaleY === 1) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(source, 0, 0, width, height);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        const centerX = width / 2;
        const centerY = height / 2;
        ctx.translate(centerX, centerY);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-centerX, -centerY);
        ctx.drawImage(source, 0, 0, width, height);
        ctx.restore();
      },
      cleanup: () => {
        return;
      }
    })
  },
  schema: scaleSchema,
  validateParams: validateScaleParams
});



/***/ }

}]);
//# sourceMappingURL=9521.bundle.js.map