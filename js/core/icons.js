/* WebOS icon set: gradient tiles with simple vector glyphs (no external assets) */
'use strict';

OS.icons = (() => {
  let n = 0;
  const S = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="#fff" stroke="none"';
  const defs = {
    files: ['#ffca28', '#f57f17', `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>`],
    notepad: ['#4fc3f7', '#0277bd', `<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>`],
    code: ['#7c4dff', '#311b92', `<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>`],
    terminal: ['#455a64', '#111', `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9l3 3-3 3M12 15h5"/>`],
    calculator: ['#78909c', '#37474f', `<rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="5" width="8" height="4" rx="1"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" stroke-width="2.6"/>`],
    paint: ['#ff7043', '#c2185b', `<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-1.8-1.5-3 0-1 .8-2 2-2h2.5A4 4 0 0 0 21 10c0-4-4-7-9-7z"/><circle cx="7.5" cy="11" r="1.2" ${F}/><circle cx="10" cy="7" r="1.2" ${F}/><circle cx="14.5" cy="7" r="1.2" ${F}/>`],
    browser: ['#29b6f6', '#1565c0', `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>`],
    music: ['#ec407a', '#6a1b9a', `<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>`],
    video: ['#ef5350', '#880e4f', `<rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 10l5-3v10l-5-3z"/>`],
    photos: ['#26c6da', '#00897b', `<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>`],
    clock: ['#5c6bc0', '#1a237e', `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`],
    calendar: ['#ef5350', '#b71c1c', `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" stroke-width="2.6"/>`],
    taskmgr: ['#66bb6a', '#1b5e20', `<path d="M3 12h4l3-8 4 16 3-8h4"/>`],
    notes: ['#ffee58', '#f9a825', `<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/><path d="M8 9h8M8 13h5"/>`],
    weather: ['#42a5f5', '#0d47a1', `<circle cx="8" cy="9" r="3"/><path d="M8 2v1.5M2 9h1.5M3.8 4.8l1 1M12.2 4.8l-1 1"/><path d="M8 20h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 8 20z" fill="rgba(255,255,255,.25)"/>`],
    settings: ['#90a4ae', '#455a64', `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="7"/>`],
    about: ['#26a69a', '#004d40', `<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01" stroke-width="2.4"/>`],
    trash: ['#90a4ae', '#546e7a', `<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`],
    store: ['#ab47bc', '#4a148c', `<path d="M4 8h16l-1.5 12h-13z"/><path d="M8 8a4 4 0 0 1 8 0"/>`],
    markdown: ['#8d6e63', '#3e2723', `<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15V9l2.5 3L11 9v6M15 9v6M13 13l2 2 2-2"/>`],
    recorder: ['#ef5350', '#4a148c', `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>`],
    // Games
    snake: ['#66bb6a', '#2e7d32', `<path d="M4 18c3 0 3-4 6-4s3 4 6 4 3-6 0-6H9c-3 0-3-6 0-6h6"/><circle cx="17" cy="6" r="1" ${F}/>`],
    tetris: ['#ab47bc', '#4527a0', `<path d="M4 12h5v5H4zM9 12h5v5H9zM9 7h5v5H9zM14 12h5v5h-5z" fill="rgba(255,255,255,.25)"/>`],
    minesweeper: ['#9e9e9e', '#424242', `<circle cx="12" cy="13" r="6" fill="rgba(255,255,255,.3)"/><path d="M12 3v3M12 20v1M3 13h3M18 13h3M5.6 6.6l2 2M18.4 6.6l-2 2"/><circle cx="10" cy="11" r="1.2" ${F}/>`],
    g2048: ['#ffb74d', '#e65100', `<text x="12" y="15.5" font-family="system-ui,sans-serif" font-size="8.5" font-weight="800" text-anchor="middle" fill="#fff" stroke="none">2048</text><rect x="2" y="5" width="20" height="14" rx="3"/>`],
    tictactoe: ['#26c6da', '#006064', `<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M4.5 4.5l3 3M7.5 4.5l-3 3" stroke-width="1.6"/><circle cx="18" cy="18" r="1.6" stroke-width="1.6"/>`],
    breakout: ['#ff7043', '#bf360c', `<path d="M3 4h5v3H3zM9.5 4h5v3h-5zM16 4h5v3h-5zM3 8.5h5v3H3zM16 8.5h5v3h-5z" fill="rgba(255,255,255,.3)"/><circle cx="12" cy="15" r="1.5" ${F}/><path d="M8 20h8"/>`],
    solitaire: ['#43a047', '#1b5e20', `<rect x="4" y="5" width="11" height="15" rx="2" fill="rgba(255,255,255,.2)"/><rect x="9" y="3" width="11" height="15" rx="2" fill="#2e7d32"/><path d="M14.5 7c-1.5 1.8-3 2.8-3 4.3a1.6 1.6 0 0 0 3 .8 1.6 1.6 0 0 0 3-.8c0-1.5-1.5-2.5-3-4.3zM14.5 12v2.5" fill="#fff" stroke-width="1"/>`],
    memory: ['#ec407a', '#880e4f', `<rect x="3" y="4" width="8" height="11" rx="1.5"/><rect x="13" y="9" width="8" height="11" rx="1.5" fill="rgba(255,255,255,.25)"/><path d="M7 8.5v2.5M17 13v3" /><path d="M7 13h.01" stroke-width="2.4"/>`],
    flappy: ['#4dd0e1', '#00838f', `<ellipse cx="11" cy="13" rx="6" ry="5" fill="#ffeb3b" stroke="#fff"/><circle cx="13.5" cy="11" r="1" fill="#333" stroke="none"/><path d="M17 13.5h3.5l-3.5 2" fill="#ff7043"/><path d="M6 13c1.5-2 3-2 4 0"/>`],
    pong: ['#5c6bc0', '#000', `<path d="M4 6v6M20 12v6"/><circle cx="13" cy="9" r="1.6" ${F}/><path d="M12 3v2M12 8v2M12 13v2M12 18v2" stroke-width="1" opacity=".6"/>`],
    connect4: ['#1e88e5', '#0d47a1', `<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="7" cy="9" r="1.8" fill="#ffeb3b" stroke="none"/><circle cx="12" cy="9" r="1.8" fill="rgba(255,255,255,.3)" stroke="none"/><circle cx="17" cy="9" r="1.8" fill="rgba(255,255,255,.3)" stroke="none"/><circle cx="7" cy="15" r="1.8" fill="#ef5350" stroke="none"/><circle cx="12" cy="15" r="1.8" fill="#ffeb3b" stroke="none"/><circle cx="17" cy="15" r="1.8" fill="#ef5350" stroke="none"/>`],
    chess: ['#8d6e63', '#3e2723', `<path d="M8 21h8M9 18h6l1 3H8zM10 18l-.5-5h5l-.5 5M9 13h6M12 3v2M10.5 4h3M10 7.5a2 2 0 1 1 4 0c0 1.5-1 2-1 3.5h-2c0-1.5-1-2-1-3.5z"/>`],
    // Files
    folder: ['#ffd54f', '#ffa000', `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="rgba(255,255,255,.25)"/>`],
    file: ['#b0bec5', '#607d8b', ``],
    filetext: ['#64b5f6', '#1976d2', `<path d="M6 8h12M6 12h12M6 16h8"/>`],
    filecode: ['#9575cd', '#512da8', `<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>`],
    fileimage: ['#4dd0e1', '#00838f', `<circle cx="8" cy="8" r="2"/><path d="M4 18l5-5 3 3 4-5 4 7z"/>`],
    fileaudio: ['#f06292', '#ad1457', `<path d="M10 17V7l8-2v10"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="15" r="2"/>`],
    filevideo: ['#e57373', '#c62828', `<path d="M9 7v10l8-5z"/>`],
    filepdf: ['#ef5350', '#b71c1c', `<text x="12" y="15" font-size="7" font-weight="800" text-anchor="middle" fill="#fff" stroke="none" font-family="system-ui,sans-serif">PDF</text>`],
    drive: ['#b0bec5', '#455a64', `<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M17 12h.01M14 12h.01" stroke-width="2.6"/>`],
    desktop: ['#4fc3f7', '#01579b', `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>`],
    documents: ['#64b5f6', '#1565c0', `<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>`],
    downloads: ['#81c784', '#2e7d32', `<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`],
    pictures: ['#4dd0e1', '#00838f', `<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>`],
    user: ['#7986cb', '#283593', `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`],
    logo: ['#42a5f5', '#7e57c2', `<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="rgba(255,255,255,.9)" stroke="none"/>`],
  };

  function tile(name, size) {
    const d = defs[name] || defs.file;
    const id = 'ig' + (++n);
    const isFile = name.startsWith('file') && name !== 'files';
    const body = isFile
      ? `<path d="M12 3h16l11 11v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="url(#${id})"/><path d="M28 3v9a2 2 0 0 0 2 2h9z" fill="rgba(255,255,255,.45)"/><g transform="translate(12.5 18) scale(.95)" ${S}>${d[2]}</g>`
      : name === 'folder'
        ? `<path d="M4 12a4 4 0 0 1 4-4h10l4 4h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="url(#${id})"/><path d="M4 18a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#ffe082" opacity=".9"/>`
        : `<rect x="2" y="2" width="44" height="44" rx="11" fill="url(#${id})"/><rect x="2" y="2" width="44" height="22" rx="11" fill="rgba(255,255,255,.12)"/><g transform="translate(10.5 10.5) scale(1.125)" ${S}>${d[2]}</g>`;
    return `<svg class="icon-svg" viewBox="0 0 48 48" width="${size || 48}" height="${size || 48}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${d[0]}"/><stop offset="1" stop-color="${d[1]}"/></linearGradient></defs>${body}</svg>`;
  }

  /** Plain monochrome glyph (for toolbars / menus) */
  function glyph(name, size = 16) {
    const d = defs[name];
    if (!d) return '';
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="color:currentColor" aria-hidden="true"><g ${S.replace('#fff', 'currentColor')}>${d[2].replace(/#fff/g, 'currentColor')}</g></svg>`;
  }

  /** Icon name for a file path */
  function forFile(name, isDir) {
    if (isDir) {
      const special = { Desktop: 'desktop', Documents: 'documents', Downloads: 'downloads', Pictures: 'pictures', Music: 'music', Videos: 'video', '.Trash': 'trash' };
      return special[name] || 'folder';
    }
    const e = U.ext(name);
    if (U.imageExts.includes(e)) return 'fileimage';
    if (U.audioExts.includes(e)) return 'fileaudio';
    if (U.videoExts.includes(e)) return 'filevideo';
    if (e === 'pdf') return 'filepdf';
    if (['js', 'ts', 'css', 'html', 'htm', 'json', 'py', 'xml', 'c', 'cpp', 'java', 'sh', 'go', 'rs', 'php', 'rb'].includes(e)) return 'filecode';
    if (U.textExts.includes(e)) return 'filetext';
    if (e === 'lnk') return 'file';
    return 'file';
  }

  const has = name => !!defs[name];

  return { tile, glyph, forFile, has, defs };
})();
