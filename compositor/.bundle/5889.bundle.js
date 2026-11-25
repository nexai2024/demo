"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5889],{

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

/***/ 5889
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   paper: () => (/* binding */ paper)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/paper.ts


// src/paper-webgpu-shader.ts
var PAPER_WEBGPU_SHADER = `
diagnostic(off, derivative_uniformity);
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params { size: vec2f, aspectRatio: f32, amount: f32, colorFront: vec4f, colorBack: vec4f, contrast: f32, roughness: f32, fiber: f32, fiberSize: f32, crumples: f32, crumpleSize: f32, folds: f32, foldCount: f32, drops: f32, fade: f32, seed: f32, scale: f32, offsetY: f32, }
@group(0) @binding(3) var noiseTexture: texture_2d<f32>;
const TWO_PI=6.28318530718;
const PI=3.14159265358979323846;
fn getUvFrame(uv: vec2f) -> f32 {

	var aax: f32 = 2.0 * fwidth(uv.x);
	var aay: f32 = 2.0 * fwidth(uv.y);

	var left: f32 = smoothstep(0.0, aax, uv.x);
	var right: f32 = 1.0 - smoothstep(1.0 - aax, 1.0, uv.x);
	var bottom: f32 = smoothstep(0.0, aay, uv.y);
	var top: f32 = 1.0 - smoothstep(1.0 - aay, 1.0, uv.y);

	return left * right * bottom * top;
}

fn rotate(uv: vec2f, th: f32) -> vec2f {

	return mat2x2f(vec2f(cos(th), sin(th)),vec2f(-sin(th), cos(th))) * uv;
}

fn seedOffset(salt: f32) -> vec2f {

	var seeded: f32 = params.seed + salt;
	return fract(
		sin(
			vec2f(
				seeded * 12.9898 + 78.233,
				seeded * 39.3468 + 11.135
			)
		) * 43758.5453
	);
}

fn randomR(p: vec2f) -> f32 {

	var uv: vec2f = floor(p) / 100.0 + vec2f(0.5);
	return textureLoad(noiseTexture,vec2i(floor(fract(uv)*vec2f(textureDimensions(noiseTexture)))),0).r;
}

fn valueNoise(st: vec2f) -> f32 {

	var i: vec2f = floor(st);
	var f: vec2f = fract(st);
	var a: f32 = randomR(i);
	var b: f32 = randomR(i + vec2f(1.0, 0.0));
	var c: f32 = randomR(i + vec2f(0.0, 1.0));
	var d: f32 = randomR(i + vec2f(1.0, 1.0));
	var u: vec2f = f * f * (vec2f(3.0) - 2.0 * f);
	var x1: f32 = mix(a, b, u.x);
	var x2: f32 = mix(c, d, u.x);
	return mix(x1, x2, u.y);
}

fn fbm(nInput: vec2f) -> f32 {
var n=nInput;
	var total: f32 = 0.0;
	var amplitude: f32 = 0.4;
	for (var i: i32 = 0; i < 3; i++) {
		total += valueNoise(n) * amplitude;
		n *= 1.99;
		amplitude *= 0.65;
	}
	return total;
}

fn randomG(p: vec2f) -> f32 {

	var uv: vec2f = floor(p) / 50.0 + vec2f(0.5);
	return textureLoad(noiseTexture,vec2i(floor(fract(uv)*vec2f(textureDimensions(noiseTexture)))),0).g;
}

fn roughnessNoise(pInput: vec2f) -> f32 {
var p=pInput;
	p *= 0.1;
	var o: f32 = 0.0;
	for (var i: f32 = 1.0; i < 4.0; i += 1.0) {
		var w: vec4f = vec4f(floor(p), ceil(p));
		var f: vec2f = fract(p);
		o += mix(
			mix(randomG(w.xy), randomG(w.xw), f.y),
			mix(randomG(w.zy), randomG(w.zw), f.y),
			f.x
		);
		o += 0.2 / exp(2.0 * abs(sin(0.2 * p.x + 0.5 * p.y)));
 p *= 2.1;
	}
	return o / 3.0;
}

fn fiberRandom(p: vec2f) -> f32 {

	var uv: vec2f = floor(p) / 100.0;
	return textureLoad(noiseTexture,vec2i(floor(fract(uv)*vec2f(textureDimensions(noiseTexture)))),0).b;
}

fn fiberValueNoise(st: vec2f) -> f32 {

	var i: vec2f = floor(st);
	var f: vec2f = fract(st);
	var a: f32 = fiberRandom(i);
	var b: f32 = fiberRandom(i + vec2f(1.0, 0.0));
	var c: f32 = fiberRandom(i + vec2f(0.0, 1.0));
	var d: f32 = fiberRandom(i + vec2f(1.0, 1.0));
	var u: vec2f = f * f * (vec2f(3.0) - 2.0 * f);
	var x1: f32 = mix(a, b, u.x);
	var x2: f32 = mix(c, d, u.x);
	return mix(x1, x2, u.y);
}

fn fiberNoiseFbm(nInput: vec2f, seedOffset: vec2f) -> f32 {
var n=nInput;
	var total: f32 = 0.0;
	var amplitude: f32 = 1.0;
	for (var i: i32 = 0; i < 4; i++) {
		n = rotate(n, 0.7);
		total += fiberValueNoise(n + seedOffset) * amplitude;
		n *= 2.0;
		amplitude *= 0.6;
	}
	return total;
}

fn fiberNoise(uv: vec2f, seedOffset: vec2f) -> f32 {

	var epsilon: f32 = 0.001;
	var n1: f32 = fiberNoiseFbm(uv + vec2f(epsilon, 0.0), seedOffset);
	var n2: f32 = fiberNoiseFbm(uv - vec2f(epsilon, 0.0), seedOffset);
	var n3: f32 = fiberNoiseFbm(uv + vec2f(0.0, epsilon), seedOffset);
	var n4: f32 = fiberNoiseFbm(uv - vec2f(0.0, epsilon), seedOffset);
	return length(vec2f(n1 - n2, n3 - n4)) / (2.0 * epsilon);
}

fn randomGB(p: vec2f) -> vec2f {

	var uv: vec2f = floor(p) / 50.0 + vec2f(0.5);
	return textureLoad(noiseTexture,vec2i(floor(fract(uv)*vec2f(textureDimensions(noiseTexture)))),0).gb;
}

fn crumpledNoise(t: vec2f, pw: f32) -> f32 {

	var p: vec2f = floor(t);
	var wsum: f32 = 0.0;
	var cl: f32 = 0.0;
	for (var y: i32 = -1; y < 2; y += 1) {
		for (var x: i32 = -1; x < 2; x += 1) {
			var b: vec2f = vec2f(f32(x), f32(y));
			var q: vec2f = b + p;
			var q2: vec2f = q - floor(q / 8.0) * 8.0;
			var c: vec2f = q + randomGB(q2);
			var r: vec2f = c - t;
			var w: f32 =
				pow(smoothstep(0.0, 1.0, 1.0 - abs(r.x)), pw) *
				pow(smoothstep(0.0, 1.0, 1.0 - abs(r.y)), pw);
			cl += (0.5 + 0.5 * sin((q2.x + q2.y * 5.0) * 8.0)) * w;
			wsum += w;
		}
	}
	return pow(select(0.0, cl / select(1.0, wsum, wsum != 0.0), wsum != 0.0), 0.5) * 2.0;
}

fn crumplesShape(uv: vec2f) -> f32 {

	return crumpledNoise(uv * 0.25, 16.0) * crumpledNoise(uv * 0.5, 2.0);
}

fn folds(uv: vec2f) -> vec2f {

	var pp: vec3f = vec3f(0.0);
	var l: f32 = 9.0;
	for (var i: f32 = 0.0; i < 15.0; i += 1.0) {
		if (i >= params.foldCount) {
			break;
		}
		var rand: vec2f = randomGB(vec2f(i, i * params.seed));
		var an: f32 = rand.x * TWO_PI;
		var p: vec2f = vec2f(cos(an), sin(an)) * rand.y;
		var dist: f32 = distance(uv, p);
		l = min(l, dist);

		if (l == dist) {
			pp = vec3f(uv-p,pp.z);
			pp.z = dist;
		}
	}
	return mix(pp.xy, vec2f(0.0), pow(pp.z, 0.25));
}

fn drops(uv: vec2f) -> f32 {

	var iDropsUV: vec2f = floor(uv);
	var fDropsUV: vec2f = fract(uv);
	var dropsMinDist: f32 = 1.0;
	for (var j: i32 = -1; j <= 1; j++) {
		for (var i: i32 = -1; i <= 1; i++) {
			var neighbor: vec2f = vec2f(f32(i), f32(j));
			var offset: vec2f = randomGB(iDropsUV + neighbor);
			offset = vec2f(0.5) + 0.5 * sin(vec2f(10.0 * params.seed) + TWO_PI * offset);
			var pos: vec2f = neighbor + offset - fDropsUV;
			var dist: f32 = length(pos);
			dropsMinDist = min(dropsMinDist, dropsMinDist * dist);
		}
	}
	return 1.0 - smoothstep(0.05, 0.09, pow(dropsMinDist, 0.5));
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let pixel=vec2f(input.position.x,params.size.y+params.offsetY-input.position.y);
 let vUv=pixel/params.size;
	var color: vec4f = textureSampleLevel(source,sourceSampler,vec2f(vUv.x,1.0-vUv.y),0);
	var sourceAlpha: f32 = color.a;

	if (sourceAlpha <= 0.001 || params.amount <= 0.0) {
		return color;
	}

	var sourceRgb: vec3f = color.rgb / sourceAlpha;
	var imageUV: vec2f = vUv;
	var patternUV: vec2f = vUv - vec2f(0.5);
	patternUV /= max(params.scale, 0.001);
	patternUV = 5.0 * (patternUV * vec2f(params.aspectRatio, 1.0));

	var roughnessUv: vec2f =
		1.5 * (pixel - 0.5 * params.size) +
		128.0 * seedOffset(1.0);
	var roughness: f32 =
		roughnessNoise(roughnessUv + vec2f(1.0, 0.0)) -
		roughnessNoise(roughnessUv - vec2f(1.0, 0.0));

	var crumplesUV: vec2f =
		fract(patternUV * 0.02 / max(params.crumpleSize, 0.001) - vec2f(params.seed)) * 32.0;
	var crumples: f32 =
		params.crumples *
		(crumplesShape(crumplesUV + vec2f(0.05, 0.0)) -
			crumplesShape(crumplesUV));

	var fiberUV: vec2f = 2.0 / max(params.fiberSize, 0.001) * patternUV;
	var fiber: f32 = fiberNoise(fiberUV, 64.0 * seedOffset(2.0));
	fiber = 0.5 * params.fiber * (fiber - 1.0);

	var normal: vec2f = vec2f(0.0);
	var normalImage: vec2f = vec2f(0.0);

	var foldsUV: vec2f = patternUV * 0.12;
	foldsUV = rotate(foldsUV, 4.0 * params.seed);
	var w: vec2f = folds(foldsUV);
	foldsUV = rotate(foldsUV + vec2f(0.007 * cos(params.seed)), 0.01 * sin(params.seed));
	var w2: vec2f = folds(foldsUV);

	var dropPattern: f32 = params.drops * drops(patternUV * 2.0);

	var fade: f32 = params.fade * fbm(0.17 * patternUV + vec2f(10.0 * params.seed));
	fade = clamp(8.0 * fade * fade * fade, 0.0, 1.0);

	w = mix(w, vec2f(0.0), fade);
	w2 = mix(w2, vec2f(0.0), fade);
	crumples = mix(crumples, 0.0, fade);
	dropPattern = mix(dropPattern, 0.0, fade);
	fiber *= mix(1.0, 0.5, fade);
	roughness *= mix(1.0, 0.5, fade);

	normal += params.folds * min(5.0 * params.contrast, 1.0) * 4.0 * max(vec2f(0.0), w + w2);
	normalImage += params.folds * 2.0 * w;
	normal += vec2f(crumples);
	normalImage += vec2f(1.5 * crumples);
	normal += vec2f(3.0 * dropPattern);
	normalImage += vec2f(0.2 * dropPattern);
	normal += vec2f(params.roughness * 1.5 * roughness);
	normal += vec2f(fiber);
	normalImage += vec2f(params.roughness * 0.75 * roughness);
	normalImage += vec2f(0.2 * fiber);

	var lightPos: vec3f = vec3f(1.0, 2.0, 1.0);
	var res: f32 = dot(
		normalize(vec3f(normal, 9.5 - 9.0 * pow(params.contrast, 0.1))),
		normalize(lightPos)
	);

	imageUV += 0.02 * normalImage;
	var frame: f32 = getUvFrame(imageUV);
	var displacedSource: vec4f = textureSampleLevel(source,sourceSampler,clamp(vec2f(imageUV.x,1.0-imageUV.y),vec2f(0),vec2f(1)),0);
	var displacedRgb: vec3f = select(sourceRgb,displacedSource.rgb / max(displacedSource.a,0.001),displacedSource.a > 0.001);
	displacedRgb += vec3f(0.6 * pow(params.contrast, 0.4) * (res - 0.7));

	var frontRgb: vec3f = mix(vec3f(1.0), params.colorFront.rgb, params.colorFront.a);
	var backRgb: vec3f = mix(vec3f(1.0), params.colorBack.rgb, params.colorBack.a);
	var paperTone: vec3f = mix(backRgb, frontRgb, clamp(res, 0.0, 1.0));
	var texturedRgb: vec3f = displacedRgb * (0.72 + 0.42 * res);
	texturedRgb = mix(texturedRgb, texturedRgb * paperTone, 0.65);
	texturedRgb -= vec3f(0.007 * dropPattern);
	texturedRgb = mix(sourceRgb, texturedRgb, frame);

	var finalRgb: vec3f = mix(sourceRgb, clamp(texturedRgb, vec3f(0.0), vec3f(1.0)), params.amount);
	return vec4f(finalRgb * sourceAlpha, sourceAlpha);
}

`;
var PAPER_CROP_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: vec4f;
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  return textureLoad(source,vec2i(input.position.xy)+vec2i(0,1),0);
}
`;

// src/paper.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals;
var DEFAULT_AMOUNT = 1;
var DEFAULT_COLOR_FRONT = "#9fadbc";
var DEFAULT_COLOR_BACK = "#ffffff";
var DEFAULT_CONTRAST = 0.3;
var DEFAULT_ROUGHNESS = 0.4;
var DEFAULT_FIBER = 0.3;
var DEFAULT_FIBER_SIZE = 0.2;
var DEFAULT_CRUMPLES = 0.3;
var DEFAULT_CRUMPLE_SIZE = 0.35;
var DEFAULT_FOLDS = 0.65;
var DEFAULT_FOLD_COUNT = 5;
var DEFAULT_DROPS = 0.2;
var DEFAULT_FADE = 0;
var DEFAULT_SEED = 6;
var DEFAULT_SCALE = 0.6;
var MAX_FOLD_COUNT = 15;
var MAX_SEED = 1000;
var NOISE_TEXTURE_SIZE = 256;
var paperSchema = {
  amount: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_AMOUNT,
    description: "Amount",
    hiddenFromList: false
  },
  colorFront: {
    type: "color",
    default: DEFAULT_COLOR_FRONT,
    description: "Front color"
  },
  colorBack: {
    type: "color",
    default: DEFAULT_COLOR_BACK,
    description: "Back color"
  },
  contrast: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_CONTRAST,
    description: "Contrast",
    hiddenFromList: false
  },
  roughness: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_ROUGHNESS,
    description: "Roughness",
    hiddenFromList: false
  },
  fiber: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_FIBER,
    description: "Fiber",
    hiddenFromList: false
  },
  fiberSize: {
    type: "number",
    min: 0.01,
    max: 1,
    step: 0.01,
    default: DEFAULT_FIBER_SIZE,
    description: "Fiber size",
    hiddenFromList: false
  },
  crumples: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_CRUMPLES,
    description: "Crumples",
    hiddenFromList: false
  },
  crumpleSize: {
    type: "number",
    min: 0.01,
    max: 1,
    step: 0.01,
    default: DEFAULT_CRUMPLE_SIZE,
    description: "Crumple size",
    hiddenFromList: false
  },
  folds: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_FOLDS,
    description: "Folds",
    hiddenFromList: false
  },
  foldCount: {
    type: "number",
    min: 0,
    max: MAX_FOLD_COUNT,
    step: 1,
    default: DEFAULT_FOLD_COUNT,
    description: "Fold count",
    hiddenFromList: false
  },
  drops: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_DROPS,
    description: "Drops",
    hiddenFromList: false
  },
  fade: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_FADE,
    description: "Fade",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    min: 0,
    max: MAX_SEED,
    step: 0.01,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  },
  scale: {
    type: "number",
    min: 0.01,
    max: 4,
    step: 0.01,
    default: DEFAULT_SCALE,
    description: "Scale",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  amount: p.amount ?? DEFAULT_AMOUNT,
  colorFront: p.colorFront ?? DEFAULT_COLOR_FRONT,
  colorBack: p.colorBack ?? DEFAULT_COLOR_BACK,
  contrast: p.contrast ?? DEFAULT_CONTRAST,
  roughness: p.roughness ?? DEFAULT_ROUGHNESS,
  fiber: p.fiber ?? DEFAULT_FIBER,
  fiberSize: p.fiberSize ?? DEFAULT_FIBER_SIZE,
  crumples: p.crumples ?? DEFAULT_CRUMPLES,
  crumpleSize: p.crumpleSize ?? DEFAULT_CRUMPLE_SIZE,
  folds: p.folds ?? DEFAULT_FOLDS,
  foldCount: p.foldCount ?? DEFAULT_FOLD_COUNT,
  drops: p.drops ?? DEFAULT_DROPS,
  fade: p.fade ?? DEFAULT_FADE,
  seed: p.seed ?? DEFAULT_SEED,
  scale: p.scale ?? DEFAULT_SCALE
});
var validateAtMost = (value, max, name) => {
  if (value > max) {
    throw new TypeError(`"${name}" must be <= ${max}, but got ${JSON.stringify(value)}`);
  }
};
var validatePositiveUnitInterval = (value, name) => {
  if (value <= 0) {
    throw new TypeError(`"${name}" must be greater than 0, but got ${JSON.stringify(value)}`);
  }
  validateAtMost(value, 1, name);
};
var validatePaperParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Paper");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.amount, "amount");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalColor */ .gu)(params.colorFront, "colorFront");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalColor */ .gu)(params.colorBack, "colorBack");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.contrast, "contrast");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.roughness, "roughness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.fiber, "fiber");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.fiberSize, "fiberSize");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.crumples, "crumples");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.crumpleSize, "crumpleSize");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.folds, "folds");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.foldCount, "foldCount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.drops, "drops");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.fade, "fade");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.scale, "scale");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.contrast, "contrast");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.roughness, "roughness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.fiber, "fiber");
  validatePositiveUnitInterval(r.fiberSize, "fiberSize");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.crumples, "crumples");
  validatePositiveUnitInterval(r.crumpleSize, "crumpleSize");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.folds, "folds");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.foldCount, "foldCount");
  validateAtMost(r.foldCount, MAX_FOLD_COUNT, "foldCount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.drops, "drops");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.fade, "fade");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.seed, "seed");
  validateAtMost(r.seed, MAX_SEED, "seed");
  if (r.scale <= 0) {
    throw new TypeError(`"scale" must be greater than 0, but got ${JSON.stringify(r.scale)}`);
  }
  validateAtMost(r.scale, 4, "scale");
};
var PAPER_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var PAPER_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uImageAspectRatio;

uniform vec4 uColorFront;
uniform vec4 uColorBack;
uniform float uAmount;
uniform float uContrast;
uniform float uRoughness;
uniform float uFiber;
uniform float uFiberSize;
uniform float uCrumples;
uniform float uCrumpleSize;
uniform float uFolds;
uniform float uFoldCount;
uniform float uDrops;
uniform float uFade;
uniform float uSeed;
uniform float uScale;
uniform sampler2D uNoiseTexture;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

float getUvFrame(vec2 uv) {
	float aax = 2.0 * fwidth(uv.x);
	float aay = 2.0 * fwidth(uv.y);

	float left = smoothstep(0.0, aax, uv.x);
	float right = 1.0 - smoothstep(1.0 - aax, 1.0, uv.x);
	float bottom = smoothstep(0.0, aay, uv.y);
	float top = 1.0 - smoothstep(1.0 - aay, 1.0, uv.y);

	return left * right * bottom * top;
}

vec2 rotate(vec2 uv, float th) {
	return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

vec2 seedOffset(float salt) {
	float seeded = uSeed + salt;
	return fract(
		sin(
			vec2(
				seeded * 12.9898 + 78.233,
				seeded * 39.3468 + 11.135
			)
		) * 43758.5453
	);
}

float randomR(vec2 p) {
	vec2 uv = floor(p) / 100.0 + 0.5;
	return texture(uNoiseTexture, fract(uv)).r;
}

float valueNoise(vec2 st) {
	vec2 i = floor(st);
	vec2 f = fract(st);
	float a = randomR(i);
	float b = randomR(i + vec2(1.0, 0.0));
	float c = randomR(i + vec2(0.0, 1.0));
	float d = randomR(i + vec2(1.0, 1.0));
	vec2 u = f * f * (3.0 - 2.0 * f);
	float x1 = mix(a, b, u.x);
	float x2 = mix(c, d, u.x);
	return mix(x1, x2, u.y);
}

float fbm(vec2 n) {
	float total = 0.0;
	float amplitude = 0.4;
	for (int i = 0; i < 3; i++) {
		total += valueNoise(n) * amplitude;
		n *= 1.99;
		amplitude *= 0.65;
	}
	return total;
}

float randomG(vec2 p) {
	vec2 uv = floor(p) / 50.0 + 0.5;
	return texture(uNoiseTexture, fract(uv)).g;
}

float roughnessNoise(vec2 p) {
	p *= 0.1;
	float o = 0.0;
	for (float i = 0.0; ++i < 4.0; p *= 2.1) {
		vec4 w = vec4(floor(p), ceil(p));
		vec2 f = fract(p);
		o += mix(
			mix(randomG(w.xy), randomG(w.xw), f.y),
			mix(randomG(w.zy), randomG(w.zw), f.y),
			f.x
		);
		o += 0.2 / exp(2.0 * abs(sin(0.2 * p.x + 0.5 * p.y)));
	}
	return o / 3.0;
}

float fiberRandom(vec2 p) {
	vec2 uv = floor(p) / 100.0;
	return texture(uNoiseTexture, fract(uv)).b;
}

float fiberValueNoise(vec2 st) {
	vec2 i = floor(st);
	vec2 f = fract(st);
	float a = fiberRandom(i);
	float b = fiberRandom(i + vec2(1.0, 0.0));
	float c = fiberRandom(i + vec2(0.0, 1.0));
	float d = fiberRandom(i + vec2(1.0, 1.0));
	vec2 u = f * f * (3.0 - 2.0 * f);
	float x1 = mix(a, b, u.x);
	float x2 = mix(c, d, u.x);
	return mix(x1, x2, u.y);
}

float fiberNoiseFbm(in vec2 n, vec2 seedOffset) {
	float total = 0.0;
	float amplitude = 1.0;
	for (int i = 0; i < 4; i++) {
		n = rotate(n, 0.7);
		total += fiberValueNoise(n + seedOffset) * amplitude;
		n *= 2.0;
		amplitude *= 0.6;
	}
	return total;
}

float fiberNoise(vec2 uv, vec2 seedOffset) {
	float epsilon = 0.001;
	float n1 = fiberNoiseFbm(uv + vec2(epsilon, 0.0), seedOffset);
	float n2 = fiberNoiseFbm(uv - vec2(epsilon, 0.0), seedOffset);
	float n3 = fiberNoiseFbm(uv + vec2(0.0, epsilon), seedOffset);
	float n4 = fiberNoiseFbm(uv - vec2(0.0, epsilon), seedOffset);
	return length(vec2(n1 - n2, n3 - n4)) / (2.0 * epsilon);
}

vec2 randomGB(vec2 p) {
	vec2 uv = floor(p) / 50.0 + 0.5;
	return texture(uNoiseTexture, fract(uv)).gb;
}

float crumpledNoise(vec2 t, float pw) {
	vec2 p = floor(t);
	float wsum = 0.0;
	float cl = 0.0;
	for (int y = -1; y < 2; y += 1) {
		for (int x = -1; x < 2; x += 1) {
			vec2 b = vec2(float(x), float(y));
			vec2 q = b + p;
			vec2 q2 = q - floor(q / 8.0) * 8.0;
			vec2 c = q + randomGB(q2);
			vec2 r = c - t;
			float w =
				pow(smoothstep(0.0, 1.0, 1.0 - abs(r.x)), pw) *
				pow(smoothstep(0.0, 1.0, 1.0 - abs(r.y)), pw);
			cl += (0.5 + 0.5 * sin((q2.x + q2.y * 5.0) * 8.0)) * w;
			wsum += w;
		}
	}
	return pow(wsum != 0.0 ? cl / wsum : 0.0, 0.5) * 2.0;
}

float crumplesShape(vec2 uv) {
	return crumpledNoise(uv * 0.25, 16.0) * crumpledNoise(uv * 0.5, 2.0);
}

vec2 folds(vec2 uv) {
	vec3 pp = vec3(0.0);
	float l = 9.0;
	for (float i = 0.0; i < 15.0; i++) {
		if (i >= uFoldCount) {
			break;
		}
		vec2 rand = randomGB(vec2(i, i * uSeed));
		float an = rand.x * TWO_PI;
		vec2 p = vec2(cos(an), sin(an)) * rand.y;
		float dist = distance(uv, p);
		l = min(l, dist);

		if (l == dist) {
			pp.xy = uv - p.xy;
			pp.z = dist;
		}
	}
	return mix(pp.xy, vec2(0.0), pow(pp.z, 0.25));
}

float drops(vec2 uv) {
	vec2 iDropsUV = floor(uv);
	vec2 fDropsUV = fract(uv);
	float dropsMinDist = 1.0;
	for (int j = -1; j <= 1; j++) {
		for (int i = -1; i <= 1; i++) {
			vec2 neighbor = vec2(float(i), float(j));
			vec2 offset = randomGB(iDropsUV + neighbor);
			offset = 0.5 + 0.5 * sin(10.0 * uSeed + TWO_PI * offset);
			vec2 pos = neighbor + offset - fDropsUV;
			float dist = length(pos);
			dropsMinDist = min(dropsMinDist, dropsMinDist * dist);
		}
	}
	return 1.0 - smoothstep(0.05, 0.09, pow(dropsMinDist, 0.5));
}

void main() {
	vec2 paperUv = gl_FragCoord.xy / uResolution;
	vec4 source = texture(uSource, paperUv);
	float sourceAlpha = source.a;

	if (sourceAlpha <= 0.001 || uAmount <= 0.0) {
		fragColor = source;
		return;
	}

	vec3 sourceRgb = source.rgb / sourceAlpha;
	vec2 imageUV = paperUv;
	vec2 patternUV = paperUv - 0.5;
	patternUV /= max(uScale, 0.001);
	patternUV = 5.0 * (patternUV * vec2(uImageAspectRatio, 1.0));

	vec2 roughnessUv =
		1.5 * (gl_FragCoord.xy - 0.5 * uResolution) +
		128.0 * seedOffset(1.0);
	float roughness =
		roughnessNoise(roughnessUv + vec2(1.0, 0.0)) -
		roughnessNoise(roughnessUv - vec2(1.0, 0.0));

	vec2 crumplesUV =
		fract(patternUV * 0.02 / max(uCrumpleSize, 0.001) - uSeed) * 32.0;
	float crumples =
		uCrumples *
		(crumplesShape(crumplesUV + vec2(0.05, 0.0)) -
			crumplesShape(crumplesUV));

	vec2 fiberUV = 2.0 / max(uFiberSize, 0.001) * patternUV;
	float fiber = fiberNoise(fiberUV, 64.0 * seedOffset(2.0));
	fiber = 0.5 * uFiber * (fiber - 1.0);

	vec2 normal = vec2(0.0);
	vec2 normalImage = vec2(0.0);

	vec2 foldsUV = patternUV * 0.12;
	foldsUV = rotate(foldsUV, 4.0 * uSeed);
	vec2 w = folds(foldsUV);
	foldsUV = rotate(foldsUV + 0.007 * cos(uSeed), 0.01 * sin(uSeed));
	vec2 w2 = folds(foldsUV);

	float dropPattern = uDrops * drops(patternUV * 2.0);

	float fade = uFade * fbm(0.17 * patternUV + 10.0 * uSeed);
	fade = clamp(8.0 * fade * fade * fade, 0.0, 1.0);

	w = mix(w, vec2(0.0), fade);
	w2 = mix(w2, vec2(0.0), fade);
	crumples = mix(crumples, 0.0, fade);
	dropPattern = mix(dropPattern, 0.0, fade);
	fiber *= mix(1.0, 0.5, fade);
	roughness *= mix(1.0, 0.5, fade);

	normal.xy += uFolds * min(5.0 * uContrast, 1.0) * 4.0 * max(vec2(0.0), w + w2);
	normalImage.xy += uFolds * 2.0 * w;
	normal.xy += crumples;
	normalImage.xy += 1.5 * crumples;
	normal.xy += 3.0 * dropPattern;
	normalImage.xy += 0.2 * dropPattern;
	normal.xy += uRoughness * 1.5 * roughness;
	normal.xy += fiber;
	normalImage += uRoughness * 0.75 * roughness;
	normalImage += 0.2 * fiber;

	vec3 lightPos = vec3(1.0, 2.0, 1.0);
	float res = dot(
		normalize(vec3(normal, 9.5 - 9.0 * pow(uContrast, 0.1))),
		normalize(lightPos)
	);

	imageUV += 0.02 * normalImage;
	float frame = getUvFrame(imageUV);
	vec4 displacedSource = texture(uSource, clamp(imageUV, vec2(0.0), vec2(1.0)));
	vec3 displacedRgb = displacedSource.a > 0.001
		? displacedSource.rgb / displacedSource.a
		: sourceRgb;
	displacedRgb += 0.6 * pow(uContrast, 0.4) * (res - 0.7);

	vec3 frontRgb = mix(vec3(1.0), uColorFront.rgb, uColorFront.a);
	vec3 backRgb = mix(vec3(1.0), uColorBack.rgb, uColorBack.a);
	vec3 paperTone = mix(backRgb, frontRgb, clamp(res, 0.0, 1.0));
	vec3 texturedRgb = displacedRgb * (0.72 + 0.42 * res);
	texturedRgb = mix(texturedRgb, texturedRgb * paperTone, 0.65);
	texturedRgb -= 0.007 * dropPattern;
	texturedRgb = mix(sourceRgb, texturedRgb, frame);

	vec3 finalRgb = mix(sourceRgb, clamp(texturedRgb, 0.0, 1.0), uAmount);
	fragColor = vec4(finalRgb * sourceAlpha, sourceAlpha);
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
    throw new Error(`Paper shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Paper program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createSourceTexture = (gl) => {
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
var initialNoiseState = (seed) => {
  const scaledSeed = Math.round(seed * 1000);
  const mixedState = (2654435769 ^ Math.imul(scaledSeed, 2246822507)) >>> 0;
  return mixedState === 0 ? 2654435769 : mixedState;
};
var nextNoiseState = (state) => {
  let next = state;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
};
var createNoiseData = (seed) => {
  const data = new Uint8Array(NOISE_TEXTURE_SIZE * NOISE_TEXTURE_SIZE * 4);
  let state = initialNoiseState(seed);
  for (let i = 0;i < data.length; i += 4) {
    state = nextNoiseState(state);
    data[i] = state & 255;
    state = nextNoiseState(state);
    data[i + 1] = state & 255;
    state = nextNoiseState(state);
    data[i + 2] = state & 255;
    data[i + 3] = 255;
  }
  return data;
};
var uploadNoiseTexture = (gl, texture, seed) => {
  const data = createNoiseData(seed);
  const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const premultiplyAlpha = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE_TEXTURE_SIZE, NOISE_TEXTURE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  } finally {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
  }
};
var createNoiseTexture = (gl) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create WebGL noise texture");
  }
  uploadNoiseTexture(gl, texture, DEFAULT_SEED);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
};
var setupPaper = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("paper effect");
  }
  const vs = compileShader(gl, gl.VERTEX_SHADER, PAPER_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, PAPER_FS);
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
  const sourceTexture = createSourceTexture(gl);
  const noiseTexture = createNoiseTexture(gl);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!colorCtx) {
    throw new Error("Failed to acquire 2D context for color parsing");
  }
  return {
    gl,
    program,
    vao,
    vbo,
    sourceTexture,
    noiseTexture,
    uSource: gl.getUniformLocation(program, "uSource"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uImageAspectRatio: gl.getUniformLocation(program, "uImageAspectRatio"),
    uColorFront: gl.getUniformLocation(program, "uColorFront"),
    uColorBack: gl.getUniformLocation(program, "uColorBack"),
    uAmount: gl.getUniformLocation(program, "uAmount"),
    uContrast: gl.getUniformLocation(program, "uContrast"),
    uRoughness: gl.getUniformLocation(program, "uRoughness"),
    uFiber: gl.getUniformLocation(program, "uFiber"),
    uFiberSize: gl.getUniformLocation(program, "uFiberSize"),
    uCrumples: gl.getUniformLocation(program, "uCrumples"),
    uCrumpleSize: gl.getUniformLocation(program, "uCrumpleSize"),
    uFolds: gl.getUniformLocation(program, "uFolds"),
    uFoldCount: gl.getUniformLocation(program, "uFoldCount"),
    uDrops: gl.getUniformLocation(program, "uDrops"),
    uFade: gl.getUniformLocation(program, "uFade"),
    uSeed: gl.getUniformLocation(program, "uSeed"),
    uScale: gl.getUniformLocation(program, "uScale"),
    uNoiseTexture: gl.getUniformLocation(program, "uNoiseTexture"),
    colorCtx,
    cachedColorFront: "",
    cachedColorFrontRgba: [159, 173, 188, 255],
    cachedColorBack: "",
    cachedColorBackRgba: [255, 255, 255, 255],
    cachedNoiseSeed: DEFAULT_SEED
  };
};
var normalizedRgba = (color) => {
  return [color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255];
};
var paper = createEffect({
  type: "dev.remotion.effects.paper",
  label: "paper()",
  documentationLink: "https://www.remotion.dev/docs/effects/paper",
  calculateKey: (params) => {
    const r = resolve(params);
    return `paper-${r.amount}-${r.colorFront}-${r.colorBack}-${r.contrast}-${r.roughness}-${r.fiber}-${r.fiberSize}-${r.crumples}-${r.crumpleSize}-${r.folds}-${r.foldCount}-${r.drops}-${r.fade}-${r.seed}-${r.scale}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const colorCtx = canvas.getContext("2d", { willReadFrequently: true });
        if (!colorCtx)
          throw new Error("Could not create paper color parsing context");
        const paddedCanvas = document.createElement("canvas");
        return {
          ...(0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "paper"),
          colorCtx,
          noiseData: new Uint8Array(0),
          noiseSeed: null,
          paddedCanvas,
          paddedState: (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(paddedCanvas, "paper")
        };
      },
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the paper effect");
        const r = resolve(params);
        const offsetY = height % 2;
        if (offsetY && (state.paddedCanvas.width !== width || state.paddedCanvas.height !== height + 1)) {
          state.paddedCanvas.width = width;
          state.paddedCanvas.height = height + 1;
        }
        const uniformData = new Float32Array([
          width,
          height,
          width / height,
          r.amount,
          ...normalizedRgba((0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, r.colorFront)),
          ...normalizedRgba((0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, r.colorBack)),
          r.contrast,
          r.roughness,
          r.fiber,
          r.fiberSize,
          r.crumples,
          r.crumpleSize,
          r.folds,
          r.foldCount,
          r.drops,
          r.fade,
          r.seed,
          r.scale,
          offsetY,
          0,
          0,
          0
        ]);
        if (state.noiseSeed !== r.seed) {
          state.noiseData = createNoiseData(r.seed);
          state.noiseSeed = r.seed;
        }
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state: offsetY ? state.paddedState : state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: PAPER_WEBGPU_SHADER,
          uniformData
        }, {
          sourceFilter: null,
          auxiliaryTexture: {
            data: state.noiseData,
            width: NOISE_TEXTURE_SIZE,
            height: NOISE_TEXTURE_SIZE,
            format: "rgba8unorm"
          }
        });
        if (offsetY) {
          (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
            state,
            source: state.paddedCanvas,
            width,
            height,
            device: gpuDevice,
            shader: PAPER_CROP_WEBGPU_SHADER,
            uniformData: new Float32Array([width, height, 0, 0])
          });
        }
      },
      cleanup: (state) => {
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl)(state.paddedState);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl)(state);
      }
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => setupPaper(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, sourceTexture, noiseTexture } = state;
        if (state.cachedColorFront !== r.colorFront) {
          state.cachedColorFront = r.colorFront;
          state.cachedColorFrontRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, r.colorFront);
        }
        if (state.cachedColorBack !== r.colorBack) {
          state.cachedColorBack = r.colorBack;
          state.cachedColorBackRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, r.colorBack);
        }
        const [frontRed, frontGreen, frontBlue, frontAlpha] = normalizedRgba(state.cachedColorFrontRgba);
        const [backRed, backGreen, backBlue, backAlpha] = normalizedRgba(state.cachedColorBackRgba);
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
        if (state.cachedNoiseSeed !== r.seed) {
          uploadNoiseTexture(gl, noiseTexture, r.seed);
          state.cachedNoiseSeed = r.seed;
        }
        if (state.uSource)
          gl.uniform1i(state.uSource, 0);
        if (state.uResolution)
          gl.uniform2f(state.uResolution, width, height);
        if (state.uImageAspectRatio)
          gl.uniform1f(state.uImageAspectRatio, width / height);
        if (state.uColorFront)
          gl.uniform4f(state.uColorFront, frontRed, frontGreen, frontBlue, frontAlpha);
        if (state.uColorBack)
          gl.uniform4f(state.uColorBack, backRed, backGreen, backBlue, backAlpha);
        if (state.uAmount)
          gl.uniform1f(state.uAmount, r.amount);
        if (state.uContrast)
          gl.uniform1f(state.uContrast, r.contrast);
        if (state.uRoughness)
          gl.uniform1f(state.uRoughness, r.roughness);
        if (state.uFiber)
          gl.uniform1f(state.uFiber, r.fiber);
        if (state.uFiberSize)
          gl.uniform1f(state.uFiberSize, r.fiberSize);
        if (state.uCrumples)
          gl.uniform1f(state.uCrumples, r.crumples);
        if (state.uCrumpleSize)
          gl.uniform1f(state.uCrumpleSize, r.crumpleSize);
        if (state.uFolds)
          gl.uniform1f(state.uFolds, r.folds);
        if (state.uFoldCount)
          gl.uniform1f(state.uFoldCount, r.foldCount);
        if (state.uDrops)
          gl.uniform1f(state.uDrops, r.drops);
        if (state.uFade)
          gl.uniform1f(state.uFade, r.fade);
        if (state.uSeed)
          gl.uniform1f(state.uSeed, r.seed);
        if (state.uScale)
          gl.uniform1f(state.uScale, r.scale);
        if (state.uNoiseTexture)
          gl.uniform1i(state.uNoiseTexture, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, sourceTexture, noiseTexture }) => {
        gl.deleteTexture(sourceTexture);
        gl.deleteTexture(noiseTexture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: paperSchema,
  validateParams: validatePaperParams
});



/***/ }

}]);
//# sourceMappingURL=5889.bundle.js.map