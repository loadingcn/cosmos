#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D prevFbo;
uniform float levelTextureSize;

varying vec2 index;

void main() {

  float prevLvTexSize = levelTextureSize * 2.0;
  vec2 pixelPos = index * levelTextureSize;
  vec2 prevPos = pixelPos * 2.0;
  
  vec4 prevInfo = texture2D(prevFbo, prevPos / prevLvTexSize);
  prevInfo += texture2D(prevFbo, (prevPos + vec2(0.0, 1.0)) / prevLvTexSize);
  prevInfo += texture2D(prevFbo, (prevPos + vec2(1.0, 0.0)) / prevLvTexSize);
  prevInfo += texture2D(prevFbo, (prevPos + vec2(1.0, 1.0)) / prevLvTexSize);

  gl_FragColor = prevInfo;
}