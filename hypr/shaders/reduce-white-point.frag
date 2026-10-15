#version 300 es

precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;

layout(location = 0) out vec4 fragColor;

// Matches iOS's default intensity (25%). Not a brightness cut -- like
// Reduce White Point, this composites a translucent mid-gray over the
// content so peak whites get capped and contrast softens, rather than
// scaling luminance down uniformly (which is just what the backlight
// slider already does).
const float INTENSITY = 0.25;
const vec3 GRAY = vec3(0.5, 0.5, 0.5);

void main() {
    vec4 c = texture(tex, v_texcoord);
    fragColor = vec4(mix(c.rgb, GRAY, INTENSITY), c.a);
}
