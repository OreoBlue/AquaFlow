# Checklist pengujian sistem — untuk demo UAS

| Kasus | Langkah uji | Ekspektasi | Status paket |
|---|---|---|---|
| UI normal | Demo: pilih Aliran normal | Kondisi normal; grafik bertambah | Bisa diuji lokal |
| UI aliran tinggi | Demo: pilih Aliran masuk tinggi | Label contoh ALIRAN MASUK TINGGI | Bisa diuji lokal |
| UI sumbatan | Demo: pilih Saluran tersumbat | Label contoh TERSUMBAT | Bisa diuji lokal |
| Air bak rendah | Demo: pilih Air bak rendah | Pengaman aktif, pompa OFF, bukan kelas ML | Bisa diuji lokal |
| Sensor invalid | Demo: pilih Sensor tidak valid | Status menunggu data valid, prediksi tidak dianggap ML | Bisa diuji lokal |
| Riwayat dan CSV | Pilih filter, buka Riwayat, ekspor | Nilai waktu/label/source di CSV | Bisa diuji lokal |
| Live tanpa konfigurasi | Pilih `firebase` tanpa isi konfigurasi | Error eksplisit, tanpa data demo fallback | Perlu dites di server lokal |
| Data stale | Hentikan kiriman RTDB melebihi staleAfterMs | Tidak klaim prediksi lama sebagai terbaru | Perlu Firebase |
| Disconnect | Matikan Wi-Fi ESP32 | Status gangguan, pompa tetap aman lewat firmware | Perlu hardware |
| ML pipeline | Train dan ekspor model di 3 kelas | Backend inferensi membaca fitur sama, mengirim label + waktu + versi | Perlu tim ML |
| Pengaman float | Turunkan air di bak | Pompa dimatikan lokal tanpa cloud/ML | Perlu hardware |
| Uji baru | Sesi hari berbeda, jangan bocorkan data dari train | Metrik terhadap baseline dan confusion matrix | Perlu data primer |

**Catatan pengujian internal paket:** Node tests memvalidasi logic JS, Python unittest memvalidasi feature building. Keduanya bukan pengganti pengujian integrasi perangkat nyata.

**Skenario demonstrasi wajib dari Panduan UAS:** masalah dan pengguna; sensor masuk; prediksi ML real; feedback/aktuator; satu kasus gagal; perbandingan baseline vs model. Video demo maksimal 5 menit. Data contoh dashboard **tidak memenuhi sendiri** persyaratan demonstrasi akhir.
