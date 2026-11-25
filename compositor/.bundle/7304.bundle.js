"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[7304],{

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

/***/ 4223
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   KX: () => (/* binding */ cleanupWebGpuMesh),
/* harmony export */   pr: () => (/* binding */ setupWebGpuMesh),
/* harmony export */   wQ: () => (/* binding */ applyWebGpuMesh)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);


// src/webgpu-mesh-runtime.ts
var setupWebGpuMesh = (target, label) => {
  const context = target.getContext("webgpu");
  if (!context)
    throw new Error(`WebGPU is not available for the ${label} effect`);
  return { context, label, resources: null };
};
var cleanupWebGpuMesh = (state) => {
  state.resources?.uniforms.destroy();
  state.resources?.multisample?.texture.destroy();
  state.resources?.multisample?.resolved.destroy();
  state.resources?.vertices?.buffer.destroy();
  state.resources?.source?.texture.destroy();
  state.resources = null;
  state.context.unconfigure();
};
var applyWebGpuMesh = ({
  state,
  source,
  width,
  height,
  vertices,
  device,
  shader,
  uniformData,
  topology,
  blend,
  vertexCount,
  instanceCount
}) => {
  const uniformSize = Math.max(16, Math.ceil(uniformData.byteLength / 16) * 16);
  if (state.resources && (state.resources.device !== device || state.resources.shader !== shader || state.resources.uniformSize !== uniformSize || state.resources.topology !== topology || state.resources.blend !== blend))
    cleanupWebGpuMesh(state);
  if (!state.resources) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    state.context.configure({ device, format, alphaMode: "premultiplied" });
    const shared = (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .getSharedWebGpuResources */ .JR)({
      device,
      key: JSON.stringify(["mesh", shader, format, topology, blend]),
      create: () => {
        const module = device.createShaderModule({
          code: shader,
          label: state.label
        });
        const blendComponent = {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add"
        };
        const pipeline = device.createRenderPipeline({
          label: state.label,
          layout: device.createPipelineLayout({
            bindGroupLayouts: [
              device.createBindGroupLayout({
                entries: [
                  {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                  },
                  {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                  },
                  {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" }
                  },
                  {
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" }
                  }
                ]
              })
            ]
          }),
          vertex: { module, entryPoint: "vertex" },
          fragment: {
            module,
            entryPoint: "fragment",
            targets: [
              {
                format,
                ...blend ? { blend: { color: blendComponent, alpha: blendComponent } } : {}
              }
            ]
          },
          primitive: { topology },
          multisample: { count: 4 }
        });
        const flipModule = device.createShaderModule({
          code: `${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 return textureSampleLevel(source,sourceSampler,vec2f(input.uv.x,1.0-input.uv.y),0);
}`
        });
        const flipPipeline = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: flipModule, entryPoint: "vertex" },
          fragment: {
            module: flipModule,
            entryPoint: "fragment",
            targets: [{ format }]
          },
          primitive: { topology: "triangle-list" }
        });
        const sampler = device.createSampler({
          magFilter: "linear",
          minFilter: "linear"
        });
        return { pipeline, flipPipeline, sampler };
      }
    });
    state.resources = {
      device,
      shader,
      uniformSize,
      topology,
      blend,
      pipeline: shared.pipeline,
      flipPipeline: shared.flipPipeline,
      sampler: shared.sampler,
      uniforms: device.createBuffer({
        size: uniformSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }),
      vertices: null,
      multisample: null,
      source: null
    };
  }
  const r = state.resources;
  const sourceWidth = "displayWidth" in source ? source.displayWidth : ("videoWidth" in source) ? source.videoWidth : ("naturalWidth" in source) ? source.naturalWidth : typeof source.width === "number" ? source.width : source.width.baseVal.value;
  const sourceHeight = "displayHeight" in source ? source.displayHeight : ("videoHeight" in source) ? source.videoHeight : ("naturalHeight" in source) ? source.naturalHeight : typeof source.height === "number" ? source.height : source.height.baseVal.value;
  if (r.source && (r.source.width !== sourceWidth || r.source.height !== sourceHeight)) {
    r.source.texture.destroy();
    r.source = null;
  }
  if (!r.source)
    r.source = {
      width: sourceWidth,
      height: sourceHeight,
      texture: device.createTexture({
        size: [sourceWidth, sourceHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      })
    };
  device.queue.copyExternalImageToTexture({ source }, { texture: r.source.texture, premultipliedAlpha: true }, [sourceWidth, sourceHeight]);
  const size = Math.max(4, vertices?.byteLength ?? 0);
  if (!r.vertices || r.vertices.size < size) {
    r.vertices?.buffer.destroy();
    r.vertices = {
      size,
      buffer: device.createBuffer({
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      })
    };
  }
  if (vertices)
    device.queue.writeBuffer(r.vertices.buffer, 0, vertices.buffer, vertices.byteOffset, vertices.byteLength);
  device.queue.writeBuffer(r.uniforms, 0, uniformData);
  const bindGroup = device.createBindGroup({
    layout: r.pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: r.source.texture.createView() },
      { binding: 1, resource: r.sampler },
      { binding: 2, resource: { buffer: r.uniforms } },
      { binding: 3, resource: { buffer: r.vertices.buffer } }
    ]
  });
  if (r.multisample && (r.multisample.width !== width || r.multisample.height !== height)) {
    r.multisample.texture.destroy();
    r.multisample.resolved.destroy();
    r.multisample = null;
  }
  if (!r.multisample)
    r.multisample = {
      width,
      height,
      resolved: device.createTexture({
        size: [width, height],
        format: navigator.gpu.getPreferredCanvasFormat(),
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      }),
      texture: device.createTexture({
        size: [width, height],
        format: navigator.gpu.getPreferredCanvasFormat(),
        sampleCount: 4,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      })
    };
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: r.multisample.texture.createView(),
        resolveTarget: r.multisample.resolved.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  pass.setPipeline(r.pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(vertexCount, instanceCount);
  pass.end();
  const flipGroup = device.createBindGroup({
    layout: r.flipPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: r.multisample.resolved.createView() },
      { binding: 1, resource: r.sampler }
    ]
  });
  const flipPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: state.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  flipPass.setPipeline(r.flipPipeline);
  flipPass.setBindGroup(0, flipGroup);
  flipPass.draw(3);
  flipPass.end();
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

/***/ 7304
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   shatter: () => (/* binding */ shatter)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4223);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/shatter/index.ts


// src/shatter/geometry.ts
var signedTriangleArea = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var hash = (x, y, seed) => {
  let h = Math.imul(x, 2376512323) ^ Math.imul(y, 3625334849) ^ Math.imul(seed, 3407524639);
  h ^= h >>> 13;
  h = Math.imul(h, 1540483477);
  h ^= h >>> 15;
  return (h & 16777215) / 16777216;
};
function* patternCells(pattern, cell, x0, y0, x1, y1, seed) {
  const i0 = Math.floor(x0 / cell) - 1;
  const i1 = Math.ceil(x1 / cell) + 1;
  const j0 = Math.floor(y0 / cell) - 1;
  const j1 = Math.ceil(y1 / cell) + 1;
  if (pattern === "bricks") {
    const brickHeight = cell / 2;
    const row0 = Math.floor(y0 / brickHeight) - 1;
    const row1 = Math.ceil(y1 / brickHeight) + 1;
    for (let row = row0;row <= row1; row++) {
      const shift = Math.abs(row % 2) * cell * 0.5;
      for (let i = i0;i <= i1; i++) {
        const x = i * cell + shift;
        const y = row * brickHeight;
        yield [
          [x, y],
          [x + cell * 0.5, y],
          [x + cell, y],
          [x + cell, y + brickHeight],
          [x + cell * 0.5, y + brickHeight],
          [x, y + brickHeight]
        ];
      }
    }
    return;
  }
  if (pattern === "hexagons") {
    const radius = cell / Math.sqrt(3);
    const dx = 1.5 * radius;
    const col0 = Math.floor(x0 / dx) - 1;
    const col1 = Math.ceil(x1 / dx) + 1;
    for (let col = col0;col <= col1; col++) {
      for (let row = j0;row <= j1; row++) {
        const cx = col * dx;
        const cy = (row + Math.abs(col % 2) * 0.5) * cell;
        yield Array.from({ length: 6 }, (_, k) => {
          const angle = k * Math.PI / 3;
          return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
        });
      }
    }
    return;
  }
  const jitter = (i, j) => [
    i * cell + (hash(i, j + 17, seed) * 2 - 1) * cell * 0.35,
    j * cell + (hash(i, j + 91, seed) * 2 - 1) * cell * 0.35
  ];
  for (let j = j0;j <= j1; j++) {
    for (let i = i0;i <= i1; i++) {
      const x = i * cell;
      const y = j * cell;
      const a = pattern === "glass" ? jitter(i, j) : [x, y];
      const b = pattern === "glass" ? jitter(i + 1, j) : [x + cell, y];
      const c = pattern === "glass" ? jitter(i + 1, j + 1) : [x + cell, y + cell];
      const d = pattern === "glass" ? jitter(i, j + 1) : [x, y + cell];
      const acValid = signedTriangleArea(a, b, c) > 0 && signedTriangleArea(a, c, d) > 0;
      const bdValid = signedTriangleArea(a, b, d) > 0 && signedTriangleArea(b, c, d) > 0;
      if (pattern === "squares") {
        yield [a, b, c, d];
      } else if (pattern === "glass" ? acValid && (!bdValid || hash(i, j, seed ^ 85) < 0.5) : Math.abs((i + j) % 2) === 1) {
        yield [a, b, c];
        yield [a, c, d];
      } else {
        yield [a, b, d];
        yield [b, c, d];
      }
    }
  }
}
var clipPolygon = (input, width, height) => {
  let polygon = input;
  for (let boundary = 0;boundary < 4; boundary++) {
    const axis = boundary < 2 ? 0 : 1;
    const limit = boundary % 2 === 0 ? 0 : axis === 0 ? width : height;
    const sign = boundary % 2 === 0 ? 1 : -1;
    const output = [];
    for (let i = 0;i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const aInside = (a[axis] - limit) * sign >= 0;
      const bInside = (b[axis] - limit) * sign >= 0;
      if (aInside) {
        output.push(a);
      }
      if (aInside !== bInside) {
        const fraction = (limit - a[axis]) / (b[axis] - a[axis]);
        const intersection = [
          a[0] + (b[0] - a[0]) * fraction,
          a[1] + (b[1] - a[1]) * fraction
        ];
        intersection[axis] = limit;
        output.push(intersection);
      }
    }
    polygon = output;
  }
  return polygon;
};
var createShatterGeometry = (width, height, params) => {
  const identity = new Float32Array([
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    width,
    0,
    0,
    1,
    0,
    1,
    0,
    width,
    height,
    0,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    width,
    height,
    0,
    1,
    1,
    1,
    0,
    0,
    height,
    0,
    0,
    1,
    1,
    0
  ]);
  if (params.time === 0 || params.radius <= Math.abs(params.depth) || params.strength === 0 && params.randomness === 0 && params.gravity === 0) {
    return identity;
  }
  const direction = params.direction % 360 * Math.PI / 180;
  const sin = Math.sin(direction);
  const cos = Math.cos(direction);
  const originX = (Math.abs(params.origin[0]) > 1e6 ? params.origin[0] % 1 : params.origin[0]) * width;
  const originY = (Math.abs(params.origin[1]) > 1e6 ? params.origin[1] % 1 : params.origin[1]) * height;
  const corners = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ].map(([x, y]) => [
    (x - originX) * cos + (y - originY) * sin,
    -(x - originX) * sin + (y - originY) * cos
  ]);
  const x0 = Math.min(...corners.map((point) => point[0]));
  const x1 = Math.max(...corners.map((point) => point[0]));
  const y0 = Math.min(...corners.map((point) => point[1]));
  const y1 = Math.max(...corners.map((point) => point[1]));
  let cell = Math.max(width / params.repetitions, Math.sqrt((x1 - x0) * (y1 - y0) / 20000), Math.max(x1 - x0, y1 - y0) / 1e4);
  while (2 * (Math.ceil((x1 - x0) / cell) + 5) * (Math.ceil((y1 - y0) / cell) + 5) > 50000) {
    cell *= 1.1;
  }
  const seed = Math.imul(params.seed, 2654435761);
  const unit = width * 0.1;
  const drag = params.viscosity * 5;
  const { time } = params;
  const velocityFactor = drag < 0.000001 ? time : -Math.expm1(-drag * time) / drag;
  const gravityFactor = drag < 0.000001 ? time * time / 2 : drag * time < 0.001 ? time * time * (0.5 - drag * time / 6 + (drag * time) ** 2 / 24) : (time - velocityFactor) / drag;
  const radius = params.radius * width;
  const depth = params.depth * width;
  const centerX = params.center[0] * width;
  const centerY = params.center[1] * height;
  const extrusion = params.extrusionDepth * cell;
  const cameraDistance = Math.max(width, height) * 2;
  const faces = [];
  let key = 0;
  let anyMoving = false;
  for (const patternPolygon of patternCells(params.pattern, cell, x0, y0, x1, y1, seed)) {
    const index = key++;
    const sourcePolygon = patternPolygon.map(([x, y]) => [
      originX + x * cos - y * sin,
      originY + x * sin + y * cos
    ]);
    const polygon = clipPolygon(sourcePolygon, width, height);
    if (polygon.length < 3) {
      continue;
    }
    const cx = sourcePolygon.reduce((sum, point) => sum + point[0], 0) / sourcePolygon.length;
    const cy = sourcePolygon.reduce((sum, point) => sum + point[1], 0) / sourcePolygon.length;
    const dx = cx - centerX;
    const dy = cy - centerY;
    const distance = Math.hypot(dx, dy, depth);
    const broken = distance < radius;
    let px = cx;
    let py = cy;
    let pz = 0;
    let rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (broken) {
      const force = params.strength * (1 - distance / radius) * unit / Math.max(distance, 0.000001);
      const mass = Math.max(0.001, 1 + params.massVariance * (hash(index, 1, seed) * 2 - 1));
      const vx = dx * force / mass + params.randomness * unit * (hash(index, 2, seed) * 2 - 1) * 2;
      const vy = dy * force / mass + params.randomness * unit * (hash(index, 3, seed) * 2 - 1) * 2;
      const vz = depth * force / mass + params.randomness * unit * (hash(index, 4, seed) * 2 - 1) * 2;
      px += vx * velocityFactor;
      py += vy * velocityFactor + params.gravity * unit * gravityFactor;
      pz += vz * velocityFactor;
      const axis = [
        hash(index, 6, seed) * 2 - 1,
        hash(index, 7, seed) * 2 - 1,
        hash(index, 8, seed) * 2 - 1
      ];
      const axisLength = Math.hypot(...axis);
      const speed = Math.min(10, Math.hypot(vx, vy, vz) / unit);
      const angle = params.rotationSpeed * Math.PI * 2 * (0.5 + hash(index, 9, seed)) * speed * velocityFactor;
      if (axisLength > 0.000000000001 && angle !== 0) {
        const [x, y, z] = axis.map((value) => value / axisLength);
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        const t = 1 - c;
        rotation = [
          t * x * x + c,
          t * x * y - s * z,
          t * x * z + s * y,
          t * x * y + s * z,
          t * y * y + c,
          t * y * z - s * x,
          t * x * z - s * y,
          t * y * z + s * x,
          t * z * z + c
        ];
      }
    }
    const moving = px !== cx || py !== cy || pz !== 0 || rotation.some((value, axisIndex) => value !== (axisIndex % 4 === 0 ? 1 : 0));
    anyMoving ||= moving;
    const shade = moving ? 0.25 + 0.75 * Math.abs(rotation[8]) : 1;
    const vertices = polygon.map(([x, y]) => [
      px + rotation[0] * (x - cx) + rotation[1] * (y - cy),
      py + rotation[3] * (x - cx) + rotation[4] * (y - cy),
      pz + rotation[6] * (x - cx) + rotation[7] * (y - cy),
      x / width,
      y / height,
      shade,
      0
    ]);
    if (vertices.some((vertex) => vertex.some((value) => !Number.isFinite(value) || Math.abs(value) > 1000000000000000000000000000000))) {
      continue;
    }
    faces.push({
      depth: vertices.reduce((sum, vertex) => sum + vertex[2], 0) / vertices.length,
      vertices
    });
    if (!moving || extrusion === 0) {
      continue;
    }
    for (let edge = 0;edge < polygon.length; edge++) {
      const a = polygon[edge];
      const b = polygon[(edge + 1) % polygon.length];
      const edgeX = b[0] - a[0];
      const edgeY = b[1] - a[1];
      const length = Math.hypot(edgeX, edgeY);
      if (length < 0.000001) {
        continue;
      }
      const nx = (rotation[0] * edgeY - rotation[1] * edgeX) / length;
      const ny = (rotation[3] * edgeY - rotation[4] * edgeX) / length;
      const nz = (rotation[6] * edgeY - rotation[7] * edgeX) / length;
      const frontA = vertices[edge];
      const frontB = vertices[(edge + 1) % vertices.length];
      const mx = (frontA[0] + frontB[0] + rotation[2] * extrusion) / 2;
      const my = (frontA[1] + frontB[1] + rotation[5] * extrusion) / 2;
      const mz = (frontA[2] + frontB[2] + rotation[8] * extrusion) / 2;
      if (nx * (width / 2 - mx) + ny * (height / 2 - my) + nz * (-cameraDistance - mz) <= 0) {
        continue;
      }
      const au = a[0] / width;
      const av = a[1] / height;
      const bu = b[0] / width;
      const bv = b[1] / height;
      const sideShade = 0.25 + 0.75 * Math.abs(nz);
      const sideVertices = [
        [frontA[0], frontA[1], frontA[2], au, av, sideShade, 1],
        [frontB[0], frontB[1], frontB[2], bu, bv, sideShade, 1],
        [
          frontB[0] + rotation[2] * extrusion,
          frontB[1] + rotation[5] * extrusion,
          frontB[2] + rotation[8] * extrusion,
          bu,
          bv,
          sideShade,
          1
        ],
        [
          frontA[0] + rotation[2] * extrusion,
          frontA[1] + rotation[5] * extrusion,
          frontA[2] + rotation[8] * extrusion,
          au,
          av,
          sideShade,
          1
        ]
      ];
      if (sideVertices.every((vertex) => vertex.every((value) => Number.isFinite(value) && Math.abs(value) < 1000000000000000000000000000000))) {
        faces.push({ depth: mz, vertices: sideVertices });
      }
    }
  }
  if (!anyMoving) {
    return identity;
  }
  faces.sort((a, b) => b.depth - a.depth);
  const floatCount = faces.reduce((sum, face) => {
    const centered = params.pattern === "bricks" && face.vertices[0][6] === 0;
    return sum + (face.vertices.length - (centered ? 0 : 2)) * 3 * 7;
  }, 0);
  const output = new Float32Array(floatCount);
  let offset = 0;
  for (const face of faces) {
    const centered = params.pattern === "bricks" && face.vertices[0][6] === 0;
    const center = centered ? face.vertices[0].map((_, component) => face.vertices.reduce((sum, vertex) => sum + vertex[component], 0) / face.vertices.length) : face.vertices[0];
    const triangleCount = face.vertices.length - (centered ? 0 : 2);
    for (let i = 0;i < triangleCount; i++) {
      const start = centered ? i : i + 1;
      for (const vertex of [
        center,
        face.vertices[start],
        face.vertices[(start + 1) % face.vertices.length]
      ]) {
        output.set(vertex, offset);
        offset += 7;
      }
    }
  }
  return output;
};

// src/shatter/runtime.ts
var VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUv;
layout(location = 2) in float aShade;
layout(location = 3) in float aSide;

uniform vec2 uResolution;

out vec2 vUv;
out float vShade;
out float vSide;

void main() {
	float distance = max(uResolution.x, uResolution.y) * 2.0;
	float near = distance * 0.05;
	float w = distance + aPosition.z;
	vec2 position = vec2(
		(aPosition.x - uResolution.x * 0.5) * 2.0 / uResolution.x,
		(uResolution.y * 0.5 - aPosition.y) * 2.0 / uResolution.y
	);
	// Keep homogeneous coordinates so WebGL clips shards at the near plane
	// and interpolates their texture coordinates with perspective correction.
	gl_Position = vec4(position * distance, w - 2.0 * near, w);
	vUv = vec2(aUv.x, 1.0 - aUv.y);
	vShade = aShade;
	vSide = aSide;
}
`;
var FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uSource;

in vec2 vUv;
in float vShade;
in float vSide;
out vec4 fragColor;

void main() {
	vec4 source = texture(uSource, vUv);
	// The sides inherit the source alpha at the shard edge. A transparent
	// image must not acquire opaque geometry when extrusion is enabled.
	vec3 color = mix(source.rgb, vec3(source.a), vSide);
	fragColor = vec4(color * vShade, source.a);
}
`;
var compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create Shatter shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shatter shader compile failed: ${log ?? "(no log)"}`);
  }
  return shader;
};
var setupShatter = (gl) => {
  const program = gl.createProgram();
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const texture = gl.createTexture();
  const shaders = [];
  try {
    if (!program || !vao || !vbo || !texture) {
      throw new Error("Failed to create Shatter WebGL resources");
    }
    shaders.push(compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    shaders.push(compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    for (const shader of shaders) {
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shatter program link failed: ${gl.getProgramInfoLog(program) ?? "(no log)"}`);
    }
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 20);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 28, 24);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
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
      uSource: gl.getUniformLocation(program, "uSource"),
      uResolution: gl.getUniformLocation(program, "uResolution")
    };
  } catch (error) {
    gl.deleteTexture(texture);
    gl.deleteBuffer(vbo);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) {
      gl.deleteShader(shader);
    }
  }
};
var drawShatter = ({
  state,
  source,
  width,
  height,
  flipSourceY,
  vertices
}) => {
  const { gl, program, vao, vbo, texture, uSource, uResolution } = state;
  gl.viewport(0, 0, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  try {
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(uSource, 0);
    gl.uniform2f(uResolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 7);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
  } finally {
    gl.disable(gl.BLEND);
  }
};
var cleanupShatter = ({
  gl,
  program,
  vao,
  vbo,
  texture
}) => {
  gl.deleteTexture(texture);
  gl.deleteBuffer(vbo);
  gl.deleteVertexArray(vao);
  gl.deleteProgram(program);
};

// src/shatter/webgpu-shader.ts
var SHATTER_WEBGPU_SHADER = `
struct Params {resolution: vec2f,}
struct VertexOutput {
 @builtin(position) position: vec4f,
 @location(0) uv: vec2f,
 @location(1) shade: f32,
 @location(2) side: f32,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read> vertices: array<f32>;
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOutput {
 let offset=index*7u;
 let point=vec3f(vertices[offset],vertices[offset+1u],vertices[offset+2u]);
 let distance=max(params.resolution.x,params.resolution.y)*2.0;
 let near=distance*0.05;
 let w=distance+point.z;
 let position=vec2f((point.x-params.resolution.x*0.5)*2.0/params.resolution.x,(params.resolution.y*0.5-point.y)*2.0/params.resolution.y);
 var output: VertexOutput;
 // WebGPU's clip depth is [0,w], corresponding to WebGL's [-w,w].
 output.position=vec4f(position*vec2f(1,-1)*distance,w-near,w);
 output.uv=vec2f(vertices[offset+3u],vertices[offset+4u]);
 output.shade=vertices[offset+5u];output.side=vertices[offset+6u];
 return output;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let color=textureSample(source,sourceSampler,input.uv);
 return vec4f(mix(color.rgb,vec3f(color.a),input.side)*input.shade,color.a);
}
`;

// src/shatter/index.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_TIME = 0.5;
var DEFAULT_PATTERN = "bricks";
var DEFAULT_REPETITIONS = 10;
var DEFAULT_DIRECTION = 0;
var DEFAULT_ORIGIN = [0.5, 0.5];
var DEFAULT_CENTER = [0.5, 0.5];
var DEFAULT_RADIUS = 0.4;
var DEFAULT_DEPTH = 0.1;
var DEFAULT_STRENGTH = 5;
var DEFAULT_ROTATION_SPEED = 0.2;
var DEFAULT_RANDOMNESS = 0.1;
var DEFAULT_VISCOSITY = 0.1;
var DEFAULT_MASS_VARIANCE = 0.3;
var DEFAULT_GRAVITY = 3;
var DEFAULT_SEED = 0;
var DEFAULT_EXTRUSION_DEPTH = 0.05;
var shatterSchema = {
  time: {
    type: "number",
    min: 0,
    max: 5,
    step: 0.01,
    default: DEFAULT_TIME,
    description: "Time",
    hiddenFromList: false
  },
  pattern: {
    type: "enum",
    variants: { bricks: {}, glass: {}, hexagons: {}, squares: {}, triangles: {} },
    default: DEFAULT_PATTERN,
    description: "Pattern"
  },
  repetitions: {
    type: "number",
    min: 1,
    max: 100,
    step: 1,
    default: DEFAULT_REPETITIONS,
    description: "Repetitions",
    hiddenFromList: false
  },
  direction: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_DIRECTION,
    description: "Pattern direction"
  },
  origin: {
    type: "uv-coordinate",
    step: 0.01,
    default: DEFAULT_ORIGIN,
    description: "Pattern origin"
  },
  center: {
    type: "uv-coordinate",
    step: 0.01,
    default: DEFAULT_CENTER,
    description: "Force center"
  },
  radius: {
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: DEFAULT_RADIUS,
    description: "Force radius",
    hiddenFromList: false
  },
  depth: {
    type: "number",
    min: -1,
    max: 1,
    step: 0.01,
    default: DEFAULT_DEPTH,
    description: "Force depth",
    hiddenFromList: false
  },
  strength: {
    type: "number",
    min: -20,
    max: 20,
    step: 0.1,
    default: DEFAULT_STRENGTH,
    description: "Force strength",
    hiddenFromList: false
  },
  rotationSpeed: {
    type: "number",
    min: 0,
    max: 5,
    step: 0.01,
    default: DEFAULT_ROTATION_SPEED,
    description: "Rotation speed",
    hiddenFromList: false
  },
  randomness: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_RANDOMNESS,
    description: "Randomness",
    hiddenFromList: false
  },
  viscosity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_VISCOSITY,
    description: "Viscosity",
    hiddenFromList: false
  },
  massVariance: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_MASS_VARIANCE,
    description: "Mass variance",
    hiddenFromList: false
  },
  gravity: {
    type: "number",
    min: 0,
    max: 10,
    step: 0.1,
    default: DEFAULT_GRAVITY,
    description: "Gravity",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    integer: true,
    min: 0,
    max: 4294967295,
    step: 1,
    default: DEFAULT_SEED,
    description: "Random seed",
    hiddenFromList: false
  },
  extrusionDepth: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_EXTRUSION_DEPTH,
    description: "Extrusion depth",
    hiddenFromList: false
  }
};
var resolve = (params) => ({
  time: params.time ?? DEFAULT_TIME,
  pattern: params.pattern ?? DEFAULT_PATTERN,
  repetitions: params.repetitions ?? DEFAULT_REPETITIONS,
  direction: params.direction ?? DEFAULT_DIRECTION,
  origin: params.origin ?? DEFAULT_ORIGIN,
  center: params.center ?? DEFAULT_CENTER,
  radius: params.radius ?? DEFAULT_RADIUS,
  depth: params.depth ?? DEFAULT_DEPTH,
  strength: params.strength ?? DEFAULT_STRENGTH,
  rotationSpeed: params.rotationSpeed ?? DEFAULT_ROTATION_SPEED,
  randomness: params.randomness ?? DEFAULT_RANDOMNESS,
  viscosity: params.viscosity ?? DEFAULT_VISCOSITY,
  massVariance: params.massVariance ?? DEFAULT_MASS_VARIANCE,
  gravity: params.gravity ?? DEFAULT_GRAVITY,
  seed: params.seed ?? DEFAULT_SEED,
  extrusionDepth: params.extrusionDepth ?? DEFAULT_EXTRUSION_DEPTH
});
var shatter = createEffect({
  type: "remotion/shatter",
  label: "shatter()",
  documentationLink: "https://www.remotion.dev/docs/effects/shatter",
  schema: shatterSchema,
  validateParams: (params) => {
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Shatter");
    for (const name of [
      "time",
      "repetitions",
      "direction",
      "radius",
      "depth",
      "strength",
      "rotationSpeed",
      "randomness",
      "viscosity",
      "massVariance",
      "gravity",
      "seed",
      "extrusionDepth"
    ]) {
      (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params[name], name);
    }
    for (const name of ["origin", "center"]) {
      const value = params[name];
      if (value !== undefined && (!Array.isArray(value) || value.length !== 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1]))) {
        throw new TypeError(`"${name}" must contain two finite numbers`);
      }
    }
    const r = resolve(params);
    if (params.pattern !== undefined && (typeof params.pattern !== "string" || !Object.hasOwn(shatterSchema.pattern.variants, params.pattern))) {
      throw new TypeError('"pattern" must be "bricks", "glass", "hexagons", "squares", or "triangles"');
    }
    if (r.repetitions < 1 || r.repetitions > 100) {
      throw new TypeError('"repetitions" must be between 1 and 100');
    }
    for (const name of [
      "time",
      "radius",
      "rotationSpeed",
      "gravity"
    ]) {
      (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(r[name], name);
    }
    for (const name of [
      "randomness",
      "viscosity",
      "massVariance",
      "extrusionDepth"
    ]) {
      (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r[name], name);
    }
    if (!Number.isInteger(r.seed) || r.seed < 0 || r.seed > 4294967295) {
      throw new TypeError('"seed" must be an integer from 0 to 4294967295');
    }
  },
  calculateKey: (params) => `shatter-${JSON.stringify(resolve(params))}`,
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => ({
        ...(0,_index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMesh */ .pr)(target, "shatter"),
        geometryKey: null,
        vertices: null
      }),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for shatter");
        const r = resolve(params);
        const geometryKey = `${width}:${height}:${JSON.stringify(r)}`;
        if (state.geometryKey !== geometryKey || state.vertices === null) {
          state.vertices = createShatterGeometry(width, height, r);
          state.geometryKey = geometryKey;
        }
        (0,_index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuMesh */ .wQ)({
          state,
          source,
          width,
          height,
          vertices: state.vertices,
          shader: SHATTER_WEBGPU_SHADER,
          uniformData: new Float32Array([width, height, 0, 0]),
          topology: "triangle-list",
          blend: true,
          vertexCount: state.vertices.length / 7,
          instanceCount: 1,
          device: gpuDevice
        });
      },
      cleanup: _index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuMesh */ .KX
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("shatter effect");
        }
        return { ...setupShatter(gl), geometryKey: null, vertices: null };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const geometryKey = `${width}:${height}:${JSON.stringify(r)}`;
        if (state.geometryKey !== geometryKey || state.vertices === null) {
          state.vertices = createShatterGeometry(width, height, r);
          state.geometryKey = geometryKey;
        }
        drawShatter({
          state,
          source,
          width,
          height,
          flipSourceY,
          vertices: state.vertices
        });
      },
      cleanup: cleanupShatter
    })
  }
});



/***/ }

}]);
//# sourceMappingURL=7304.bundle.js.map