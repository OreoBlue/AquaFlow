# AquaFlow — Flowchart Software dan Integrasi ML

**Proyek:** Rancang Bangun Sistem Deteksi Sumbatan pada Miniatur Saluran Air  
**Basis:** Panduan UAS IoT × ML; proposal IoT; simulasi 3D HTML; AquaFlow dashboard dari Aan; proposal ML poin 5–8.  
**Konvensi:** *Saat ini* = sudah ada dalam source dashboard; *target integrasi* = alur yang akan dibangun. Fokus utama 3 kelas sumbatan, bukan kelas kebocoran pada draf ML berbeda.

## A. Flowchart alur dashboard AquaFlow

```mermaid
flowchart TD
    A([Pengguna membuka AquaFlow]) --> B[Inisialisasi UI dan sumber data]
    B --> C{Sumber data?}
    C -->|Demo saat ini| D[Demo Source: data simulasi]
    C -->|Live target| E[Firebase Adapter: telemetry dan prediksi]
    D --> F[Normalisasi data dan cek timestamp]
    E --> F
    F --> G{Valid dan tidak kedaluwarsa?}
    G -->|Tidak| H[Status data tidak valid atau koneksi terganggu]
    H --> I[Hentikan tampilan prediksi sebagai data baru]
    I --> B
    G -->|Ya| J[Tampilkan debit, level, pompa, float switch]
    J --> K{Hasil ML tersedia dan baru?}
    K -->|Ya| L[Tampilkan prediksi ML tiga kelas]
    K -->|Tidak, mode demo| M[Tampilkan indikasi ambang: DEMO]
    K -->|Tidak, mode live| N[Tampilkan prediksi belum tersedia]
    L --> O[Ringkasan, grafik, riwayat, aktivitas]
    M --> O
    N --> O
    O --> P{Aksi pengguna?}
    P -->|Tab, filter, ekspor CSV| Q[Perbarui tampilan atau ekspor data]
    P -->|Tidak ada| R[Pantau pembacaan berikutnya]
    Q --> R
    R --> B
```

## B. Flowchart integrasi antarplatform

```mermaid
flowchart TB
    subgraph PH[PROTOTIPE FISIK]
        S[Ultrasonik hulu dan hilir; flow inlet dan outlet; float switch] --> ESP[ESP32: baca dan validasi sensor]
        SAFE[Float switch dan aturan pengaman lokal] --> ACT[Pompa DC dan servo]
        ESP --> SAFE
    end
    subgraph CLOUD[FIREBASE REALTIME DATABASE]
        TEL[devices/saluran-01/latest dan history]
        PRED[devices/saluran-01/predictions/latest dan history]
        CMD[Perintah kendali terautentikasi - rencana]
    end
    subgraph ML[LAYANAN PYTHON TERPISAH]
        PRE[Validasi, windowing, ekstraksi fitur] --> MODEL[Inferensi model ML terlatih]
    end
    subgraph WEB[DASHBOARD AQUAFLOW]
        ADAPT[Firebase Adapter] --> UI[Ringkasan, grafik, hasil prediksi, riwayat]
    end
    ESP -->|Wi-Fi dan HTTPS| TEL
    TEL -->|Baca data baru| PRE
    MODEL -->|Tulis hasil dan timestamp| PRED
    TEL -->|Subscription| ADAPT
    PRED -->|Subscription| ADAPT
    UI -.->|Fitur kontrol yang belum ada| CMD
    CMD -.->|Validasi identitas dan keselamatan| ESP
```

## C. Flowchart integrasi ML: training ke inferensi real-time

```mermaid
flowchart TD
    subgraph TRAIN[TRAINING - TIM ML]
        T1[Data primer berlabel tiga kondisi] --> T2[Cleaning dan ekstraksi fitur]
        T2 --> T3[Split per sesi dan bandingkan baseline]
        T3 --> T4[Latih dan evaluasi model ML klasik]
        T4 --> T5[Model final dan kontrak fitur disimpan]
    end
    subgraph RUNTIME[INFERENSI - SOFTWARE]
        R1[Data sensor baru dari Firebase] --> R2{Format, sensor dan timestamp valid?}
        R2 -->|Tidak| RX[Publikasikan status invalid atau stale]
        R2 -->|Ya| R3{Data cukup untuk jendela fitur?}
        R3 -->|Belum| R4[Tunggu sampel baru]
        R4 --> R1
        R3 -->|Ya| R5[Ekstraksi fitur persis seperti training]
        R5 --> R6[Load model final dan lakukan predict]
        R6 --> R7[Hasil: NORMAL, ALIRAN TINGGI, atau TERSUMBAT]
        R7 --> R8[Simpan kelas, waktu prediksi dan versi model]
        R8 --> R9[Firebase predictions dan dashboard]
    end
    T5 -.->|Artefak model dan skema fitur| R6
    RX --> R9
    R9 --> R10{Status hasil?}
    R10 -->|Normal| R11[Lanjut pemantauan]
    R10 -->|Aliran masuk tinggi| R12[Informasi peningkatan debit]
    R10 -->|Tersumbat| R13[Peringatan sumbatan dan rekomendasi pemeriksaan]
    R10 -->|Data invalid| R14[Status gagal, jangan pakai prediksi lama]
    R13 --> R15[Setiap kendali aktuator harus melewati pengaman lokal ESP32]
```

## Penyesuaian implementasi yang perlu disepakati

1. **Kelas ML resmi:** NORMAL, ALIRAN_MASUK_TINGGI, TERSUMBAT. Draf ML kebocoran tidak cocok dengan proposal deteksi sumbatan; selaraskan bersama tim ML sebelum training.
2. **Fitur saat ini:** `config.source = 'demo'`, Firebase adapter masih placeholder. Dashboard memakai peraturan ambang (`flowLossPercent: 20`, `heightGapCm: 1.5`) dan **belum** menampilkan inferensi ML.
3. **Kontrak data sekarang:** `timestamp` (Unix ms), `inletLpm`, `outletLpm`, `upstreamCm`, `downstreamCm`, `pumpOn`, `floatSafe`. Pertahankan format data tersebut dan tambahkan jalur *predictions* terpisah (usulan) agar data sensor dan hasil Python tidak saling menimpa.
4. **Interaktivitas:** tab Ringkasan/Riwayat Data/Sistem Alat, grafik, ekspor CSV sudah ada di mode demo. Fitur kontrol fisik pompa/servo belum ada dalam source AquaFlow dan sebaiknya dianggap rencana.
5. **Ketahanan:** saat koneksi putus, sensor gagal, atau data kedaluwarsa, tampilkan status jelas dan jangan menampilkan prediksi lama seolah baru. Interlock pompa wajib dijalankan lokal pada ESP32, tidak menunggu Firebase/Python.
6. **Model final:** proposal IoT menyebut Random Forest; model final harus mengikuti hasil evaluasi tim ML. Desain windowing (10 detik dan hop 5 detik) dalam draf ML yang membahas kebocoran **belum otomatis berlaku** untuk proyek sumbatan.
7. **Komponen:** proposal IoT menggunakan servo pengatur pintu sumbatan, sedangkan demo HTML/dashboard menggambarkan sekat/soket yang diubah manual. Samakan dengan keputusan tim hardware agar dokumentasi tidak berbeda.
