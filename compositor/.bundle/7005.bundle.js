"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[7005],{

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

/***/ 7005
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  tile: () => (/* reexport */ tile2)
});

// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-8p04sssx.mjs
var index_8p04sssx = __webpack_require__(6359);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4svzhprm.mjs
var index_4svzhprm = __webpack_require__(9728);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4fvp93ps.mjs
var index_4fvp93ps = __webpack_require__(4075);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/index.mjs
var esm = __webpack_require__(3947);
;// ./node_modules/@remotion/effects/dist/esm/preview/index-seag64fz.mjs




// src/tile.ts


// src/tile-gpu-runtime.ts

var WEBGL_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec4 uBounds;
uniform vec4 uOptions;
void main() {
	vec2 p = vec2(gl_FragCoord.x, uOptions.y - gl_FragCoord.y);
	if (uOptions.z == 0.0 && uOptions.w == 0.0) {
		fragColor = texture(uSource, vUv);
		return;
	}
	if (uBounds.z <= 0.0 || uBounds.w <= 0.0) { fragColor = vec4(0.0); return; }
	vec2 q = (p - uBounds.xy) / uBounds.zw;
	if ((uOptions.z == 0.0 && (q.x < 0.0 || q.x >= 1.0)) || (uOptions.w == 0.0 && (q.y < 0.0 || q.y >= 1.0))) { fragColor = vec4(0.0); return; }
	vec2 local = mix(fract(q), 1.0 - fract(q), mod(floor(q), 2.0));
	vec2 samplePosition = uBounds.xy + local * uBounds.zw;
	vec2 sourceSize = vec2(textureSize(uSource, 0));
	if (any(lessThan(samplePosition, vec2(0.0))) || any(greaterThanEqual(samplePosition, sourceSize))) { fragColor = vec4(0.0); return; }
	vec2 uv = samplePosition / sourceSize;
	fragColor = texture(uSource, vec2(uv.x, 1.0 - uv.y));
}
`;
var WEBGPU_SHADER = `
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
struct Params { bounds: vec4f, options: vec4f }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
	let p = input.position.xy;
	if (params.options.z == 0.0 && params.options.w == 0.0) {
		return textureSampleLevel(source, sourceSampler, input.uv, 0);
	}
	if (params.bounds.z <= 0.0 || params.bounds.w <= 0.0) { return vec4f(0); }
	let q = (p - params.bounds.xy) / params.bounds.zw;
	if ((params.options.z == 0.0 && (q.x < 0.0 || q.x >= 1.0)) || (params.options.w == 0.0 && (q.y < 0.0 || q.y >= 1.0))) { return vec4f(0); }
	let tile = floor(q);
	let mirror = tile - 2.0 * floor(tile / 2.0);
	let local = mix(fract(q), vec2f(1) - fract(q), mirror);
	let samplePosition = params.bounds.xy + local * params.bounds.zw;
	let sourceSize = vec2f(textureDimensions(source));
	if (any(samplePosition < vec2f(0)) || any(samplePosition >= sourceSize)) { return vec4f(0); }
	return textureSampleLevel(source, sourceSampler, samplePosition / sourceSize, 0);
}
`;
var createTileGpuImplementations = ({
  setupBounds,
  getBounds,
  resolve
}) => ({
  webgl2: esm.Internals.createEffectImplementation({
    setup: (target) => ({
      bounds: setupBounds(target),
      render: (0,index_8p04sssx/* setupSinglePass */.zE)(target, WEBGL_SHADER, "tile", [
        "uBounds",
        "uOptions"
      ])
    }),
    apply: ({ source, width, height, params, state, flipSourceY }) => {
      const r = resolve(params);
      const bounds = r.horizontal || r.vertical ? getBounds({ source, width, height, params, state: state.bounds }) : null;
      (0,index_8p04sssx/* prepareSinglePassSource */.yc)({
        state: state.render,
        source,
        width,
        height,
        flipSourceY
      });
      const { gl, uniforms } = state.render;
      gl.uniform4f(uniforms.uBounds, bounds?.left ?? 0, bounds?.top ?? 0, bounds?.width ?? 0, bounds?.height ?? 0);
      gl.uniform4f(uniforms.uOptions, width, height, Number(r.horizontal), Number(r.vertical));
      (0,index_8p04sssx/* drawSinglePass */.CT)(state.render);
    },
    cleanup: (state) => (0,index_8p04sssx/* cleanupSinglePass */.ww)(state.render)
  }),
  webgpu: esm.Internals.createEffectImplementation({
    setup: (target) => ({
      bounds: setupBounds(target),
      render: (0,index_4svzhprm/* setupWebGpuSinglePass */.DS)(target, "tile")
    }),
    apply: ({ source, width, height, params, state, gpuDevice }) => {
      if (!gpuDevice) {
        throw new Error("A WebGPU device is required for the tile effect");
      }
      const r = resolve(params);
      const bounds = r.horizontal || r.vertical ? getBounds({ source, width, height, params, state: state.bounds }) : null;
      (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
        state: state.render,
        source,
        width,
        height,
        device: gpuDevice,
        shader: WEBGPU_SHADER,
        uniformData: new Float32Array([
          bounds?.left ?? 0,
          bounds?.top ?? 0,
          bounds?.width ?? 0,
          bounds?.height ?? 0,
          width,
          height,
          Number(r.horizontal),
          Number(r.vertical)
        ])
      });
    },
    cleanup: (state) => (0,index_4svzhprm/* cleanupWebGpuSinglePass */.Gl)(state.render)
  })
});

// src/tile.ts
var { createEffect } = esm.Internals;
var DEFAULT_HORIZONTAL = true;
var DEFAULT_VERTICAL = true;
var tileSchema = {
  horizontal: {
    type: "boolean",
    default: DEFAULT_HORIZONTAL,
    description: "Horizontal"
  },
  vertical: {
    type: "boolean",
    default: DEFAULT_VERTICAL,
    description: "Vertical"
  }
};
var resolve = (params) => ({
  horizontal: params.horizontal ?? DEFAULT_HORIZONTAL,
  vertical: params.vertical ?? DEFAULT_VERTICAL
});
var validateTileParams = (params) => {
  (0,index_4fvp93ps/* assertEffectParamsObject */.db)(params, "Tile");
  (0,index_4fvp93ps/* assertOptionalBoolean */.fX)(params.horizontal, "horizontal");
  (0,index_4fvp93ps/* assertOptionalBoolean */.fX)(params.vertical, "vertical");
};
var setupTile = (target) => {
  const boundsCanvas = target.ownerDocument.createElement("canvas");
  const boundsContext = boundsCanvas.getContext("2d", {
    colorSpace: "srgb",
    willReadFrequently: true
  });
  if (!boundsContext) {
    throw new Error("Failed to acquire 2D context for tile effect.");
  }
  const tileCanvas = target.ownerDocument.createElement("canvas");
  const tileContext = tileCanvas.getContext("2d");
  if (!tileContext) {
    throw new Error("Failed to acquire 2D context for tile effect.");
  }
  return { boundsCanvas, boundsContext, tileCanvas, tileContext };
};
var getTileBounds = ({
  source,
  width,
  height,
  params,
  state
}) => {
  const r = resolve(params);
  if (state.boundsCanvas.width !== width || state.boundsCanvas.height !== height) {
    state.boundsCanvas.width = width;
    state.boundsCanvas.height = height;
  }
  state.boundsContext.clearRect(0, 0, width, height);
  state.boundsContext.drawImage(source, 0, 0, width, height);
  const pixels = state.boundsContext.getImageData(0, 0, width, height).data;
  const rowMaximumAlpha = (y) => {
    let maximumAlpha = 0;
    for (let x = 0;x < width; x++) {
      maximumAlpha = Math.max(maximumAlpha, pixels[(y * width + x) * 4 + 3]);
    }
    return maximumAlpha;
  };
  const columnMaximumAlpha = (x, visibleTop, visibleBottom) => {
    let maximumAlpha = 0;
    for (let y = visibleTop;y <= visibleBottom; y++) {
      maximumAlpha = Math.max(maximumAlpha, pixels[(y * width + x) * 4 + 3]);
    }
    return maximumAlpha;
  };
  let top = 0;
  while (top < height && rowMaximumAlpha(top) === 0) {
    top++;
  }
  if (top === height) {
    return null;
  }
  let bottom = height - 1;
  while (bottom > top && rowMaximumAlpha(bottom) === 0) {
    bottom--;
  }
  let left = 0;
  while (left < width && columnMaximumAlpha(left, top, bottom) === 0) {
    left++;
  }
  let right = width - 1;
  while (right > left && columnMaximumAlpha(right, top, bottom) === 0) {
    right--;
  }
  if (r.vertical && top < bottom) {
    if (rowMaximumAlpha(top) < rowMaximumAlpha(top + 1)) {
      top++;
    }
    if (rowMaximumAlpha(bottom) < rowMaximumAlpha(bottom - 1)) {
      bottom--;
    }
  }
  if (r.horizontal && left < right) {
    if (columnMaximumAlpha(left, top, bottom) < columnMaximumAlpha(left + 1, top, bottom)) {
      left++;
    }
    if (columnMaximumAlpha(right, top, bottom) < columnMaximumAlpha(right - 1, top, bottom)) {
      right--;
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
};
var tile2 = createEffect({
  type: "dev.remotion.effects.tile",
  label: "tile()",
  documentationLink: "https://www.remotion.dev/docs/effects/tile",
  calculateKey: (params) => {
    const r = resolve(params);
    return `tile-${r.horizontal}-${r.vertical}`;
  },
  implementations: {
    ...createTileGpuImplementations({
      setupBounds: setupTile,
      getBounds: getTileBounds,
      resolve
    }),
    "2d": esm.Internals.createEffectImplementation({
      setup: setupTile,
      apply: ({ source, target, width, height, params, state }) => {
        const context = target.getContext("2d");
        if (!context) {
          throw new Error("Failed to acquire 2D context for tile effect. The canvas may have been assigned a different context type.");
        }
        const r = resolve(params);
        context.clearRect(0, 0, width, height);
        if (!r.horizontal && !r.vertical) {
          context.drawImage(source, 0, 0, width, height);
          return;
        }
        const bounds = getTileBounds({ source, width, height, params, state });
        if (!bounds)
          return;
        const { left, top } = bounds;
        const tileWidth = bounds.width;
        const tileHeight = bounds.height;
        state.tileCanvas.width = tileWidth;
        state.tileCanvas.height = tileHeight;
        state.tileContext.clearRect(0, 0, tileWidth, tileHeight);
        state.tileContext.drawImage(source, left, top, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
        context.clearRect(0, 0, width, height);
        const startX = r.horizontal ? left - Math.ceil(left / tileWidth) * tileWidth : left;
        const startY = r.vertical ? top - Math.ceil(top / tileHeight) * tileHeight : top;
        const endX = r.horizontal ? width : left + tileWidth;
        const endY = r.vertical ? height : top + tileHeight;
        for (let y = startY;y < endY; y += tileHeight) {
          const tileY = Math.round((y - top) / tileHeight);
          const mirrorY = r.vertical && Math.abs(tileY) % 2 === 1;
          for (let x = startX;x < endX; x += tileWidth) {
            const tileX = Math.round((x - left) / tileWidth);
            const mirrorX = r.horizontal && Math.abs(tileX) % 2 === 1;
            context.save();
            context.translate(mirrorX ? x + tileWidth : x, mirrorY ? y + tileHeight : y);
            context.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
            context.drawImage(state.tileCanvas, 0, 0);
            context.restore();
          }
        }
      },
      cleanup: () => {
        return;
      }
    })
  },
  schema: tileSchema,
  validateParams: validateTileParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/tile.mjs






/***/ }

}]);
//# sourceMappingURL=7005.bundle.js.map