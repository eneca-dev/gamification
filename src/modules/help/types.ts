export interface HelpVariableMeta {
  key: string
  name: string
  value: string
}

export interface HelpFolder {
  id: string
  slug: string
  label: string
  sort_order: number
}

export interface HelpArticle {
  id: string
  slug: string
  folder: Pick<HelpFolder, 'id' | 'slug' | 'label'>
  title: string
  content: string
  sort_order: number
  is_published: boolean
  show_in_help: boolean
  updated_at: string
}

export interface HelpFolderWithArticles {
  id: string
  slug: string
  label: string
  articles: Pick<HelpArticle, 'slug' | 'title' | 'content'>[]
}

export interface HelpChunk {
  id: string
  article_id: string
  slug: string
  chunk_index: number
  content: string
  created_at: string
}

export interface ReembedLog {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'done' | 'error'
  error: string | null
}
