# Ofis uygulama planı — tamamlanan yerel kapsam

Kaynak: kullanıcının `ofis-uygulama-talimati (1).md` talimatı ve açık A/B onayı. Dal: `codex/ofis-redesign-20261008`. Ana checkout ve 3111 sunucusu değiştirilmedi; üretim migration/yazma/push/merge/deploy yok.

1. **Keşif ve Faz 0:** mevcut hedefler, font/kontrast/boyut, mobil geometri ve Sevk Masası paleti doğrulandı. `PHASE-1-RESULT.md` önceki salt okunur aşamayı tarihsel olarak saklar.
2. **Faz 1:** A/B onayıyla üç tablo ve nullable bağlar yalnız sıfırdan oluşturulan test cluster’ına uygulandı. Etkin izinler, atomiklik, idempotency, geçmiş başarı, alternatifler ve rollback kabulü geçti. `PHASE-1-ACCEPTANCE.md`.
3. **Faz 2:** Bugün görev kümesi, ilk temas/geciken/bugünkü takip, ayrı eski kayıt kuyruğu ve proje dosyası. `PHASE-2-RESULT.md`.
4. **Faz 3:** liste/teknik föy, mobil tam ekran, filtre/kaydırma koruma, kayıtlı görünümler, revizyon farkları. `PHASE-3-RESULT.md`.
5. **Faz 4:** mevcut motorla teklif/PDF/revizyon, eşzamanlılık kontrolü ve uzun Excel teklifi. `PHASE-4-RESULT.md`.

Her faz kontrol edilerek sonraki faza geçildi. A/B için bekleyen onay yok. Üretime geçiş bu çalışma kapsamına dahil değil. Ortam sınırları ve son doğrulama durumu `TESLIM.md`, kullanım `scripts/ofis-test/README.md`, görev ölçümü `TASK-COMPARISON.md` içinde.
