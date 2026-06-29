# Комментарий при покупке товара

## Цель

Дать администратору возможность включить обязательное текстовое поле при покупке конкретного товара. Пользователь не может создать заказ без заполненного комментария, если товар его требует. Комментарий сохраняется в заказе.

---

## Этапы реализации

### Этап 1: Миграция БД

Добавить поля в таблицы и обновить RPC-функцию покупки.

**Изменения в `shop_products`:**

- `comment_required` (boolean, NOT NULL, DEFAULT false) — флаг обязательного комментария
- `comment_label` (text, nullable) — заголовок поля ввода (напр. "Укажите размер и название")
- `comment_placeholder` (text, nullable) — плейсхолдер поля (напр. "Чикен терияки маленькая")

**Изменения в `shop_orders`:**

- `user_comment` (text, nullable) — комментарий пользователя при покупке

**Изменения в `purchase_product()`:**

- Добавить параметр `p_user_comment text DEFAULT NULL`
- При создании заказа записать `user_comment = p_user_comment`
- Добавить серверную валидацию: если `product.comment_required = true` и `p_user_comment IS NULL OR trim(p_user_comment) = ''` → вернуть ошибку `'comment_required'`

**Затрагиваемые файлы:**

- `supabase/migrations/079_product_comment_required.sql` (новый)

**Зависимости:** нет

---

### Этап 2: Типы и Server Actions

Обновить TypeScript-типы и серверные экшены под новую схему.

**`src/modules/shop/types.ts`:**

- Добавить в `ShopProduct`: `comment_required: boolean`, `comment_label: string | null`, `comment_placeholder: string | null`
- Добавить в `ShopOrder`: `user_comment: string | null`
- Добавить в `CreateProductSchema` и `UpdateProductSchema`: `comment_required`, `comment_label`, `comment_placeholder`
- Добавить тип `PurchaseProductInput`: `{ product_id: string; user_comment?: string }`

**`src/modules/shop/actions.ts`:**

- `purchaseProduct(input: PurchaseProductInput)` — принимать объект вместо голого `productId`, передавать `user_comment` в RPC
- Валидация `comment_required` — только на уровне RPC (единственный источник правды). Server Action не дублирует эту проверку — просто передаёт `user_comment` как есть
- `createProduct`, `updateProduct` — пробросить новые поля в Supabase insert/update

**Затрагиваемые файлы:**

- `src/modules/shop/types.ts`
- `src/modules/shop/actions.ts`

**Зависимости:** Этап 1

---

### Этап 3: Админка — форма товара

Добавить UI управления комментарием в форму редактирования/создания товара и индикацию в таблице.

**`ProductFormModal.tsx`:**

- Добавить чекбокс "Требовать комментарий при покупке"
- При `comment_required = true` — показать два поля: "Заголовок поля" и "Плейсхолдер"
- Поля скрываются при снятии чекбокса

**`ProductsClient.tsx`:**

- В таблице товаров добавить иконку-индикатор (напр. `MessageSquare` из lucide) рядом с названием или в отдельной колонке, если `comment_required = true`

**Затрагиваемые файлы:**

- `src/modules/admin/components/ProductFormModal.tsx`
- `src/modules/admin/components/ProductsClient.tsx`

**Зависимости:** Этап 2

---

### Этап 4: Магазин — UI покупки с комментарием

Добавить диалог с полем комментария в компонент кнопки покупки.

**`PurchaseButton.tsx`:**

- Если `product.comment_required = true`: при клике открывать inline-диалог (состояние внутри компонента)
- Диалог показывает: `product.comment_label` как label, `product.comment_placeholder` как placeholder
- Кнопка подтверждения заблокирована пока `trim(comment) === ''` — это UX-блокировка, не бизнес-правило
- При подтверждении — вызвать `purchaseProduct({ product_id, user_comment })`
- Если `comment_required = false`: поведение как сейчас (прямая покупка без диалога)
- Использовать существующий диалоговый примитив из `src/components/`, если есть; иначе — состояние + Tailwind-оверлей без новых зависимостей

**Затрагиваемые файлы:**

- `src/modules/shop/components/PurchaseButton.tsx`

**Зависимости:** Этап 2

---

### Этап 5: Документация

Обновить `src/docs/shop.md` — отразить новые поля и поведение при `comment_required`.

**Затрагиваемые файлы:**

- `src/docs/shop.md`

**Зависимости:** Этап 4

---

## Критерии готовности

- [ ] Миграция накатывается без ошибок
- [ ] Товар без `comment_required` покупается как раньше (без регрессий)
- [ ] Товар с `comment_required=true` нельзя купить без комментария (блокировка на клиенте и на сервере в RPC)
- [ ] Комментарий сохраняется в `shop_orders.user_comment` и виден администратору
- [ ] Админ может включить/выключить комментарий для любого товара
- [ ] Поля label/placeholder отображаются корректно в форме покупки
- [ ] `npm run build` и `npm run lint` проходят без ошибок
