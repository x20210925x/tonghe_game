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
      uniforms: { skyMap: { value: daylight.sky } },
      vertexShader: `varying vec3 direction;
    void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
      fragmentShader: `uniform sampler2D skyMap;varying vec3 direction;
    void main(){vec3 d=normalize(direction);vec2 uv=vec2(atan(d.z,d.x)*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);
    vec3 rgb=texture2D(skyMap,uv).rgb*.64;
    rgb=mix(vec3(dot(rgb,vec3(.2126,.7152,.0722))),rgb,.40);
    gl_FragColor=vec4(mix(vec3(.39,.46,.51),rgb,.82*smoothstep(-.03,.54,d.y)),1.);
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
