# Handoff untuk Tim Machine Learning — AquaFlow

## Penyelarasan topik dan label (wajib)

Proposal utama **deteksi sumbatan**, bukan prediksi kebocoran. Hasil model target:

| Label model persis | Makna | Contoh ground truth |
|---|---|---|
| `NORMAL` | Debit dan permukaan air dalam kondisi aliran standar | Pompa standar dan sekat terbuka |
| `ALIRAN_MASUK_TINGGI` | Air naik karena debit masuk besar, **tanpa** sekat tersumbat | Pompa debit tinggi dan sekat terbuka |
| `TERSUMBAT` | Hambatan nyata pada saluran (sumbatan sebagian/total digabung) | Sekat disetel menyumbat |

Status `AIR_RENDAH`, `POMPA_MATI`, `INVALID`, `STALE` adalah kondisi keselamatan/kualitas data. Jangan dilatih sebagai kelas apabila target resmi tetap tiga kelas di atas.

## Perbaikan terhadap draf ML yang diunggah

Draf ML `Proposal_ML_Poin_5-8.docx` membahas bocor kecil/besar, tegangan pompa, neraca massa dua tangki, dan pemutusan pompa otomatis saat **bocor**. Itu merupakan rancangan berbeda, sehingga jangan langsung menggunakan kelas maupun variabelnya untuk dashboard sumbatan tanpa revisi tim.

Draf tersebut memberi metode yang masih berguna untuk diskusi, **bukan keputusan final**: ground truth dari skenario sebelum eksperimen, split data per sesi/run untuk menghindari leakage, baseline aturan vs model klasik, kalibrasi, dan evaluasi data primer baru. Parameter 1 Hz, jendela 10s, hop 5s di backend saat ini adalah **contoh awal**.

## Data primer wajib

Panduan UAS mengharuskan data dari prototipe fisik sendiri. Usulan struktur raw CSV:

```text
timestamp,sessionId,conditionId,inletLpm,outletLpm,upstreamCm,downstreamCm,pumpOn,floatSafe,label,notes
```

Label ground truth diperoleh dari **skenario sekat/pompa yang ditetapkan operator**, bukan dari `threshold` demo atau hasil inferensi. Simpan sesi/run dan tanggal untuk `GroupKFold` / pemisahan data berdasarkan sesi, bukan pemisahan acak jendela yang overlap. Panduan UAS: target awal minimal 5 sesi pada sedikitnya 3 hari berbeda (bila dapat diulang).

## Yang harus diserahkan tim ML kepada Naail

1. `model_final.joblib`: sklearn model atau pipeline utuh dari data primer, hanya dari lingkungan/training tepercaya.
2. `model_contract.json`: penamaan kelas **persis**, feature_names berurutan, window_samples, sampling_hz, hop_seconds, model_version.
3. Fungsi preprocessing/ekstraksi fitur **yang identik** dengan training (jangan melatih fitur berbeda lalu mengandalkan `feature_builder.py` bawaan paket).
4. Ringkasan eksperimen: baseline, matriks konfusi, precision/recall/F1 per kelas, split train/validation/test per sesi, parameter model.
5. Pencatatan timestamp label eksperimen dan data uji baru yang belum pernah dipakai saat training.

`inference/model_contract.example.json` dan `inference/feature_builder.py` adalah **contoh kontrak**. Bila tim ML memakai fitur lain, harus disepakati dan implementasi Python bridge diubah. Jangan menjalankan model dengan fitur placeholder yang berbeda.

## Alur runtime yang akan dipegang Software

- Python membaca `devices/saluran-01/history` (menggunakan waktu dan sessionId).
- Validasi NaN/tidak valid, timestamp ganda, gap antar-sampel, interlock.
- Tunggu `window_samples` valid dalam satu sesi lalu ekstrak fitur.
- Jalankan `model.predict()` serta `predict_proba()` bila tersedia.
- Tulis `devices/saluran-01/predictions/latest` dan `/history/{push-id}`.
- `source` harus `model` untuk ML asli, bukan `demo`; dashboard menolak pembauran keduanya.
- Ketika model atau jaringan gagal, **jangan buat prediksi palsu**. Dashboard memakai status menunggu/expired ketika prediksi lama.

## Menjalankan preview software ML (tanpa data primer)

```bash
python -m inference.bridge --check-example
python -m unittest discover -s tests -p 'test_*.py'
```

Untuk menjalankan mode benar-benar live, gunakan akun Admin SDK lokal (bukan di frontend/ESP32):

```bash
python -m pip install -r inference/requirements.txt
# set environment variables in inference/ENV-CONTOH.txt, gunakan lokasi lokal kredensial asli
python -m inference.bridge
```

**Tidak disertakan model terlatih, dataset nyata, atau hasil evaluasi; itu harus berasal dari eksperimen tim ML.**
