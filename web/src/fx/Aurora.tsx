// Aurora - ported from React Bits (reactbits.dev, MIT + Commons Clause), TypeScript + theme aware.
// A full-screen simplex-noise aurora drawn with one WebGL triangle (ogl). Pauses when hidden.
import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;
out vec4 fragColor;
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
vec3 ramp(float f) {
  if (f < 0.5) return mix(uColorStops[0], uColorStops[1], f / 0.5);
  return mix(uColorStops[1], uColorStops[2], (f - 0.5) / 0.5);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 rampColor = ramp(uv.x);
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  if (uLightMode > 0.5) {
    float energy = clamp(max(intensity, 0.0), 0.0, 1.0);
    float coverage = clamp(auroraAlpha * (0.55 + 0.45 * energy), 0.0, 0.86);
    fragColor = vec4(rampColor * coverage, coverage);
  } else {
    vec3 auroraColor = intensity * rampColor;
    fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
  }
}`;

export interface AuroraProps {
  colorStops?: [string, string, string];
  amplitude?: number;
  blend?: number;
  speed?: number;
  lightMode?: boolean;
  className?: string;
}

export default function Aurora(props: AuroraProps) {
  const { colorStops = ["#3b5bff", "#00a4ce", "#7c5cff"], amplitude = 1, blend = 0.5, lightMode = false, className } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const ctnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctn = ctnRef.current;
    if (!ctn) return;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr: Math.min(1.5, window.devicePixelRatio) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = "transparent";
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete (geometry.attributes as Record<string, unknown>).uv;
    const toRgb = (hex: string) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    };
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStops.map(toRgb) },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
        uLightMode: { value: lightMode ? 1 : 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);
    const resize = () => {
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      program.uniforms.uResolution.value = [ctn.offsetWidth * renderer.dpr, ctn.offsetHeight * renderer.dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(ctn);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(ctn);
    let raf = 0;
    const update = (t: number) => {
      raf = requestAnimationFrame(update);
      if (!visible || document.hidden) return;
      const p = propsRef.current;
      program.uniforms.uTime.value = t * 0.01 * (p.speed ?? 1) * 0.1;
      program.uniforms.uAmplitude.value = p.amplitude ?? 1;
      program.uniforms.uBlend.value = p.blend ?? blend;
      program.uniforms.uLightMode.value = p.lightMode ? 1 : 0;
      program.uniforms.uColorStops.value = (p.colorStops ?? colorStops).map(toRgb);
      renderer.render({ scene: mesh });
    };
    resize();
    raf = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      if (gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ctnRef} className={className} style={{ width: "100%", height: "100%" }} aria-hidden />;
}
