// Shared types for the Kirio Obsidian plugin

export interface Highlight {
  id: string;
  user_uuid: string;
  text: string;
  url: string;
  title: string;
  color_tag: string;   // hex color string e.g. "#f9a8d4"
  created_at: string;
}

export interface YtAnnotation {
  id: string;
  user_uuid: string;
  video_id: string;
  video_title: string;
  channel: string;
  seconds: number;
  label: string;       // 'note' | 'question' | 'important' | 'idea'
  content: string;
  created_at: string;
  updated_at: string;
}

export interface KirioSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const DEFAULT_SETTINGS: KirioSettings = {
  supabaseUrl: 'https://wcqixswwzgcmmymtglgy.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcWl4c3d3emdjbW15bXRnbGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTMzMzksImV4cCI6MjEwNDI2OTMzOX0.6VsxPLC-xlcWykAep1DnJZj85IEO8WqkuIex6fspf_s',
};
