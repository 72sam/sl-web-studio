(() => {
  'use strict';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const scriptBase = document.currentScript?.src || location.href;

  function revealSections() {
    if (!('IntersectionObserver' in window)) return;
    const elements = document.querySelectorAll('[data-sl-reveal]');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!reducedMotion.matches) entry.target.classList.add('sl-revealed');
      }
    }, { threshold: 0, rootMargin: '0px 0px -1% 0px' });
    elements.forEach(element => observer.observe(element));
  }

  function stackProjects(stack) {
    const panels = Array.from(stack.children).filter(element => element.hasAttribute('data-sl-panel'));
    if (panels.length < 2 || !('ResizeObserver' in window)) return;
    const screen = matchMedia('(min-width: 350px) and (min-height: 620px)');
    let active = false;
    let inView = true;
    let frame = 0;
    let top = 0;
    panels.forEach((panel, index) => panel.style.setProperty('--sl-order', index + 1));

    function update() {
      frame = 0;
      if (!active || !inView) return;
      const bounds = panels.map(panel => panel.getBoundingClientRect());
      for (let i = 0; i < panels.length - 1; i++) {
        const covered = clamp(1 - (bounds[i + 1].top - top) / bounds[i].height, 0, 1);
        panels[i].style.setProperty('--sl-sheet-scale', (1 - .035 * covered).toFixed(4));
      }
    }
    function queue() {
      if (active && inView && !frame) frame = requestAnimationFrame(update);
    }
    function measure() {
      const header = document.querySelector('header');
      const pinnedHeader = header && ['sticky', 'fixed'].includes(getComputedStyle(header).position);
      top = pinnedHeader ? header.offsetHeight + 12 : 16;
      active = screen.matches && !reducedMotion.matches &&
        panels.every(panel => panel.offsetHeight + top + 16 <= innerHeight);
      stack.style.setProperty('--sl-pin-top', top + 'px');
      stack.classList.toggle('sl-stack-ready', active);
      queue();
    }
    const observer = new ResizeObserver(measure);
    panels.forEach(panel => observer.observe(panel));
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; queue(); }).observe(stack);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    reducedMotion.addEventListener('change', measure);
    measure();
  }

  const vertexSource = `
    attribute vec3 position;
    attribute vec3 normal;
    uniform mat3 rotation;
    uniform vec2 fit;
    varying vec3 world;
    varying vec3 surface;
    varying vec3 objectPoint;
    void main() {
      objectPoint = position;
      surface = rotation * normal;
      world = rotation * position;
      float w = 1.0 - world.z / 3.8;
      gl_Position = vec4(world.xy * fit, -world.z * 0.32, w);
    }`;
  const fragmentSource = `
    precision mediump float;
    varying vec3 world;
    varying vec3 surface;
    varying vec3 objectPoint;
    uniform float lightShift;

    // Large studio softboxes reflected in the slightly crowned metal face.
    float strip(float d, float size, float blur) {
      return 1.0 - smoothstep(size, size + blur, abs(d));
    }
    void main() {
      vec3 n = normalize(surface);
      n.xy += vec2(objectPoint.x * 0.17, objectPoint.y * 0.24) * max(n.z, 0.0);
      n = normalize(n);
      vec3 view = normalize(vec3(0.0, 0.0, 3.8) - world);
      vec3 r = reflect(-view, n);
      float sweep = r.y + r.x * 0.46 + lightShift;
      vec3 metal = mix(vec3(0.32,0.31,0.36), vec3(0.78,0.76,0.83), smoothstep(-0.74,0.83,sweep));
      metal += vec3(0.43,0.42,0.44) * strip(sweep - 0.14,0.08,0.27);
      metal -= vec3(0.29,0.28,0.24) * strip(sweep + 0.34,0.055,0.15);
      metal += vec3(0.27,0.24,0.36) * strip(sweep + 0.60,0.08,0.20);
      metal += vec3(0.25,0.22,0.20) * strip(r.x - r.y * 0.68 - 0.89,0.11,0.22);
      metal += vec3(0.09,0.075,0.12) * pow(1.0 - max(dot(n,view),0.0), 2.0);
      metal *= 0.76 + 0.24 * smoothstep(-0.40,0.50,n.z);
      gl_FragColor = vec4(metal,1.0);
    }`;

  function shader(gl, type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Shader unavailable');
    return result;
  }

  // This authored GLB contains one mesh with interleaved positions and normals.
  function readEmblem(file) {
    const header = new DataView(file);
    if (header.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid emblem');
    const jsonLength = header.getUint32(12, true);
    const model = JSON.parse(new TextDecoder().decode(new Uint8Array(file, 20, jsonLength)));
    const buffers = model.bufferViews;
    const payload = 28 + jsonLength;
    return {
      vertices: new Uint8Array(file, payload, buffers[0].byteLength),
      indices: new Uint16Array(file, payload + buffers[1].byteOffset, model.accessors[2].count)
    };
  }

  function rotationMatrix(out, x, y, z) {
    const a = Math.cos(x), b = Math.sin(x);
    const c = Math.cos(y), d = Math.sin(y);
    const e = Math.cos(z), f = Math.sin(z);
    out[0] = e*c; out[1] = f*c; out[2] = -d;
    out[3] = e*d*b - f*a; out[4] = f*d*b + e*a; out[5] = c*b;
    out[6] = e*d*a + f*b; out[7] = f*d*a - e*b; out[8] = c*a;
    return out;
  }

  async function mountStage(stage) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sl-stage-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', {
      antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power'
    });
    if (!gl) return;
    const response = await fetch(new URL('assets/motion/sl-emblem.glb', scriptBase));
    if (!response.ok) throw new Error('Emblem unavailable');
    const model = readEmblem(await response.arrayBuffer());
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Renderer unavailable');
    gl.useProgram(program);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
    for (const [name, offset] of [['position', 0], ['normal', 12]]) {
      const attribute = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 24, offset);
    }
    const indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0,0,0,0);
    const rotation = gl.getUniformLocation(program, 'rotation');
    const fit = gl.getUniformLocation(program, 'fit');
    const light = gl.getUniformLocation(program, 'lightShift');
    const matrix = new Float32Array(9);
    const finePointer = matchMedia('(pointer: fine)');
    const started = performance.now();
    let visible = true, frame = 0, lost = false;
    let targetX = 0, targetY = 0, tiltX = 0, tiltY = 0, scrollPosition = 0;
    let prevTime = 0;

    function queue() {
      if (!frame && visible && !document.hidden && !reducedMotion.matches && !lost)
        frame = requestAnimationFrame(render);
    }
    function render(now) {
      frame = 0;
      if (!visible || document.hidden || reducedMotion.matches || lost) return;
      const dt = Math.min(64, now - prevTime || 16);
      prevTime = now;
      const blend = 1 - Math.exp(-dt / 123);
      tiltX += (targetX - tiltX) * blend;
      tiltY += (targetY - tiltY) * blend;
      const entrance = Math.max(0, 1 - (now - started) / 1350);
      const sweep = entrance * entrance;
      const rx = -0.18 + tiltY * 0.21 - scrollPosition * 0.11;
      const ry = -0.28 + tiltX * 0.34 + sweep * 0.34;
      const rz = 0.15 - tiltX * 0.05 + scrollPosition * 0.05;
      gl.uniformMatrix3fv(rotation, false, rotationMatrix(matrix, rx, ry, rz));
      gl.uniform1f(light, tiltX * 0.13 + scrollPosition * 0.08 + sweep * 0.24);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, model.indices.length, gl.UNSIGNED_SHORT, 0);
      stage.classList.add('sl-stage-ready');
      if (entrance || Math.abs(targetX - tiltX) + Math.abs(targetY - tiltY) > 0.002) queue();
    }
    function measure() {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(Math.max(1.25, devicePixelRatio || 1), 2, 1320 / rect.width);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gl.viewport(0,0,canvas.width,canvas.height);
      const width = Math.min(rect.width * 0.80, rect.height * 1.04);
      gl.uniform2f(fit,width / rect.width,width / rect.height);
      queue();
    }
    function scroll() {
      if (!visible) return;
      const section = stage.closest('section') || stage;
      scrollPosition = clamp(-section.getBoundingClientRect().top / section.offsetHeight, 0, 1);
      queue();
    }
    stage.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || !finePointer.matches) return;
      const rect = stage.getBoundingClientRect();
      targetX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      targetY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
      queue();
    }, {passive:true});
    stage.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; queue(); });
    canvas.addEventListener('webglcontextlost', () => {
      lost = true;
      stage.classList.remove('sl-stage-ready');
    });
    stage.append(canvas);
    const size = new ResizeObserver(measure);
    size.observe(stage);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) scroll(); }).observe(stage);
    document.addEventListener('visibilitychange', queue);
    window.addEventListener('scroll', scroll, {passive:true});
    reducedMotion.addEventListener('change', queue);
    measure();
  }

  revealSections();
  document.querySelectorAll('[data-sl-stack]').forEach(stackProjects);
  const stage = document.querySelector('[data-sl-stage]');
  if (stage && 'ResizeObserver' in window && 'IntersectionObserver' in window) {
    function start() {
      if (reducedMotion.matches) return;
      reducedMotion.removeEventListener('change', start);
      mountStage(stage).catch(() => { stage.classList.remove('sl-stage-ready'); });
    }
    reducedMotion.addEventListener('change', start);
    start();
  }
})();
