# Rocket Transfers 🚀

**Rocket Transfers** is a high-speed, secure file-sharing web application designed to bridge the gap between devices. Whether you're moving a document from PC to mobile or sharing a file with a colleague across the globe, Rocket Transfers makes it as simple as entering a code.

---

## 📸 Screenshots

| Home Screen | Uploading File | Code Generation |
| :--- | :--- | :--- |
| ![Home Page](./screenshots/Screenshot(2101).png) | ![Upload Page](./screenshots/Screenshot(2102).png) | ![Code Page](./screenshots/Screenshot(2103).png) |

---

## 📌 Features

* **Code-Based Sharing:** No accounts or email links required. Upload a file, get a unique code, and download it anywhere.
* **Custom Expiration:** Users can set a specific "Time of Availability." Files are automatically wiped from the server once the time expires.
* **Cross-Platform:** Works on any device with a modern web browser and an internet connection.
* **GhostLink (In Development):** An ephemeral "incognito" room for real-time chatting and file sharing that leaves zero digital footprint once the session ends.

## 🛠 Tech Stack

* **Frontend:** React.js
* **Backend/Storage:** Supabase (PostgreSQL & Storage Buckets)
* **State Management:** React Context API
* **Styling:** Tailwind CSS

## 🚀 How It Works

1. **Upload:** Select your file and upload it to secure storage.
2. **Configure:** Set the duration for how long the file should remain active.
3. **Transfer:** Generate a unique alphanumeric code.
4. **Receive:** Enter the code on the recipient device to trigger an instant download.

---

## 🏗 Technical Challenges & Learnings

* **Storage Management:** Managed file uploads to Supabase buckets and generated signed URLs for secure, temporary downloading.
* **Data Persistence:** Implemented logic to ensure files are purged immediately after the set expiration time.
* **Real-time UX:** Focused on minimizing the steps between "File Selection" and "Code Generation."

---

## 🤝 Contributing & Learning

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. 

**I especially welcome contributions for:**
* **GhostLink:** Help me build the real-time chat and ephemeral room logic!
* **UI/UX:** Improving the file-upload progress visualizations.
* **Bug Fixes:** Feel free to open an issue or submit a Pull Request.

---

## 📜 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

* **You are free to:** Share, remix, and build upon this code for personal or educational purposes.
* **Under the following terms:** You must give appropriate credit and you **may not** use the material for commercial purposes.

---
