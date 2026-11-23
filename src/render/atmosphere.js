import * as T from '../../assets/three.module.min.js';
import { SHAFT } from '../game/layout.js';
import { EAST_SLITS } from '../world/core.js';

const LIGHT = new T.Vector3(-0.554, -0.743, -0.375).normalize();

// Suspended dust that drifts around the camera, and sheets of sun falling through the east
// slits of the core. Both are additive and cheap; they carry most of the sense of air.
export function buildAtmosphere(scene) {
  const count = 520,
    span = 18;
  const pos = new Float32Array(count * 3),
    seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * span;
    pos[i * 3 + 1] = (Math.random() - 0.5) * span * 0.6;
    pos[i * 3 + 2] = (Math.random() - 0.5) * span;
    seed[i] = Math.random();
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new T.BufferAttribute(seed, 1));
  const dust = new T.Points(
    geo,
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new T.Vector3() }, uAmount: { value: 0.4 }, uSpan: { value: span } },
      vertexShader: `attribute float seed;uniform float uTime,uSpan;uniform vec3 uCenter;varying float vFade;
        void main(){
          vec3 p=position+vec3(sin(uTime*.07+seed*40.)*1.6,uTime*(.03+seed*.05),cos(uTime*.05+seed*31.)*1.6);
          vec3 rel=mod(p-uCenter+uSpan*.5,uSpan)-uSpan*.5;
          rel.y=mod(p.y-uCenter.y+uSpan*.3,uSpan*.6)-uSpan*.3;
          vec4 mv=modelViewMatrix*vec4(uCenter+rel,1.);
          float d=length(rel);
          vFade=(1.-smoothstep(uSpan*.25,uSpan*.5,d))*smoothstep(.4,1.6,-mv.z)*(.4+.6*fract(seed*7.3));
          gl_PointSize=clamp(26./-mv.z,1.,5.);
          gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uAmount;varying float vFade;
        void main(){vec2 c=gl_PointCoord-.5;float a=smoothstep(.5,.0,length(c));
          gl_FragColor=vec4(vec3(1.,.88,.7)*a*vFade*uAmount,1.);}`,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);

  const beamMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
    vertexShader: `varying vec2 st;varying vec3 wp;void main(){st=uv;vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `varying vec2 st;varying vec3 wp;uniform float uTime,uAmount;
      float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float along=st.x,across=st.y;
        float edge=smoothstep(0.,.08,across)*smoothstep(1.,.92,across);
        float fall=smoothstep(0.,.05,along)*(1.-smoothstep(.25,1.,along));
        float motes=.7+.3*n(vec2(wp.y*.6+uTime*.15,wp.x*.4+wp.z*.4));
        float view=1.-smoothstep(10.,60.,distance(cameraPosition,wp));
        gl_FragColor=vec4(vec3(1.,.86,.64)*edge*fall*motes*uAmount*(.35+.65*view),1.);
      }`,
  });
  const beams = new T.Group();
  for (const c of EAST_SLITS) {
    const top = 120,
      bottom = 9,
      len = 46,
      z = c - 1.0,
      x = SHAFT.x1;
    const a = new T.Vector3(x, top, z),
      bv = new T.Vector3(x, bottom, z);
    const pts = [a, bv, bv.clone().addScaledVector(LIGHT, len), a.clone().addScaledVector(LIGHT, len)];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const sheet = new T.Mesh(g, beamMat);
    sheet.frustumCulled = false;
    sheet.renderOrder = 4;
    beams.add(sheet);
  }
  scene.add(beams);

  let enabled = true;
  return {
    quality(mode) {
      enabled = mode !== 'low';
      dust.visible = enabled;
    },
    update(dt, time, camera, site, inside) {
      dust.material.uniforms.uTime.value = time;
      dust.material.uniforms.uCenter.value.copy(camera.position);
      dust.material.uniforms.uAmount.value = 0.22 + inside * 0.55;
      beamMat.uniforms.uTime.value = time;
      beamMat.uniforms.uAmount.value = inside * 0.035;
      beams.visible = inside > 0.02;
    },
  };
}
