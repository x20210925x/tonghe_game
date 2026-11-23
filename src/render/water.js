import * as T from '../../assets/three.module.min.js';
import { Reflector } from '../../assets/Reflector.js';

// Scattered pools use one reflection pass for all coplanar walking surfaces.
export function createWetDeck(rects) {
  const xyz = [],
    uv = [];
  for (const [l, r, n, s] of rects) {
    for (const [x, z] of [
      [l, s],
      [r, s],
      [r, n],
      [l, s],
      [r, n],
      [l, n],
    ]) {
      xyz.push(x, -z, 0);
      uv.push(x * 0.1, -z * 0.1);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(xyz, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const base = Reflector.ReflectorShader;
  const shader = {
    ...base,
    uniforms: { ...base.uniforms, uTime: { value: 0 }, uReflect: { value: 1 } },
    vertexShader:
      'varying vec3 surfacePos;\n' +
      base.vertexShader.replace('vUv =', 'surfacePos=(modelMatrix*vec4(position,1.)).xyz;vUv ='),
    fragmentShader: `
      varying vec3 surfacePos; varying vec4 vUv; uniform float uTime,uReflect; uniform sampler2D tDiffuse;
      float hash(vec2 v){return fract(sin(dot(v,vec2(91.72,215.19)))*4197.131);}
      float noise(vec2 p){vec2 i=floor(p),t=fract(p);t=t*t*(3.-2.*t);return mix(mix(hash(i),hash(i+vec2(1,0)),t.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),t.x),t.y);}
      void main(){
        vec2 p=surfacePos.xz;
        float wet=noise(p*vec2(.24,.16))*.49+noise(p*vec2(.64,.37))*.25+noise(p*1.3)*.15+noise(p*4.6)*.08+noise(p*11.)*.03;
        float fill=smoothstep(.47,.60,wet);
        if(fill<.012)discard;
        float fres=pow(1.-max(0.,normalize(cameraPosition-surfacePos).y),2.);
        vec2 screenUv=vUv.xy/vUv.w;
        screenUv+=vec2(noise(p*7.+uTime*.04)-.5,noise(p*5.3)-.5)*.00085;
        vec3 reflected=uReflect>.5?texture2D(tDiffuse,screenUv).rgb:vec3(.19,.225,.23)*fres;
        gl_FragColor=vec4(mix(vec3(.026,.037,.039),reflected,.28+fres*.68),fill*(.16+.64*fres));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const pools = new Reflector(geo, {
    textureWidth: 720,
    textureHeight: 420,
    clipBias: 0.001,
    multisample: 0,
    shader,
  });
  pools.rotation.x = -Math.PI / 2;
  pools.position.y = 0.013;
  pools.renderOrder = 2;
  pools.material.transparent = true;
  pools.material.depthWrite = false;
  return pools;
}

// Reflection cameras reuse the preceding frame's other surface. Only the main camera updates a mirror.
export function cadence(mirror, period, enabled = () => true) {
  const render = mirror.onBeforeRender;
  let count = 0;
  mirror.onBeforeRender = function (renderer, scene, camera, ...args) {
    if (!camera.userData.inspectionView || !enabled()) return;
    if (count++ % period === 0) render.call(this, renderer, scene, camera, ...args);
  };
}
