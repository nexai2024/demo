"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5300],{

/***/ 5300
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   bevelAlpha: () => (/* binding */ bevelAlpha)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(113);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/bevel-alpha/index.ts


// src/bevel-alpha/shaders.ts
var BEVEL_ALPHA_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var HEIGHT_ENCODING = `
// Store a 16-bit height in two 8-bit channels. This avoids banded normals
// without requiring floating-point render targets or WebGL extensions.
vec4 encodeHeight(float height) {
	float value = floor(clamp(height, 0.0, 1.0) * 65535.0 + 0.5);
	return vec4(floor(value / 256.0), mod(value, 256.0), 0.0, 255.0) / 255.0;
}
float decodeHeight(vec4 value) {
	return dot(value.rg, vec2(65280.0, 255.0)) / 65535.0;
}
`;
var buildBevelAlphaBlurShader = (direction) => `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uRadius;
${HEIGHT_ENCODING}
float readHeight(vec2 uv) {
	${direction === "horizontal" ? "return texture(uSource, uv).a;" : `
	// Decode before interpolating: packed channel values cannot be filtered.
	vec2 pixel = uv * uResolution - 0.5;
	ivec2 lower = ivec2(int(gl_FragCoord.x), int(floor(pixel.y)));
	ivec2 maximum = ivec2(uResolution) - 1;
	float a = decodeHeight(texelFetch(uSource, clamp(lower, ivec2(0), maximum), 0));
	float b = decodeHeight(texelFetch(uSource, clamp(lower + ivec2(0, 1), ivec2(0), maximum), 0));
	return mix(a, b, fract(pixel.y));`}
}
void main() {
	float radius = max(uRadius, 0.0001);
	int halfKernel = int(clamp(ceil(radius), 4.0, 64.0));
	float sigma = radius / 3.0;
	float sum = 0.0;
	float total = 0.0;
	for (int i = -64; i <= 64; i++) {
		if (abs(i) > halfKernel) continue;
		float offset = float(i) * radius / float(halfKernel);
		float weight = exp(-0.5 * offset * offset / (sigma * sigma));
		vec2 uv = vUv + ${direction === "horizontal" ? "vec2(offset, 0.0)" : "vec2(0.0, offset)"} / uResolution;
		sum += readHeight(uv) * weight;
		total += weight;
	}
	fragColor = encodeHeight(sum / total);
}
`;
var BEVEL_ALPHA_SHADE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform sampler2D uHeight;
uniform vec2 uResolution;
uniform float uEdgeThickness;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform float uLightIntensity;
${HEIGHT_ENCODING}
float heightAt(ivec2 pixel) {
	return decodeHeight(texelFetch(uHeight, clamp(pixel, ivec2(0), ivec2(uResolution) - 1), 0));
}
void main() {
	vec4 source = texelFetch(uSource, ivec2(gl_FragCoord.xy), 0);
	if (uEdgeThickness == 0.0 || uLightIntensity == 0.0 || source.a == 0.0) {
		fragColor = source;
		return;
	}
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	float dx = (heightAt(pixel + ivec2(1, 0)) - heightAt(pixel - ivec2(1, 0))) * 0.5;
	// Screen-space Y points down; texture-space Y points up.
	float dy = (heightAt(pixel - ivec2(0, 1)) - heightAt(pixel + ivec2(0, 1))) * 0.5;
	vec3 normal = normalize(vec3(-dx * uEdgeThickness * 1.25, -dy * uEdgeThickness * 1.25, 1.0));
	float shade = (dot(normal, uLightDirection) - uLightDirection.z) * uLightIntensity * 2.0;
	vec3 color = source.rgb;
	if (shade > 0.0) {
		color += uLightColor * shade * source.a;
	} else {
		color *= max(1.0 + shade, 0.0);
	}
	fragColor = vec4(clamp(color, vec3(0.0), vec3(source.a)), source.a);
}
`;

// src/bevel-alpha/webgpu-shaders.ts
var BEVEL_ALPHA_BLUR_WEBGPU_SHADER = `
${_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_MULTIPASS_BINDINGS */ .NK}
// Alpha-derived normals adapted from EffectCraft (MIT); see ../../THIRD_PARTY_LICENSES.md.
struct Params {resolution: vec2f, radius: f32, vertical: f32,}
fn decodeHeight(color: vec4f) -> f32 {return dot(color.rg,vec2f(65280,255))/65535.0;}
fn readHeight(uv: vec2f, x: f32) -> f32 {
 if (params.vertical==0.0) {return textureSampleLevel(source,sourceSampler,uv,0).a;}
 let pixel=uv*params.resolution-0.5;
 let lower=vec2i(i32(x),i32(floor(pixel.y)));
 let maximum=vec2i(params.resolution)-1;
 let a=decodeHeight(textureLoad(source,clamp(lower,vec2i(0),maximum),0));
 let b=decodeHeight(textureLoad(source,clamp(lower+vec2i(0,1),vec2i(0),maximum),0));
 return mix(a,b,fract(pixel.y));
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let radius=max(params.radius,0.0001);
 let halfKernel=i32(clamp(ceil(radius),4.0,64.0));
 let sigma=radius/3.0;
 var sum=0.0;var total=0.0;
 for (var i=-64;i<=64;i++) {
  if (abs(i)>halfKernel) {continue;}
  let offset=f32(i)*radius/f32(halfKernel);
  let weight=exp(-0.5*offset*offset/(sigma*sigma));
  let direction=select(vec2f(offset,0),vec2f(0,offset),params.vertical!=0.0);
  sum+=readHeight(input.uv+direction/params.resolution,input.position.x)*weight;
  total+=weight;
 }
 let value=floor(clamp(sum/total,0.0,1.0)*65535.0+0.5);
 return vec4f(floor(value/256.0),value-floor(value/256.0)*256.0,0,255)/255.0;
}
`;
var BEVEL_ALPHA_SHADE_WEBGPU_SHADER = `
${_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .WEBGPU_MULTIPASS_BINDINGS */ .NK}
struct Params {resolution: vec2f, thickness: f32, intensity: f32, direction: vec4f, color: vec4f,}
fn heightAt(pixel: vec2i) -> f32 {
 return dot(textureLoad(secondary,clamp(pixel,vec2i(0),vec2i(params.resolution)-1),0).rg,vec2f(65280,255))/65535.0;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let pixel=vec2i(input.position.xy);
 // The WebGL shading pass uses output pixel coordinates for texelFetch.
 // Retain that behavior for sources smaller than the output, with explicit
 // bounds because WebGPU robust texture access may clamp out-of-range loads.
 let size=vec2i(textureDimensions(source));
 let sourcePixel=vec2i(pixel.x,pixel.y+size.y-i32(params.resolution.y));
 if (any(sourcePixel<vec2i(0)) || any(sourcePixel>=size)) {return vec4f(0);}
 let color=textureLoad(source,sourcePixel,0);
 if (params.thickness==0.0 || params.intensity==0.0 || color.a==0.0) {return color;}
 let dx=(heightAt(pixel+vec2i(1,0))-heightAt(pixel-vec2i(1,0)))*0.5;
 let dy=(heightAt(pixel+vec2i(0,1))-heightAt(pixel-vec2i(0,1)))*0.5;
 let normal=normalize(vec3f(-dx*params.thickness*1.25,-dy*params.thickness*1.25,1));
 let shade=(dot(normal,params.direction.xyz)-params.direction.z)*params.intensity*2.0;
 var rgb=color.rgb;
 if (shade>0.0) {rgb+=params.color.rgb*shade*color.a;} else {rgb*=max(1.0+shade,0.0);}
 return vec4f(clamp(rgb,vec3f(0),vec3f(color.a)),color.a);
}`;

// src/bevel-alpha/index.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_EDGE_THICKNESS = 2;
var DEFAULT_LIGHT_ANGLE = -60;
var DEFAULT_LIGHT_COLOR = "white";
var DEFAULT_LIGHT_INTENSITY = 0.4;
var bevelAlphaSchema = {
  edgeThickness: {
    type: "number",
    min: 0,
    max: 200,
    step: 0.1,
    default: DEFAULT_EDGE_THICKNESS,
    description: "Edge thickness",
    hiddenFromList: false
  },
  lightAngle: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_LIGHT_ANGLE,
    description: "Light angle"
  },
  lightColor: {
    type: "color",
    default: DEFAULT_LIGHT_COLOR,
    description: "Light color"
  },
  lightIntensity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_LIGHT_INTENSITY,
    description: "Light intensity",
    hiddenFromList: false
  }
};
var resolve = (p) => ({
  edgeThickness: p.edgeThickness ?? DEFAULT_EDGE_THICKNESS,
  lightAngle: p.lightAngle ?? DEFAULT_LIGHT_ANGLE,
  lightColor: p.lightColor ?? DEFAULT_LIGHT_COLOR,
  lightIntensity: p.lightIntensity ?? DEFAULT_LIGHT_INTENSITY
});
var validateBevelAlphaParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Bevel alpha");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.edgeThickness, "edgeThickness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.lightAngle, "lightAngle");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalColor */ .gu)(params.lightColor, "lightColor");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.lightIntensity, "lightIntensity");
  const r = resolve(params);
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(r.edgeThickness, "edgeThickness");
  if (r.edgeThickness > 200)
    throw new TypeError('"edgeThickness" must be at most 200');
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.lightIntensity, "lightIntensity");
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
    throw new Error(`BevelAlpha shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`BevelAlpha program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var setupBevelAlpha = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl)
    throw createWebGL2ContextError("bevel alpha effect");
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const vs = compileShader(gl, gl.VERTEX_SHADER, BEVEL_ALPHA_VERTEX_SHADER);
  const programs = [
    buildBevelAlphaBlurShader("horizontal"),
    buildBevelAlphaBlurShader("vertical"),
    BEVEL_ALPHA_SHADE_SHADER
  ].map((source) => {
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, source);
    const shaderProgram = linkProgram(gl, vs, fs);
    gl.deleteShader(fs);
    return shaderProgram;
  });
  gl.deleteShader(vs);
  const [horizontalProgram, verticalProgram, program] = programs;
  const passes = [horizontalProgram, verticalProgram].map((p) => ({
    program: p,
    uSource: gl.getUniformLocation(p, "uSource"),
    uResolution: gl.getUniformLocation(p, "uResolution"),
    uRadius: gl.getUniformLocation(p, "uRadius")
  }));
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const framebuffer = gl.createFramebuffer();
  if (!vao || !vbo || !framebuffer)
    throw new Error("Could not allocate bevel alpha WebGL resources");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  const textures = [gl.LINEAR, gl.NEAREST, gl.NEAREST].map((filter) => {
    const texture = gl.createTexture();
    if (!texture)
      throw new Error("Could not allocate bevel alpha texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  gl.bindTexture(gl.TEXTURE_2D, null);
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!colorCtx)
    throw new Error("Failed to acquire 2D context for color parsing");
  return {
    gl,
    horizontal: passes[0],
    vertical: passes[1],
    program,
    vao,
    vbo,
    framebuffer,
    texture: textures[0],
    intermediate: textures[1],
    heightTexture: textures[2],
    uSource: gl.getUniformLocation(program, "uSource"),
    uHeight: gl.getUniformLocation(program, "uHeight"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uEdgeThickness: gl.getUniformLocation(program, "uEdgeThickness"),
    uLightDirection: gl.getUniformLocation(program, "uLightDirection"),
    uLightColor: gl.getUniformLocation(program, "uLightColor"),
    uLightIntensity: gl.getUniformLocation(program, "uLightIntensity"),
    colorCtx,
    cachedColor: "",
    cachedColorRgba: [255, 255, 255, 255],
    width: 0,
    height: 0
  };
};
var bevelAlpha = createEffect({
  type: "remotion/bevel-alpha",
  label: "bevelAlpha()",
  documentationLink: "https://www.remotion.dev/docs/effects/bevel-alpha",
  calculateKey: (params) => `bevel-alpha-${JSON.stringify(resolve(params))}`,
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const colorCtx = canvas.getContext("2d", { willReadFrequently: true });
        if (!colorCtx)
          throw new Error("Could not create color parser");
        return {
          ...(0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .setupWebGpuMultipass */ .SB)(target, "bevel-alpha"),
          colorCtx,
          cachedColor: null,
          cachedRgba: [0, 0, 0, 0]
        };
      },
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for this effect");
        const r = resolve(params);
        if (state.cachedColor !== r.lightColor) {
          state.cachedColor = r.lightColor;
          state.cachedRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, r.lightColor);
        }
        const color = state.cachedRgba.map((channel) => channel / 255);
        const angle = r.lightAngle % 360 * Math.PI / 180;
        (0,_index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .applyWebGpuMultipass */ .JM)({
          auxiliarySource: null,
          state,
          source,
          width,
          height,
          device: gpuDevice,
          passes: [
            {
              shader: BEVEL_ALPHA_BLUR_WEBGPU_SHADER,
              uniforms: new Float32Array([
                width,
                height,
                r.edgeThickness * 1.5,
                0
              ]),
              source: -1,
              secondary: -1
            },
            {
              shader: BEVEL_ALPHA_BLUR_WEBGPU_SHADER,
              uniforms: new Float32Array([
                width,
                height,
                r.edgeThickness * 1.5,
                1
              ]),
              source: 0,
              secondary: -1
            },
            {
              shader: BEVEL_ALPHA_SHADE_WEBGPU_SHADER,
              uniforms: new Float32Array([
                width,
                height,
                r.edgeThickness,
                r.lightIntensity,
                Math.sin(angle) * Math.SQRT1_2,
                -Math.cos(angle) * Math.SQRT1_2,
                Math.SQRT1_2,
                0,
                color[0] * color[3],
                color[1] * color[3],
                color[2] * color[3],
                0
              ]),
              source: -1,
              secondary: 1
            }
          ]
        });
      },
      cleanup: _index_7yztgwp5_mjs__WEBPACK_IMPORTED_MODULE_1__/* .cleanupWebGpuMultipass */ .$h
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: setupBevelAlpha,
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const {
          gl,
          texture,
          intermediate,
          heightTexture,
          program,
          vao,
          framebuffer
        } = state;
        if (state.cachedColor !== r.lightColor) {
          state.cachedColor = r.lightColor;
          state.cachedColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .parseColorRgba */ .zp)(state.colorCtx, r.lightColor);
        }
        gl.viewport(0, 0, width, height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        if (state.width !== width || state.height !== height) {
          for (const output of [intermediate, heightTexture]) {
            gl.bindTexture(gl.TEXTURE_2D, output);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          }
          state.width = width;
          state.height = height;
        }
        gl.bindVertexArray(vao);
        if (r.edgeThickness > 0 && r.lightIntensity > 0) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
          const ditherEnabled = gl.isEnabled(gl.DITHER);
          gl.disable(gl.DITHER);
          try {
            for (const [pass, input, output] of [
              [state.horizontal, texture, intermediate],
              [state.vertical, intermediate, heightTexture]
            ]) {
              gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
              if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
                throw new Error("Bevel alpha framebuffer is incomplete");
              gl.bindTexture(gl.TEXTURE_2D, input);
              gl.useProgram(pass.program);
              gl.uniform1i(pass.uSource, 0);
              gl.uniform2f(pass.uResolution, width, height);
              gl.uniform1f(pass.uRadius, r.edgeThickness * 1.5);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
          } finally {
            if (ditherEnabled)
              gl.enable(gl.DITHER);
          }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, heightTexture);
        gl.useProgram(program);
        gl.uniform1i(state.uSource, 0);
        gl.uniform1i(state.uHeight, 1);
        gl.uniform2f(state.uResolution, width, height);
        gl.uniform1f(state.uEdgeThickness, r.edgeThickness);
        const angle = r.lightAngle % 360 * Math.PI / 180;
        gl.uniform3f(state.uLightDirection, Math.sin(angle) * Math.SQRT1_2, -Math.cos(angle) * Math.SQRT1_2, Math.SQRT1_2);
        const [red, green, blue, alpha] = state.cachedColorRgba;
        gl.uniform3f(state.uLightColor, red / 255 * alpha / 255, green / 255 * alpha / 255, blue / 255 * alpha / 255);
        gl.uniform1f(state.uLightIntensity, r.lightIntensity);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: (state) => {
        const { gl } = state;
        for (const texture of [
          state.texture,
          state.intermediate,
          state.heightTexture
        ])
          gl.deleteTexture(texture);
        for (const program of [
          state.horizontal.program,
          state.vertical.program,
          state.program
        ])
          gl.deleteProgram(program);
        gl.deleteFramebuffer(state.framebuffer);
        gl.deleteBuffer(state.vbo);
        gl.deleteVertexArray(state.vao);
      }
    })
  },
  schema: bevelAlphaSchema,
  validateParams: validateBevelAlphaParams
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

/***/ 113
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $h: () => (/* binding */ cleanupWebGpuMultipass),
/* harmony export */   JM: () => (/* binding */ applyWebGpuMultipass),
/* harmony export */   NK: () => (/* binding */ WEBGPU_MULTIPASS_BINDINGS),
/* harmony export */   SB: () => (/* binding */ setupWebGpuMultipass)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);


// src/webgpu-multipass-runtime.ts
var WEBGPU_MULTIPASS_BINDINGS = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var secondary: texture_2d<f32>;
`;
var setupWebGpuMultipass = (target, label) => {
  const context = target.getContext("webgpu");
  if (!context)
    throw new Error(`WebGPU is not available for the ${label} effect`);
  return { context, label, resources: null };
};
var cleanupWebGpuMultipass = (state) => {
  state.resources?.source?.texture.destroy();
  state.resources?.auxiliary?.texture.destroy();
  state.resources?.textures.forEach((texture) => texture.destroy());
  state.resources?.passes.forEach((pass) => pass.uniforms.destroy());
  state.resources = null;
  state.context.unconfigure();
};
var applyWebGpuMultipass = ({
  state,
  source,
  width,
  height,
  device,
  passes,
  auxiliarySource
}) => {
  if (state.resources && state.resources.device !== device)
    cleanupWebGpuMultipass(state);
  if (!state.resources) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    state.context.configure({ device, format, alphaMode: "premultiplied" });
    const shared = (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .getSharedWebGpuResources */ .JR)({
      device,
      key: "multipass-layout",
      create: () => {
        const layout = device.createBindGroupLayout({
          entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: "uniform" }
            },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }
          ]
        });
        const sampler = device.createSampler({
          magFilter: "linear",
          minFilter: "linear"
        });
        return { layout, sampler };
      }
    });
    state.resources = {
      device,
      format,
      layout: shared.layout,
      sampler: shared.sampler,
      passes: [],
      textures: [],
      source: null,
      auxiliary: null,
      width,
      height
    };
  }
  const r = state.resources;
  const sourceWidth = "displayWidth" in source ? source.displayWidth : ("videoWidth" in source) ? source.videoWidth : ("naturalWidth" in source) ? source.naturalWidth : typeof source.width === "number" ? source.width : source.width.baseVal.value;
  const sourceHeight = "displayHeight" in source ? source.displayHeight : ("videoHeight" in source) ? source.videoHeight : ("naturalHeight" in source) ? source.naturalHeight : typeof source.height === "number" ? source.height : source.height.baseVal.value;
  if (r.source && (r.source.width !== sourceWidth || r.source.height !== sourceHeight)) {
    r.source.texture.destroy();
    r.source = null;
  }
  if (!r.source) {
    r.source = {
      width: sourceWidth,
      height: sourceHeight,
      texture: device.createTexture({
        size: [sourceWidth, sourceHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      })
    };
  }
  device.queue.copyExternalImageToTexture({ source }, { texture: r.source.texture, premultipliedAlpha: true }, [sourceWidth, sourceHeight]);
  if (r.auxiliary && (!auxiliarySource || r.auxiliary.width !== auxiliarySource.width || r.auxiliary.height !== auxiliarySource.height)) {
    r.auxiliary.texture.destroy();
    r.auxiliary = null;
  }
  if (auxiliarySource) {
    if (!r.auxiliary)
      r.auxiliary = {
        width: auxiliarySource.width,
        height: auxiliarySource.height,
        texture: device.createTexture({
          size: [auxiliarySource.width, auxiliarySource.height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        })
      };
    device.queue.copyExternalImageToTexture({ source: auxiliarySource }, { texture: r.auxiliary.texture, premultipliedAlpha: true }, [auxiliarySource.width, auxiliarySource.height]);
  }
  if (r.width !== width || r.height !== height) {
    r.textures.forEach((texture) => texture.destroy());
    r.textures.length = 0;
    r.width = width;
    r.height = height;
  }
  const lastReaders = passes.map((_, index) => index);
  for (let index = 0;index < passes.length; index++) {
    for (const input of [passes[index].source, passes[index].secondary]) {
      if (input >= 0)
        lastReaders[input] = index;
    }
  }
  const outputSlots = [];
  const freeAfter = [];
  for (let index = 0;index < passes.length - 1; index++) {
    let slot = freeAfter.findIndex((lastReader) => lastReader < index);
    if (slot === -1)
      slot = freeAfter.length;
    freeAfter[slot] = lastReaders[index];
    outputSlots.push(slot);
  }
  while (r.textures.length < freeAfter.length) {
    r.textures.push(device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    }));
  }
  while (r.textures.length > freeAfter.length)
    r.textures.pop()?.destroy();
  while (r.passes.length > passes.length)
    r.passes.pop()?.uniforms.destroy();
  const encoder = device.createCommandEncoder();
  for (let index = 0;index < passes.length; index++) {
    const pass = passes[index];
    const format = index === passes.length - 1 ? r.format : "rgba8unorm";
    const size = Math.max(16, Math.ceil(pass.uniforms.byteLength / 16) * 16);
    let resources = r.passes[index];
    if (!resources || resources.shader !== pass.shader || resources.size !== size || resources.format !== format) {
      resources?.uniforms.destroy();
      const pipeline = (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .getSharedWebGpuResources */ .JR)({
        device,
        key: JSON.stringify(["multipass-pipeline", pass.shader, format]),
        create: () => {
          const module = device.createShaderModule({
            code: pass.shader,
            label: state.label
          });
          return device.createRenderPipeline({
            label: state.label,
            layout: device.createPipelineLayout({ bindGroupLayouts: [r.layout] }),
            vertex: { module, entryPoint: "vertex" },
            fragment: { module, entryPoint: "fragment", targets: [{ format }] },
            primitive: { topology: "triangle-list" }
          });
        }
      });
      resources = {
        shader: pass.shader,
        size,
        format,
        pipeline,
        uniforms: device.createBuffer({
          size,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
      };
      r.passes[index] = resources;
    }
    device.queue.writeBuffer(resources.uniforms, 0, pass.uniforms);
    const bindGroup = device.createBindGroup({
      layout: r.layout,
      entries: [
        {
          binding: 0,
          resource: (pass.source === -1 ? r.source.texture : r.textures[outputSlots[pass.source]]).createView()
        },
        { binding: 1, resource: r.sampler },
        { binding: 2, resource: { buffer: resources.uniforms } },
        {
          binding: 3,
          resource: (pass.secondary === -2 && r.auxiliary ? r.auxiliary.texture : pass.secondary === -1 ? r.source.texture : r.textures[outputSlots[pass.secondary]]).createView()
        }
      ]
    });
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: (index === passes.length - 1 ? state.context.getCurrentTexture() : r.textures[outputSlots[index]]).createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    renderPass.setPipeline(resources.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3);
    renderPass.end();
  }
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




/***/ }

}]);
//# sourceMappingURL=5300.bundle.js.map