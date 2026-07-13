"use client";

// Eski "Kar Marjı" ve "KDV" alanları kaldırıldı (karar günlüğü Tur 4):
// yalnız localStorage'a yazıyorlardı ve hiçbir fiyat hesabı okumuyordu.
// Gerçek kurallar aşağıdaki karta bağlanmıştır.

export function SettingsTab() {
    return (
        <div className="admin-nexus-panel p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Sistem Ayarları</h2>
            <div className="space-y-6">
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                    <h3 className="font-semibold text-white mb-2">Fiyat kuralları nerede yönetilir?</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                        <li>
                            <span className="font-medium text-white">Kâr marjı:</span>{" "}
                            malzeme-tipi kademeleri <span className="text-amber-300">Marj Kuralları</span>{" "}
                            sekmesinde, marka bazlı marj (ör. Bonus){" "}
                            <span className="text-amber-300">Markalar</span> sekmesinde yönetilir.
                            Marka marjı doluysa malzeme kuralını ezer.
                        </li>
                        <li>
                            <span className="font-medium text-white">KDV oranı:</span>{" "}
                            %20 — kilitli ticari karardır (kanonik konsensus, karar 2); panelden
                            değiştirilemez, kod içindeki tek kaynaktan uygulanır.
                        </li>
                        <li>
                            <span className="font-medium text-white">Şehir iskontoları:</span>{" "}
                            <span className="text-amber-300">İskontolar</span> sekmesinde,
                            bölge/şehir bazlı yönetilir.
                        </li>
                    </ul>
                </div>

                <div className="pt-4 border-t border-slate-800/50">
                    <h3 className="font-semibold text-white mb-3">Sistem Bilgileri</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-400">Next.js Versiyonu:</span><span className="font-medium text-white">16.2.9</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">React Versiyonu:</span><span className="font-medium text-white">19.2.1</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Supabase:</span><span className="font-medium text-green-400">Bağlı</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
