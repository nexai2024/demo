"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[2334],{

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

/***/ 6064
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   j: () => (/* binding */ GAUSSIAN_BLUR_WEBGPU_SHADER)
/* harmony export */ });
/* harmony import */ var _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(113);


// src/gaussian-blur-webgpu-shader.ts
var GAUSSIAN_BLUR_WEBGPU_SHADER = `
${_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_MULTIPASS_BINDINGS */ .NK}
struct Params { resolution: vec2f, direction: vec2f, values: vec4f, startEnd: vec4f, radial: vec4f, }
fn radiusAt(uv: vec2f) -> f32 {
 let mode = params.values.y;
 if (mode == 0.0) {return params.values.x;}
 if (mode == 1.0) {
  let gradient = params.startEnd.zw - params.startEnd.xy;
  let lengthSq = dot(gradient, gradient);
  if (lengthSq <= 0.0000001) {return max(0.0, params.values.z);}
  let progress = clamp(dot(uv - params.startEnd.xy, gradient) / lengthSq, 0.0, 1.0);
  return max(0.0, mix(params.values.z, params.values.w, progress));
 }
 let radii = params.startEnd.zw * params.resolution * 0.5;
 if (radii.x <= 0.0000001 || radii.y <= 0.0000001) {return max(0.0, params.values.z);}
 let delta = (uv - params.startEnd.xy) * params.resolution;
 let angle = radians(params.radial.x);
 let c = cos(angle); let s = sin(angle);
 let local = vec2f(c * delta.x + s * delta.y, -s * delta.x + c * delta.y);
 let ellipseProgress = clamp(length(local / radii), 0.0, 1.0);
 let distance = 1.0 - params.radial.y;
 var progress = step(params.radial.y, ellipseProgress);
 if (abs(distance) > 0.0000001) {progress = clamp((ellipseProgress - params.radial.y) / distance, 0.0, 1.0);}
 return max(0.0, mix(params.values.z, params.values.w, progress));
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let radius = radiusAt(input.uv);
 if (radius <= 0.0) {return textureSampleLevel(source, sourceSampler, input.uv, 0);}
 let halfKernel = i32(clamp(ceil(radius / 2.0), 4.0, 32.0));
 let stride = radius / f32(halfKernel);
 let sigma = select(max(radius / 3.0, 0.0001), radius / 3.0, params.values.y == 0.0);
 let twoSigmaSq = 2.0 * sigma * sigma;
 var sum = vec4f(0); var weightSum = 0.0;
 for (var i = -32; i <= 32; i++) {
  if (abs(i) > halfKernel) {continue;}
  let offset = f32(i) * stride;
  let weight = exp(-(offset * offset) / twoSigmaSq);
  let uv = input.uv + params.direction / params.resolution * offset;
  sum += textureSampleLevel(source, sourceSampler, uv, 0) * weight;
  weightSum += weight;
 }
 return sum / weightSum;
}
`;




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

/***/ 2334
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   linearProgressiveBlur: () => (/* binding */ linearProgressiveBlur)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(113);
/* harmony import */ var _index_cs953yag_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6064);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3947);






// src/linear-progressive-blur/index.ts


// src/linear-progressive-blur/linear-progressive-blur-runtime.ts


// src/linear-progressive-blur/linear-progressive-blur-shaders.ts
var LINEAR_PROGRESSIVE_BLUR_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var buildLinearProgressiveBlurFs = (direction) => {
  const dirVec = direction === "horizontal" ? "vec2(1.0, 0.0)" : "vec2(0.0, 1.0)";
  return `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform vec2 uStart;
uniform vec2 uEnd;
uniform float uStartBlur;
uniform float uEndBlur;

const int MIN_KERNEL_HALF = 4;
const int MAX_KERNEL_HALF = 32;
const float TARGET_SAMPLE_DISTANCE_PX = 2.0;
const vec2 DIRECTION = ${dirVec};

float progressiveRadius(vec2 uv) {
	vec2 gradient = uEnd - uStart;
	float gradientLengthSq = dot(gradient, gradient);
	if (gradientLengthSq <= 0.0000001) {
		return max(0.0, uStartBlur);
	}

	float progress = dot(uv - uStart, gradient) / gradientLengthSq;
	return max(0.0, mix(uStartBlur, uEndBlur, clamp(progress, 0.0, 1.0)));
}

void main() {
	// Public UV coordinates use top-left origin, matching canvas/CSS coordinates.
	float radius = progressiveRadius(vec2(vUv.x, 1.0 - vUv.y));
	if (radius <= 0.0) {
		fragColor = texture(uSource, vUv);
		return;
	}

	int kernelHalf = int(
		min(
			float(MAX_KERNEL_HALF),
			max(float(MIN_KERNEL_HALF), ceil(radius / TARGET_SAMPLE_DISTANCE_PX))
		)
	);
	float pixelStride = radius / float(kernelHalf);
	float sigma = max(radius / 3.0, 0.0001);
	float twoSigmaSq = 2.0 * sigma * sigma;

	vec4 sum = vec4(0.0);
	float weightSum = 0.0;

	for (int i = -MAX_KERNEL_HALF; i <= MAX_KERNEL_HALF; ++i) {
		if (abs(i) > kernelHalf) {
			continue;
		}

		float offsetPx = float(i) * pixelStride;
		float w = exp(-(offsetPx * offsetPx) / twoSigmaSq);
		vec2 uv = vUv + DIRECTION * uTexelSize * offsetPx;
		sum += texture(uSource, uv) * w;
		weightSum += w;
	}

	fragColor = sum / weightSum;
}
`;
};

// src/linear-progressive-blur/linear-progressive-blur-runtime.ts
var { createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_5__.Internals;
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
    throw new Error(`Linear progressive blur shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Linear progressive blur program link failed: ${log ?? "(no log)"}`);
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
var getUniforms = (gl, program) => ({
  uSource: gl.getUniformLocation(program, "uSource"),
  uTexelSize: gl.getUniformLocation(program, "uTexelSize"),
  uStart: gl.getUniformLocation(program, "uStart"),
  uEnd: gl.getUniformLocation(program, "uEnd"),
  uStartBlur: gl.getUniformLocation(program, "uStartBlur"),
  uEndBlur: gl.getUniformLocation(program, "uEndBlur")
});
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
var setupLinearProgressiveBlur = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("linear progressive blur effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const programHorizontal = createProgram(gl, LINEAR_PROGRESSIVE_BLUR_VS, buildLinearProgressiveBlurFs("horizontal"));
  const programVertical = createProgram(gl, LINEAR_PROGRESSIVE_BLUR_VS, buildLinearProgressiveBlurFs("vertical"));
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
  const textureIntermediate = createRgbaTexture(gl);
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error("Failed to create WebGL framebuffer");
  }
  const w = Math.max(1, target.width);
  const h = Math.max(1, target.height);
  gl.bindTexture(gl.TEXTURE_2D, textureIntermediate);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureIntermediate, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Linear progressive blur framebuffer incomplete: 0x${status.toString(16)}`);
  }
  return {
    gl,
    programHorizontal,
    programVertical,
    vao,
    vbo,
    textureSource,
    textureIntermediate,
    framebuffer,
    horizontal: getUniforms(gl, programHorizontal),
    vertical: getUniforms(gl, programVertical)
  };
};
var cleanupLinearProgressiveBlur = (state) => {
  const {
    gl,
    programHorizontal,
    programVertical,
    vao,
    vbo,
    textureSource,
    textureIntermediate,
    framebuffer
  } = state;
  gl.deleteFramebuffer(framebuffer);
  gl.deleteTexture(textureSource);
  gl.deleteTexture(textureIntermediate);
  gl.deleteBuffer(vbo);
  gl.deleteProgram(programHorizontal);
  gl.deleteProgram(programVertical);
  gl.deleteVertexArray(vao);
};
var uploadSource = ({
  gl,
  textureSource,
  textureIntermediate,
  source,
  width,
  height,
  flipSourceY
}) => {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.bindTexture(gl.TEXTURE_2D, textureSource);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.bindTexture(gl.TEXTURE_2D, textureIntermediate);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
};
var setUniforms = ({
  gl,
  uniforms,
  width,
  height,
  params
}) => {
  if (uniforms.uSource)
    gl.uniform1i(uniforms.uSource, 0);
  if (uniforms.uTexelSize)
    gl.uniform2f(uniforms.uTexelSize, 1 / width, 1 / height);
  if (uniforms.uStart)
    gl.uniform2f(uniforms.uStart, params.start[0], params.start[1]);
  if (uniforms.uEnd)
    gl.uniform2f(uniforms.uEnd, params.end[0], params.end[1]);
  if (uniforms.uStartBlur)
    gl.uniform1f(uniforms.uStartBlur, params.startBlur);
  if (uniforms.uEndBlur)
    gl.uniform1f(uniforms.uEndBlur, params.endBlur);
};
var drawFullscreenQuad = (state) => {
  const { gl, vao } = state;
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
};
var applyLinearProgressiveBlur = ({
  state,
  source,
  width,
  height,
  params,
  flipSourceY
}) => {
  const {
    gl,
    programHorizontal,
    programVertical,
    textureSource,
    textureIntermediate,
    framebuffer
  } = state;
  gl.viewport(0, 0, width, height);
  uploadSource({
    gl,
    textureSource,
    textureIntermediate,
    source,
    width,
    height,
    flipSourceY
  });
  gl.clearColor(0, 0, 0, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textureSource);
  gl.useProgram(programHorizontal);
  setUniforms({
    gl,
    uniforms: state.horizontal,
    width,
    height,
    params
  });
  drawFullscreenQuad(state);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindTexture(gl.TEXTURE_2D, textureIntermediate);
  gl.useProgram(programVertical);
  setUniforms({
    gl,
    uniforms: state.vertical,
    width,
    height,
    params
  });
  drawFullscreenQuad(state);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
};

// src/linear-progressive-blur/index.ts
var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_5__.Internals;
var DEFAULT_START = [0, 0.5];
var DEFAULT_END = [1, 0.5];
var DEFAULT_START_BLUR = 0;
var DEFAULT_END_BLUR = 50;
var linearProgressiveBlurSchema = {
  start: {
    type: "uv-coordinate",
    min: -1,
    max: 2,
    step: 0.01,
    default: DEFAULT_START,
    description: "Start",
    visual: {
      type: "line",
      to: "end"
    }
  },
  end: {
    type: "uv-coordinate",
    min: -1,
    max: 2,
    step: 0.01,
    default: DEFAULT_END,
    description: "End"
  },
  startBlur: {
    type: "number",
    min: 0,
    max: 200,
    step: 1,
    default: DEFAULT_START_BLUR,
    description: "Start blur",
    hiddenFromList: false
  },
  endBlur: {
    type: "number",
    min: 0,
    max: 200,
    step: 1,
    default: DEFAULT_END_BLUR,
    description: "End blur",
    hiddenFromList: false
  }
};
var clampBlur = (value) => Math.max(0, value);
var resolveLinearProgressiveBlurParams = (params) => ({
  start: [
    ...params.start ?? DEFAULT_START
  ],
  end: [...params.end ?? DEFAULT_END],
  startBlur: clampBlur(params.startBlur ?? DEFAULT_START_BLUR),
  endBlur: clampBlur(params.endBlur ?? DEFAULT_END_BLUR)
});
var assertOptionalUvCoordinate = (value, name) => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new TypeError(`"${name}" must be a [number, number] tuple`);
  }
};
var validateLinearProgressiveBlurParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_4__/* .assertEffectParamsObject */ .db)(params, "Linear progressive blur");
  assertOptionalUvCoordinate(params.start, "start");
  assertOptionalUvCoordinate(params.end, "end");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalFiniteNumber */ .FC)(params.startBlur, "startBlur");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalFiniteNumber */ .FC)(params.endBlur, "endBlur");
};
var linearProgressiveBlur = createEffect({
  type: "dev.remotion.effects.linearProgressiveBlur",
  label: "linearProgressiveBlur()",
  documentationLink: "https://www.remotion.dev/docs/effects/linear-progressive-blur",
  calculateKey: (params) => {
    const r = resolveLinearProgressiveBlurParams(params);
    return `linear-progressive-blur-${r.start.join(":")}-${r.end.join(":")}-${r.startBlur}-${r.endBlur}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_5__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMultipass */ .SB)(target, "linear-progressive-blur"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for this effect");
        const r = resolveLinearProgressiveBlurParams(params);
        (0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuMultipass */ .JM)({
          auxiliarySource: null,
          state,
          source,
          width,
          height,
          device: gpuDevice,
          passes: [
            {
              shader: _index_cs953yag_mjs__WEBPACK_IMPORTED_MODULE_2__/* .GAUSSIAN_BLUR_WEBGPU_SHADER */ .j,
              uniforms: new Float32Array([
                width,
                height,
                1,
                0,
                0,
                1,
                r.startBlur,
                r.endBlur,
                ...r.start,
                ...r.end,
                0,
                0,
                0,
                0
              ]),
              source: -1,
              secondary: -1
            },
            {
              shader: _index_cs953yag_mjs__WEBPACK_IMPORTED_MODULE_2__/* .GAUSSIAN_BLUR_WEBGPU_SHADER */ .j,
              uniforms: new Float32Array([
                width,
                height,
                0,
                1,
                0,
                1,
                r.startBlur,
                r.endBlur,
                ...r.start,
                ...r.end,
                0,
                0,
                0,
                0
              ]),
              source: 0,
              secondary: -1
            }
          ]
        });
      },
      cleanup: _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuMultipass */ .$h
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_5__.Internals.createEffectImplementation({
      setup: (target) => setupLinearProgressiveBlur(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolveLinearProgressiveBlurParams(params);
        applyLinearProgressiveBlur({
          state,
          source,
          width,
          height,
          params: r,
          flipSourceY
        });
      },
      cleanup: (state) => cleanupLinearProgressiveBlur(state)
    })
  },
  schema: linearProgressiveBlurSchema,
  validateParams: validateLinearProgressiveBlurParams
});



/***/ }

}]);
//# sourceMappingURL=2334.bundle.js.map