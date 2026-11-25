"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[8174],{

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

/***/ 8174
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   shrinkwrap: () => (/* binding */ shrinkwrap)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/shrinkwrap.ts


// src/shrinkwrap-webgpu-shader.ts
var SHRINKWRAP_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params { size: vec2f, amount: f32, displacement: f32, highlightIntensity: f32, wrinkleDensity: f32, edgeTension: f32, phase: f32, seed: f32, }
fn hash21(p: vec2f) -> f32 {
	var p3: vec3f = fract(vec3f(p.xyx) * vec3f(443.8975, 397.2973, 491.1871));
	p3 += vec3f(dot(p3, p3.yzx + vec3f(19.19) + vec3f(params.seed * 0.131)));
	return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise(p: vec2f) -> f32 {
	var i: vec2f = floor(p);
	var f: vec2f = fract(p);
	f = f * f * (vec2f(3.0) - 2.0 * f);

	var a: f32 = hash21(i);
	var b: f32 = hash21(i + vec2f(1.0, 0.0));
	var c: f32 = hash21(i + vec2f(0.0, 1.0));
	var d: f32 = hash21(i + vec2f(1.0, 1.0));

	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn fbm(point: vec2f) -> f32 {
 var p=point;
	var value: f32 = 0.0;
	var amplitude: f32 = 0.5;

	for (var i: i32 = 0; i < 4; i++) {
		value += valueNoise(p) * amplitude;
		p = p * 2.03 + vec2f(17.1, 31.7);
		amplitude *= 0.5;
	}

	return value;
}

fn rotate2d(angle: f32) -> mat2x2f {
	var c: f32 = cos(angle);
	var s: f32 = sin(angle);
	return mat2x2f(vec2f(c,-s),vec2f(s,c));
}

fn phaseVec(xFactor: f32, yFactor: f32) -> vec2f {
	return vec2f(params.phase * xFactor, params.phase * yFactor);
}

fn warpVec(p: vec2f, scale: f32, amount: f32, seedOffset: f32) -> vec2f {
	return vec2f(
		fbm(p / scale + phaseVec(0.21, 0.13) + vec2f(seedOffset, 1.7)) - 0.5,
		fbm(p / scale + phaseVec(-0.17, 0.29) + vec2f(seedOffset + 9.1, 6.4))
			- 0.5
	) * amount;
}

fn bandField(coord: f32, spacing: f32, width: f32) -> f32 {
	var centered: f32 = abs(fract(coord / spacing) - 0.5) * spacing;
	return 1.0 - smoothstep(width, width * 3.8, centered);
}

fn curvedFoldField(px: vec2f, baseAngle: f32, spacing: f32, width: f32, seedOffset: f32) -> f32 {
	var angleNoise: f32 =
		(fbm(px / (spacing * 5.8) + phaseVec(0.08, -0.11) + vec2f(seedOffset, 3.1))
			- 0.5) * 1.35;
	var warped: vec2f = px + warpVec(
		px + vec2f(seedOffset * 13.0, seedOffset * 7.0),
		spacing * 5.4,
		spacing * 0.95,
		seedOffset
	);
	var q: vec2f = rotate2d(baseAngle + angleNoise) * warped;
	var phase: f32 =
		(fbm(q / (spacing * 3.4) + phaseVec(-0.14, 0.19) + vec2f(seedOffset, 8.6))
			- 0.5) * spacing * 1.3;
	var band: f32 = bandField(q.y + phase, spacing, width);
	var breakup: f32 = smoothstep(
		0.24,
		0.88,
		fbm(
			vec2f(q.x / (spacing * 2.6), q.y / (spacing * 7.5)) +
				phaseVec(0.12, 0.07) +
				vec2f(seedOffset)
		)
	);
	var softness: f32 =
		0.65 +
		fbm(q / (spacing * 8.2) + phaseVec(-0.05, 0.16) + vec2f(seedOffset, 2.3)) *
			0.35;

	return band * breakup * softness;
}

fn edgeMask(uv: vec2f) -> f32 {
	var pxFromEdge: vec2f = min(uv, vec2f(1.0) - uv) * params.size;
	var minSide: f32 = min(params.size.x, params.size.y);
	var side: f32 = 1.0 - smoothstep(0.0, minSide * 0.16, min(pxFromEdge.x, pxFromEdge.y));
	var corner: f32 = 1.0 - smoothstep(
		0.0,
		minSide * 0.23,
		length(pxFromEdge)
	);

	return clamp(side * 0.55 + corner * 0.85, 0.0, 1.0);
}

fn heightMap(uv: vec2f) -> f32 {
	var px: vec2f = uv * params.size;
	var minSide: f32 = min(params.size.x, params.size.y);
	var density: f32 = clamp(params.wrinkleDensity, 0.0, 1.0);
	var spacing: f32 = mix(minSide * 0.31, minSide * 0.13, density);
	var width: f32 = mix(minSide * 0.03, minSide * 0.013, density);

	var broadWarp: vec2f = warpVec(px, minSide * 0.42, minSide * 0.06, params.seed + 1.0);
	var detailWarp: vec2f = warpVec(px, minSide * 0.17, minSide * 0.018, params.seed + 6.0);
	var warpedPx: vec2f = px + broadWarp + detailWarp;

	var h: f32 =
		(fbm(warpedPx / (minSide * 0.26) + phaseVec(0.11, -0.09) + vec2f(params.seed * 0.17))
			- 0.5) * 0.08;
	var broadFold: f32 = curvedFoldField(warpedPx, -0.74, spacing * 1.0, width, 3.1);
	var crossFold: f32 = curvedFoldField(
		warpedPx + broadWarp * 0.7,
		0.31,
		spacing * 1.9,
		width * 1.55,
		9.7
	);
	var microFold: f32 = curvedFoldField(
		warpedPx - detailWarp * 0.6,
		1.04,
		spacing * 0.66,
		width * 0.62,
		15.3
	);
	h += broadFold * 0.22;
	h += crossFold * 0.11;
	h += microFold * 0.045;
	h +=
		(1.0 -
			abs(
				fbm(
					warpedPx / (minSide * 0.11) +
						phaseVec(-0.23, 0.27) +
						vec2f(params.seed * 0.3)
				) *
					2.0 -
					1.0
			)) * 0.018;

	var edge: f32 = edgeMask(uv) * clamp(params.edgeTension, 0.0, 1.0);
	var edgeNoise: f32 =
		fbm(warpedPx / (minSide * 0.18) + phaseVec(0.18, 0.21) + vec2f(params.seed * 0.41, 8.0));
	h += edge * (0.16 + edgeNoise * 0.11);

	return h;
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv=vec2f(input.uv.x,1.0-input.uv.y);
	if (params.amount <= 0.0) {
		return textureSampleLevel(source, sourceSampler, vec2f(vUv.x,1.0-vUv.y), 0);
	}

	var texel: vec2f = vec2f(1.0) / params.size;
	var left: f32 = heightMap(vUv - vec2f(texel.x, 0.0));
	var right: f32 = heightMap(vUv + vec2f(texel.x, 0.0));
	var down: f32 = heightMap(vUv - vec2f(0.0, texel.y));
	var up: f32 = heightMap(vUv + vec2f(0.0, texel.y));
	var gradient: vec2f = vec2f(right - left, up - down);
	var reliefScale: f32 = mix(42.0, 115.0, params.wrinkleDensity);
	var warpStrength: f32 = reliefScale * 0.32;

	var sampleOffset: vec2f = gradient * warpStrength * params.displacement * params.amount;
	var sampleUv: vec2f = clamp(vUv - sampleOffset * texel, vec2f(0.0), vec2f(1.0));
	var color: vec4f = textureSampleLevel(source, sourceSampler, vec2f(sampleUv.x,1.0-sampleUv.y), 0);

	var alpha: f32 = color.a;
	if (alpha <= 0.001) {
		return vec4f(0.0);
	}

	var rgb: vec3f = color.rgb / alpha;
	var normal: vec3f = normalize(vec3f(-gradient * reliefScale, 1.0));
	var light: vec3f = normalize(vec3f(-0.42, 0.58, 0.72));
	var halfVector: vec3f = normalize(light + vec3f(0.0, 0.0, 1.0));
	var specular: f32 = pow(max(dot(normal, halfVector), 0.0), 24.0);
	var directional: f32 = dot(gradient, normalize(vec2f(-0.45, 0.72)));
	var creaseHighlight: f32 = smoothstep(0.02, 0.07, directional);
	var creaseShadow: f32 = smoothstep(0.02, 0.07, -directional);
	var edge: f32 = edgeMask(vUv) * params.edgeTension;
	var edgeGlint: f32 = edge * smoothstep(
		0.35,
		0.95,
		fbm(vUv * params.size / 90.0 + phaseVec(0.31, -0.24) + vec2f(params.seed))
	);

	var highlight: f32 = clamp(
		(specular * 0.55 + creaseHighlight * 0.4 + edgeGlint * 0.18)
			* params.highlightIntensity
			* params.amount,
		0.0,
		1.15
	);
	var shadow: f32 = clamp((creaseShadow * 0.1 + edge * 0.06) * params.amount, 0.0, 0.25);

	rgb *= 1.0 - shadow;
	rgb += (vec3f(1.0) - rgb) * min(highlight, 1.0);
	rgb += vec3f(max(highlight - 1.0, 0.0)) * 0.35;

	return vec4f(clamp(rgb, vec3f(0.0), vec3f(1.0)) * alpha, alpha);
}

`;

// src/shrinkwrap.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals;
var DEFAULT_AMOUNT = 1;
var DEFAULT_DISPLACEMENT = 5;
var DEFAULT_HIGHLIGHT_INTENSITY = 0.75;
var DEFAULT_WRINKLE_DENSITY = 0.42;
var DEFAULT_EDGE_TENSION = 0.45;
var DEFAULT_PHASE = 0;
var DEFAULT_SEED = 0;
var shrinkwrapSchema = {
  amount: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_AMOUNT,
    description: "Amount",
    hiddenFromList: false
  },
  displacement: {
    type: "number",
    min: 0,
    max: 30,
    step: 0.1,
    default: DEFAULT_DISPLACEMENT,
    description: "Displacement",
    hiddenFromList: false
  },
  highlightIntensity: {
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: DEFAULT_HIGHLIGHT_INTENSITY,
    description: "Highlight intensity",
    hiddenFromList: false
  },
  wrinkleDensity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_WRINKLE_DENSITY,
    description: "Wrinkle density",
    hiddenFromList: false
  },
  edgeTension: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_EDGE_TENSION,
    description: "Edge tension",
    hiddenFromList: false
  },
  phase: {
    type: "number",
    step: 0.01,
    default: DEFAULT_PHASE,
    description: "Phase",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    step: 1,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  amount: p.amount ?? DEFAULT_AMOUNT,
  displacement: p.displacement ?? DEFAULT_DISPLACEMENT,
  highlightIntensity: p.highlightIntensity ?? DEFAULT_HIGHLIGHT_INTENSITY,
  wrinkleDensity: p.wrinkleDensity ?? DEFAULT_WRINKLE_DENSITY,
  edgeTension: p.edgeTension ?? DEFAULT_EDGE_TENSION,
  phase: p.phase ?? DEFAULT_PHASE,
  seed: p.seed ?? DEFAULT_SEED
});
var validateShrinkwrapParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Shrinkwrap");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.displacement, "displacement");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.highlightIntensity, "highlightIntensity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.wrinkleDensity, "wrinkleDensity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.edgeTension, "edgeTension");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.phase, "phase");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.amount, "amount");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.displacement, "displacement");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateNonNegative */ .XP)(r.highlightIntensity, "highlightIntensity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.wrinkleDensity, "wrinkleDensity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.edgeTension, "edgeTension");
};
var SHRINKWRAP_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var SHRINKWRAP_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uDisplacement;
uniform float uHighlightIntensity;
uniform float uWrinkleDensity;
uniform float uEdgeTension;
uniform float uPhase;
uniform float uSeed;

float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
	p3 += dot(p3, p3.yzx + 19.19 + uSeed * 0.131);
	return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));

	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;

	for (int i = 0; i < 4; i++) {
		value += valueNoise(p) * amplitude;
		p = p * 2.03 + vec2(17.1, 31.7);
		amplitude *= 0.5;
	}

	return value;
}

mat2 rotate2d(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat2(c, -s, s, c);
}

vec2 phaseVec(float xFactor, float yFactor) {
	return vec2(uPhase * xFactor, uPhase * yFactor);
}

vec2 warpVec(vec2 p, float scale, float amount, float seedOffset) {
	return vec2(
		fbm(p / scale + phaseVec(0.21, 0.13) + vec2(seedOffset, 1.7)) - 0.5,
		fbm(p / scale + phaseVec(-0.17, 0.29) + vec2(seedOffset + 9.1, 6.4))
			- 0.5
	) * amount;
}

float bandField(float coord, float spacing, float width) {
	float centered = abs(fract(coord / spacing) - 0.5) * spacing;
	return 1.0 - smoothstep(width, width * 3.8, centered);
}

float curvedFoldField(
	vec2 px,
	float baseAngle,
	float spacing,
	float width,
	float seedOffset
) {
	float angleNoise =
		(fbm(px / (spacing * 5.8) + phaseVec(0.08, -0.11) + vec2(seedOffset, 3.1))
			- 0.5) * 1.35;
	vec2 warped = px + warpVec(
		px + vec2(seedOffset * 13.0, seedOffset * 7.0),
		spacing * 5.4,
		spacing * 0.95,
		seedOffset
	);
	vec2 q = rotate2d(baseAngle + angleNoise) * warped;
	float phase =
		(fbm(q / (spacing * 3.4) + phaseVec(-0.14, 0.19) + vec2(seedOffset, 8.6))
			- 0.5) * spacing * 1.3;
	float band = bandField(q.y + phase, spacing, width);
	float breakup = smoothstep(
		0.24,
		0.88,
		fbm(
			vec2(q.x / (spacing * 2.6), q.y / (spacing * 7.5)) +
				phaseVec(0.12, 0.07) +
				vec2(seedOffset)
		)
	);
	float softness =
		0.65 +
		fbm(q / (spacing * 8.2) + phaseVec(-0.05, 0.16) + vec2(seedOffset, 2.3)) *
			0.35;

	return band * breakup * softness;
}

float edgeMask(vec2 uv) {
	vec2 pxFromEdge = min(uv, 1.0 - uv) * uResolution;
	float minSide = min(uResolution.x, uResolution.y);
	float side = 1.0 - smoothstep(0.0, minSide * 0.16, min(pxFromEdge.x, pxFromEdge.y));
	float corner = 1.0 - smoothstep(
		0.0,
		minSide * 0.23,
		length(pxFromEdge)
	);

	return clamp(side * 0.55 + corner * 0.85, 0.0, 1.0);
}

float heightMap(vec2 uv) {
	vec2 px = uv * uResolution;
	float minSide = min(uResolution.x, uResolution.y);
	float density = clamp(uWrinkleDensity, 0.0, 1.0);
	float spacing = mix(minSide * 0.31, minSide * 0.13, density);
	float width = mix(minSide * 0.03, minSide * 0.013, density);

	vec2 broadWarp = warpVec(px, minSide * 0.42, minSide * 0.06, uSeed + 1.0);
	vec2 detailWarp = warpVec(px, minSide * 0.17, minSide * 0.018, uSeed + 6.0);
	vec2 warpedPx = px + broadWarp + detailWarp;

	float h =
		(fbm(warpedPx / (minSide * 0.26) + phaseVec(0.11, -0.09) + vec2(uSeed * 0.17))
			- 0.5) * 0.08;
	float broadFold = curvedFoldField(warpedPx, -0.74, spacing * 1.0, width, 3.1);
	float crossFold = curvedFoldField(
		warpedPx + broadWarp * 0.7,
		0.31,
		spacing * 1.9,
		width * 1.55,
		9.7
	);
	float microFold = curvedFoldField(
		warpedPx - detailWarp * 0.6,
		1.04,
		spacing * 0.66,
		width * 0.62,
		15.3
	);
	h += broadFold * 0.22;
	h += crossFold * 0.11;
	h += microFold * 0.045;
	h +=
		(1.0 -
			abs(
				fbm(
					warpedPx / (minSide * 0.11) +
						phaseVec(-0.23, 0.27) +
						vec2(uSeed * 0.3)
				) *
					2.0 -
					1.0
			)) * 0.018;

	float edge = edgeMask(uv) * clamp(uEdgeTension, 0.0, 1.0);
	float edgeNoise =
		fbm(warpedPx / (minSide * 0.18) + phaseVec(0.18, 0.21) + vec2(uSeed * 0.41, 8.0));
	h += edge * (0.16 + edgeNoise * 0.11);

	return h;
}

void main() {
	if (uAmount <= 0.0) {
		fragColor = texture(uSource, vUv);
		return;
	}

	vec2 texel = 1.0 / uResolution;
	float left = heightMap(vUv - vec2(texel.x, 0.0));
	float right = heightMap(vUv + vec2(texel.x, 0.0));
	float down = heightMap(vUv - vec2(0.0, texel.y));
	float up = heightMap(vUv + vec2(0.0, texel.y));
	vec2 gradient = vec2(right - left, up - down);
	float reliefScale = mix(42.0, 115.0, uWrinkleDensity);
	float warpStrength = reliefScale * 0.32;

	vec2 sampleOffset = gradient * warpStrength * uDisplacement * uAmount;
	vec2 sampleUv = clamp(vUv - sampleOffset * texel, vec2(0.0), vec2(1.0));
	vec4 source = texture(uSource, sampleUv);

	float alpha = source.a;
	if (alpha <= 0.001) {
		fragColor = vec4(0.0);
		return;
	}

	vec3 rgb = source.rgb / alpha;
	vec3 normal = normalize(vec3(-gradient * reliefScale, 1.0));
	vec3 light = normalize(vec3(-0.42, 0.58, 0.72));
	vec3 halfVector = normalize(light + vec3(0.0, 0.0, 1.0));
	float specular = pow(max(dot(normal, halfVector), 0.0), 24.0);
	float directional = dot(gradient, normalize(vec2(-0.45, 0.72)));
	float creaseHighlight = smoothstep(0.02, 0.07, directional);
	float creaseShadow = smoothstep(0.02, 0.07, -directional);
	float edge = edgeMask(vUv) * uEdgeTension;
	float edgeGlint = edge * smoothstep(
		0.35,
		0.95,
		fbm(vUv * uResolution / 90.0 + phaseVec(0.31, -0.24) + vec2(uSeed))
	);

	float highlight = clamp(
		(specular * 0.55 + creaseHighlight * 0.4 + edgeGlint * 0.18)
			* uHighlightIntensity
			* uAmount,
		0.0,
		1.15
	);
	float shadow = clamp((creaseShadow * 0.1 + edge * 0.06) * uAmount, 0.0, 0.25);

	rgb *= 1.0 - shadow;
	rgb += (1.0 - rgb) * min(highlight, 1.0);
	rgb += vec3(max(highlight - 1.0, 0.0)) * 0.35;

	fragColor = vec4(clamp(rgb, 0.0, 1.0) * alpha, alpha);
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
    throw new Error(`Shrinkwrap shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Shrinkwrap program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var shrinkwrap = createEffect({
  type: "dev.remotion.effects.shrinkwrap",
  label: "shrinkwrap()",
  documentationLink: "https://www.remotion.dev/docs/effects/shrinkwrap",
  calculateKey: (params) => {
    const r = resolve(params);
    return `shrinkwrap-${r.amount}-${r.displacement}-${r.highlightIntensity}-${r.wrinkleDensity}-${r.edgeTension}-${r.phase}-${r.seed}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "shrinkwrap"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the shrinkwrap effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          width,
          height,
          r.amount,
          r.displacement,
          r.highlightIntensity,
          r.wrinkleDensity,
          r.edgeTension,
          r.phase,
          r.seed,
          0,
          0,
          0
        ]);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: SHRINKWRAP_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("shrinkwrap effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, SHRINKWRAP_VS);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, SHRINKWRAP_FS);
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
          uAmount: gl.getUniformLocation(program, "uAmount"),
          uDisplacement: gl.getUniformLocation(program, "uDisplacement"),
          uHighlightIntensity: gl.getUniformLocation(program, "uHighlightIntensity"),
          uWrinkleDensity: gl.getUniformLocation(program, "uWrinkleDensity"),
          uEdgeTension: gl.getUniformLocation(program, "uEdgeTension"),
          uPhase: gl.getUniformLocation(program, "uPhase"),
          uSeed: gl.getUniformLocation(program, "uSeed")
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, texture } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (state.uSource)
          gl.uniform1i(state.uSource, 0);
        if (state.uResolution)
          gl.uniform2f(state.uResolution, width, height);
        if (state.uAmount)
          gl.uniform1f(state.uAmount, r.amount);
        if (state.uDisplacement)
          gl.uniform1f(state.uDisplacement, r.displacement);
        if (state.uHighlightIntensity)
          gl.uniform1f(state.uHighlightIntensity, r.highlightIntensity);
        if (state.uWrinkleDensity)
          gl.uniform1f(state.uWrinkleDensity, r.wrinkleDensity);
        if (state.uEdgeTension)
          gl.uniform1f(state.uEdgeTension, r.edgeTension);
        if (state.uPhase)
          gl.uniform1f(state.uPhase, r.phase);
        if (state.uSeed)
          gl.uniform1f(state.uSeed, r.seed);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
        gl.deleteTexture(texture);
      }
    })
  },
  schema: shrinkwrapSchema,
  validateParams: validateShrinkwrapParams
});



/***/ }

}]);
//# sourceMappingURL=8174.bundle.js.map