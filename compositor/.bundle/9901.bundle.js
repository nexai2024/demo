"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[9901],{

/***/ 9901
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  checkerboard: () => (/* reexport */ checkerboard2),
  checkerboardSchema: () => (/* reexport */ checkerboardSchema2)
});

// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4svzhprm.mjs
var index_4svzhprm = __webpack_require__(9728);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-dbd2m8bp.mjs
var index_dbd2m8bp = __webpack_require__(7525);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-wxhvgv2s.mjs
var index_wxhvgv2s = __webpack_require__(8197);
// EXTERNAL MODULE: ./node_modules/@remotion/effects/dist/esm/preview/index-4fvp93ps.mjs
var index_4fvp93ps = __webpack_require__(4075);
// EXTERNAL MODULE: ./node_modules/remotion/dist/esm/index.mjs
var esm = __webpack_require__(3947);
;// ./node_modules/@remotion/effects/dist/esm/preview/index-6adh73sw.mjs





// src/checkerboard.ts


// src/checkerboard-webgpu-shader.ts
var CHECKERBOARD_WEBGPU_SHADER = `
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var palette: texture_2d<f32>;
struct Params {
 geometry: vec4f,
 grid: vec4f,
 flags: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}
fn glslModulo(value: f32, divisor: f32) -> f32 { return value - divisor * floor(value / divisor); }
fn glslModulo2(value: vec2f, divisor: f32) -> vec2f { return value - divisor * floor(value / divisor); }
fn paletteColor(index: f32) -> vec4f { return textureLoad(palette, vec2i(i32(index), 0), 0); }

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 let texColor = sampleSource(vUv);
 let cellSize = max(params.geometry.w, 0.001);
 let spacing = max(params.grid.x, 0.001);
 let centered = vec2f(input.position.x, params.geometry.y - input.position.y) - params.geometry.xy * 0.5;
 let s = sin(params.grid.y);
 let c = cos(params.grid.y);
 let rotated = vec2f(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
 let position = rotated + params.grid.zw;
 var localPosition = glslModulo2(position, spacing);
 if (localPosition.x < 0.0) { localPosition.x += spacing; }
 if (localPosition.y < 0.0) { localPosition.y += spacing; }
 if (localPosition.x > cellSize || localPosition.y > cellSize) { return texColor; }
 let cell = floor(position / spacing);
 var colorIndex = glslModulo(cell.x + cell.y, params.geometry.z);
 if (colorIndex < 0.0) { colorIndex += params.geometry.z; }

 let overlay = paletteColor(colorIndex);
 let premultiplied = overlay.rgb * overlay.a;
 if (params.flags.x != 0.0) {
  return vec4f(premultiplied * texColor.a + texColor.rgb * (1.0 - overlay.a), texColor.a);
 }
 return vec4f(premultiplied + texColor.rgb * (1.0 - overlay.a), overlay.a + texColor.a * (1.0 - overlay.a));

}
`;

// src/checkerboard.ts
var { createEffect, createWebGL2ContextError } = esm.Internals;
var DEFAULT_COLORS = ["#dff4ff", "#7cc6ff"];
var DEFAULT_CELL_SIZE = 80;
var DEFAULT_GAP = 0;
var DEFAULT_ANGLE = 0;
var DEFAULT_OFFSET_X = 0;
var DEFAULT_OFFSET_Y = 0;
var DEFAULT_MASK_TO_SOURCE_ALPHA = false;
var checkerboardSchema2 = {
  colors: {
    type: "array",
    item: {
      type: "color"
    },
    default: DEFAULT_COLORS,
    minLength: 2,
    newItemDefault: "#ff0000",
    description: "Colors",
    keyframable: false
  },
  cellSize: {
    type: "number",
    min: 0.1,
    max: 800,
    step: 0.1,
    default: DEFAULT_CELL_SIZE,
    description: "Cell size",
    hiddenFromList: false
  },
  gap: {
    type: "number",
    min: 0,
    max: 400,
    step: 0.1,
    default: DEFAULT_GAP,
    description: "Gap",
    hiddenFromList: false
  },
  angle: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_ANGLE,
    description: "Angle"
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
  maskToSourceAlpha: {
    type: "boolean",
    default: DEFAULT_MASK_TO_SOURCE_ALPHA,
    description: "Mask to source alpha"
  }
};
var resolve = (p) => {
  const cellSize = p.cellSize ?? DEFAULT_CELL_SIZE;
  const gap = p.gap ?? DEFAULT_GAP;
  return {
    colors: p.colors ?? DEFAULT_COLORS,
    cellSize,
    spacing: cellSize + gap,
    angle: p.angle ?? DEFAULT_ANGLE,
    offsetX: p.offsetX ?? DEFAULT_OFFSET_X,
    offsetY: p.offsetY ?? DEFAULT_OFFSET_Y,
    maskToSourceAlpha: p.maskToSourceAlpha ?? DEFAULT_MASK_TO_SOURCE_ALPHA
  };
};
var validatePositive = (value, name) => {
  if (value <= 0) {
    throw new TypeError(`"${name}" must be greater than 0, but got ${JSON.stringify(value)}`);
  }
};
var validateNonNegative = (value, name) => {
  if (value < 0) {
    throw new TypeError(`"${name}" must be greater than or equal to 0, but got ${JSON.stringify(value)}`);
  }
};
var validateColors = (colors) => {
  if (colors === undefined) {
    return;
  }
  if (!Array.isArray(colors) || colors.length < 2) {
    throw new TypeError(`"colors" must be an array with at least 2 colors, but got ${JSON.stringify(colors)}`);
  }
  for (let i = 0;i < colors.length; i++) {
    (0,index_4fvp93ps/* assertRequiredColor */.b3)(colors[i], `colors[${i}]`);
  }
};
var validateCheckerboardParams = (params) => {
  (0,index_4fvp93ps/* assertEffectParamsObject */.db)(params, "Checkerboard");
  validateColors(params.colors);
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.cellSize, "cellSize");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.gap, "gap");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.angle, "angle");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.offsetX, "offsetX");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.offsetY, "offsetY");
  (0,index_4fvp93ps/* assertOptionalBoolean */.fX)(params.maskToSourceAlpha, "maskToSourceAlpha");
  const cellSize = params.cellSize ?? DEFAULT_CELL_SIZE;
  const gap = params.gap ?? DEFAULT_GAP;
  validatePositive(cellSize, "cellSize");
  validateNonNegative(gap, "gap");
};
var CHECKERBOARD_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var CHECKERBOARD_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform sampler2D uPalette;
uniform vec2 uResolution;
uniform float uNumColors;
uniform float uCellSize;
uniform float uSpacing;
uniform float uAngle;
uniform vec2 uOffset;
uniform bool uMaskToSourceAlpha;

void main() {
	vec4 texColor = texture(uSource, vUv);
	float cellSize = max(uCellSize, 0.001);
	float spacing = max(uSpacing, 0.001);
	vec2 centered = gl_FragCoord.xy - uResolution * 0.5;
	float s = sin(uAngle);
	float c = cos(uAngle);
	vec2 rotated = vec2(
		centered.x * c - centered.y * s,
		centered.x * s + centered.y * c
	);
	vec2 position = rotated + uOffset;
	vec2 localPosition = mod(position, spacing);
	if (localPosition.x < 0.0) {
		localPosition.x += spacing;
	}
	if (localPosition.y < 0.0) {
		localPosition.y += spacing;
	}

	if (localPosition.x > cellSize || localPosition.y > cellSize) {
		fragColor = texColor;
		return;
	}

	vec2 cell = floor(position / spacing);
	float colorIndex = mod(cell.x + cell.y, uNumColors);
	if (colorIndex < 0.0) {
		colorIndex += uNumColors;
	}

	float texCoord = (colorIndex + 0.5) / uNumColors;
	vec4 checkerColor = texture(uPalette, vec2(texCoord, 0.5));
	float checkerAlpha = checkerColor.a;
	vec3 premultipliedChecker = checkerColor.rgb * checkerAlpha;

	if (uMaskToSourceAlpha) {
		fragColor = vec4(
			premultipliedChecker * texColor.a + texColor.rgb * (1.0 - checkerAlpha),
			texColor.a
		);
		return;
	}

	fragColor = vec4(
		premultipliedChecker + texColor.rgb * (1.0 - checkerAlpha),
		checkerAlpha + texColor.a * (1.0 - checkerAlpha)
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
    throw new Error(`Checkerboard shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Checkerboard program link failed: ${log ?? "(no log)"}`);
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
var createTexture = (gl, filter) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create WebGL texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
};
var setupCheckerboard = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("checkerboard effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = createProgram(gl, CHECKERBOARD_VS, CHECKERBOARD_FS);
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
    sourceTexture: createTexture(gl, gl.LINEAR),
    paletteTexture: createTexture(gl, gl.NEAREST),
    colorCtx,
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uPalette: gl.getUniformLocation(program, "uPalette"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uNumColors: gl.getUniformLocation(program, "uNumColors"),
      uCellSize: gl.getUniformLocation(program, "uCellSize"),
      uSpacing: gl.getUniformLocation(program, "uSpacing"),
      uAngle: gl.getUniformLocation(program, "uAngle"),
      uOffset: gl.getUniformLocation(program, "uOffset"),
      uMaskToSourceAlpha: gl.getUniformLocation(program, "uMaskToSourceAlpha")
    },
    cachedPaletteKey: "",
    palettePixelData: new Uint8Array(0)
  };
};
var updatePalette = (state, colors) => {
  const paletteKey = colors.join("|");
  const paletteDirty = state.cachedPaletteKey !== paletteKey;
  if (!paletteDirty) {
    return false;
  }
  state.cachedPaletteKey = paletteKey;
  const len = colors.length * 4;
  if (state.palettePixelData.length !== len) {
    state.palettePixelData = new Uint8Array(len);
  }
  const { palettePixelData } = state;
  for (let i = 0;i < colors.length; i++) {
    const color = (0,index_wxhvgv2s/* parseColorRgba */.zp)(state.colorCtx, colors[i]);
    palettePixelData[i * 4] = color[0];
    palettePixelData[i * 4 + 1] = color[1];
    palettePixelData[i * 4 + 2] = color[2];
    palettePixelData[i * 4 + 3] = color[3];
  }
  return true;
};
var checkerboard2 = createEffect({
  type: "remotion/checkerboard",
  label: "checkerboard()",
  documentationLink: "https://www.remotion.dev/docs/effects/checkerboard",
  calculateKey: (params) => {
    const r = resolve(params);
    const maskSuffix = r.maskToSourceAlpha ? "-mask-to-source-alpha" : "";
    return `checkerboard-${r.colors.join("|")}-${r.cellSize}-${r.spacing}-${r.angle}-${r.offsetX}-${r.offsetY}${maskSuffix}`;
  },
  implementations: {
    webgpu: esm.Internals.createEffectImplementation({
      setup: (target) => (0,index_dbd2m8bp/* setupWebGpuColors */.o)(target, "checkerboard"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the checkerboard effect");
        const r = resolve(params);
        const colors = (0,index_dbd2m8bp/* getWebGpuColors */.B)(state, r.colors);
        const uniformData = new Float32Array([
          width,
          height,
          r.colors.length,
          r.cellSize,
          r.spacing,
          r.angle * Math.PI / 180,
          r.offsetX,
          r.offsetY,
          r.maskToSourceAlpha ? 1 : 0,
          0,
          0,
          0
        ]);
        (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: CHECKERBOARD_WEBGPU_SHADER,
          uniformData
        }, {
          sourceFilter: null,
          auxiliaryTexture: {
            data: colors,
            width: r.colors.length,
            height: 1,
            format: "rgba8unorm"
          }
        });
      },
      cleanup: index_4svzhprm/* cleanupWebGpuSinglePass */.Gl
    }),
    webgl2: esm.Internals.createEffectImplementation({
      setup: (target) => setupCheckerboard(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const paletteDirty = updatePalette(state, r.colors);
        const { gl, program, sourceTexture, paletteTexture, uniforms, vao } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
        if (paletteDirty) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.colors.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, state.palettePixelData);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        }
        gl.useProgram(program);
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uPalette)
          gl.uniform1i(uniforms.uPalette, 1);
        if (uniforms.uResolution)
          gl.uniform2f(uniforms.uResolution, width, height);
        if (uniforms.uNumColors)
          gl.uniform1f(uniforms.uNumColors, r.colors.length);
        if (uniforms.uCellSize)
          gl.uniform1f(uniforms.uCellSize, r.cellSize);
        if (uniforms.uSpacing)
          gl.uniform1f(uniforms.uSpacing, r.spacing);
        if (uniforms.uAngle)
          gl.uniform1f(uniforms.uAngle, r.angle * Math.PI / 180);
        if (uniforms.uOffset)
          gl.uniform2f(uniforms.uOffset, r.offsetX, r.offsetY);
        if (uniforms.uMaskToSourceAlpha)
          gl.uniform1i(uniforms.uMaskToSourceAlpha, r.maskToSourceAlpha ? 1 : 0);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, sourceTexture, paletteTexture }) => {
        gl.deleteTexture(sourceTexture);
        gl.deleteTexture(paletteTexture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: checkerboardSchema2,
  validateParams: validateCheckerboardParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/checkerboard.mjs






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
//# sourceMappingURL=9901.bundle.js.map