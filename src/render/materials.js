import * as T from '../../assets/three.module.min.js';

export async function makeMaterials(renderer) {
  const loader = new T.TextureLoader();
  async function scanSet(name) {
    const maps = await Promise.all(
      ['color', 'normal', 'surface'].map((s) => loader.loadAsync('assets/' + name + '-' + s + '.webp'))
    );
    for (const m of maps) {
      m.wrapS = m.wrapT = T.RepeatWrapping;
      m.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    maps[0].colorSpace = T.SRGBColorSpace;
    return maps;
  }
  const [scan, wallMaps, floorMaps, equipment] = await Promise.all([
    loader.loadAsync('assets/boardcast.webp'),
    scanSet('wall'),
    scanSet('floor'),
    loader.loadAsync('assets/equipment.webp'),
  ]);
  scan.wrapS = scan.wrapT = T.RepeatWrapping;
  scan.colorSpace = T.SRGBColorSpace;
  scan.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  equipment.colorSpace = T.SRGBColorSpace;
  function face(x, y) {
    const map = equipment.clone();
    map.offset.set(x + 0.002, y + 0.002);
    map.repeat.set(0.496, 0.496);
    map.anisotropy = 4;
    map.needsUpdate = true;
    return new T.MeshStandardMaterial({
      map,
      roughness: 0.68,
      metalness: 0.22,
      bumpMap: map,
      bumpScale: 0.004,
      envMapIntensity: 0.53,
    });
  }
  function concrete(color, floor = false) {
    const [colorMap, relief, surface] = floor ? floorMaps : wallMaps;
    const mat = new T.MeshStandardMaterial({
      color,
      map: colorMap,
      envMapIntensity: 0.37,
      roughness: floor ? 0.46 : 0.87,
      metalness: floor ? 0.11 : 0.015,
    });
    mat.customProgramCacheKey = () => (floor ? 'floor-slab' : 'cast-wall');
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, {
        reliefMap: { value: relief },
        surfaceMap: { value: surface },
        weatherMap: { value: scan },
      });
      s.vertexShader =
        'varying vec3 vCastPos;\n#ifdef RIB_SURFACE\nvarying vec2 vRibMetric;\n#endif\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        vec4 castPoint=vec4(position,1.);
        #ifdef USE_INSTANCING
          castPoint=instanceMatrix*castPoint;
        #endif
        vCastPos=(modelMatrix*castPoint).xyz;
        #ifdef RIB_SURFACE
        vRibMetric=uv;
        #endif`
        );
      s.fragmentShader =
        '#ifdef RIB_SURFACE\nvarying vec2 vRibMetric;\n#endif\nvarying vec3 vCastPos;uniform sampler2D reliefMap,surfaceMap,weatherMap;\n' +
        s.fragmentShader.replace(
          '#include <map_fragment>',
          `
        vec3 wn=normalize(cross(dFdx(vCastPos),dFdy(vCastPos)));
        vec3 a=abs(wn);
        vec2 uvw=(a.y>max(a.x,a.z))?vCastPos.xz:((a.z>a.x)?vCastPos.xy:vCastPos.zy);
        #ifdef RIB_SURFACE
        uvw=vRibMetric;
        #endif
        vec2 panel=${floor ? 'vec2(3.8,5.5)' : 'vec2(5.4,2.7)'};
        vec2 f=uvw/panel;
        vec2 edge=(.5-abs(fract(f)-.5))*panel;
        vec2 fw=clamp(fwidth(uvw),vec2(.001),vec2(.4));
        float joint=min(smoothstep(.004,.015+fw.x,edge.x),smoothstep(.004,.015+fw.y,edge.y));
        float rnd=fract(sin(dot(floor(f),vec2(53.17,29.71)))*4172.631);
        vec2 scanUv=uvw*${floor ? '.35' : '.255'}+vec2(rnd*.31,rnd*.15);
        vec3 grain=texture2D(map,scanUv).rgb;
        grain=mix(vec3(dot(grain,vec3(.2126,.7152,.0722))),grain,.33);
        vec3 properties=texture2D(surfaceMap,scanUv).rgb;
        vec3 wash=texture2D(weatherMap,uvw*.031).rgb;
        vec3 patina=mix(grain,wash,.24)*(1.09+.16*rnd);
        vec2 tie=(fract(uvw/vec2(1.35,1.35))-.5)*1.35;
        float holes=1.-smoothstep(.023,.037+max(fw.x,fw.y),length(tie));
        float detail=1.-smoothstep(.017,.21,max(fw.x,fw.y));
        float shade=.84+.16*joint;
        float runnel=texture2D(weatherMap,vec2(uvw.x*.094,uvw.y*.011)).r;
        float weather=smoothstep(.16,.32,runnel);
        patina*=mix(vec3(.76,.78,.77),vec3(1.18,1.14,1.07),weather);
        shade*=1.-${floor ? '0.' : '0.55'}*holes*detail;
        float damp=1.-smoothstep(-5.,2.5+3.*wash.r,vCastPos.y);
        diffuseColor.rgb*=patina*shade*(1.-damp*.31)*(.71+.29*properties.r);
      `
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor*(.54+.58*properties.g)-damp*.09,.17,.98);`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
        vec3 detailN=texture2D(reliefMap,scanUv).xyz*2.-1.;
        vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);vec2 sx=dFdx(scanUv),sy=dFdy(scanUv);
        vec3 tx=cross(py,normal)*sx.x+cross(normal,px)*sy.x;
        vec3 ty=cross(py,normal)*sx.y+cross(normal,px)*sy.y;
        float invLen=inversesqrt(max(1e-10,max(dot(tx,tx),dot(ty,ty))));
        normal=normalize(normal*detailN.z+(tx*detailN.x+ty*detailN.y)*invLen*.70);
        `
        );
    };
    return mat;
  }
  const solid = (c, r = 0.7, m = 0.08) =>
    new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  function painted(c) {
    const m = solid(c, 0.63, 0.35);
    m.envMapIntensity = 0.53;
    m.onBeforeCompile = (s) => {
      s.uniforms.wearMap = { value: scan };
      s.vertexShader =
        'varying vec3 coatingPos;\n' +
        s.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        vec4 point=vec4(position,1.);
        #ifdef USE_INSTANCING
        point=instanceMatrix*point;
        #endif
        coatingPos=(modelMatrix*point).xyz;`
        );
      s.fragmentShader =
        'uniform sampler2D wearMap;varying vec3 coatingPos;\n' +
        s.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec3 nn=abs(normalize(cross(dFdx(coatingPos),dFdy(coatingPos))));
        vec2 uvCoat=nn.y>max(nn.x,nn.z)?coatingPos.xz:nn.x>nn.z?coatingPos.zy:coatingPos.xy;
        float abrasions=texture2D(wearMap,uvCoat*.76).r;float drip=texture2D(wearMap,uvCoat*vec2(.54,.087)).r;
        diffuseColor.rgb=mix(diffuseColor.rgb*(.66+abrasions*1.75),vec3(.156,.066,.027),smoothstep(.27,.38,abrasions)*smoothstep(.19,.31,drip)*.8);`
        );
    };
    return m;
  }
  const glow = (r, g, b) => new T.MeshBasicMaterial({ color: new T.Color(r, g, b), toneMapped: true });
  const set = {
    lampOff: solid(0x4b463b, 0.55),
    strip: glow(2.6, 1.2, 0.42),
    stripOff: solid(0x2b2d2a, 0.6, 0.3),
    cool: glow(1.5, 2.1, 2.3),
    green: glow(0.35, 2.4, 0.9),
    redLight: glow(2.8, 0.35, 0.16),
    amber: glow(3.2, 1.6, 0.3),
    screen: glow(0.55, 1.25, 0.95),
    hazard: solid(0xc89a2e, 0.62, 0.18),
    grate: solid(0x3a4443, 0.52, 0.6),
    paper: solid(0xe4dfcc, 0.86, 0),
  };
  return {
    ...set,
    doorPanel: face(0, 0.5),
    electricPanel: face(0.5, 0.5),
    rivetedPanel: face(0, 0),
    instrumentPanel: face(0.5, 0),
    cast: concrete(0xd0cdc5),
    darkCast: concrete(0x858c89),
    deck: concrete(0xb4b5ac, true),
    steel: solid(0x3c4746, 0.48, 0.64),
    iron: solid(0x232c2d, 0.73, 0.45),
    edge: solid(0x8d8e7c, 0.46, 0.6),
    ochre: painted(0xb97332),
    ochreDark: solid(0x785131, 0.78, 0.17),
    rubber: solid(0x202526),
    pale: solid(0xb3b1a1),
    olive: solid(0x50594e),
    enamel: painted(0x69776b),
    lamp: new T.MeshBasicMaterial({ color: new T.Color(3.9, 1.5, 0.38) }),
    whiteLight: new T.MeshBasicMaterial({ color: new T.Color(2.2, 2.3, 1.92) }),
    red: solid(0x962e21),
    black: solid(0x202422),
  };
}

export function textPlate(text, sub, width, height, bg = '#27312e', fg = '#e2dec8') {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 256);
  ctx.fillStyle = '#d78543';
  ctx.fillRect(0, 0, 15, 256);
  ctx.fillStyle = fg;
  ctx.font = '700 82px "PingFang SC", sans-serif';
  ctx.fillText(text, 44, 129, 684);
  ctx.fillStyle = '#c0c4b7';
  ctx.font = '30px monospace';
  ctx.fillText(sub, 47, 202, 680);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshStandardMaterial({
      map: tex,
      roughness: 0.74,
      emissive: 0x77786b,
      emissiveMap: tex,
      emissiveIntensity: 0.3,
    })
  );
}
