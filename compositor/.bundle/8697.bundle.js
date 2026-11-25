"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[8697],{

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

/***/ 1078
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   lensBlur: () => (/* binding */ lensBlur)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/lens-blur/index.ts


// src/lens-blur/shader.ts
var LENS_BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uRadius;
uniform int uIrisShape;
uniform float uIrisRoundness;
uniform float uIrisRotation;
uniform float uIrisAspectRatio;
uniform float uHighlightGain;
uniform float uHighlightThreshold;
uniform float uHighlightSaturation;
uniform bool uRepeatEdgePixels;
uniform int uSamples;
uniform bool uLinearLight;

const float PI = 3.141592653589793;
const float GOLDEN_ANGLE = 2.399963229728653;

vec3 toLinear(vec3 color) {
	return mix(color / 12.92, pow((color + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), color));
}

vec3 toSrgb(vec3 color) {
	return mix(color * 12.92, 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
}

vec4 readSource(vec2 uv) {
	vec4 sampleColor = texture(uSource, uv);
	if (sampleColor.a <= 0.0) return vec4(0.0);
	vec3 color = sampleColor.rgb / sampleColor.a;
	float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
	if (uLinearLight) color = toLinear(color);
	if (luminance >= uHighlightThreshold) {
		float brightest = max(color.r, max(color.g, color.b));
		vec3 highlight = mix(vec3(brightest), color, uHighlightSaturation);
		color += highlight * (4.0 * uHighlightGain);
	}

	float coverage = 1.0;
	if (!uRepeatEdgePixels) {
		// The texture clamps to its edge texels. Fade their bilinear footprint
		// against transparent texels beyond the canvas instead of cutting it off.
		vec2 pixel = uv * uResolution;
		vec2 nearEdge = clamp(pixel + 0.5, 0.0, 1.0);
		vec2 farEdge = clamp(uResolution + 0.5 - pixel, 0.0, 1.0);
		coverage = nearEdge.x * nearEdge.y * farEdge.x * farEdge.y;
	}
	return vec4(color * sampleColor.a, sampleColor.a) * coverage;
}

void main() {
	// A zero radius must be an exact identity, including with highlight gain.
	if (uRadius == 0.0) {
		fragColor = texture(uSource, vUv);
		return;
	}

	vec4 sum = vec4(0.0);
	float totalWeight = 0.0;
	for (int i = 0; i < 2048; i++) {
		if (i >= uSamples) break;
		float angle = float(i) * GOLDEN_ANGLE;
		float boundary = 1.0;
		if (uIrisShape < 11) {
			float halfSector = PI / float(uIrisShape);
			float localAngle = mod(angle + PI / 2.0, 2.0 * halfSector) - halfSector;
			float polygon = cos(halfSector) / cos(localAngle);
			boundary = mix(polygon, 1.0, uIrisRoundness);
		}
		float distance = sqrt((float(i) + 0.5) / float(uSamples)) * boundary;
		float rotatedAngle = angle + uIrisRotation;
		vec2 offset = vec2(cos(rotatedAngle) * uIrisAspectRatio, -sin(rotatedAngle)) * distance * uRadius;
		// Radially mapping a disc onto a polygon changes area by boundary^2.
		// Weight by that Jacobian to keep the aperture uniformly illuminated.
		float weight = boundary * boundary;
		sum += readSource(vUv - offset / uResolution) * weight;
		totalWeight += weight;
	}

	vec4 color = sum / totalWeight;
	if (uLinearLight && color.a > 0.0) {
		color.rgb = toSrgb(color.rgb / color.a) * color.a;
	}
	// Keep the result premultiplied even when highlights exceed display white.
	fragColor = vec4(clamp(color.rgb, vec3(0.0), vec3(color.a)), color.a);
}
`;

// src/lens-blur/webgpu-shader.ts
var LENS_BLUR_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
// Aperture geometry and highlight controls adapted from EffectCraft's blur2.rs (MIT).
// See ../../THIRD_PARTY_LICENSES.md.
struct Params {resolution: vec2f, radius: f32, shape: f32, iris: vec4f, highlights: vec4f, options: vec4f,}
const PI=3.141592653589793;
const GOLDEN_ANGLE=2.399963229728653;
fn toLinear(color: vec3f) -> vec3f {
 return mix(color/12.92,pow((color+0.055)/1.055,vec3f(2.4)),step(vec3f(0.04045),color));
}
fn toSrgb(color: vec3f) -> vec3f {
 return mix(color*12.92,1.055*pow(max(color,vec3f(0)),vec3f(1.0/2.4))-0.055,step(vec3f(0.0031308),color));
}
fn readSource(uv: vec2f) -> vec4f {
 let sampled=textureSampleLevel(source,sourceSampler,uv,0);
 if (sampled.a<=0.0) {return vec4f(0);}
 var color=sampled.rgb/sampled.a;
 let luminance=dot(color,vec3f(0.2126,0.7152,0.0722));
 if (params.options.y!=0.0) {color=toLinear(color);}
 if (luminance>=params.highlights.y) {
  let brightest=max(color.r,max(color.g,color.b));
  let highlight=mix(vec3f(brightest),color,params.highlights.z);
  color+=highlight*(4.0*params.highlights.x);
 }
 var coverage=1.0;
 if (params.highlights.w==0.0) {
  let pixel=uv*params.resolution;
  let nearEdge=clamp(pixel+0.5,vec2f(0),vec2f(1));
  let farEdge=clamp(params.resolution+0.5-pixel,vec2f(0),vec2f(1));
  coverage=nearEdge.x*nearEdge.y*farEdge.x*farEdge.y;
 }
 return vec4f(color*sampled.a,sampled.a)*coverage;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 if (params.radius==0.0) {return textureSampleLevel(source,sourceSampler,input.uv,0);}
 var sum=vec4f(0);var total=0.0;
 for (var i=0;i<2048;i++) {
  if (f32(i)>=params.options.x) {break;}
  let angle=f32(i)*GOLDEN_ANGLE;
  var boundary=1.0;
  if (params.shape<11.0) {
   let halfSector=PI/params.shape;
   let value=angle+PI/2.0;
   let localAngle=value-floor(value/(2.0*halfSector))*(2.0*halfSector)-halfSector;
   let polygon=cos(halfSector)/cos(localAngle);
   boundary=mix(polygon,1.0,params.iris.x);
  }
  let distance=sqrt((f32(i)+0.5)/params.options.x)*boundary;
  let rotatedAngle=angle+params.iris.y;
  let offset=vec2f(cos(rotatedAngle)*params.iris.z,sin(rotatedAngle))*distance*params.radius;
  let weight=boundary*boundary;
  sum+=readSource(input.uv-offset/params.resolution)*weight;
  total+=weight;
 }
 var color=sum/total;
 if (params.options.y!=0.0 && color.a>0.0) {color=vec4f(toSrgb(color.rgb/color.a)*color.a,color.a);}
 return vec4f(clamp(color.rgb,vec3f(0),vec3f(color.a)),color.a);
}
`;

// src/lens-blur/index.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals;
var DEFAULT_RADIUS = 10;
var DEFAULT_IRIS_SHAPE = "hexagon";
var DEFAULT_IRIS_ROUNDNESS = 0;
var DEFAULT_IRIS_ROTATION = 0;
var DEFAULT_IRIS_ASPECT_RATIO = 1;
var DEFAULT_HIGHLIGHT_GAIN = 0;
var DEFAULT_HIGHLIGHT_THRESHOLD = 1;
var DEFAULT_HIGHLIGHT_SATURATION = 1;
var DEFAULT_REPEAT_EDGE_PIXELS = false;
var DEFAULT_SAMPLES = 256;
var DEFAULT_LINEAR_LIGHT = false;
var IRIS_SHAPES = [
  "triangle",
  "square",
  "pentagon",
  "hexagon",
  "heptagon",
  "octagon",
  "nonagon",
  "decagon",
  "circle"
];
var lensBlurSchema = {
  radius: {
    type: "number",
    default: DEFAULT_RADIUS,
    description: "Blur radius in pixels",
    min: 0,
    max: 200,
    step: 1,
    hiddenFromList: false
  },
  irisShape: {
    type: "enum",
    default: DEFAULT_IRIS_SHAPE,
    description: "Iris shape",
    variants: {
      triangle: {},
      square: {},
      pentagon: {},
      hexagon: {},
      heptagon: {},
      octagon: {},
      nonagon: {},
      decagon: {},
      circle: {}
    }
  },
  irisRoundness: {
    type: "number",
    default: DEFAULT_IRIS_ROUNDNESS,
    description: "Roundness of the iris, from 0 (polygon) to 1 (circle)",
    min: 0,
    max: 1,
    step: 0.01,
    hiddenFromList: false
  },
  irisRotation: {
    type: "rotation-degrees",
    default: DEFAULT_IRIS_ROTATION,
    description: "Clockwise iris rotation in degrees",
    step: 1
  },
  irisAspectRatio: {
    type: "number",
    default: DEFAULT_IRIS_ASPECT_RATIO,
    description: "Horizontal stretch of the iris",
    min: 0.01,
    max: 4,
    step: 0.01,
    hiddenFromList: false
  },
  highlightGain: {
    type: "number",
    default: DEFAULT_HIGHLIGHT_GAIN,
    description: "Additional brightness of highlights, from 0 to 1",
    min: 0,
    max: 1,
    step: 0.01,
    hiddenFromList: false
  },
  highlightThreshold: {
    type: "number",
    default: DEFAULT_HIGHLIGHT_THRESHOLD,
    description: "Minimum luminance for highlight gain, from 0 to 1",
    min: 0,
    max: 1,
    step: 0.01,
    hiddenFromList: false
  },
  highlightSaturation: {
    type: "number",
    default: DEFAULT_HIGHLIGHT_SATURATION,
    description: "Saturation of added highlight brightness, from 0 to 1",
    min: 0,
    max: 1,
    step: 0.01,
    hiddenFromList: false
  },
  repeatEdgePixels: {
    type: "boolean",
    default: DEFAULT_REPEAT_EDGE_PIXELS,
    description: "Repeat edge pixels outside the source instead of sampling transparency"
  },
  samples: {
    type: "number",
    default: DEFAULT_SAMPLES,
    description: "Number of aperture samples, from 16 to 2048",
    min: 16,
    max: 2048,
    step: 1,
    hiddenFromList: false,
    integer: true
  },
  linearLight: {
    type: "boolean",
    default: DEFAULT_LINEAR_LIGHT,
    description: "Average colors in linear light"
  }
};
var resolve = (p) => ({
  radius: p.radius ?? DEFAULT_RADIUS,
  irisShape: p.irisShape ?? DEFAULT_IRIS_SHAPE,
  irisRoundness: p.irisRoundness ?? DEFAULT_IRIS_ROUNDNESS,
  irisRotation: p.irisRotation ?? DEFAULT_IRIS_ROTATION,
  irisAspectRatio: p.irisAspectRatio ?? DEFAULT_IRIS_ASPECT_RATIO,
  highlightGain: p.highlightGain ?? DEFAULT_HIGHLIGHT_GAIN,
  highlightThreshold: p.highlightThreshold ?? DEFAULT_HIGHLIGHT_THRESHOLD,
  highlightSaturation: p.highlightSaturation ?? DEFAULT_HIGHLIGHT_SATURATION,
  repeatEdgePixels: p.repeatEdgePixels ?? DEFAULT_REPEAT_EDGE_PIXELS,
  samples: p.samples ?? DEFAULT_SAMPLES,
  linearLight: p.linearLight ?? DEFAULT_LINEAR_LIGHT
});
var validateLensBlurParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Lens blur");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.radius, "radius");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.irisRoundness, "irisRoundness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.irisRotation, "irisRotation");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.irisAspectRatio, "irisAspectRatio");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.highlightGain, "highlightGain");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.highlightThreshold, "highlightThreshold");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.highlightSaturation, "highlightSaturation");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalBoolean */ .fX)(params.repeatEdgePixels, "repeatEdgePixels");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.samples, "samples");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalBoolean */ .fX)(params.linearLight, "linearLight");
  if (params.irisShape !== undefined && !IRIS_SHAPES.includes(params.irisShape)) {
    throw new TypeError("Invalid irisShape: " + JSON.stringify(params.irisShape));
  }
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.radius, "radius");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.irisRoundness, "irisRoundness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.highlightGain, "highlightGain");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.highlightThreshold, "highlightThreshold");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.highlightSaturation, "highlightSaturation");
  if (r.irisAspectRatio <= 0)
    throw new TypeError('"irisAspectRatio" must be greater than zero');
  if (!Number.isInteger(r.samples) || r.samples < 16 || r.samples > 2048)
    throw new TypeError('"samples" must be an integer between 16 and 2048');
};
var VERTEX_SHADER = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
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
    throw new Error(`LensBlur shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`LensBlur program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var setupLensBlur = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("lens blur effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, LENS_BLUR_FRAGMENT_SHADER);
  const program = linkProgram(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
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
  const aPos = gl.getAttribLocation(program, "aPos");
  const aUv = gl.getAttribLocation(program, "aUv");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
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
  return {
    gl,
    program,
    vao,
    vbo,
    texture,
    uSource: gl.getUniformLocation(program, "uSource"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uRadius: gl.getUniformLocation(program, "uRadius"),
    uIrisShape: gl.getUniformLocation(program, "uIrisShape"),
    uIrisRoundness: gl.getUniformLocation(program, "uIrisRoundness"),
    uIrisRotation: gl.getUniformLocation(program, "uIrisRotation"),
    uIrisAspectRatio: gl.getUniformLocation(program, "uIrisAspectRatio"),
    uHighlightGain: gl.getUniformLocation(program, "uHighlightGain"),
    uHighlightThreshold: gl.getUniformLocation(program, "uHighlightThreshold"),
    uHighlightSaturation: gl.getUniformLocation(program, "uHighlightSaturation"),
    uRepeatEdgePixels: gl.getUniformLocation(program, "uRepeatEdgePixels"),
    uSamples: gl.getUniformLocation(program, "uSamples"),
    uLinearLight: gl.getUniformLocation(program, "uLinearLight")
  };
};
var lensBlur = createEffect({
  type: "remotion/lens-blur",
  label: "lensBlur()",
  documentationLink: "https://www.remotion.dev/docs/effects/lens-blur",
  calculateKey: (params) => {
    const r = resolve(params);
    return `lens-blur-${JSON.stringify(r)}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "lens-blur"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for this effect");
        const r = resolve(params);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: LENS_BLUR_WEBGPU_SHADER,
          uniformData: new Float32Array([
            width,
            height,
            r.radius,
            IRIS_SHAPES.indexOf(r.irisShape) + 3,
            r.irisRoundness,
            r.irisRotation % 360 * Math.PI / 180,
            r.irisAspectRatio,
            0,
            r.highlightGain,
            r.highlightThreshold,
            r.highlightSaturation,
            r.repeatEdgePixels ? 1 : 0,
            r.samples,
            r.linearLight ? 1 : 0,
            0,
            0
          ])
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => setupLensBlur(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, texture, vao } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.useProgram(program);
        if (state.uSource)
          gl.uniform1i(state.uSource, 0);
        if (state.uResolution)
          gl.uniform2f(state.uResolution, width, height);
        if (state.uRadius)
          gl.uniform1f(state.uRadius, r.radius);
        if (state.uIrisShape)
          gl.uniform1i(state.uIrisShape, IRIS_SHAPES.indexOf(r.irisShape) + 3);
        if (state.uIrisRoundness)
          gl.uniform1f(state.uIrisRoundness, r.irisRoundness);
        if (state.uIrisRotation)
          gl.uniform1f(state.uIrisRotation, r.irisRotation % 360 * Math.PI / 180);
        if (state.uIrisAspectRatio)
          gl.uniform1f(state.uIrisAspectRatio, r.irisAspectRatio);
        if (state.uHighlightGain)
          gl.uniform1f(state.uHighlightGain, r.highlightGain);
        if (state.uHighlightThreshold)
          gl.uniform1f(state.uHighlightThreshold, r.highlightThreshold);
        if (state.uHighlightSaturation)
          gl.uniform1f(state.uHighlightSaturation, r.highlightSaturation);
        if (state.uRepeatEdgePixels)
          gl.uniform1i(state.uRepeatEdgePixels, r.repeatEdgePixels ? 1 : 0);
        if (state.uSamples)
          gl.uniform1i(state.uSamples, r.samples);
        if (state.uLinearLight)
          gl.uniform1i(state.uLinearLight, r.linearLight ? 1 : 0);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteTexture(texture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: lensBlurSchema,
  validateParams: validateLensBlurParams
});



/***/ }

}]);
//# sourceMappingURL=8697.bundle.js.map