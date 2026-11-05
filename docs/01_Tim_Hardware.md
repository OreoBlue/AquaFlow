# Handoff untuk Tim Hardware — AquaFlow

## Acuan alat (proposal IoT dan simulasi 3D)

- 2 × ultrasonik untuk **tinggi air hulu dan hilir**. Kirim **tinggi cm** (hasil kalibrasi `tinggi_pemasangan - jarak_ukur`), bukan nilai jarak mentah tanpa penjelasan.
- 2 × flow sensor untuk **debit inlet dan outlet** dalam liter/menit. Perlu faktor kalibrasi masing-masing sensor, konversi pulsa, dan pembacaan saat debit kecil.
- **ESP32 DevKit V1** membaca sensor dan mengirim data **via Wi-Fi/HTTPS** ke Firebase RTDB menggunakan mekanisme autentikasi perangkat yang aman.
- **Pompa DC 12 V + driver**, **float switch** yang menghentikan pompa secara lokal saat air bak rendah. Pengaman tidak bergantung pada dashboard, Firebase, atau model ML.
- **Servo** muncul dalam proposal IoT untuk pintu sumbatan; simulasi 3D HTML memakai soket/sekat yang digerakkan melalui UI simulasi. Tentukan apakah servo benar-benar digunakan pada prototipe sebelum firmware final.
- Panduan UAS: hanya DC tegangan rendah, **sumber <12 V** menurut dokumen. Proposal simulasi menyebut pompa 12 V: **klarifikasi spesifikasi catu/tegangan kepada dosen agar sesuai batas panduan** sebelum menyalakan alat. Pisahkan cairan dari papan elektronik.

## Payload dari ESP32 — `devices/saluran-01/latest`

```json
{
  "timestamp": 1793249100000,
  "sessionId": "sesi-001",
  "inletLpm": 4.82,
  "outletLpm": 4.61,
  "upstreamCm": 5.4,
  "downstreamCm": 5.1,
  "pumpOn": true,
  "floatSafe": true
}
```

**Timestamp** = Unix milidetik (perlu sinkronisasi waktu NTP); boolean harus JSON true/false bukan teks. Jika sensor rusak: kirim `sensorValid:false` dan status kesehatan di channel terpisah; **jangan mengisi data palsu 0** sebagai nilai valid. Dashboard akan menolak data sensor tidak valid. `history/{push-id}` menyimpan payload yang sama saat pembacaan baru. `sessionId` perlu konsisten dengan pencatatan data primer oleh tim ML.

## Alur data dan aktuator

1. ESP32 baca flow/ultrasonik, validasi batas ukur, berikan timestamp & `sessionId`.
2. Prioritaskan interlock float switch **secara lokal**: matikan pompa sebelum komunikasi jaringan/inferensi.
3. Kirim payload ke RTDB setelah autentikasi berhasil. Jika Wi-Fi putus, lanjutkan pengaman lokal dan catat kegagalan; retry aman tanpa membanjiri database.
4. Pemantauan browser hanya READ pada versi konsep. Instruksi operasi pompa atau servo dari browser belum dibuat, agar tidak mengklaim remote control yang belum dirancang.

## Pertanyaan untuk tim Hardware

- Servo fisik atau sekat manual? Apakah yang dikendalikan servo hanya simulasi kondisi saat eksperimen?
- Driver pompa dan sumber daya final (terutama batas tegangan yang perlu konfirmasi ke dosen)?
- Sensor tinggi air yang dipakai di fisik sama dengan simulasi (JSN-SR04T)? Perlu uji blind-zone dan tinggi pemasangan.
- Faktor kalibrasi flow sensor dan sampling rate operasional. **Usulan untuk ML: 1 Hz**, bukan keputusan final.
- Otorisasi penulis Firebase: API/gateway yang aman atau identitas Firebase Auth perangkat. **Service account tidak boleh ditaruh pada ESP32.**
