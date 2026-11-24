import * as T from '../../assets/three.module.min.js';

// Two-cascade sun. Directional light 0 is the sharp shadow that follows the player; light 1
// is the static whole-world shadow. Both carry the full sun intensity, and every fragment
// takes its sunlight from exactly one of them: the near one wherever it covers the fragment,
// fading to the far one at its border. Without this the coarse far map shows as blocky
// steps even next to the player.
let installed = false;

export function installShadowCascade() {
  if (installed) return true;
  const chunk = T.ShaderChunk.lights_fragment_begin;
  const shadowLine =
    'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  const declare = 'DirectionalLightShadow directionalLightShadow;\n\t#endif';
  if (!chunk.includes(shadowLine) || !chunk.includes(declare)) {
    console.warn('Shadow cascade not installed: unexpected shader chunk');
    return false;
  }
  T.ShaderChunk.lights_fragment_begin = chunk
    .replace(
      declare,
      `${declare}
	float nearCascade = 0.0;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
	{
		vec3 sc = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
		vec2 edge = min( sc.xy, 1.0 - sc.xy );
		nearCascade = smoothstep( 0.0, 0.1, min( edge.x, edge.y ) ) * step( 0.0, sc.z ) * step( sc.z, 1.0 );
	}
	#endif`
    )
    .replace(
      shadowLine,
      `{
			float sunShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
			#if NUM_DIR_LIGHT_SHADOWS > 1
			if ( UNROLLED_LOOP_INDEX == 0 ) sunShadow *= nearCascade;
			if ( UNROLLED_LOOP_INDEX == 1 ) sunShadow *= 1.0 - nearCascade;
			#endif
			directLight.color *= sunShadow;
		}`
    );
  installed = true;
  return true;
}
