"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[2287],{

/***/ 2287
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   contourLines: () => (/* binding */ contourLines),
/* harmony export */   contourLinesSchema: () => (/* binding */ contourLinesSchema)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(7525);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/contour-lines.ts


// src/contour-lines-webgpu-shader.ts
var CONTOUR_LINES_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {
 geometry: vec4f,
 noise: vec4f,
 offset: vec4f,
 lineColor: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}

fn hash(p: vec2f) -> f32 {
 var p3 = fract(p.xyx * 0.1031);
 p3 += vec3f(dot(p3, p3.yzx + vec3f(33.33) + vec3f(params.noise.z * 0.013)));
 return fract((p3.x + p3.y) * p3.z);
}
fn valueNoise(p: vec2f) -> f32 {
 let i = floor(p);
 let f = fract(p);
 let u = f * f * f * (f * (f * 6.0 - vec2f(15.0)) + vec2f(10.0));
 return mix(mix(hash(i), hash(i + vec2f(1, 0)), u.x), mix(hash(i + vec2f(0, 1)), hash(i + vec2f(1)), u.x), u.y);
}

fn fbm(position: vec2f) -> f32 {
 var p = position;
 var value = 0.0;
 var amplitude = 0.5;
 var totalAmplitude = 0.0;
 let persistence = mix(0.18, 0.58, clamp(params.noise.x, 0.0, 1.0));
 let smoothness = clamp(params.noise.y, 0.0, 1.0);
 let rotate = mat2x2f(0.80, 0.60, -0.60, 0.80);
 for (var i = 0; i < 5; i++) {
  let octave = f32(i) / 4.0;
  let detailWeight = mix(1.0, 1.0 - smoothstep(0.15, 1.0, octave), smoothness);
  value += amplitude * detailWeight * valueNoise(p);
  totalAmplitude += amplitude * detailWeight;
  p = rotate * p * 2.04 + vec2f(13.17, 7.31);
  amplitude *= persistence;
 }
 return value / totalAmplitude;
}

fn contourAt(pixel: vec2f) -> f32 {
 let pixelPosition = pixel + params.offset.xy;
 let scale = max(params.geometry.w, 0.001);
 let p = pixelPosition / scale + vec2f(params.noise.z * 0.137, params.noise.z * 0.193);
 let complexity = clamp(params.noise.x, 0.0, 1.0);
 let smoothness = clamp(params.noise.y, 0.0, 1.0);
 let warp = vec2f(fbm(p + vec2f(5.2, 1.3)), fbm(p + vec2f(1.7, 9.2))) - vec2f(0.5);
 let terrain = fbm(p + warp * complexity * mix(2.8, 1.2, smoothness));
 let levels = max(max(params.geometry.x, params.geometry.y) / (max(params.geometry.z, 0.001) * 2.0), 1.0);
 return terrain * levels;

}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 let texColor = sampleSource(vUv);
 let pixel = vec2f(input.position.x, params.geometry.y - input.position.y);
 let contourPosition = contourAt(pixel);
 let contourFraction = fract(contourPosition);
 let distanceToContour = min(contourFraction, 1.0 - contourFraction);
 var derivative = fwidth(contourPosition);
 if (i32(params.geometry.y) % 2 != 0) {
  // WebGL derivative quads start at the bottom edge. Odd-height targets shift
  // WebGPU's top-origin Y pairs, so evaluate the matching vertical neighbor.
  let neighborY = select(-1.0, 1.0, i32(pixel.y) % 2 == 0);
  derivative = abs(dpdx(contourPosition)) + abs(contourAt(pixel + vec2f(0, neighborY)) - contourPosition);
 }
 derivative = max(derivative, 0.0001);
 let halfLineWidth = max(params.noise.w, 0.001) * 0.5 * derivative;
 let coverage = 1.0 - smoothstep(halfLineWidth, halfLineWidth + derivative, distanceToContour);
 let lineAlpha = params.lineColor.a * params.offset.z * coverage;
 let premultipliedLine = params.lineColor.rgb * lineAlpha;
 if (params.offset.w != 0.0) { return vec4f(premultipliedLine * texColor.a + texColor.rgb * (1.0 - lineAlpha), texColor.a); }
 return vec4f(premultipliedLine + texColor.rgb * (1.0 - lineAlpha), lineAlpha + texColor.a * (1.0 - lineAlpha));

}
`;

// src/contour-lines.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_LINE_COLOR = "#ffffff";
var DEFAULT_LINE_WIDTH = 1.5;
var DEFAULT_SPACING = 36;
var DEFAULT_SCALE = 220;
var DEFAULT_COMPLEXITY = 0.65;
var DEFAULT_SMOOTHNESS = 0.55;
var DEFAULT_SEED = 0;
var DEFAULT_OFFSET_X = 0;
var DEFAULT_OFFSET_Y = 0;
var DEFAULT_OPACITY = 1;
var DEFAULT_MASK_TO_SOURCE_ALPHA = false;
var contourLinesSchema = {
  lineColor: {
    type: "color",
    default: DEFAULT_LINE_COLOR,
    description: "Line color"
  },
  lineWidth: {
    type: "number",
    min: 0.1,
    max: 20,
    step: 0.1,
    default: DEFAULT_LINE_WIDTH,
    description: "Line width",
    hiddenFromList: false
  },
  spacing: {
    type: "number",
    min: 1,
    max: 200,
    step: 1,
    default: DEFAULT_SPACING,
    description: "Spacing",
    hiddenFromList: false
  },
  scale: {
    type: "number",
    min: 20,
    max: 1000,
    step: 1,
    default: DEFAULT_SCALE,
    description: "Scale",
    hiddenFromList: false
  },
  complexity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_COMPLEXITY,
    description: "Complexity",
    hiddenFromList: false
  },
  smoothness: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_SMOOTHNESS,
    description: "Smoothness",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    step: 1,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  },
  offsetX: {
    type: "number",
    step: 0.1,
    default: DEFAULT_OFFSET_X,
    description: "Offset X",
    hiddenFromList: false
  },
  offsetY: {
    type: "number",
    step: 0.1,
    default: DEFAULT_OFFSET_Y,
    description: "Offset Y",
    hiddenFromList: false
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
  maskToSourceAlpha: {
    type: "boolean",
    default: DEFAULT_MASK_TO_SOURCE_ALPHA,
    description: "Mask to source alpha"
  }
};
var resolve = (p) => ({
  lineColor: p.lineColor ?? DEFAULT_LINE_COLOR,
  lineWidth: p.lineWidth ?? DEFAULT_LINE_WIDTH,
  spacing: p.spacing ?? DEFAULT_SPACING,
  scale: p.scale ?? DEFAULT_SCALE,
  complexity: p.complexity ?? DEFAULT_COMPLEXITY,
  smoothness: p.smoothness ?? DEFAULT_SMOOTHNESS,
  seed: p.seed ?? DEFAULT_SEED,
  offsetX: p.offsetX ?? DEFAULT_OFFSET_X,
  offsetY: p.offsetY ?? DEFAULT_OFFSET_Y,
  opacity: p.opacity ?? DEFAULT_OPACITY,
  maskToSourceAlpha: p.maskToSourceAlpha ?? DEFAULT_MASK_TO_SOURCE_ALPHA
});
var validatePositive = (value, name) => {
  if (value <= 0) {
    throw new TypeError(`"${name}" must be greater than 0, but got ${JSON.stringify(value)}`);
  }
};
var validateContourLinesParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Contour lines");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)(params.lineColor, "lineColor");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.lineWidth, "lineWidth");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.spacing, "spacing");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.scale, "scale");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.complexity, "complexity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.smoothness, "smoothness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.offsetX, "offsetX");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.offsetY, "offsetY");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.opacity, "opacity");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalBoolean */ .fX)(params.maskToSourceAlpha, "maskToSourceAlpha");
  const r = resolve(params);
  validatePositive(r.lineWidth, "lineWidth");
  validatePositive(r.spacing, "spacing");
  validatePositive(r.scale, "scale");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.complexity, "complexity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.smoothness, "smoothness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.opacity, "opacity");
};
var CONTOUR_LINES_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var CONTOUR_LINES_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec4 uLineColor;
uniform float uLineWidth;
uniform float uSpacing;
uniform float uScale;
uniform float uComplexity;
uniform float uSmoothness;
uniform float uSeed;
uniform vec2 uOffset;
uniform float uOpacity;
uniform bool uMaskToSourceAlpha;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33 + uSeed * 0.013);
	return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	float totalAmplitude = 0.0;
	float persistence = mix(0.18, 0.58, clamp(uComplexity, 0.0, 1.0));
	float smoothness = clamp(uSmoothness, 0.0, 1.0);
	mat2 rotate = mat2(0.80, 0.60, -0.60, 0.80);

	for (int i = 0; i < 5; i++) {
		float octave = float(i) / 4.0;
		float detailWeight = mix(
			1.0,
			1.0 - smoothstep(0.15, 1.0, octave),
			smoothness
		);
		value += amplitude * detailWeight * valueNoise(p);
		totalAmplitude += amplitude * detailWeight;
		p = rotate * p * 2.04 + vec2(13.17, 7.31);
		amplitude *= persistence;
	}

	return value / totalAmplitude;
}

void main() {
	vec4 texColor = texture(uSource, vUv);
	vec2 pixelPosition = gl_FragCoord.xy + uOffset;
	float scale = max(uScale, 0.001);
	vec2 p = pixelPosition / scale + vec2(uSeed * 0.137, uSeed * 0.193);

	float complexity = clamp(uComplexity, 0.0, 1.0);
	float smoothness = clamp(uSmoothness, 0.0, 1.0);
	vec2 warp = vec2(
		fbm(p + vec2(5.2, 1.3)),
		fbm(p + vec2(1.7, 9.2))
	) - 0.5;
	float terrain = fbm(p + warp * complexity * mix(2.8, 1.2, smoothness));

	float levels = max(
		max(uResolution.x, uResolution.y) / (max(uSpacing, 0.001) * 2.0),
		1.0
	);
	float contourPosition = terrain * levels;
	float contourFraction = fract(contourPosition);
	float distanceToContour = min(contourFraction, 1.0 - contourFraction);
	float derivative = max(fwidth(contourPosition), 0.0001);
	float halfLineWidth = max(uLineWidth, 0.001) * 0.5 * derivative;
	float coverage = 1.0 - smoothstep(
		halfLineWidth,
		halfLineWidth + derivative,
		distanceToContour
	);

	float lineAlpha = uLineColor.a * uOpacity * coverage;
	vec3 premultipliedLine = uLineColor.rgb * lineAlpha;

	if (uMaskToSourceAlpha) {
		fragColor = vec4(
			premultipliedLine * texColor.a + texColor.rgb * (1.0 - lineAlpha),
			texColor.a
		);
		return;
	}

	fragColor = vec4(
		premultipliedLine + texColor.rgb * (1.0 - lineAlpha),
		lineAlpha + texColor.a * (1.0 - lineAlpha)
	);
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
    throw new Error(`Contour lines shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Contour lines program link failed: ${log ?? "(no log)"}`);
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
var setupContourLines = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("contour lines effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = createProgram(gl, CONTOUR_LINES_VS, CONTOUR_LINES_FS);
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
    sourceTexture: createTexture(gl),
    colorCtx,
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uLineColor: gl.getUniformLocation(program, "uLineColor"),
      uLineWidth: gl.getUniformLocation(program, "uLineWidth"),
      uSpacing: gl.getUniformLocation(program, "uSpacing"),
      uScale: gl.getUniformLocation(program, "uScale"),
      uComplexity: gl.getUniformLocation(program, "uComplexity"),
      uSmoothness: gl.getUniformLocation(program, "uSmoothness"),
      uSeed: gl.getUniformLocation(program, "uSeed"),
      uOffset: gl.getUniformLocation(program, "uOffset"),
      uOpacity: gl.getUniformLocation(program, "uOpacity"),
      uMaskToSourceAlpha: gl.getUniformLocation(program, "uMaskToSourceAlpha")
    },
    cachedLineColor: "",
    cachedLineColorRgba: [255, 255, 255, 255]
  };
};
var contourLines = createEffect({
  type: "dev.remotion.effects.contourLines",
  label: "contourLines()",
  documentationLink: "https://www.remotion.dev/docs/effects/contour-lines",
  calculateKey: (params) => {
    const r = resolve(params);
    const maskSuffix = r.maskToSourceAlpha ? "-mask-to-source-alpha" : "";
    return `contour-lines-${r.lineColor}-${r.lineWidth}-${r.spacing}-${r.scale}-${r.complexity}-${r.smoothness}-${r.seed}-${r.offsetX}-${r.offsetY}-${r.opacity}${maskSuffix}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuColors */ .o)(target, "contour-lines"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the contour-lines effect");
        const r = resolve(params);
        const colors = (0,_index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__/* .getWebGpuColors */ .B)(state, [r.lineColor]);
        const uniformData = new Float32Array([
          width,
          height,
          r.spacing,
          r.scale,
          r.complexity,
          r.smoothness,
          r.seed,
          r.lineWidth,
          r.offsetX,
          r.offsetY,
          r.opacity,
          r.maskToSourceAlpha ? 1 : 0,
          colors[0] / 255,
          colors[1] / 255,
          colors[2] / 255,
          colors[3] / 255
        ]);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: CONTOUR_LINES_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => setupContourLines(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, sourceTexture, uniforms, vao } = state;
        if (state.cachedLineColor !== r.lineColor) {
          state.cachedLineColor = r.lineColor;
          state.cachedLineColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, r.lineColor);
        }
        const [cr, cg, cb, ca] = state.cachedLineColorRgba;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.useProgram(program);
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uResolution)
          gl.uniform2f(uniforms.uResolution, width, height);
        if (uniforms.uLineColor) {
          gl.uniform4f(uniforms.uLineColor, cr / 255, cg / 255, cb / 255, ca / 255);
        }
        if (uniforms.uLineWidth)
          gl.uniform1f(uniforms.uLineWidth, r.lineWidth);
        if (uniforms.uSpacing)
          gl.uniform1f(uniforms.uSpacing, r.spacing);
        if (uniforms.uScale)
          gl.uniform1f(uniforms.uScale, r.scale);
        if (uniforms.uComplexity)
          gl.uniform1f(uniforms.uComplexity, r.complexity);
        if (uniforms.uSmoothness)
          gl.uniform1f(uniforms.uSmoothness, r.smoothness);
        if (uniforms.uSeed)
          gl.uniform1f(uniforms.uSeed, r.seed);
        if (uniforms.uOffset)
          gl.uniform2f(uniforms.uOffset, r.offsetX, r.offsetY);
        if (uniforms.uOpacity)
          gl.uniform1f(uniforms.uOpacity, r.opacity);
        if (uniforms.uMaskToSourceAlpha)
          gl.uniform1i(uniforms.uMaskToSourceAlpha, r.maskToSourceAlpha ? 1 : 0);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, sourceTexture }) => {
        gl.deleteTexture(sourceTexture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: contourLinesSchema,
  validateParams: validateContourLinesParams
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

/***/ 7525
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   B: () => (/* binding */ getWebGpuColors),
/* harmony export */   o: () => (/* binding */ setupWebGpuColors)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);



// src/webgpu-color-state.ts
var setupWebGpuColors = (target, label) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const colorContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!colorContext)
    throw new Error("Failed to acquire 2D context for color parsing");
  return { ...(0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, label), colorContext, colors: null };
};
var getWebGpuColors = (state, colors) => {
  const key = JSON.stringify(colors);
  if (state.colors?.key === key)
    return state.colors.data;
  const data = new Uint8Array(colors.length * 4);
  for (let i = 0;i < colors.length; i++)
    data.set((0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorContext, colors[i]), i * 4);
  state.colors = { key, data };
  return data;
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




/***/ }

}]);
//# sourceMappingURL=2287.bundle.js.map