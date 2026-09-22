# 🎮 Wardogs KW — 4v4 Multiplayer Web FPS Game

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-blue.svg)](https://github.com/websockets/ws)
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js-black.svg)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Wardogs KW** adalah game First-Person Shooter (FPS) multiplayer 3D berbasis web yang terinspirasi dari game klasik Point Blank & Counter-Strike. Game ini dapat dimainkan langsung dari browser secara real-time tanpa perlu instalasi aplikasi tambahan.

---

## ✨ Fitur Utama

- 🌐 **Real-time Multiplayer:** Sinkronisasi posisi, rotasi, tembakan, dan damage berbasis WebSocket berkecepatan 30 tick/detik.
- 🤖 **Smart AI Bots:** Auto-balancing bot dengan pathfinding waypoint, visual awareness, dan penembakan adaptif saat slot pemain kurang.
- 🚪 **Custom Room System:**
  - Buat room custom dengan nama & kode unik.
  - Opsi target kill: 40, 60, 80, atau 100 kills.
  - Mode Bot On / Pure PvP (No Bot).
- 🔫 **Persenjataan & Efek Visual/Suara:**
  - Senjata utama (Assault Rifle) dengan recoil, muzzle flash, tracer bullet, dan hit spark.
  - Audio synthesizer Web Audio API untuk tembakan, hit marker, kill sound, dan headshot.
- 🗺️ **Taktikal Map:** Map bergaya arena dengan Base Red & Blue, obstacle box kayu, pilar pelindung, dan sistem one-way spawn barrier.
- 📊 **Scoreboard & Killfeed:** Kill notifications, assist tracker, headshot indicator, dan papan skor live.

---

## 🎮 Kontrol Game (Controls)

| Tombol | Fungsi |
| :--- | :--- |
| **W, A, S, D** | Bergerak (Maju, Kiri, Mundur, Kanan) |
| **Mouse** | Mengarahkan pandangan & membidik |
| **Klik Kiri** | Menembak (Shoot) |
| **R** | Reload Magazine |
| **Spasi (Space)** | Melompat (Jump) |
| **Shift** | Berlari cepat (Sprint) |
| **Tab** | Melihat Papan Skor (Scoreboard) |
| **Esc** | Membuka kunci kursor mouse / Menu |

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla ES6), Three.js (WebGL 3D Engine), Web Audio API
- **Backend:** Node.js, Express, `ws` (WebSocket)
- **Deployment:** Render.com / Railway / Cloudflare Tunnel

---

## 📦 Prasyarat Sistem (Prerequisites)

Sebelum menginstal, pastikan komputer Anda telah terpasang:
- [Node.js](https://nodejs.org/) (Versi 18.x atau lebih baru)
- [Git](https://git-scm.com/)

---

## 🚀 Panduan Instalasi & Menjalankan (Local)

### 1. Clone Repository
```bash
git clone https://github.com/<username-anda>/wardogs-kw.git
cd wardogs-kw
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Jalankan Server
```bash
npm start
```

### 4. Buka Game di Browser
Buka browser favorit Anda dan akses:
```
http://localhost:3000
```

---

## ☁️ Panduan Deploy Online (Render.com - 100% Gratis)

1. Push repository ini ke akun **GitHub** Anda.
2. Buka dan login ke [Render Dashboard](https://dashboard.render.com/).
3. Klik **New +** > **Web Service**.
4. Hubungkan repository GitHub `wardogs-kw`.
5. Pengaturan yang digunakan:
   - **Name:** `wardogs-kw`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free`
6. Klik **Create Web Service**. Link game online siap digunakan dalam hitungan menit!

---

## 📄 Lisensi

Proyek ini berada di bawah lisensi MIT.
