const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'templates');
const OUT_FILE = path.join(OUT_DIR, 'mantolama-teklif-sablonu.xlsx');
const LOGO_FILE = path.join(ROOT, 'public', 'images', 'teklifpdf', 'logo_dark.png');
const BANNER_FILE = path.join(ROOT, 'public', 'images', 'teklifpdf', 'bannerozeryapi.png');

const BUSINESS = {
  legalName: 'ÖzerGrup Yalıtım ve İzolasyon A.Ş.',
  phone: '0 543 518 69 88',
  website: 'www.ozeryapiinsaat.com',
  address: 'Mescit Mah. Ulugüney Sk. Harman Plaza A1 Blok K2 No:15 Tuzla / İstanbul',
};

const BANKS = [
  ['KUVEYTTÜRK', 'TR22 0020 5000 0947 0027 8000 01', 'TL'],
  ['VAKIFBANK', 'TR54 0001 5001 5800 7223 2324 14', 'TL'],
];

const COLORS = {
  navy: '0F172A',
  slate: '334155',
  muted: '64748B',
  line: 'CBD5E1',
  soft: 'F8FAFC',
  section: 'E2E8F0',
  gold: 'A07A2C',
  goldSoft: 'F8EFD3',
  green: '16A34A',
  white: 'FFFFFF',
};

const thinLine = { style: 'thin', color: { argb: COLORS.line } };
const mediumNavy = { style: 'medium', color: { argb: COLORS.navy } };

function border(all = thinLine) {
  return { top: all, right: all, bottom: all, left: all };
}

function fill(color) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function font(opts = {}) {
  return {
    name: 'Aptos',
    size: 10,
    color: { argb: opts.color || COLORS.navy },
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
  };
}

function styleRange(ws, range, style) {
  const [start, end] = range.split(':');
  const startCell = ws.getCell(start);
  const endCell = ws.getCell(end);

  for (let row = startCell.row; row <= endCell.row; row += 1) {
    for (let col = startCell.col; col <= endCell.col; col += 1) {
      Object.assign(ws.getCell(row, col), style);
    }
  }
}

function mergeValue(ws, range, value, style = {}) {
  ws.mergeCells(range);
  const cell = ws.getCell(range.split(':')[0]);
  cell.value = value;
  Object.assign(cell, style);
}

function labelCell(cell, text) {
  cell.value = text;
  cell.font = font({ bold: true, color: COLORS.muted });
  cell.fill = fill(COLORS.soft);
  cell.border = border();
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function inputRange(ws, range) {
  styleRange(ws, range, {
    fill: fill(COLORS.white),
    border: border(),
    font: font(),
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
  });
}

function sectionTitle(ws, row, title) {
  mergeValue(ws, `A${row}:G${row}`, title, {
    fill: fill(COLORS.navy),
    font: font({ bold: true, color: COLORS.white }),
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: border(mediumNavy),
  });
  ws.getRow(row).height = 24;
}

function moneyCell(cell) {
  cell.numFmt = '#,##0.00 ₺';
  cell.font = font({ bold: true });
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
  cell.border = border();
}

function addHeader(ws, workbook) {
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 20;

  ws.mergeCells('A1:C4');
  ws.getCell('A1').fill = fill(COLORS.white);
  ws.getCell('A1').border = { bottom: mediumNavy };

  if (fs.existsSync(LOGO_FILE)) {
    const logoId = workbook.addImage({ filename: LOGO_FILE, extension: 'png' });
    ws.addImage(logoId, {
      tl: { col: 0.2, row: 0.25 },
      ext: { width: 220, height: 56 },
      editAs: 'oneCell',
    });
  }

  mergeValue(ws, 'D1:G1', BUSINESS.legalName.toLocaleUpperCase('tr-TR'), {
    font: font({ bold: true, color: COLORS.navy }),
    alignment: { vertical: 'middle', horizontal: 'right' },
  });
  mergeValue(ws, 'D2:G2', BUSINESS.address, {
    font: font({ color: COLORS.slate }),
    alignment: { vertical: 'middle', horizontal: 'right', wrapText: true },
  });
  mergeValue(ws, 'D3:G3', `Tel: ${BUSINESS.phone}  |  Web: ${BUSINESS.website}`, {
    font: font({ bold: true, color: COLORS.slate }),
    alignment: { vertical: 'middle', horizontal: 'right' },
  });
  mergeValue(ws, 'D4:G4', 'Boş teklif şablonu', {
    font: font({ italic: true, color: COLORS.muted }),
    alignment: { vertical: 'middle', horizontal: 'right' },
  });

  styleRange(ws, 'A1:G4', {
    border: { bottom: mediumNavy },
  });

  mergeValue(ws, 'A5:G5', 'MANTOLAMA SETİ FİYAT TEKLİFİ', {
    fill: fill(COLORS.navy),
    font: { name: 'Aptos Display', size: 16, bold: true, color: { argb: COLORS.white } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: border(mediumNavy),
  });
  ws.getRow(5).height = 30;
}

function addMeta(ws) {
  const cells = [
    ['A7', 'Teklif No'], ['C7', 'Tarih'], ['E7', 'Geçerlilik Tarihi'],
  ];
  for (const [addr, text] of cells) labelCell(ws.getCell(addr), text);
  inputRange(ws, 'B7:B7');
  inputRange(ws, 'D7:D7');
  inputRange(ws, 'F7:G7');
  ws.mergeCells('F7:G7');
  ws.getRow(7).height = 22;
}

function addCustomerProject(ws) {
  sectionTitle(ws, 9, 'MÜŞTERİ & PROJE BİLGİLERİ');

  const labels = [
    ['A10', 'Firma / Sayın'], ['C10', 'İlgili Kişi'], ['E10', 'Telefon'],
    ['A11', 'E-posta'], ['C11', 'İl / İlçe'], ['E11', 'Teslimat Adresi'],
    ['A12', 'Seçilen Sistem'], ['C12', 'Malzeme'], ['E12', 'Kalınlık (cm)'],
    ['A13', 'Toplam Metraj (m²)'], ['C13', 'Nakliye Durumu'], ['E13', 'Paket / Açıklama'],
  ];

  for (const [addr, text] of labels) labelCell(ws.getCell(addr), text);
  ['B10:B10', 'D10:D10', 'F10:G10', 'B11:B11', 'D11:D11', 'F11:G11', 'B12:B12', 'D12:D12', 'F12:G12', 'B13:B13', 'D13:D13', 'F13:G13']
    .forEach((range) => inputRange(ws, range));
  ['F10:G10', 'F11:G11', 'F12:G12', 'F13:G13'].forEach((range) => ws.mergeCells(range));

  for (let row = 10; row <= 13; row += 1) ws.getRow(row).height = 25;
}

function addSummary(ws) {
  sectionTitle(ws, 15, 'FİYAT ÖZETİ');

  const summary = [
    ['A16:B16', 'm² Maliyeti', 'B17', { formula: 'IF(B13>0,G40/B13,"")' }],
    ['C16:D16', 'Toplam Metraj', 'D17', { formula: 'B13' }],
    ['E16:G16', 'Ödenecek Genel Toplam', 'G17', { formula: 'G40' }],
  ];

  for (const [titleRange, title, valueAddr, formula] of summary) {
    mergeValue(ws, titleRange, title, {
      fill: fill(COLORS.goldSoft),
      font: font({ bold: true, color: COLORS.gold }),
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: border(),
    });
    const value = ws.getCell(valueAddr);
    value.value = formula;
    value.numFmt = valueAddr === 'D17' ? '#,##0.00 "m²"' : '#,##0.00 ₺';
    value.fill = fill(COLORS.white);
    value.font = { name: 'Aptos Display', size: valueAddr === 'G17' ? 18 : 14, bold: true, color: { argb: COLORS.navy } };
    value.alignment = { vertical: 'middle', horizontal: 'center' };
    value.border = border();
  }
  ws.mergeCells('A17:B17');
  ws.mergeCells('C17:D17');
  ws.mergeCells('E17:G17');
  ws.getRow(16).height = 22;
  ws.getRow(17).height = 32;
}

function addItemsTable(ws) {
  sectionTitle(ws, 19, 'ÜRÜN / HİZMET KALEMLERİ');

  const headers = ['NO', 'ÜRÜN / HİZMET DETAYI', 'MİKTAR', 'BİRİM', 'SARF', 'BİRİM FİYAT', 'TUTAR'];
  ws.getRow(20).values = headers;
  ws.getRow(20).height = 26;

  for (let col = 1; col <= 7; col += 1) {
    const cell = ws.getCell(20, col);
    cell.fill = fill(COLORS.navy);
    cell.font = font({ bold: true, color: COLORS.white });
    cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
    cell.border = border(mediumNavy);
  }

  for (let row = 21; row <= 36; row += 1) {
    ws.getCell(row, 1).value = row - 20;
    ws.getCell(row, 7).value = { formula: `IF(OR(C${row}="",F${row}=""),"",C${row}*F${row})` };
    ws.getCell(row, 7).numFmt = '#,##0.00 ₺';
    ws.getRow(row).height = 23;

    for (let col = 1; col <= 7; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = fill(row % 2 === 0 ? COLORS.soft : COLORS.white);
      cell.font = font();
      cell.border = border();
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 2 ? 'left' : col >= 6 ? 'right' : 'center',
        wrapText: true,
      };
    }
  }

  ws.autoFilter = 'A20:G36';
}

function addTotalsAndNotes(ws) {
  sectionTitle(ws, 38, 'TOPLAMLAR, BANKA VE ONAY');

  mergeValue(ws, 'A39:C39', 'BANKA HESAP BİLGİLERİ', {
    fill: fill(COLORS.section),
    font: font({ bold: true }),
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: border(),
  });

  ws.getRow(40).values = ['Banka', 'IBAN', 'Para Birimi', '', 'Ara Toplam', '', { formula: 'SUM(G21:G36)' }];
  ws.getRow(41).values = [BANKS[0][0], BANKS[0][1], BANKS[0][2], '', 'KDV (%)', 0.2, { formula: 'G40*F41' }];
  ws.getRow(42).values = [BANKS[1][0], BANKS[1][1], BANKS[1][2], '', 'Nakliye', '', ''];
  ws.getRow(43).values = ['', '', '', '', 'Genel Toplam', '', { formula: 'G40+G41+IF(ISNUMBER(G42),G42,0)' }];

  for (let row = 40; row <= 43; row += 1) {
    for (let col = 1; col <= 3; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = fill(row === 40 ? COLORS.navy : COLORS.white);
      cell.font = font({ bold: row === 40, color: row === 40 ? COLORS.white : COLORS.navy });
      cell.border = border();
      cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center', wrapText: true };
    }

    for (let col = 5; col <= 7; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = fill(row === 43 ? COLORS.navy : COLORS.white);
      cell.font = font({ bold: true, color: row === 43 ? COLORS.white : COLORS.navy });
      cell.border = border();
      cell.alignment = { vertical: 'middle', horizontal: col === 5 ? 'left' : 'right' };
    }
    ws.getRow(row).height = row === 43 ? 28 : 23;
  }

  ['G40', 'G41', 'G42', 'G43'].forEach((addr) => moneyCell(ws.getCell(addr)));
  ws.getCell('F41').numFmt = '0%';
  ws.getCell('G43').fill = fill(COLORS.navy);
  ws.getCell('G43').font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: COLORS.white } };

  mergeValue(ws, 'A45:G45', 'ÖNEMLİ NOTLAR', {
    fill: fill(COLORS.goldSoft),
    font: font({ bold: true, color: COLORS.gold }),
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: border(),
  });
  mergeValue(ws, 'A46:G47', 'Fiyat geçerlilik tarihi teklif üst alanına yazılır. Ürünler şantiyeye teslimdir; indirme alıcıya aittir. KDV ve nakliye durumunu teklif şartına göre netleştirin.', {
    fill: fill(COLORS.soft),
    font: font({ color: COLORS.slate }),
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    border: border(),
  });
  ws.getRow(46).height = 24;
  ws.getRow(47).height = 24;

  mergeValue(ws, 'A49:G49', 'MÜŞTERİ ONAYI', {
    fill: fill(COLORS.section),
    font: font({ bold: true }),
    alignment: { vertical: 'middle', horizontal: 'left' },
    border: border(),
  });

  [['A50:B50', 'İsim - Soyisim'], ['C50:D50', 'Tarih'], ['E50:G50', 'İmza / Kaşe']]
    .forEach(([range, text]) => mergeValue(ws, range, text, {
      fill: fill(COLORS.soft),
      font: font({ bold: true, color: COLORS.muted }),
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: border(),
    }));

  ['A51:B52', 'C51:D52', 'E51:G52'].forEach((range) => {
    mergeValue(ws, range, '', {
      fill: fill(COLORS.white),
      border: border(),
    });
  });

  if (fs.existsSync(BANNER_FILE)) {
    const bannerId = ws.workbook.addImage({ filename: BANNER_FILE, extension: 'png' });
    ws.addImage(bannerId, {
      tl: { col: 0, row: 53.2 },
      ext: { width: 720, height: 40 },
      editAs: 'oneCell',
    });
    ws.getRow(54).height = 24;
    ws.getRow(55).height = 24;
  }
}

function addUsageSheet(workbook) {
  const ws = workbook.addWorksheet('Kullanım', {
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 115 }];

  const rows = [
    'KULLANIM',
    'Bu dosya, sitedeki PDF teklif düzeninin boş Excel uyarlamasıdır.',
    'Müşteri ve proje bilgilerini üst alana girin.',
    'Ürün / hizmet kalemlerinde miktar ve birim fiyat doldurulduğunda tutar otomatik hesaplanır.',
    'KDV oranı varsayılan %20 gelir; gerekiyorsa F41 hücresinden değiştirilebilir.',
    'Nakliye ayrı yazılacaksa G42 hücresine tutar girin. Nakliye dahil fiyat çalışılacaksa boş bırakabilirsiniz.',
    'Dosyada örnek müşteri veya örnek fiyat kullanılmamıştır.',
  ];

  rows.forEach((text, index) => {
    const row = ws.getRow(index + 1);
    row.getCell(1).value = text;
    row.getCell(1).font = index === 0
      ? { name: 'Aptos Display', size: 16, bold: true, color: { argb: COLORS.white } }
      : font({ color: COLORS.slate });
    row.getCell(1).fill = fill(index === 0 ? COLORS.navy : COLORS.white);
    row.getCell(1).border = border();
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    row.height = index === 0 ? 30 : 24;
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = BUSINESS.legalName;
  workbook.company = BUSINESS.legalName;
  workbook.subject = 'Boş Excel teklif şablonu';
  workbook.title = 'Mantolama Teklif Şablonu';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const ws = workbook.addWorksheet('Boş Teklif', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
    },
    views: [{ showGridLines: false, state: 'frozen', ySplit: 20 }],
  });

  ws.columns = [
    { key: 'no', width: 9 },
    { key: 'detail', width: 38 },
    { key: 'qty', width: 13 },
    { key: 'unit', width: 13 },
    { key: 'rate', width: 16 },
    { key: 'unitPrice', width: 15 },
    { key: 'total', width: 17 },
  ];

  addHeader(ws, workbook);
  addMeta(ws);
  addCustomerProject(ws);
  addSummary(ws);
  addItemsTable(ws);
  addTotalsAndNotes(ws);
  addUsageSheet(workbook);

  await workbook.xlsx.writeFile(OUT_FILE);
  console.log(`Excel şablonu oluşturuldu: ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
