import type { QuoteDocumentParts } from '@/lib/pdf/quoteDocument'

// Teklif bloklarını A4 sayfalarına yerleştirir.
//
// Kural: blok sığmazsa sonraki sayfaya taşınır; yazı küçültülmez.
// Döküm tablosu satır satır bölünür ve sonraki sayfada başlığıyla sürer.
// Toplam bloğu son satırdan kopmaz: sığmazsa son satırı da yanına alıp
// sonraki sayfaya geçer.
//
// Sık düzen (Emrah, 28 Ekim 2026: "boşlukları azalt, tek sayfaya sığdır"):
// normal düzende ikinci sayfaya taşan teklif `tq-dense` sınıfıyla yeniden
// dizilir. Tek sayfaya sığarsa o kullanılır; sığmazsa normal düzen çok
// sayfalı kalır. İçerik çıkarılmaz, yalnız boşluklar ve ölçüler sıkılaşır.
//
// `root` belgede (ekran dışında da olsa) yerleşmiş olmalıdır; ölçüm gerçek
// yerleşimden alınır. Yazı tipleri yüklendikten sonra çağrılır.

export function paginateQuoteDocument(root: HTMLElement, parts: QuoteDocumentParts): HTMLElement[] {
  const normal = layoutQuoteDocument(root, parts)
  if (normal.length === 1) return normal
  root.replaceChildren()
  root.classList.add('tq-dense')
  const dense = layoutQuoteDocument(root, parts)
  if (dense.length === 1) return dense
  root.replaceChildren()
  root.classList.remove('tq-dense')
  return layoutQuoteDocument(root, parts)
}

export function layoutQuoteDocument(root: HTMLElement, parts: QuoteDocumentParts): HTMLElement[] {
  const pages: HTMLElement[] = []
  let current!: HTMLElement

  const node = (html: string): HTMLElement => {
    const template = document.createElement('template')
    template.innerHTML = html
    return template.content.firstElementChild as HTMLElement
  }

  const newPage = () => {
    const page = node(
      `<article class="tq-sheet">${parts.header}${pages.length ? parts.context : ''}<div class="tq-content"></div>${parts.footer}</article>`,
    )
    root.append(page)
    pages.push(page)
    current = page.querySelector('.tq-content') as HTMLElement
  }

  const fits = () => current.scrollHeight <= current.clientHeight + 1

  const add = (element: HTMLElement) => {
    current.append(element)
    if (!fits() && current.children.length > 1) {
      element.remove()
      newPage()
      current.append(element)
    }
    if (!fits()) throw new Error(`Teklif bloğu sayfaya sığmıyor: ${element.dataset.kind ?? element.className}`)
  }

  const addTable = (element: HTMLElement, total: HTMLElement | null) => {
    const rows = Array.from(element.querySelectorAll<HTMLElement>('tbody tr'))
    const open = () => {
      const wrapper = node(`<section class="tq-block tq-table" data-kind="table"><table>${parts.tableHead}<tbody></tbody></table></section>`)
      current.append(wrapper)
      return wrapper
    }
    let wrapper = open()
    let body = wrapper.querySelector('tbody') as HTMLElement
    // Önceki sayfalarda kalan satır sayısı: "devam" başlığı yalnız tablo
    // gerçekten bölündüyse basılır.
    let rowsOnEarlierPages = 0

    const carry = (row: HTMLElement) => {
      row.remove()
      rowsOnEarlierPages += body.children.length
      if (!body.children.length) wrapper.remove()
      newPage()
      if (rowsOnEarlierPages) add(node(parts.continuationTitle))
      wrapper = open()
      body = wrapper.querySelector('tbody') as HTMLElement
      body.append(row)
      if (!fits()) throw new Error('Teklif satırı tek sayfaya sığmıyor')
    }

    for (const row of rows) {
      body.append(row)
      if (!fits()) carry(row)
    }

    if (!total) return
    current.append(total)
    if (fits()) return
    // Standart (B4): tablonun son satırı ile toplam bloğu birlikte yerleşir.
    // Sayfada tek satır kalmış olsa da toplam satırından ayrılmaz.
    total.remove()
    carry(body.lastElementChild as HTMLElement)
    add(total)
  }

  newPage()
  const flow = parts.flow.map(node)
  // Sık düzende eylem ve süreç sol, ödeme ve bayilik sağ sütunda yan yana durur.
  if (root.classList.contains('tq-dense')) {
    const pick = (kind: string) => flow.find((el) => el.dataset.kind === kind)
    const [action, process, payment, trust] = ['action', 'process', 'payment', 'trust'].map(pick)
    if (action && process && payment && trust) {
      const pair = node('<section class="tq-block tq-pair" data-kind="pair"><div class="tq-pair-col"></div><div class="tq-pair-col"></div></section>')
      const [left, right] = Array.from(pair.children) as HTMLElement[]
      left.append(action, process)
      right.append(payment, trust)
      flow.splice(flow.indexOf(action), 1, pair)
      for (const moved of [process, payment, trust]) flow.splice(flow.indexOf(moved), 1)
    }
  }
  for (let i = 0; i < flow.length; i += 1) {
    const element = flow[i]
    if (element.dataset.kind !== 'table') {
      add(element)
      continue
    }
    const next = flow[i + 1]
    const total = next?.dataset.kind === 'total' ? next : null
    if (total) i += 1
    addTable(element, total)
  }

  pages.forEach((page, index) => {
    const number = page.querySelector('.tq-page-number')
    if (number) number.textContent = `${index + 1} / ${pages.length}`
  })

  return pages
}
