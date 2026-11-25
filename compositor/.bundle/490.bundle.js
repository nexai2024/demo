"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[490],{

/***/ 490
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   blur: () => (/* binding */ blur)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(113);
/* harmony import */ var _index_cs953yag_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6064);
/* harmony import */ var _index_b86qstcs_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6654);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3947);






// src/blur/index.ts


// src/blur/blur-runtime.ts

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
    throw new Error(`Shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`Program link failed: ${log ?? "(no log)"}`);
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
var getBlurUniforms = (gl, program) => ({
  uRadius: gl.getUniformLocation(program, "uRadius"),
  uTexelSize: gl.getUniformLocation(program, "uTexelSize"),
  uSource: gl.getUniformLocation(program, "uSource")
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
var setupBlur = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("blur effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const programHorizontal = createProgram(gl, _index_b86qstcs_mjs__WEBPACK_IMPORTED_MODULE_3__/* .BLUR_VS */ .WV, _index_b86qstcs_mjs__WEBPACK_IMPORTED_MODULE_3__/* .BLUR_FS_HORIZONTAL */ .F7);
  const programVertical = createProgram(gl, _index_b86qstcs_mjs__WEBPACK_IMPORTED_MODULE_3__/* .BLUR_VS */ .WV, _index_b86qstcs_mjs__WEBPACK_IMPORTED_MODULE_3__/* .BLUR_FS_VERTICAL */ .FG);
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
    throw new Error(`Blur framebuffer incomplete: 0x${status.toString(16)}`);
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
    horizontal: getBlurUniforms(gl, programHorizontal),
    vertical: getBlurUniforms(gl, programVertical)
  };
};
var cleanupBlur = (state) => {
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
var setBlurUniforms = ({
  gl,
  uniforms,
  radius,
  width,
  height
}) => {
  if (uniforms.uSource)
    gl.uniform1i(uniforms.uSource, 0);
  if (uniforms.uRadius)
    gl.uniform1f(uniforms.uRadius, radius);
  if (uniforms.uTexelSize)
    gl.uniform2f(uniforms.uTexelSize, 1 / width, 1 / height);
};
var drawFullscreenQuad = (state) => {
  const { gl, vao } = state;
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
};
var uploadBlurSource = ({
  gl,
  textureSource,
  source,
  textureIntermediate,
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
var applyBlur = ({
  state,
  source,
  width,
  height,
  radius,
  horizontal,
  vertical,
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
  uploadBlurSource({
    gl,
    textureSource,
    source,
    textureIntermediate,
    width,
    height,
    flipSourceY
  });
  gl.clearColor(0, 0, 0, 0);
  if (!horizontal && !vertical) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureSource);
    gl.useProgram(programVertical);
    setBlurUniforms({
      gl,
      uniforms: state.vertical,
      radius: 0,
      width,
      height
    });
    drawFullscreenQuad(state);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
    return;
  }
  if (horizontal && vertical) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureSource);
    gl.useProgram(programHorizontal);
    setBlurUniforms({
      gl,
      uniforms: state.horizontal,
      radius,
      width,
      height
    });
    drawFullscreenQuad(state);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, textureIntermediate);
    gl.useProgram(programVertical);
    setBlurUniforms({
      gl,
      uniforms: state.vertical,
      radius,
      width,
      height
    });
    drawFullscreenQuad(state);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
    return;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textureSource);
  gl.useProgram(horizontal ? programHorizontal : programVertical);
  setBlurUniforms({
    gl,
    uniforms: horizontal ? state.horizontal : state.vertical,
    radius,
    width,
    height
  });
  drawFullscreenQuad(state);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
};

// src/blur/index.ts
var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_5__.Internals;
var resolveBlurParams = (params) => ({
  radius: params.radius,
  horizontal: params.horizontal ?? true,
  vertical: params.vertical ?? true
});
var blurSchema = {
  radius: {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
    default: 40,
    description: "Radius",
    hiddenFromList: false
  },
  horizontal: {
    type: "boolean",
    default: true,
    description: "Horizontal"
  },
  vertical: {
    type: "boolean",
    default: true,
    description: "Vertical"
  }
};
var validateBlurParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_4__/* .assertEffectParamsObject */ .db)(params, "Blur");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_4__/* .assertRequiredFiniteNumber */ .c1)(params.radius, "radius");
};
var blur = createEffect({
  type: "dev.remotion.effects.blur",
  label: "blur()",
  documentationLink: "https://www.remotion.dev/docs/effects/blur",
  calculateKey: (params) => {
    const r = resolveBlurParams(params);
    return `${r.radius}-${r.horizontal ? 1 : 0}-${r.vertical ? 1 : 0}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_5__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMultipass */ .SB)(target, "blur"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for this effect");
        const r = resolveBlurParams(params);
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
                r.horizontal ? r.radius : 0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
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
                r.vertical ? r.radius : 0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
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
      setup: (target) => setupBlur(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolveBlurParams(params);
        applyBlur({
          state,
          source,
          width,
          height,
          radius: r.radius,
          horizontal: r.horizontal,
          vertical: r.vertical,
          flipSourceY
        });
      },
      cleanup: (state) => cleanupBlur(state)
    })
  },
  schema: blurSchema,
  validateParams: validateBlurParams
});



/***/ },

/***/ 6654
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   F7: () => (/* binding */ BLUR_FS_HORIZONTAL),
/* harmony export */   FG: () => (/* binding */ BLUR_FS_VERTICAL),
/* harmony export */   WV: () => (/* binding */ BLUR_VS)
/* harmony export */ });
/* harmony import */ var _index_evy8hyah_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9028);


// src/blur/blur-shaders.ts
var BLUR_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var BLUR_FS_HORIZONTAL = (0,_index_evy8hyah_mjs__WEBPACK_IMPORTED_MODULE_0__/* .buildGaussianBlurFs */ .c)("horizontal");
var BLUR_FS_VERTICAL = (0,_index_evy8hyah_mjs__WEBPACK_IMPORTED_MODULE_0__/* .buildGaussianBlurFs */ .c)("vertical");




/***/ }

}]);
//# sourceMappingURL=490.bundle.js.map