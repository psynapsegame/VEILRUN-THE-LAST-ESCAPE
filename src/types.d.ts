declare module '*.glb' {
  /** URL (Vite build) or raw bytes (single-file build). */
  const asset: string | Uint8Array;
  export default asset;
}
