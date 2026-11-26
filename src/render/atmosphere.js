import * as T from '../../assets/three.module.min.js';

// Suspended dust that drifts around the camera. Sunlight through the core's slits comes from
// the shadow maps themselves, so no fake light sheets are needed.
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


  let enabled = true;
  return {
    quality(mode) {
      enabled = mode !== 'low';
      dust.visible = enabled;
    },
    update(dt, time, camera, site, inside, storm = 0) {
      dust.material.uniforms.uTime.value = time;
      dust.material.uniforms.uCenter.value.copy(camera.position);
      // Rain clears the air outside; the shaft keeps its dust, dimmer at night.
      dust.material.uniforms.uAmount.value = (0.22 * (1 - storm) + inside * 0.55) * (1 - 0.6 * storm);
    },
  };
}
