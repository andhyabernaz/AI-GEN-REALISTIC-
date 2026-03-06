export type AspectRatio = "1:1" | "9:16" | "16:9" | "4:3" | "3:4";

export interface AspectRatioOption {
  value: AspectRatio;
  label: string;
}

export interface ImageFile {
  data: string; // base64 data
  mimeType: string;
  previewUrl: string; // full data URL for <img> src
}

export interface HistoryItem {
    id: string;
    timestamp: number;
    prompt: string;
    images: string[];
    aspectRatio: AspectRatio;
    numberOfImages: number;
}
