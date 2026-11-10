declare module '*.glb' {
  /** URL (Vite build) or raw bytes (single-file build). */
  const asset: string | Uint8Array;
  export default asset;
}
declare module '*.hdr' {
  const asset: string | Uint8Array;
  export default asset;
}
declare module '*.webp' {
  /** URL or data URL. */
  const url: string;
  export default url;
}
declare module '*.m4a' {
  const asset: string | Uint8Array;
  export default asset;
}
