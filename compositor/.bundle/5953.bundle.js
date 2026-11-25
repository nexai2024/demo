"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5953],{

/***/ 5953
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  gridlines: () => (/* reexport */ gridlines2),
  gridlinesSchema: () => (/* reexport */ gridlinesSchema2)
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
;// ./node_modules/@remotion/effects/dist/esm/preview/index-1dnz7xvy.mjs





// src/gridlines.ts


// src/gridlines-webgpu-shader.ts
var GRIDLINES_WEBGPU_SHADER = `
diagnostic(off, derivative_uniformity);
${index_4svzhprm/* WEBGPU_SINGLE_PASS_VERTEX */.fH}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
struct Params {
 geometry: vec4f,
 rotation: vec4f,
 offset: vec4f,
 lineColor: vec4f,
 backgroundColor: vec4f,
}
fn sampleSource(uv: vec2f) -> vec4f {
 return textureSampleLevel(sourceTexture, sourceSampler, vec2f(uv.x, 1.0 - uv.y), 0);
}

fn sourceOver(backdrop: vec4f, overlay: vec4f) -> vec4f { return overlay + backdrop * (1.0 - overlay.a); }
fn sourceAtop(backdrop: vec4f, overlay: vec4f) -> vec4f { return vec4f(overlay.rgb * backdrop.a + backdrop.rgb * (1.0 - overlay.a), backdrop.a); }
fn rotationMatrix(rotationX: f32, rotationY: f32, rotationZ: f32) -> mat3x3f {
 let sx = sin(rotationX); let cx = cos(rotationX);
 let sy = sin(rotationY); let cy = cos(rotationY);
 let sz = sin(rotationZ); let cz = cos(rotationZ);
 let rx = mat3x3f(1, 0, 0, 0, cx, sx, 0, -sx, cx);
 let ry = mat3x3f(cy, 0, -sy, 0, 1, 0, sy, 0, cy);
 let rz = mat3x3f(cz, sz, 0, -sz, cz, 0, 0, 0, 1);
 return rz * ry * rx;
}
struct GridPoint {coordinate: vec2f, valid: bool,}
fn gridAt(centered: vec2f, rotation: mat3x3f) -> GridPoint {
 var gridCoord = vec2f(0);
 if (params.rotation.w <= 0.0) {
  let rotated = rotation * vec3f(centered, 0);
  gridCoord = rotated.xy + params.offset.xy;
 } else {
  let camera = vec3f(0, 0, params.rotation.w);
  let ray = normalize(vec3f(centered, -params.rotation.w));
  let normal = rotation * vec3f(0, 0, 1);
  let denominator = dot(ray, normal);
  let t = -dot(camera, normal) / denominator;
  if (abs(denominator) < 0.0001 || t <= 0.0) { return GridPoint(vec2f(0), false); }
  let worldPosition = camera + ray * t;
  let localPosition = transpose(rotation) * worldPosition;
  gridCoord = localPosition.xy + params.offset.xy;
 }
 return GridPoint(gridCoord, true);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let vUv = vec2f(input.uv.x, 1.0 - input.uv.y);

 let texColor = sampleSource(vUv);
 let centered = vec2f(input.position.x, params.geometry.y - input.position.y) - params.geometry.xy * 0.5;
 let rotation = rotationMatrix(params.rotation.y, params.rotation.z, params.rotation.x);
 let gridPoint = gridAt(centered, rotation);
 if (!gridPoint.valid) { return sourceOver(texColor, params.backgroundColor); }
 let gridCoord = gridPoint.coordinate;
 let gridSize = max(params.geometry.z, 0.001);
 let cell = abs(fract(gridCoord / gridSize + vec2f(0.5)) - vec2f(0.5)) * gridSize;
 let halfLineWidth = params.geometry.w * 0.5;
 var derivatives = fwidth(gridCoord);
 if (i32(params.geometry.y) % 2 != 0) {
  // Match WebGL's bottom-origin derivative quads on odd-height targets.
  let neighborY = select(-1.0, 1.0, i32(params.geometry.y - input.position.y) % 2 == 0);
  let neighbor = gridAt(centered + vec2f(0, neighborY), rotation);
  derivatives = abs(dpdx(gridCoord)) + abs(neighbor.coordinate - gridCoord);
 }
 let gridUnitsPerPixel = max(derivatives, vec2f(0.001));
 let halfWidthInGridUnits = halfLineWidth * gridUnitsPerPixel;
 let projectedCellSize = gridSize / gridUnitsPerPixel;
 let densityFade = smoothstep(vec2f(max(params.geometry.w * 1.5, 1.0)), vec2f(max(params.geometry.w * 4.0, 2.0)), projectedCellSize);
 var lineCoverage = vec2f(0);
 if (halfLineWidth > 0.001) { lineCoverage = vec2f(1) - smoothstep(halfWidthInGridUnits - gridUnitsPerPixel, halfWidthInGridUnits + gridUnitsPerPixel, cell); }
 lineCoverage *= densityFade;
 let coverage = max(lineCoverage.x, lineCoverage.y);
 let line = params.lineColor * coverage;
 if (params.offset.z != 0.0) { return sourceAtop(sourceAtop(texColor, params.backgroundColor), line); }
 return sourceOver(sourceOver(texColor, params.backgroundColor), line);

}
`;

// src/gridlines.ts
var { createEffect, createWebGL2ContextError } = esm.Internals;
var DEFAULT_GRID_SIZE = 64;
var DEFAULT_LINE_WIDTH = 2;
var DEFAULT_LINE_COLOR = "#ffffff";
var DEFAULT_BACKGROUND_COLOR = "transparent";
var DEFAULT_ROTATION = 0;
var DEFAULT_ROTATION_X = 0;
var DEFAULT_ROTATION_Y = 0;
var DEFAULT_PERSPECTIVE = 0;
var DEFAULT_OFFSET_X = 0;
var DEFAULT_OFFSET_Y = 0;
var DEFAULT_MASK_TO_SOURCE_ALPHA = false;
var gridlinesSchema2 = {
  gridSize: {
    type: "number",
    min: 1,
    max: 400,
    step: 1,
    default: DEFAULT_GRID_SIZE,
    description: "Grid size",
    hiddenFromList: false
  },
  lineWidth: {
    type: "number",
    min: 0,
    max: 100,
    step: 0.1,
    default: DEFAULT_LINE_WIDTH,
    description: "Line width",
    hiddenFromList: false
  },
  lineColor: {
    type: "color",
    default: DEFAULT_LINE_COLOR,
    description: "Line color"
  },
  backgroundColor: {
    type: "color",
    default: DEFAULT_BACKGROUND_COLOR,
    description: "Background color"
  },
  rotation: {
    type: "rotation-degrees",
    min: -180,
    max: 180,
    step: 1,
    default: DEFAULT_ROTATION,
    description: "Rotation"
  },
  rotationX: {
    type: "rotation-degrees",
    min: -180,
    max: 180,
    step: 0.1,
    default: DEFAULT_ROTATION_X,
    description: "Rotation X"
  },
  rotationY: {
    type: "rotation-degrees",
    min: -180,
    max: 180,
    step: 0.1,
    default: DEFAULT_ROTATION_Y,
    description: "Rotation Y"
  },
  perspective: {
    type: "number",
    min: 0,
    max: 4000,
    step: 1,
    default: DEFAULT_PERSPECTIVE,
    description: "Perspective",
    hiddenFromList: false
  },
  offsetX: {
    type: "number",
    min: -400,
    max: 400,
    step: 0.1,
    default: DEFAULT_OFFSET_X,
    description: "Offset X",
    hiddenFromList: false
  },
  offsetY: {
    type: "number",
    min: -400,
    max: 400,
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
var resolve = (p) => ({
  gridSize: p.gridSize ?? DEFAULT_GRID_SIZE,
  lineWidth: p.lineWidth ?? DEFAULT_LINE_WIDTH,
  lineColor: p.lineColor ?? DEFAULT_LINE_COLOR,
  backgroundColor: p.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
  rotation: p.rotation ?? DEFAULT_ROTATION,
  rotationX: p.rotationX ?? DEFAULT_ROTATION_X,
  rotationY: p.rotationY ?? DEFAULT_ROTATION_Y,
  perspective: p.perspective ?? DEFAULT_PERSPECTIVE,
  offsetX: p.offsetX ?? DEFAULT_OFFSET_X,
  offsetY: p.offsetY ?? DEFAULT_OFFSET_Y,
  maskToSourceAlpha: p.maskToSourceAlpha ?? DEFAULT_MASK_TO_SOURCE_ALPHA
});
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
var validateGridlinesParams = (params) => {
  (0,index_4fvp93ps/* assertEffectParamsObject */.db)(params, "Gridlines");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.gridSize, "gridSize");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.lineWidth, "lineWidth");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.rotation, "rotation");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.rotationX, "rotationX");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.rotationY, "rotationY");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.perspective, "perspective");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.offsetX, "offsetX");
  (0,index_wxhvgv2s/* assertOptionalFiniteNumber */.FC)(params.offsetY, "offsetY");
  (0,index_4fvp93ps/* assertOptionalColor */.gu)(params.lineColor, "lineColor");
  (0,index_4fvp93ps/* assertOptionalColor */.gu)(params.backgroundColor, "backgroundColor");
  (0,index_4fvp93ps/* assertOptionalBoolean */.fX)(params.maskToSourceAlpha, "maskToSourceAlpha");
  validatePositive(params.gridSize ?? DEFAULT_GRID_SIZE, "gridSize");
  validateNonNegative(params.lineWidth ?? DEFAULT_LINE_WIDTH, "lineWidth");
  validateNonNegative(params.perspective ?? DEFAULT_PERSPECTIVE, "perspective");
};
var GRIDLINES_VS = `#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var GRIDLINES_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uGridSize;
uniform float uLineWidth;
uniform vec4 uLineColor;
uniform vec4 uBackgroundColor;
uniform float uRotation;
uniform float uRotationX;
uniform float uRotationY;
uniform float uPerspective;
uniform vec2 uOffset;
uniform bool uMaskToSourceAlpha;

vec4 sourceOver(vec4 backdrop, vec4 overlay) {
	return overlay + backdrop * (1.0 - overlay.a);
}

vec4 sourceAtop(vec4 backdrop, vec4 overlay) {
	return vec4(
		overlay.rgb * backdrop.a + backdrop.rgb * (1.0 - overlay.a),
		backdrop.a
	);
}

mat3 rotationMatrix(float rotationX, float rotationY, float rotationZ) {
	float sx = sin(rotationX);
	float cx = cos(rotationX);
	float sy = sin(rotationY);
	float cy = cos(rotationY);
	float sz = sin(rotationZ);
	float cz = cos(rotationZ);

	mat3 rx = mat3(
		1.0, 0.0, 0.0,
		0.0, cx, sx,
		0.0, -sx, cx
	);
	mat3 ry = mat3(
		cy, 0.0, -sy,
		0.0, 1.0, 0.0,
		sy, 0.0, cy
	);
	mat3 rz = mat3(
		cz, sz, 0.0,
		-sz, cz, 0.0,
		0.0, 0.0, 1.0
	);

	return rz * ry * rx;
}

void main() {
	vec4 texColor = texture(uSource, vUv);
	vec2 centered = gl_FragCoord.xy - uResolution * 0.5;
	mat3 rotation = rotationMatrix(uRotationX, uRotationY, uRotation);
	vec2 gridCoord;

	if (uPerspective <= 0.0) {
		vec3 rotated = rotation * vec3(centered, 0.0);
		gridCoord = rotated.xy + uOffset;
	} else {
		vec3 camera = vec3(0.0, 0.0, uPerspective);
		vec3 ray = normalize(vec3(centered, -uPerspective));
		vec3 normal = rotation * vec3(0.0, 0.0, 1.0);
		float denominator = dot(ray, normal);
		float t = -dot(camera, normal) / denominator;

		if (abs(denominator) < 0.0001 || t <= 0.0) {
			fragColor = sourceOver(texColor, uBackgroundColor);
			return;
		}

		vec3 worldPosition = camera + ray * t;
		vec3 localPosition = transpose(rotation) * worldPosition;
		gridCoord = localPosition.xy + uOffset;
	}

	float gridSize = max(uGridSize, 0.001);
	vec2 cell = abs(fract(gridCoord / gridSize + 0.5) - 0.5) * gridSize;
	float halfLineWidth = uLineWidth * 0.5;
	vec2 gridUnitsPerPixel = max(fwidth(gridCoord), vec2(0.001));
	vec2 halfWidthInGridUnits = halfLineWidth * gridUnitsPerPixel;
	vec2 antialiasInGridUnits = gridUnitsPerPixel;
	vec2 projectedCellSize = gridSize / gridUnitsPerPixel;
	vec2 densityFade = smoothstep(
		vec2(max(uLineWidth * 1.5, 1.0)),
		vec2(max(uLineWidth * 4.0, 2.0)),
		projectedCellSize
	);
	vec2 lineCoverage = halfLineWidth <= 0.001
		? vec2(0.0)
		: 1.0 - smoothstep(
			halfWidthInGridUnits - antialiasInGridUnits,
			halfWidthInGridUnits + antialiasInGridUnits,
			cell
		);
	lineCoverage *= densityFade;
	float coverage = max(lineCoverage.x, lineCoverage.y);

	vec4 background = uBackgroundColor;
	vec4 line = uLineColor * coverage;

	if (uMaskToSourceAlpha) {
		fragColor = sourceAtop(sourceAtop(texColor, background), line);
		return;
	}

	fragColor = sourceOver(sourceOver(texColor, background), line);
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
    throw new Error(`Gridlines shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Gridlines program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var rgbaToUniform = (rgba) => {
  const [r, g, b, a] = rgba;
  const alpha = a / 255;
  return [r / 255 * alpha, g / 255 * alpha, b / 255 * alpha, alpha];
};
var gridlines2 = createEffect({
  type: "remotion/gridlines",
  label: "gridlines()",
  documentationLink: "https://www.remotion.dev/docs/effects/gridlines",
  calculateKey: (params) => {
    const r = resolve(params);
    const maskSuffix = r.maskToSourceAlpha ? "-mask-to-source-alpha" : "";
    return `gridlines-${r.gridSize}-${r.lineWidth}-${r.lineColor}-${r.backgroundColor}-${r.rotation}-${r.rotationX}-${r.rotationY}-${r.perspective}-${r.offsetX}-${r.offsetY}${maskSuffix}`;
  },
  implementations: {
    webgpu: esm.Internals.createEffectImplementation({
      setup: (target) => (0,index_dbd2m8bp/* setupWebGpuColors */.o)(target, "gridlines"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the gridlines effect");
        const r = resolve(params);
        const colors = (0,index_dbd2m8bp/* getWebGpuColors */.B)(state, [r.lineColor, r.backgroundColor]);
        const uniformData = new Float32Array([
          width,
          height,
          r.gridSize,
          r.lineWidth,
          r.rotation * Math.PI / 180,
          r.rotationX * Math.PI / 180,
          r.rotationY * Math.PI / 180,
          r.perspective,
          r.offsetX,
          r.offsetY,
          r.maskToSourceAlpha ? 1 : 0,
          0,
          colors[0] / 255 * (colors[3] / 255),
          colors[1] / 255 * (colors[3] / 255),
          colors[2] / 255 * (colors[3] / 255),
          colors[3] / 255,
          colors[4] / 255 * (colors[7] / 255),
          colors[5] / 255 * (colors[7] / 255),
          colors[6] / 255 * (colors[7] / 255),
          colors[7] / 255
        ]);
        (0,index_4svzhprm/* applyWebGpuSinglePass */.UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: GRIDLINES_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: index_4svzhprm/* cleanupWebGpuSinglePass */.Gl
    }),
    webgl2: esm.Internals.createEffectImplementation({
      setup: (target) => {
        const gl = target.getContext("webgl2", {
          premultipliedAlpha: true,
          alpha: true,
          preserveDrawingBuffer: true
        });
        if (!gl) {
          throw createWebGL2ContextError("gridlines effect");
        }
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const vs = compileShader(gl, gl.VERTEX_SHADER, GRIDLINES_VS);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, GRIDLINES_FS);
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
          uniforms: {
            uSource: gl.getUniformLocation(program, "uSource"),
            uResolution: gl.getUniformLocation(program, "uResolution"),
            uGridSize: gl.getUniformLocation(program, "uGridSize"),
            uLineWidth: gl.getUniformLocation(program, "uLineWidth"),
            uLineColor: gl.getUniformLocation(program, "uLineColor"),
            uBackgroundColor: gl.getUniformLocation(program, "uBackgroundColor"),
            uRotation: gl.getUniformLocation(program, "uRotation"),
            uRotationX: gl.getUniformLocation(program, "uRotationX"),
            uRotationY: gl.getUniformLocation(program, "uRotationY"),
            uPerspective: gl.getUniformLocation(program, "uPerspective"),
            uOffset: gl.getUniformLocation(program, "uOffset"),
            uMaskToSourceAlpha: gl.getUniformLocation(program, "uMaskToSourceAlpha")
          },
          colorCtx,
          cachedLineColorStr: "",
          cachedLineColorRgba: [255, 255, 255, 255],
          cachedBackgroundColorStr: "",
          cachedBackgroundColorRgba: [0, 0, 0, 0]
        };
      },
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, vao, texture, uniforms } = state;
        if (state.cachedLineColorStr !== r.lineColor) {
          state.cachedLineColorStr = r.lineColor;
          state.cachedLineColorRgba = (0,index_wxhvgv2s/* parseColorRgba */.zp)(state.colorCtx, r.lineColor);
        }
        if (state.cachedBackgroundColorStr !== r.backgroundColor) {
          state.cachedBackgroundColorStr = r.backgroundColor;
          state.cachedBackgroundColorRgba = (0,index_wxhvgv2s/* parseColorRgba */.zp)(state.colorCtx, r.backgroundColor);
        }
        const [lineR, lineG, lineB, lineA] = rgbaToUniform(state.cachedLineColorRgba);
        const [bgR, bgG, bgB, bgA] = rgbaToUniform(state.cachedBackgroundColorRgba);
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
        if (uniforms.uSource)
          gl.uniform1i(uniforms.uSource, 0);
        if (uniforms.uResolution)
          gl.uniform2f(uniforms.uResolution, width, height);
        if (uniforms.uGridSize)
          gl.uniform1f(uniforms.uGridSize, r.gridSize);
        if (uniforms.uLineWidth)
          gl.uniform1f(uniforms.uLineWidth, r.lineWidth);
        if (uniforms.uLineColor)
          gl.uniform4f(uniforms.uLineColor, lineR, lineG, lineB, lineA);
        if (uniforms.uBackgroundColor)
          gl.uniform4f(uniforms.uBackgroundColor, bgR, bgG, bgB, bgA);
        if (uniforms.uRotation)
          gl.uniform1f(uniforms.uRotation, r.rotation * Math.PI / 180);
        if (uniforms.uRotationX)
          gl.uniform1f(uniforms.uRotationX, r.rotationX * Math.PI / 180);
        if (uniforms.uRotationY)
          gl.uniform1f(uniforms.uRotationY, r.rotationY * Math.PI / 180);
        if (uniforms.uPerspective)
          gl.uniform1f(uniforms.uPerspective, r.perspective);
        if (uniforms.uOffset)
          gl.uniform2f(uniforms.uOffset, r.offsetX, r.offsetY);
        if (uniforms.uMaskToSourceAlpha)
          gl.uniform1i(uniforms.uMaskToSourceAlpha, r.maskToSourceAlpha ? 1 : 0);
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
  schema: gridlinesSchema2,
  validateParams: validateGridlinesParams
});



;// ./node_modules/@remotion/effects/dist/esm/preview/gridlines.mjs






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
//# sourceMappingURL=5953.bundle.js.map