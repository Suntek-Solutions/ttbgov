declare module "multilingual-purejs-ocr" {
  interface OnnxOptions {
    executionProviders?: string[];
    intraOpNumThreads?: number;
    graphOptimizationLevel?: string;
    enableCpuMemArena?: boolean;
    executionMode?: string;
  }

  interface OcrCreateOptions {
    language?: string;
    detectionThreshold?: number;
    confidenceThreshold?: number;
    unclipRatio?: number;
    maxImageSize?: number;
    detectionModelPath?: string;
    recognitionModelPath?: string;
    dictionaryPath?: string;
    detectionOnnxOptions?: OnnxOptions;
    recognitionOnnxOptions?: OnnxOptions;
  }

  interface OcrElement {
    text: string;
    confidence: number;
  }

  interface OcrParagraph {
    text: string;
    elements: OcrElement[];
  }

  interface OcrResult {
    elements: OcrElement[];
    paragraphs: OcrParagraph[];
  }

  class Ocr {
    static create(options: OcrCreateOptions | string): Promise<Ocr>;
    detect(imagePath: string): Promise<OcrResult>;
  }

  export default Ocr;
}
