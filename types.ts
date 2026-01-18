
export interface Badge {
  id: string;
  name: string;
  url: string;
  file_path?: string;
  zoom_level?: number; // 0: Normal, 1: Zoom Out, 2: Mega Zoom
}

export type ViewMode = 'viewer' | 'uploader' | 'list';
