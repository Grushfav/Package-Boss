/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'jsbarcode' {
  interface JsBarcodeOptions {
    format?: string
    width?: number
    height?: number
    displayValue?: boolean
    fontSize?: number
    margin?: number
  }

  function JsBarcode(
    element: SVGSVGElement | HTMLCanvasElement | string,
    value: string,
    options?: JsBarcodeOptions,
  ): void

  export default JsBarcode
}
