# Шрифты

Файлы `.ttf` сюда не коммитятся. Забрать их одной командой:

```bash
pnpm fonts
```

Скрипт тянет только шрифты под свободными лицензиями:

| Шрифт | Связки | Лицензия | Источник |
|---|---|---|---|
| Pecita | да, буквы соединены | SIL OFL 1.1 | pecita.eu |
| Pacifico | да, но декоративный | SIL OFL 1.1 | github.com/google/fonts |
| Marck Script | нет | SIL OFL 1.1 | github.com/google/fonts |
| Bad Script | нет | SIL OFL 1.1 | github.com/google/fonts |
| Caveat | нет | SIL OFL 1.1 | github.com/google/fonts |

Свой шрифт (например, школьные прописи или собственный почерк, собранный
в Calligraphr) просто положи рядом и добавь строку в `fonts.json`.
Приложение умеет и разовую загрузку файла прямо в браузере — без записи на диск.
