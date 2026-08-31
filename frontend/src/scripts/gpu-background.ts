const canvas = document.querySelector<HTMLCanvasElement>('#gpu-background');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compactMotion = window.matchMedia('(max-width: 1180px), (hover: none) and (pointer: coarse)');

if (canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'high-performance' });
  if (gl) {
    const vertex = `#version 300 es
      in vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;
    const fragment = `#version 300 es
      precision highp float;
      uniform vec2 cssResolution;
      uniform vec2 pointerCss;
      uniform float pixelRatio;
      uniform float time;
      uniform float variant;
      uniform float compactMode;
      out vec4 outColor;

      float gridCss(vec2 cssPosition, float cellSize) {
        vec2 cell = abs(fract(cssPosition / cellSize - .5) - .5) / fwidth(cssPosition / cellSize);
        return 1.0 - min(min(cell.x, cell.y), 1.0);
      }

      void main() {
        vec2 cssPosition = gl_FragCoord.xy / pixelRatio;
        float shortSide = max(min(cssResolution.x, cssResolution.y), 1.0);
        vec2 centered = (cssPosition - cssResolution * .5) / shortSide;
        float t = time * .08;

        /*
         * Grid spacing is expressed in CSS pixels, not as N cells per axis.
         * Compact mode keeps motion interesting with a slow translation while
         * avoiding phase changes that make the whole field appear to breathe.
         */
        float cellSize = variant > 2.5 ? 84.0 : 64.0;
        float gridSpeed = mix(1.0, .28, compactMode);
        float g = gridCss(cssPosition + vec2(t * 18.0 * gridSpeed, 0.0), cellSize) * .055;

        float pointerDistance = distance(cssPosition, pointerCss);
        float glow = 32.0 / max(pointerDistance, 32.0);
        float wavePhase = compactMode > .5 ? 0.0 : t * 3.0;
        float wave = sin((centered.x * 8.0 + centered.y * 5.0) + wavePhase) * .5 + .5;
        vec3 base = vec3(0.067, 0.067, 0.106);
        vec3 blue = vec3(0.537, 0.706, 0.980);
        vec3 mauve = vec3(0.796, 0.651, 0.969);
        vec3 tint = mix(blue, mauve, clamp(variant / 3.0 + wave * .12, 0.0, 1.0));
        float pointerEnergy = glow * (variant > 2.5 ? .055 : .025) * (1.0 - compactMode);
        float energy = g + pointerEnergy + wave * (variant > 2.5 ? .018 : .007);
        outColor = vec4(base + tint * energy, .76);
      }
    `;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (vs && fs) {
      const program = gl.createProgram();
      if (program) {
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        const cssResolution = gl.getUniformLocation(program, 'cssResolution');
        const pointerCss = gl.getUniformLocation(program, 'pointerCss');
        const pixelRatio = gl.getUniformLocation(program, 'pixelRatio');
        const time = gl.getUniformLocation(program, 'time');
        const variantUniform = gl.getUniformLocation(program, 'variant');
        const compactMode = gl.getUniformLocation(program, 'compactMode');
        const variant = ({ a: 1, b: 2, c: 3 } as Record<string, number>)[document.body.dataset.design || 'a'] || 1;

        let cssWidth = 1;
        let cssHeight = 1;
        let dpr = 1;
        let px = .5;
        let py = .5;
        let pointerSeen = false;
        let resizeFrame = 0;

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          cssWidth = Math.max(1, rect.width);
          cssHeight = Math.max(1, rect.height);
          dpr = Math.min(window.devicePixelRatio || 1, 1.5);

          const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
          const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

          if (canvas.width !== backingWidth) canvas.width = backingWidth;
          if (canvas.height !== backingHeight) canvas.height = backingHeight;
          gl.viewport(0, 0, backingWidth, backingHeight);

          if (!pointerSeen) {
            px = cssWidth * .5;
            py = cssHeight * .5;
          }
        };

        const scheduleResize = () => {
          if (resizeFrame) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = 0;
            resize();
          });
        };

        window.addEventListener('pointermove', (event) => {
          const rect = canvas.getBoundingClientRect();
          pointerSeen = true;
          px = event.clientX - rect.left;
          py = rect.bottom - event.clientY;
        }, { passive: true });

        resize();
        window.addEventListener('resize', scheduleResize, { passive: true });

        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(scheduleResize);
          observer.observe(canvas);
        }

        const render = (now: number) => {
          gl.uniform2f(cssResolution, cssWidth, cssHeight);
          gl.uniform2f(pointerCss, px, py);
          gl.uniform1f(pixelRatio, dpr);
          gl.uniform1f(time, reduceMotion ? 0 : now / 1000);
          gl.uniform1f(variantUniform, variant);
          gl.uniform1f(compactMode, compactMotion.matches ? 1 : 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          if (!reduceMotion) requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
      }
    }
  }
}
