"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[336],{

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

/***/ 8840
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Ai: () => (/* binding */ setupWebGlProjection),
/* harmony export */   Ms: () => (/* binding */ applyWebGpuProjection),
/* harmony export */   RA: () => (/* binding */ applyWebGlProjection),
/* harmony export */   VO: () => (/* binding */ cleanupWebGlProjection),
/* harmony export */   o6: () => (/* binding */ cleanupWebGpuProjection),
/* harmony export */   vc: () => (/* binding */ setupWebGpuProjection)
/* harmony export */ });
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3947);
// src/webgl-projection-runtime.ts

var setupWebGlProjection = (target, shader) => {
  const gl = target.getContext("webgl2");
  if (!gl)
    throw remotion__WEBPACK_IMPORTED_MODULE_0__.Internals.createWebGL2ContextError("projection effect");
  const program = gl.createProgram();
  const shaders = [];
  try {
    for (const [type, code] of [
      [
        gl.VERTEX_SHADER,
        `#version 300 es
void main() {
 vec2 positions[3] = vec2[3](vec2(-1, -1), vec2(3, -1), vec2(-1, 3));
 gl_Position = vec4(positions[gl_VertexID], 0, 1);
}`
      ],
      [gl.FRAGMENT_SHADER, shader]
    ]) {
      const compiled = gl.createShader(type);
      shaders.push(compiled);
      gl.shaderSource(compiled, code);
      gl.compileShader(compiled);
      if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(compiled) ?? "Projection shader compilation failed");
      gl.attachShader(program, compiled);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? "Projection program linking failed");
  } catch (err) {
    gl.deleteProgram(program);
    throw err;
  } finally {
    for (const compiled of shaders)
      gl.deleteShader(compiled);
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return {
    gl,
    program,
    texture,
    vao: gl.createVertexArray(),
    uniforms: gl.getUniformLocation(program, "uParams"),
    source: gl.getUniformLocation(program, "uSource")
  };
};
var applyWebGlProjection = ({
  state,
  source,
  width,
  height,
  flipSourceY,
  uniformData
}) => {
  const { gl } = state;
  gl.viewport(0, 0, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.SCISSOR_TEST);
  gl.useProgram(state.program);
  gl.bindVertexArray(state.vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.uniform1i(state.source, 0);
  gl.uniform4fv(state.uniforms, uniformData);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
};
var cleanupWebGlProjection = ({
  gl,
  program,
  texture,
  vao
}) => {
  gl.deleteTexture(texture);
  gl.deleteProgram(program);
  gl.deleteVertexArray(vao);
};

// src/webgpu-projection-runtime.ts
var deviceResources = new WeakMap;
var lostDevices = new WeakSet;
var cleanupWebGpuProjection = (state) => {
  state.resources?.source?.texture.destroy();
  state.resources?.uniforms.destroy();
  state.resources = null;
  state.context.unconfigure();
};
var setupWebGpuProjection = (target, label) => {
  const context = target.getContext("webgpu");
  if (!context) {
    throw new Error(`WebGPU is not available for the ${label} effect`);
  }
  return { context, resources: null };
};
var applyWebGpuProjection = ({
  state,
  source,
  device,
  shader,
  uniformData
}) => {
  if (lostDevices.has(device)) {
    throw new Error("Cannot apply a WebGPU projection with a lost device");
  }
  const width = "displayWidth" in source ? source.displayWidth : ("videoWidth" in source) ? source.videoWidth : ("naturalWidth" in source) ? source.naturalWidth : typeof source.width === "number" ? source.width : source.width.baseVal.value;
  const height = "displayHeight" in source ? source.displayHeight : ("videoHeight" in source) ? source.videoHeight : ("naturalHeight" in source) ? source.naturalHeight : typeof source.height === "number" ? source.height : source.height.baseVal.value;
  const format = navigator.gpu.getPreferredCanvasFormat();
  if (state.resources && (state.resources.device !== device || state.resources.shader !== shader || state.resources.format !== format || state.resources.uniforms.size !== uniformData.byteLength)) {
    cleanupWebGpuProjection(state);
  }
  if (!state.resources) {
    let shared = deviceResources.get(device);
    if (!shared) {
      const pipelines = new Map;
      shared = {
        pipelines,
        sampler: device.createSampler({
          addressModeU: "repeat",
          magFilter: "linear",
          minFilter: "linear"
        })
      };
      deviceResources.set(device, shared);
      device.lost.then(() => {
        lostDevices.add(device);
        pipelines.clear();
        deviceResources.delete(device);
      });
    }
    let pipelinesByFormat = shared.pipelines.get(shader);
    if (!pipelinesByFormat) {
      pipelinesByFormat = new Map;
      shared.pipelines.set(shader, pipelinesByFormat);
    }
    let pipeline = pipelinesByFormat.get(format);
    if (!pipeline) {
      const module = device.createShaderModule({ code: shader });
      pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vertex" },
        fragment: { module, entryPoint: "fragment", targets: [{ format }] },
        primitive: { topology: "triangle-list" }
      });
      pipelinesByFormat.set(format, pipeline);
    }
    state.context.configure({ device, format, alphaMode: "premultiplied" });
    const uniforms = device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    state.resources = {
      device,
      shader,
      format,
      pipeline,
      uniforms,
      sampler: shared.sampler,
      source: null
    };
  }
  const { resources } = state;
  if (!resources.source || resources.source.width !== width || resources.source.height !== height) {
    const texture = device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    try {
      const bindGroup = device.createBindGroup({
        layout: resources.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: resources.sampler },
          { binding: 2, resource: { buffer: resources.uniforms } }
        ]
      });
      resources.source?.texture.destroy();
      resources.source = { texture, bindGroup, width, height };
    } catch (err) {
      texture.destroy();
      throw err;
    }
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

/***/ 336
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   pageTurn: () => (/* binding */ pageTurn)
/* harmony export */ });
/* harmony import */ var _index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(8840);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/page-turn/index.ts


// src/page-turn/shader.ts
var PAGE_TURN_SHADER = `
struct Params {
  resolution: vec2f,
  foldPosition: vec2f,
  geometry: vec4f,
  paperColor: vec4f,
  back: vec4f,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

@vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(positions[index], 0, 1);
}

fn samplePage(pixel: vec2f) -> vec4f {
  if (any(pixel < vec2f(0)) || any(pixel >= params.resolution)) { return vec4f(0); }
  // The shared projection sampler wraps horizontally; pages must not wrap at the edges.
  let uv = clamp(pixel, vec2f(0.5), params.resolution - vec2f(0.5)) / params.resolution;
  return textureSampleLevel(source, sourceSampler, uv, 0);
}

@fragment fn fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let radius = params.geometry.x;
  let direction = params.geometry.y;
  let normal = vec2f(-sin(direction), cos(direction));
  let distance = dot(position.xy - params.foldPosition, normal);
  let coverage = 1.0 - smoothstep(radius - max(fwidth(distance), 0.001), radius, distance);
  if (distance >= radius) { return vec4f(0); }

  var front = vec4f(0);
  var back = vec4f(0);
  var backDistance = 3.14159265359 * radius - distance;
  var backShade = 0.9;
  if (distance <= 0.0) {
    front = samplePage(position.xy);
  } else {
    let angle = asin(clamp(distance / radius, 0.0, 1.0));
    let frontDistance = radius * angle;
    backDistance = 3.14159265359 * radius - frontDistance;
    let light = params.geometry.z;
    let lightDot = normal.x * sin(light) - normal.y * cos(light);
    let shade = 1.0 - 0.4 * (angle / 1.57079632679) * (0.5 + 0.5 * lightDot);
    let color = samplePage(position.xy + normal * (frontDistance - distance));
    front = vec4f(color.rgb * shade, color.a);
    backShade = 0.6 + 0.4 * cos(angle);
  }
  let color = samplePage(position.xy + normal * (backDistance - distance));
  let tint = (1.0 - params.back.x) * params.paperColor.a;
  back = vec4f(mix(color.rgb, params.paperColor.rgb * color.a, tint) * backShade, color.a);
  if (params.geometry.w == 1.0) { return front * coverage; }
  if (params.geometry.w == 2.0) { return back * coverage; }
  // Premultiplied source-over: the curled back covers the front, which shows through its alpha.
  return (back + front * (1.0 - back.a)) * coverage;
}
`;

// src/page-turn/webgl-shader.ts
var PAGE_TURN_WEBGL_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec4 uParams[4];
out vec4 fragColor;

vec4 samplePage(vec2 pixel) {
  vec2 resolution = uParams[0].xy;
  if (any(lessThan(pixel, vec2(0))) || any(greaterThanEqual(pixel, resolution))) { return vec4(0); }
  // The shared projection sampler wraps horizontally; pages must not wrap at the edges.
  vec2 uv = clamp(pixel, vec2(0.5), resolution - vec2(0.5)) / resolution;
  return textureLod(uSource, vec2(uv.x, 1.0 - uv.y), 0.0);
}

vec4 project(vec2 position) {
  float radius = uParams[1].x;
  float direction = uParams[1].y;
  vec2 normal = vec2(-sin(direction), cos(direction));
  float distance = dot(position - uParams[0].zw, normal);
  float coverage = 1.0 - smoothstep(radius - max(fwidth(distance), 0.001), radius, distance);
  if (distance >= radius) { return vec4(0); }

  vec4 front = vec4(0);
  vec4 back = vec4(0);
  float backDistance = 3.14159265359 * radius - distance;
  float backShade = 0.9;
  if (distance <= 0.0) {
    front = samplePage(position);
  } else {
    float angle = asin(clamp(distance / radius, 0.0, 1.0));
    float frontDistance = radius * angle;
    backDistance = 3.14159265359 * radius - frontDistance;
    float light = uParams[1].z;
    float lightDot = normal.x * sin(light) - normal.y * cos(light);
    float shade = 1.0 - 0.4 * (angle / 1.57079632679) * (0.5 + 0.5 * lightDot);
    vec4 color = samplePage(position + normal * (frontDistance - distance));
    front = vec4(color.rgb * shade, color.a);
    backShade = 0.6 + 0.4 * cos(angle);
  }
  vec4 color = samplePage(position + normal * (backDistance - distance));
  float tint = (1.0 - uParams[3].x) * uParams[2].a;
  back = vec4(mix(color.rgb, uParams[2].rgb * color.a, tint) * backShade, color.a);
  if (uParams[1].w == 1.0) { return front * coverage; }
  if (uParams[1].w == 2.0) { return back * coverage; }
  // Premultiplied source-over: the curled back covers the front, which shows through its alpha.
  return (back + front * (1.0 - back.a)) * coverage;
}

void main() { fragColor = project(vec2(gl_FragCoord.x, uParams[0].y - gl_FragCoord.y)); }
`;

// src/page-turn/index.ts
var DEFAULT_FOLD_POSITION = [0.7, 0.7];
var DEFAULT_FOLD_DIRECTION = 315;
var DEFAULT_FOLD_RADIUS = 60;
var DEFAULT_LIGHT_DIRECTION = -45;
var DEFAULT_RENDER = "both";
var DEFAULT_BACK_PAGE_OPACITY = 0.25;
var DEFAULT_PAPER_COLOR = "#ffffff";
var pageTurnSchema = {
  foldPosition: {
    type: "uv-coordinate",
    default: DEFAULT_FOLD_POSITION,
    description: "Fold position"
  },
  foldDirection: {
    type: "rotation-degrees",
    default: DEFAULT_FOLD_DIRECTION,
    description: "Fold direction"
  },
  foldRadius: {
    type: "number",
    min: 1,
    max: 500,
    step: 1,
    default: DEFAULT_FOLD_RADIUS,
    description: "Fold radius",
    hiddenFromList: false
  },
  lightDirection: {
    type: "rotation-degrees",
    default: DEFAULT_LIGHT_DIRECTION,
    description: "Light direction"
  },
  render: {
    type: "enum",
    variants: { both: {}, front: {}, back: {} },
    default: DEFAULT_RENDER,
    description: "Faces"
  },
  backPageOpacity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_BACK_PAGE_OPACITY,
    description: "Back image opacity",
    hiddenFromList: false
  },
  paperColor: {
    type: "color",
    default: DEFAULT_PAPER_COLOR,
    description: "Paper color"
  }
};
var setupPageTurnColor = () => {
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
  if (!colorCtx)
    throw new Error("Could not create the page turn color context");
  return { colorCtx, cachedColor: null, cachedRgba: [255, 255, 255, 255] };
};
var resolve = (params) => ({
  foldPosition: params.foldPosition ?? DEFAULT_FOLD_POSITION,
  foldDirection: params.foldDirection ?? DEFAULT_FOLD_DIRECTION,
  foldRadius: params.foldRadius ?? DEFAULT_FOLD_RADIUS,
  lightDirection: params.lightDirection ?? DEFAULT_LIGHT_DIRECTION,
  render: params.render ?? DEFAULT_RENDER,
  backPageOpacity: params.backPageOpacity ?? DEFAULT_BACK_PAGE_OPACITY,
  paperColor: params.paperColor ?? DEFAULT_PAPER_COLOR
});
var getUniformData = (params, state, width, height) => {
  const r = resolve(params);
  if (state.cachedColor !== r.paperColor) {
    state.cachedColor = r.paperColor;
    state.cachedRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, r.paperColor);
  }
  const radians = Math.PI / 180;
  return new Float32Array([
    width,
    height,
    r.foldPosition[0] * width,
    r.foldPosition[1] * height,
    r.foldRadius,
    r.foldDirection % 360 * radians,
    r.lightDirection % 360 * radians,
    r.render === "front" ? 1 : r.render === "back" ? 2 : 0,
    ...state.cachedRgba.map((channel) => channel / 255),
    r.backPageOpacity,
    0,
    0,
    0
  ]);
};
var pageTurn = remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffect({
  type: "remotion/page-turn",
  label: "pageTurn()",
  documentationLink: "https://www.remotion.dev/docs/effects/page-turn",
  schema: pageTurnSchema,
  validateParams: (params) => {
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, "Page turn");
    for (const key of [
      "foldDirection",
      "foldRadius",
      "lightDirection",
      "backPageOpacity"
    ]) {
      (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params[key], key);
    }
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalColor */ .gu)(params.paperColor, "paperColor");
    const r = resolve(params);
    if (r.foldRadius <= 0)
      throw new TypeError('"foldRadius" must be greater than 0');
    (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .validateUnitInterval */ .yk)(r.backPageOpacity, "backPageOpacity");
    if (params.foldPosition !== undefined && (!Array.isArray(params.foldPosition) || params.foldPosition.length !== 2 || !Number.isFinite(params.foldPosition[0]) || !Number.isFinite(params.foldPosition[1]))) {
      throw new TypeError('"foldPosition" must contain two finite numbers');
    }
    if (params.render !== undefined && params.render !== "both" && params.render !== "front" && params.render !== "back") {
      throw new TypeError('"render" must be "both", "front", or "back"');
    }
  },
  calculateKey: (params) => {
    const r = resolve(params);
    return `page-turn-${r.foldPosition.join(",")}-${r.foldDirection}-${r.foldRadius}-${r.lightDirection}-${r.render}-${r.backPageOpacity}-${r.paperColor}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => ({
        ...setupPageTurnColor(),
        ...(0,_index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuProjection */ .vc)(target, "page turn")
      }),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the page turn effect");
        (0,_index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuProjection */ .Ms)({
          source,
          width,
          height,
          state,
          device: gpuDevice,
          shader: PAGE_TURN_SHADER,
          uniformData: getUniformData(params, state, width, height)
        });
      },
      cleanup: _index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuProjection */ .o6
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createEffectImplementation({
      setup: (target) => ({
        ...setupPageTurnColor(),
        ...(0,_index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGlProjection */ .Ai)(target, PAGE_TURN_WEBGL_SHADER)
      }),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        (0,_index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGlProjection */ .RA)({
          source,
          width,
          height,
          state,
          flipSourceY,
          uniformData: getUniformData(params, state, width, height)
        });
      },
      cleanup: _index_vp56k1gj_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGlProjection */ .VO
    })
  }
});



/***/ }

}]);
//# sourceMappingURL=336.bundle.js.map