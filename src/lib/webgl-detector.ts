export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return gl instanceof WebGLRenderingContext;
  } catch (e) {
    return false;
  }
}

export function getWebGLContext(): WebGLRenderingContext | null {
  const canvas = document.createElement("canvas");
  return (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext;
}
