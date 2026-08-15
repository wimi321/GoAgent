<p align="center">
  <img src="./assets/logo.png" alt="GoAgent logo" width="128" height="128" />
</p>

<h1 align="center">GoAgent · 바둑 AI 에이전트</h1>

<p align="center">
  <strong>Go / Weiqi / Baduk을 위한 에이전트형 AI 바둑 선생님.</strong><br />
  KataGo는 사실을 판단하고, 멀티모달 LLM은 사람이 이해할 수 있게 설명합니다.
</p>

<p align="center">
  <a href="https://github.com/wimi321/GoAgent/releases"><img alt="Release" src="https://img.shields.io/github/v/release/wimi321/GoAgent?include_prereleases&style=for-the-badge&label=Release" /></a>
  <a href="https://github.com/wimi321/GoAgent/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/wimi321/GoAgent/total?style=for-the-badge&label=Downloads" /></a>
  <a href="https://github.com/wimi321/GoAgent/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/wimi321/GoAgent?style=for-the-badge" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f172a?style=for-the-badge" /></a>
  <a href="#커뮤니티"><img alt="QQ Group" src="https://img.shields.io/badge/QQ%20Group-1030632742-2563eb?style=for-the-badge" /></a>
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
  <strong>GoAgent 커뮤니티: QQ 1030632742</strong><br />
  사용 후기, 제안, 버그 리포트를 환영합니다.
</p>

---

GoAgent는 KataGo, 바둑판 스크린샷, 로컬 지식 카드, 학생 프로필, 멀티모달 LLM을 하나의 에이전트형 바둑 선생님으로 묶는 로컬 우선 데스크톱 앱입니다.

## 다운로드

공개 릴리스:

[GoAgent v0.4.20](https://github.com/wimi321/GoAgent/releases/tag/v0.4.20)

| 플랫폼 | 다운로드 |
| --- | --- |
| macOS Apple Silicon | [DMG](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-arm64.dmg) |
| macOS Intel | [DMG](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-mac-x64.dmg) |
| Windows x64 Standard portable ZIP | [ZIP](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-portable.zip) |
| Windows x64 Standard installer | [EXE](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64.exe) |
| Windows x64 NVIDIA portable 7z | [7z](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia-portable.7z) |
| Windows x64 NVIDIA installer | [EXE](https://github.com/wimi321/GoAgent/releases/download/v0.4.20/GoAgent-0.4.20-win-x64-nvidia.exe) |

macOS 앱은 Developer ID로 서명되고 Apple notarization 및 stapled ticket 검증을 완료했습니다. CI가 업로드 전에 서명, Gatekeeper, ticket, DMG 무결성을 확인합니다. Windows 패키지는 아직 서명되지 않아 SmartScreen이 표시될 수 있습니다.

## 주요 기능

- Fox/野狐 공개 기보 동기화와 SGF 가져오기.
- Lizzie / KTrain 스타일 바둑판, 후보수, 실전수 비교, 승률 그래프.
- 기보를 불러오면 KataGo 분석을 자동 시작.
- 승률 그래프에서 수순을 선택하면 해당 국면 분석을 자동으로 계속 진행.
- 현재 수, 전체 대국, 최근 10국, 훈련 계획을 LLM이 설명.
- 로컬 지식 베이스와 장기 학생 프로필.

## 개발

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

## 개인정보

기보, 설정, 리포트, 학생 프로필은 기본적으로 `~/.goagent`에 저장됩니다. 현재 수 설명은 사용자가 설정한 LLM 엔드포인트로 바둑판 이미지, KataGo JSON, 선택된 지식 카드를 보낼 수 있습니다.

## 커뮤니티

의견과 제안을 위해 QQ 그룹에 참여해 주세요.

```text
1030632742
```

## License

MIT. See [LICENSE](./LICENSE).
