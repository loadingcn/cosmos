

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D position;
uniform sampler2D levelFbo;
// uniform sampler2D levelFbo[14];

uniform float maxlevel;
uniform float level;
uniform float levels;
// uniform float levelTextureSize;
uniform float repulsion;
uniform float alpha;
uniform float spaceSize;
uniform float theta;

varying vec2 index;

const float MAX_LEVELS_NUM = 14.0;

vec2 calcAdd (vec4 centermass, vec2 ij, vec2 pp) {
  vec2 add=vec2(0.0);
  if(centermass.r>0.0&&centermass.g>0.0&&centermass.b>0.0){
      vec2 centermassPosition=vec2(centermass.rg/centermass.b);
      vec2 distVector=pp-centermassPosition;
      float l=dot(distVector,distVector);
      if(l>0.0){
          float c=alpha*repulsion*centermass.b;
          add= c / l * distVector;
      }
  }
  return add;
}

void main() {
  vec4 pointPosition = texture2D(position, index);
  float x = pointPosition.x;
  float y = pointPosition.y;

  vec4 velocity = vec4(vec2(0.0), 1.0, 0.0);

  // for (int lv = 0; lv < 14; lv += 1) {
  //   float level = float(lv);
    float levelTextureSize = pow(2.0, level + 1.0);

    float left = 0.0;
    float top = 0.0;
    float right = spaceSize;
    float bottom = spaceSize;

    float n_left = 0.0;
    float n_top = 0.0;
    float n_right = 0.0;
    float n_bottom = 0.0;

    float cellSize = 0.0;
    float maxi = 0.0;


    maxi = min(MAX_LEVELS_NUM-1.0, level);

    cellSize = pow(2.0, levels - maxi);

    left = max(0.0, floor(x / cellSize- theta)) * cellSize;
    top = max(0.0, floor(y / cellSize- theta)) * cellSize;
    right = 8192.0 - max(0.0, floor((8192.0 - x) / cellSize - theta)) * cellSize;
    bottom = 8192.0 - max(0.0, floor((8192.0 - y) / cellSize- theta)) * cellSize;

    cellSize = pow(2.0, levels - maxi - 1.0);

    n_left = max(0.0, floor((x - left)/cellSize - theta));
    n_top = max(0.0, floor((y - top)/cellSize - theta));
    n_right = max(0.0, floor((right - x)/cellSize - theta));
    n_bottom = max(0.0, floor((bottom - y)/cellSize - theta));




    maxi = bottom - top - cellSize * min(n_top, n_bottom);
    maxi = max(maxi,  right - left - cellSize * min(n_right, n_left));
    maxi = floor(maxi);

    float maxj =  n_left;
    maxj = max(maxj, n_top);
    maxj = max(maxj, n_right);
    maxj = max(maxj, n_bottom); 
    maxj = floor(maxj);

    for (float i = 0.0; i <= 6.0; i += 1.0) {

      for (float j = 0.0; j <= 2.0; j += 1.0) {

        float n = left + cellSize * j;
        float m = top + cellSize * n_top + cellSize * i;

        if (n < (left + n_left * cellSize) && m < bottom) {
          vec2 ij = vec2(n / cellSize, m / cellSize) / levelTextureSize;
          vec4 centermass=texture2D(levelFbo, ij);
          velocity.xy += calcAdd(centermass, ij, pointPosition.xy);
        }

        n = left + cellSize * i;
        m = top + cellSize * j;

        if (n < (right - n_right * cellSize) && m < (top + n_top * cellSize)) {
          vec2 ij = vec2(n / cellSize, m / cellSize) / levelTextureSize;
          vec4 centermass=texture2D(levelFbo, ij);
          velocity.xy += calcAdd(centermass, ij, pointPosition.xy);
        }

        n = right - n_right * cellSize + cellSize * j;
        m = top + cellSize * i;

        if (n < right && m < (bottom - n_bottom * cellSize)) {
          vec2 ij = vec2(n / cellSize, m / cellSize) / levelTextureSize;
          vec4 centermass=texture2D(levelFbo, ij);
          velocity.xy += calcAdd(centermass, ij, pointPosition.xy);
        }

        n = left + n_left * cellSize + cellSize * i;
        m = bottom - n_bottom * cellSize + cellSize * j;

        if (n < right && m < bottom) {
          vec2 ij = vec2(n / cellSize, m / cellSize) / levelTextureSize;
          vec4 centermass=texture2D(levelFbo, ij);
          velocity.xy += calcAdd(centermass, ij, pointPosition.xy);
        }

      }
 
    }
  // }
  gl_FragColor = velocity;

}