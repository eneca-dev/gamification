export interface HelpArticle {
  id: string
  slug: string
  folder: string
  folder_label: string
  title: string
  content: string
  sort_order: number
  is_published: boolean
  updated_at: string
}

export interface HelpFolder {
  folder: string
  folder_label: string
  articles: Pick<HelpArticle, 'slug' | 'title' | 'content'>[]
}
