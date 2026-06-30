import type { OnboardingTour } from '../types'

export const adminHelpEditTour: OnboardingTour = {
  pageSlug: 'admin-help-edit',
  steps: [
    {
      id: 'admin-help-edit-content',
      target: 'admin-help-edit-content',
      title: 'Формат Markdown',
      description:
        'Статья пишется в формате Markdown — простая разметка для заголовков, списков, ссылок и таблиц. Большой текст удобно подготовить через ИИ (например, DeepSeek или ChatGPT), указав в запросе, что нужен текст в формате Markdown, и вставить результат сюда.',
      placement: 'top',
    },
    {
      id: 'admin-help-edit-variables',
      target: 'admin-help-edit-variables',
      title: 'Переменные',
      description:
        'В тексте можно использовать переменные — значения из базы данных, которые подставляются автоматически (количество кристаллов, пороги, цены). Поставьте курсор в нужное место и нажмите правую кнопку мыши в поле редактора, чтобы вставить переменную.',
      placement: 'bottom',
    },
    {
      id: 'admin-help-edit-preview',
      target: 'admin-help-edit-preview',
      title: 'Предпросмотр',
      description:
        'Кнопка «Предпросмотр» показывает, как статья будет выглядеть для пользователей: Markdown отрисуется, а переменные подставятся реальными значениями. Нажмите ещё раз, чтобы вернуться к редактору.',
      placement: 'bottom',
    },
    {
      id: 'admin-help-edit-published',
      target: 'admin-help-edit-published',
      title: 'Статья опубликована',
      description:
        'Флажок «Опубликована» управляет видимостью статьи: если он включён, статья видна всем пользователям в разделе «Справка». Снимите флажок, чтобы скрыть черновик, пока он не готов.',
      placement: 'bottom',
    },
    {
      id: 'admin-help-edit-reembed',
      target: null,
      title: 'Обновите чанки для чат-бота',
      description:
        'Чат-бот использует все статьи справки для своих ответов. Поэтому после сохранения новой или изменённой статьи нажмите кнопку «Обновить чанки» — она появится справа сверху в плашке об успешном сохранении. Без этого чат-бот не узнает об изменениях.',
      placement: 'center',
    },
  ],
}
