export type GenerateOutputType = "outline" | "article";

export type GenerateRequest = {
  keyword: string;
  urls: string[];
  outputType: GenerateOutputType;
  targetWordCount?: number;
};

export type ThemeAnalysis = {
  term: string;
  relevantChunks: number;
  keyPassages: string[];
  sources: string[];
};

export type ContentSummary = {
  totalSources: number;
  totalChunks: number;
  totalWords: number;
  avgChunkLength: number;
};

export type SourceMeta = {
  url: string;
  title: string | null;
  position: number;
  contentLength: number;
};

// SSE event stream emitted by the pipeline (mirrors the rewrite/run streaming).
export type GenerateEvent =
  | { type: "scraping"; total: number }
  | { type: "scraped"; url: string; title: string | null; length: number; index: number; total: number }
  | { type: "scrape-error"; url: string; error: string }
  | { type: "chunked"; count: number }
  | { type: "embedding"; count: number }
  | { type: "themes"; themes: ThemeAnalysis[]; summary: ContentSummary; sources: SourceMeta[] }
  | { type: "generating" }
  | { type: "done"; markdown: string }
  | { type: "error"; error: string };
