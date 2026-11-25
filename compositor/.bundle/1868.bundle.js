"use strict";
(self["webpackChunkappshowcase_compositor"] = self["webpackChunkappshowcase_compositor"] || []).push([[1868],{

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

/***/ 1868
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   lut: () => (/* binding */ lut),
/* harmony export */   lutSchema: () => (/* binding */ lutSchema)
/* harmony export */ });
/* harmony import */ var _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9728);
/* harmony import */ var remotion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3947);


// src/lut/index.ts


// src/lut/lut-runtime.ts


// src/lut/lut-shaders.ts
var LUT_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;

void main() {
	vUv = aUv;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
var LUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform sampler3D uLut;
uniform int uLutSize;
uniform vec3 uDomainMin;
uniform vec3 uDomainMax;

vec3 sampleLut(vec3 color) {
	vec3 normalizedColor = clamp(
		(color - uDomainMin) / (uDomainMax - uDomainMin),
		vec3(0.0),
		vec3(1.0)
	);
	vec3 position = normalizedColor * float(uLutSize - 1);
	ivec3 lower = ivec3(floor(position));
	ivec3 upper = min(lower + ivec3(1), ivec3(uLutSize - 1));
	vec3 fraction = fract(position);

	vec3 c000 = texelFetch(uLut, ivec3(lower.x, lower.y, lower.z), 0).rgb;
	vec3 c100 = texelFetch(uLut, ivec3(upper.x, lower.y, lower.z), 0).rgb;
	vec3 c010 = texelFetch(uLut, ivec3(lower.x, upper.y, lower.z), 0).rgb;
	vec3 c110 = texelFetch(uLut, ivec3(upper.x, upper.y, lower.z), 0).rgb;
	vec3 c001 = texelFetch(uLut, ivec3(lower.x, lower.y, upper.z), 0).rgb;
	vec3 c101 = texelFetch(uLut, ivec3(upper.x, lower.y, upper.z), 0).rgb;
	vec3 c011 = texelFetch(uLut, ivec3(lower.x, upper.y, upper.z), 0).rgb;
	vec3 c111 = texelFetch(uLut, ivec3(upper.x, upper.y, upper.z), 0).rgb;

	vec3 c00 = mix(c000, c100, fraction.x);
	vec3 c10 = mix(c010, c110, fraction.x);
	vec3 c01 = mix(c001, c101, fraction.x);
	vec3 c11 = mix(c011, c111, fraction.x);
	vec3 c0 = mix(c00, c10, fraction.y);
	vec3 c1 = mix(c01, c11, fraction.y);
	return mix(c0, c1, fraction.z);
}

void main() {
	vec4 sourceColor = texture(uSource, vUv);
	float alpha = sourceColor.a;

	if (alpha <= 0.0) {
		fragColor = vec4(0.0);
		return;
	}

	vec3 straightColor = sourceColor.rgb / alpha;
	vec3 transformedColor = sampleLut(straightColor);
	fragColor = vec4(transformedColor * alpha, alpha);
}
`;

// src/lut/lut-runtime.ts
var { createWebGL2ContextError } = remotion__WEBPACK_IMPORTED_MODULE_1__.Internals;
var compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create LUT shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`LUT shader compile failed: ${log ?? "(no log)"}`);
  }
  return shader;
};
var createProgram = (gl) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, LUT_VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, LUT_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create LUT shader program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`LUT shader link failed: ${log ?? "(no log)"}`);
  }
  return program;
};
var createSourceTexture = (gl) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create LUT source texture");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
};
var createLutTexture = (gl) => {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create LUT texture");
  }
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_3D, null);
  return texture;
};
var setupLut = (target) => {
  const gl = target.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  if (!gl) {
    throw createWebGL2ContextError("LUT effect");
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create LUT vertex array");
  }
  const vbo = gl.createBuffer();
  if (!vbo) {
    throw new Error("Failed to create LUT vertex buffer");
  }
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  gl.bindVertexArray(null);
  return {
    gl,
    program,
    vao,
    vbo,
    sourceTexture: createSourceTexture(gl),
    lutTexture: createLutTexture(gl),
    uniforms: {
      uSource: gl.getUniformLocation(program, "uSource"),
      uLut: gl.getUniformLocation(program, "uLut"),
      uLutSize: gl.getUniformLocation(program, "uLutSize"),
      uDomainMin: gl.getUniformLocation(program, "uDomainMin"),
      uDomainMax: gl.getUniformLocation(program, "uDomainMax")
    },
    cachedContent: null
  };
};
var applyLut = ({
  state,
  source,
  width,
  height,
  content,
  parsed,
  flipSourceY
}) => {
  const { gl, program, sourceTexture, lutTexture, uniforms, vao } = state;
  if (state.cachedContent !== content) {
    const maxSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
    if (parsed.size > maxSize) {
      throw new Error(`LUT_3D_SIZE ${parsed.size} exceeds this browser's maximum 3D texture size of ${maxSize}`);
    }
    const previousError = gl.getError();
    if (previousError !== gl.NO_ERROR) {
      throw new Error(`WebGL error ${previousError} was present before uploading the 3D LUT texture`);
    }
    try {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, lutTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, parsed.size, parsed.size, parsed.size, 0, gl.RGBA, gl.FLOAT, parsed.data);
      const uploadError = gl.getError();
      if (uploadError !== gl.NO_ERROR) {
        throw new Error(`Failed to upload the 3D LUT texture (WebGL error ${uploadError})`);
      }
      state.cachedContent = content;
    } finally {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
      gl.bindTexture(gl.TEXTURE_3D, null);
      gl.activeTexture(gl.TEXTURE0);
    }
  }
  gl.viewport(0, 0, width, height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipSourceY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, lutTexture);
  gl.useProgram(program);
  if (uniforms.uSource)
    gl.uniform1i(uniforms.uSource, 0);
  if (uniforms.uLut)
    gl.uniform1i(uniforms.uLut, 1);
  if (uniforms.uLutSize)
    gl.uniform1i(uniforms.uLutSize, parsed.size);
  if (uniforms.uDomainMin) {
    gl.uniform3f(uniforms.uDomainMin, ...parsed.domainMin);
  }
  if (uniforms.uDomainMax) {
    gl.uniform3f(uniforms.uDomainMax, ...parsed.domainMax);
  }
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
  gl.bindTexture(gl.TEXTURE_3D, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.useProgram(null);
};
var cleanupLut = ({
  gl,
  program,
  vao,
  vbo,
  sourceTexture,
  lutTexture
}) => {
  gl.deleteTexture(sourceTexture);
  gl.deleteTexture(lutTexture);
  gl.deleteBuffer(vbo);
  gl.deleteProgram(program);
  gl.deleteVertexArray(vao);
};

// src/lut/parse-cube-lut.ts
var stripComment = (line) => {
  let insideQuotes = false;
  for (let i = 0;i < line.length; i++) {
    const character = line[i];
    if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "#" && !insideQuotes) {
      return line.slice(0, i);
    }
  }
  return line;
};
var parseTriplet = ({
  values,
  lineNumber,
  label
}) => {
  if (values.length !== 3) {
    throw new TypeError(`Invalid LUT content on line ${lineNumber}: ${label} must contain exactly 3 numbers`);
  }
  const parsed = values.map((value) => Number(value));
  if (parsed.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`Invalid LUT content on line ${lineNumber}: ${label} must contain only finite numbers`);
  }
  return [parsed[0], parsed[1], parsed[2]];
};
var HEADER_DIRECTIVES = new Set([
  "TITLE",
  "LUT_3D_SIZE",
  "DOMAIN_MIN",
  "DOMAIN_MAX"
]);
var parseCubeLut = (content) => {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  let size = null;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  let hasDomainMin = false;
  let hasDomainMax = false;
  let hasTitle = false;
  let dataRows = 0;
  let dataStarted = false;
  for (let index = 0;index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = stripComment(lines[index]).trim();
    if (line.length === 0) {
      continue;
    }
    const [keyword, ...values] = line.split(/\s+/);
    if (keyword === "LUT_1D_SIZE") {
      throw new TypeError(`Invalid LUT content on line ${lineNumber}: 1D LUTs are not supported`);
    }
    if (HEADER_DIRECTIVES.has(keyword)) {
      if (dataStarted) {
        throw new TypeError(`Invalid LUT content on line ${lineNumber}: ${keyword} must appear before the color data`);
      }
      if (keyword === "TITLE") {
        if (hasTitle) {
          throw new TypeError(`Invalid LUT content on line ${lineNumber}: TITLE may only be declared once`);
        }
        hasTitle = true;
        continue;
      }
      if (keyword === "LUT_3D_SIZE") {
        if (size !== null) {
          throw new TypeError(`Invalid LUT content on line ${lineNumber}: LUT_3D_SIZE may only be declared once`);
        }
        if (values.length !== 1) {
          throw new TypeError(`Invalid LUT content on line ${lineNumber}: LUT_3D_SIZE must contain exactly one integer`);
        }
        const parsedSize = Number(values[0]);
        if (!Number.isInteger(parsedSize) || parsedSize < 2 || parsedSize > 256) {
          throw new TypeError(`Invalid LUT content on line ${lineNumber}: LUT_3D_SIZE must be an integer from 2 to 256`);
        }
        size = parsedSize;
        continue;
      }
      if (keyword === "DOMAIN_MIN") {
        if (hasDomainMin) {
          throw new TypeError(`Invalid LUT content on line ${lineNumber}: DOMAIN_MIN may only be declared once`);
        }
        domainMin = parseTriplet({
          values,
          lineNumber,
          label: "DOMAIN_MIN"
        });
        hasDomainMin = true;
        continue;
      }
      if (hasDomainMax) {
        throw new TypeError(`Invalid LUT content on line ${lineNumber}: DOMAIN_MAX may only be declared once`);
      }
      domainMax = parseTriplet({
        values,
        lineNumber,
        label: "DOMAIN_MAX"
      });
      hasDomainMax = true;
      continue;
    }
    if (/^[A-Z_]/i.test(keyword)) {
      throw new TypeError(`Invalid LUT content on line ${lineNumber}: unsupported directive "${keyword}"`);
    }
    if (size === null) {
      throw new TypeError(`Invalid LUT content on line ${lineNumber}: LUT_3D_SIZE must be declared before the color data`);
    }
    parseTriplet({
      values: [keyword, ...values],
      lineNumber,
      label: "color row"
    });
    dataStarted = true;
    dataRows++;
    const maxDataRows = size ** 3;
    if (dataRows > maxDataRows) {
      throw new TypeError(`Invalid LUT content: expected ${maxDataRows} color rows for LUT_3D_SIZE ${size}, but got more`);
    }
  }
  if (size === null) {
    throw new TypeError("Invalid LUT content: LUT_3D_SIZE is missing");
  }
  for (let channel = 0;channel < 3; channel++) {
    if (domainMin[channel] >= domainMax[channel]) {
      throw new TypeError(`Invalid LUT content: DOMAIN_MIN must be smaller than DOMAIN_MAX for every channel`);
    }
  }
  const expectedRows = size ** 3;
  if (dataRows !== expectedRows) {
    throw new TypeError(`Invalid LUT content: expected ${expectedRows} color rows for LUT_3D_SIZE ${size}, but got ${dataRows}`);
  }
  const data = new Float32Array(expectedRows * 4);
  let dataIndex = 0;
  for (let index = 0;index < lines.length; index++) {
    const line = stripComment(lines[index]).trim();
    if (line.length === 0) {
      continue;
    }
    const [keyword, ...values] = line.split(/\s+/);
    if (HEADER_DIRECTIVES.has(keyword)) {
      continue;
    }
    const [red, green, blue] = parseTriplet({
      values: [keyword, ...values],
      lineNumber: index + 1,
      label: "color row"
    });
    const offset = dataIndex * 4;
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 1;
    dataIndex++;
  }
  return {
    size,
    domainMin,
    domainMax,
    data
  };
};

// src/lut/webgpu-shader.ts
var LUT_WEBGPU_SHADER = `
${_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .WEBGPU_SINGLE_PASS_VERTEX */ .fH}
struct Params {domainMin: vec4f, domainMax: vec4f,}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var lut: texture_2d<f32>;
fn lookup(p: vec3u) -> vec3f {
 let size = u32(params.domainMin.w);
 let index = p.x + size * (p.y + size * p.z);
 let width = textureDimensions(lut).x;
 // The WebGL LUT is RGBA16F. Preserve its rounding before interpolation.
 return quantizeToF16(textureLoad(lut, vec2u(index % width, index / width), 0).rgb);
}
@fragment fn fragment(input: VertexOutput) -> @location(0) vec4f {
 let color = textureSampleLevel(source, sourceSampler, input.uv, 0);
 if (color.a <= 0.0) { return vec4f(0); }
 let normalized = clamp((color.rgb / color.a - params.domainMin.xyz) / (params.domainMax.xyz - params.domainMin.xyz), vec3f(0), vec3f(1));
 let position = normalized * (params.domainMin.w - 1.0);
 let lower = vec3u(floor(position));
 let upper = min(lower + vec3u(1), vec3u(u32(params.domainMin.w) - 1u));
 let fraction = fract(position);
 let c00 = mix(lookup(lower), lookup(vec3u(upper.x, lower.yz)), fraction.x);
 let c10 = mix(lookup(vec3u(lower.x, upper.y, lower.z)), lookup(vec3u(upper.xy, lower.z)), fraction.x);
 let c01 = mix(lookup(vec3u(lower.xy, upper.z)), lookup(vec3u(upper.x, lower.y, upper.z)), fraction.x);
 let c11 = mix(lookup(vec3u(lower.x, upper.yz)), lookup(upper), fraction.x);
 return vec4f(mix(mix(c00, c10, fraction.y), mix(c01, c11, fraction.y), fraction.z) * color.a, color.a);
}
`;

// src/lut/index.ts
var { createEffect } = remotion__WEBPACK_IMPORTED_MODULE_1__.Internals;
var DEFAULT_LUT_CONTENT = `TITLE "Identity"
LUT_3D_SIZE 2

0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1`;
var lutSchema = {
  content: {
    type: "string",
    default: DEFAULT_LUT_CONTENT,
    description: "Cube LUT content",
    keyframable: false
  }
};
var MAX_CACHED_LUTS = 4;
var parsedLuts = new Map;
var getCachedLut = (content) => {
  const cached = parsedLuts.get(content);
  if (cached) {
    parsedLuts.delete(content);
    parsedLuts.set(content, cached);
    return cached;
  }
  let firstHash = 2166136261;
  let secondHash = 5381;
  for (let i = 0;i < content.length; i++) {
    const character = content.charCodeAt(i);
    firstHash ^= character;
    firstHash = Math.imul(firstHash, 16777619);
    secondHash = Math.imul(secondHash, 33) ^ character;
  }
  const created = {
    parsed: parseCubeLut(content),
    effectKey: `lut-${content.length}-${firstHash >>> 0}-${secondHash >>> 0}`
  };
  parsedLuts.set(content, created);
  if (parsedLuts.size > MAX_CACHED_LUTS) {
    const oldestContent = parsedLuts.keys().next().value;
    if (oldestContent !== undefined) {
      parsedLuts.delete(oldestContent);
    }
  }
  return created;
};
var validateLutParams = (params) => {
  if (params === null || typeof params !== "object") {
    throw new TypeError(`LUT effect requires a parameters object, but got ${JSON.stringify(params)}`);
  }
  if (typeof params.content !== "string" || params.content.trim().length === 0) {
    throw new TypeError(`"content" must be a non-empty string, but got ${JSON.stringify(params.content)}`);
  }
  getCachedLut(params.content);
};
var lut = createEffect({
  type: "remotion/lut",
  label: "lut()",
  documentationLink: "https://www.remotion.dev/docs/effects/lut",
  calculateKey: (params) => getCachedLut(params.content).effectKey,
  implementations: {
    webgpu: remotion__WEBPACK_IMPORTED_MODULE_1__.Internals.createEffectImplementation({
      setup: (target) => ({
        ...(0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .setupWebGpuSinglePass */ .DS)(target, "lut"),
        cached: null
      }),
      apply: ({ source, width, height, params, state, gpuDevice }) => {
        if (!gpuDevice)
          throw new Error("A WebGPU device is required for the LUT effect");
        const device = gpuDevice;
        const { parsed } = getCachedLut(params.content);
        const textureWidth = Math.min(parsed.size * parsed.size, device.limits.maxTextureDimension2D);
        const textureHeight = Math.ceil(parsed.size ** 3 / textureWidth);
        if (textureHeight > device.limits.maxTextureDimension2D)
          throw new Error(`LUT_3D_SIZE ${parsed.size} exceeds this browser's maximum LUT texture size`);
        if (state.cached?.content !== params.content || state.cached.width !== textureWidth) {
          const data = new Float32Array(textureWidth * textureHeight * 4);
          data.set(parsed.data);
          state.cached = {
            content: params.content,
            data,
            width: textureWidth,
            height: textureHeight
          };
        }
        (0,_index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .applyWebGpuSinglePass */ .UI)({
          state,
          source,
          width,
          height,
          device,
          shader: LUT_WEBGPU_SHADER,
          uniformData: new Float32Array([
            ...parsed.domainMin,
            parsed.size,
            ...parsed.domainMax,
            0
          ])
        }, {
          sourceFilter: null,
          auxiliaryTexture: {
            data: state.cached.data,
            width: textureWidth,
            height: textureHeight,
            format: "rgba32float"
          }
        });
      },
      cleanup: _index_4svzhprm_mjs__WEBPACK_IMPORTED_MODULE_0__/* .cleanupWebGpuSinglePass */ .Gl
    }),
    webgl2: remotion__WEBPACK_IMPORTED_MODULE_1__.Internals.createEffectImplementation({
      setup: setupLut,
      apply: ({ source, width, height, params, state, flipSourceY }) => {
        applyLut({
          state,
          source,
          width,
          height,
          content: params.content,
          parsed: getCachedLut(params.content).parsed,
          flipSourceY
        });
      },
      cleanup: cleanupLut
    })
  },
  schema: lutSchema,
  validateParams: validateLutParams
});



/***/ }

}]);
//# sourceMappingURL=1868.bundle.js.map