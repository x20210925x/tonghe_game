import * as T from '../../assets/three.module.min.js';

// Resolve linear HDR color and contact occlusion together, before the display transform.
export class SceneResolve {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.supported =
      renderer.capabilities.isWebGL2 && !!renderer.extensions.get('EXT_color_buffer_float');
    if (!this.supported) return;
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      samples: Math.min(2, renderer.capabilities.maxSamples),
      depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
    });
    const material = new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        frame: { value: this.target.texture },
        depthBuffer: { value: this.target.depthTexture },
        invProj: { value: camera.projectionMatrixInverse },
        size: { value: new T.Vector2(1, 1) },
      },
      vertexShader: `varying vec2 st;void main(){st=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `varying vec2 st;uniform sampler2D frame,depthBuffer;uniform vec2 size;uniform mat4 invProj;
    vec3 pointAt(vec2 uv){float depth=texture2D(depthBuffer,uv).x;vec4 p=invProj*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
    void main(){
      vec3 col=texture2D(frame,st).rgb;
      vec3 p=pointAt(st),dx=dFdx(p),dy=dFdy(p);
      vec3 n=normalize(cross(dx,dy));float ao=0.;
      if(-p.z<130.){
        float radius=mix(.65,2.,smoothstep(2.,40.,-p.z));
        vec2 spread=radius/max(.4,-p.z)*vec2(size.y/size.x,1.)*.86;
        float seed=fract(sin(dot(floor(gl_FragCoord.xy*.5),vec2(12.9898,78.233)))*43758.54)*.6;
        for(int i=0;i<10;i++){
          float f=(float(i)+.55)/10.,a=float(i)*2.39996+seed;
          vec3 v=pointAt(clamp(st+spread*sqrt(f)*vec2(cos(a),sin(a)),vec2(.001),vec2(.999)))-p;
          float len=length(v);ao+=max(0.,dot(n,v)/max(len,.0001)-.095)*(1.-smoothstep(.02,radius*1.25,len));
        }
      }
      col*=1.-min(.42,ao*.19);
      vec3 bloom=vec3(0.);
      for(int i=0;i<6;i++){float a=float(i)*1.0472;vec3 c=texture2D(frame,st+vec2(cos(a),sin(a))*4./size).rgb;bloom+=max(vec3(0.),c-2.5);}
      col+=min(bloom,vec3(5.))*.009;
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    });
    this.size = material.uniforms.size.value;
    this.scene = new T.Scene();
    this.scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), material));
    this.camera = new T.Camera();
  }
  resize(width, height) {
    if (this.supported) {
      this.target.setSize(width, height);
      this.size.set(width, height);
    }
  }
  render(scene, camera, quality) {
    if (!this.supported || quality === 'low') {
      this.renderer.render(scene, camera);
      return;
    }
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
