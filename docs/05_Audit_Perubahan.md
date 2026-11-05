# Audit source awal dibanding versi konsep AquaFlow v2

Dasar pemeriksaan: 15 berkas ZIP awal, panduan UAS, proposal IoT, simulasi 3D, serta draf proposal ML yang berbeda fokus.

| Area | ZIP buatan Aan semula | Versi v2 (paket ini) |
|---|---|---|
| Visual dashboard | Layout modern, responsif, dark/light, kartu flow/level/pompa | **Dipertahankan** dengan penanda asal prediksi |
| Skenario demo | Normal, indikasi sumbatan, air rendah | Normal, aliran masuk tinggi, tersumbat, air bak rendah, sensor invalid |
| Kondisi saluran | Aturan `flowLossPercent`+`heightGapCm` digunakan sebagai diagnosis utama | Hasil prediksi 3 kelas dari `predictions` (demo label contoh); aturan ditandai baseline terpisah |
| Perbedaan demo vs ML | Hasil ambang dapat terlihat seperti deteksi | Teks **CONTOH LABEL · BUKAN MODEL ML** dan provenance `demo` vs `model` |
| Firebase | `firebase-adapter.js` placeholder error | Adapter baca RTDB dengan Firebase Auth Email/Password, hanya aktif setelah konfigurasi; **belum diuji melawan Firebase nyata** |
| Model Python | Tidak ada | Kerangka Python joblib RTDB, jendela fitur contoh + check offline (tanpa model final) |
| Sensor dan data stale | Normalisasi dasar; timestamp ditandai stale tetapi kondisi lama tetap terlihat | Validasi batas, status invalid/stale/menunggu serta pemisahan hasil terbaru |
| Event & CSV | Event sesi lokal, ekspor telemetry | Telemetry + label & provenance prediksi, disclaimer eksplisit |
| Komponen hardware | Sekat manual | Servo sebagai keputusan terbuka; interlock float ditegaskan |
| Dokumentasi | Panduan integrasi ringkas | Docs khusus Hardware, ML, Software, schema, uji dan isu terbuka |

## Temuan sumber yang belum dapat disamakan otomatis

1. Panduan UAS (halaman 2) menyebut tegangan **<12 V**; proposal/peraga menyebut **pompa DC 12 V**. Harus ditanyakan ke dosen/Hardware sebelum memilih catu final.
2. Proposal IoT menegaskan tiga kelas sumbatan; `Proposal_ML_Poin_5-8.docx` justru menguraikan kelas kebocoran. Label final ML harus dibahas, bukan digabung diam-diam.
3. Proposal menyebut servo; simulasi 3D menggunakan soket virtual, belum konfirmasi servo fisik.
4. Firebase project, rules aman, model joblib, device credentials, hasil kalibrasi, data primer, dan alat fisik **belum disediakan**.

Berkas lama tidak dipalsukan seolah sudah terhubung; setiap fitur target harus dipahami sebagai scaffolding/integrasi yang masih harus diuji.
