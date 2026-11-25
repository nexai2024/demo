"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[8503],{

/***/ 8503
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   colorCorrection: () => (/* binding */ colorCorrection)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(22);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/color-correction.ts

var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_EXPOSURE = 0;
var DEFAULT_CONTRAST = 1;
var DEFAULT_PIVOT = 0.5;
var DEFAULT_SHADOWS = 0;
var DEFAULT_HIGHLIGHTS = 0;
var DEFAULT_WHITES = 0;
var DEFAULT_BLACKS = 0;
var DEFAULT_TEMPERATURE = 0;
var DEFAULT_TINT = 0;
var DEFAULT_SATURATION = 1;
var DEFAULT_VIBRANCE = 0;
var MIN_EXPOSURE = -5;
var MAX_EXPOSURE = 5;
var signedAdjustmentSchema = (description) => ({
  type: "number",
  min: -1,
  max: 1,
  step: 0.01,
  default: 0,
  description,
  hiddenFromList: false
});
var colorCorrectionSchema = {
  exposure: {
    type: "number",
    min: MIN_EXPOSURE,
    max: MAX_EXPOSURE,
    step: 0.1,
    default: DEFAULT_EXPOSURE,
    description: "Exposure",
    hiddenFromList: false
  },
  contrast: {
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: DEFAULT_CONTRAST,
    description: "Contrast",
    hiddenFromList: false
  },
  pivot: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_PIVOT,
    description: "Contrast pivot",
    hiddenFromList: false
  },
  shadows: signedAdjustmentSchema("Shadows"),
  highlights: signedAdjustmentSchema("Highlights"),
  whites: signedAdjustmentSchema("Whites"),
  blacks: signedAdjustmentSchema("Blacks"),
  temperature: signedAdjustmentSchema("Temperature"),
  tint: signedAdjustmentSchema("Tint"),
  saturation: {
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: DEFAULT_SATURATION,
    description: "Saturation",
    hiddenFromList: false
  },
  vibrance: signedAdjustmentSchema("Vibrance")
};
var resolve = (params) => ({
  exposure: params.exposure ?? DEFAULT_EXPOSURE,
  contrast: params.contrast ?? DEFAULT_CONTRAST,
  pivot: params.pivot ?? DEFAULT_PIVOT,
  shadows: params.shadows ?? DEFAULT_SHADOWS,
  highlights: params.highlights ?? DEFAULT_HIGHLIGHTS,
  whites: params.whites ?? DEFAULT_WHITES,
  blacks: params.blacks ?? DEFAULT_BLACKS,
  temperature: params.temperature ?? DEFAULT_TEMPERATURE,
  tint: params.tint ?? DEFAULT_TINT,
  saturation: params.saturation ?? DEFAULT_SATURATION,
  vibrance: params.vibrance ?? DEFAULT_VIBRANCE
});
var validateColorCorrectionParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Color correction");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.exposure, "exposure");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.contrast, "contrast");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.pivot, "pivot");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.shadows, "shadows");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.highlights, "highlights");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.whites, "whites");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.blacks, "blacks");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.temperature, "temperature");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.tint, "tint");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.saturation, "saturation");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.vibrance, "vibrance");
  const resolved = resolve(params);
  if (resolved.exposure < MIN_EXPOSURE) {
    throw new TypeError(`"exposure" must be >= ${MIN_EXPOSURE}, but got ${JSON.stringify(resolved.exposure)}`);
  }
  if (resolved.exposure > MAX_EXPOSURE) {
    throw new TypeError(`"exposure" must be <= ${MAX_EXPOSURE}, but got ${JSON.stringify(resolved.exposure)}`);
  }
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(resolved.contrast, "contrast");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(resolved.pivot, "pivot");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.shadows, "shadows");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.highlights, "highlights");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.whites, "whites");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.blacks, "blacks");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.temperature, "temperature");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.tint, "tint");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(resolved.saturation, "saturation");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateSignedUnitInterval */ .cz)(resolved.vibrance, "vibrance");
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
var FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform float uExposure;
uniform float uContrast;
uniform float uPivot;
uniform float uShadows;
uniform float uHighlights;
uniform float uWhites;
uniform float uBlacks;
uniform float uTemperature;
uniform float uTint;
uniform float uSaturation;
uniform float uVibrance;

${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .COLOR_SPACE_GLSL */ .q9}
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WHITE_BALANCE_GLSL */ .kK}
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .SHADOWS_HIGHLIGHTS_GLSL */ .ZZ}
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .VIBRANCE_GLSL */ .cF}

vec3 applyEndpointTones(vec3 color, float blacks, float whites) {
	float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
	float blackWeight = 1.0 - smoothstep(0.0, 0.35, luminance);
	float whiteWeight = smoothstep(0.65, 1.0, luminance);
	blackWeight *= blackWeight;
	whiteWeight *= whiteWeight;

	// Moving tones toward their named endpoint uses the full adjustment.
	// Moving them away is damped to avoid flattening the image too aggressively.
	if (blacks >= 0.0) {
		color += (vec3(1.0) - color) * blacks * blackWeight * 0.2;
	} else {
		color *= 1.0 + blacks * blackWeight;
	}

	if (whites >= 0.0) {
		color += (vec3(1.0) - color) * whites * whiteWeight;
	} else {
		color *= 1.0 + whites * whiteWeight * 0.2;
	}

	return clamp(color, 0.0, 1.0);
}

void main() {
	vec4 sourceColor = texture(uSource, vUv);
	float alpha = sourceColor.a;

	if (alpha <= 0.0) {
		fragColor = vec4(0.0);
		return;
	}

	if (
		uExposure == 0.0 &&
		uContrast == 1.0 &&
		uPivot == 0.5 &&
		uShadows == 0.0 &&
		uHighlights == 0.0 &&
		uWhites == 0.0 &&
		uBlacks == 0.0 &&
		uTemperature == 0.0 &&
		uTint == 0.0 &&
		uSaturation == 1.0 &&
		uVibrance == 0.0
	) {
		fragColor = sourceColor;
		return;
	}

	vec3 color = sourceColor.rgb / alpha;
	vec3 linear = srgbToLinear(color) * exp2(uExposure);
	linear = applyWhiteBalanceLinear(linear, uTemperature, uTint);
	color = linearToSrgb(linear);

	float tonalStops = getShadowsHighlightsStops(
		color,
		uShadows,
		uHighlights
	);
	linear = srgbToLinear(color) * exp2(tonalStops);
	color = linearToSrgb(linear);
	color = applyEndpointTones(color, uBlacks, uWhites);
	color = clamp((color - vec3(uPivot)) * uContrast + vec3(uPivot), 0.0, 1.0);

	float luminance = dot(color, vec3(0.213, 0.715, 0.072));
	color = clamp(
		vec3(luminance) + (color - vec3(luminance)) * uSaturation,
		0.0,
		1.0
	);
	color = applyVibrance(color, uVibrance);

	fragColor = vec4(color * alpha, alpha);
}
`;
var WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
struct Params {
	exposure: f32,
	contrast: f32,
	pivot: f32,
	shadows: f32,
	highlights: f32,
	whites: f32,
	blacks: f32,
	temperature: f32,
	tint: f32,
	saturation: f32,
	vibrance: f32,
	padding0: f32,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .COLOR_SPACE_WGSL */ .h3}
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WHITE_BALANCE_WGSL */ .Zt}
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .SHADOWS_HIGHLIGHTS_WGSL */ .eT}
${_index_6jkps947_mjs__WEBPACK_IMPORTED_MODULE_1__/* .VIBRANCE_WGSL */ .PN}

fn applyEndpointTones(inputColor: vec3f, blacks: f32, whites: f32) -> vec3f {
	var color = inputColor;
	let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
	var blackWeight = 1.0 - smoothstep(0.0, 0.35, luminance);
	var whiteWeight = smoothstep(0.65, 1.0, luminance);
	blackWeight *= blackWeight;
	whiteWeight *= whiteWeight;
	if (blacks >= 0.0) {
		color += (vec3f(1.0) - color) * blacks * blackWeight * 0.2;
	} else {
		color *= 1.0 + blacks * blackWeight;
	}
	if (whites >= 0.0) {
		color += (vec3f(1.0) - color) * whites * whiteWeight;
	} else {
		color *= 1.0 + whites * whiteWeight * 0.2;
	}
	return clamp(color, vec3f(0.0), vec3f(1.0));
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
	let sourceColor = textureSampleLevel(source, sourceSampler, input.uv, 0.0);
	let alpha = sourceColor.a;
	if (alpha <= 0.0) {
		return vec4f(0.0);
	}
	if (
		params.exposure == 0.0 && params.contrast == 1.0 && params.pivot == 0.5 &&
		params.shadows == 0.0 && params.highlights == 0.0 && params.whites == 0.0 &&
		params.blacks == 0.0 && params.temperature == 0.0 && params.tint == 0.0 &&
		params.saturation == 1.0 && params.vibrance == 0.0
	) {
		return sourceColor;
	}
	var color = sourceColor.rgb / alpha;
	var linear = srgbToLinear(color) * exp2(params.exposure);
	linear = applyWhiteBalanceLinear(linear, params.temperature, params.tint);
	color = linearToSrgb(linear);
	let tonalStops = getShadowsHighlightsStops(color, params.shadows, params.highlights);
	linear = srgbToLinear(color) * exp2(tonalStops);
	color = linearToSrgb(linear);
	color = applyEndpointTones(color, params.blacks, params.whites);
	color = clamp((color - vec3f(params.pivot)) * params.contrast + vec3f(params.pivot), vec3f(0.0), vec3f(1.0));
	let luminance = dot(color, vec3f(0.213, 0.715, 0.072));
	color = clamp(vec3f(luminance) + (color - vec3f(luminance)) * params.saturation, vec3f(0.0), vec3f(1.0));
	color = applyVibrance(color, params.vibrance);
	return vec4f(color * alpha, alpha);
}
`;
var compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create color correction shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Color correction shader compile failed: ${log ?? "(no log)"}`);
  }
  return shader;
};
var createProgram = (gl) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create color correction shader program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Color correction shader link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createTexture = (gl) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create color correction texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
};
var setupColorCorrection = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("color correction effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create color correction vertex array");
  }
  const vbo = gl.createBuffer();
  if (!vbo) {
    throw new Error("Failed to create color correction vertex buffer");
  }
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  const aUv = gl.getAttribLocation(program, "aUv");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  return {
    gl,
    program,
    vao,
    vbo,
    textureSource: createTexture(gl),
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uExposure: gl.getUniformLocation(program, "uExposure"),
      uContrast: gl.getUniformLocation(program, "uContrast"),
      uPivot: gl.getUniformLocation(program, "uPivot"),
      uShadows: gl.getUniformLocation(program, "uShadows"),
      uHighlights: gl.getUniformLocation(program, "uHighlights"),
      uWhites: gl.getUniformLocation(program, "uWhites"),
      uBlacks: gl.getUniformLocation(program, "uBlacks"),
      uTemperature: gl.getUniformLocation(program, "uTemperature"),
      uTint: gl.getUniformLocation(program, "uTint"),
      uSaturation: gl.getUniformLocation(program, "uSaturation"),
      uVibrance: gl.getUniformLocation(program, "uVibrance")
    }
  };
};
var colorCorrection = createEffect({
  type: "remotion/color-correction",
  label: "colorCorrection()",
  documentationLink: "https://www.remotion.dev/docs/effects/color-correction",
  calculateKey: (params) => {
    const r = resolve(params);
    return `color-correction-${r.exposure}-${r.contrast}-${r.pivot}-${r.shadows}-${r.highlights}-${r.whites}-${r.blacks}-${r.temperature}-${r.tint}-${r.saturation}-${r.vibrance}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "color correction"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice) {
          throw new Error("A WebGPU device is required for the color correction effect");
        }
        const r = resolve(params);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: WEBGPU_SHADER,
          uniformData: new Float32Array([
            r.exposure,
            r.contrast,
            r.pivot,
            r.shadows,
            r.highlights,
            r.whites,
            r.blacks,
            r.temperature,
            r.tint,
            r.saturation,
            r.vibrance,
            0
          ])
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: setupColorCorrection,
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, textureSource, uniforms, vao } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureSource);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.useProgram(program);
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uExposure)
          gl.uniform1f(uniforms.uExposure, r.exposure);
        if (uniforms.uContrast)
          gl.uniform1f(uniforms.uContrast, r.contrast);
        if (uniforms.uPivot)
          gl.uniform1f(uniforms.uPivot, r.pivot);
        if (uniforms.uShadows)
          gl.uniform1f(uniforms.uShadows, r.shadows);
        if (uniforms.uHighlights) {
          gl.uniform1f(uniforms.uHighlights, r.highlights);
        }
        if (uniforms.uWhites)
          gl.uniform1f(uniforms.uWhites, r.whites);
        if (uniforms.uBlacks)
          gl.uniform1f(uniforms.uBlacks, r.blacks);
        if (uniforms.uTemperature) {
          gl.uniform1f(uniforms.uTemperature, r.temperature);
        }
        if (uniforms.uTint)
          gl.uniform1f(uniforms.uTint, r.tint);
        if (uniforms.uSaturation) {
          gl.uniform1f(uniforms.uSaturation, r.saturation);
        }
        if (uniforms.uVibrance)
          gl.uniform1f(uniforms.uVibrance, r.vibrance);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, textureSource }) => {
        gl.deleteTexture(textureSource);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: colorCorrectionSchema,
  validateParams: validateColorCorrectionParams
});



/***/ },

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

/***/ 22
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PN: () => (/* binding */ VIBRANCE_WGSL),
/* harmony export */   ZZ: () => (/* binding */ SHADOWS_HIGHLIGHTS_GLSL),
/* harmony export */   Zt: () => (/* binding */ WHITE_BALANCE_WGSL),
/* harmony export */   cF: () => (/* binding */ VIBRANCE_GLSL),
/* harmony export */   eT: () => (/* binding */ SHADOWS_HIGHLIGHTS_WGSL),
/* harmony export */   h3: () => (/* binding */ COLOR_SPACE_WGSL),
/* harmony export */   kK: () => (/* binding */ WHITE_BALANCE_GLSL),
/* harmony export */   q9: () => (/* binding */ COLOR_SPACE_GLSL)
/* harmony export */ });
// src/color-correction-shader-utils.ts
var COLOR_SPACE_GLSL = `
vec3 srgbToLinear(vec3 color) {
	vec3 lower = color / 12.92;
	vec3 upper = pow((color + 0.055) / 1.055, vec3(2.4));
	return mix(lower, upper, step(vec3(0.04045), color));
}

vec3 linearToSrgb(vec3 color) {
	vec3 nonNegative = max(color, vec3(0.0));
	vec3 lower = nonNegative * 12.92;
	vec3 upper = 1.055 * pow(nonNegative, vec3(1.0 / 2.4)) - 0.055;
	return mix(lower, upper, step(vec3(0.0031308), nonNegative));
}
`;
var WHITE_BALANCE_GLSL = `
vec3 applyWhiteBalanceLinear(vec3 linear, float temperature, float tint) {
	vec3 temperatureOffset = vec3(0.3, 0.0, -0.3) * temperature;
	vec3 tintOffset = vec3(0.15, -0.3, 0.15) * tint;
	vec3 gains = exp2(temperatureOffset + tintOffset);
	float luminanceGain = dot(gains, vec3(0.2126, 0.7152, 0.0722));
	return linear * gains / luminanceGain;
}
`;
var SHADOWS_HIGHLIGHTS_GLSL = `
float getShadowsHighlightsStops(
	vec3 color,
	float shadows,
	float highlights
) {
	float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
	float shadowWeight = 1.0 - smoothstep(0.0, 0.6, luminance);
	float highlightWeight = smoothstep(0.4, 1.0, luminance);
	shadowWeight *= shadowWeight;
	highlightWeight *= highlightWeight;
	return shadows * shadowWeight + highlights * highlightWeight;
}
`;
var VIBRANCE_GLSL = `
vec3 applyVibrance(vec3 color, float amount) {
	float maximum = max(max(color.r, color.g), color.b);
	float minimum = min(min(color.r, color.g), color.b);
	float lightness = (maximum + minimum) * 0.5;
	float chroma = maximum - minimum;
	float saturationDenominator = 1.0 - abs(2.0 * lightness - 1.0);
	float saturation = saturationDenominator <= 0.0
		? 0.0
		: chroma / saturationDenominator;

	if (saturation <= 0.000001) {
		return color;
	}

	float targetSaturation = amount >= 0.0
		? saturation + amount * (1.0 - saturation)
		: saturation * (1.0 + amount);
	return clamp(
		vec3(lightness) +
			(color - vec3(lightness)) * (targetSaturation / saturation),
		0.0,
		1.0
	);
}
`;

// src/color-correction-webgpu-shader-utils.ts
var COLOR_SPACE_WGSL = `
fn srgbToLinear(color: vec3f) -> vec3f {
	let lower = color / 12.92;
	let upper = pow((color + 0.055) / 1.055, vec3f(2.4));
	return mix(lower, upper, step(vec3f(0.04045), color));
}

fn linearToSrgb(color: vec3f) -> vec3f {
	let nonNegative = max(color, vec3f(0.0));
	let lower = nonNegative * 12.92;
	let upper = 1.055 * pow(nonNegative, vec3f(1.0 / 2.4)) - 0.055;
	return mix(lower, upper, step(vec3f(0.0031308), nonNegative));
}
`;
var WHITE_BALANCE_WGSL = `
fn applyWhiteBalanceLinear(linear: vec3f, temperature: f32, tint: f32) -> vec3f {
	let temperatureOffset = vec3f(0.3, 0.0, -0.3) * temperature;
	let tintOffset = vec3f(0.15, -0.3, 0.15) * tint;
	let gains = exp2(temperatureOffset + tintOffset);
	let luminanceGain = dot(gains, vec3f(0.2126, 0.7152, 0.0722));
	return linear * gains / luminanceGain;
}
`;
var SHADOWS_HIGHLIGHTS_WGSL = `
fn getShadowsHighlightsStops(color: vec3f, shadows: f32, highlights: f32) -> f32 {
	let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
	let shadowWeight = 1.0 - smoothstep(0.0, 0.6, luminance);
	let highlightWeight = smoothstep(0.4, 1.0, luminance);
	return shadows * shadowWeight * shadowWeight + highlights * highlightWeight * highlightWeight;
}
`;
var VIBRANCE_WGSL = `
fn applyVibrance(color: vec3f, amount: f32) -> vec3f {
	let maximum = max(max(color.r, color.g), color.b);
	let minimum = min(min(color.r, color.g), color.b);
	let lightness = (maximum + minimum) * 0.5;
	let chroma = maximum - minimum;
	let saturationDenominator = 1.0 - abs(2.0 * lightness - 1.0);
	var saturation = 0.0;
	if (saturationDenominator > 0.0) {
		saturation = chroma / saturationDenominator;
	}
	if (saturation <= 0.000001) {
		return color;
	}
	var targetSaturation = saturation * (1.0 + amount);
	if (amount >= 0.0) {
		targetSaturation = saturation + amount * (1.0 - saturation);
	}
	return clamp(vec3f(lightness) + (color - vec3f(lightness)) * (targetSaturation / saturation), vec3f(0.0), vec3f(1.0));
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




/***/ }

}]);
//# sourceMappingURL=8503.bundle.js.map