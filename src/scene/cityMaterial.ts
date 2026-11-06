import * as THREE from 'three';

/**
 * MeshStandardMaterial extended with:
 *  - world-space procedural windows (floors align across every building)
 *  - neon edge glow computed from the unit-box local coordinates
 *  - per-instance colour, seed and interaction state (hover / selected / dimmed)
 *
 * Per-instance attributes expected on the geometry:
 *   aColor (vec3)  aSeed (float)  aState (float: 0 normal, 1 hover, 2 selected, 3 dimmed)
 */
export function createCityMaterial(opts: { windows: boolean; dark: boolean }) {
  const uniforms = {
    uDark: { value: opts.dark ? 1 : 0 },
    uWindows: { value: opts.windows ? 1 : 0 },
    uTime: { value: 0 },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: opts.dark ? '#0b1020' : '#e8edf5',
    roughness: opts.dark ? 0.35 : 0.55,
    metalness: opts.dark ? 0.6 : 0.1,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aColor;
        attribute float aSeed;
        attribute float aState;
        varying vec3 vCityColor;
        varying float vSeed;
        varying float vState;
        varying vec3 vLocal;
        varying vec3 vScale;
        varying vec3 vObjNormal;
        varying vec3 vWorldP;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vCityColor = aColor;
        vSeed = aSeed;
        vState = aState;
        vLocal = position;
        vObjNormal = normal;
        #ifdef USE_INSTANCING
          vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vWorldP = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vScale = vec3(1.0);
          vWorldP = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uDark;
        uniform float uWindows;
        uniform float uTime;
        varying vec3 vCityColor;
        varying float vSeed;
        varying float vState;
        varying vec3 vLocal;
        varying vec3 vScale;
        varying vec3 vObjNormal;
        varying vec3 vWorldP;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 an = abs(vObjNormal);
        bool isRoof = an.y > 0.5;
        // distance (world units) to the box edges on this face
        vec3 dEdge = (0.5 - abs(vLocal)) * vScale;
        float edgeDist = isRoof ? min(dEdge.x, dEdge.z) : (an.x > 0.5 ? min(dEdge.y, dEdge.z) : min(dEdge.x, dEdge.y));
        float edge = 1.0 - smoothstep(0.03, 0.16, edgeDist);

        float fu = an.x > 0.5 ? vLocal.z * vScale.z : vLocal.x * vScale.x;
        vec2 cell = vec2(fu / 0.95, vWorldP.y / 1.15);
        vec2 cf = fract(cell);
        float win = step(0.2, cf.x) * step(cf.x, 0.8) * step(0.22, cf.y) * step(cf.y, 0.78);
        win *= (isRoof ? 0.0 : 1.0) * uWindows;
        // keep a solid band at ground level and near the top of each tier
        win *= step(1.2, vWorldP.y) * step(0.35, dEdge.y);
        float lit = step(0.42, cityHash(floor(cell) + vSeed * 17.0));

        float dimmed = step(2.5, vState);
        float selected = step(1.5, vState) * (1.0 - dimmed);
        float hovered = step(0.5, vState) * (1.0 - step(1.5, vState));

        vec3 facadeDark = mix(vec3(0.035, 0.045, 0.08), vCityColor * 0.10, 0.5);
        vec3 facadeLight = mix(vec3(0.96, 0.97, 0.99), vCityColor, 0.55);
        vec3 facade = mix(facadeLight, facadeDark, uDark);
        vec3 glass = mix(mix(vec3(0.10, 0.15, 0.25), vCityColor * 0.35, 0.3), vec3(0.02, 0.03, 0.05), uDark);
        diffuseColor.rgb = mix(facade, glass, win * (1.0 - uDark * 0.0));
        if (isRoof) diffuseColor.rgb = mix(diffuseColor.rgb, uDark > 0.5 ? vec3(0.06, 0.07, 0.11) : vec3(0.78, 0.81, 0.86), 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), dimmed * 0.8);
        diffuseColor.rgb *= 1.0 - dimmed * 0.45;
        diffuseColor.rgb = mix(diffuseColor.rgb, vCityColor * 0.42, edge * (1.0 - uDark) * 0.9 * (1.0 - dimmed * 0.7));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float pulse = 0.75 + 0.25 * sin(uTime * 4.0);
        float boost = 1.0 + hovered * 0.8 + selected * (1.4 * pulse);
        float kd = (1.0 - dimmed * 0.88);
        vec3 winGlow = mix(vec3(1.0, 0.86, 0.6), vCityColor, 0.55);
        totalEmissiveRadiance += win * lit * winGlow * mix(0.05, 1.25, uDark) * kd * boost;
        totalEmissiveRadiance += edge * vCityColor * 2.2 * uDark * kd * boost;
        totalEmissiveRadiance += (1.0 - uDark) * (hovered + selected) * vCityColor * 0.35;
        totalEmissiveRadiance += selected * vCityColor * 0.25 * pulse;`,
      );
  };
  mat.customProgramCacheKey = () => `city-${opts.windows ? 1 : 0}`;

  return { material: mat, uniforms };
}
