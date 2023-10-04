#ifdef GL_ES
precision highp float;
#endif

varying vec4 velocity;

void main() {
  gl_FragColor = velocity;
}