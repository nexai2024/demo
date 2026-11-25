"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[9307],{

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

/***/ 9307
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   longShadows: () => (/* binding */ longShadows)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(113);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/long-shadows.ts


// src/long-shadows-webgpu-shaders.ts
var LONG_SHADOWS_EXTEND_WEBGPU_SHADER = `
${_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_MULTIPASS_BINDINGS */ .NK}
struct Params {offset: vec4f,}
fn alphaAt(pixel: vec2i) -> f32 {
 let size=vec2i(textureDimensions(source));
 if (any(pixel<vec2i(0)) || any(pixel>=size)) {return 0.0;}
 return textureLoad(source,pixel,0).a;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let pixel=(input.uv-params.offset.xy)*vec2f(textureDimensions(source))-0.5;
 let base=vec2i(floor(pixel));let fraction=fract(pixel);
 let shifted=mix(mix(alphaAt(base),alphaAt(base+vec2i(1,0)),fraction.x),mix(alphaAt(base+vec2i(0,1)),alphaAt(base+vec2i(1,1)),fraction.x),fraction.y);
 return vec4f(0,0,0,max(textureSampleLevel(source,sourceSampler,input.uv,0).a,shifted));
}
`;
var LONG_SHADOWS_COMPOSITE_WEBGPU_SHADER = `
${_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_MULTIPASS_BINDINGS */ .NK}
struct Params {color: vec4f,}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let color=textureSampleLevel(source,sourceSampler,input.uv,0);
 let alpha=textureSampleLevel(secondary,sourceSampler,input.uv,0).a*params.color.a;
 return color+vec4f(params.color.rgb*alpha,alpha)*(1.0-color.a);
}`;

// src/long-shadows.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_LENGTH = 240;
var DEFAULT_ANGLE = 45;
var DEFAULT_COLOR = "#777777";
var DEFAULT_OPACITY = 1;
var longShadowsSchema = {
  length: {
    type: "number",
    min: 0,
    max: 1000,
    step: 1,
    default: DEFAULT_LENGTH,
    description: "Length",
    hiddenFromList: false
  },
  angle: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_ANGLE,
    description: "Angle"
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
  }
};
var resolve = (params) => ({
  length: params.length ?? DEFAULT_LENGTH,
  angle: params.angle ?? DEFAULT_ANGLE,
  color: params.color ?? DEFAULT_COLOR,
  opacity: params.opacity ?? DEFAULT_OPACITY
});
var validateLongShadowsParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Long shadows");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.length, "length");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.angle, "angle");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.opacity, "opacity");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)(params.color, "color");
  const resolved = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(resolved.length, "length");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(resolved.opacity, "opacity");
};
var VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var EXTEND_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uOffset;

float alphaAt(ivec2 pixel) {
	ivec2 size = textureSize(uSource, 0);
	if (any(lessThan(pixel, ivec2(0))) || any(greaterThanEqual(pixel, size))) {
		return 0.0;
	}
	return texelFetch(uSource, pixel, 0).a;
}

void main() {
	// Interpolate with transparent pixels outside the canvas instead of
	// clamping the border, which would stretch edge pixels into the shadow.
	vec2 pixel = (vUv - uOffset) * vec2(textureSize(uSource, 0)) - 0.5;
	ivec2 base = ivec2(floor(pixel));
	vec2 fraction = fract(pixel);
	float shifted = mix(
		mix(alphaAt(base), alphaAt(base + ivec2(1, 0)), fraction.x),
		mix(alphaAt(base + ivec2(0, 1)), alphaAt(base + ivec2(1, 1)), fraction.x),
		fraction.y
	);
	fragColor = vec4(0.0, 0.0, 0.0, max(texture(uSource, vUv).a, shifted));
}
`;
var COMPOSITE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform sampler2D uShadow;
uniform vec4 uColor;

void main() {
	vec4 source = texture(uSource, vUv);
	float alpha = texture(uShadow, vUv).a * uColor.a;
	fragColor = source + vec4(uColor.rgb * alpha, alpha) * (1.0 - source.a);
}
`;
var createProgram = (gl, fragmentSource) => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create long shadows program");
  }
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, fragmentSource]
  ]) {
    const shader = gl.createShader(type);
    if (!shader) {
      gl.deleteProgram(program);
      throw new Error("Failed to create long shadows shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      throw new Error(`Long shadows shader compile failed: ${log ?? "(no log)"}`);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Long shadows program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var longShadows = createEffect({
  type: "remotion/long-shadows",
  label: "longShadows()",
  documentationLink: "https://www.remotion.dev/docs/effects/long-shadows",
  calculateKey: (params) => {
    const { length, angle, color, opacity } = resolve(params);
    return `long-shadows-${length}-${angle}-${color}-${opacity}`;
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
        return {
          ...(0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMultipass */ .SB)(target, "long-shadows"),
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
        const distance = r.opacity === 0 || color[3] === 0 ? 0 : Math.min(r.length, Math.hypot(width, height));
        const steps = Math.ceil(distance);
        const angle = r.angle % 360 * Math.PI / 180;
        const stepLength = steps === 0 ? 0 : distance / steps;
        const passes = [];
        let covered = 0;
        while (covered < steps) {
          const extension = Math.min(covered + 1, steps - covered);
          passes.push({
            shader: LONG_SHADOWS_EXTEND_WEBGPU_SHADER,
            uniforms: new Float32Array([
              Math.cos(angle) * extension * stepLength / width,
              Math.sin(angle) * extension * stepLength / height,
              0,
              0
            ]),
            source: passes.length - 1,
            secondary: -1
          });
          covered += extension;
        }
        passes.push({
          shader: LONG_SHADOWS_COMPOSITE_WEBGPU_SHADER,
          uniforms: new Float32Array([
            color[0],
            color[1],
            color[2],
            r.length === 0 ? 0 : color[3] * r.opacity
          ]),
          source: -1,
          secondary: passes.length - 1
        });
        (0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuMultipass */ .JM)({
          auxiliarySource: null,
          state,
          source,
          width,
          height,
          device: gpuDevice,
          passes
        });
      },
      cleanup: _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuMultipass */ .$h
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("long shadows effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const extendProgram = createProgram(gl, EXTEND_SHADER);
        const compositeProgram = createProgram(gl, COMPOSITE_SHADER);
        const vao = gl.createVertexArray();
        const vbo = gl.createBuffer();
        const framebuffer = gl.createFramebuffer();
        if (!vao || !vbo || !framebuffer) {
          throw new Error("Failed to create long shadows buffers");
        }
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
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
        ]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        gl.bindVertexArray(null);
        const textures = [0, 1, 2].map(() => {
          const texture = gl.createTexture();
          if (!texture) {
            throw new Error("Failed to create long shadows texture");
          }
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          return texture;
        });
        gl.bindTexture(gl.TEXTURE_2D, null);
        const colorCanvas = document.createElement("canvas");
        colorCanvas.width = 1;
        colorCanvas.height = 1;
        const colorCtx = colorCanvas.getContext("2d", {
          willReadFrequently: true
        });
        if (!colorCtx) {
          throw new Error("Failed to acquire 2D context for color parsing");
        }
        return {
          gl,
          extendProgram,
          compositeProgram,
          vao,
          vbo,
          framebuffer,
          sourceTexture: textures[0],
          shadowTextures: [textures[1], textures[2]],
          extendSource: gl.getUniformLocation(extendProgram, "uSource"),
          extendOffset: gl.getUniformLocation(extendProgram, "uOffset"),
          compositeSource: gl.getUniformLocation(compositeProgram, "uSource"),
          compositeShadow: gl.getUniformLocation(compositeProgram, "uShadow"),
          compositeColor: gl.getUniformLocation(compositeProgram, "uColor"),
          colorCtx,
          cachedColor: "",
          cachedRgba: [0, 0, 0, 0],
          width: 0,
          height: 0
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const { length, angle, color, opacity } = resolve(params);
        const { gl, sourceTexture, shadowTextures, framebuffer } = state;
        if (state.cachedColor !== color) {
          state.cachedRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, color);
          state.cachedColor = color;
        }
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (state.width !== width || state.height !== height) {
          for (const texture of shadowTextures) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          }
          state.width = width;
          state.height = height;
        }
        gl.bindVertexArray(state.vao);
        gl.useProgram(state.extendProgram);
        gl.uniform1i(state.extendSource, 0);
        const distance = opacity === 0 || state.cachedRgba[3] === 0 ? 0 : Math.min(length, Math.hypot(width, height));
        const steps = Math.ceil(distance);
        const radians = angle % 360 * Math.PI / 180;
        const stepLength = steps === 0 ? 0 : distance / steps;
        let shadow = sourceTexture;
        let covered = 0;
        let pass = 0;
        while (covered < steps) {
          const extension = Math.min(covered + 1, steps - covered);
          const output = shadowTextures[pass % 2];
          gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error("Long shadows framebuffer incomplete");
          }
          gl.bindTexture(gl.TEXTURE_2D, shadow);
          gl.uniform2f(state.extendOffset, Math.cos(radians) * extension * stepLength / width, -Math.sin(radians) * extension * stepLength / height);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          shadow = output;
          covered += extension;
          pass++;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(state.compositeProgram);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, shadow);
        gl.uniform1i(state.compositeSource, 0);
        gl.uniform1i(state.compositeShadow, 1);
        const [r, g, b, a] = state.cachedRgba;
        gl.uniform4f(state.compositeColor, r / 255, g / 255, b / 255, length === 0 ? 0 : a / 255 * opacity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({
        gl,
        extendProgram,
        compositeProgram,
        vao,
        vbo,
        framebuffer,
        sourceTexture,
        shadowTextures
      }) => {
        gl.deleteProgram(extendProgram);
        gl.deleteProgram(compositeProgram);
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(vbo);
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(sourceTexture);
        for (const texture of shadowTextures) {
          gl.deleteTexture(texture);
        }
      }
    })
  },
  schema: longShadowsSchema,
  validateParams: validateLongShadowsParams
});



/***/ }

}]);
//# sourceMappingURL=9307.bundle.js.map