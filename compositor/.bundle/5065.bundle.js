"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5065],{

/***/ 5065
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fractalNoise: () => (/* binding */ fractalNoise)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_4z6pt3ka_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(7191);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3947);





// src/fractal-noise/index.ts


// src/fractal-noise/shader.ts
var FRACTAL_NOISE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uOffset;
uniform float uScale;
uniform float uComplexity;
uniform float uEvolution;
uniform float uSubInfluence;
uniform float uSubScaling;
uniform float uContrast;
uniform float uBrightness;
uniform float uAmount;
uniform float uCycle;
uniform uint uSeed;
uniform int uFractalType;
uniform int uNoiseType;
uniform bool uInvert;
uniform bool uCycleEvolution;

${_index_4z6pt3ka_mjs__WEBPACK_IMPORTED_MODULE_1__/* .VALUE_NOISE_SHADER */ .t}

float layer(vec2 p, float z, uint seed) {
  if (!uCycleEvolution) return valueNoise(vec3(p, uEvolution + z), seed);
  float t = mod(uEvolution, uCycle);
  return mix(valueNoise(vec3(p, t + z), seed), valueNoise(vec3(p, t - uCycle + z), seed), t / uCycle);
}

float shape(float n) {
  float s = 2.0 * n - 1.0;
  if (uFractalType == 1) return 1.0 - s * s;
  if (uFractalType == 2) return 1.0 - abs(s);
  if (uFractalType == 3) return (1.0 - abs(s)) * (1.0 - abs(s));
  if (uFractalType == 8) {
    float distance = clamp(abs(s) / 0.12, 0.0, 1.0);
    return 1.0 - distance * distance;
  }
  return n;
}

void main() {
  vec4 source = texture(uSource, vUv);
  if (source.a == 0.0 || uAmount == 0.0) {
    fragColor = source;
    return;
  }
  // Use exact pixel centers so block noise stays stable at cell boundaries.
  vec2 pixel = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 base = (pixel - uResolution * 0.5 - uOffset) / uScale;
  float sum = 0.0;
  float norm = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float best = 0.0;
  for (int octave = 0; octave < 20; octave++) {
    float weight = clamp(uComplexity - float(octave), 0.0, 1.0);
    if (weight == 0.0 || amplitude == 0.0) break;
    vec2 p = base * frequency;
    float z = float(octave) * 7.31;
    uint seed = (uSeed ^ 0x51edu) + uint(octave);
    if (uFractalType >= 4 && uFractalType <= 6) {
      float a = layer(p * 0.5, z + 3.1, seed ^ 0x55u) - 0.5;
      if (uFractalType == 5) {
        float angle = a * 3.0;
        p = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * p;
      } else {
        float b = layer(p * 0.5, z + 5.7, seed ^ 0xaau) - 0.5;
        float strength = uFractalType == 6 ? 0.5 + float(octave) * 0.35 : 1.0;
        p += vec2(a, b) * 1.5 * strength;
      }
    }
    float n = shape(layer(p, z, seed));
    // Fade fractional octaves in for Max too, so animating complexity is continuous.
    best = max(best, n * amplitude * weight);
    sum += n * amplitude * weight;
    norm += amplitude * weight;
    amplitude *= uSubInfluence;
    frequency /= uSubScaling;
  }
  float noise = uFractalType == 7 ? best : sum / norm;
  noise = clamp((noise - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
  if (uInvert) noise = 1.0 - noise;
  fragColor = vec4(mix(source.rgb, vec3(noise) * source.a, uAmount), source.a);
}
`;

// src/fractal-noise/webgpu-shader.ts
var FRACTAL_NOISE_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

struct Params { size: vec2f, offset: vec2f, scale: f32, complexity: f32, evolution: f32, subInfluence: f32, subScaling: f32, contrast: f32, brightness: f32, amount: f32, cycle: f32, seed: u32, fractalType: f32, noiseType: f32, invert: f32, cycleEvolution: f32, }
fn noiseType() -> i32 { return i32(params.noiseType); }
${_index_4z6pt3ka_mjs__WEBPACK_IMPORTED_MODULE_1__/* .VALUE_NOISE_WEBGPU_SHADER */ .I}
fn layer(p: vec2f,z: f32,seed: u32) -> f32 {
  if(params.cycleEvolution==0.0) { return valueNoise(vec3f(p,params.evolution+z),seed); }
  let t=params.evolution-floor(params.evolution/params.cycle)*params.cycle;
  return mix(valueNoise(vec3f(p,t+z),seed),valueNoise(vec3f(p,t-params.cycle+z),seed),t/params.cycle);
}
fn shape(n: f32) -> f32 {
  let s=2.0*n-1.0;
  if(params.fractalType==1.0) { return 1.0-s*s; }
  if(params.fractalType==2.0) { return 1.0-abs(s); }
  if(params.fractalType==3.0) { return (1.0-abs(s))*(1.0-abs(s)); }
  if(params.fractalType==8.0) { let distance=clamp(abs(s)/0.12,0.0,1.0); return 1.0-distance*distance; }
  return n;
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
  let color=textureSampleLevel(source,sourceSampler,input.uv,0);
  if(color.a==0.0 || params.amount==0.0) { return color; }
  let pixel=input.position.xy;
  let base=(pixel-params.size*0.5-params.offset)/params.scale;
  var sum=0.0; var norm=0.0; var amplitude=1.0; var frequency=1.0; var best=0.0;
  for(var octave=0;octave<20;octave++) {
    let weight=clamp(params.complexity-f32(octave),0.0,1.0);
    if(weight==0.0 || amplitude==0.0) { break; }
    var p=base*frequency;
    let z=f32(octave)*7.31;
    let seed=(params.seed ^ 0x51edu)+u32(octave);
    if(params.fractalType>=4.0 && params.fractalType<=6.0) {
      let a=layer(p*0.5,z+3.1,seed ^ 0x55u)-0.5;
      if(params.fractalType==5.0) {
        let angle=a*3.0;
        p=mat2x2f(vec2f(cos(angle),sin(angle)),vec2f(-sin(angle),cos(angle)))*p;
      } else {
        let b=layer(p*0.5,z+5.7,seed ^ 0xaau)-0.5;
        let strength=select(1.0,0.5+f32(octave)*0.35,params.fractalType==6.0);
        p += vec2f(a,b)*1.5*strength;
      }
    }
    let n=shape(layer(p,z,seed));
    best=max(best,n*amplitude*weight); sum += n*amplitude*weight; norm += amplitude*weight;
    amplitude *= params.subInfluence; frequency /= params.subScaling;
  }
  var noise=select(sum/norm,best,params.fractalType==7.0);
  noise=clamp((noise-0.5)*params.contrast+0.5+params.brightness,0.0,1.0);
  if(params.invert!=0.0) { noise=1.0-noise; }
  return vec4f(mix(color.rgb,vec3f(noise)*color.a,params.amount),color.a);
}

`;

// src/fractal-noise/index.ts
var { createEffect, createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_4__.Internals;
var DEFAULT_FRACTAL_TYPE = "basic";
var DEFAULT_NOISE_TYPE = "soft-linear";
var DEFAULT_SCALE = 100;
var DEFAULT_COMPLEXITY = 6;
var DEFAULT_EVOLUTION = 0;
var DEFAULT_CONTRAST = 1;
var DEFAULT_BRIGHTNESS = 0;
var DEFAULT_OFFSET_X = 0;
var DEFAULT_OFFSET_Y = 0;
var DEFAULT_SUB_INFLUENCE = 0.7;
var DEFAULT_SUB_SCALING = 0.56;
var DEFAULT_CYCLE_EVOLUTION = false;
var DEFAULT_CYCLE = 1;
var DEFAULT_SEED = 0;
var DEFAULT_INVERT = false;
var DEFAULT_AMOUNT = 1;
var FRACTAL_TYPES = [
  "basic",
  "turbulent-smooth",
  "turbulent-basic",
  "turbulent-sharp",
  "dynamic",
  "dynamic-twist",
  "dynamic-progressive",
  "max",
  "strings"
];
var NOISE_TYPES = ["block", "linear", "soft-linear", "spline"];
var fractalNoiseSchema = {
  fractalType: {
    type: "enum",
    variants: {
      basic: {},
      "turbulent-smooth": {},
      "turbulent-basic": {},
      "turbulent-sharp": {},
      dynamic: {},
      "dynamic-twist": {},
      "dynamic-progressive": {},
      max: {},
      strings: {}
    },
    default: DEFAULT_FRACTAL_TYPE,
    description: "Fractal type"
  },
  noiseType: {
    type: "enum",
    variants: {
      block: {},
      linear: {},
      "soft-linear": {},
      spline: {}
    },
    default: DEFAULT_NOISE_TYPE,
    description: "Noise type"
  },
  scale: {
    type: "number",
    min: 1,
    max: 1000,
    step: 1,
    default: DEFAULT_SCALE,
    description: "Scale",
    hiddenFromList: false
  },
  complexity: {
    type: "number",
    min: 1,
    max: 20,
    step: 0.1,
    default: DEFAULT_COMPLEXITY,
    description: "Complexity",
    hiddenFromList: false
  },
  evolution: {
    type: "rotation-degrees",
    step: 1,
    default: DEFAULT_EVOLUTION,
    description: "Evolution"
  },
  contrast: {
    type: "number",
    min: 0,
    max: 10,
    step: 0.01,
    default: DEFAULT_CONTRAST,
    description: "Contrast",
    hiddenFromList: false
  },
  brightness: {
    type: "number",
    min: -1,
    max: 1,
    step: 0.01,
    default: DEFAULT_BRIGHTNESS,
    description: "Brightness",
    hiddenFromList: false
  },
  offsetX: {
    type: "number",
    step: 1,
    default: DEFAULT_OFFSET_X,
    description: "Offset X",
    hiddenFromList: false
  },
  offsetY: {
    type: "number",
    step: 1,
    default: DEFAULT_OFFSET_Y,
    description: "Offset Y",
    hiddenFromList: false
  },
  subInfluence: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_SUB_INFLUENCE,
    description: "Sub influence",
    hiddenFromList: false
  },
  subScaling: {
    type: "number",
    min: 0.1,
    max: 1,
    step: 0.01,
    default: DEFAULT_SUB_SCALING,
    description: "Sub scaling",
    hiddenFromList: false
  },
  cycleEvolution: {
    type: "boolean",
    default: DEFAULT_CYCLE_EVOLUTION,
    description: "Cycle evolution"
  },
  cycle: {
    type: "number",
    min: 1,
    max: 100,
    step: 1,
    integer: true,
    default: DEFAULT_CYCLE,
    description: "Cycle length",
    hiddenFromList: false
  },
  seed: {
    type: "number",
    min: 0,
    max: 4294967295,
    step: 1,
    integer: true,
    default: DEFAULT_SEED,
    description: "Seed",
    hiddenFromList: false
  },
  invert: {
    type: "boolean",
    default: DEFAULT_INVERT,
    description: "Invert"
  },
  amount: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: DEFAULT_AMOUNT,
    description: "Amount",
    hiddenFromList: false
  }
};
var resolve = (params) => ({
  fractalType: params.fractalType ?? DEFAULT_FRACTAL_TYPE,
  noiseType: params.noiseType ?? DEFAULT_NOISE_TYPE,
  scale: params.scale ?? DEFAULT_SCALE,
  complexity: params.complexity ?? DEFAULT_COMPLEXITY,
  evolution: params.evolution ?? DEFAULT_EVOLUTION,
  contrast: params.contrast ?? DEFAULT_CONTRAST,
  brightness: params.brightness ?? DEFAULT_BRIGHTNESS,
  offsetX: params.offsetX ?? DEFAULT_OFFSET_X,
  offsetY: params.offsetY ?? DEFAULT_OFFSET_Y,
  subInfluence: params.subInfluence ?? DEFAULT_SUB_INFLUENCE,
  subScaling: params.subScaling ?? DEFAULT_SUB_SCALING,
  cycleEvolution: params.cycleEvolution ?? DEFAULT_CYCLE_EVOLUTION,
  cycle: params.cycle ?? DEFAULT_CYCLE,
  seed: params.seed ?? DEFAULT_SEED,
  invert: params.invert ?? DEFAULT_INVERT,
  amount: params.amount ?? DEFAULT_AMOUNT
});
var validateFractalNoiseParams = (params) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertEffectParamsObject */ .db)(params, "Fractal noise");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.scale, "scale");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.complexity, "complexity");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.evolution, "evolution");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.contrast, "contrast");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.brightness, "brightness");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.offsetX, "offsetX");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.offsetY, "offsetY");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.subInfluence, "subInfluence");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.subScaling, "subScaling");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalBoolean */ .fX)(params.cycleEvolution, "cycleEvolution");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.cycle, "cycle");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_3__/* .assertOptionalBoolean */ .fX)(params.invert, "invert");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalFiniteNumber */ .FC)(params.amount, "amount");
  const r = resolve(params);
  if (params.fractalType !== undefined && !FRACTAL_TYPES.includes(params.fractalType)) {
    throw new TypeError("Invalid fractalType: " + JSON.stringify(params.fractalType));
  }
  if (params.noiseType !== undefined && !NOISE_TYPES.includes(params.noiseType)) {
    throw new TypeError("Invalid noiseType: " + JSON.stringify(params.noiseType));
  }
  if (r.scale < 1)
    throw new TypeError('"scale" must be at least 1');
  if (r.complexity < 1 || r.complexity > 20)
    throw new TypeError('"complexity" must be between 1 and 20');
  if (r.subScaling < 0.1 || r.subScaling > 1)
    throw new TypeError('"subScaling" must be between 0.1 and 1');
  if (!Number.isInteger(r.cycle) || r.cycle < 1 || r.cycle > 65535)
    throw new TypeError('"cycle" must be an integer between 1 and 65535');
  if (!Number.isInteger(r.seed) || r.seed < 0 || r.seed > 4294967295)
    throw new TypeError('"seed" must be an unsigned 32-bit integer');
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateNonNegative */ .XP)(r.contrast, "contrast");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.subInfluence, "subInfluence");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_2__/* .validateUnitInterval */ .yk)(r.amount, "amount");
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
    throw new Error(`FractalNoise shader compile failed: ${log ?? "(no log)"}`);
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
    throw new Error(`FractalNoise program link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var setupFractalNoise = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("fractal noise effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRACTAL_NOISE_FRAGMENT_SHADER);
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return {
    gl,
    program,
    vao,
    vbo,
    texture,
    uSource: gl.getUniformLocation(program, "uSource"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uOffset: gl.getUniformLocation(program, "uOffset"),
    uFractalType: gl.getUniformLocation(program, "uFractalType"),
    uNoiseType: gl.getUniformLocation(program, "uNoiseType"),
    uScale: gl.getUniformLocation(program, "uScale"),
    uComplexity: gl.getUniformLocation(program, "uComplexity"),
    uEvolution: gl.getUniformLocation(program, "uEvolution"),
    uContrast: gl.getUniformLocation(program, "uContrast"),
    uBrightness: gl.getUniformLocation(program, "uBrightness"),
    uSubInfluence: gl.getUniformLocation(program, "uSubInfluence"),
    uSubScaling: gl.getUniformLocation(program, "uSubScaling"),
    uCycleEvolution: gl.getUniformLocation(program, "uCycleEvolution"),
    uCycle: gl.getUniformLocation(program, "uCycle"),
    uSeed: gl.getUniformLocation(program, "uSeed"),
    uInvert: gl.getUniformLocation(program, "uInvert"),
    uAmount: gl.getUniformLocation(program, "uAmount")
  };
};
var fractalNoise = createEffect({
  type: "remotion/fractal-noise",
  label: "fractalNoise()",
  documentationLink: "https://www.remotion.dev/docs/effects/fractal-noise",
  calculateKey: (params) => {
    const r = resolve(params);
    return `fractal-noise-${JSON.stringify(r)}`;
  },
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "index"),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the index effect");
        const r = resolve(params);
        const uniformData = new Float32Array([
          width,
          height,
          r.offsetX,
          r.offsetY,
          r.scale,
          r.complexity,
          r.evolution / 360,
          r.subInfluence,
          r.subScaling,
          r.contrast,
          r.brightness,
          r.amount,
          r.cycle,
          0,
          FRACTAL_TYPES.indexOf(r.fractalType),
          NOISE_TYPES.indexOf(r.noiseType),
          r.invert ? 1 : 0,
          r.cycleEvolution ? 1 : 0,
          0,
          0
        ]);
        new Uint32Array(uniformData.buffer)[13] = r.seed;
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device: gpuDevice,
          shader: FRACTAL_NOISE_WEBGPU_SHADER,
          uniformData
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_4__.Internals.createEffectImplementation({
      setup: (target) => setupFractalNoise(target),
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        const r = resolve(params);
        const { gl, program, texture, vao } = state;
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.useProgram(program);
        if (state.uSource)
          gl.uniform1i(state.uSource, 0);
        if (state.uResolution)
          gl.uniform2f(state.uResolution, width, height);
        if (state.uOffset)
          gl.uniform2f(state.uOffset, r.offsetX, r.offsetY);
        if (state.uFractalType)
          gl.uniform1i(state.uFractalType, FRACTAL_TYPES.indexOf(r.fractalType));
        if (state.uNoiseType)
          gl.uniform1i(state.uNoiseType, NOISE_TYPES.indexOf(r.noiseType));
        if (state.uScale)
          gl.uniform1f(state.uScale, r.scale);
        if (state.uComplexity)
          gl.uniform1f(state.uComplexity, r.complexity);
        if (state.uEvolution)
          gl.uniform1f(state.uEvolution, r.evolution / 360);
        if (state.uContrast)
          gl.uniform1f(state.uContrast, r.contrast);
        if (state.uBrightness)
          gl.uniform1f(state.uBrightness, r.brightness);
        if (state.uSubInfluence)
          gl.uniform1f(state.uSubInfluence, r.subInfluence);
        if (state.uSubScaling)
          gl.uniform1f(state.uSubScaling, r.subScaling);
        if (state.uCycleEvolution)
          gl.uniform1i(state.uCycleEvolution, r.cycleEvolution ? 1 : 0);
        if (state.uCycle)
          gl.uniform1f(state.uCycle, r.cycle);
        if (state.uSeed)
          gl.uniform1ui(state.uSeed, r.seed);
        if (state.uInvert)
          gl.uniform1i(state.uInvert, r.invert ? 1 : 0);
        if (state.uAmount)
          gl.uniform1f(state.uAmount, r.amount);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.useProgram(null);
      },
      cleanup: ({ gl, program, vao, vbo, texture }) => {
        gl.deleteTexture(texture);
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteVertexArray(vao);
      }
    })
  },
  schema: fractalNoiseSchema,
  validateParams: validateFractalNoiseParams
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

/***/ 7191
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   I: () => (/* binding */ VALUE_NOISE_WEBGPU_SHADER),
/* harmony export */   t: () => (/* binding */ VALUE_NOISE_SHADER)
/* harmony export */ });
// src/value-noise-shader.ts
var VALUE_NOISE_SHADER = `
float lattice(ivec3 point, uint seed) {
  // Wrap lattice indices as well as coordinates so interpolation stays continuous
  // across the period boundary, including negative coordinates.
  uvec3 p = uvec3(point) & uvec3(65535u);
  uint h = p.x * 0x27d4eb2du ^ p.y * 0x165667b1u ^ p.z * 0x9e3779b9u ^ seed * 0x85ebca6bu;
  h ^= h >> 15;
  h *= 0x2c1b3c6du;
  h ^= h >> 12;
  h *= 0x297a2d39u;
  h ^= h >> 15;
  return float(h & 65535u) / 65535.0;
}

float catmull(vec4 p, float t) {
  return 0.5 * (2.0 * p.y + (p.z - p.x) * t
    + (2.0 * p.x - 5.0 * p.y + 4.0 * p.z - p.w) * t * t
    + (3.0 * p.y - p.x - 3.0 * p.z + p.w) * t * t * t);
}

vec3 bspline(float t) {
  return vec3(0.5 * (1.0-t) * (1.0-t), 0.5 + t * (1.0-t), 0.5 * t * t);
}

float sliceNoise(ivec3 p, vec2 t, uint seed) {
  if (uNoiseType == 0) return lattice(p, seed);
  if (uNoiseType == 1) {
    return mix(mix(lattice(p, seed), lattice(p + ivec3(1,0,0), seed), t.x),
      mix(lattice(p + ivec3(0,1,0), seed), lattice(p + ivec3(1,1,0), seed), t.x), t.y);
  }
  if (uNoiseType == 2) {
    vec3 wx = bspline(t.x);
    vec3 wy = bspline(t.y);
    float result = 0.0;
    for (int y = 0; y < 3; y++) {
      for (int x = 0; x < 3; x++) {
        result += wx[x] * wy[y] * lattice(p + ivec3(x-1, y-1, 0), seed);
      }
    }
    return result;
  }
  vec4 rows;
  for (int y = 0; y < 4; y++) {
    vec4 row;
    for (int x = 0; x < 4; x++) {
      row[x] = lattice(p + ivec3(x-1, y-1, 0), seed);
    }
    rows[y] = catmull(row, t.x);
  }
  return catmull(rows, t.y);
}

float valueNoise(vec3 point, uint seed) {
  // A large period keeps conversion to integer coordinates defined at extreme scales.
  vec3 p = mod(point + vec3(uNoiseType == 2 ? 0.5 : 0.0, uNoiseType == 2 ? 0.5 : 0.0, 0.0), 65536.0);
  ivec3 cell = ivec3(floor(p));
  vec3 t = fract(p);
  float fz = t.z * t.z * t.z * (t.z * (t.z * 6.0 - 15.0) + 10.0);
  float n = mix(sliceNoise(cell, t.xy, seed), sliceNoise(cell + ivec3(0,0,1), t.xy, seed), fz);
  return uNoiseType == 2 ? 0.5 + (n - 0.5) * (181.0 / 231.0) / 0.55 : n;
}
`;

// src/value-noise-webgpu-shader.ts
var VALUE_NOISE_WEBGPU_SHADER = `
fn lattice(point: vec3i, seed: u32) -> f32 {
  let p = bitcast<vec3u>(point) & vec3u(65535u);
  var h = (p.x*0x27d4eb2du) ^ (p.y*0x165667b1u) ^ (p.z*0x9e3779b9u) ^ (seed*0x85ebca6bu);
  h ^= h >> 15u; h *= 0x2c1b3c6du; h ^= h >> 12u; h *= 0x297a2d39u; h ^= h >> 15u;
  return f32(h & 65535u)/65535.0;
}
fn catmull(p: vec4f, t: f32) -> f32 {
  return 0.5*(2.0*p.y+(p.z-p.x)*t+(2.0*p.x-5.0*p.y+4.0*p.z-p.w)*t*t+(3.0*p.y-p.x-3.0*p.z+p.w)*t*t*t);
}
fn bspline(t: f32) -> vec3f { return vec3f(0.5*(1.0-t)*(1.0-t),0.5+t*(1.0-t),0.5*t*t); }
fn sliceNoise(p: vec3i,t: vec2f,seed: u32) -> f32 {
  if(noiseType()==0) { return lattice(p,seed); }
  if(noiseType()==1) { return mix(mix(lattice(p,seed),lattice(p+vec3i(1,0,0),seed),t.x),mix(lattice(p+vec3i(0,1,0),seed),lattice(p+vec3i(1,1,0),seed),t.x),t.y); }
  if(noiseType()==2) {
    let wx=bspline(t.x); let wy=bspline(t.y); var result=0.0;
    for(var y=0;y<3;y++) { for(var x=0;x<3;x++) { result += wx[x]*wy[y]*lattice(p+vec3i(x-1,y-1,0),seed); } }
    return result;
  }
  var rows: vec4f;
  for(var y=0;y<4;y++) {
    var row: vec4f;
    for(var x=0;x<4;x++) { row[x]=lattice(p+vec3i(x-1,y-1,0),seed); }
    rows[y]=catmull(row,t.x);
  }
  return catmull(rows,t.y);
}
fn valueNoise(point: vec3f,seed: u32) -> f32 {
  let offset=select(0.0,0.5,noiseType()==2);
  let shifted=point+vec3f(offset,offset,0.0);
  let p=shifted-floor(shifted/65536.0)*65536.0;
  let cell=vec3i(floor(p)); let t=fract(p);
  let fz=t.z*t.z*t.z*(t.z*(t.z*6.0-15.0)+10.0);
  let n=mix(sliceNoise(cell,t.xy,seed),sliceNoise(cell+vec3i(0,0,1),t.xy,seed),fz);
  return select(n,0.5+(n-0.5)*(181.0/231.0)/0.55,noiseType()==2);
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
//# sourceMappingURL=5065.bundle.js.map