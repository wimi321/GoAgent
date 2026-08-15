<p align="center">
  <img src="./assets/logo.png" alt="GoAgent logo" width="128" height="128" />
</p>

<h1 align="center">GoAgent · AI Agent สำหรับโกะ</h1>

<p align="center">
  <strong>AI agent สำหรับการเรียน Go / Weiqi / Baduk.</strong><br />
  KataGo ให้ข้อมูลเชิงวิเคราะห์ ส่วน multimodal LLM ช่วยอธิบายให้ผู้เรียนเข้าใจและนำไปฝึกต่อได้
</p>

<p align="center">
  <a href="https://github.com/wimi321/GoAgent/releases"><img alt="Release" src="https://img.shields.io/github/v/release/wimi321/GoAgent?include_prereleases&style=for-the-badge&label=Release" /></a>
  <a href="https://github.com/wimi321/GoAgent/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/wimi321/GoAgent/total?style=for-the-badge&label=Downloads" /></a>
  <a href="https://github.com/wimi321/GoAgent/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/wimi321/GoAgent?style=for-the-badge" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f172a?style=for-the-badge" /></a>
  <a href="#ชุมชน"><img alt="QQ Group" src="https://img.shields.io/badge/QQ%20Group-1030632742-2563eb?style=for-the-badge" /></a>
</p>

<p align="center">
  <a href="./README.md">中文</a> |
  <a href="./README_EN.md">English</a> |
  <a href="./README_JA.md">日本語</a> |
  <a href="./README_KO.md">한국어</a> |
  <a href="./README_TH.md">ไทย</a> |
  <a href="./README_VI.md">Tiếng Việt</a>
</p>

<p align="center">
  <strong>ชุมชน GoAgent: QQ 1030632742</strong><br />
  ยินดีรับฟังความคิดเห็น ข้อเสนอแนะ และรายงานบั๊ก
</p>

---

GoAgent เป็นแอปเดสก์ท็อปแบบ local-first สำหรับผู้เรียนและครูสอนโกะ แอปนี้รวม KataGo, ภาพกระดาน, ฐานความรู้ในเครื่อง, โปรไฟล์ผู้เรียน และ multimodal LLM ให้กลายเป็นครูโกะแบบ agent ที่ช่วยวิเคราะห์และวางแผนการฝึกได้

## ดาวน์โหลด

รุ่นเผยแพร่สาธารณะ:

[GoAgent v0.4.20](https://github.com/wimi321/GoAgent/releases/tag/v0.4.20)

| แพลตฟอร์ม | ดาวน์โหลด |
| --- | --- |
| macOS Apple Silicon | [DMG](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [DMG](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard portable ZIP | [ZIP](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard installer | [EXE](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA portable 7z | [7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA installer | [EXE](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

แอป macOS ลงนามด้วย Developer ID ผ่าน Apple notarization และมี stapled ticket แล้ว โดย CI ตรวจลายเซ็น Gatekeeper ticket และความสมบูรณ์ของ DMG ก่อนอัปโหลด ส่วนแพ็กเกจ Windows ยังไม่ได้ลงนามและอาจแสดง SmartScreen

## ความสามารถหลัก

- ซิงก์棋谱สาธารณะจาก Fox/野狐 และนำเข้า SGF
- กระดานสไตล์ Lizzie / KTrain พร้อม candidate moves, played-move comparison และ winrate timeline
- โหลดเกมแล้วเริ่มวิเคราะห์ด้วย KataGo อัตโนมัติ
- เลือกตาเดินบนกราฟแล้ววิเคราะห์ตำแหน่งนั้นต่ออัตโนมัติ
- ครู AI อธิบายตาปัจจุบัน วิเคราะห์ทั้งเกม วิเคราะห์ 10 เกมล่าสุด และสร้างแผนฝึก
- ฐานความรู้ในเครื่องและโปรไฟล์ผู้เรียนระยะยาว

## พัฒนาในเครื่อง

```bash
pnpm install
python3 -m pip install -r scripts/requirements.txt
pnpm dev
```

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

## ความเป็นส่วนตัว

棋谱, รายงาน, การตั้งค่า และโปรไฟล์ผู้เรียนจะถูกเก็บไว้ที่ `~/.goagent` โดยค่าเริ่มต้น การวิเคราะห์ตาปัจจุบันอาจส่งภาพกระดาน, KataGo JSON และ knowledge cards บางส่วนไปยัง LLM endpoint ที่ผู้ใช้ตั้งค่าไว้

## ชุมชน

ยินดีต้อนรับทุกคนเข้ากลุ่ม QQ เพื่อแลกเปลี่ยนความคิดเห็นและช่วยกันพัฒนา:

```text
1030632742
```

## License

MIT. See [LICENSE](./LICENSE).
