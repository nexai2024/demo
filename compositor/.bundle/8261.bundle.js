"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[8261],{

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

/***/ 113
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $h: () => (/* binding */ cleanupWebGpuMultipass),
/* harmony export */   JM: () => (/* binding */ applyWebGpuMultipass),
/* harmony export */   NK: () => (/* binding */ WEBGPU_MULTIPASS_BINDINGS),
/* harmony export */   SB: () => (/* binding */ setupWebGpuMultipass)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);


// src/webgpu-multipass-runtime.ts
var WEBGPU_MULTIPASS_BINDINGS = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var secondary: texture_2d<f32>;
`;
var setupWebGpuMultipass = (target, label) => {
  const context = target.getContext("webgpu");
  if (!context)
    throw new Error(`WebGPU is not available for the ${label} effect`);
  return { context, label, resources: null };
};
var cleanupWebGpuMultipass = (state) => {
  state.resources?.source?.texture.destroy();
  state.resources?.auxiliary?.texture.destroy();
  state.resources?.textures.forEach((texture) => texture.destroy());
  state.resources?.passes.forEach((pass) => pass.uniforms.destroy());
  state.resources = null;
  state.context.unconfigure();
};
var applyWebGpuMultipass = ({
  state,
  source,
  width,
  height,
  device,
  passes,
  auxiliarySource
}) => {
  if (state.resources && state.resources.device !== device)
    cleanupWebGpuMultipass(state);
  if (!state.resources) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    state.context.configure({ device, format, alphaMode: "premultiplied" });
    const shared = (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .getSharedWebGpuResources */ .JR)({
      device,
      key: "multipass-layout",
      create: () => {
        const layout = device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: "uniform" }
            },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }
          ]
        });
        const sampler = device.createSampler({
          magFilter: "linear",
          minFilter: "linear"
        });
        return { layout, sampler };
      }
    });
    state.resources = {
      device,
      format,
      layout: shared.layout,
      sampler: shared.sampler,
      passes: [],
      textures: [],
      source: null,
      auxiliary: null,
      width,
      height
    };
  }
  const r = state.resources;
  const sourceWidth = "displayWidth" in source ? source.displayWidth : ("videoWidth" in source) ? source.videoWidth : ("naturalWidth" in source) ? source.naturalWidth : typeof source.width === "number" ? source.width : source.width.baseVal.value;
  const sourceHeight = "displayHeight" in source ? source.displayHeight : ("videoHeight" in source) ? source.videoHeight : ("naturalHeight" in source) ? source.naturalHeight : typeof source.height === "number" ? source.height : source.height.baseVal.value;
  if (r.source && (r.source.width !== sourceWidth || r.source.height !== sourceHeight)) {
    r.source.texture.destroy();
    r.source = null;
  }
  if (!r.source) {
    r.source = {
      width: sourceWidth,
      height: sourceHeight,
      texture: device.createTexture({
        size: [sourceWidth, sourceHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      })
    };
  }
  device.queue.copyExternalImageToTexture({ source }, { texture: r.source.texture, premultipliedAlpha: true }, [sourceWidth, sourceHeight]);
  if (r.auxiliary && (!auxiliarySource || r.auxiliary.width !== auxiliarySource.width || r.auxiliary.height !== auxiliarySource.height)) {
    r.auxiliary.texture.destroy();
    r.auxiliary = null;
  }
  if (auxiliarySource) {
    if (!r.auxiliary)
      r.auxiliary = {
        width: auxiliarySource.width,
        height: auxiliarySource.height,
        texture: device.createTexture({
          size: [auxiliarySource.width, auxiliarySource.height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        })
      };
    device.queue.copyExternalImageToTexture({ source: auxiliarySource }, { texture: r.auxiliary.texture, premultipliedAlpha: true }, [auxiliarySource.width, auxiliarySource.height]);
  }
  if (r.width !== width || r.height !== height) {
    r.textures.forEach((texture) => texture.destroy());
    r.textures.length = 0;
    r.width = width;
    r.height = height;
  }
  const lastReaders = passes.map((_, index) => index);
  for (let index = 0;index < passes.length; index++) {
    for (const input of [passes[index].source, passes[index].secondary]) {
      if (input >= 0)
        lastReaders[input] = index;
    }
  }
  const outputSlots = [];
  const freeAfter = [];
  for (let index = 0;index < passes.length - 1; index++) {
    let slot = freeAfter.findIndex((lastReader) => lastReader < index);
    if (slot === -1)
      slot = freeAfter.length;
    freeAfter[slot] = lastReaders[index];
    outputSlots.push(slot);
  }
  while (r.textures.length < freeAfter.length) {
    r.textures.push(device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    }));
  }
  while (r.textures.length > freeAfter.length)
    r.textures.pop()?.destroy();
  while (r.passes.length > passes.length)
    r.passes.pop()?.uniforms.destroy();
  const encoder = device.createCommandEncoder();
  for (let index = 0;index < passes.length; index++) {
    const pass = passes[index];
    const format = index === passes.length - 1 ? r.format : "rgba8unorm";
    const size = Math.max(16, Math.ceil(pass.uniforms.byteLength / 16) * 16);
    let resources = r.passes[index];
    if (!resources || resources.shader !== pass.shader || resources.size !== size || resources.format !== format) {
      resources?.uniforms.destroy();
      const pipeline = (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .getSharedWebGpuResources */ .JR)({
        device,
        key: JSON.stringify(["multipass-pipeline", pass.shader, format]),
        create: () => {
          const module = device.createShaderModule({
            code: pass.shader,
            label: state.label
          });
          return device.createRenderPipeline({
            label: state.label,
            layout: device.createPipelineLayout({ bindGroupLayouts: [r.layout] }),
            vertex: { module, entryPoint: "vertex" },
            fragment: { module, entryPoint: "fragment", targets: [{ format }] },
            primitive: { topology: "triangle-list" }
          });
        }
      });
      resources = {
        shader: pass.shader,
        size,
        format,
        pipeline,
        uniforms: device.createBuffer({
          size,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
      };
      r.passes[index] = resources;
    }
    device.queue.writeBuffer(resources.uniforms, 0, pass.uniforms);
    const bindGroup = device.createBindGroup({
      layout: r.layout,
      entries: [
        {
          binding: 0,
          resource: (pass.source === -1 ? r.source.texture : r.textures[outputSlots[pass.source]]).createView()
        },
        { binding: 1, resource: r.sampler },
        { binding: 2, resource: { buffer: resources.uniforms } },
        {
          binding: 3,
          resource: (pass.secondary === -2 && r.auxiliary ? r.auxiliary.texture : pass.secondary === -1 ? r.source.texture : r.textures[outputSlots[pass.secondary]]).createView()
        }
      ]
    });
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: (index === passes.length - 1 ? state.context.getCurrentTexture() : r.textures[outputSlots[index]]).createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    renderPass.setPipeline(resources.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3);
    renderPass.end();
  }
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

/***/ 8261
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   outline: () => (/* binding */ outline),
/* harmony export */   outlineSchema: () => (/* binding */ outlineSchema)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(113);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/outline.ts


// src/outline/polygonize-alpha.ts
var pointKey = ([x, y]) => `${x},${y}`;
var edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
var squaredDistance = (a, b) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};
var squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const progress = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (progress > 1) {
      x = end[0];
      y = end[1];
    } else if (progress > 0) {
      x += dx * progress;
      y += dy * progress;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
};
var simplifyOpenContour = (points, toleranceSquared) => {
  if (points.length <= 2) {
    return [...points];
  }
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) {
      break;
    }
    const [startIndex, endIndex] = range;
    let furthestIndex = -1;
    let furthestDistance = toleranceSquared;
    for (let index = startIndex + 1;index < endIndex; index++) {
      const distance = squaredSegmentDistance(points[index], points[startIndex], points[endIndex]);
      if (distance > furthestDistance) {
        furthestDistance = distance;
        furthestIndex = index;
      }
    }
    if (furthestIndex !== -1) {
      keep[furthestIndex] = 1;
      stack.push([startIndex, furthestIndex], [furthestIndex, endIndex]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
};
var simplifyClosedContour = (points, tolerance) => {
  if (points.length <= 3 || tolerance <= 0) {
    return [...points];
  }
  let oppositeIndex = 1;
  let oppositeDistance = 0;
  for (let index = 1;index < points.length; index++) {
    const distance = squaredDistance(points[0], points[index]);
    if (distance > oppositeDistance) {
      oppositeDistance = distance;
      oppositeIndex = index;
    }
  }
  const firstHalf = points.slice(0, oppositeIndex + 1);
  const secondHalf = [...points.slice(oppositeIndex), points[0]];
  const toleranceSquared = tolerance * tolerance;
  const simplified = [
    ...simplifyOpenContour(firstHalf, toleranceSquared).slice(0, -1),
    ...simplifyOpenContour(secondHalf, toleranceSquared).slice(0, -1)
  ];
  return simplified.length >= 3 ? simplified : [...points];
};
var polygonizeAlpha = ({
  data,
  width,
  height,
  simplification
}) => {
  const adjacency = new Map;
  const points = new Map;
  const addSegment = (a, b) => {
    const aKey = pointKey(a);
    const bKey = pointKey(b);
    points.set(aKey, a);
    points.set(bKey, b);
    const aNeighbors = adjacency.get(aKey);
    if (aNeighbors) {
      aNeighbors.push(bKey);
    } else {
      adjacency.set(aKey, [bKey]);
    }
    const bNeighbors = adjacency.get(bKey);
    if (bNeighbors) {
      bNeighbors.push(aKey);
    } else {
      adjacency.set(bKey, [aKey]);
    }
  };
  const isFilled = (x, y) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] > 0;
  for (let y = -1;y < height; y++) {
    for (let x = -1;x < width; x++) {
      const configuration = (isFilled(x, y) ? 1 : 0) | (isFilled(x + 1, y) ? 2 : 0) | (isFilled(x + 1, y + 1) ? 4 : 0) | (isFilled(x, y + 1) ? 8 : 0);
      if (configuration === 0 || configuration === 15) {
        continue;
      }
      const top = [x * 2 + 2, y * 2 + 1];
      const right = [x * 2 + 3, y * 2 + 2];
      const bottom = [x * 2 + 2, y * 2 + 3];
      const left = [x * 2 + 1, y * 2 + 2];
      switch (configuration) {
        case 1:
        case 14:
          addSegment(top, left);
          break;
        case 2:
        case 13:
          addSegment(top, right);
          break;
        case 3:
        case 12:
          addSegment(left, right);
          break;
        case 4:
        case 11:
          addSegment(right, bottom);
          break;
        case 5:
          addSegment(top, left);
          addSegment(right, bottom);
          break;
        case 6:
        case 9:
          addSegment(top, bottom);
          break;
        case 7:
        case 8:
          addSegment(bottom, left);
          break;
        case 10:
          addSegment(top, right);
          addSegment(bottom, left);
          break;
        default:
          throw new Error(`Unexpected marching squares case: ${configuration}`);
      }
    }
  }
  const visitedEdges = new Set;
  const contours = [];
  for (const [start, neighbors] of adjacency) {
    for (const firstNeighbor of neighbors) {
      if (visitedEdges.has(edgeKey(start, firstNeighbor))) {
        continue;
      }
      const contour = [start];
      let previous = start;
      let current = firstNeighbor;
      visitedEdges.add(edgeKey(previous, current));
      while (current !== start) {
        contour.push(current);
        const candidates = adjacency.get(current) ?? [];
        const next = candidates.find((candidate) => candidate !== previous && !visitedEdges.has(edgeKey(current, candidate)));
        if (!next) {
          break;
        }
        previous = current;
        current = next;
        visitedEdges.add(edgeKey(previous, current));
      }
      if (current !== start || contour.length < 3) {
        continue;
      }
      const decoded = contour.map((key) => {
        const point = points.get(key);
        if (!point) {
          throw new Error(`Missing outline point: ${key}`);
        }
        return [point[0] / 2, point[1] / 2];
      });
      contours.push(simplifyClosedContour(decoded, simplification));
    }
  }
  return contours;
};

// src/outline/webgpu-shader.ts
var OUTLINE_WEBGPU_SHADER = `
${_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_MULTIPASS_BINDINGS */ .NK}
struct Params {color: vec4f, width: f32, opacity: f32, outlineOnly: f32, polygon: f32,}
const MIN_ALPHA=0.5/255.0;
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let color=textureSampleLevel(source,sourceSampler,input.uv,0);
 let only=params.outlineOnly!=0.0;
 if (params.opacity<=0.0 || params.color.a<=0.0) {return select(color,vec4f(0),only);}
 if (params.width<=0.0 && !only) {return color;}
 var mask=0.0;
 if (params.polygon!=0.0) {
  mask=step(MIN_ALPHA,textureSampleLevel(secondary,sourceSampler,input.uv,0).a);
 } else if (params.width>0.0) {
  let size=vec2i(textureDimensions(source));
  let position=clamp(vec2i(input.uv*vec2f(size)),vec2i(0),size-1);
  for (var ring=1;ring<=3;ring++) {
   let distance=params.width*f32(ring)/3.0;
   for (var direction=0;direction<32;direction++) {
    let angle=6.283185307179586*f32(direction)/32.0;
    let offset=vec2i(round(vec2f(cos(angle),-sin(angle))*distance));
    let samplePosition=clamp(position+offset,vec2i(0),size-1);
    mask=max(mask,step(MIN_ALPHA,textureLoad(source,samplePosition,0).a));
   }
  }
 }
 if (only) {
  let alpha=select(max(step(MIN_ALPHA,color.a),mask),mask,params.polygon!=0.0)*params.color.a*params.opacity;
  return vec4f(params.color.rgb*alpha,alpha);
 }
 let alpha=mask*params.color.a*params.opacity*(1.0-color.a);
 return vec4f(color.rgb+params.color.rgb*alpha,color.a+alpha);
}
`;

// src/outline.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_WIDTH = 8;
var DEFAULT_EDGE_SIMPLIFICATION = 0;
var DEFAULT_COLOR = "#ffffff";
var DEFAULT_OPACITY = 1;
var DEFAULT_OUTLINE_ONLY = false;
var outlineSchema = {
  width: {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
    default: DEFAULT_WIDTH,
    description: "Width",
    hiddenFromList: false
  },
  edgeSimplification: {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
    default: DEFAULT_EDGE_SIMPLIFICATION,
    description: "Edge simplification",
    hiddenFromList: false
  },
  color: {
    type: "color",
    default: DEFAULT_COLOR,
    description: "Color"
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
  outlineOnly: {
    type: "boolean",
    default: DEFAULT_OUTLINE_ONLY,
    description: "Outline only"
  }
};
var resolve = (params) => ({
  width: params.width ?? DEFAULT_WIDTH,
  edgeSimplification: params.edgeSimplification ?? DEFAULT_EDGE_SIMPLIFICATION,
  color: params.color ?? DEFAULT_COLOR,
  opacity: params.opacity ?? DEFAULT_OPACITY,
  outlineOnly: params.outlineOnly ?? DEFAULT_OUTLINE_ONLY
});
var validateOutlineParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Outline");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.width, "width");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.edgeSimplification, "edgeSimplification");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)(params.color, "color");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.opacity, "opacity");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalBoolean */ .fX)(params.outlineOnly, "outlineOnly");
  const resolved = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(resolved.width, "width");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(resolved.edgeSimplification, "edgeSimplification");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(resolved.opacity, "opacity");
};
var OUTLINE_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var OUTLINE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform sampler2D uPolygonMask;
uniform bool uUsePolygonMask;
uniform float uWidth;
uniform vec4 uColor;
uniform float uOpacity;
uniform bool uOutlineOnly;

const float TAU = 6.283185307179586;
const float MIN_ALPHA = 0.5 / 255.0;
const int SAMPLE_DIRECTIONS = 32;
const int SAMPLE_RINGS = 3;

void main() {
	vec4 source = texture(uSource, vUv);

	if (uOpacity <= 0.0 || uColor.a <= 0.0) {
		fragColor = uOutlineOnly ? vec4(0.0) : source;
		return;
	}

	if (uWidth <= 0.0 && !uOutlineOnly) {
		fragColor = source;
		return;
	}

	float outlineMaskAlpha = 0.0;
	if (uUsePolygonMask) {
		outlineMaskAlpha = step(MIN_ALPHA, texture(uPolygonMask, vUv).a);
	} else if (uWidth > 0.0) {
		ivec2 sourceSize = textureSize(uSource, 0);
		ivec2 sourcePosition = clamp(
			ivec2(vUv * vec2(sourceSize)),
			ivec2(0),
			sourceSize - ivec2(1)
		);
		for (int ring = 1; ring <= SAMPLE_RINGS; ring++) {
			float distancePx = uWidth * float(ring) / float(SAMPLE_RINGS);
			for (int direction = 0; direction < SAMPLE_DIRECTIONS; direction++) {
				float angle = TAU * float(direction) / float(SAMPLE_DIRECTIONS);
				ivec2 offset = ivec2(round(
					vec2(cos(angle), sin(angle)) * distancePx
				));
				ivec2 samplePosition = clamp(
					sourcePosition + offset,
					ivec2(0),
					sourceSize - ivec2(1)
				);
				outlineMaskAlpha = max(
					outlineMaskAlpha,
					step(MIN_ALPHA, texelFetch(uSource, samplePosition, 0).a)
				);
			}
		}
	}

	if (uOutlineOnly) {
		float filledAlpha = (
			uUsePolygonMask
				? outlineMaskAlpha
				: max(step(MIN_ALPHA, source.a), outlineMaskAlpha)
		) * uColor.a * uOpacity;
		fragColor = vec4(uColor.rgb * filledAlpha, filledAlpha);
		return;
	}

	float outlineAlpha = outlineMaskAlpha * uColor.a * uOpacity * (1.0 - source.a);
	vec3 outlineRgb = uColor.rgb * outlineAlpha;
	fragColor = vec4(source.rgb + outlineRgb, source.a + outlineAlpha);
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
    throw new Error(`Outline shader compile failed: ${log ?? "(no log)"}`);
  }
  return shader;
};
var createProgram = (gl) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, OUTLINE_VS);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, OUTLINE_FS);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create WebGL program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Outline program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createTexture = (gl) => {
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
var updatePolygonMask = ({
  source,
  width,
  height,
  simplification,
  outlineWidth,
  state
}) => {
  if (state.alphaCanvas.width !== width || state.alphaCanvas.height !== height || state.polygonMaskCanvas.width !== width || state.polygonMaskCanvas.height !== height) {
    state.alphaCanvas.width = width;
    state.alphaCanvas.height = height;
    state.polygonMaskCanvas.width = width;
    state.polygonMaskCanvas.height = height;
  }
  state.alphaCtx.clearRect(0, 0, width, height);
  state.alphaCtx.drawImage(source, 0, 0, width, height);
  const imageData = state.alphaCtx.getImageData(0, 0, width, height);
  const contours = polygonizeAlpha({
    data: imageData.data,
    width,
    height,
    simplification
  });
  const { polygonMaskCtx: context } = state;
  context.clearRect(0, 0, width, height);
  context.beginPath();
  for (const contour of contours) {
    if (contour.length < 3) {
      continue;
    }
    context.moveTo(contour[0][0], contour[0][1]);
    for (let index = 1;index < contour.length; index++) {
      context.lineTo(contour[index][0], contour[index][1]);
    }
    context.closePath();
  }
  context.fillStyle = "white";
  context.fill("evenodd");
  if (outlineWidth > 0) {
    context.strokeStyle = "white";
    context.lineWidth = outlineWidth * 2;
    context.lineJoin = "miter";
    context.miterLimit = 4;
    context.stroke();
  }
};
var setupOutline = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("outline effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create WebGL vertex array");
  }
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  if (!vbo) {
    throw new Error("Failed to create WebGL buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  const aUv = gl.getAttribLocation(program, "aUv");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  const textureSource = createTexture(gl);
  const texturePolygonMask = createTexture(gl);
  gl.bindTexture(gl.TEXTURE_2D, texturePolygonMask);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  const colorCanvas = target.ownerDocument.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!colorCtx) {
    throw new Error("Failed to acquire 2D context for color parsing");
  }
  const alphaCanvas = target.ownerDocument.createElement("canvas");
  const alphaCtx = alphaCanvas.getContext("2d", { willReadFrequently: true });
  if (!alphaCtx) {
    throw new Error("Failed to acquire 2D context for outline extraction");
  }
  const polygonMaskCanvas = target.ownerDocument.createElement("canvas");
  polygonMaskCanvas.width = 1;
  polygonMaskCanvas.height = 1;
  const polygonMaskCtx = polygonMaskCanvas.getContext("2d");
  if (!polygonMaskCtx) {
    throw new Error("Failed to acquire 2D context for outline mask");
  }
  return {
    gl,
    program,
    vao,
    vbo,
    textureSource,
    texturePolygonMask,
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uPolygonMask: gl.getUniformLocation(program, "uPolygonMask"),
      uUsePolygonMask: gl.getUniformLocation(program, "uUsePolygonMask"),
      uWidth: gl.getUniformLocation(program, "uWidth"),
      uColor: gl.getUniformLocation(program, "uColor"),
      uOpacity: gl.getUniformLocation(program, "uOpacity"),
      uOutlineOnly: gl.getUniformLocation(program, "uOutlineOnly")
    },
    alphaCanvas,
    alphaCtx,
    polygonMaskCanvas,
    polygonMaskCtx,
    colorCtx,
    cachedColor: "",
    cachedColorRgba: [255, 255, 255, 255]
  };
};
var outline = createEffect({
  type: "remotion/outline",
  label: "outline()",
  documentationLink: "https://www.remotion.dev/docs/effects/outline",
  calculateKey: (params) => {
    const resolved = resolve(params);
    return `outline-${resolved.width}-${resolved.edgeSimplification}-${resolved.color}-${resolved.opacity}-${resolved.outlineOnly}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const colorCtx = canvas.getContext("2d", { willReadFrequently: true });
        if (!colorCtx)
          throw new Error("Could not create color parser");
        const alphaCanvas = document.createElement("canvas");
        const alphaCtx = alphaCanvas.getContext("2d", {
          willReadFrequently: true
        });
        const polygonMaskCanvas = document.createElement("canvas");
        const polygonMaskCtx = polygonMaskCanvas.getContext("2d");
        if (!alphaCtx || !polygonMaskCtx)
          throw new Error("Could not create outline mask");
        return {
          alphaCanvas,
          alphaCtx,
          polygonMaskCanvas,
          polygonMaskCtx,
          ...(0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMultipass */ .SB)(target, "outline"),
          colorCtx,
          cachedColor: null,
          cachedRgba: [0, 0, 0, 0]
        };
      },
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for this effect");
        const r = resolve(params);
        if (state.cachedColor !== r.color) {
          state.cachedColor = r.color;
          state.cachedRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, r.color);
        }
        const color = state.cachedRgba.map((channel) => channel / 255);
        const usePolygonMask = r.edgeSimplification > 0 && r.opacity > 0 && color[3] > 0 && (r.width > 0 || r.outlineOnly);
        if (usePolygonMask)
          updatePolygonMask({
            source,
            width,
            height,
            simplification: r.edgeSimplification,
            outlineWidth: r.width,
            state
          });
        (0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuMultipass */ .JM)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          auxiliarySource: usePolygonMask ? state.polygonMaskCanvas : null,
          passes: [
            {
              shader: OUTLINE_WEBGPU_SHADER,
              uniforms: new Float32Array([
                ...color,
                r.width,
                r.opacity,
                r.outlineOnly ? 1 : 0,
                usePolygonMask ? 1 : 0
              ]),
              source: -1,
              secondary: usePolygonMask ? -2 : -1
            }
          ]
        });
      },
      cleanup: _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuMultipass */ .$h
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: setupOutline,
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const resolved = resolve(params);
        if (state.cachedColor !== resolved.color) {
          state.cachedColor = resolved.color;
          state.cachedColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, resolved.color);
        }
        const { gl, program, textureSource, texturePolygonMask, uniforms, vao } = state;
        const [red, green, blue, alpha] = state.cachedColorRgba;
        const usePolygonMask = resolved.edgeSimplification > 0 && resolved.opacity > 0 && alpha > 0 && (resolved.width > 0 || resolved.outlineOnly);
        if (usePolygonMask) {
          updatePolygonMask({
            source,
            width,
            height,
            simplification: resolved.edgeSimplification,
            outlineWidth: resolved.width,
            state
          });
        }
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureSource);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texturePolygonMask);
        if (usePolygonMask) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, state.polygonMaskCanvas);
        }
        gl.useProgram(program);
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uPolygonMask)
          gl.uniform1i(uniforms.uPolygonMask, 1);
        if (uniforms.uUsePolygonMask)
          gl.uniform1i(uniforms.uUsePolygonMask, usePolygonMask ? 1 : 0);
        if (uniforms.uWidth)
          gl.uniform1f(uniforms.uWidth, resolved.width);
        if (uniforms.uColor)
          gl.uniform4f(uniforms.uColor, red / 255, green / 255, blue / 255, alpha / 255);
        if (uniforms.uOpacity)
          gl.uniform1f(uniforms.uOpacity, resolved.opacity);
        if (uniforms.uOutlineOnly)
          gl.uniform1i(uniforms.uOutlineOnly, resolved.outlineOnly ? 1 : 0);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, textureSource, texturePolygonMask }) => {
        gl.deleteTexture(textureSource);
        gl.deleteTexture(texturePolygonMask);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: outlineSchema,
  validateParams: validateOutlineParams
});



/***/ }

}]);
//# sourceMappingURL=8261.bundle.js.map