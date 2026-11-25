"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5641],{

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

/***/ 5641
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   tear: () => (/* binding */ tear)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4223);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/tear.ts


// src/tear-webgpu-shader.ts
var TEAR_WEBGPU_SHADER = `
struct Params {resolution: vec2f, angle: f32, progress: f32, rotation: f32, jaggedness: f32,}
struct VertexOutput {@builtin(position) position: vec4f, @location(0) uv: vec2f,}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@vertex fn vertex(@builtin(vertex_index) index: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
 let aPos=vec2f(f32(index%2u),f32(index/2u)/192.0);
 let side=select(-1.0,1.0,instance!=0u);
 let direction=radians(params.angle);let dc=cos(direction);let ds=sin(direction);
 let toCanvas=mat2x2f(vec2f(dc,-ds),vec2f(ds,dc));
 let extent=vec2f(abs(dc)*params.resolution.x+abs(ds)*params.resolution.y,abs(ds)*params.resolution.x+abs(dc)*params.resolution.y);
 let outerEdge=select(0.0,extent.x,side>=0.0);
 let zigzag=1.0-4.0*abs(fract(aPos.y*6.0+0.25)-0.5);
 let seam=extent.x*0.5+zigzag*min(params.jaggedness,extent.x*0.45);
 let source=vec2f(mix(outerEdge,seam,aPos.x),aPos.y*extent.y);
 let sourceCanvas=toCanvas*(source-extent*0.5)+params.resolution*0.5;
 let tearProgress=min(params.progress,1.0);
 let tipY=tearProgress*extent.y;
 let pivot=vec2f(extent.x*0.5,tipY);
 let fullAngle=radians(params.rotation)*tearProgress;
 let bendHeight=max(extent.y*0.15,fullAngle*extent.x*1.5);
 let bend=smoothstep(0.0,bendHeight,tipY-source.y);
 let angle=side*fullAngle*bend;let c=cos(angle);let s=sin(angle);
 let delta=source-pivot;
 var position=pivot+vec2f(c*delta.x-s*delta.y,s*delta.x+c*delta.y);
 position.x+=side*max(params.progress-1.0,0.0)*extent.x*0.5;
 position=toCanvas*(position-extent*0.5)+params.resolution*0.5;
 var output: VertexOutput;
 // Mesh runtime restores orientation after resolving WebGL-compatible samples.
 output.position=vec4f(position.x/params.resolution.x*2.0-1.0,position.y/params.resolution.y*2.0-1.0,0,1);
 output.uv=sourceCanvas/params.resolution;
 return output;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 if (any(input.uv<vec2f(0)) || any(input.uv>vec2f(1))) {discard;}
 return textureSample(sourceTexture,sourceSampler,input.uv);
}
`;

// src/tear.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_PROGRESS = 0.5;
var DEFAULT_ANGLE = 0;
var DEFAULT_ROTATION = 20;
var DEFAULT_JAGGEDNESS = 20;
var MESH_ROWS = 192;
var tearSchema = {
  progress: {
    type: "number",
    min: 0,
    step: 0.01,
    default: DEFAULT_PROGRESS,
    description: "Progress",
    hiddenFromList: false
  },
  angle: {
    type: "number",
    step: 1,
    default: DEFAULT_ANGLE,
    description: "Angle",
    hiddenFromList: false
  },
  rotation: {
    type: "number",
    min: 0,
    max: 90,
    step: 1,
    default: DEFAULT_ROTATION,
    description: "Rotation",
    hiddenFromList: false
  },
  jaggedness: {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
    default: DEFAULT_JAGGEDNESS,
    description: "Jaggedness",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  progress: p.progress ?? DEFAULT_PROGRESS,
  angle: p.angle ?? DEFAULT_ANGLE,
  rotation: p.rotation ?? DEFAULT_ROTATION,
  jaggedness: p.jaggedness ?? DEFAULT_JAGGEDNESS
});
var validateTearParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Tear");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.progress, "progress");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.angle, "angle");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.rotation, "rotation");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.jaggedness, "jaggedness");
  const r = resolve(params);
  if (r.progress < 0) {
    throw new Error('"progress" must be >= 0');
  }
  if (r.rotation < 0 || r.rotation > 90) {
    throw new Error('"rotation" must be between 0 and 90');
  }
  if (r.jaggedness < 0) {
    throw new Error('"jaggedness" must be >= 0');
  }
};
var VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUv;
uniform vec2 uResolution;
uniform float uAngle;
uniform float uProgress;
uniform float uRotation;
uniform float uJaggedness;
uniform float uSide;

float seam(float y, float width) {
	// Six zigzags, with matching edges on both pieces. Limit the amplitude
	// to keep the tear inside the source, even on very narrow canvases.
	float zigzag = 1.0 - 4.0 * abs(fract(y * 6.0 + 0.25) - 0.5);
	return width * 0.5 + zigzag * min(uJaggedness, width * 0.45);
}

void main() {
	// Work in a rectangle aligned with the rip, large enough to cover the
	// original canvas at every angle. Rotate UVs back to the source so the
	// image itself keeps its orientation.
	float direction = radians(uAngle);
	float dc = cos(direction);
	float ds = sin(direction);
	mat2 toCanvas = mat2(dc, -ds, ds, dc);
	vec2 extent = vec2(
		abs(dc) * uResolution.x + abs(ds) * uResolution.y,
		abs(ds) * uResolution.x + abs(dc) * uResolution.y
	);
	float outerEdge = uSide < 0.0 ? 0.0 : extent.x;
	vec2 source = vec2(mix(outerEdge, seam(aPos.y, extent.x), aPos.x), aPos.y * extent.y);
	vec2 sourceCanvas = toCanvas * (source - extent * 0.5) + uResolution * 0.5;
	vUv = vec2(sourceCanvas.x / uResolution.x, 1.0 - sourceCanvas.y / uResolution.y);

	float tearProgress = min(uProgress, 1.0);
	float tipY = tearProgress * extent.y;
	// Keep the motion independent of the jagged edge. Following the seam
	// with the pivot would rock the entire image at every zigzag.
	vec2 pivot = vec2(extent.x * 0.5, tipY);
	// The short bend near the tip joins the rotating portion continuously
	// to the untouched area below it. Work in pixels to preserve angles
	// at different aspect ratios.
	float fullAngle = radians(uRotation) * tearProgress;
	// Widen the bend for larger rotations / wider sheets so neighboring
	// rows cannot fold over each other at the outside edges.
	float bendHeight = max(extent.y * 0.15, fullAngle * extent.x * 1.5);
	float bend = smoothstep(0.0, bendHeight, tipY - source.y);
	float angle = uSide * fullAngle * bend;
	float c = cos(angle);
	float s = sin(angle);
	vec2 delta = source - pivot;
	vec2 position = pivot + vec2(c * delta.x - s * delta.y, s * delta.x + c * delta.y);
	// After the tear reaches the bottom, keep the rotation stable and
	// move each piece outward by half a canvas width per unit of progress.
	position.x += uSide * max(uProgress - 1.0, 0.0) * extent.x * 0.5;
	position = toCanvas * (position - extent * 0.5) + uResolution * 0.5;
	gl_Position = vec4(position.x / uResolution.x * 2.0 - 1.0, 1.0 - position.y / uResolution.y * 2.0, 0.0, 1.0);
}
`;
var FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;

void main() {
	// The rotated mesh extends beyond the original image. Those parts
	// must remain transparent instead of smearing clamped border pixels.
	if (any(lessThan(vUv, vec2(0.0))) || any(greaterThan(vUv, vec2(1.0)))) {
		discard;
	}
	fragColor = texture(uSource, vUv);
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
    throw new Error(`Tear shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Tear program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createTearState = (gl) => {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = linkProgram(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create WebGL vertex array");
  }
  gl.bindVertexArray(vao);
  const data = new Float32Array((MESH_ROWS + 1) * 4);
  for (let row = 0;row <= MESH_ROWS; row++) {
    data.set([0, row / MESH_ROWS, 1, row / MESH_ROWS], row * 4);
  }
  const vbo = gl.createBuffer();
  if (!vbo) {
    throw new Error("Failed to create WebGL buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 8, 0);
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
    uSource: gl.getUniformLocation(program, "uSource"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uAngle: gl.getUniformLocation(program, "uAngle"),
    uProgress: gl.getUniformLocation(program, "uProgress"),
    uRotation: gl.getUniformLocation(program, "uRotation"),
    uJaggedness: gl.getUniformLocation(program, "uJaggedness"),
    uSide: gl.getUniformLocation(program, "uSide")
  };
};
var tear = createEffect({
  type: "dev.remotion.effects.tear",
  label: "tear()",
  documentationLink: "https://www.remotion.dev/docs/effects/tear",
  calculateKey: (params) => {
    const r = resolve(params);
    return `tear-${r.progress}-${r.rotation}-${r.jaggedness}-${r.angle}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMesh */ .pr)(target, "tear"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for tear");
        const r = resolve(params);
        (0,_index_br4w96rc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuMesh */ .wQ)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: TEAR_WEBGPU_SHADER,
          uniformData: new Float32Array([
            width,
            height,
            r.angle % 360,
            r.progress,
            r.rotation,
            r.jaggedness,
            0,
            0
          ]),
          vertices: null,
          topology: "triangle-strip",
          blend: false,
          vertexCount: (MESH_ROWS + 1) * 2,
          instanceCount: 2
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
          throw createWebGL2ContextError("tear effect");
        }
        return createTearState(gl);
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        state.gl.viewport(0, 0, width, height);
        state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, null);
        state.gl.clearColor(0, 0, 0, 0);
        state.gl.clear(state.gl.COLOR_BUFFER_BIT);
        state.gl.useProgram(state.program);
        state.gl.bindVertexArray(state.vao);
        state.gl.activeTexture(state.gl.TEXTURE0);
        state.gl.bindTexture(state.gl.TEXTURE_2D, state.texture);
        state.gl.pixelStorei(state.gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        state.gl.pixelStorei(state.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        state.gl.texImage2D(state.gl.TEXTURE_2D, 0, state.gl.RGBA, state.gl.RGBA, state.gl.UNSIGNED_BYTE, source);
        if (state.uSource)
          state.gl.uniform1i(state.uSource, 0);
        if (state.uAngle)
          state.gl.uniform1f(state.uAngle, r.angle % 360);
        if (state.uProgress)
          state.gl.uniform1f(state.uProgress, r.progress);
        if (state.uRotation)
          state.gl.uniform1f(state.uRotation, r.rotation);
        if (state.uJaggedness)
          state.gl.uniform1f(state.uJaggedness, r.jaggedness);
        if (state.uResolution)
          state.gl.uniform2f(state.uResolution, width, height);
        for (const side of [-1, 1]) {
          if (state.uSide)
            state.gl.uniform1f(state.uSide, side);
          state.gl.drawArrays(state.gl.TRIANGLE_STRIP, 0, (MESH_ROWS + 1) * 2);
        }
        state.gl.bindVertexArray(null);
        state.gl.bindTexture(state.gl.TEXTURE_2D, null);
        state.gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteTexture(texture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: tearSchema,
  validateParams: validateTearParams
});



/***/ }

}]);
//# sourceMappingURL=5641.bundle.js.map