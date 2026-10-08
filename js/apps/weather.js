/* Weather — live forecasts from the free Open-Meteo API (no key needed) */
'use strict';

OS.registerApp({
  id: 'weather', name: 'Weather', icon: 'weather', category: 'Apps', width: 820, height: 580, minWidth: 380, single: true,
  desc: 'Live weather forecasts for any city', keywords: 'forecast temperature rain',
  launch(win) {
    const CODES = {
      0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
      45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
      56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'], 61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
      66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'], 71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
      80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Violent showers', '⛈️'], 85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
      95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm & hail', '⛈️'], 99: ['Thunderstorm & hail', '⛈️'],
    };
    const code = c => CODES[c] || ['Unknown', '🌡️'];
    let units = OS.data.get('weather.units', 'c');
    let cities = OS.data.get('weather.cities', [{ name: 'London', country: 'United Kingdom', lat: 51.5085, lon: -0.1257 }]);
    let current = cities[0];

    const search = U.h('input', { class: 'input', placeholder: 'Search city…', type: 'search' });
    const results = U.h('div', { class: 'wx-results', hidden: true });
    const side = U.h('div', { class: 'wx-cities' });
    const main = U.h('div', { class: 'wx-main' });
    const unitBtn = U.h('button', { class: 'btn', onclick: () => { units = units === 'c' ? 'f' : 'c'; OS.data.set('weather.units', units); unitBtn.textContent = '°' + units.toUpperCase(); load(); } }, '°' + units.toUpperCase());
    win.body.append(
      U.h('div', { class: 'toolbar' }, U.h('div', { class: 'wx-search' }, search, results),
        U.h('button', { class: 'btn', title: 'Use my location', onclick: locate }, '📍 My location'), unitBtn,
        U.h('button', { class: 'btn icon-btn', title: 'Refresh', onclick: () => load() }, '↻')),
      U.h('div', { class: 'app-split' }, U.h('div', { class: 'app-side' }, side), main));

    const doSearch = U.debounce(async () => {
      const q = search.value.trim();
      if (q.length < 2) { results.hidden = true; return; }
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
        const j = await r.json();
        results.innerHTML = '';
        (j.results || []).forEach(c => results.appendChild(U.h('button', { class: 'wx-res', onclick: () => {
          const city = { name: c.name, country: [c.admin1, c.country].filter(Boolean).join(', '), lat: c.latitude, lon: c.longitude };
          if (!cities.some(x => x.lat === city.lat && x.lon === city.lon)) { cities.unshift(city); OS.data.set('weather.cities', cities.slice(0, 12)); }
          current = city; results.hidden = true; search.value = ''; load();
        } }, U.h('b', {}, c.name), U.h('small', { class: 'muted' }, ' ' + [c.admin1, c.country].filter(Boolean).join(', ')))));
        if (!(j.results || []).length) results.appendChild(U.h('div', { class: 'muted', style: { padding: '8px' } }, 'No matches'));
        results.hidden = false;
      } catch { results.innerHTML = '<div class="muted" style="padding:8px">Offline — cannot search.</div>'; results.hidden = false; }
    }, 300);
    search.addEventListener('input', doSearch);
    search.addEventListener('keydown', e => { if (e.key === 'Escape') results.hidden = true; });

    function locate() {
      if (!navigator.geolocation) return OS.dialog.alert('Location is not available in this browser.');
      navigator.geolocation.getCurrentPosition(p => {
        current = { name: 'My location', country: `${p.coords.latitude.toFixed(2)}, ${p.coords.longitude.toFixed(2)}`, lat: p.coords.latitude, lon: p.coords.longitude };
        load();
      }, err => OS.dialog.alert('Could not get your location: ' + err.message));
    }

    function renderCities() {
      side.innerHTML = '';
      side.appendChild(U.h('div', { class: 'sm-h' }, 'Saved places'));
      cities.forEach((c, i) => {
        const el = U.h('button', { class: 'wx-city' + (current && c.lat === current.lat && c.lon === current.lon ? ' active' : ''), onclick: () => { current = c; load(); } },
          U.h('b', {}, c.name), U.h('small', { class: 'muted' }, c.country));
        el.oncontextmenu = e => { e.preventDefault(); OS.menu(e.clientX, e.clientY, [{ label: 'Remove', action: () => { cities.splice(i, 1); OS.data.set('weather.cities', cities); renderCities(); } }]); };
        side.appendChild(el);
      });
    }

    async function load() {
      renderCities();
      if (!current) { main.innerHTML = '<div class="empty-state">Search for a city to see its weather.</div>'; return; }
      main.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
      const u = units === 'f' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '';
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${current.lat}&longitude=${current.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,precipitation&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=auto&forecast_days=7${u}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        render(await r.json());
      } catch (e) {
        main.innerHTML = '';
        main.append(U.h('div', { class: 'empty-state' }, U.h('div', { style: { fontSize: '40px' } }, '📡'), U.h('h3', {}, 'Could not load weather'), U.h('p', { class: 'muted' }, 'Check your internet connection. (' + e.message + ')'), U.h('button', { class: 'btn primary', onclick: () => load() }, 'Retry')));
      }
    }

    function render(d) {
      const c = d.current, deg = '°';
      const [desc, emoji] = code(c.weather_code);
      win.setTitle(`${current.name} — Weather`);
      const now = new Date(c.time);
      const hIdx = Math.max(0, d.hourly.time.findIndex(t => new Date(t) >= now));
      const hours = d.hourly.time.slice(hIdx, hIdx + 24).map((t, i) => ({ t, temp: d.hourly.temperature_2m[hIdx + i], code: d.hourly.weather_code[hIdx + i], pp: d.hourly.precipitation_probability ? d.hourly.precipitation_probability[hIdx + i] : null }));
      const min = Math.min(...hours.map(h => h.temp)), max = Math.max(...hours.map(h => h.temp));
      main.innerHTML = '';
      main.className = 'wx-main ' + (c.is_day ? 'day' : 'night') + ' wx-' + (c.weather_code >= 51 ? 'rain' : c.weather_code >= 2 ? 'cloud' : 'clear');
      main.append(
        U.h('div', { class: 'wx-hero' },
          U.h('div', {}, U.h('h2', {}, current.name), U.h('div', { class: 'muted' }, current.country), U.h('div', { class: 'wx-temp' }, Math.round(c.temperature_2m) + deg), U.h('div', {}, desc), U.h('div', { class: 'muted' }, `H: ${Math.round(d.daily.temperature_2m_max[0])}${deg}  L: ${Math.round(d.daily.temperature_2m_min[0])}${deg}`)),
          U.h('div', { class: 'wx-emoji' }, emoji)),
        U.h('div', { class: 'wx-stats' },
          stat('Feels like', Math.round(c.apparent_temperature) + deg), stat('Humidity', c.relative_humidity_2m + '%'),
          stat('Wind', Math.round(c.wind_speed_10m) + (units === 'f' ? ' mph' : ' km/h')), stat('Precip.', c.precipitation + (units === 'f' ? ' in' : ' mm')),
          stat('Sunrise', d.daily.sunrise[0].slice(11)), stat('Sunset', d.daily.sunset[0].slice(11))),
        U.h('h4', {}, 'Next 24 hours'),
        U.h('div', { class: 'wx-hours' }, hours.map((h, i) => U.h('div', { class: 'wx-hour' },
          U.h('small', {}, i === 0 ? 'Now' : h.t.slice(11, 16)),
          U.h('span', { class: 'wx-he' }, code(h.code)[1]),
          U.h('div', { class: 'wx-bar' }, U.h('i', { style: { height: (20 + (h.temp - min) / Math.max(1, max - min) * 50) + 'px' } })),
          U.h('b', {}, Math.round(h.temp) + deg),
          h.pp != null ? U.h('small', { class: 'wx-pp' }, h.pp + '%') : null))),
        U.h('h4', {}, '7-day forecast'),
        U.h('div', { class: 'wx-days' }, d.daily.time.map((t, i) => {
          const lo = Math.min(...d.daily.temperature_2m_min), hi = Math.max(...d.daily.temperature_2m_max);
          const a = (d.daily.temperature_2m_min[i] - lo) / Math.max(1, hi - lo) * 100, b = (d.daily.temperature_2m_max[i] - lo) / Math.max(1, hi - lo) * 100;
          return U.h('div', { class: 'wx-day' },
            U.h('span', { class: 'wx-dn' }, i === 0 ? 'Today' : new Date(t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })),
            U.h('span', {}, code(d.daily.weather_code[i])[1]),
            U.h('small', { class: 'wx-pp' }, (d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[i] : 0) + '%'),
            U.h('span', { class: 'muted' }, Math.round(d.daily.temperature_2m_min[i]) + deg),
            U.h('div', { class: 'wx-range' }, U.h('i', { style: { left: a + '%', width: Math.max(4, b - a) + '%' } })),
            U.h('b', {}, Math.round(d.daily.temperature_2m_max[i]) + deg));
        })),
        U.h('small', { class: 'muted wx-credit' }, 'Weather data by Open-Meteo.com'));
    }
    const stat = (k, v) => U.h('div', { class: 'wx-stat' }, U.h('small', { class: 'muted' }, k), U.h('b', {}, v));

    win.interval(() => load(), 15 * 60 * 1000);
    load();
  },
});
