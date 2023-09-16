
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D position;
uniform float linkSpring;
uniform float linkDistance;
uniform vec2 linkDistRandomVariationRange;

uniform sampler2D linkFirstIndicesAndAmount;
uniform sampler2D linkIndices;
uniform sampler2D linkBiasAndStrength;
uniform sampler2D linkRandomDistanceFbo;

uniform float pointsTextureSize;
uniform float linksTextureSize;
uniform float alpha;

attribute vec2 linkTextureIndex;
varying vec4 velocity;

void main() {
  vec4 bothNodeIndex = texture2D(linkIndices, linkTextureIndex / linksTextureSize);
  vec2 pointIndex = bothNodeIndex.ba;
  vec2 connectedPointIndex = bothNodeIndex.rg;
  velocity = vec4(0.0);

  vec4 pointPosition = texture2D(position, (pointIndex + 0.5) / pointsTextureSize);
  vec4 connectedPointPosition = texture2D(position, (connectedPointIndex + 0.5) / pointsTextureSize);
  vec4 biasAndStrength = texture2D(linkBiasAndStrength, linkTextureIndex / linksTextureSize);
  vec4 randomMinDistance = texture2D(linkRandomDistanceFbo, linkTextureIndex / linksTextureSize);

  float bias = biasAndStrength.r;
  float strength = biasAndStrength.g;
  float randomMinLinkDist =
      randomMinDistance.r *
          (linkDistRandomVariationRange.g - linkDistRandomVariationRange.r) +
      linkDistRandomVariationRange.r;
  randomMinLinkDist *= linkDistance;

  float x = connectedPointPosition.x - (pointPosition.x + velocity.x);
  float y = connectedPointPosition.y - (pointPosition.y + velocity.y);
  float l = sqrt(x * x + y * y);
  l = max(l, randomMinLinkDist * 0.99);
  l = (l - randomMinLinkDist) / l;
  l *= linkSpring * alpha;
  l *= strength;
  l *= bias;
  x *= l;
  y *= l;
  velocity.x += x;
  velocity.y += y;
  
  vec2 pos = 2.0 * (pointIndex + 0.5) / pointsTextureSize -1.0;
  gl_Position = vec4(pos, 0, 1);
  gl_PointSize = 1.0;
}
