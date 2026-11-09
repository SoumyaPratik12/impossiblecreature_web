#include <emscripten/emscripten.h>

/*
 * Minimal original-code WebAssembly spike.
 * This is a toolchain check, not game code.
 */
EMSCRIPTEN_KEEPALIVE
int runtime_add(int left, int right) {
    return left + right;
}

EMSCRIPTEN_KEEPALIVE
int runtime_version(void) {
    return 1;
}
