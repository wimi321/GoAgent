# Desktop App UX References

GoAgent is a desktop workbench, not a browser-first web app. Sprint 7 desktop polish follows these product references without copying their UI.

## Reference Directions

- Cherry Studio: desktop-first model settings, provider management, cross-platform release discipline.
- OpenCode / OpenChamber / Palot: agent sessions, tool output streams, multi-project desktop workflows.
- Cursor / Windsurf / Kiro: AI editor layout, command palette, agent panel hierarchy, compact status surfaces.
- VS Code: native menu, command palette, status bar, file/workspace mental model.
- Claude Desktop: quiet MCP/tool setup and minimal preferences surface.

## GoAgent Decisions

- Native Electron menu owns global commands such as import, settings, command palette, and analysis actions.
- Renderer uses a desktop shell with titlebar, workbench, and statusbar instead of a page-only layout.
- Preferences are a desktop modal window, not a chat-panel drawer.
- Teacher UI is an agent editor with Thread / Turn / Item stream language.
- UI Gallery remains internal visual QA and must not become a user-facing route.

## Acceptance

- Main workflow should feel like an installed macOS/Windows/Linux app.
- `Command/Ctrl+K` opens a command palette.
- `Command/Ctrl+,` opens Preferences.
- Status bar always shows selected game, move, winrate state, KataGo state, LLM state, and current task.
- No release should be tagged until visual QA evidence confirms the desktop shell on macOS and Windows.
