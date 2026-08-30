/**
 * Оболочка Electron. Собранный SPA отдаётся по своей схеме app://, поэтому
 * абсолютные пути вроде /fonts/fonts.json работают так же, как в браузере,
 * и веб-код не нужно переписывать под file://.
 */
const { app, BrowserWindow, Menu, dialog, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SMOKE = process.argv.includes('--smoke');
const DEV_URL = process.env.KONSPEKT_DEV_URL || '';
const ROOT = path.join(__dirname, '..');
const DIST = path.join(app.getAppPath(), 'dist');
const HOME = 'app://konspekt/index.html';

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
};

function serve() {
  protocol.handle('app', request => {
    const url = new URL(request.url);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = path.join(DIST, rel);
    // Наружу из dist не выпускаем: путь приходит со страницы.
    const inside = target === DIST || target.startsWith(DIST + path.sep);
    const file = inside && fs.existsSync(target) && fs.statSync(target).isFile()
      ? target
      : path.join(DIST, 'index.html');
    // Читаем через fs, а не через file://: внутри asar работает только он.
    const body = fs.readFileSync(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    return new Response(body, { headers: { 'content-type': type } });
  });
}

/** Скачивание PDF: спрашиваем, куда положить, и показываем файл в папке. */
function wireDownloads(session) {
  session.on('will-download', (_event, item) => {
    const name = item.getFilename();
    item.setSaveDialogOptions({
      title: 'Сохранить PDF',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    item.once('done', (_e, state) => {
      if (state === 'completed' && !SMOKE) shell.showItemInFolder(item.getSavePath());
    });
  });
}

function menu(win) {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Печать',
          accelerator: 'CmdOrCtrl+P',
          click: () => win.webContents.print({ printBackground: true }),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { label: 'Правка', role: 'editMenu' },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Обычный масштаб' },
        { role: 'zoomIn', label: 'Крупнее' },
        { role: 'zoomOut', label: 'Мельче' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Во весь экран' },
      ],
    },
    { label: 'Окно', role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 640,
    backgroundColor: '#e9ebef',
    title: 'Конспект от руки',
    show: !SMOKE,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  wireDownloads(win.webContents.session);
  menu(win);

  // Внешние ссылки уходят в системный браузер, окно остаётся приложением.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(DEV_URL || HOME);
  return win;
}

app.whenReady().then(async () => {
  serve();
  const win = await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });

  if (SMOKE) await smoke(win);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/**
 * Проверка собранного приложения без рук: дождаться страниц, нажать обе кнопки
 * PDF, убедиться, что получился настоящий PDF, снять скриншот окна.
 */
async function smoke(win) {
  const script = `(async () => {
    const wait = async (test, ms = 25000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        if (test()) return true;
        await new Promise(r => setTimeout(r, 120));
      }
      return false;
    };
    const ready = await wait(() => document.querySelectorAll('.sheet').length > 0);
    const grabbed = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { grabbed.push({ name: this.download, href: this.href }); };
    const button = t => [...document.querySelectorAll('.panel button')].find(b => b.textContent.includes(t));
    button('PDF страницами').click();
    await wait(() => grabbed.length === 1);
    button('тетрадью').click();
    await wait(() => grabbed.length === 2);
    HTMLAnchorElement.prototype.click = orig;
    const files = [];
    for (const g of grabbed) {
      const bytes = new Uint8Array(await (await fetch(g.href)).arrayBuffer());
      files.push({
        name: g.name,
        kb: Math.round(bytes.length / 1024),
        head: new TextDecoder().decode(bytes.slice(0, 8)),
        eof: new TextDecoder().decode(bytes.slice(-8)).includes('%%EOF'),
      });
    }
    // Кириллица через свою схему: индекс тем и сам файл конспекта.
    const index = await (await fetch('/themes/index.json')).json();
    const theme = index.length ? await (await fetch('/themes/' + index[0].file)).text() : '';

    return {
      ready,
      theme: { name: index.length ? index[0].name : null, chars: theme.length, head: theme.slice(0, 24) },
      origin: location.origin,
      sheets: document.querySelectorAll('.sheet').length,
      fonts: document.fonts.size,
      stats: document.querySelector('.stats').textContent,
      themes: document.querySelectorAll('.panel select option').length,
      error: document.querySelector('.error') ? document.querySelector('.error').textContent : null,
      files,
    };
  })()`;

  let result;
  try {
    result = await win.webContents.executeJavaScript(script, true);
    // Скрытое окно не перерисовывается: показываем без фокуса ради снимка.
    win.showInactive();
    await new Promise(r => setTimeout(r, 900));
    const shot = await win.webContents.capturePage();
    const out = process.env.KONSPEKT_SMOKE_SHOT || path.join(ROOT, 'release', 'smoke.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, shot.toPNG());
    result.screenshot = out;
  } catch (error) {
    console.error('SMOKE FAILED', error);
    app.exit(1);
    return;
  }

  const ok = result.ready
    && !result.error
    && result.theme.chars > 100
    && /[А-Яа-я]/.test(result.theme.head)
    && result.files.length === 2
    && result.files.every(f => f.head === '%PDF-1.7' && f.eof && f.kb > 20);
  console.log(JSON.stringify(result, null, 2));
  console.log(ok ? 'SMOKE OK' : 'SMOKE FAILED');
  app.exit(ok ? 0 : 1);
}

// Диалог с ошибкой вместо молчаливого падения окна.
process.on('uncaughtException', error => {
  if (SMOKE) { console.error(error); app.exit(1); return; }
  dialog.showErrorBox('Конспект от руки', String(error && error.stack || error));
});
