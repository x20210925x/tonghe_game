import * as T from '../../assets/three.module.min.js';
import { RGBELoader } from '../../assets/RGBELoader.js';

export async function loadDaylight(renderer) {
  const sky = await new RGBELoader().loadAsync('assets/daylight.hdr');
  sky.mapping = T.EquirectangularReflectionMapping;
  // The separately shadowed sun carries the direct component. Limit the disk in the
  // reflection convolution so an unshadowed copy cannot illuminate the booth.
  const data = sky.image.data.slice(),
    ceiling = T.DataUtils.toHalfFloat(8);
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) data[i + c] = Math.min(data[i + c], ceiling);
  const fill = sky.clone();
  fill.source = new T.Source({ ...sky.image, data });
  fill.needsUpdate = true;
  const pmrem = new T.PMREMGenerator(renderer),
    env = pmrem.fromEquirectangular(fill);
  fill.dispose();
  pmrem.dispose();
  return { sky, environment: env.texture };
}

export function installDaylight(scene, daylight) {
  scene.environment = daylight.environment;
  const dome = new T.Mesh(
    new T.SphereGeometry(960, 32, 18),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        skyMap: { value: daylight.sky },
        uStorm: { value: 0 },
        uDawn: { value: 0 },
        uFlash: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `varying vec3 direction;
    void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
      // With storm, dawn and flash at zero this is exactly the clear-day sky.
      fragmentShader: `uniform sampler2D skyMap;uniform float uStorm,uDawn,uFlash,uTime;varying vec3 direction;
    float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.545);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
    void main(){vec3 d=normalize(direction);vec2 uv=vec2(atan(d.z,d.x)*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);
    vec3 rgb=texture2D(skyMap,uv).rgb*.64;
    rgb=mix(vec3(dot(rgb,vec3(.2126,.7152,.0722))),rgb,.40);
    vec3 haze=vec3(.39,.46,.51);
    if(uStorm+uDawn>0.){
      vec2 deck=d.xz/(max(d.y,0.)+.18)*1.3+vec2(uTime*.018,uTime*.007);
      float cloud=noise(deck)*.5+noise(deck*2.3)*.3+noise(deck*5.1)*.2;
      vec3 dawnSky=mix(vec3(.78,.5,.36),vec3(.3,.38,.5),smoothstep(-.02,.5,d.y))*(.86+.28*cloud);
      rgb=mix(rgb,dawnSky,uDawn);
      haze=mix(haze,vec3(.62,.52,.46),uDawn);
      vec3 night=mix(vec3(.026,.031,.038),vec3(.01,.012,.016),smoothstep(-.05,.6,d.y))*(.55+.9*cloud);
      rgb=mix(rgb,night,uStorm);
      haze=mix(haze,vec3(.022,.027,.033),uStorm);
      vec3 lit=vec3(.5,.56,.72)*(.35+.9*cloud)*smoothstep(-.15,.4,d.y);
      rgb+=lit*uFlash;haze+=lit*uFlash*.5;
    }
    gl_FragColor=vec4(mix(haze,rgb,.82*smoothstep(-.03,.54,d.y)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
    })
  );
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  scene.add(dome);
  return dome;
}
