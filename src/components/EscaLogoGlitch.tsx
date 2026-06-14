"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * ESCA logo — glitch / rave variant (Three.js).
 *
 * Same mask principle as EscaLogoCanvas (letters are knocked out of a black
 * frame, used as an alpha mask), but instead of a calm flow field the letters
 * are driven by a hard-techno glitch aesthetic:
 *   - horizontal slice displacement (datamosh-style row shifting)
 *   - RGB chromatic aberration that breathes
 *   - a 160 BPM beat envelope that spikes the glitch on every beat
 *   - scanlines + occasional full-frame RGB tear
 * Pink/magenta neon core with a cyan ghost edge.
 *
 * Drop-in: <EscaLogoGlitch className="..." bpm={160} />. Fills its parent,
 * pointer-events disabled, aria-hidden. Respects prefers-reduced-motion
 * (renders a single mostly-static frame with no beat pulsing).
 *
 * Requires: npm i three  (and: npm i -D @types/three)
 */

const LOGO_B64 = "PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDIwMDEwOTA0Ly9FTiIKICJodHRwOi8vd3d3LnczLm9yZy9UUi8yMDAxL1JFQy1TVkctMjAwMTA5MDQvRFREL3N2ZzEwLmR0ZCI+CjxzdmcgdmVyc2lvbj0iMS4wIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiB3aWR0aD0iMTkyMC4wMDAwMDBwdCIgaGVpZ2h0PSIxMDgwLjAwMDAwMHB0IiB2aWV3Qm94PSIwIDAgMTkyMC4wMDAwMDAgMTA4MC4wMDAwMDAiCiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCBtZWV0Ij4KCjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAuMDAwMDAwLDEwODAuMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIgpmaWxsPSIjMDAwMDAwIiBzdHJva2U9Im5vbmUiPgo8cGF0aCBkPSJNMCA1NDAwIGwwIC01NDAwIDk2MDAgMCA5NjAwIDAgMCA1NDAwIDAgNTQwMCAtOTYwMCAwIC05NjAwIDAgMAotNTQwMHogbTczMzkgMTg5MyBjMCAtMTAgLTI0IC0xNDggLTUyIC0zMDggbC01MiAtMjkwIC04MjQgLTUgLTgyNSAtNSAtNTIKLTMwMCBjLTI5IC0xNjUgLTUzIC0zMDggLTUzIC0zMTcgLTEgLTE3IDQ0IC0xOCA4MTIgLTE4IDQ0OCAwIDgxNiAtMiA4MTkgLTUKMiAtMyAtMjEgLTE0MiAtNTEgLTMxMCBsLTU2IC0zMDUgLTgyMiAwIGMtNDUzIDAgLTgyMyAtMyAtODIzIC04IDAgLTQgLTI1Ci0xNDkgLTU1IC0zMjIgLTMwIC0xNzMgLTU1IC0zMTYgLTU1IC0zMTcgMCAtMiAzNjkgLTMgODIwIC0zIDY0OSAwIDgyMCAtMwo4MjAgLTEyIDAgLTcgLTIzIC0xNDcgLTUyIC0zMTAgbC01MiAtMjk4IC0xMDUwIDAgLTEwNTEgMCAtNTUgMjYgYy0xMTggNTUKLTE4MCAxMzQgLTE4MCAyMjkgMCAzNyA0MjUgMjQ4NyA0OTIgMjgzOCBsMTEgNTcgMTE5MyAwIGMxMTMxIDAgMTE5NCAtMSAxMTkzCi0xN3ogbTI2MzYgLTUgYy0yIC0xMyAtMjUgLTE0MCAtNTAgLTI4MyAtMjUgLTE0MyAtNDggLTI3MiAtNTEgLTI4NyBsLTYgLTI4Ci04MjEgLTIgLTgyMSAtMyAtNTIgLTMwMCBjLTI5IC0xNjUgLTUzIC0zMDggLTUzIC0zMTcgLTEgLTE2IDQzIC0xOCA2NzIgLTIwCmw2NzIgLTMgNjIgLTI5IGM4OCAtNDAgMTU4IC0xMTkgMTc3IC0xOTkgNCAtMTcgLTQ0IC0zMTYgLTEzNCAtODI1IC03OCAtNDM4Ci0xNDMgLTgwNSAtMTQ2IC04MTQgLTUgLTE3IC03MSAtMTggLTExOTUgLTE4IC05NDQgMCAtMTE4OSAzIC0xMTg5IDEzIDAgNiAyMwoxNDYgNTIgMzEwIGw1MiAyOTcgODIxIDAgODIxIDAgNTMgMzA4IGMyOSAxNjkgNTUgMzE1IDU3IDMyNCA1IDE3IC0zNiAxOAotNjgzIDIwIGwtNjg4IDMgLTQ3IDIzIGMtOTUgNDcgLTE2OCAxNDMgLTE2OCAyMjIgMCAyMiA2MyAzOTYgMTQwIDgzMCA3NyA0MzUKMTQwIDc5MyAxNDAgNzk1IDAgMyA1MzggNSAxMTk1IDUgbDExOTUgMCAtNSAtMjJ6IG0yNjM0IDUgYzAgLTEwIC0yNCAtMTQ4Ci01MiAtMzA4IGwtNTIgLTI5MCAtODI0IC01IC04MjQgLTUgLTE2MyAtOTIwIGMtOTAgLTUwNiAtMTY2IC05MzUgLTE2OSAtOTUyCmwtNiAtMzMgODIxIDAgYzY0OSAwIDgyMCAtMyA4MjAgLTEyIDAgLTcgLTIzIC0xNDcgLTUyIC0zMTAgbC01MiAtMjk4IC0xMDUwCjAgLTEwNTEgMCAtNTUgMjYgYy0xMTggNTUgLTE4MCAxMzQgLTE4MCAyMjkgMCAzNyA0MjUgMjQ4NyA0OTIgMjgzOCBsMTEgNTcKMTE5MyAwIGMxMTMxIDAgMTE5NCAtMSAxMTkzIC0xN3ogbTIzOTggLTEgYzEwOSAtNDQgMTkyIC0xNDIgMTkzIC0yMjcgMCAtMjIKLTExMyAtNjg1IC0yNTIgLTE0NzIgbC0yNTIgLTE0MzMgLTM3MyAwIC0zNzIgMCA1IDI4IGMzIDE1IDM2IDE5OCA3MyA0MDcgbDY4CjM4MCAtNDQ2IDMgYy0yNDQgMSAtNDQ4IC0xIC00NTIgLTUgLTMgLTUgLTM2IC0xNzkgLTczIC0zODggLTM3IC0yMDkgLTcwCi0zOTAgLTczIC00MDIgbC01IC0yMyAtMzY5IDAgYy0zMjAgMCAtMzY5IDIgLTM2OSAxNSAwIDggMTI0IDcxNSAyNzUgMTU3MAoxNTEgODU2IDI3NSAxNTU4IDI3NSAxNTYxIDAgMiA0NzQgNCAxMDUzIDMgOTY1IDAgMTA1NSAtMiAxMDk0IC0xN3oiLz4KPHBhdGggZD0iTTEzNDk1IDY2NzggYy01IC0xOCAtMTg1IC0xMDUyIC0xODUgLTEwNjYgMCAtOSAxMDggLTEyIDQ1MCAtMTIgMjY5CjAgNDUwIDQgNDUwIDkgMCAxMSAxNzcgMTAyNiAxODUgMTA1OSBsNSAyMiAtNDUwIDAgYy0zNTIgMCAtNDUxIC0zIC00NTUgLTEyeiIvPgo8L2c+Cjwvc3ZnPgo=";

const VERT = `varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `precision highp float;
uniform float u_time, u_aspect, u_intro, u_beat;
uniform vec2 u_res, u_pointer;
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
  col = mix(col, vec3(0.72), core*0.46);

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

export default function EscaLogoGlitch({
  className,
  bpm = 160,
}: {
  className?: string;
  bpm?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

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

    const uniforms = {
      u_time: { value: 0 },
      u_res: { value: new THREE.Vector2() },
      u_mask: { value: new THREE.Texture() },
      u_aspect: { value: 1920 / 1080 },
      u_intro: { value: 0 },
      u_beat: { value: 0 },
      u_pointer: { value: new THREE.Vector2(0.5, 0.5) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const img = new Image();
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
    img.src = "data:image/svg+xml;base64," + LOGO_B64;

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

    const beatLen = 60 / bpm;
    const start = performance.now();
    let raf = 0;
    function loop(now: number) {
      const t = (now - start) / 1000;
      uniforms.u_time.value = reduce ? 2.0 : t;
      uniforms.u_intro.value = reduce ? 1 : Math.min(t / 1.2, 1);
      if (reduce) {
        uniforms.u_beat.value = 0;
      } else {
        const phase = (t % beatLen) / beatLen;
        uniforms.u_beat.value = Math.pow(1 - phase, 3);
      }
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
  }, [bpm]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
