# Pertanyaan keputusan rapat kelompok — gunakan sebelum coding hardware dan training

| Pemilik | Keputusan | Usulan sementara (bukan fakta final) |
|---|---|---|
| Tim ML + dosen | 3 kelas sesuai topik atau perluasan ke bocor? | Ikuti proposal IoT: 3 kelas sumbatan |
| Hardware | Servo untuk mengatur bukaan atau sekat manual? | Nyatakan pilihan final dalam dokumen rangkaian |
| Hardware + dosen | Catu pompa DC 12 V vs panduan UAS sumber <12 V | Verifikasi dan utamakan keselamatan |
| Hardware + ML | Sampling interval dan panjang jendela ML | Usulan 1 Hz, window 10 sampel, hop 5 detik |
| Tim ML | Algoritma final berdasarkan data primer | Random Forest hanya kandidat dari proposal, bukan pemenang yang sudah dibuktikan |
| Software + Hardware | Keamanan akses penulis ESP32 ke RTDB | Desain autentikasi/gateway, jangan public write |
| Software | Deploy Python terus-menerus di mana? | Laptop/server Python dengan koneksi internet selama demo |
| Semua | Boleh kendali pompa/servo dari dashboard? | Nonaktif sampai keamanan perangkat disepakati; status dipantau saja |

Bukti diperlukan: diagram wiring final, model contract yang disetujui, dataset primer, hasil kalibrasi, test konektivitas dan pengaman lokal, serta hasil evaluasi model atas data baru.
