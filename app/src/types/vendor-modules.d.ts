declare module "mammoth/mammoth.browser.js";
declare module "pdfjs-dist/build/pdf.mjs";
declare module "pdfjs-dist/build/pdf.worker.mjs?url" {
  const src: string;
  export default src;
}
