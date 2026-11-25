"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[5639],{

/***/ 5639
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   H9: () => (/* binding */ cleanupWeather),
/* harmony export */   I_: () => (/* binding */ COMMON_WEATHER_DEFAULTS),
/* harmony export */   Kf: () => (/* binding */ setupWeatherWebGpu),
/* harmony export */   Sl: () => (/* binding */ validateWeatherRange),
/* harmony export */   Tf: () => (/* binding */ drawWeatherWebGpu),
/* harmony export */   Tv: () => (/* binding */ cleanupWeatherWebGpu),
/* harmony export */   UX: () => (/* binding */ createWeatherSchema),
/* harmony export */   r8: () => (/* binding */ resolveWeatherParams),
/* harmony export */   tY: () => (/* binding */ drawWeather),
/* harmony export */   yB: () => (/* binding */ setupWeather),
/* harmony export */   zC: () => (/* binding */ validateWeatherParams)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var _index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8197);
/* harmony import */ var _index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4075);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3947);




// src/weather/params.ts
var COMMON_WEATHER_DEFAULTS = {
  time: 0,
  sceneDepth: 5000,
  spread: 0,
  compositeWithOriginal: true,
  offset: [0.5, 0.5],
  seed: 0
};
var createWeatherSchema = (defaults, maxSpeed, maxWind) => ({
  time: {
    type: "number",
    min: 0,
    max: 10,
    step: 0.01,
    default: defaults.time,
    description: "Time",
    hiddenFromList: false
  },
  size: {
    type: "number",
    min: 0,
    max: 50,
    step: 0.01,
    default: defaults.size,
    description: "Size",
    hiddenFromList: false
  },
  sceneDepth: {
    type: "number",
    min: 0,
    max: 20000,
    step: 1,
    default: defaults.sceneDepth,
    description: "Scene depth",
    hiddenFromList: false
  },
  speed: {
    type: "number",
    min: 0,
    max: maxSpeed,
    step: 1,
    default: defaults.speed,
    description: "Speed",
    hiddenFromList: false
  },
  wind: {
    type: "number",
    min: -maxWind,
    max: maxWind,
    step: 1,
    default: defaults.wind,
    description: "Wind",
    hiddenFromList: false
  },
  windVariation: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: defaults.windVariation,
    description: "Wind variation",
    hiddenFromList: false
  },
  spread: {
    type: "number",
    min: 0,
    max: 1000,
    step: 1,
    default: defaults.spread,
    description: "Spread",
    hiddenFromList: false
  },
  opacity: {
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: defaults.opacity,
    description: "Opacity",
    hiddenFromList: false
  },
  color: { type: "color", default: defaults.color, description: "Color" },
  transferMode: {
    type: "enum",
    variants: { composite: {}, lighten: {} },
    default: defaults.transferMode,
    description: "Transfer mode"
  },
  compositeWithOriginal: {
    type: "boolean",
    default: defaults.compositeWithOriginal,
    description: "Composite with original"
  },
  offset: {
    type: "uv-coordinate",
    step: 0.01,
    default: defaults.offset,
    description: "Offset"
  },
  seed: {
    type: "number",
    min: 0,
    max: 4294967295,
    step: 1,
    integer: true,
    default: defaults.seed,
    description: "Seed",
    hiddenFromList: false
  }
});
var resolveWeatherParams = (params, defaults) => ({
  time: params.time ?? defaults.time,
  size: params.size ?? defaults.size,
  sceneDepth: params.sceneDepth ?? defaults.sceneDepth,
  speed: params.speed ?? defaults.speed,
  wind: params.wind ?? defaults.wind,
  windVariation: params.windVariation ?? defaults.windVariation,
  spread: params.spread ?? defaults.spread,
  color: params.color ?? defaults.color,
  opacity: params.opacity ?? defaults.opacity,
  transferMode: params.transferMode ?? defaults.transferMode,
  compositeWithOriginal: params.compositeWithOriginal ?? defaults.compositeWithOriginal,
  offset: params.offset ?? defaults.offset,
  seed: params.seed ?? defaults.seed
});
var validateWeatherRange = (value, name, min, max) => {
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(value, name);
  if (value === undefined)
    return;
  if (value < min || max !== null && value > max) {
    throw new TypeError(`"${name}" must be ${max === null ? `at least ${min}` : `between ${min} and ${max}`}, but got ${value}`);
  }
};
var validateWeatherParams = (params, label, maxSpeed, maxWind) => {
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertEffectParamsObject */ .db)(params, label);
  validateWeatherRange(params.time, "time", 0, null);
  validateWeatherRange(params.size, "size", 0, 50);
  validateWeatherRange(params.sceneDepth, "sceneDepth", 0, 20000);
  validateWeatherRange(params.speed, "speed", 0, maxSpeed);
  validateWeatherRange(params.wind, "wind", -maxWind, maxWind);
  validateWeatherRange(params.windVariation, "windVariation", 0, 1);
  validateWeatherRange(params.spread, "spread", 0, 1000);
  validateWeatherRange(params.opacity, "opacity", 0, 1);
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalColor */ .gu)(params.color, "color");
  (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertOptionalBoolean */ .fX)(params.compositeWithOriginal, "compositeWithOriginal");
  (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .assertOptionalFiniteNumber */ .FC)(params.seed, "seed");
  if (params.seed !== undefined && (!Number.isInteger(params.seed) || params.seed < 0 || params.seed > 4294967295)) {
    throw new TypeError('"seed" must be an unsigned 32-bit integer');
  }
  if (params.transferMode !== undefined && params.transferMode !== "composite" && params.transferMode !== "lighten") {
    throw new TypeError('"transferMode" must be "composite" or "lighten"');
  }
  if (params.offset !== undefined) {
    if (!Array.isArray(params.offset) || params.offset.length !== 2) {
      throw new TypeError('"offset" must be a [number, number] tuple');
    }
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertRequiredFiniteNumber */ .c1)(params.offset[0], "offset[0]");
    (0,_index_4fvp93ps_mjs__WEBPACK_IMPORTED_MODULE_2__/* .assertRequiredFiniteNumber */ .c1)(params.offset[1], "offset[1]");
  }
};

// src/weather/runtime.ts


// src/weather/shaders.ts
var WEATHER_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform int uSnow;
uniform float uTime;
uniform uint uSeed;
uniform vec2 uOffset;
uniform float uSize;
uniform float uSizeVariation;
uniform float uSceneDepth;
uniform float uSpeed;
uniform float uSpeedVariation;
uniform float uWind;
uniform float uWindVariation;
uniform float uSpread;
uniform float uWiggleAmount;
uniform float uWiggleAmountVariation;
uniform float uWiggleFrequency;
uniform float uWiggleFrequencyVariation;
uniform vec4 uColor;
uniform float uOpacity;
uniform int uRefract;

flat out vec2 vPosition;
flat out vec2 vLine;
flat out float vRadius;
flat out vec4 vColor;

float noise(uint i, uint key) {
	uint h = i * 0x8da6b343u ^ key * 0xd8163841u ^ uSeed * 0xcb1ab31fu;
	h ^= h >> 13;
	h *= 0x5bd1e995u;
	h ^= h >> 15;
	return float(h & 0x00ffffffu) / 16777216.0;
}

float signedNoise(uint i, uint key) {
	return noise(i, key) * 2.0 - 1.0;
}

float wrap(float value, float margin, float size) {
	return -margin + mod(value + margin, size + 2.0 * margin);
}

vec4 sourcePixel(ivec2 p) {
	ivec2 size = textureSize(uSource, 0);
	if (p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y) {
		return vec4(0.0);
	}
	return texelFetch(uSource, ivec2(p.x, size.y - 1 - p.y), 0);
}

// Bilinear sampling with transparent borders, at pixel centers of +0.5.
vec4 sourceAt(vec2 position) {
	vec2 p = position - 0.5;
	ivec2 base = ivec2(floor(p));
	vec2 f = fract(p);
	return mix(
		mix(sourcePixel(base), sourcePixel(base + ivec2(1, 0)), f.x),
		mix(sourcePixel(base + ivec2(0, 1)), sourcePixel(base + ivec2(1, 1)), f.x),
		f.y
	);
}

void main() {
	uint i = uint(gl_InstanceID);
	float depth = 1.0 / (1.0 + noise(i, 1u) * uSceneDepth / 2500.0);
	vec2 offset = (uOffset - 0.5) * uResolution;
	vec2 position;
	vec2 line = vec2(0.0);
	float radius;
	float alpha;
	if (uSnow == 1) {
		radius = max(uSize * 0.5 * depth * (1.0 + uSizeVariation * signedNoise(i, 2u)), 0.05);
		float speed = uSpeed * (uResolution.y / 600.0) * depth * (1.0 + uSpeedVariation * signedNoise(i, 3u));
		float wind = uWind * (uResolution.y / 1200.0) * depth * (1.0 + uWindVariation * signedNoise(i, 4u))
			+ uSpread * signedNoise(i, 8u) * depth;
		float amplitude = uWiggleAmount * 2.0 * depth * (1.0 + uWiggleAmountVariation * signedNoise(i, 5u));
		float frequency = uWiggleFrequency * (1.0 + uWiggleFrequencyVariation * signedNoise(i, 6u));
		float phase = noise(i, 9u) * 6.283185307179586;
		float margin = radius + abs(amplitude) + 2.0;
		position.y = wrap(noise(i, 10u) * (uResolution.y + 2.0 * margin) + speed * uTime + offset.y, margin, uResolution.y);
		position.x = wrap(noise(i, 11u) * (uResolution.x + 2.0 * margin) + wind * uTime + offset.x, margin, uResolution.x)
			+ amplitude * sin(frequency * uTime * 6.283185307179586 + phase);
		alpha = uOpacity * (0.4 + 0.6 * depth);
	} else {
		float speed = uSpeed / 4000.0 * uResolution.y * 2.2 * depth;
		float wind = uWind / 1000.0 * uResolution.y * (1.0 + uWindVariation * signedNoise(i, 2u)) * depth
			+ uSpread * signedNoise(i, 7u) * depth;
		float length = max(speed * 0.04 * max(uSize, 0.2), 1.0);
		float horizontalLength = wind * 0.04 * max(uSize, 0.2);
		float margin = length + abs(horizontalLength) + 4.0;
		position.y = wrap(noise(i, 3u) * (uResolution.y + 2.0 * margin) + speed * uTime + offset.y, margin, uResolution.y);
		position.x = wrap(noise(i, 4u) * (uResolution.x + 2.0 * margin) + wind * uTime + offset.x, margin, uResolution.x);
		line = vec2(-horizontalLength, -length);
		radius = max(uSize * 0.6 * depth, 0.25);
		alpha = uOpacity * (0.35 + 0.65 * depth);
	}

	vec3 color = uColor.rgb;
	if (uSnow == 0 && uRefract == 1) {
		vec4 sampleColor = sourceAt(position + vec2(2.0, 0.0));
		if (sampleColor.a > 0.0) {
			vec3 straight = sampleColor.a > 0.000001 ? sampleColor.rgb / sampleColor.a : vec3(0.0);
			color *= straight * 0.6 + 0.5;
		}
	}

	vPosition = position;
	vLine = line;
	vRadius = radius;
	vColor = vec4(color, alpha * uColor.a);
	float padding = max(radius, 0.5) + 1.0;
	vec2 minimum = min(position, position + line) - padding;
	vec2 maximum = max(position, position + line) + padding;
	vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
	vec2 pixel = mix(minimum, maximum, corner);
	gl_Position = vec4(pixel.x / uResolution.x * 2.0 - 1.0, 1.0 - pixel.y / uResolution.y * 2.0, 0.0, 1.0);
}
`;
var WEATHER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform int uSnow;

flat in vec2 vPosition;
flat in vec2 vLine;
flat in float vRadius;
flat in vec4 vColor;
out vec4 fragColor;

void main() {
	if (vColor.a <= 0.00001) discard;
	vec2 delta = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) - vPosition;
	float radius = max(vRadius, 0.5);
	float fade = min(vRadius / 0.5, 1.0);
	float coverage;
	if (uSnow == 1) {
		float distanceSquared = dot(delta, delta) / (radius * radius);
		if (distanceSquared >= 1.0) discard;
		float q = 1.0 - distanceSquared;
		coverage = q * q;
	} else {
		float lengthSquared = dot(vLine, vLine);
		float along = lengthSquared > 0.0 ? clamp(dot(delta, vLine) / lengthSquared, 0.0, 1.0) : 0.0;
		coverage = clamp(radius - length(delta - vLine * along) + 0.5, 0.0, 1.0);
	}
	float alpha = coverage * vColor.a * fade;
	if (alpha <= 0.000001) discard;
	fragColor = vec4(vColor.rgb * alpha, alpha);
}
`;
var WEATHER_COMPOSITE_VERTEX_SHADER = `#version 300 es
out vec2 vUv;

void main() {
	vUv = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
	gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}
`;
var WEATHER_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform sampler2D uWeather;
uniform int uCompositeWithOriginal;
uniform int uLighten;

in vec2 vUv;
out vec4 fragColor;

void main() {
	vec4 weather = texture(uWeather, vUv);
	if (uCompositeWithOriginal == 0) {
		fragColor = weather;
		return;
	}
	vec4 source = texture(uSource, vUv);
	if (uLighten == 1) {
		fragColor = vec4(max(source.rgb, weather.rgb), source.a + weather.a - source.a * weather.a);
	} else {
		fragColor = weather + source * (1.0 - weather.a);
	}
}
`;

// src/weather/runtime.ts
var setupWeather = (target, effectName) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl)
    throw remotion__WEBPACK_IMPORTED_MODULE_3__.Internals.createWebGL2ContextError(`${effectName} effect`);
  const shaders = [];
  const program = gl.createProgram();
  const compositeProgram = gl.createProgram();
  const vao = gl.createVertexArray();
  const sourceTexture = gl.createTexture();
  const weatherTexture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  try {
    if (!program || !compositeProgram || !vao || !sourceTexture || !weatherTexture || !framebuffer) {
      throw new Error(`Could not allocate ${effectName} WebGL resources`);
    }
    for (const [nextProgram, vertexSource, fragmentSource] of [
      [program, WEATHER_VERTEX_SHADER, WEATHER_FRAGMENT_SHADER],
      [
        compositeProgram,
        WEATHER_COMPOSITE_VERTEX_SHADER,
        WEATHER_COMPOSITE_FRAGMENT_SHADER
      ]
    ]) {
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vertexSource],
        [gl.FRAGMENT_SHADER, fragmentSource]
      ]) {
        const shader = gl.createShader(type);
        if (!shader)
          throw new Error(`Could not create ${effectName} shader`);
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(`${effectName} shader compile failed: ${gl.getShaderInfoLog(shader)}`);
        }
        gl.attachShader(nextProgram, shader);
      }
      gl.linkProgram(nextProgram);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        throw new Error(`${effectName} program link failed: ${gl.getProgramInfoLog(nextProgram)}`);
      }
    }
    for (const texture of [sourceTexture, weatherTexture]) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = 1;
    colorCanvas.height = 1;
    const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
    if (!colorCtx) {
      throw new Error(`Could not create ${effectName} color parsing context`);
    }
    return {
      gl,
      program,
      compositeProgram,
      vao,
      sourceTexture,
      weatherTexture,
      framebuffer,
      uniforms: Object.fromEntries([
        "uSource",
        "uResolution",
        "uSnow",
        "uTime",
        "uSeed",
        "uOffset",
        "uSize",
        "uSizeVariation",
        "uSceneDepth",
        "uSpeed",
        "uSpeedVariation",
        "uWind",
        "uWindVariation",
        "uSpread",
        "uWiggleAmount",
        "uWiggleAmountVariation",
        "uWiggleFrequency",
        "uWiggleFrequencyVariation",
        "uColor",
        "uOpacity",
        "uRefract"
      ].map((name) => [name, gl.getUniformLocation(program, name)])),
      compositeUniforms: Object.fromEntries(["uSource", "uWeather", "uCompositeWithOriginal", "uLighten"].map((name) => [name, gl.getUniformLocation(compositeProgram, name)])),
      colorCtx,
      floatingPoint: gl.getExtension("EXT_color_buffer_float") !== null,
      cachedColor: null,
      cachedColorRgba: [0, 0, 0, 0],
      width: 0,
      height: 0
    };
  } catch (error) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(weatherTexture);
    gl.deleteTexture(sourceTexture);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(compositeProgram);
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders)
      gl.deleteShader(shader);
  }
};
var drawWeather = ({
  state,
  source,
  width,
  height,
  flipSourceY,
  params,
  type
}) => {
  const { gl, uniforms, compositeUniforms } = state;
  if (state.cachedColor !== params.color) {
    state.cachedColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, params.color);
    state.cachedColor = params.color;
  }
  const color = state.cachedColorRgba;
  gl.viewport(0, 0, width, height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.sourceTexture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.weatherTexture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer);
  if (state.width !== width || state.height !== height) {
    gl.texImage2D(gl.TEXTURE_2D, 0, state.floatingPoint ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, state.floatingPoint ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.weatherTexture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      throw new Error("Could not allocate weather effect render target");
    }
    state.width = width;
    state.height = height;
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.program);
  gl.bindVertexArray(state.vao);
  gl.uniform1i(uniforms.uSource, 0);
  gl.uniform2f(uniforms.uResolution, width, height);
  gl.uniform1i(uniforms.uSnow, type === "snow" ? 1 : 0);
  gl.uniform1f(uniforms.uTime, params.time);
  gl.uniform1ui(uniforms.uSeed, params.seed);
  gl.uniform2f(uniforms.uOffset, params.offset[0], params.offset[1]);
  gl.uniform1f(uniforms.uSize, params.size);
  gl.uniform1f(uniforms.uSizeVariation, params.sizeVariation);
  gl.uniform1f(uniforms.uSceneDepth, params.sceneDepth);
  gl.uniform1f(uniforms.uSpeed, params.speed);
  gl.uniform1f(uniforms.uSpeedVariation, params.speedVariation);
  gl.uniform1f(uniforms.uWind, params.wind);
  gl.uniform1f(uniforms.uWindVariation, params.windVariation);
  gl.uniform1f(uniforms.uSpread, params.spread);
  gl.uniform1f(uniforms.uWiggleAmount, params.wiggleAmount);
  gl.uniform1f(uniforms.uWiggleAmountVariation, params.wiggleAmountVariation);
  gl.uniform1f(uniforms.uWiggleFrequency, params.wiggleFrequency);
  gl.uniform1f(uniforms.uWiggleFrequencyVariation, params.wiggleFrequencyVariation);
  gl.uniform4f(uniforms.uColor, color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255);
  gl.uniform1f(uniforms.uOpacity, params.opacity);
  gl.uniform1i(uniforms.uRefract, params.appearance === "refracting" ? 1 : 0);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, params.count);
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, state.weatherTexture);
  gl.useProgram(state.compositeProgram);
  gl.uniform1i(compositeUniforms.uSource, 0);
  gl.uniform1i(compositeUniforms.uWeather, 1);
  gl.uniform1i(compositeUniforms.uCompositeWithOriginal, params.compositeWithOriginal ? 1 : 0);
  gl.uniform1i(compositeUniforms.uLighten, params.transferMode === "lighten" ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
};
var cleanupWeather = (state) => {
  const { gl } = state;
  gl.deleteFramebuffer(state.framebuffer);
  gl.deleteTexture(state.weatherTexture);
  gl.deleteTexture(state.sourceTexture);
  gl.deleteVertexArray(state.vao);
  gl.deleteProgram(state.compositeProgram);
  gl.deleteProgram(state.program);
};

// src/weather/webgpu-shader.ts
var WEATHER_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
struct Params {
 resolution: vec2f, offset: vec2f, color: vec4f,
 snow: f32, time: f32, seed: u32, size: f32,
 sizeVariation: f32, sceneDepth: f32, speed: f32, speedVariation: f32,
 wind: f32, windVariation: f32, spread: f32, wiggleAmount: f32,
 wiggleAmountVariation: f32, wiggleFrequency: f32, wiggleFrequencyVariation: f32, opacity: f32,
 refract: f32, composite: f32, lighten: f32, padding: f32,
}
struct ParticleOutput {
 @builtin(position) position: vec4f,
 @location(0) @interpolate(flat) particlePosition: vec2f,
 @location(1) @interpolate(flat) line: vec2f,
 @location(2) @interpolate(flat) radius: f32,
 @location(3) @interpolate(flat) color: vec4f,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var weather: texture_2d<f32>;
fn noise(i: u32, key: u32) -> f32 {
	var h: u32 = (i * 0x8da6b343u) ^ (key * 0xd8163841u) ^ (params.seed * 0xcb1ab31fu);
	h ^= h >> 13u;
	h *= 0x5bd1e995u;
	h ^= h >> 15u;
	return f32(h & 0x00ffffffu) / 16777216.0;
}

fn signedNoise(i: u32, key: u32) -> f32 {
	return noise(i, key) * 2.0 - 1.0;
}

fn wrap(value: f32, margin: f32, size: f32) -> f32 {
	return -margin + (value + margin - floor((value + margin)/(size + 2.0*margin))*(size+2.0*margin));
}

fn sourcePixel(p: vec2i) -> vec4f {
	var size: vec2i = vec2i(textureDimensions(source));
	if (p.x < 0 || p.y < 0 || p.x >= size.x || p.y >= size.y) {
		return vec4f(0.0);
	}
	return textureLoad(source,p,0);
}

// Bilinear sampling with transparent borders, at pixel centers of +0.5.
fn sourceAt(position: vec2f) -> vec4f {
	var p: vec2f = position - vec2f(0.5);
	var base: vec2i = vec2i(floor(p));
	var f: vec2f = fract(p);
	return mix(
		mix(sourcePixel(base), sourcePixel(base + vec2i(1, 0)), f.x),
		mix(sourcePixel(base + vec2i(0, 1)), sourcePixel(base + vec2i(1, 1)), f.x),
		f.y
	);
}

@vertex fn particleVertex(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> ParticleOutput {
 var output: ParticleOutput;
	var i: u32 = instanceIndex;
	var depth: f32 = 1.0 / (1.0 + noise(i, 1u) * params.sceneDepth / 2500.0);
	var offset: vec2f = (params.offset - vec2f(0.5)) * params.resolution;
	var position: vec2f ;
	var line: vec2f = vec2f(0.0);
	var radius: f32 ;
	var alpha: f32 ;
	if (params.snow == 1) {
		radius = max(params.size * 0.5 * depth * (1.0 + params.sizeVariation * signedNoise(i, 2u)), 0.05);
		var speed: f32 = params.speed * (params.resolution.y / 600.0) * depth * (1.0 + params.speedVariation * signedNoise(i, 3u));
		var wind: f32 = params.wind * (params.resolution.y / 1200.0) * depth * (1.0 + params.windVariation * signedNoise(i, 4u))
			+ params.spread * signedNoise(i, 8u) * depth;
		var amplitude: f32 = params.wiggleAmount * 2.0 * depth * (1.0 + params.wiggleAmountVariation * signedNoise(i, 5u));
		var frequency: f32 = params.wiggleFrequency * (1.0 + params.wiggleFrequencyVariation * signedNoise(i, 6u));
		var phase: f32 = noise(i, 9u) * 6.283185307179586;
		var margin: f32 = radius + abs(amplitude) + 2.0;
		position.y = wrap(noise(i, 10u) * (params.resolution.y + 2.0 * margin) + speed * params.time + offset.y, margin, params.resolution.y);
		position.x = wrap(noise(i, 11u) * (params.resolution.x + 2.0 * margin) + wind * params.time + offset.x, margin, params.resolution.x)
			+ amplitude * sin(frequency * params.time * 6.283185307179586 + phase);
		alpha = params.opacity * (0.4 + 0.6 * depth);
	} else {
		var speed: f32 = params.speed / 4000.0 * params.resolution.y * 2.2 * depth;
		var wind: f32 = params.wind / 1000.0 * params.resolution.y * (1.0 + params.windVariation * signedNoise(i, 2u)) * depth
			+ params.spread * signedNoise(i, 7u) * depth;
		var length: f32 = max(speed * 0.04 * max(params.size, 0.2), 1.0);
		var horizontalLength: f32 = wind * 0.04 * max(params.size, 0.2);
		var margin: f32 = length + abs(horizontalLength) + 4.0;
		position.y = wrap(noise(i, 3u) * (params.resolution.y + 2.0 * margin) + speed * params.time + offset.y, margin, params.resolution.y);
		position.x = wrap(noise(i, 4u) * (params.resolution.x + 2.0 * margin) + wind * params.time + offset.x, margin, params.resolution.x);
		line = vec2f(-horizontalLength, -length);
		radius = max(params.size * 0.6 * depth, 0.25);
		alpha = params.opacity * (0.35 + 0.65 * depth);
	}

	var color: vec3f = params.color.rgb;
	if (params.snow == 0 && params.refract == 1) {
		var sampleColor: vec4f = sourceAt(position + vec2f(2.0, 0.0));
		if (sampleColor.a > 0.0) {
			var straight: vec3f = select(vec3f(0),sampleColor.rgb/max(sampleColor.a,0.000001),sampleColor.a>0.000001);
			color *= straight * 0.6 + vec3f(0.5);
		}
	}

	output.particlePosition = position;
	output.line = line;
	output.radius = radius;
	output.color = vec4f(color, alpha * params.color.a);
	var padding: f32 = max(radius, 0.5) + 1.0;
	var minimum: vec2f = min(position, position + line) - vec2f(padding);
	var maximum: vec2f = max(position, position + line) + vec2f(padding);
	var corner: vec2f = vec2f(f32(vertexIndex & 1u), f32(vertexIndex >> 1u));
	var pixel: vec2f = mix(minimum, maximum, corner);
	output.position = vec4f(pixel.x / params.resolution.x * 2.0 - 1.0, 1.0 - pixel.y / params.resolution.y * 2.0, 0.0, 1.0);
return output;
}
@fragment fn particleFragment(input: ParticleOutput) -> @location(0) vec4f {
	if (input.color.a <= 0.00001) { discard; }
	var delta: vec2f = input.position.xy - input.particlePosition;
	var radius: f32 = max(input.radius, 0.5);
	var fade: f32 = min(input.radius / 0.5, 1.0);
	var coverage: f32 ;
	if (params.snow == 1) {
		var distanceSquared: f32 = dot(delta, delta) / (radius * radius);
		if (distanceSquared >= 1.0) { discard; }
		var q: f32 = 1.0 - distanceSquared;
		coverage = q * q;
	} else {
		var lengthSquared: f32 = dot(input.line, input.line);
		var along: f32 = select(0.0,clamp(dot(delta, input.line)/max(lengthSquared,0.00000001),0.0,1.0),lengthSquared>0.0);
		coverage = clamp(radius - length(delta - input.line * along) + 0.5, 0.0, 1.0);
	}
	var alpha: f32 = coverage * input.color.a * fade;
	if (alpha <= 0.000001) { discard; }
	return vec4f(input.color.rgb * alpha, alpha);
}

@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let result=textureSampleLevel(weather,sourceSampler,input.uv,0);
 if(params.composite==0.0) { return result; }
 let original=textureSampleLevel(source,sourceSampler,input.uv,0);
 if(params.lighten==1.0) { return vec4f(max(original.rgb,result.rgb),original.a+result.a-original.a*result.a); }
 return result+original*(1.0-result.a);
}
`;

// src/weather/webgpu-runtime.ts
var setupWeatherWebGpu = (target) => {
  const context = target.getContext("webgpu");
  if (!context)
    throw new Error("WebGPU is not available for weather effects");
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const colorCtx = canvas.getContext("2d", { willReadFrequently: true });
  if (!colorCtx)
    throw new Error("Could not create weather color parsing context");
  return {
    context,
    colorCtx,
    cachedColor: null,
    cachedColorRgba: [0, 0, 0, 0],
    resources: null
  };
};
var cleanupWeatherWebGpu = (state) => {
  state.resources?.textures?.source.destroy();
  state.resources?.textures?.weather.destroy();
  state.resources?.uniforms.destroy();
  state.resources = null;
  state.context.unconfigure();
};
var drawWeatherWebGpu = ({
  state,
  source,
  width,
  height,
  device,
  params,
  type
}) => {
  if (state.cachedColor !== params.color) {
    state.cachedColorRgba = (0,_index_wxhvgv2s_mjs__WEBPACK_IMPORTED_MODULE_1__/* .parseColorRgba */ .zp)(state.colorCtx, params.color);
    state.cachedColor = params.color;
  }
  if (state.resources && state.resources.device !== device)
    cleanupWeatherWebGpu(state);
  if (!state.resources) {
    const format = navigator.gpu.getPreferredCanvasFormat();
    state.context.configure({ device, format, alphaMode: "premultiplied" });
    const shared = (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .getSharedWebGpuResources */ .JR)({
      device,
      key: JSON.stringify(["weather", format]),
      create: () => {
        const module = device.createShaderModule({
          code: WEATHER_WEBGPU_SHADER,
          label: "weather"
        });
        const particles = device.createRenderPipeline({
          layout: "auto",
          vertex: { module, entryPoint: "particleVertex" },
          fragment: {
            module,
            entryPoint: "particleFragment",
            targets: [
              {
                format: "rgba16float",
                blend: {
                  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
                  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
                }
              }
            ]
          },
          primitive: { topology: "triangle-strip" }
        });
        const composite = device.createRenderPipeline({
          layout: "auto",
          vertex: { module, entryPoint: "vertex" },
          fragment: { module, entryPoint: "fragment", targets: [{ format }] },
          primitive: { topology: "triangle-list" }
        });
        const sampler = device.createSampler({
          minFilter: "linear",
          magFilter: "linear"
        });
        return { particles, composite, sampler };
      }
    });
    const uniforms = device.createBuffer({
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    state.resources = {
      device,
      particles: shared.particles,
      composite: shared.composite,
      uniforms,
      sampler: shared.sampler,
      textures: null
    };
  }
  const { resources } = state;
  const sourceWidth = "displayWidth" in source ? source.displayWidth : ("videoWidth" in source) ? source.videoWidth : ("naturalWidth" in source) ? source.naturalWidth : typeof source.width === "number" ? source.width : source.width.baseVal.value;
  const sourceHeight = "displayHeight" in source ? source.displayHeight : ("videoHeight" in source) ? source.videoHeight : ("naturalHeight" in source) ? source.naturalHeight : typeof source.height === "number" ? source.height : source.height.baseVal.value;
  if (resources.textures && (resources.textures.width !== width || resources.textures.height !== height || resources.textures.sourceWidth !== sourceWidth || resources.textures.sourceHeight !== sourceHeight)) {
    resources.textures.source.destroy();
    resources.textures.weather.destroy();
    resources.textures = null;
  }
  if (!resources.textures) {
    const sourceTexture = device.createTexture({
      size: [sourceWidth, sourceHeight],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const weather = device.createTexture({
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });
    const particleGroup = device.createBindGroup({
      layout: resources.particles.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sourceTexture.createView() },
        { binding: 2, resource: { buffer: resources.uniforms } }
      ]
    });
    const compositeGroup = device.createBindGroup({
      layout: resources.composite.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sourceTexture.createView() },
        { binding: 1, resource: resources.sampler },
        { binding: 2, resource: { buffer: resources.uniforms } },
        { binding: 3, resource: weather.createView() }
      ]
    });
    resources.textures = {
      source: sourceTexture,
      weather,
      particleGroup,
      compositeGroup,
      width,
      height,
      sourceWidth,
      sourceHeight
    };
  }
  const { textures } = resources;
  const color = state.cachedColorRgba;
  const uniformData = new Float32Array([
    width,
    height,
    params.offset[0],
    params.offset[1],
    color[0] / 255,
    color[1] / 255,
    color[2] / 255,
    color[3] / 255,
    type === "snow" ? 1 : 0,
    params.time,
    0,
    params.size,
    params.sizeVariation,
    params.sceneDepth,
    params.speed,
    params.speedVariation,
    params.wind,
    params.windVariation,
    params.spread,
    params.wiggleAmount,
    params.wiggleAmountVariation,
    params.wiggleFrequency,
    params.wiggleFrequencyVariation,
    params.opacity,
    params.appearance === "refracting" ? 1 : 0,
    params.compositeWithOriginal ? 1 : 0,
    params.transferMode === "lighten" ? 1 : 0,
    0
  ]);
  new Uint32Array(uniformData.buffer)[10] = params.seed;
  device.queue.writeBuffer(resources.uniforms, 0, uniformData);
  device.queue.copyExternalImageToTexture({ source }, { texture: textures.source, premultipliedAlpha: true }, [sourceWidth, sourceHeight]);
  const encoder = device.createCommandEncoder();
  const particlePass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textures.weather.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  particlePass.setPipeline(resources.particles);
  particlePass.setBindGroup(0, textures.particleGroup);
  particlePass.draw(4, params.count);
  particlePass.end();
  const compositePass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: state.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  compositePass.setPipeline(resources.composite);
  compositePass.setBindGroup(0, textures.compositeGroup);
  compositePass.draw(3);
  compositePass.end();
  device.queue.submit([encoder.finish()]);
};




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
//# sourceMappingURL=5639.bundle.js.map