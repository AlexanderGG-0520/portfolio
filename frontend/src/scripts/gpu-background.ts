const canvas = document.querySelector<HTMLCanvasElement>('#gpu-background');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'high-performance' });
  if (gl) {
    const vertex = `#version 300 es
      in vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;
    const fragment = `#version 300 es
      precision highp float;
      uniform vec2 resolution;
      uniform vec2 pointer;
      uniform float time;
      uniform float variant;
      out vec4 outColor;

      float grid(vec2 uv, float scale) {
        vec2 cell = abs(fract(uv * scale - .5) - .5) / fwidth(uv * scale);
        return 1.0 - min(min(cell.x, cell.y), 1.0);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = pointer / resolution.xy;
        float t = time * .08;
        float g = grid(uv + vec2(t * .03, 0.0), variant > 2.5 ? 15.0 : 22.0) * .055;
        float glow = .08 / max(distance(uv, p), .08);
        float wave = sin((uv.x * 8.0 + uv.y * 5.0) + t * 3.0) * .5 + .5;
        vec3 base = vec3(0.067, 0.067, 0.106);
        vec3 blue = vec3(0.537, 0.706, 0.980);
        vec3 mauve = vec3(0.796, 0.651, 0.969);
        vec3 tint = mix(blue, mauve, clamp(variant / 3.0 + wave * .12, 0.0, 1.0));
        float energy = g + glow * (variant > 2.5 ? .055 : .025) + wave * (variant > 2.5 ? .018 : .007);
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

        const resolution = gl.getUniformLocation(program, 'resolution');
        const pointer = gl.getUniformLocation(program, 'pointer');
        const time = gl.getUniformLocation(program, 'time');
        const variantUniform = gl.getUniformLocation(program, 'variant');
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
          gl.uniform2f(resolution, canvas.width, canvas.height);
          gl.uniform2f(pointer, px * dpr, py * dpr);
          gl.uniform1f(time, reduceMotion ? 0 : now / 1000);
          gl.uniform1f(variantUniform, variant);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          if (!reduceMotion) requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
      }
    }
  }
}
