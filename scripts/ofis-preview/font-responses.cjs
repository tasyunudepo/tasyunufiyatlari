const path = require('node:path');
const fonts = require(path.resolve(process.cwd(), '.ofis-preview/root-fonts.json'));
module.exports = new Proxy({}, { get(_, url) {
  const family = new URL(String(url)).searchParams.get('family')?.split(':')[0];
  return fonts[family]?.replace(/url\("([^"]+)"\)/g, 'url($1)').replace(/font-family: ([^;]+);/g, "font-family: '$1';");
}});
