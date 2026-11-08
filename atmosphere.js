// Procedural sky and water: no image downloads or post-processing passes.
export function createAtmosphere(
  THREE,
  scene,
  renderer,
  camera,
  heightTexture,
) {
  const mobile = matchMedia('(pointer: coarse)').matches;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.FogExp2('#b8dce4', 0.00155);
  const sunDirection = new THREE.Vector3(-0.48, 0.58, -0.66).normalize();
  scene.add(new THREE.HemisphereLight('#c4e8ff', '#667847', 1.65));
  const sun = new THREE.DirectionalLight('#fff0cc', 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, {
    left: -70,
    right: 70,
    top: 70,
    bottom: -70,
    near: 1,
    far: 500,
  });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.12;
  scene.add(sun, sun.target);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { sunDirection: { value: sunDirection }, time: { value: 0 } },
      vertexShader: `varying vec3 direction;
      void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec3 direction; uniform vec3 sunDirection; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec3 d=normalize(direction);float h=max(d.y,0.);
        vec3 color=mix(vec3(.63,.84,.91),vec3(.055,.32,.64),pow(h,.55));
        float sun=max(dot(d,sunDirection),0.);
        color+=vec3(1.,.68,.31)*pow(sun,12.)*.17;
        color+=vec3(1.,.88,.61)*(pow(sun,700.)*.7+smoothstep(.99965,.99985,sun)*3.);
        vec2 p=d.xz/(max(d.y,.015)+.18)*2.5+vec2(time*.002,0.);
        float cloud=noise(p)*.57+noise(p*2.1)*.28+noise(p*4.3)*.15;
        float mask=smoothstep(.55,.76,cloud)*smoothstep(.025,.2,d.y);
        color=mix(color,mix(vec3(.75,.84,.88),vec3(1.,.98,.91),cloud),mask*.88);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const waterMaterial = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      time: { value: 0 },
      heights: { value: heightTexture },
      sunDirection: { value: sunDirection },
    },
    vertexShader: `varying vec3 worldPosition;
      #include <fog_pars_vertex>
      void main(){worldPosition=(modelMatrix*vec4(position,1.)).xyz;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time;uniform sampler2D heights;uniform vec3 sunDirection;varying vec3 worldPosition;
      #include <fog_pars_fragment>
      void main(){
        vec2 p=worldPosition.xz;vec2 uv=(p+500.)/1000.;
        float land=texture2D(heights,uv).r;
        float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
        float depth=mix(80.,max(-land,0.),inside);
        vec3 shallow=vec3(.025,.39,.33),deep=vec3(.008,.12,.23);
        vec3 color=mix(shallow,deep,smoothstep(0.,32.,depth));
        float ripple=1.-smoothstep(40.,280.,distance(cameraPosition,worldPosition));
        vec3 n=normalize(vec3((sin(p.x*.28+time*.9)*.11+sin(p.y*.17-time*.7)*.06)*ripple,1.,cos(p.y*.23+time*.8)*.10*ripple));
        vec3 view=normalize(cameraPosition-worldPosition);
        float fresnel=pow(1.-max(dot(view,n),0.),4.);
        color=mix(color,vec3(.51,.76,.86),fresnel*.5);
        float sparkle=pow(max(dot(reflect(-sunDirection,n),view),0.),100.);
        color+=vec3(1.,.87,.60)*sparkle*.9;
        float foam=(1.-smoothstep(.1,1.8,depth))*smoothstep(.3,.85,sin(depth*5.-time*1.5+sin(p.x*.3))*.5+.5);
        color=mix(color,vec3(.82,.95,.91),foam*.6);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 5000),
    waterMaterial,
  );
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  const shadowCenter = new THREE.Vector3(Infinity, 0, Infinity);
  return {
    update(time) {
      sky.position.copy(camera.position);
      sky.material.uniforms.time.value = time;
      waterMaterial.uniforms.time.value = time;
      // Snap to shadow texels to reduce shimmering while following the explorer.
      if (camera.position.distanceToSquared(shadowCenter) > 16) {
        const texel = 140 / sun.shadow.mapSize.x;
        shadowCenter.set(
          Math.round(camera.position.x / texel) * texel,
          camera.position.y - 2,
          Math.round(camera.position.z / texel) * texel,
        );
        sun.target.position.copy(shadowCenter);
        sun.position.copy(shadowCenter).addScaledVector(sunDirection, 240);
      }
    },
  };
}
