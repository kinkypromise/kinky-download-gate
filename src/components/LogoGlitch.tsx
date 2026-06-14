"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * LogoGlitch — Three.js shader mask for a black-frame + transparent-cutout logo.
 *
 * Loads /logo.svg from the public folder, knocks it out as an alpha mask, and
 * drives it with a glitch/rave aesthetic:
 *   - horizontal slice displacement
 *   - RGB chromatic aberration that breathes
 *   - a BPM-driven beat envelope
 *   - scanlines + occasional full-frame RGB tear
 *
 * Props:
 *   - bpm: beat tempo (default 160)
 *   - accentColor: hex color string (default #f22e8c) used for the core glow
 *
 * Fills its parent, pointer-events disabled, aria-hidden. Respects
 * prefers-reduced-motion by rendering a single mostly-static frame.
 *
 * Requires: npm i three  (and: npm i -D @types/three)
 */

const VERT = `varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `precision highp float;
uniform float u_time, u_aspect, u_intro, u_beat;
uniform vec2 u_res, u_pointer;
uniform vec3 u_accent;
uniform sampler2D u_mask;

float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash1(float n){ return fract(sin(n)*43758.5453); }

float letterAt(vec2 q, vec2 off){
  vec2 s = q + off;
  float inF = step(0.,s.x)*step(s.x,1.)*step(0.,s.y)*step(s.y,1.);
  vec4 m = texture2D(u_mask, vec2(s.x, 1.-s.y));
  return (1.-m.a)*inF;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float sA = u_res.x / u_res.y;
  vec2 q = uv;
  if(sA > u_aspect){ float s=u_aspect/sA; q.x=(uv.x-.5)/s+.5; }
  else { float s=sA/u_aspect; q.y=(uv.y-.5)/s+.5; }

  float t = u_time;
  float pMove2 = length(u_pointer-0.5);
  float band = floor(q.y*48.0);
  float gate = step(0.82-0.5*u_beat, hash1(band+floor(t*8.0)));
  float slice = (hash1(band*3.1+floor(t*8.0))-0.5)*(0.06+0.20*u_beat+0.18*pMove2)*gate;
  vec2 qg = q; qg.x += slice;
  qg += (u_pointer-0.5)*0.055;

  float ca = clamp(0.0022 + 0.006*u_beat + 0.0018*sin(t*3.0), 0.0, 0.0075);
  float lR = letterAt(qg, vec2( ca, 0.0));
  float lG = letterAt(qg, vec2(0.0, 0.0));
  float lB = letterAt(qg, vec2(-ca, 0.0));

  float core = max(max(lR, lG), lB);
  float ghost = lR*0.20 + lG*0.38 + lB*0.20;
  vec3 col = vec3(ghost);
  col = mix(col, u_accent, core*0.46);

  float flick = step(0.5, hash1(floor(t*20.0)+band))*0.25*u_beat;
  col += core*flick;

  col *= 0.85 + 0.15*sin(q.y*1100.0);

  float tear = step(0.93, hash1(floor(t*4.0)))*u_beat;
  col += tear*letterAt(qg, vec2(0.05,0.0))*0.24;

  float reveal = smoothstep(0.0,1.0,u_intro);
  float introNoise = step(1.0-u_intro, hash(vec2(band, floor(t*30.0))));
  float mask = mix(introNoise, 1.0, reveal);

  float grain = (hash(q*u_res.xy*0.5 + t*60.0)-0.5)*0.10;
  col += grain*mask*0.35;
  float alpha = clamp(max(max(col.r, col.g), col.b) * 1.35, 0.0, 0.82) * mask;
  gl_FragColor = vec4(col*mask, alpha);
}`;

function hexToRgbNormalized(hex: string): { r: number; g: number; b: number } {
  const sanitized = hex.replace("#", "");
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;
  return { r, g, b };
}

export default function LogoGlitch({
  className,
  bpm = 160,
  accentColor = "#f22e8c",
}: {
  className?: string;
  bpm?: number;
  accentColor?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const bpmRef = useRef(bpm);
  const accentRef = useRef(accentColor);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { accentRef.current = accentColor; }, [accentColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mountEl = mount;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mountEl.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const rgb = hexToRgbNormalized(accentRef.current);
    const uniforms = {
      u_time: { value: 0 },
      u_res: { value: new THREE.Vector2() },
      u_mask: { value: new THREE.Texture() },
      u_aspect: { value: 1920 / 1080 },
      u_intro: { value: 0 },
      u_beat: { value: 0 },
      u_pointer: { value: new THREE.Vector2(0.5, 0.5) },
      u_accent: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1920;
      c.height = 1080;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 1920, 1080);
      const tex = new THREE.CanvasTexture(c);
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      uniforms.u_mask.value = tex;
    };
    img.src = "/logo.svg";

    const onMove = (e: PointerEvent) => {
      uniforms.u_pointer.value.set(
        e.clientX / window.innerWidth,
        1 - e.clientY / window.innerHeight
      );
    };
    window.addEventListener("pointermove", onMove);

    function resize() {
      const w = mountEl.clientWidth;
      const h = mountEl.clientHeight;
      renderer.setSize(w, h, false);
      const pr = renderer.getPixelRatio();
      uniforms.u_res.value.set(w * pr, h * pr);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(mountEl);
    resize();

    const start = performance.now();
    let raf = 0;
    function loop(now: number) {
      const t = (now - start) / 1000;
      uniforms.u_time.value = reduce ? 2.0 : t;
      uniforms.u_intro.value = reduce ? 1 : Math.min(t / 1.2, 1);
      if (reduce) {
        uniforms.u_beat.value = 0;
      } else {
        const beatLen = 60 / bpmRef.current;
        const phase = (t % beatLen) / beatLen;
        uniforms.u_beat.value = Math.pow(1 - phase, 3);
      }
      const rgb = hexToRgbNormalized(accentRef.current);
      uniforms.u_accent.value.set(rgb.r, rgb.g, rgb.b);
      renderer.render(scene, camera);
      if (!reduce) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    if (reduce) renderer.render(scene, camera);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      renderer.dispose();
      mat.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
