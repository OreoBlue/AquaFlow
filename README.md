# AquaFlow — Konsep Dashboard & Integrasi IoT × ML (v2)

**Proyek:** Rancang Bangun Sistem Deteksi Sumbatan pada Miniatur Saluran Air.  
**Status:** **KONSEP SIAP DEMO LOKAL**, **belum** merupakan sistem IoT atau ML yang telah diuji dengan hardware/data primer.  
**Asal UI:** Pengembangan dari `aquaflow-dashboard.zip` buatan tim Software (Aan); desain utama, grid dan identitas visual dipertahankan.

## Cara melihat konsep (langsung)

1. Ekstrak ZIP; buka terminal pada folder ini.
2. Ketik `npm start` (memerlukan Node.js 18+; tidak perlu `npm install`).
3. Buka **http://127.0.0.1:4173** pada browser.
4. Coba skenario **Normal**, **Aliran masuk tinggi**, **Saluran tersumbat**, **Air bak rendah**, dan **Sensor tidak valid**.
5. Periksa tab **Ringkasan**, **Riwayat data**, **Sistem alat**; ubah filter waktu, lihat label contoh ML dan ekspor CSV.

> Pada mode `demo`, seluruh nilai dan label merupakan contoh simulasi untuk menjelaskan desain integrasi. **Belum ada model ML terlatih, data sensor aktual, Firebase aktif, atau kendali alat fisik.** Jangan memakai angka demo sebagai data eksperimen UAS.

## Pembagian fitur: nyata vs target

| Komponen | Ada sekarang | Belum diselesaikan |
|---|---|---|
| Frontend JS/CSS | Dashboard responsif, dark/light, grafik, kartu, riwayat, ekspor CSV, dialog skema | Uji perangkat nyata dan UX final |
| Simulasi skenario | 5 skenario termasuk gagal sensor; 3 label **contoh saja** | Pengujian dengan data primer |
| Prediksi | Kontrak tiga kelas dan tampilan hasil; validasi kelas/timestamp | Model final dari tim ML dan skor evaluasi |
| Firebase adapter | Kode subscribe baca RTDB dengan Firebase Auth Email/Password; dinonaktifkan dalam demo | Konfigurasi proyek, identitas operator, rules final, uji live |
| Python bridge | Kerangka inferensi membaca telemetry RTDB, ekstraksi fitur, load joblib, tulis prediksi | Artefak model final, sinkronisasi fitur training, uji end-to-end |
| ESP32 | Skema payload dan panduan Hardware | Firmware, mekanik, kalibrasi, unggah data HTTPS yang aman, interlock lokal |
| Kontrol pompa/servo dari web | **Tidak diaktifkan** (monitoring saja untuk menjaga keamanan konsep) | Sepakati kebutuhan dan desain kontrol terautentikasi + pengaman lokal |

## Diagram ringkas

```text
   ULTRASONIK HULU/HILIR + FLOW INLET/OUTLET + FLOAT SWITCH
                           |
                         ESP32 ----> [INTERLOCK LOKAL] ----> POMPA / SERVO
                           |
                     Wi-Fi / HTTPS
                           |
                Firebase Realtime Database
                 / telemetry   \ predictions
                /               ^
               v                |
             Python -- validasi + fitur --> joblib MODEL ML
               |                  [3 kelas resmi]
               +------> prediksi + timestamp + versi
                           |
                      DASHBOARD AQUAFLOW
              ringkasan · grafik · riwayat · status
```

Tiga kelas utama: `NORMAL`, `ALIRAN_MASUK_TINGGI`, `TERSUMBAT`. Status `Air bak rendah`, `Pompa berhenti`, `Data invalid`, `Data kedaluwarsa` **bukan** keluaran kelas model. Baseline ambang adalah pembanding terpisah.

## Struktur berkas

```text
AquaFlow-Konsep-Integrasi/
├── dist/                       # Website JS/CSS siap dijalankan di mode demo
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── data-model.js
│   ├── demo-source.js
│   ├── firebase-adapter.js
│   ├── firebase-config.js       # kosong; bukan kredensial rahasia
│   ├── config.js
│   └── sample-reading.json
├── inference/                  # Kerangka bridge Python untuk joblib model dari tim ML
│   ├── bridge.py
│   ├── feature_builder.py
│   ├── model_contract.example.json
│   ├── examples/telemetry-window.json  # contoh sintetis, bukan dataset riset
│   └── requirements.txt
├── docs/                       # Materi handoff tim Hardware & ML, diagram, gap, tes
├── preview/                    # Diagram arsitektur dalam PNG dan SVG
├── referensi/                  # Arsip sumber milik kelompok (tidak diedit)
├── tests/                      # Uji logika JS & Python
├── database.example.json      # Struktur schema rencana
├── database.rules.locked.json # DENY ALL sampai kebijakan otorisasi disahkan
├── firebase.json
├── serve.mjs
├── package.json
└── README.md
```

## Uji integrasi dalam paket

- `npm run check` memeriksa sintaks JS dan beberapa perilaku kritis (fail-safe, label terpisah dari ambang, provenance demo vs model).
- `python -m unittest discover -s tests -p 'test_*.py'` memeriksa validasi fitur Python.
- `python -m inference.bridge --check-example` memeriksa struktur data dan ekstraksi fitur **tanpa** koneksi Firebase atau model final.
- Diagram arsitektur, alur dashboard, dan inferensi disediakan sebagai PNG/SVG di `preview/`.

## Aktivasi Firebase nanti

1. Siapkan Firebase RTDB + Authentication (Email/Password untuk operator). Tetapkan akses operator per `deviceId` serta mekanisme autentikasi penulis data perangkat.
2. Isi **hanya** nilai konfigurasi Web Firebase publik di `dist/firebase-config.js`; **jangan pernah** simpan service account pada folder web.
3. Ubah `dist/config.js` dari `source:'demo'` menjadi `source:'firebase'`.
4. **Jangan** deploy aturan `database.rules.locked.json` jika ingin membaca/menulis data: isinya sengaja menolak semuanya sampai rules autentikasi aman disusun. ESP32 juga tidak boleh memakai akses anonymous write untuk produksi.
5. Selesaikan firmware ESP32 untuk menulis `devices/saluran-01/latest` dan `history/{push-id}` via autentikasi HTTPS yang disetujui tim.
6. Tim ML menyerahkan `model_final.joblib` **tepercaya** + `model_contract.json` (urutan fitur/kelas/window) hasil pelatihan dataset primer.
7. Jalankan bridge Python (lihat `docs/02_Tim_ML.md`) dengan service-account **hanya di komputer/server Python**. Hasil masuk ke `predictions/latest` dan `predictions/history/{push-id}`.
8. Uji koneksi terputus, invalid, stale, float switch, serta kegagalan Python tanpa merusak interlock ESP32.

**Perhatian:** Mengaktifkan mode Firebase bukan berarti sistem live otomatis bekerja. Konfigurasi akun, database, izin, program ESP32, dataset primer, model ML, dan pengujian tetap diperlukan.

## Bahan rapat kelompok

- `docs/01_Tim_Hardware.md` — wiring konseptual & payload ESP32.
- `docs/02_Tim_ML.md` — target, jendela data, artefak model dan kontrak features.
- `docs/03_Alur_Integrasi.md` — flowchart tiga proses (Mermaid) dan rute RTDB.
- `docs/04_Rencana_Uji.md` — kriteria pengujian & demo UAS.
- `docs/05_Audit_Perubahan.md` — apa saja yang berubah dari ZIP pertama.
- `docs/06_Keputusan_Terbuka.md` — isu yang wajib disepakati sebelum implementasi.

**Sumber utama**: Panduan Teknis UAS IoT × ML (hal. 2, 5–8), proposal IoT (hal. 2–3), simulasi 3D HTML, kode AquaFlow ZIP awal. `Proposal_ML_Poin_5-8.docx` mengusulkan *kebocoran* sehingga belum boleh dipakai sebagai skema label final sistem sumbatan.
