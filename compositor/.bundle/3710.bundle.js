"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[3710],{

/***/ 3710
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   halftone: () => (/* binding */ halftone),
/* harmony export */   halftoneSchema: () => (/* binding */ halftoneSchema)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(7525);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/halftone.ts


// src/halftone-webgpu-shader.ts
var HALFTONE_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {
 geometry: vec4f,
 grid: vec4f,
 flags: vec4f,
 color: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 let center = params.geometry.xy * 0.5;
 let d = vec2f(input.position.x, params.geometry.y - input.position.y) - center;
 let cosR = cos(params.grid.x);
 let sinR = sin(params.grid.x);
 let gridPos = vec2f(d.x * cosR + d.y * sinR, -d.x * sinR + d.y * cosR);
 let spacing = max(params.geometry.w, 0.001);
 let cellIndex = floor((gridPos + params.grid.yz) / spacing + vec2f(0.5));
 let gridCenter = cellIndex * spacing - params.grid.yz;
 let canvasPos = center + vec2f(gridCenter.x * cosR - gridCenter.y * sinR, gridCenter.x * sinR + gridCenter.y * cosR);
 let sampleUv = clamp(canvasPos / params.geometry.xy, vec2f(0), vec2f(1));
 let texColor = sampleSource(sampleUv);
 let alpha = texColor.a;
 var rgb = vec3f(0);
 if (alpha > 0.001) { rgb = texColor.rgb / alpha; }
 let lum = dot(rgb, vec3f(0.299, 0.587, 0.114));
 let lumDefault = lum * alpha + (1.0 - alpha);
 let dotScale = select(1.0 - lumDefault, lumDefault, params.flags.x != 0.0);
 if (dotScale <= 0.01) { return vec4f(0); }
 let diff = gridPos - gridCenter;
 let halfSize = params.geometry.z * 0.5;
 var coverage = 0.0;
 if (params.grid.w == 0.0) {
  let radius = halfSize * dotScale;
  coverage = 1.0 - smoothstep(radius - 0.75, radius + 0.75, length(diff));
 } else if (params.grid.w == 1.0) {
  let s = params.geometry.z * dotScale * 0.5;
  coverage = (1.0 - smoothstep(s - 0.5, s + 0.5, abs(diff.x))) * (1.0 - smoothstep(s - 0.5, s + 0.5, abs(diff.y)));
 } else {
  let localTexColor = sampleSource(vUv);
  let localAlpha = localTexColor.a;
  var localRgb = vec3f(0);
  if (localAlpha > 0.001) { localRgb = localTexColor.rgb / localAlpha; }
  let localLum = dot(localRgb, vec3f(0.299, 0.587, 0.114));
  let localLumDefault = localLum * localAlpha + (1.0 - localAlpha);
  let localDotScale = select(1.0 - localLumDefault, localLumDefault, params.flags.x != 0.0);
  if (localDotScale <= 0.12) { return vec4f(0); }
  let lineHalf = params.geometry.z * dotScale * 0.5;
  if (lineHalf <= 1.0) { return vec4f(0); }
  coverage = (1.0 - smoothstep(halfSize - 0.5, halfSize + 0.5, abs(diff.x))) * (1.0 - smoothstep(lineHalf - 0.5, lineHalf + 0.5, abs(diff.y)));
 }
 return select(params.color, texColor, params.flags.y != 0.0) * coverage;

}
`;

// src/halftone.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var HALFTONE_SHAPES = ["circle", "square", "line"];
var HALFTONE_SAMPLING = ["bilinear", "nearest"];
var HALFTONE_COLOR_MODES = ["solid", "source"];
var halftoneSchema = {
  dotSize: {
    type: "number",
    min: 1,
    max: 200,
    step: 1,
    default: 20,
    description: "Dot size",
    hiddenFromList: false
  },
  dotSpacing: {
    type: "number",
    min: 1,
    max: 200,
    step: 1,
    default: 20,
    description: "Dot spacing",
    hiddenFromList: false
  },
  rotation: {
    type: "rotation-degrees",
    step: 1,
    default: 0,
    description: "Rotation"
  },
  offsetX: {
    type: "number",
    step: 1,
    default: 0,
    description: "Offset X",
    hiddenFromList: false
  },
  offsetY: {
    type: "number",
    step: 1,
    default: 0,
    description: "Offset Y",
    hiddenFromList: false
  },
  shape: {
    type: "enum",
    variants: {
      circle: {},
      square: {},
      line: {}
    },
    default: "circle",
    description: "Shape"
  },
  invert: {
    type: "boolean",
    default: false,
    description: "Invert"
  },
  colorMode: {
    type: "enum",
    default: "solid",
    description: "Color mode",
    variants: {
      solid: {
        dotColor: {
          type: "color",
          default: "red",
          description: "Dot color"
        }
      },
      source: {}
    }
  }
};
var formatEnum = (variants) => {
  if (variants.length === 2) {
    return `"${variants[0]}" or "${variants[1]}"`;
  }
  return `${variants.slice(0, -1).map((variant) => `"${variant}"`).join(", ")} or "${variants[variants.length - 1]}"`;
};
var assertOptionalEnum = (value, name, variants) => {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string" || !variants.includes(value)) {
    throw new TypeError(`"${name}" must be ${formatEnum(variants)}`);
  }
};
var resolve = (p) => ({
  shape: p.shape ?? "circle",
  dotSize: p.dotSize ?? 20,
  dotSpacing: p.dotSpacing ?? p.dotSize ?? 20,
  rotation: p.rotation ?? 0,
  offsetX: p.offsetX ?? 0,
  offsetY: p.offsetY ?? 0,
  sampling: p.sampling ?? "bilinear",
  colorMode: p.colorMode ?? "solid",
  dotColor: "dotColor" in p ? p.dotColor ?? "red" : "red",
  invert: p.invert ?? false
});
var validateHalftoneParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Halftone");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.dotSize, "dotSize");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.dotSpacing, "dotSpacing");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.rotation, "rotation");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.offsetX, "offsetX");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.offsetY, "offsetY");
  assertOptionalEnum(params.shape, "shape", HALFTONE_SHAPES);
  assertOptionalEnum(params.sampling, "sampling", HALFTONE_SAMPLING);
  assertOptionalEnum(params.colorMode, "colorMode", HALFTONE_COLOR_MODES);
  if ("color" in params && params.color !== undefined) {
    throw new TypeError('"color" has been renamed to "dotColor"');
  }
  if (params.colorMode === "source" && "dotColor" in params) {
    throw new TypeError('"dotColor" can only be set when "colorMode" is "solid"');
  }
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)("dotColor" in params ? params.dotColor : undefined, "dotColor");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalBoolean */ .fX)(params.invert, "invert");
  if (params.dotSize !== undefined && params.dotSize < 1) {
    throw new TypeError(`"dotSize" must be >= 1, but got ${JSON.stringify(params.dotSize)}`);
  }
  if (params.dotSpacing !== undefined && params.dotSpacing < 1) {
    throw new TypeError(`"dotSpacing" must be >= 1, but got ${JSON.stringify(params.dotSpacing)}`);
  }
};
var HALFTONE_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;
void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var HALFTONE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uDotSize;
uniform float uDotSpacing;
uniform float uRotation;
uniform vec2 uOffset;
uniform vec4 uColor;
uniform int uShape;
uniform bool uShadeOutside;
uniform bool uUseSourceColor;

void main() {
	vec2 fragPos = gl_FragCoord.xy;
	vec2 center = uResolution * 0.5;

	vec2 d = fragPos - center;
	float cosR = cos(uRotation);
	float sinR = sin(uRotation);

	vec2 gridPos = vec2(
		d.x * cosR + d.y * sinR,
		-d.x * sinR + d.y * cosR
	);

	float spacing = max(uDotSpacing, 0.001);
	vec2 cellIndex = floor((gridPos + uOffset) / spacing + 0.5);
	vec2 gridCenter = cellIndex * spacing - uOffset;

	vec2 canvasPos = center + vec2(
		gridCenter.x * cosR - gridCenter.y * sinR,
		gridCenter.x * sinR + gridCenter.y * cosR
	);

	vec2 sampleUv = clamp(canvasPos / uResolution, vec2(0.0), vec2(1.0));
	vec4 texColor = texture(uSource, sampleUv);

	float alpha = texColor.a;
	vec3 rgb = alpha > 0.001 ? texColor.rgb / alpha : vec3(0.0);
	float lum = dot(rgb, vec3(0.299, 0.587, 0.114));

	float lumDefault = lum * alpha + (1.0 - alpha);
	float dotScale = uShadeOutside
		? lumDefault
		: 1.0 - lumDefault;

	if (dotScale <= 0.01) {
		fragColor = vec4(0.0);
		return;
	}

	vec2 diff = gridPos - gridCenter;
	float halfSize = uDotSize * 0.5;
	float coverage = 0.0;

	if (uShape == 0) {
		float radius = halfSize * dotScale;
		float dist = length(diff);
		coverage = 1.0 - smoothstep(radius - 0.75, radius + 0.75, dist);
	} else if (uShape == 1) {
		float s = uDotSize * dotScale * 0.5;
		coverage = (1.0 - smoothstep(s - 0.5, s + 0.5, abs(diff.x)))
				 * (1.0 - smoothstep(s - 0.5, s + 0.5, abs(diff.y)));
	} else {
		vec4 localTexColor = texture(uSource, vUv);
		float localAlpha = localTexColor.a;
		vec3 localRgb = localAlpha > 0.001 ? localTexColor.rgb / localAlpha : vec3(0.0);
		float localLum = dot(localRgb, vec3(0.299, 0.587, 0.114));
		float localLumDefault = localLum * localAlpha + (1.0 - localAlpha);
		float localDotScale = uShadeOutside
			? localLumDefault
			: 1.0 - localLumDefault;

		if (localDotScale <= 0.12) {
			fragColor = vec4(0.0);
			return;
		}

		float lineHalf = uDotSize * dotScale * 0.5;
		if (lineHalf <= 1.0) {
			fragColor = vec4(0.0);
			return;
		}

		coverage = (1.0 - smoothstep(halfSize - 0.5, halfSize + 0.5, abs(diff.x)))
				 * (1.0 - smoothstep(lineHalf - 0.5, lineHalf + 0.5, abs(diff.y)));
	}

	fragColor = (uUseSourceColor ? texColor : uColor) * coverage;
}
`;
var SHAPE_INDEX = {
  circle: 0,
  square: 1,
  line: 2
};
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
    throw new Error(`Halftone shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Halftone program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var halftone = createEffect({
  type: "dev.remotion.effects.halftone",
  label: "halftone()",
  documentationLink: "https://www.remotion.dev/docs/effects/halftone",
  calculateKey: (params) => {
    const r = resolve(params);
    return `halftone-${r.shape}-${r.dotSize}-${r.dotSpacing}-${r.rotation}-${r.offsetX}-${r.offsetY}-${r.sampling}-${r.colorMode}-${r.dotColor}-${r.invert ? 1 : 0}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuColors */ .o)(target, "halftone"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the halftone effect");
        const r = resolve(params);
        const colors = (0,_index_dbd2m8bp_mjs__WEBPACK_IMPORTED_MODULE_1__/* .getWebGpuColors */ .B)(state, [r.dotColor]);
        const uniformData = new Float32Array([
          width,
          height,
          r.dotSize,
          r.dotSpacing,
          r.rotation * Math.PI / 180,
          r.offsetX,
          r.offsetY,
          SHAPE_INDEX[r.shape],
          r.invert ? 1 : 0,
          r.colorMode === "source" ? 1 : 0,
          0,
          0,
          colors[0] / 255 * (colors[3] / 255),
          colors[1] / 255 * (colors[3] / 255),
          colors[2] / 255 * (colors[3] / 255),
          colors[3] / 255
        ]);
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: HALFTONE_WEBGPU_SHADER,
          uniformData
        }, {
          sourceFilter: r.sampling === "nearest" ? "nearest" : "linear",
          auxiliaryTexture: null
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("halftone effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, HALFTONE_VS);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, HALFTONE_FS);
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
          program,
          vao,
          vbo,
          texture,
          uSource: gl.getUniformLocation(program, "uSource"),
          uResolution: gl.getUniformLocation(program, "uResolution"),
          uDotSize: gl.getUniformLocation(program, "uDotSize"),
          uDotSpacing: gl.getUniformLocation(program, "uDotSpacing"),
          uRotation: gl.getUniformLocation(program, "uRotation"),
          uOffset: gl.getUniformLocation(program, "uOffset"),
          uColor: gl.getUniformLocation(program, "uColor"),
          uShape: gl.getUniformLocation(program, "uShape"),
          uShadeOutside: gl.getUniformLocation(program, "uShadeOutside"),
          uUseSourceColor: gl.getUniformLocation(program, "uUseSourceColor"),
          colorCtx,
          cachedColorStr: "",
          cachedColorRgba: [0, 0, 0, 255]
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, texture } = state;
        if (state.cachedColorStr !== r.dotColor) {
          state.cachedColorStr = r.dotColor;
          state.cachedColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, r.dotColor);
        }
        const [cr, cg, cb, ca] = state.cachedColorRgba;
        const caNormalized = ca / 255;
        const filter = r.sampling === "nearest" ? gl.NEAREST : gl.LINEAR;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (state.uSource)
          gl.uniform1i(state.uSource, 0);
        if (state.uResolution)
          gl.uniform2f(state.uResolution, width, height);
        if (state.uDotSize)
          gl.uniform1f(state.uDotSize, r.dotSize);
        if (state.uDotSpacing)
          gl.uniform1f(state.uDotSpacing, r.dotSpacing);
        if (state.uRotation)
          gl.uniform1f(state.uRotation, r.rotation * Math.PI / 180);
        if (state.uOffset)
          gl.uniform2f(state.uOffset, r.offsetX, r.offsetY);
        if (state.uColor)
          gl.uniform4f(state.uColor, cr / 255 * caNormalized, cg / 255 * caNormalized, cb / 255 * caNormalized, caNormalized);
        if (state.uShape)
          gl.uniform1i(state.uShape, SHAPE_INDEX[r.shape]);
        if (state.uShadeOutside)
          gl.uniform1i(state.uShadeOutside, r.invert ? 1 : 0);
        if (state.uUseSourceColor)
          gl.uniform1i(state.uUseSourceColor, r.colorMode === "source" ? 1 : 0);
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
  schema: halftoneSchema,
  validateParams: validateHalftoneParams
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
//# sourceMappingURL=3710.bundle.js.map