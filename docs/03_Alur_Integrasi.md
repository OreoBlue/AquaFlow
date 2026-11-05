# Alur integrasi AquaFlow — Konsep untuk ketiga tim

## Diagram A — Tampilan dashboard

```mermaid
flowchart TD
    A([Buka AquaFlow]) --> B{Mode sumber?}
    B -->|Simulasi| C[Generate telemetry + label contoh]
    B -->|Live| D[Login Firebase Auth dan subscribe RTDB]
    C --> E[Validasi pembacaan]
    D --> E
    E --> F{Sensor valid dan data terbaru?}
    F -->|Tidak| G[Tampilkan INVALID / STALE / DISCONNECTED]
    F -->|Ya| H{Interlock atau pompa mati?}
    H -->|Ya| I[Tampilkan pengaman aktif / siaga]
    H -->|Tidak| J{Prediksi sesuai timestamp dan sumber?}
    J -->|Ya| K[Tampilkan 3 kelas dari ML]
    J -->|Tidak| L[Tampilkan ML menunggu]
    I --> M[Ringkasan + grafik + riwayat + ekspor CSV]
    K --> M
    L --> M
    G --> M
```

## Diagram B — Antarplatform

```mermaid
flowchart LR
    HW[4 sensor dan float switch] --> ESP[ESP32]
    ESP -->|Pengaman OFFLINE| ACT[Pompa dan servo]
    ESP -->|HTTPS terautentikasi| TEL[(Firebase / latest + history)]
    TEL -->|History| ML[Python bridge + model final]
    ML -->|Prediksi terverifikasi| PRE[(Firebase / predictions)]
    TEL --> WEB[AquaFlow JS]
    PRE --> WEB
    WEB --> USER[Operator]
```

## Diagram C — Inferensi model

```mermaid
flowchart TD
    A[Data primer training sesuai ground truth] --> B[Pipeline training tim ML]
    B --> C[Artefak joblib + model_contract.json]
    D[Telemetry ESP32 di RTDB] --> E[Python baca jendela valid]
    E --> F{Cukup sampel, 1 sesi, pengaman OK?}
    F -->|Tidak| G[Tahan inferensi; jangan karang hasil]
    F -->|Ya| H[Feature extraction IDENTIK training]
    C --> I[model.predict + proba opsional]
    H --> I
    I --> J{Tiga kelas resmi?}
    J -->|Tidak| G
    J -->|Ya| K[Catat label + waktu sumber + versi model]
    K --> L[Predictions di RTDB]
    L --> M[UI verifikasi timestamp dan provenance]
```

## Paths Firebase target (usulan, tidak tersedia di proyek Firebase nyata)

| Path | Penulis | Pembaca | Fungsi |
|---|---|---|---|
| `devices/saluran-01/latest` | ESP32/gateway tepercaya | Dashboard, Python | Pembacaan terbaru |
| `devices/saluran-01/history/{push-id}` | ESP32/gateway | Dashboard, Python | Raw telemetry tersimpan |
| `devices/saluran-01/predictions/latest` | Python Admin SDK | Dashboard | Prediksi terbaru ML |
| `devices/saluran-01/predictions/history/{push-id}` | Python Admin SDK | Dashboard | Log inferensi model |

Tidak ada remote control pompa/servo dari browser pada konsep ini. Keputusan fitur kontrol baru dapat dilakukan setelah tim Hardware menyetujui kendali lokal, autentikasi, logging, dan interlock keselamatan.
